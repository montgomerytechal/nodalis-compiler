using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;

// NuGet: BACnet (ela-compil / System.IO.BACnet)
using System.IO.BACnet;

namespace Nodalis
{
    /// <summary>
    /// BACnet/IP IOClient implementation modeled after the project's C++ bacnet.cpp/h behavior.
    ///
    /// Key behaviors matched:
    /// - Uses ReadProperty / WriteProperty to BACnet objects.
    /// - Supports per-point value type selection (BOOL/BYTE/WORD/DWORD/LWORD/SINT/INT/DINT/LINT/REAL/DOUBLE/ENUM).
    /// - For REAL/DOUBLE, uses the same uint64<->double fixed-point encoding as the C++ implementation:
    ///   upper 32 bits = signed integer part; lower 32 bits = fractional part (fraction / 2^32).
    /// - Default write priority = 16.
    ///
    /// Mapping expectations (updated to match the C++ BACNETClient changes):
    /// - IOMap.ModuleID: BACnet device IP (e.g., "10.20.30.250")
    /// - IOMap.ModulePort: BACnet/IP UDP port (default 47808)
    /// - IOMap.RemoteAddress: an arbitrary key used to identify the point (we don't parse it).
    /// - IOMap.ProtocolProperties (JSON object in the mapping) must contain the point definition:
    ///   - objectType / ObjectType        : numeric BACnet object type (e.g., 2)
    ///   - objectInstance / ObjectInstance: object instance (e.g., 100)
    ///   - propertyId / PropertyId        : numeric BACnet property id (e.g., 85)
    ///   - arrayIndex / ArrayIndex        : optional; defaults to BACNET_ARRAY_ALL
    ///   - valueType / ValueType          : one-letter tag selector (matches C++):
    ///       "b"=BOOLEAN, "u"=UNSIGNED, "i"=SIGNED, "f"=REAL, "d"=DOUBLE
    ///   - Priority                        : optional BACnet write priority (1-16), default 16
    /// </summary>
    public sealed class BacnetIpClient : IOClient
    {
        private BacnetClient? _client;
        private BacnetAddress? _deviceAddr;

        // We build a lookup by RemoteAddress so our Read*/Write* methods can access ProtocolProperties.
        private readonly Dictionary<string, IOMap> _mapByRemote = new(StringComparer.InvariantCultureIgnoreCase);

        private int _udpPort = 47808;
        private string _deviceIp = "";

        public BacnetIpClient() : base("BACNET-IP")
        {
            // parent abstract requires a parameterless constructor usage in NodalisEngine.CreateClient
        }

        public override void Connect()
        {
            if (mappings.Count == 0)
                return;

            // Choose module parameters from first mapping (same pattern as ModbusClient).
            var first = mappings[0];

            _deviceIp = first.moduleID ?? "";
            if (string.IsNullOrWhiteSpace(_deviceIp))
                return;

            // Port can be 0 in config; treat as default.
            if (!int.TryParse(first.modulePort ?? string.Empty, NumberStyles.Integer, CultureInfo.InvariantCulture, out _udpPort) || _udpPort <= 0)
                _udpPort = 47808;

            // Build lookup for ProtocolProperties.
            _mapByRemote.Clear();
            foreach (var m in mappings)
            {
                if (!string.IsNullOrWhiteSpace(m.remoteAddress))
                    _mapByRemote[m.remoteAddress] = m;
            }

            // Create BACnet client (BACnet/IP UDP).
            // NOTE: In the ela-compil BACnet library, BacnetClient typically takes a BacnetTransport.
            var transport = new BacnetIpUdpProtocolTransport(_udpPort, false);
            _client = new BacnetClient(transport);
            _client.Start();

            // Device address string supports either "ip" or "ip:port".
            var addrStr = _udpPort > 0 ? $"{_deviceIp}:{_udpPort}" : _deviceIp;
            _deviceAddr = new BacnetAddress(BacnetAddressTypes.IP, addrStr);

            connected = true;
        }

        public override bool ReadBit(string address, out int value)
        {
            value = 0;
            if (!TryReadNumeric(address, out var raw))
                return false;

            value = raw != 0 ? 1 : 0;
            return true;
        }

        public override bool ReadByte(string address, out byte value)
        {
            value = 0;
            if (!TryReadNumeric(address, out var raw))
                return false;

            value = (byte)(raw & 0xFF);
            return true;
        }

        public override bool ReadWord(string address, out ushort value)
        {
            value = 0;
            if (!TryReadNumeric(address, out var raw))
                return false;

            value = (ushort)(raw & 0xFFFF);
            return true;
        }

        public override bool ReadDWord(string address, out uint value)
        {
            value = 0;
            if (!TryReadNumeric(address, out var raw))
                return false;

            value = (uint)(raw & 0xFFFFFFFF);
            return true;
        }

        public override bool ReadLWord(string address, out ulong value)
        {
            value = 0;
            if (!TryReadNumeric(address, out var raw))
                return false;

            value = raw;
            return true;
        }

        public override bool WriteBit(string address, int value)
            => TryWriteNumeric(address, value > 0 ? 1UL : 0UL);

        public override bool WriteByte(string address, byte value)
            => TryWriteNumeric(address, value);

        public override bool WriteWord(string address, ushort value)
            => TryWriteNumeric(address, value);

        public override bool WriteDWord(string address, uint value)
            => TryWriteNumeric(address, value);

        public override bool WriteLWord(string address, ulong value)
            => TryWriteNumeric(address, value);

        // ---------------------- core BACnet read/write ----------------------

        private bool TryReadNumeric(string remoteAddress, out ulong value)
        {
            value = 0;

            if (!connected || _client == null || _deviceAddr == null)
                return false;

            if (!TryParsePoint(remoteAddress, out var point))
                return false;

            try
            {
                var objId = new BacnetObjectId(point.ObjectType, point.ObjectInstance);

                if (!InvokeReadProperty(_client, _deviceAddr, objId, point.PropertyId, point.ArrayIndex, out var values))
                    return false;

                if (values == null || values.Count == 0)
                    return false;

                // Prefer the first value.
                var bacVal = values[0];
                if (!TryDecodeToUInt64(bacVal, point.ValueTag, out value))
                    return false;

                return true;
            }
            catch
            {
                return false;
            }
        }

        private bool TryWriteNumeric(string remoteAddress, ulong rawValue)
        {
            if (!connected || _client == null || _deviceAddr == null)
                return false;

            if (!TryParsePoint(remoteAddress, out var point))
                return false;

            try
            {
                var objId = new BacnetObjectId(point.ObjectType, point.ObjectInstance);

                var bacnetValue = EncodeFromUInt64(rawValue, point.ValueTag);
                var list = new BacnetValue[] { bacnetValue };

                byte priority = point.Priority;
                if (priority < 1 || priority > 16) priority = 16;

                return InvokeWriteProperty(_client, _deviceAddr, objId, point.PropertyId, list, point.ArrayIndex, priority);
            }
            catch
            {
                return false;
            }
        }

        // ---------------------- mapping + parsing ----------------------

        private bool TryParsePoint(string remoteAddress, out BacnetPoint point)
        {
            point = default;

            // Match C++: point definition comes from the mapping's properties, not from RemoteAddress parsing.
            if (!_mapByRemote.TryGetValue(remoteAddress, out var map) || map?.protocolProperties == null)
                return false;

            var props = map.protocolProperties;

            // Required numeric fields.
            if (!TryGetUInt(props, "objectType", out var objType) && !TryGetUInt(props, "ObjectType", out objType))
                return false;
            if (!TryGetUInt(props, "propertyId", out var propId) && !TryGetUInt(props, "PropertyId", out propId))
                return false;
            if (!uint.TryParse(remoteAddress, out var objInst))
                return false;

            point.ObjectType = (BacnetObjectTypes)objType;

            point.ObjectInstance = objInst;
            point.PropertyId = (BacnetPropertyIds)propId;

            // Optional.
            if (!TryGetUInt(props, "arrayIndex", out var arrayIndex) && !TryGetUInt(props, "ArrayIndex", out arrayIndex))
                arrayIndex = uint.MaxValue; // BACNET_ARRAY_ALL
            point.ArrayIndex = arrayIndex;

            props.TryGetValue("Priority", out var priorityStr);
            point.Priority = ParsePriority(priorityStr, 16);

            // Value type selector (C++ uses one-letter codes).
            props.TryGetValue("valueType", out var vt1);
            props.TryGetValue("ValueType", out var vt2);
            point.ValueTag = ParseValueTag(!string.IsNullOrWhiteSpace(vt1) ? vt1 : vt2);

            return true;
        }

        private static bool TryGetUInt(Dictionary<string, string> dict, string key, out uint value)
        {
            value = 0;
            if (!dict.TryGetValue(key, out var raw) || string.IsNullOrWhiteSpace(raw))
                return false;
            return uint.TryParse(raw.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }

        private static BacnetApplicationTags ParseValueTag(string? raw)
        {
            var k = (raw ?? string.Empty).Trim().ToLowerInvariant();
            return k switch
            {
                "b" => BacnetApplicationTags.BACNET_APPLICATION_TAG_BOOLEAN,
                "u" => BacnetApplicationTags.BACNET_APPLICATION_TAG_UNSIGNED_INT,
                "i" => BacnetApplicationTags.BACNET_APPLICATION_TAG_SIGNED_INT,
                "f" => BacnetApplicationTags.BACNET_APPLICATION_TAG_REAL,
                "d" => BacnetApplicationTags.BACNET_APPLICATION_TAG_DOUBLE,
                _ => BacnetApplicationTags.BACNET_APPLICATION_TAG_ENUMERATED,
            };
        }

        private static byte ParsePriority(string? s, byte fallback)
        {
            if (byte.TryParse((s ?? "").Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v))
                return v;
            return fallback;
        }

        // ---------------------- value encode/decode ----------------------

        private static BacnetValue EncodeFromUInt64(ulong raw, BacnetApplicationTags valueTag)
        {
            // Mirrors C++: encodeValue(raw, point.valueType, ...)
            // NOTE: For integer-like tags, C++ masks to 32-bit.
            return valueTag switch
            {
                BacnetApplicationTags.BACNET_APPLICATION_TAG_BOOLEAN
                    => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_BOOLEAN, raw != 0),

                BacnetApplicationTags.BACNET_APPLICATION_TAG_UNSIGNED_INT
                    => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_UNSIGNED_INT, (uint)(raw & 0xFFFFFFFFUL)),

                BacnetApplicationTags.BACNET_APPLICATION_TAG_SIGNED_INT
                    => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_SIGNED_INT, unchecked((int)(raw & 0xFFFFFFFFUL))),

                BacnetApplicationTags.BACNET_APPLICATION_TAG_ENUMERATED
                    => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_ENUMERATED, (uint)(raw & 0xFFFFFFFFUL)),

                BacnetApplicationTags.BACNET_APPLICATION_TAG_REAL
                    => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_REAL, (float)UInt64ToDouble(raw)),

                BacnetApplicationTags.BACNET_APPLICATION_TAG_DOUBLE
                    => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_DOUBLE, UInt64ToDouble(raw)),

                _ => new BacnetValue(BacnetApplicationTags.BACNET_APPLICATION_TAG_ENUMERATED, (uint)(raw & 0xFFFFFFFFUL))
            };
        }

        private static bool TryDecodeToUInt64(BacnetValue bacVal, BacnetApplicationTags desiredTag, out ulong result)
        {
            // Mirrors C++: decodeNumeric(value) then fixed-point packing for float/double
            result = 0;

            try
            {
                // BacnetValue has Tag + Value.
                var tag = bacVal.Tag;
                var val = bacVal.Value;

                switch (tag)
                {
                    case BacnetApplicationTags.BACNET_APPLICATION_TAG_BOOLEAN:
                        result = Convert.ToBoolean(val, CultureInfo.InvariantCulture) ? 1UL : 0UL;
                        return true;

                    case BacnetApplicationTags.BACNET_APPLICATION_TAG_UNSIGNED_INT:
                        result = Convert.ToUInt64(val, CultureInfo.InvariantCulture);
                        return true;

                    case BacnetApplicationTags.BACNET_APPLICATION_TAG_SIGNED_INT:
                        result = unchecked((ulong)Convert.ToInt64(val, CultureInfo.InvariantCulture));
                        return true;

                    case BacnetApplicationTags.BACNET_APPLICATION_TAG_ENUMERATED:
                        result = Convert.ToUInt64(val, CultureInfo.InvariantCulture);
                        return true;

                    case BacnetApplicationTags.BACNET_APPLICATION_TAG_REAL:
                    {
                        var d = Convert.ToDouble(val, CultureInfo.InvariantCulture);
                        result = DoubleToUInt64(d);
                        return true;
                    }

                    case BacnetApplicationTags.BACNET_APPLICATION_TAG_DOUBLE:
                    {
                        var d = Convert.ToDouble(val, CultureInfo.InvariantCulture);
                        result = DoubleToUInt64(d);
                        return true;
                    }

                    default:
                        // Some devices might return BOOLEAN as ENUMERATED 0/1 etc. Try a best-effort conversion.
                        if (val is null)
                            return false;

                        if (val is bool b)
                        {
                            result = b ? 1UL : 0UL;
                            return true;
                        }

                        if (val is sbyte or short or int or long)
                        {
                            result = unchecked((ulong)Convert.ToInt64(val, CultureInfo.InvariantCulture));
                            return true;
                        }

                        if (val is byte or ushort or uint or ulong)
                        {
                            result = Convert.ToUInt64(val, CultureInfo.InvariantCulture);
                            return true;
                        }

                        if (val is float or double or decimal)
                        {
                            // Preserve fixed-point behavior for REAL/DOUBLE.
                            var d = Convert.ToDouble(val, CultureInfo.InvariantCulture);
                            result = DoubleToUInt64(d);
                            return true;
                        }

                        // Last resort: try parsing string.
                        if (val is string str && double.TryParse(str, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                        {
                            result = (desiredTag == BacnetApplicationTags.BACNET_APPLICATION_TAG_REAL || desiredTag == BacnetApplicationTags.BACNET_APPLICATION_TAG_DOUBLE)
                                ? DoubleToUInt64(parsed)
                                : (ulong)parsed;
                            return true;
                        }

                        return false;
                }
            }
            catch
            {
                return false;
            }
        }

        // Fixed-point packing (same as C++ bacnet.h)
        private static ulong DoubleToUInt64(double value)
        {
            // Matches updated C++ double_to_uint64() behavior:
            // - clamp to int32 + fraction in [0,1)
            // - use floor for negative numbers so fraction is always in [0,1)
            // - round fractional to nearest and handle carry
            if (double.IsNaN(value) || double.IsInfinity(value))
                return 0;

            const double twoPow32 = 4294967296.0;

            double minVal = (double)int.MinValue;
            double maxVal = (double)int.MaxValue + (1.0 - 1.0 / twoPow32);
            if (value < minVal) value = minVal;
            if (value > maxVal) value = maxVal;

            double intPartD = Math.Floor(value);
            double fracD = value - intPartD; // [0,1)

            int integer = (int)intPartD;

            double scaled = fracD * twoPow32;
            ulong frac = (ulong)Math.Round(scaled, MidpointRounding.AwayFromZero);

            if (frac >= 0x1_0000_0000UL)
            {
                // Carry into integer if rounding pushed over.
                frac = 0;
                if (integer < int.MaxValue)
                    integer++;
                else
                    frac = 0xFFFF_FFFFUL; // saturate
            }

            return ((ulong)(uint)integer << 32) | (frac & 0xFFFF_FFFFUL);
        }

        private static double UInt64ToDouble(ulong value)
        {
            var fractional = (uint)(value & 0xFFFFFFFFUL);
            var integer = unchecked((int)(value >> 32));

            var result = (double)integer;
            result += fractional / 4294967296.0;
            return result;
        }

        // ---------------------- reflection-based invocation (API-version tolerant) ----------------------

        private static bool InvokeReadProperty(
            BacnetClient client,
            BacnetAddress adr,
            BacnetObjectId objId,
            BacnetPropertyIds propertyId,
            uint arrayIndex,
            out IList<BacnetValue>? values)
        {
            values = null;

            // Common signatures in System.IO.BACnet across versions include:
            //   bool ReadPropertyRequest(BacnetAddress adr, BacnetObjectId objectId, BacnetPropertyIds propertyId, out IList<BacnetValue> valueList)
            //   bool ReadPropertyRequest(BacnetAddress adr, BacnetObjectId objectId, BacnetPropertyIds propertyId, uint propertyArrayIndex, out IList<BacnetValue> valueList)

            var methods = client.GetType().GetMethods().Where(m => m.Name == "ReadPropertyRequest").ToArray();

            foreach (var m in methods)
            {
                var p = m.GetParameters();

                try
                {
                    if (p.Length == 4 && p[3].IsOut)
                    {
                        object?[] args = { adr, objId, propertyId, null };
                        var ok = (bool)m.Invoke(client, args)!;
                        values = args[3] as IList<BacnetValue>;
                        return ok && values != null;
                    }

                    if (p.Length == 5 && p[4].IsOut)
                    {
                        // array index included
                        object?[] args = { adr, objId, propertyId, arrayIndex, null };
                        var ok = (bool)m.Invoke(client, args)!;
                        values = args[4] as IList<BacnetValue>;
                        return ok && values != null;
                    }
                }
                catch
                {
                    // Try next overload.
                }
            }

            return false;
        }

        private static bool InvokeWriteProperty(
            BacnetClient client,
            BacnetAddress adr,
            BacnetObjectId objId,
            BacnetPropertyIds propertyId,
            IEnumerable<BacnetValue> values,
            uint arrayIndex,
            byte priority)
        {
            // Common signatures observed in System.IO.BACnet across versions include:
            //   bool WritePropertyRequest(BacnetAddress adr, BacnetObjectId objectId, BacnetPropertyIds propertyId, IEnumerable<BacnetValue> valueList)
            //   bool WritePropertyRequest(BacnetAddress adr, BacnetObjectId objectId, BacnetPropertyIds propertyId, IEnumerable<BacnetValue> valueList, byte invokeId)
            //   bool WritePropertyRequest(BacnetAddress adr, BacnetObjectId objectId, BacnetPropertyIds propertyId, IEnumerable<BacnetValue> valueList, bool wait_for_reply, byte invokeId)
            // Some overloads include array index / priority in different ways; we try best-fit.

            var methods = client.GetType().GetMethods().Where(m => m.Name == "WritePropertyRequest").ToArray();

            foreach (var m in methods)
            {
                var p = m.GetParameters();

                try
                {
                    // 4-arg: (adr, objId, propertyId, values)
                    if (p.Length == 4)
                    {
                        object?[] args = { adr, objId, propertyId, values };
                        return (bool)m.Invoke(client, args)!;
                    }

                    // 5-arg: (adr, objId, propertyId, values, invokeId)
                    if (p.Length == 5 && p[4].ParameterType == typeof(byte))
                    {
                        object?[] args = { adr, objId, propertyId, values, (byte)0 };
                        return (bool)m.Invoke(client, args)!;
                    }

                    // 6-arg: (adr, objId, propertyId, values, wait_for_reply, invokeId)
                    if (p.Length == 6 && p[4].ParameterType == typeof(bool) && p[5].ParameterType == typeof(byte))
                    {
                        object?[] args = { adr, objId, propertyId, values, true, (byte)0 };
                        return (bool)m.Invoke(client, args)!;
                    }

                    // If we find an overload with priority or array index, try to map.
                    // Example pattern: (..., uint arrayIndex, byte priority, byte invokeId)
                    if (p.Length >= 6)
                    {
                        // Build args with defaults.
                        var args = new object?[p.Length];
                        args[0] = adr;
                        args[1] = objId;
                        args[2] = propertyId;
                        args[3] = values;

                        for (int i = 4; i < p.Length; i++)
                        {
                            var t = p[i].ParameterType;
                            if (t == typeof(uint) || t == typeof(UInt32)) args[i] = arrayIndex;
                            else if (t == typeof(int)) args[i] = (int)arrayIndex;
                            else if (t == typeof(byte)) args[i] = (byte)0;
                            else if (t == typeof(bool)) args[i] = true;
                            else if (t.IsEnum && t.Name.IndexOf("Priority", StringComparison.OrdinalIgnoreCase) >= 0) args[i] = priority;
                            else args[i] = Activator.CreateInstance(t);
                        }

                        // Prefer to place priority into any byte param that follows a uint array index.
                        for (int i = 4; i < p.Length; i++)
                        {
                            if ((p[i].ParameterType == typeof(byte)) && i > 4 && (p[i - 1].ParameterType == typeof(uint) || p[i - 1].ParameterType == typeof(int)))
                            {
                                args[i] = priority;
                                break;
                            }
                        }

                        return (bool)m.Invoke(client, args)!;
                    }
                }
                catch
                {
                    // Try next overload.
                }
            }

            return false;
        }

        // ---------------------- internal types ----------------------

        private struct BacnetPoint
        {
            public BacnetObjectTypes ObjectType;
            public uint ObjectInstance;
            public BacnetPropertyIds PropertyId;
            public uint ArrayIndex;
            public BacnetApplicationTags ValueTag;
            public byte Priority;
        }
    }
}

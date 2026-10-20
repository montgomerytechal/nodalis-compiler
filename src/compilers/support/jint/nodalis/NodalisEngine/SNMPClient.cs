// Copyright [2026] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#nullable enable

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;

namespace Nodalis
{
    /// <summary>
    /// Reads and writes SNMP v1/v2c objects. The remote address is the object's OID.
    /// SNMP v2c and the public community are used unless overridden by protocol properties.
    /// </summary>
    public sealed class SNMPClient : IOClient
    {
        private const int DefaultPort = 161;
        private const int TimeoutMilliseconds = 3000;
        private const int PingTimeoutMilliseconds = 500;
        private IPEndPoint? endpoint;

        /// <summary>Creates an SNMP client for an engine.</summary>
        public SNMPClient(NodalisEngine parent) : base("SNMP", parent) { }

        /// <summary>Resolves the mapped agent and prepares its UDP endpoint.</summary>
        public override void Connect()
        {
            connected = false;
            endpoint = null;
            if (mappings.Count == 0 || string.IsNullOrWhiteSpace(mappings[0].moduleID))
                return;

            try
            {
                moduleID = mappings[0].moduleID;
                if (mappings.All(IsPing))
                {
                    connected = true;
                    engine.LogDebug($"Ping client {moduleID} is ready.");
                    return;
                }
                var address = ResolveAddress(mappings[0].moduleID);
                var port = int.TryParse(mappings[0].modulePort, NumberStyles.Integer,
                    CultureInfo.InvariantCulture, out var configuredPort) && configuredPort > 0
                    ? configuredPort : DefaultPort;
                endpoint = new IPEndPoint(address, port);
                connected = true; // SNMP is connectionless; requests validate reachability.
                engine.LogDebug($"SNMP Client {moduleID}:{port} is ready.");
            }
            catch (Exception ex)
            {
                engine.LogError($"Failed to configure SNMP client {moduleID}: {ex.Message}");
            }
        }

        /// <summary>Releases this client's endpoint.</summary>
        public override void Close()
        {
            endpoint = null;
            connected = false;
        }

        /// <inheritdoc />
        public override bool ReadBit(string address, out int result)
        {
            result = 0;
            var pingMap = FindMap(address);
            if (pingMap != null && IsPing(pingMap))
            {
                TryPing(out var reachable);
                result = reachable ? 1 : 0;
                return true;
            }
            if (!TryGet(address, out var data, out var map)) return false;

            var configuredConditions = GetProperty(map, "onConditions");
            if (!string.IsNullOrWhiteSpace(configuredConditions))
            {
                var value = data.ToString().Trim();
                result = configuredConditions.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(condition => condition.Trim())
                    .Any(condition => string.Equals(condition, value, StringComparison.OrdinalIgnoreCase)) ? 1 : 0;
                return true;
            }

            if (TryConvertToUInt64(data, out var numeric))
            {
                result = numeric == 0 ? 0 : 1;
                return true;
            }

            if (bool.TryParse(data.ToString(), out var boolean))
            {
                result = boolean ? 1 : 0;
                return true;
            }
            return false;
        }

        /// <inheritdoc />
        public override bool ReadByte(string address, out byte result)
        {
            result = 0;
            if (!TryReadNumeric(address, out var value)) return false;
            result = (byte)value;
            return true;
        }

        /// <inheritdoc />
        public override bool ReadWord(string address, out ushort result)
        {
            result = 0;
            if (!TryReadNumeric(address, out var value)) return false;
            result = (ushort)value;
            return true;
        }

        /// <inheritdoc />
        public override bool ReadDWord(string address, out uint result)
        {
            result = 0;
            if (!TryReadNumeric(address, out var value)) return false;
            result = (uint)value;
            return true;
        }

        /// <inheritdoc />
        public override bool ReadLWord(string address, out ulong result) => TryReadNumeric(address, out result);

        /// <inheritdoc />
        public override bool WriteBit(string address, int value) => TrySetNumeric(address, value == 0 ? 0UL : 1UL);
        /// <inheritdoc />
        public override bool WriteByte(string address, byte value) => TrySetNumeric(address, value);
        /// <inheritdoc />
        public override bool WriteWord(string address, ushort value) => TrySetNumeric(address, value);
        /// <inheritdoc />
        public override bool WriteDWord(string address, uint value) => TrySetNumeric(address, value);
        /// <inheritdoc />
        public override bool WriteLWord(string address, ulong value) => TrySetNumeric(address, value);

        private bool TryReadNumeric(string address, out ulong value)
        {
            value = 0;
            var map = FindMap(address);
            if (map != null && IsPing(map))
            {
                TryPing(out var reachable);
                value = reachable ? 1UL : 0UL;
                return true;
            }
            return TryGet(address, out var data, out _) && TryConvertToUInt64(data, out value);
        }

        private bool TryGet(string address, out ISnmpData data, out IOMap map)
        {
            data = null!;
            map = FindMap(address)!;
            if (!connected || endpoint == null || map == null) return false;

            try
            {
                var variables = Messenger.Get(GetVersion(map), endpoint,
                    new OctetString(GetProperty(map, "community") ?? "public"),
                    new List<Variable> { new(new ObjectIdentifier(address)) }, TimeoutMilliseconds);
                if (variables.Count != 1) return false;
                data = variables[0].Data;
                return data.TypeCode != SnmpType.NoSuchInstance && data.TypeCode != SnmpType.NoSuchObject;
            }
            catch (Exception ex)
            {
                engine.LogError($"SNMP GET failed for {moduleID}/{address}: {ex.Message}");
                return false;
            }
        }

        private bool TrySetNumeric(string address, ulong value)
        {
            var configuredMap = FindMap(address);
            if (configuredMap != null && IsPing(configuredMap)) return false;
            if (!TryGet(address, out var current, out var map) || endpoint == null) return false;

            try
            {
                if (!TryCreateValue(current, value, out var replacement)) return false;
                var response = Messenger.Set(GetVersion(map), endpoint,
                    new OctetString(GetProperty(map, "community") ?? "public"),
                    new List<Variable> { new(new ObjectIdentifier(address), replacement) }, TimeoutMilliseconds);
                return response.Count == 1;
            }
            catch (Exception ex)
            {
                engine.LogError($"SNMP SET failed for {moduleID}/{address}: {ex.Message}");
                return false;
            }
        }

        private IOMap? FindMap(string address) => mappings.Find(map =>
            string.Equals(map.remoteAddress, address, StringComparison.OrdinalIgnoreCase));

        private static string? GetProperty(IOMap map, string name)
        {
            if (map.protocolProperties == null) return null;
            foreach (var property in map.protocolProperties)
                if (string.Equals(property.Key, name, StringComparison.OrdinalIgnoreCase))
                    return property.Value;
            return null;
        }

        private static VersionCode GetVersion(IOMap map)
        {
            var version = (GetProperty(map, "version") ?? "v2c").Trim().ToLowerInvariant();
            return version is "1" or "v1" or "snmpv1" ? VersionCode.V1 : VersionCode.V2;
        }

        private static bool IsPing(IOMap map) =>
            string.Equals(GetProperty(map, "version")?.Trim(), "ping", StringComparison.OrdinalIgnoreCase);

        private bool TryPing(out bool reachable)
        {
            reachable = false;
            if (!connected || string.IsNullOrWhiteSpace(moduleID)) return false;
            try
            {
                using var ping = new Ping();
                reachable = ping.Send(moduleID, PingTimeoutMilliseconds)?.Status == IPStatus.Success;
            }
            catch (Exception)
            {
                reachable = false;
            }
            return true;
        }

        private static bool TryConvertToUInt64(ISnmpData data, out ulong value)
        {
            switch (data)
            {
                case Integer32 integer when integer.ToInt32() >= 0: value = (ulong)integer.ToInt32(); return true;
                case Counter32 counter: value = counter.ToUInt32(); return true;
                case Counter64 counter: value = counter.ToUInt64(); return true;
                case Gauge32 gauge: value = gauge.ToUInt32(); return true;
                case TimeTicks ticks: value = ticks.ToUInt32(); return true;
                default:
                    return ulong.TryParse(data.ToString(), NumberStyles.Integer,
                        CultureInfo.InvariantCulture, out value);
            }
        }

        private static bool TryCreateValue(ISnmpData current, ulong value, out ISnmpData replacement)
        {
            replacement = current switch
            {
                Counter32 => new Counter32(checked((uint)value)),
                Counter64 => new Counter64(value),
                Gauge32 => new Gauge32(checked((uint)value)),
                TimeTicks => new TimeTicks(checked((uint)value)),
                OctetString => new OctetString(value.ToString(CultureInfo.InvariantCulture)),
                Integer32 => new Integer32(checked((int)value)),
                _ => null!
            };
            return replacement != null;
        }

        private static IPAddress ResolveAddress(string host)
        {
            if (IPAddress.TryParse(host, out var parsed)) return parsed;
            return Dns.GetHostAddresses(host).First(address =>
                address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
        }
    }
}

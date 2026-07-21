#nullable enable

// Copyright [2025] Nathan Skipper
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

/// <summary>
/// Modbus Client for .NET
/// </summary>
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Sockets;
using System.Net;
using System.Text;

namespace Nodalis
{
    /// <summary>
    /// The ModbusClient class implements IOClient to provide communications to a Modbus TCP slave device.
    /// </summary>
    public class ModbusClient : IOClient
    {
        private TcpClient client;
        private NetworkStream stream;
        private string ip = "";
        private int port = 502;
        private byte unitId = 1;
        private ushort transactionId = 0;
        private const int IoTimeoutMilliseconds = 3000;
        /// <summary>
        /// Instantiates a new Modbus client.
        /// </summary>
        public ModbusClient(NodalisEngine parent) : base("MODBUS-TCP", parent)
        {
        }

        private const int ReconnectIntervalMilliseconds = 5000;

        private bool EnsureConnected()
        {
            if (connected && client?.Connected == true && stream != null)
                return true;

            long now = engine.ElapsedMilliseconds;

            if (now - lastAttempt < ReconnectIntervalMilliseconds)
                return false;

            lastAttempt = now;

            engine.LogMessage(
                $"Attempting Modbus TCP connection to {ip}:{port}.");

            Connect();

            return connected;
        }

        /// <summary>
        /// Connects to the modbus device based on the mappings provided.
        /// </summary>
        public override void Connect()
        {
            if (connected) Disconnect();

            if (mappings.Count > 0)
            {
                ip = mappings[0].moduleID;
                port = int.Parse(mappings[0].modulePort);
                moduleID = ip;
                foreach (IOMap m in mappings)
                {

                    byte function = FunctionFor(m.remoteAddress, m.direction == IOType.Input ? "InFunction" : "OutFunction", 0x02);
                    engine.LogDebug($"Modbus Client {ip} address {m.localAddress} uses function {function.ToString("X")}");
                }
            }
            else
            {
                engine.LogDebug($"Modbus Client {ip} has no mappings.");
            }
            try
                {
                    client = new TcpClient();
                    client.Connect(ip, port);
                    client.ReceiveTimeout = IoTimeoutMilliseconds;
                    client.SendTimeout = IoTimeoutMilliseconds;
                    stream = client.GetStream();
                    stream.ReadTimeout = IoTimeoutMilliseconds;
                    stream.WriteTimeout = IoTimeoutMilliseconds;
                    connected = true;
                    engine.LogDebug($"Modbus Client {ip} is connected.");
                }
                catch (Exception ex)
                {
                    engine.LogError($"Failed to connect on mapping {moduleID}/{protocol}: {ex.ToString()}");
                    connected = false;
                }
        }

        private void Disconnect()
        {
            try
            {
                stream?.Dispose();
            }
            catch
            {
            }

            try
            {
                client?.Dispose();
            }
            catch
            {
            }

            stream = null;
            client = null;
            connected = false;
        }

        private bool SendRequest(byte function, ushort startAddress, ushort quantity, byte[]? payload, out byte[] response)
        {
            response = Array.Empty<byte>();

            if (!EnsureConnected())
                return false;

            transactionId++;
            var pdu = new List<byte> { function, (byte)(startAddress >> 8), (byte)(startAddress & 0xFF) };
            if (function == 0x01 || function == 0x02 || function == 0x03 || function == 0x04)
            {
                pdu.Add((byte)(quantity >> 8));
                pdu.Add((byte)(quantity & 0xFF));
            }
            else if (payload != null)
            {
                pdu.AddRange(payload);
            }

            // The MBAP length counts the Unit ID and PDU, but not the first six
            // bytes of the MBAP header. Deriving it from the completed PDU avoids
            // advertising bytes that were never sent for write requests.
            ushort length = checked((ushort)(1 + pdu.Count));
            var mbap = new byte[] {
                (byte)(transactionId >> 8), (byte)(transactionId & 0xFF),
                0x00, 0x00,
                (byte)(length >> 8), (byte)(length & 0xFF),
                unitId
            };

            var request = new List<byte>(mbap);
            request.AddRange(pdu);

            try
            {
                stream.Write(request.ToArray(), 0, request.Count);

                byte[] responseMbap = new byte[7];
                if (!ReadExactly(responseMbap, responseMbap.Length)) return false;

                ushort responseTransactionId = (ushort)((responseMbap[0] << 8) | responseMbap[1]);
                ushort protocolId = (ushort)((responseMbap[2] << 8) | responseMbap[3]);
                ushort responseLength = (ushort)((responseMbap[4] << 8) | responseMbap[5]);
                if (responseTransactionId != transactionId || protocolId != 0 ||
                    responseMbap[6] != unitId || responseLength < 2 || responseLength > 254)
                {
                    Disconnect();
                    return false;
                }

                response = new byte[responseLength - 1];
                if (!ReadExactly(response, response.Length))
                {
                    response = Array.Empty<byte>();
                    engine.LogError($"Failed to read response on mapping {moduleID}/{protocol}.");
                    return false;
                }

                // Modbus exceptions use the requested function code with bit 7 set.
                if (response[0] == (byte)(function | 0x80)) return false;
                if (response[0] != function) return false;

                if (function >= 0x01 && function <= 0x04)
                {
                    int expectedByteCount = function <= 0x02 ? (quantity + 7) / 8 : quantity * 2;
                    return response.Length == expectedByteCount + 2 && response[1] == expectedByteCount;
                }
                if (function == 0x05 || function == 0x06)
                    return response.Length == pdu.Count && response.SequenceEqual(pdu);
                if (function == 0x10)
                    return response.Length == 5 && response.Take(5).SequenceEqual(pdu.Take(5));
                return true;
            }
            catch(Exception e) 
            {
                engine.LogError($"Failed to send request on mapping {moduleID}/{protocol}: {e.ToString()}");
                Disconnect();
            }
            return false;
        }

        private bool ReadExactly(byte[] buffer, int count)
        {
            int offset = 0;
            while (offset < count)
            {
                int read = stream.Read(buffer, offset, count - offset);
                if (read == 0)
                {
                    Disconnect();
                    return false;
                }
                offset += read;
            }
            return true;
        }

        private byte FunctionFor(string address, string property, byte fallback)
        {
            var map = mappings.Find(m => m.remoteAddress == address &&
                m.protocolProperties != null && m.protocolProperties.ContainsKey(property));
            if (map?.protocolProperties == null ||
                !map.protocolProperties.TryGetValue(property, out var configured)) return fallback;
            configured = configured.Trim();
            if (configured.StartsWith("0x", StringComparison.OrdinalIgnoreCase)) configured = configured.Substring(2);
            return byte.TryParse(configured, System.Globalization.NumberStyles.HexNumber,
                System.Globalization.CultureInfo.InvariantCulture, out var function) ? function : fallback;
        }

        public override bool ReadBit(string address, out int result)
        {
            result = 0;
            if (!ushort.TryParse(address, out var addr)) return false;
            byte function = FunctionFor(address, "InFunction", 0x02);
            if (function < 0x01 || function > 0x04) function = 0x02;
            if (!SendRequest(function, addr, 1, null, out var response) || response.Length < 3) return false;
            if ((function == 0x03 || function == 0x04) && response.Length < 4) return false;
            result = function == 0x03 || function == 0x04
                ? ((response[2] << 8) | response[3]) > 0 ? 1 : 0
                : (response[2] & 0x01) != 0 ? 1 : 0;
            return true;
        }

        public override bool WriteBit(string address, int value)
        {
            if (!ushort.TryParse(address, out var addr)) return false;
            byte function = FunctionFor(address, "OutFunction", 0x05);
            if (function == 0x06)
                return SendRequest(function, addr, 0, new byte[] { 0x00, (byte)(value != 0 ? 1 : 0) }, out _);
            return SendRequest(0x05, addr, 0, new byte[] {
                (byte)(value != 0 ? 0xFF : 0x00), 0x00
            }, out _);
        }

        public override bool ReadByte(string address, out byte result)
        {
            result = 0;
            if (!ushort.TryParse(address, out var addr)) return false;
            if (!SendRequest(0x03, addr, 1, null, out var response)) return false;
            result = response.Length >= 3 ? response[2] : (byte)0;
            return true;
        }

        public override bool WriteByte(string address, byte value)
        {
            if (!ushort.TryParse(address, out var addr)) return false;
            var payload = new byte[] { 0x00, value };
            return SendRequest(0x06, addr, 1, payload, out _);
        }

        public override bool ReadWord(string address, out ushort result)
        {
            result = 0;
            if (!ushort.TryParse(address, out var addr)) return false;
            if (!SendRequest(0x03, addr, 1, null, out var response)) return false;
            result = (ushort)((response[2] << 8) | response[3]);
            return true;
        }

        public override bool WriteWord(string address, ushort value)
        {
            if (!ushort.TryParse(address, out var addr)) return false;
            var payload = new byte[] {
                (byte)(value >> 8), (byte)(value & 0xFF)
            };
            return SendRequest(0x06, addr, 1, payload, out _);
        }

        public override bool ReadDWord(string address, out uint result)
        {
            result = 0;
            if (!ushort.TryParse(address, out var addr)) return false;
            if (!SendRequest(0x03, addr, 2, null, out var response)) return false;
            result = (uint)((response[2] << 24) | (response[3] << 16) | (response[4] << 8) | response[5]);
            return true;
        }

        public override bool WriteDWord(string address, uint value)
        {
            if (!ushort.TryParse(address, out var addr)) return false;
            var payload = new byte[] {
                0x00, 0x02,
                0x04,
                (byte)(value >> 24), (byte)((value >> 16) & 0xFF),
                (byte)((value >> 8) & 0xFF), (byte)(value & 0xFF)
            };
            return SendRequest(0x10, addr, 2, payload, out _);
        }

        public override bool ReadLWord(string address, out ulong result)
        {
            result = 0;
            if (!ushort.TryParse(address, out var addr)) return false;
            if (!SendRequest(0x03, addr, 4, null, out var response)) return false;
            result = ((ulong)response[2] << 56) | ((ulong)response[3] << 48) |
                     ((ulong)response[4] << 40) | ((ulong)response[5] << 32) |
                     ((ulong)response[6] << 24) | ((ulong)response[7] << 16) |
                     ((ulong)response[8] << 8) | response[9];
            return true;
        }

        public override bool WriteLWord(string address, ulong value)
        {
            if (!ushort.TryParse(address, out var addr)) return false;
            var payload = new byte[] {
                0x00, 0x04,
                0x08,
                (byte)(value >> 56), (byte)((value >> 48) & 0xFF),
                (byte)(value >> 40), (byte)((value >> 32) & 0xFF),
                (byte)(value >> 24), (byte)((value >> 16) & 0xFF),
                (byte)((value >> 8) & 0xFF), (byte)(value & 0xFF)
            };
            return SendRequest(0x10, addr, 4, payload, out _);
        }
    }
}

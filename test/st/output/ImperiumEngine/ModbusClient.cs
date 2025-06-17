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
using System.Net.Sockets;
using System.Net;
using System.Text;

namespace Imperium
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

        public ModbusClient() : base("MODBUS-TCP")
        {
        }

        public override void Connect()
        {
            if (connected) Disconnect();

            if (mappings.Count > 0)
            {
                ip = mappings[0].moduleID;
                port = int.Parse(mappings[0].modulePort);
                moduleID = ip;
            }

            try
            {
                client = new TcpClient();
                client.Connect(ip, port);
                stream = client.GetStream();
                connected = true;
            }
            catch
            {
                connected = false;
            }
        }

        private void Disconnect()
        {
            if (connected)
            {
                stream?.Close();
                client?.Close();
                connected = false;
            }
        }

        private bool SendRequest(byte function, ushort startAddress, ushort quantity, byte[]? payload, out byte[] response)
        {
            response = Array.Empty<byte>();
            if (!connected) return false;

            transactionId++;
            var mbap = new byte[7];
            mbap[0] = (byte)(transactionId >> 8);
            mbap[1] = (byte)(transactionId & 0xFF);
            mbap[2] = 0; mbap[3] = 0;
            ushort length = (ushort)(1 + 1 + 2 + 2 + (payload?.Length ?? 0));
            mbap[4] = (byte)(length >> 8);
            mbap[5] = (byte)(length & 0xFF);
            mbap[6] = unitId;

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

            var request = new List<byte>(mbap);
            request.AddRange(pdu);

            try
            {
                stream.Write(request.ToArray(), 0, request.Count);
                byte[] buffer = new byte[260];
                int read = stream.Read(buffer, 0, buffer.Length);
                if (read >= 9)
                {
                    response = new byte[read - 7];
                    Array.Copy(buffer, 7, response, 0, response.Length);
                    return true;
                }
            }
            catch
            {
                Disconnect();
            }
            return false;
        }

        public override bool ReadBit(string address, out int result)
        {
            result = 0;
            if (!ushort.TryParse(address, out var addr)) return false;
            if (!SendRequest(0x02, addr, 1, null, out var response)) return false;
            result = (response[1] & 0x01) != 0 ? 1 : 0;
            return true;
        }

        public override bool WriteBit(string address, int value)
        {
            if (!ushort.TryParse(address, out var addr)) return false;
            var payload = new byte[] {
                (byte)(addr >> 8), (byte)(addr & 0xFF),
                (byte)(value != 0 ? 0xFF : 0x00), 0x00
            };
            return SendRequest(0x05, addr, 0, payload, out _);
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
            var payload = new byte[] { (byte)(addr >> 8), (byte)(addr & 0xFF), 0x00, value };
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
                (byte)(addr >> 8), (byte)(addr & 0xFF),
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
                (byte)(addr >> 8), (byte)(addr & 0xFF),
                0x04,
                (byte)(value >> 24), (byte)((value >> 16) & 0xFF),
                (byte)((value >> 8) & 0xFF), (byte)(value & 0xFF)
            };
            return SendRequest(0x10, addr, 2, payload, out _);
        }
    }
}

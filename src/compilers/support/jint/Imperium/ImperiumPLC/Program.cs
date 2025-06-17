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
/// Imperium PLC .NET Console app
/// </summary>

using System;
using System.IO;
using System.Threading;
using Jint;
using Imperium;

class ProgramEngine : ImperiumEngine
{
    private static readonly ulong[,] MEMORY = new ulong[64, 16];

    public override bool ReadBit(string address)
    {
        ParseAddress(address, out int word, out int bit);
        return (MEMORY[word, bit / 64] & (1UL << (bit % 64))) != 0;
    }

    public override byte ReadByte(string address)
    {
        ParseAddress(address, out int word, out int bit);
        return (byte)((MEMORY[word, bit / 64] >> (bit % 64)) & 0xFF);
    }

    public override ushort ReadWord(string address)
    {
        ParseAddress(address, out int word, out int bit);
        return (ushort)((MEMORY[word, bit / 64] >> (bit % 64)) & 0xFFFF);
    }

    public override uint ReadDWord(string address)
    {
        ParseAddress(address, out int word, out int bit);
        return (uint)((MEMORY[word, bit / 64] >> (bit % 64)) & 0xFFFFFFFF);
    }

    public override void WriteBit(string address, bool value)
    {
        ParseAddress(address, out int word, out int bit);
        if (value)
            MEMORY[word, bit / 64] |= (1UL << (bit % 64));
        else
            MEMORY[word, bit / 64] &= ~(1UL << (bit % 64));
    }

    public override void WriteByte(string address, byte value)
    {
        WriteGeneric(address, value, 8);
    }

    public override void WriteWord(string address, ushort value)
    {
        WriteGeneric(address, value, 16);
    }

    public override void WriteDWord(string address, uint value)
    {
        WriteGeneric(address, value, 32);
    }

    private void ParseAddress(string address, out int word, out int bit)
    {
        word = 0; bit = 0;
        address = address.TrimStart('%');
        if (address.Length >= 2 && (address[1] == 'X' || address[1] == 'B' || address[1] == 'W' || address[1] == 'D'))
        {
            int baseOffset = address[1] switch { 'X' => 1, 'B' => 3, 'W' => 16, 'D' => 32, _ => 1 };
            string addr = address.Substring(2);
            var parts = addr.Split('.')
                .Select(p => int.TryParse(p, out var val) ? val : 0)
                .ToArray();
            if (parts.Length >= 2)
            {
                word = parts[0];
                bit = parts[1] * baseOffset;
            }
        }
    }

    private void WriteGeneric(string address, ulong value, int width)
    {
        ParseAddress(address, out int word, out int bit);
        ulong mask = (1UL << width) - 1;
        ulong shiftedMask = mask << (bit % 64);
        MEMORY[word, bit / 64] &= ~shiftedMask;
        MEMORY[word, bit / 64] |= (value & mask) << (bit % 64);
    }
}

class Program
{
    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: ImperiumRuntime <jsfile>");
            return;
        }

        var engine = new ProgramEngine();

        string jsCode = File.ReadAllText(args[0]);
        engine.Load(jsCode);
        engine.Setup();
        while (true)
        {
            engine.SuperviseIO();
            engine.Execute();
            Thread.Sleep(1);
        }
    }
}


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
/// Nodalis PLC .NET Console app
/// </summary>

using System;
using System.IO;
using System.Threading;
using Jint;
using Jint.Runtime;
using Nodalis;
using System.Text.RegularExpressions;


class ProgramEngine : NodalisEngine
{
    private static readonly ulong[,] MEMORY = new ulong[64, 16];

    public override bool ReadBit(string address)
    {
        var mem = ParseAddress(address);
        return (GetMemoryCell(mem[0], mem[2]) & (1UL << (mem[3] % 64))) != 0;
    }

    public override byte ReadByte(string address)
    {
        var mem = ParseAddress(address);
        return (byte)((GetMemoryCell(mem[0], mem[2]) >> (mem[3] % 64)) & 0xFF);
    }

    public override ushort ReadWord(string address)
    {
        var mem = ParseAddress(address);
        return (ushort)((GetMemoryCell(mem[0], mem[2]) >> (mem[3] % 64)) & 0xFFFF);
    }

    public override uint ReadDWord(string address)
    {
        var mem = ParseAddress(address);
        return (uint)((GetMemoryCell(mem[0], mem[2]) >> (mem[3] % 64)) & 0xFFFFFFFF);
    }

    public override ulong ReadLWord(string address)
    {
        var mem = ParseAddress(address);
        return (ulong)((GetMemoryCell(mem[0], mem[2]) >> (mem[3] % 64)) & ulong.MaxValue);
    }

    public override void WriteBit(string address, bool value)
    {
        var mem = ParseAddress(address);
        if (value)
            GetMemoryCell(mem[0], mem[2]) |= (1UL << (mem[3] % 64));
        else
            GetMemoryCell(mem[0], mem[2]) &= ~(1UL << (mem[3] % 64));
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

    public override void WriteLWord(string address, ulong value)
    {
        WriteGeneric(address, value, 64);
    }

    public enum MemorySpace
    {
        I = 0,
        Q = 1,
        M = 2
    }

    public static ref ulong GetMemoryCell(int space, int addr)
    {
        int r = -1, c = 0, b = 0;
        switch (space)
        {
            case 1: // Q
                r = (addr * 8) / 64;
                c = 1;
                b = addr % 8;
                break;
            case 0: // I
                r = (addr * 8) / 64;
                c = 0;
                b = addr % 8;
                break;
            case 2: // M
                r = (addr * 8) / (64 * 14);
                c = (addr / 112) + 2;
                b = addr % 8;
                break;
        }

        if (r >= 0 && r < 64 && c >= 0 && c < 16)
        {
            return ref MEMORY[r, c];
        }
        throw new ArgumentOutOfRangeException();
    }

    public static List<int> ParseAddress(string address)
    {
        var pattern = new Regex(@"%([IQM])([XBWDL])(\d+)(?:\.(\d+))?", RegexOptions.IgnoreCase);
        var match = pattern.Match(address);

        if (!match.Success)
            throw new ArgumentException($"Invalid address format: {address}");

        string space = match.Groups[1].Value.ToUpperInvariant();  // I, Q, M
        string type = match.Groups[2].Value.ToUpperInvariant();   // X, W, D, etc.
        string index = match.Groups[3].Value;                     // 0, 1, ...
        string bit = match.Groups[4].Success ? match.Groups[4].Value : null;

        int ispace = space switch
        {
            "M" => (int)MemorySpace.M,
            "Q" => (int)MemorySpace.Q,
            "I" => (int)MemorySpace.I,
            _ => throw new ArgumentException($"Unknown memory space: {space}")
        };

        int width = type switch
        {
            "X" => 8,
            "W" => 16,
            "D" => 32,
            "L" => 64,
            _ => throw new ArgumentException($"Unknown type: {type}")
        };

        int addr = int.Parse(index);
        int ibit = bit != null ? int.Parse(bit) : -1;

        return new List<int> { ispace, width, addr, ibit };
    }

    private void WriteGeneric(string address, ulong value, int width)
    {
        var mem = ParseAddress(address);
        ulong mask = (1UL << width) - 1;
        ulong shiftedMask = mask << (mem[3] % 64);
        ulong location = GetMemoryCell(mem[0], mem[2]);
        location &= ~shiftedMask;
        location |= (value & mask) << (mem[3] % 64);
    }
}

class Program
{
    static void Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.WriteLine("Usage: NodalisPLC <jsfile>");
            return;
        }

        var engine = new ProgramEngine();
        long lastExec = engine.ElapsedMilliseconds;
        string jsCode = File.ReadAllText(args[0]);
        try
        {
            engine.Load(jsCode);
            engine.Setup();
            while (true)
            {
                engine.SuperviseIO();
                if (engine.ElapsedMilliseconds - lastExec >= 100)
                {
                    lastExec = engine.ElapsedMilliseconds;
                    engine.Execute();
                }
                Thread.Sleep(1);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex.ToString());
        }
        
    }
}


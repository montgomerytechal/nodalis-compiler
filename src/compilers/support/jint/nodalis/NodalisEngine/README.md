# NodalisEngine

`NodalisEngine` is a .NET Core 8.0 framework that executes JavaScript PLC programs produced by the Nodalis compiler. It embeds the [Jint](https://github.com/sebastienros/jint) JavaScript engine, exposes IEC-61131-3 style function blocks, and provides fieldbus adapters (Modbus TCP and OPC UA) so your generated logic can talk to real hardware.

## Highlights
- **Drop-in runtime** for the code emitted by `nodalis-compiler`.
- **Extensible IO abstraction** – implement just a few read/write methods in your host application.
- **Built-in protocol clients** for Modbus TCP and OPC UA plus hooks for custom transports.
- **Integrated IEC function blocks** (TON, TOF, TP, counters, logic gates, etc.).
- **NuGet-friendly** metadata so the library can be consumed from any `net8.0` or higher application.

## Installation
Use your preferred NuGet workflow:

```bash
# dotnet CLI
dotnet add package NodalisEngine

# or inside Package Manager Console
Install-Package NodalisEngine
```

`NodalisEngine` currently targets `net8.0`.

## Getting Started
Create a host application that derives from `NodalisEngine` and wires the abstract IO operations to your hardware or simulator:

```csharp
using Nodalis;

public class PlantEngine : NodalisEngine
{
    private readonly Dictionary<string, bool> _bits = new();
    private readonly Dictionary<string, ushort> _words = new();

    public override bool ReadBit(string address) => _bits.TryGetValue(address, out var value) && value;
    public override void WriteBit(string address, bool value) => _bits[address] = value;
    public override byte ReadByte(string address) => (byte)ReadWord(address);
    public override void WriteByte(string address, byte value) => WriteWord(address, value);
    public override ushort ReadWord(string address) => _words.TryGetValue(address, out var value) ? value : (ushort)0;
    public override void WriteWord(string address, ushort value) => _words[address] = value;
    public override uint ReadDWord(string address) => ReadWord(address);
    public override void WriteDWord(string address, uint value) => WriteWord(address, (ushort)value);
}
```

Then load and execute the PLC program that the Nodalis compiler produced:

```csharp
var engine = new PlantEngine();
var javascript = File.ReadAllText("build/plc.js");
engine.Load(javascript);
engine.Setup();

while (true)
{
    engine.Execute();      // Runs the user logic
    engine.SuperviseIO();  // Polls any mapped IO clients
    await Task.Delay(10);  // Adjust scan time as needed
}
```

Function blocks can be instantiated directly from the generated JavaScript, but you can also create them from .NET by calling `CreateFunctionBlock("TON")`, set inputs, and invoke `Call()`.

## IO Mapping & Protocol Clients
When you call `mapIO(json)` from the generated JavaScript (the compiler does this automatically), `NodalisEngine` instantiates the appropriate `IOClient` for each mapping. Two clients ship out of the box:

- **ModbusClient** – talks to Modbus TCP slaves and mirrors discrete/analog data into `%I`, `%Q`, `%IW`, `%QW`, etc.
- **OPCClient** – lets your runtime subscribe/publish to an OPC UA server.

You can extend the transport layer by overriding `CreateClient(IOMap map)` and returning your own `IOClient` implementation whenever a custom protocol identifier is encountered.

## Integrated OPC UA Server
For vertical integration, you can expose the running PLC variables via the included `OPCServer` helper:

```csharp
var opc = new OPCServer(engine);
opc.MapVariable("TankLevel", "%IW0");
opc.MapVariable("StartCommand", "%QX0.0");
await opc.StartAsync();
```

This spins up an OPC UA endpoint at `opc.tcp://localhost:4840/UA/Nodalis` using `OPCFoundation.NetStandard.Opc.Ua`. Each mapped variable mirrors values from your engine’s address space.


## License
NodalisEngine is distributed under the Apache 2.0 license. See the headers inside the source files for details.

# Changelog

## [1.0.15] - 2026-07-21
- Improved behavior of modbus client. Added better logging and logging methods to engine.

## [1.0.14] - 2026-07-17
- Fixed issues with OPC Server on embedded linux.

## [1.0.13] - 2026-07-15
- Replaced obsolete references in OPC Server and Client.

## [1.0.12] - 2026-05-04
- Added ability to set hostname for OPCServer.
- Added support for LWord types to OPCServer.
- Fixed problems with connecting to OPCServer

## [1.0.9] - 2026-02-12

- Fixed TP function block.

## [1.0.8] - 2026-02-11

- Fixed issue with constructing a FunctionBlock and calling "newStatic".

## [1.0.4] - 2025-02-06

- Added support for Bacnet-IP.
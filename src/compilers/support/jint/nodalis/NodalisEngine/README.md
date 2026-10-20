# NodalisEngine

`NodalisEngine` is a .NET Core 8.0 framework that executes JavaScript PLC programs produced by the Nodalis compiler. It embeds the [Jint](https://github.com/sebastienros/jint) JavaScript engine, exposes IEC-61131-3 style function blocks, and provides fieldbus adapters (Modbus TCP, BACnet/IP, SNMP, and OPC UA) so your generated logic can talk to real hardware.

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
When you call `mapIO(json)` from the generated JavaScript (the compiler does this automatically), `NodalisEngine` instantiates the appropriate `IOClient` for each mapping. These clients ship out of the box:

- **ModbusClient** – talks to Modbus TCP slaves and mirrors discrete/analog data into `%I`, `%Q`, `%IW`, `%QW`, etc.
- **BacnetIpClient** – reads and writes BACnet/IP object properties.
- **SNMPClient** – reads and writes SNMP v1/v2c objects, or performs ICMP reachability checks when the mapping version is `ping`.
- **OPCClient** – lets your runtime subscribe/publish to an OPC UA server.

You can extend the transport layer by overriding `CreateClient(IOMap map)` and returning your own `IOClient` implementation whenever a custom protocol identifier is encountered.

### SNMP mappings

Set `Protocol` to `SNMP`, `ModuleID` to the agent hostname or IP address, and `RemoteAddress` to a numeric OID such as `1.3.6.1.2.1.1.3.0`. `ModulePort` defaults to UDP 161 when it is empty, zero, or invalid. The optional `ProtocolProperties`/`Properties` JSON object accepts:

- `community`: SNMP community, default `public`.
- `version`: `v1`/`1`, `v2c`/`2`, or `ping`; default `v2c`.
- `onConditions`: comma-delimited SNMP values that make a one-bit input true. Matching ignores case and surrounding whitespace. Without this property, numeric zero is false and nonzero is true.

Set `version` to `ping` to perform a short-timeout ICMP reachability check against `ModuleID`. Ping-only clients do not create an SNMP endpoint or issue an SNMP request. A successful ping reads as `1` and an unsuccessful ping reads as `0` for both bit and wider input mappings. `ModulePort`, `community`, and `onConditions` do not apply; `RemoteAddress` is only a unique identifier used to associate the read with its mapping. Writes are not supported in ping mode.

For example, this mapping writes the reachability of `192.0.2.10` to `%IX0.0` once per second:

```json
{
  "ModuleID": "192.0.2.10",
  "ModulePort": "",
  "Protocol": "SNMP",
  "RemoteAddress": "reachability",
  "RemoteSize": "1",
  "InternalAddress": "%IX0.0",
  "PollTime": "1000",
  "ProtocolProperties": "{\"version\":\"ping\"}"
}
```

Ping mode is intended for input mappings. A failed, timed-out, unavailable, or locally blocked ICMP probe produces `0`, so the host firewall and network must permit ICMP echo traffic. The .NET probe has a short bounded timeout to limit scan-cycle blocking.

For example, a one-bit input can use `{"community":"plant","version":"v2c","onConditions":"up,running,1"}`. Wider inputs accept SNMP integer, counter, gauge, time-tick, or numeric string values. Outputs use SNMP SET and preserve the object's current wire type; the configured community must therefore have write access.

#### Inspecting MIBs

The project-root [`snmp-mib-reader.ps1`](../../../../../../snmp-mib-reader.ps1) script creates a text reference containing the object name, numeric OID, value type, and enumerated values for the MIBs supplied by a device manufacturer. The report can be used to find numeric OIDs for `RemoteAddress`; the runtime itself continues to use numeric OIDs and does not require a MIB directory.

The script requires the Net-SNMP command-line binaries, including `snmptranslate`. Download an appropriate build from [Net-SNMP](https://www.net-snmp.org/download.html), then pass either the directory containing `snmptranslate.exe`/`snmptranslate` or the complete path to that executable. The static Net-SNMP libraries linked into the C++ runtime do not contain this command-line program.

Run the script from the project root with PowerShell:

```powershell
.\snmp-mib-reader.ps1 `
    -SnmpBinPath "C:\Net-SNMP\bin" `
    -MibDirectory "C:\MIBs" `
    -Filter "EATON" `
    -OutputFile "C:\Reports\eaton-objects.txt"
```

The parameters are:

- `SnmpBinPath`: optional directory or complete executable path for `snmptranslate`; defaults to `bin` beside the script.
- `MibDirectory`: optional directory containing vendor and dependency MIBs; defaults to `share\snmp\mibs` beside the script.
- `Filter`: optional comma-delimited, case-insensitive terms matched against each MIB's filename and contents. A file is included when any term matches.
- `OutputFile`: optional report path. It defaults to `snmp-mib-report.txt` in the current directory and overwrites an existing file.

MIB files are processed alphabetically. Each MIB module appears unindented, its objects are indented by one tab, and the OID, value type, and possible values are indented by two tabs:

```text
EATON-EXAMPLE-MIB
	deviceState
		OID: 1.3.6.1.4.1.534.1.1
		Value Type: INTEGER
		Possible Values: normal=1, warning=2, fault=3
```

To display the script's complete parameter documentation and additional examples, run:

```powershell
Get-Help .\snmp-mib-reader.ps1 -Full
```

#### Walking SNMP agents

The project-root [`snmp-client-walker.ps1`](../../../../../../snmp-client-walker.ps1) script accepts one IPv4 address, an inclusive `start-end` range, or an IPv4 CIDR network. It first probes each address and then walks responsive SNMP agents from the ISO root. The output groups symbolic object instances beneath each IP address.

```powershell
.\snmp-client-walker.ps1 `
    -Target "192.0.2.10-192.0.2.20" `
    -Community "monitor" `
    -Filter "upsOutputSource,hrDeviceStatus" `
    -OutputFile ".\switch-walks.txt"
```

The walker defaults to the `bin` and `share\snmp\mibs` directories beside the script, community `public`, SNMP v2c, a one-second timeout, and zero retries. `Filter` accepts comma-delimited, case-insensitive base object names; an entry such as `hrDeviceStatus` includes all of that object's indexed instances. Hosts without matching instances are omitted. While scanning, the console shows each IP's progress, whether SNMP responded, and the walked and matching instance counts. `SnmpBinPath`, `MibDirectory`, `Community`, `Version`, `TimeoutSeconds`, `Retries`, `OutputFile`, and the range safety limit `MaxHosts` can also be overridden. Run `Get-Help .\snmp-client-walker.ps1 -Full` for details.

See the project-root [`snmp-readme.txt`](../../../../../../snmp-readme.txt) for Net-SNMP installation, vendor MIB discovery, device configuration, and suggested health objects.

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

## [1.0.18] - 2026-10-20
- Added Close method to IOClients so that connections could be managed better.
- Added SNMP Client.

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

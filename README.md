# Nodalis Compiler

**Nodalis** is a cross-platform compiler framework for **IEC-61131-3** and **IEC-61131-10** PLC languages.  
It enables developers to write *Structured Text (ST)* and *Ladder Diagram (LD)* programs and compile them into runtime-ready code for multiple platforms such as **Node.js** or **ANSI C++** embedded systems.

Nodalis is part of the broader goal of making PLC programming **portable, modern, and interoperable**, without sacrificing the structure or semantics of traditional IEC standards.

---

## ✨ Features

- ✔ **Supports IEC-61131-3 / IEC-61131-10 languages**
  - Structured Text (`.st`, `.iec`)
  - Ladder Diagram (`.iec`)
- ✔ **Multiple compiler backends**
  - **CPPCompiler** → Outputs ANSI C++ code or executables  
  - **JSCompiler** → Outputs Node.js-ready applications
- ✔ **Integrated CLI (`nodalis`)**
- ✔ **Strict extension validation** for ST/LD inputs
- ✔ **Extensible compiler architecture**
- ✔ **Modbus**, **BACnet/IP**, **SNMP**, and **OPC UA** protocol support
- ✔ **ES Module based structure**

---

## 📦 Installation

### Global installation:

```bash
npm install -g nodalis-compiler
```

### Local project installation:

```bash
npm install nodalis-compiler
```

---

## 🔧 Usage

Nodalis includes a built-in CLI tool. After installation, you can run:

```bash
nodalis --help
```

Which displays:

```
Usage:
  nodalis --action <action> [options]

Actions:
  --action list-compilers
  --action compile
  --action get-toolchains
```

---

## 📚 Examples

### ✔ List available compilers

```bash
nodalis --action list-compilers
```

### ✔ Install managed C/C++ toolchains

```bash
nodalis --action get-toolchains
```

This installs:
- Managed Zig-based C/C++ cross-compilers
- Managed `arduino-cli`
- Default Arduino board cores for the built-in Nodalis FQBN targets
- Required Arduino libraries for the built-in Nodalis Arduino runtime, including `ArduinoModbus`

---

### ✔ Compile a Structured Text program

```bash
nodalis --action compile   --target nodejs   --outputType code   --outputPath ./out   --resourceName MyPLC   --sourcePath ./examples/pump.iec   --language st
```

---

### ✔ Compile for C++ output

```bash
nodalis --action compile   --target generic-cpp   --outputType code   --outputPath ./out   --resourceName PumpSystem   --sourcePath ./examples/pump.st   --language st
```

---

## 🧩 Programmatic API

```javascript
import { Nodalis } from "nodalis-compiler";

const app = new Nodalis();

await app.compile({
  target: "nodejs",
  outputType: "code",
  outputPath: "./out",
  resourceName: "MyPLC",
  sourcePath: "./src/main.st",
  language: "st"
});
```

---

## 🔌 Protocol Support

Nodalis maps external I/O through a common `IOMap` model. `Protocol` selects the client, `ModuleID` identifies the remote device or endpoint, `ModulePort` selects its network port, `RemoteAddress` identifies the remote point, and `ProtocolProperties` (also accepted as `Properties`) carries protocol-specific options.

The generic C++, Node.js, and .NET runtimes support all four network protocols. The Arduino runtime currently supports Modbus TCP, but not BACnet/IP, SNMP, or OPC UA. Arduino also provides a separate GPIO client for local pins.

| Protocol | Generic C++ | Node.js | .NET (`NodalisEngine`) | Arduino |
|---|---|---|---|---|
| Modbus TCP | Yes — native socket client | Yes — `jsmodbus` | Yes — `TcpClient`/`NetworkStream` implementation | Yes — `ArduinoModbus` and `Ethernet` |
| BACnet/IP | Yes — statically linked `bacnet-stack` | Yes — `bacstack` | Yes — `System.IO.BACnet` | No |
| SNMP v1/v2c | Yes — statically linked Net-SNMP | Yes — `net-snmp` | Yes — `Lextm.SharpSnmpLib` | No |
| OPC UA | Yes — bundled `open62541` | Yes — `node-opcua` | Yes — OPC Foundation .NET Standard libraries | No |

### Modbus TCP

Set `Protocol` to `MODBUS-TCP`. `ModuleID` is the device hostname or IP address, `ModulePort` is normally `502`, and `RemoteAddress` is the coil or register address. The mapping width and direction determine the normal read/write behavior. `ProtocolProperties` can override the input and output function codes with `InFunction` and `OutFunction` where the runtime supports those options.

The C++ and .NET implementations perform Modbus TCP requests directly, Node.js uses `jsmodbus`, and Arduino uses the `ArduinoModbus` and `Ethernet` libraries. Arduino supports both the Modbus TCP mapping client and its runtime-specific Modbus server helpers.

### BACnet/IP

Set `Protocol` to `BACNET` or `BACNET-IP`. `ModuleID` is the device IP address and `ModulePort` normally uses the BACnet/IP default of `47808` (`0xBAC0`). Point configuration identifies the BACnet object type, object instance, property identifier, optional array index, value type, and optional write priority.

The C++ runtime links the bundled `bacnet-stack` static library, Node.js uses `bacstack`, and .NET uses `System.IO.BACnet`. BACnet/IP is not currently implemented by the Arduino runtime.

### SNMP

Set `Protocol` to `SNMP`, `ModuleID` to the agent hostname or IP address, `ModulePort` to the agent's UDP port (normally `161`), and `RemoteAddress` to a numeric OID such as `1.3.6.1.2.1.1.3.0`. Numeric OIDs allow the runtime clients to operate without installing MIB files on the target.

`ProtocolProperties` accepts:

- `community`: community name; defaults to `public`.
- `version`: `v1`/`1`, `v2c`/`2`, or `ping`; defaults to `v2c`.
- `onConditions`: comma-delimited object values that make a one-bit input true. Matching ignores case and surrounding whitespace. Without this option, numeric zero is false and nonzero is true.

Set `version` to `ping` to use the SNMP mapping as a reachability check instead of making an SNMP request. The client sends a short-timeout ICMP echo to `ModuleID`; successful reads produce `1` and unsuccessful reads produce `0` for both bit and wider input mappings. No SNMP session or request is used for a ping-only client. `ModulePort`, `community`, and `onConditions` do not apply. `RemoteAddress` is only a unique mapping identifier in this mode, and output writes are ignored.

For example, this one-bit input becomes true while `192.0.2.10` answers ICMP echo requests:

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

Ping mode is intended for input mappings. A failed, timed-out, unavailable, or locally blocked ICMP probe is reported as `0`; therefore, ensure ICMP echo is allowed between the runtime host and the monitored device. The Node.js implementation performs the probe asynchronously. The synchronous C++ and .NET clients use a short bounded timeout to limit scan-cycle blocking.

The C++ runtime links platform-specific Net-SNMP static libraries, Node.js uses `net-snmp`, and .NET uses `Lextm.SharpSnmpLib`. SNMP is not currently implemented by the Arduino runtime.

The project-root [`snmp-mib-reader.ps1`](snmp-mib-reader.ps1) utility can turn vendor MIBs into a grouped text reference containing object names, numeric OIDs, value types, and enumerated values. It requires the Net-SNMP command-line binaries, including `snmptranslate`, available from [Net-SNMP](https://www.net-snmp.org/download.html). For example:

```powershell
.\snmp-mib-reader.ps1 `
    -SnmpBinPath "C:\Net-SNMP\bin" `
    -MibDirectory "C:\MIBs" `
    -Filter "EATON" `
    -OutputFile "C:\Reports\eaton-objects.txt"
```

When omitted, `SnmpBinPath` defaults to `bin` beside the script and `MibDirectory` defaults to `share\snmp\mibs` beside the script. `Filter` is an optional comma-delimited list of case-insensitive matches against MIB filenames and contents; a file is included when any term matches. `OutputFile` defaults to `snmp-mib-report.txt` in the current directory.

The project-root [`snmp-client-walker.ps1`](snmp-client-walker.ps1) utility checks a single IPv4 address, inclusive `start-end` range, or CIDR network and walks every SNMP-responsive target. It writes symbolic object instances grouped and indented by IP address. It uses the same default `bin` and `share\snmp\mibs` directories, the `public` community, SNMP v2c, a one-second timeout, and no retries unless overridden. For example:

```powershell
.\snmp-client-walker.ps1 `
    -Target "192.0.2.10-192.0.2.20" `
    -Community "monitor" `
    -Filter "upsOutputSource,hrDeviceStatus" `
    -OutputFile ".\switch-walks.txt"
```

`Filter` is an optional comma-delimited list of case-insensitive object names. It matches the base object name, so `hrDeviceStatus` includes every indexed instance such as `hrDeviceStatus.1` and `hrDeviceStatus.2`. Hosts without a matching instance are omitted from the report. During a scan, the walker displays progress for every IP, whether SNMP responded, and how many instances were walked and matched.

Run `Get-Help .\snmp-mib-reader.ps1 -Full` or `Get-Help .\snmp-client-walker.ps1 -Full` for complete parameter documentation.

See [`snmp-readme.txt`](snmp-readme.txt) for Net-SNMP installation, vendor MIB discovery, device configuration, and recommended health-object names for Windows/Avigilon servers, UPS devices, switches, and generators.

### OPC UA

Set `Protocol` to `OPCUA`. `ModuleID` identifies the OPC UA endpoint, and `RemoteAddress` identifies the remote node used by the mapping. The clients read and write values using the mapping's IEC width and direction.

The C++ runtime uses the bundled `open62541` implementation, Node.js uses `node-opcua`, and .NET uses the OPC Foundation .NET Standard libraries. OPC UA is not currently implemented by the Arduino runtime.

---

## 🧠 Compiler Specifics

### CodeSysCompiler

`CodeSysCompiler` converts a Nodalis IEC project into a CodeSys export file. The compiler only accepts `.iec` source files.

```bash
nodalis --action compile \
  --target codesys \
  --outputType code \
  --outputPath ./out \
  --resourceName MyPLC \
  --sourcePath ./examples/pump.iec \
  --language st
```

The command creates `./out/MyPLC.export`. Import this `.export` file into the desired CodeSys project using the import command in the CodeSys environment.

The bundled CODESYS targets are:

- `codesys-win-x86`, `codesys-win-x64`
- `codesys-rte-x86`, `codesys-rte-x64`
- `codesys-phoenix-plcnext`
- `codesys-advantech-x86`, `codesys-advantech-x64`
- `codesys-advantech-softmotion-x86`, `codesys-advantech-softmotion-x64`
- `codesys-advantech-adam-wince-x86`

The legacy `codesys`, `codesys-win64`, and `codesys-rte64` names remain available as aliases. The selected target determines which device tree is written to the `.export` artifact.

> **Important:** The export does not transfer I/O Mapping. After importing the file, configure and verify all I/O mappings in the CodeSys environment before building or deploying the project.

### CPPCompiler

`CPPCompiler` translates IEC Ladder Diagram (`.iec`) and Structured Text (`.st`, `.iec`) sources into ANSI C++ output. Depending on the requested output type it either produces compilable sources or invokes the toolchain to emit an executable.

#### Dependencies

- Uses managed Zig-based toolchain wrappers under `~/.nodalis/toolchains` when no overrides are provided.
- Install those toolchains with `nodalis --action get-toolchains`.
- `get-toolchains` also installs a managed `arduino-cli` plus the default Nodalis Arduino board cores.
- `get-toolchains` also installs the default Arduino libraries required by the built-in runtime support.
- On Windows hosts, the managed toolchain installs wrappers for all Linux and Windows targets.
- On macOS hosts, the managed toolchain installs wrappers for all Linux, Windows, and macOS targets.
- Supply a `toolchain.json` file beside your source to describe a custom toolchain. Example:

```json
{
    "linux-arm": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-linux-arm-c++",
    "linux-arm64": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-linux-arm64-c++",
    "linux-x64": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-linux-x64-c++",
    "windows-x64": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-windows-x64-c++",
    "windows-arm64": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-windows-arm64-c++",
    "macos-x64": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-macos-x64-c++",
    "macos-arm64": "/Users/you/.nodalis/toolchains/zig/0.15.2/wrappers/zig-macos-arm64-c++"
}
```

- The managed installer skips macOS targets on non-macOS hosts.
- `toolchain.json` remains the escape hatch for unsupported or custom compiler setups.

### Arduino

Nodalis uses a managed `arduino-cli` by default when present under `~/.nodalis/toolchains/arduino-cli`.
Running `nodalis --action get-toolchains` also installs the default board cores required by the built-in Arduino FQBN targets, currently including `arduino:mbed_opta:opta`.
It also installs the default Arduino libraries required by the shipped support code, currently including `ArduinoModbus`.

## 🟦 JSCompiler

`JSCompiler` transpiles LD (`.iec`) and ST (`.st`, `.iec`) programs into JavaScript for either **Node.js** or **jint** targets.

- Node.js target: emits a Node module in the output directory and installs the needed npm dependencies.
- jint target: generates a .NET 8 project embedding jint that cross-compiles to Windows, macOS, and Linux for `arm64`, `arm`, and `x64` architectures.

### Dependencies

- Node.js target requires `node` and `npm` to be available on the host.
- jint target requires the .NET SDK (8.0+).

---

## 🗒 SkipCompiler

`SkipCompiler` converts Skipper Sheet (`.skip`) files into three possible targets:

- `xml`: produces MTI device-ready XML definitions.
- `iec`: emits IEC ladder logic mirroring the sheet.
- `st`: emits Structured Text representing the sheet logic.

Choose the desired format via the CLI `--target`/`--outputType` flags.

---

## 🗂 Project Structure

| File | Description |
|------|-------------|
| `src/nodalis.js` | CLI entry point and core controller |
| `src/compilers/CPPCompiler.js` | C++ backend implementation |
| `src/compilers/JSCompiler.js` | Node.js backend implementation |
| `src/compilers/ArduinoCompiler.js` | Arduino backend implementation |
| `test/st/*.js` | Unit tests for compilers |
| `examples/*.iec` | Example IEC programs |

---

## 🤝 Contributing

Contributions are welcome. Open an issue or PR to propose changes or enhancements.

---

## 📄 License

This project is licensed under the **Apache 2.0 License**.

---

## 🏷 Keywords

PLC • IEC-61131 • Ladder Logic • Structured Text • Compiler • C++ • Node.js • Modbus • BACnet • SNMP • OPC UA

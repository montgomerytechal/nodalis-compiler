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
- ✔ **Modbus** and **OPC UA** protocol support
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

#### Variations

- Windows builds exclude the OPC/UA client and server components to keep dependencies minimal.

---

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

PLC • IEC-61131 • Ladder Logic • Structured Text • Compiler • C++ • Node.js • Modbus • OPC UA

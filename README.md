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
```

---

## 📚 Examples

### ✔ List available compilers

```bash
nodalis --action list-compilers
```

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

### CPPCompiler

`CPPCompiler` translates IEC Ladder Diagram (`.iec`) and Structured Text (`.st`, `.iec`) sources into ANSI C++ output. Depending on the requested output type it either produces compilable sources or invokes the toolchain to emit an executable.

#### Dependencies

- Uses a default cross-compiler profile tuned for macOS-style Clang/LLVM toolchains when no overrides are provided.
- Supply a `toolchain.json` file beside your source to describe a custom toolchain. Example:

```json
{
    "linux-arm": "arm-linux-gnueabi-g++",
    "linux-arm64": "aarch64-linux-gnu-g++",
    "linux-x64": "x86_64-linux-gnu-g++",
    "macos-arm64": "clang++",
    "macos-x64": "clang++",
    "windows-x64": "x86_64-w64-mingw32-g++",
    "windows-arm64": "/opt/llvm-mingw/bin/aarch64-w64-mingw32-g++"
}
```

- Without an explicit file Nodalis falls back to the default compiler for the host OS (`clang++` on macOS, `g++` on Linux, and `cl.exe` or MinGW-w64 `g++` on Windows).
- Common cross-compiler sources: Homebrew packages (`brew install armmbed/formulae/arm-none-eabi-gcc`) and osxcross for macOS targeting, MinGW-w64/MSYS2 or Visual Studio Build Tools for Windows, and distro packages such as `gcc-arm-linux-gnueabihf` or `x86_64-w64-mingw32-g++` on Linux.

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

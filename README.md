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

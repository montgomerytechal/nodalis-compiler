/* eslint-disable curly */
/* eslint-disable eqeqeq */
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

import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from "path";
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from './Compiler.js';
import * as iec from "./iec-parser/parser.js";
import { parseStructuredText } from './st-parser/parser.js';
import { transpile } from './st-parser/gcctranspiler.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_TOOLCHAIN = {
    "linux-arm": "arm-linux-gnueabi-g++",
    "linux-arm64": "aarch64-linux-gnu-g++",
    "linux-x64": "x86_64-linux-gnu-g++",
    "macos-arm64": "clang++",
    "macos-x64": "clang++",
    "windows-x64": "x86_64-w64-mingw32-g++",
    "windows-arm64": "/opt/llvm-mingw/bin/aarch64-w64-mingw32-g++"
};

const DEFAULT_ARDUINO_FQBN = {
    "arduino-opta": "arduino:mbed_opta:opta"
};

const MODBUS_ARDUINO_CORE_IDS = new Set([
    "arduino:megaavr",
    "arduino:samd",
    "arduino:mbed_nano",
    "arduino:mbed_portenta",
    "arduino:mbed_opta"
]);

const UNSUPPORTED_ARDUINO_MODBUS_FQBNS = new Set([
    "arduino:mbed_portenta:portenta_x8"
]);

const UNSUPPORTED_ARDUINO_TARGET_ALIASES = {
    "arduino-portenta-x8": "arduino:mbed_portenta:portenta_x8",
    "arduino-portenta_x8": "arduino:mbed_portenta:portenta_x8"
};

let CachedArduinoTargetTable = null;
let ToolChain = { ...DEFAULT_TOOLCHAIN };

export class CPPCompiler extends Compiler {
    constructor(options) {
        super(options);
        this.name = 'CPPCompiler';
    }

    get supportedLanguages() {
        return [IECLanguage.STRUCTURED_TEXT, IECLanguage.LADDER_DIAGRAM];
    }

    get supportedOutputTypes() {
        return [OutputType.EXECUTABLE, OutputType.SOURCE_CODE];
    }

    get supportedTargetDevices() {
        const baseTargets = ['linux-arm', "linux-arm64", "linux-x64", 'macos-x64', "macos-arm64", 'windows-x64', "windows-arm64"];
        const arduinoTargets = this.getArduinoTargetTable().targets;
        return [...baseTargets, ...arduinoTargets];
    }

    canHandleTarget(target) {
        if (typeof target !== "string") return false;
        if (target.startsWith("arduino:")) return true;
        return this.supportedTargetDevices.includes(target);
    }

    get supportedProtocols() {
        return [CommunicationProtocol.MODBUS];
    }

    get compilerVersion() {
        return '1.0.0';
    }

    async compile() {
        const { sourcePath, outputPath, target, outputType, resourceName } = this.options;
        const isArduinoTarget = typeof target === "string" && (target.startsWith("arduino-") || target.startsWith("arduino:"));
        let compilerConfig = {};

        ToolChain = { ...DEFAULT_TOOLCHAIN };
        const sourceDir = fs.lstatSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
        const toolchainConfigPath = path.join(sourceDir, "toolchain.json");
        if (fs.existsSync(toolchainConfigPath)) {
            try {
                const customToolchain = JSON.parse(fs.readFileSync(toolchainConfigPath, "utf-8"));
                if (typeof customToolchain !== "object" || customToolchain === null) {
                    throw new Error("The toolchain configuration must be a JSON object.");
                }
                compilerConfig = customToolchain;
                ToolChain = { ...ToolChain, ...customToolchain };
            } catch (err) {
                throw new Error(`Failed to load toolchain configuration from ${toolchainConfigPath}: ${err.message}`);
            }
        }
        else {
            fs.writeFileSync(toolchainConfigPath, JSON.stringify(ToolChain, null, 4));
        }

        var sourceCode = fs.readFileSync(sourcePath, 'utf-8');
        const filename = path.basename(sourcePath, path.extname(sourcePath));
        const sketchName = isArduinoTarget ? path.basename(path.resolve(outputPath)) : filename;
        const cppFile = path.join(outputPath, `${sketchName}.${isArduinoTarget ? "ino" : "cpp"}`);
        const stFile = path.join(outputPath, `${filename}.st`);
        if(sourcePath.toLowerCase().endsWith(".iec") || sourcePath.toLowerCase().endsWith(".xml")){
            if(typeof resourceName === "undefined" || resourceName === null || resourceName.length === 0){
                throw new Error("You must provide the resourceName option for an IEC project file.");
            }
            var stcode = "";
            const iecProj = iec.Project.fromXML(sourceCode);
            iecProj.Instances.Configurations.forEach(
                /**
                 * @param {iec.Configuration} c
                 */
                (c) => {
                    if(stcode.length > 0) return;
                    /**
                     * @type {iec.Resource}
                     */
                    const res = c.Resources.find(r => r.Name === resourceName);
                    if(res){
                        stcode = res.toST();
                    }
                }
            );
            if(stcode.length > 0){
                sourceCode = stcode;
            }
            else{
                throw new Error("No resource was found by the name " + resourceName + " or the resource could not be parsed.");
            }
        }
        const parsed = parseStructuredText(sourceCode);
        const transpiledCode = transpile(parsed);

        let tasks = [];
        let programs = [];
        let globals = [];
        let taskCode = "";
        let mapCode = "";
        let plcname = "NodalisPLC";
        if(typeof resourceName !== "undefined" && resourceName !== null){
            plcname = resourceName;
        }
        const lines = sourceCode.split("\n");
        lines.forEach((line) => {
            if(line.trim().startsWith("//Task=")){
                var task = JSON.parse(line.substring(line.indexOf("=") + 1).trim());
                task["Instances"] = [];
                tasks.push(task);
            }
            else if(line.trim().startsWith("//Instance=")){
                var instance = JSON.parse(line.substring(line.indexOf("=") + 1).trim());
                var task = tasks.find((t) => t.Name === instance.AssociatedTaskName);
                if(task){
                    task.Instances.push(instance);
                }
            }
            else if(line.trim().startsWith("//Map=")){
                mapCode += `mapIO("${line.substring(line.indexOf("=") + 1).trim()}");\n`;

            }
            else if(line.indexOf("//Global=") > -1){
                let global = JSON.parse(line.substring(line.indexOf("=") + 1).trim());
                globals.push(`${isArduinoTarget ? "modbusServer" : "opcServer"}.mapVariable("${global.Name}", "${global.Address}");`)

            }
            else if(line.trim().startsWith("PROGRAM")){
                var pname = line.trim().substring(line.trim().indexOf(" ") + 1).trim();
                if(pname.includes(" ")){
                    pname = pname.substring(pname.indexOf(" ") + 1);
                }
                if(pname.includes("//")){
                    pname = pname.substring(pname.indexOf("//") + 1);
                }
                if(pname.includes("(*")){
                    pname = pname.substring(pname.indexOf("(*") + 1);
                }
                programs.push(pname);
            }
        });
        if(tasks.length > 0){
            tasks.forEach((t) => {
                var progCode = "";
                t.Instances.forEach((i) => {
                    progCode += i.TypeName + "();\n";
                });
                taskCode += 
`
    if(PROGRAM_COUNT % ${t.Interval} == 0){
        ${progCode}
    }
`;
            });
        }
        else{
            programs.forEach((p) => {
                taskCode += p + "();\n";
            });
        }
        
        const cppCode = isArduinoTarget ?
`#include "nodalis.h"
#include <stdint.h>
#include "modbus.h"

NodalisModbusTcpServer modbusServer;
${transpiledCode}

void setup() {
  ${globals.join("\n")}
  modbusServer.start();
  ${mapCode}
}

void loop() {
  modbusServer.poll();
  superviseIO();
  ${taskCode}
  delay(1);
  PROGRAM_COUNT++;
  if(PROGRAM_COUNT == UINT64_MAX){
      PROGRAM_COUNT = 0;
  }
}` :
`#include "nodalis.h"
#include <chrono>
#include <thread>
#include <cstdint>
#include <limits>
#include "opcua.h"

OPCUAServer opcServer;
${transpiledCode}

int main() {
  ${globals.join("\n")}
  opcServer.start();
  ${mapCode}
  std::cout << "${plcname} is running!\\n";
  while (true) {
    try{
        superviseIO();
        ${taskCode}
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
        PROGRAM_COUNT++;
        if(PROGRAM_COUNT >= std::numeric_limits<uint64_t>::max()){
            PROGRAM_COUNT = 0;
        }
    }
    catch(const std::exception& e){
        std::cout << "Caught exception: " << e.what() << "\\n";
    }
  }
  return 0;
}`;

        fs.mkdirSync(outputPath, { recursive: true });
        fs.writeFileSync(cppFile, cppCode);
        if(sourcePath.toLowerCase().endsWith(".iec") || sourcePath.toLowerCase().endsWith(".xml")){
            fs.writeFileSync(stFile, sourceCode);
        }
        // Copy core headers and cpp support files
        const coreFiles = [
            'nodalis.h',
            'nodalis.cpp',
            'modbus.h',
            'modbus.cpp',
            'bacnet.h',
            'bacnet.cpp',
            "json.hpp"
        ];

        // if (!target.includes("windows")) {
        //     coreFiles.push(...["opcua.h",
        //         "opcua.cpp", "open62541.h",
        //         "open62541.c"]);
        // }
        // else {
        //     coreFiles.push(...["opcua.h",
        //         "opcua.cpp"]);
        // }

        const coreDir = path.resolve(__dirname + (isArduinoTarget ? '/support/arduino' : '/support/generic'));
        fs.cpSync(coreDir, outputPath, {force: true, recursive: true});
        // for (const file of coreFiles) {
            
        //     fs.copyFileSync(path.join(target.includes("windows") && file.includes("opc") ? coreDir + "/windows/" : coreDir, file), path.join(outputPath, file));
        // }

        const pathTo = name => path.join(outputPath, name);
        const targetInfo = isArduinoTarget ? null : this.resolveTarget(target);

        if (outputType === 'executable') {
            if (isArduinoTarget) {
                const arduinoCli = compilerConfig.arduino_cli || compilerConfig.arduinoCli || "arduino-cli";
                const arduinoFqbn = this.resolveArduinoFqbn(target, compilerConfig);
                if (!arduinoFqbn) {
                    throw new Error(`No Arduino FQBN configured for target "${target}". Use an explicit FQBN target (e.g. arduino:mbed_opta:opta) or add "arduino_fqbn" to toolchain.json.`);
                }
                this.assertArduinoModbusTargetSupported(arduinoFqbn);

                this.ensureArduinoCoreInstalled(arduinoCli, arduinoFqbn);

                const buildDir = path.join(outputPath, "build");
                fs.mkdirSync(buildDir, { recursive: true });
                const arduinoCompileCmd = `${arduinoCli} compile --fqbn "${arduinoFqbn}" "${outputPath}" --build-path "${buildDir}" --output-dir "${buildDir}" --export-binaries`;
                try {
                    execSync(arduinoCompileCmd, { stdio: 'inherit' });
                } catch (err) {
                    throw new Error(`Arduino CLI build failed. Verify arduino-cli is installed and the board core for "${arduinoFqbn}" is available. Inner error: ${err.message}`);
                }
                return;
            }
            const requestedTarget = target ?? `${targetInfo.os}-${targetInfo.arch}`;
            const hostOs = this.getHostOS();
            const hostArch = this.getHostArch();
            // if (targetInfo.os !== hostOs || targetInfo.arch !== hostArch) {
            //     throw new Error(`Cross-compiling to ${requestedTarget} is not supported from a ${hostOs}-${hostArch} host.`);
            // }

            const compiler = this.detectCompiler(hostOs, hostArch, targetInfo.os, targetInfo.arch);
            //const cCompiler = this.getCCompilerBinary(compiler);
            const archFlags = this.getArchFlags(targetInfo.os, targetInfo.arch, compiler);
            const formatFlags = (flags = []) => (flags.length ? `${flags.join(' ')} ` : '');
            const isWindowsTarget = targetInfo.os === 'windows';

            // Step 2: Compile open62541.c with C compiler
            //const open62541c = pathTo('open62541.c');
            const open62541o = pathTo(path.join("open62541", "lib", target, isWindowsTarget ? "open62541.lib" : 'open62541.o'));
            const bacneta = pathTo(path.join("bacnet-stack", target, "libbacnet.a"));
            const bacneti = pathTo(path.join("bacnet-stack", target, "include"));
            //let cCompileCmd = "";
            // if (compiler === 'cl.exe') {
            //     // Compile C file with cl
            //     const cFlagSegment = formatFlags(archFlags.c);
            //     cCompileCmd = `cl.exe ${cFlagSegment}/c /TC "${open62541c}" /Fo"${pathTo('open62541.obj')}"`;
            // } else {
            // if (!isWindowsTarget) {
            //     const cFlagSegment = formatFlags(archFlags.c);

            //     cCompileCmd = `${cCompiler} ${cFlagSegment}-std=c11 -D_DEFAULT_SOURCE -D_BSD_SOURCE -c "${open62541c}" -o "${open62541o}"`;

            // }

            // if (cCompileCmd !== "") execSync(cCompileCmd, { stdio: 'inherit' });

            // Step 3: Compile C++ files with C++ compiler and link object
            let exeFile = path.join(outputPath, filename);
            if (isWindowsTarget && !exeFile.endsWith('.exe')) {
                exeFile += '.exe';
            }

            let cppCompileCmd;
            const inputs = [
                `"${cppFile}"`,
                `"${pathTo('nodalis.cpp')}"`,
                `"${pathTo('modbus.cpp')}"`,
                `"${pathTo('opcua.cpp')}"`,
                `"${pathTo('bacnet.cpp')}"`
            ];

            inputs.push(`"${open62541o}"`);
            inputs.push(`"${bacneta}"`);

            if (compiler === 'cl.exe') {
                const cppFlagSegment = formatFlags(archFlags.cpp);
                cppCompileCmd = `cl.exe /I${bacneti} /I${bacneti}/ports/${isWindowsTarget ? "win32" : "linux"} ${cppFlagSegment}/EHsc /std:c++17 /Fe:"${exeFile}" ` +
                    `"${cppFile}" "${pathTo('nodalis.cpp')}" "${pathTo('modbus.cpp')}" "${pathTo('opcua.cpp')}" "${pathTo('bacnet.cpp')}"`; //"${pathTo('open62541.obj')}"`;
            } else {
                const cppFlagSegment = formatFlags(archFlags.cpp);
                cppCompileCmd = `${compiler} ${cppFlagSegment}-std=c++17 -I${bacneti} -I${bacneti}/ports/${isWindowsTarget ? "win32" : "linux"} -o "${exeFile}" ${inputs.join(' ')} ${archFlags.linker}`;
            }

            execSync(cppCompileCmd, { stdio: 'inherit' });
        }
    }

    resolveArduinoFqbn(target, compilerConfig = {}) {
        const explicit = compilerConfig.arduino_fqbn || compilerConfig.arduinoFqbn;
        if (explicit && typeof explicit === "string" && explicit.includes(":")) {
            return explicit;
        }
        if (typeof target === "string" && target.startsWith("arduino:")) {
            return target;
        }
        if (typeof target === "string" && UNSUPPORTED_ARDUINO_TARGET_ALIASES[target]) {
            return UNSUPPORTED_ARDUINO_TARGET_ALIASES[target];
        }
        const table = this.getArduinoTargetTable();
        return table.targetToFqbn[target] || DEFAULT_ARDUINO_FQBN[target] || null;
    }

    ensureArduinoCoreInstalled(arduinoCli, arduinoFqbn) {
        const fqbnParts = arduinoFqbn.split(":");
        if (fqbnParts.length < 3) {
            throw new Error(`Invalid Arduino FQBN "${arduinoFqbn}".`);
        }
        const coreId = `${fqbnParts[0]}:${fqbnParts[1]}`;

        let coreList = "";
        try {
            coreList = execSync(`${arduinoCli} core list`, { encoding: "utf8" });
        } catch (err) {
            throw new Error(`Failed to query installed Arduino cores using "${arduinoCli}". ${err.message}`);
        }
        if (coreList.includes(coreId)) {
            return;
        }

        try {
            execSync(`${arduinoCli} core update-index`, { stdio: 'inherit' });
            execSync(`${arduinoCli} core install ${coreId}`, { stdio: 'inherit' });
        } catch (err) {
            throw new Error(`Failed to install Arduino core "${coreId}" required for ${arduinoFqbn}. ${err.message}`);
        }
    }

    assertArduinoModbusTargetSupported(arduinoFqbn) {
        if (UNSUPPORTED_ARDUINO_MODBUS_FQBNS.has(arduinoFqbn)) {
            throw new Error(
                `Arduino target "${arduinoFqbn}" is currently unsupported for Modbus-TCP builds. ` +
                `Use a supported target like "arduino:mbed_portenta:envie_m7" or "arduino:mbed_opta:opta".`
            );
        }
    }

    getArduinoTargetTable(refresh = false) {
        if (!refresh && CachedArduinoTargetTable) {
            return CachedArduinoTargetTable;
        }

        const targetToFqbn = { ...DEFAULT_ARDUINO_FQBN };
        const targets = Object.keys(DEFAULT_ARDUINO_FQBN);

        try {
            const boardListRaw = execSync(`arduino-cli board listall --format json`, { encoding: "utf8" });
            const boardList = JSON.parse(boardListRaw);
            const boards = Array.isArray(boardList.boards) ? boardList.boards : [];

            for (const board of boards) {
                const fqbn = board?.fqbn;
                if (!fqbn || typeof fqbn !== "string") {
                    continue;
                }
                const parts = fqbn.split(":");
                if (parts.length < 3) {
                    continue;
                }
                const coreId = `${parts[0]}:${parts[1]}`;
                if (!MODBUS_ARDUINO_CORE_IDS.has(coreId)) {
                    continue;
                }
                if (UNSUPPORTED_ARDUINO_MODBUS_FQBNS.has(fqbn)) {
                    continue;
                }

                if (!targetToFqbn[fqbn]) {
                    targetToFqbn[fqbn] = fqbn;
                    targets.push(fqbn);
                }

                const boardId = parts[2];
                const alias = `arduino-${boardId.toLowerCase()}`;
                if (!targetToFqbn[alias]) {
                    targetToFqbn[alias] = fqbn;
                    targets.push(alias);
                }

                const boardName = typeof board?.name === "string" ? board.name : "";
                if (boardName.length > 0) {
                    let nameSlug = boardName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                    nameSlug = nameSlug.replace(/^arduino-/, '');
                    if (nameSlug.length > 0) {
                        const nameAlias = `arduino-${nameSlug}`;
                        if (!targetToFqbn[nameAlias]) {
                            targetToFqbn[nameAlias] = fqbn;
                            targets.push(nameAlias);
                        }
                    }
                }
            }
        } catch {
            // Keep defaults when arduino-cli is unavailable.
        }

        CachedArduinoTargetTable = { targetToFqbn, targets };
        return CachedArduinoTargetTable;
    }

    resolveTarget(target) {
        if (!target || typeof target !== 'string') {
            throw new Error('You must provide a valid target (e.g., linux-x64, macos-arm64).');
        }
        const [osPart, archPart] = target.split('-');
        if (!osPart || !archPart) {
            throw new Error(`Invalid target format: ${target}. Expected <os>-<arch>.`);
        }

        const normalizedOs = this.normalizeOs(osPart);
        const normalizedArch = this.normalizeArch(archPart);
        if (!normalizedOs || !normalizedArch) {
            throw new Error(`Unsupported target: ${target}.`);
        }
        return { os: normalizedOs, arch: normalizedArch };
    }

    normalizeOs(osPart) {
        const map = {
            linux: 'linux',
            macos: 'macos',
            darwin: 'macos',
            windows: 'windows',
            win32: 'windows'
        };
        return map[osPart.toLowerCase()];
    }

    normalizeArch(archPart) {
        const map = {
            x64: 'x64',
            amd64: 'x64',
            arm64: 'arm64',
            aarch64: 'arm64',
            arm: 'arm'
        };
        return map[archPart.toLowerCase()];
    }

    getHostOS() {
        const platform = os.platform();
        if (platform === 'win32') return 'windows';
        if (platform === 'darwin') return 'macos';
        if (platform === 'linux') return 'linux';
        throw new Error(`Unsupported host platform: ${platform}`);
    }

    getHostArch() {
        const arch = os.arch();
        if (arch === 'x64') return 'x64';
        if (arch === 'arm64') return 'arm64';
        if (arch.startsWith('arm')) return 'arm';
        throw new Error(`Unsupported host architecture: ${arch}`);
    }

    detectCompiler(hostOs, hostArch, targetOs, targetArch) {
        const hostDefaults = {
            linux: "g++",
            macos: "clang++",
            windows: "cl.exe"
        };
        const hostKey = `${hostOs}-${hostArch}`;
        const targetKey = `${targetOs}-${targetArch}`;

        const ensureCompilerAvailable = (compilerName, message) => {
            const versionCommand = compilerName === "cl.exe" ? compilerName : `${compilerName} --version`;
            try {
                execSync(versionCommand, { stdio: "ignore" });
            } catch {
                throw new Error(message);
            }
        };

        if (targetKey === hostKey) {
            const defaultCompiler = hostDefaults[hostOs];
            if (!defaultCompiler) {
                throw new Error(`No default compiler configured for host platform ${hostOs}.`);
            }
            ensureCompilerAvailable(
                defaultCompiler,
                `The default compiler "${defaultCompiler}" is not available. Install it using your package manager (e.g., brew install ${defaultCompiler} or apt install ${defaultCompiler}).
                You can also create a file called "toolchain.json" in your source directory which will supply the path to the gnu c compiler for each platform. See the README file for more details.`
            );
            return defaultCompiler;
        }

        const configuredCompiler = ToolChain[targetKey];
        if (!configuredCompiler) {
            throw new Error(`No cross-compiler is configured for target ${targetKey}. Add it to toolchain.json or update the ToolChain defaults.`);
        }
        ensureCompilerAvailable(
            configuredCompiler,
            `Cross-compiler "${configuredCompiler}" for target ${targetKey} is not available. Install it via your package manager (e.g., brew install ${configuredCompiler} or apt install ${configuredCompiler}).
                You can also create a file called "toolchain.json" in your source directory which will supply the path to the gnu c compiler for each platform. See the README file for more details.`
        );
        return configuredCompiler;
    }

    getCCompilerBinary(cppCompiler) {
        if (cppCompiler === 'cl.exe') {
            return 'cl.exe';
        }
        if (cppCompiler.includes('clang')) {
            return cppCompiler.replace('++', '');
        }
        if (cppCompiler.includes('g++')) {
            return cppCompiler.replace('++', 'cc');
        }
        return 'cc';
    }



    getArchFlags(osType, arch, compiler) {
        if (compiler === 'cl.exe') {
            return { c: [], cpp: [] };
        }
        let flags = { //default flags are for macos clang
            'linux-x64': [],
            'linux-arm64': [],
            'linux-arm': [],
            'macos-x64': ['-arch', 'x86_64'],
            'macos-arm64': ['-arch', 'arm64'],
            'windows-x64': [],
            'windows-arm64': []
        };

        let linker = {
            "windows-x64": " -lws2_32 -lcrypt32 -lwsock32 -lole32 -liphlpapi",
            "windows-arm64": " -lws2_32 -lcrypt32 -lwsock32 -lole32 -liphlpapi",
            "linux-x64": "",
            "linux-arm64": "",
            "linux-arm": "",
            "macos-x64": "",
            "macos-arm64": "",
        }

        if (!compiler.includes("clang")) {
            flags = {
                'linux-x64': ["-D_POSIX_C_SOURCE=200809L -D_GNU_SOURCE -pthread"],
                'linux-arm64': ["-D_POSIX_C_SOURCE=200809L -D_GNU_SOURCE -pthread"],
                'linux-arm': ["-D_POSIX_C_SOURCE=200809L -D_GNU_SOURCE -pthread"],
                'windows-x64': ["-DUA_ARCHITECTURE_WIN32 -D_POSIX_C_SOURCE=200809L -D_GNU_SOURCE"],
                'windows-arm64': ["-DUA_ARCHITECTURE_WIN32 -D_POSIX_C_SOURCE=200809L -D_GNU_SOURCE"]
            };
        }

        const key = `${osType}-${arch}`;

        const resolved = flags[key];
        if (!resolved) {
            throw new Error(`Architecture flags are not defined for ${key}.`);
        }

        return { c: resolved, cpp: resolved, linker: linker[key] };
    }
}



export default CPPCompiler;

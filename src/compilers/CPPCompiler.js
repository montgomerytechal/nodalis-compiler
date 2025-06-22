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
        return ['linux', 'macOS', 'windows'];
    }

    get supportedProtocols() {
        return [CommunicationProtocol.MODBUS];
    }

    get compilerVersion() {
        return '1.0.0';
    }

    compile() {
        const { sourcePath, outputPath, target, outputType, resourceName } = this.options;
        var sourceCode = fs.readFileSync(sourcePath, 'utf-8');
        const filename = path.basename(sourcePath, path.extname(sourcePath));
        const cppFile = path.join(outputPath, `${filename}.cpp`);
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
        let plcname = "ImperiumPLC";
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
                globals.push(`opcServer.mapVariable("${global.Name}", "${global.Address}");`)

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
        
        const cppCode = 
`#include "imperium.h"
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
            'imperium.h',
            'imperium.cpp',
            'modbus.h',
            'modbus.cpp',
            "json.hpp",
            "opcua.h",
            "opcua.cpp",
            "open62541.h",
            "open62541.c"
        ];

        const coreDir = path.resolve('./src/compilers/support/generic');
        for (const file of coreFiles) {
            fs.copyFileSync(path.join(coreDir, file), path.join(outputPath, file));
        }

       const pathTo = name => path.join(outputPath, name);

        if (outputType === 'executable') {
            let compiler = null;
            const isWindows = os.platform() === 'win32';

            // Step 1: Detect compilers
            try {
                execSync('clang++ --version', { stdio: 'ignore' });
                compiler = 'clang++';
            } catch {
                try {
                    execSync('g++ --version', { stdio: 'ignore' });
                    compiler = 'g++';
                } catch {
                    try {
                        execSync('cl.exe /?', { stdio: 'ignore' });
                        compiler = 'cl.exe';
                    } catch {
                        throw new Error('No C++ compiler found (clang++, g++, or cl.exe)');
                    }
                }
            }

            // Step 2: Compile open62541.c with C compiler
            const cCompiler = compiler === 'cl.exe' ? 'cl.exe' : compiler.replace('++', '');
            const open62541c = pathTo('open62541.c');
            const open62541o = pathTo('open62541.o');

            let cCompileCmd;
            if (compiler === 'cl.exe') {
                // Compile C file with cl
                cCompileCmd = `cl.exe /c /TC "${open62541c}" /Fo"${pathTo('open62541.obj')}"`;
            } else {
                cCompileCmd = `${cCompiler} -std=c11 -D_DEFAULT_SOURCE -D_BSD_SOURCE -c "${open62541c}" -o "${open62541o}"`;

            }

            execSync(cCompileCmd, { stdio: 'inherit' });

            // Step 3: Compile C++ files with C++ compiler and link object
            let exeFile = path.join(outputPath, filename);
            if (isWindows && !exeFile.endsWith('.exe')) {
                exeFile += '.exe';
            }

            let cppCompileCmd;
            if (compiler === 'cl.exe') {
                cppCompileCmd = `cl.exe /EHsc /std:c++17 /Fe:"${exeFile}" ` +
                    `"${cppFile}" "${pathTo('imperium.cpp')}" "${pathTo('modbus.cpp')}" "${pathTo('opcua.cpp')}" "${pathTo('open62541.obj')}"`;
            } else {
                cppCompileCmd = `${compiler} -std=c++17 -o "${exeFile}" ` +
                    `"${cppFile}" "${pathTo('imperium.cpp')}" "${pathTo('modbus.cpp')}" "${pathTo('opcua.cpp')}" "${open62541o}"`;
            }

            execSync(cppCompileCmd, { stdio: 'inherit' });
        }
    }

}

export default CPPCompiler;

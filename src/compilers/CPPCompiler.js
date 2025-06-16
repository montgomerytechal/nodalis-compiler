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
${transpiledCode}

int main() {
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
            "json.hpp"
        ];

        const coreDir = path.resolve('./src/compilers/support/generic');
        for (const file of coreFiles) {
            fs.copyFileSync(path.join(coreDir, file), path.join(outputPath, file));
        }

       if (outputType === 'executable') {
        let compiler = null;
        const isWindows = os.platform() === 'win32';

        // Step 1: Detect compiler
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

        // Step 2: Determine output file name
        let exeFile = path.join(outputPath, filename);
        if (isWindows && !exeFile.endsWith('.exe')) {
            exeFile += '.exe';
        }

        // Step 3: Build compile command
        let compileCmd;

        if (compiler === 'cl.exe') {
            // cl.exe syntax
            compileCmd = `"cl.exe" /EHsc /std:c++17 /Fe:"${exeFile}" "${cppFile}" "${path.join(outputPath, 'imperium.cpp')}" "${path.join(outputPath, 'modbus.cpp')}"`;
        } else {
            // g++ or clang++ syntax
            compileCmd = `${compiler} -std=c++17 -o "${exeFile}" "${cppFile}" "${path.join(outputPath, 'imperium.cpp')}" "${path.join(outputPath, 'modbus.cpp')}"`;
        }

        // Step 4: Execute compile command
        execSync(compileCmd, { stdio: 'inherit' });
        }
    }

}

export default CPPCompiler;

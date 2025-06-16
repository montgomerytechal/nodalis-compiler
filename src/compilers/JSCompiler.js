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
import fs from 'fs';
import path from "path";
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from './Compiler.js';
import * as iec from "./iec-parser/parser.js";
import { parseStructuredText } from './st-parser/parser.js';
import { transpile } from './st-parser/jstranspiler.js';
import which from "which";

export class JSCompiler extends Compiler {
    constructor(options) {
        super(options);
        this.name = 'JSCompiler';
    }

    get supportedLanguages() {
        return [IECLanguage.STRUCTURED_TEXT, IECLanguage.LADDER_DIAGRAM];
    }

    get supportedOutputTypes() {
        return [OutputType.SOURCE_CODE];
    }

    get supportedTargetDevices() {
        return ["jint", "nodejs"];
    }

    get supportedProtocols() {
        return [CommunicationProtocol.MODBUS, CommunicationProtocol.OPC_UA, CommunicationProtocol.BACNET];
    }

    get compilerVersion() {
        return '1.0.0';
    }

    compile() {
        const { sourcePath, outputPath, target, outputType, resourceName } = this.options;
        var sourceCode = fs.readFileSync(sourcePath, 'utf-8');
        const filename = path.basename(sourcePath, path.extname(sourcePath));
        const jsFile = path.join(outputPath, `${filename}.js`);
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
    ${target === "nodejs" ? `setInterval(() => {` : ""}
        ${progCode}
    ${target === "nodejs" ? `}, ${t.Interval});` : ""}
`;
            });
        }
        else{
            if(target === "nodejs") taskCode = "setInterval(() => {\n";
            programs.forEach((p) => {
                taskCode += p + "();\n";
            });
            if(target === "nodejs") taskCode += "}, 100);"
        }
        
        let jsCode = 
`import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord,
        getBit, setBit, resolve, newStatic, RefVar, superviseIO, mapIO,
        TON, TOF, TP, R_TRIG, F_TRIG, CTU, CTD, CTUD,
        AND, OR, XOR, NOR, NAND, NOT, ASSIGNMENT,
        EQ, NE, LT, GT, GE, LE,
        MOVE, SEL, MUX, MIN, MAX, LIMIT
} from "./imperium.js";
${transpiledCode}

export function setup(){
    ${mapCode}
}

export function run(){
    ${target === "nodejs" ? "setInterval(superviseIO, 1);" : ""} 
    ${taskCode}
    console.log("${plcname} is running!");
}
`;
        if(target === "nodejs"){
            jsCode += "\nsetup();\nrun();";
        }
        fs.mkdirSync(outputPath, { recursive: true });
        fs.writeFileSync(jsFile, jsCode);
        if(sourcePath.toLowerCase().endsWith(".iec") || sourcePath.toLowerCase().endsWith(".xml")){
            fs.writeFileSync(stFile, sourceCode);
        }
        // Copy core headers and cpp support files
        const coreFiles = [
            'imperium.js',
            'modbus.js',
            "IOClient.js"
        ];

        let coreDir = path.resolve('./src/compilers/support/nodejs');
        if(target === "jint"){
            coreDir = path.resolve('./src/compilers/support/jint');
        }
        for (const file of coreFiles) {
            fs.copyFileSync(path.join(coreDir, file), path.join(outputPath, file));
        }

        if(target === "nodejs"){
            writePackageJson(outputPath, plcname);
            installDependencies(outputPath);
        }
    }

}

function writePackageJson(outputDir,plcname) {
  const pkg = {
    name: "imperium-" + plcname,
    version: "1.0.0",
    type: "module",
    main: plcname + ".js",
    dependencies: {
      "jsmodbus": "^4.0.6"
    }
  };
  fs.writeFileSync(path.join(outputDir, "package.json"), JSON.stringify(pkg, null, 2));
}

function installDependencies(outputDir) {
  const npmPath = which.sync('npm'); // find actual npm binary
  console.log(`Running npm from: ${npmPath}`);

  execSync(`"${npmPath}" install`, {
    cwd: outputDir,
    stdio: 'inherit',
    shell: true
  });
}


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
import os from "os";
import path from "path";
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from './Compiler.js';
import * as iec from "./iec-parser/parser.js";
import { parseStructuredText } from './st-parser/parser.js';
import { transpile } from './st-parser/jstranspiler.js';
import which from "which";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class JSCompiler extends Compiler {
    constructor(options) {
        super(options);
        this.name = 'JSCompiler';
    }

    get supportedLanguages() {
        return [IECLanguage.STRUCTURED_TEXT, IECLanguage.LADDER_DIAGRAM];
    }

    get supportedOutputTypes() {
        return [OutputType.SOURCE_CODE, OutputType.EXECUTABLE];
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
        let includes = 
        `import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord, readAddress, writeAddress,
        getBit, setBit, resolve, newStatic, RefVar, superviseIO, mapIO, createReference,
        TON, TOF, TP, R_TRIG, F_TRIG, CTU, CTD, CTUD,
        AND, OR, XOR, NOR, NAND, NOT, ASSIGNMENT,
        EQ, NE, LT, GT, GE, LE,
        MOVE, SEL, MUX, MIN, MAX, LIMIT
} from "./imperium.js";
 import {OPCServer} from "./opcua.js";`;
        if(target === "jint"){
            includes = "";
        }
        let jsCode = 
`${includes}
${transpiledCode}
${target === "nodejs" ? `let opcServer = new OPCServer();`: ""}
export async function setup(){
    ${mapCode}

    ${target === "nodejs" ? "opcServer.setReadWriteHandlers(readAddress, writeAddress);\n" + `await opcServer.start();\n` + globals.join("\n") : ""}
    console.log("${plcname} is running!");
}

export function run(){
    ${target === "nodejs" ? "setInterval(superviseIO, 1);" : ""} 
    ${taskCode}
    
}
`;
        if(target === "nodejs"){
            jsCode += "\nsetup();\nrun();";
        }
        if(target === "jint"){
            jsCode = jsCode.replaceAll("export ", "").replaceAll("console.log", "log").replaceAll("console.error", "error");
        }
        fs.mkdirSync(outputPath, { recursive: true });
        fs.writeFileSync(jsFile, jsCode);
        if(sourcePath.toLowerCase().endsWith(".iec") || sourcePath.toLowerCase().endsWith(".xml")){
            fs.writeFileSync(stFile, sourceCode);
        }
        if(target === "nodejs"){
            // Copy core headers and cpp support files
            const coreFiles = [
                'imperium.js',
                'modbus.js',
                "IOClient.js",
                "opcua.js"
            ];

            let coreDir = path.resolve('./src/compilers/support/nodejs');
            
            for (const file of coreFiles) {
                fs.copyFileSync(path.join(coreDir, file), path.join(outputPath, file));
            }

            writePackageJson(outputPath, plcname);
            installDependencies(outputPath);
        }
        

        if (target === "jint" && outputType === "executable") {
            const supportDir = path.resolve(__dirname, "support/jint/Imperium");
            const buildScript = os.platform() === "win32" ? "build.bat" : "build.sh";

            // 1. Copy all files from support/jint/imperium to the output directory
            fs.cpSync(supportDir, outputPath, { recursive: true });

            // 2. Run the build script inside the output directory
            const buildPath = path.resolve(path.join(outputPath, buildScript));
            if(buildPath.endsWith(".sh")){
                fs.chmodSync(buildPath, 0o755); // make executable
            }
            execSync(buildPath, { cwd: path.resolve(outputPath), stdio: "inherit", shell: true });

            // 3. Copy the generated JS file to each publish folder
            const publishRoot = path.join(outputPath, "publish");
            
            const platforms = fs.readdirSync(publishRoot, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => path.join(publishRoot, d.name));
            const scriptName = filename + ".js"
            for (const platformDir of platforms) {
                const dest = path.join(platformDir, scriptName);
                fs.copyFileSync(jsFile, dest);

                // 2. Patch bootstrap.sh if present
                const shFile = path.join(platformDir, "bootstrap.sh");
                if (fs.existsSync(shFile)) {
                    let content = fs.readFileSync(shFile, "utf-8");
                    content = content.replace("{script}", scriptName);
                    fs.writeFileSync(shFile, content, "utf-8");
                    fs.chmodSync(shFile, 0o755); // make executable
                }

                // 3. Patch bootstrap.bat if present
                const batFile = path.join(platformDir, "bootstrap.bat");
                if (fs.existsSync(batFile)) {
                    let content = fs.readFileSync(batFile, "utf-8");
                    content = content.replace("{script}", scriptName);
                    fs.writeFileSync(batFile, content, "utf-8");
                }

            }
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
      "jsmodbus": "^4.0.6",
      "node-opcua": "^2.156.0"
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


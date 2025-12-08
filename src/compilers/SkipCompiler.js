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
import { runMticp } from 'mticp-npm';

export class SkipCompiler extends Compiler {
    constructor(options) {
        super(options);
        this.name = 'SkipCompiler';
    }

    get supportedLanguages() {
        return ["SKIP"];
    }

    get supportedOutputTypes() {
        return [OutputType.SOURCE_CODE];
    }

    get supportedTargetDevices() {
        return ['iec', 'st', 'xml'];
    }

    get supportedProtocols() {
        return [CommunicationProtocol.MODBUS, CommunicationProtocol.OPC_UA, CommunicationProtocol.CUSTOM, CommunicationProtocol.BACNET];
    }

    get compilerVersion() {
        return '1.0.0';
    }

    compile() {
        const { sourcePath, outputPath, target, outputType, resourceName } = this.options;
        var sourceCode = fs.readFileSync(sourcePath, 'utf-8');
        const filename = path.basename(sourcePath, path.extname(sourcePath));
        if (!sourcePath.toLowerCase().endsWith(".skip")) {
            throw new Error("Invalid file format. Must provide a Skipper Sheets file format.");

        }
        else if(!this.supportedTargetDevices.includes(target)) {
            throw new Error("Invalid target. Must be IEC, ST, or XML target.");
        }
        else {
            const action = "to" + target;
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath);
            }
            runMticp([
                `action=${action}`,
                `src=${sourcePath}`,
                    `dst=${outputPath}`
            ]).then(output => console.log(output))
                .catch(err => console.error(err));
        }
    }

}

export default SkipCompiler;

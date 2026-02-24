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

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from "./Compiler.js";
import * as iec from "./iec-parser/parser.js";


export class CodeSysCompiler extends Compiler {
  constructor(options) {
    super(options);
    this.name = "CodeSysCompiler";
  }

  get supportedLanguages() {
    return [IECLanguage.STRUCTURED_TEXT, IECLanguage.LADDER_DIAGRAM];
  }

  get supportedOutputTypes() {
    return [OutputType.SOURCE_CODE, OutputType.EXECUTABLE];
  }

  get supportedTargetDevices() {
      return ["codesys", "codesys-rte64", "codesys-win64"];
  }

  get supportedProtocols() {
    return [
      CommunicationProtocol.MODBUS,
      CommunicationProtocol.BACNET,
      CommunicationProtocol.OPC_UA,
      CommunicationProtocol.GPIO,
      CommunicationProtocol.CUSTOM
    ];
  }

  get compilerVersion() {
    return "0.1.0";
  }

  async compile() {
      const { sourcePath, outputPath, outputType, resourceName, target } = this.options;
      //TODO: Add compilation.
  }


}

export default CodeSysCompiler;

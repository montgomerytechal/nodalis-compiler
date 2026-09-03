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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from "./Compiler.js";
import * as iec from "./iec-parser/parser.js";
import { transpile } from './st-parser/codesystranspiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const { sourcePath, outputPath, resourceName } = this.options;
      const extension = path.extname(sourcePath).toLowerCase();
      if (extension !== '.iec' && extension !== '.xml') {
        throw new Error('CodeSysCompiler requires an IEC project file (.iec or .xml).');
      }
      if (!resourceName) throw new Error('You must provide the resourceName option for an IEC project file.');

      const templatePath = this.options.codesysExportTemplateFile
        ? path.resolve(this.options.codesysExportTemplateFile)
        : path.join(__dirname, 'templates', 'codesys-default.export');
      const sourceXML = fs.readFileSync(sourcePath, 'utf8');
      const templateXML = fs.readFileSync(templatePath, 'utf8');
      const project = iec.Project.fromXML(sourceXML);
      const exportModel = transpile(project, {
        templateXML,
        resourceName,
        applicationName: this.options.codesysApplicationName,
        deviceName: this.options.codesysDeviceName,
        globalVariableListName: this.options.codesysGlobalVariableListName
      });
      fs.mkdirSync(outputPath, { recursive: true });
      const outputFile = path.join(outputPath, `${resourceName}.export`);
      fs.writeFileSync(outputFile, exportModel.toXML());
      return outputFile;
  }


}

export default CodeSysCompiler;

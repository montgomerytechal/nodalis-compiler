#!/usr/bin/env node
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
// imperium.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Updated compiler imports
import { CPPCompiler } from './compilers/CPPCompiler.js';
import { JSCompiler } from './compilers/JSCompiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const availableCompilers = [
  new CPPCompiler(),
  new JSCompiler(),
];

function validateFileExtension(language, sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (language === 'st') {
    if (ext !== '.st' && ext !== '.iec') {
      throw new Error(`Invalid file extension for language 'st'. Expected '.st' or '.iec', got '${ext}'`);
    }
  } else if (language === 'ld') {
    if (ext !== '.iec') {
      throw new Error(`Invalid file extension for language 'ld'. Expected '.iec', got '${ext}'`);
    }
  } else {
    throw new Error(`Unknown language: ${language}`);
  }
}

export class Imperium {
  constructor() {
    this.compilers = availableCompilers;
  }

  listCompilers() {
    return this.compilers.map(c => ({
      name: c.constructor.name,
      supportedTargets: c.supportedTargetDevices,
      supportedOutputTypes: c.supportedOutputTypes,
      supportedLanguages: c.supportedLanguages,
      supportedProtocols: c.supportedProtocols,
      compilerVersion: c.compilerVersion,
    }));
  }

  getCompiler(target, outputType, language) {
    return this.compilers.find(c =>
      c.supportedTargetDevices.includes(target) &&
      c.supportedOutputTypes.includes(outputType) &&
      c.supportedLanguages.includes(language.toUpperCase())
    );
  }

  async compile({ target, outputType, outputPath, resourceName, sourcePath, language }) {
    validateFileExtension(language, sourcePath);

    const compiler = this.getCompiler(target, outputType, language);
    if (!compiler) {
      throw new Error(`No compiler found for target "${target}", outputType "${outputType}", and language "${language}"`);
    }

    compiler.options = {
      sourcePath,
      outputPath,
      resourceName,
      target,
      outputType,
      language,
    };

    await compiler.compile();
  }
}

// === CLI Entry Point ===
if (process.argv[1] === fileURLToPath(import.meta.url)) {

    if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage:
  node imperium.js --action <action> [options]

Actions:
  --action list-compilers
      Lists all available compilers and their supported targets, languages, protocols, and versions.

  --action compile
      Required options:
        --target        Target platform (e.g. nodejs, generic-cpp)
        --outputType    Output type (e.g. code, executable)
        --outputPath    Directory to write the result
        --resourceName  Resource name (used for .iec projects)
        --sourcePath    Path to source file (.st or .iec)
        --language      st (Structured Text) or ld (Ladder Diagram)

Examples:
  node imperium.js --action list-compilers

  node imperium.js --action compile \\
    --target nodejs \\
    --outputType code \\
    --outputPath ./out \\
    --resourceName MyPLC \\
    --sourcePath ./examples/pump.iec \\
    --language st
  `);
  process.exit(0);
}

  const args = process.argv.slice(2);
  const argMap = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    argMap[key] = value;
  }

  const app = new Imperium();

  switch (argMap.action) {
    case 'list-compilers': {
      const list = app.listCompilers();
      console.log(JSON.stringify(list, null, 2));
      break;
    }

    case 'compile': {
      app.compile({
        target: argMap.target,
        outputType: argMap.outputType,
        outputPath: argMap.outputPath,
        resourceName: argMap.resourceName,
        sourcePath: argMap.sourcePath,
        language: argMap.language,
      }).then(() => {
        console.log('Compilation completed.');
      }).catch(err => {
        console.error(`Compilation failed: ${err.message}`);
      });
      break;
    }

    case 'deploy': {
      console.log(`Deploy action is not yet implemented.`);
      break;
    }

    default: {
      console.error(`Unknown or missing action: ${argMap.action}`);
      console.error(`Valid actions: list-compilers, compile, deploy`);
      break;
    }
  }
}

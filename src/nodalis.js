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

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Updated compiler imports
import { CPPCompiler } from './compilers/CPPCompiler.js';
import { JSCompiler } from './compilers/JSCompiler.js';
import { SkipCompiler } from "./compilers/SkipCompiler.js";
import { MTIProgrammer } from "./programmers/MTIProgrammer.js";
import { CompileList } from "mticp-npm"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const availableCompilers = [
  new CPPCompiler(),
  new JSCompiler(),
  new SkipCompiler()
];

const availableProgrammers = [
  new MTIProgrammer()
];

function validateFileExtension(language, sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  language = language.toLowerCase();
  if (language === 'st') {
    if (ext !== '.st' && ext !== '.iec') {
      throw new Error(`Invalid file extension for language 'st'. Expected '.st' or '.iec', got '${ext}'`);
    }
  } else if (language === 'ld') {
    if (ext !== '.iec') {
      throw new Error(`Invalid file extension for language 'ld'. Expected '.iec', got '${ext}'`);
    }
  }
  else if (language === "skip") {
    if (ext !== ".skip") {
      throw new Error(`Invalid file extension for language 'skip'. Expected '.skip', got ${ext}`);
    }
  }
  else {
    throw new Error(`Unknown language: ${language}`);
  }
}

export const MTICompileList = CompileList;

export class Nodalis {
  constructor() {
    this.compilers = availableCompilers;
    this.programmers = availableProgrammers;
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

  listProgrammers() {
    return this.programmers.map(p => ({
      name: p.name,
      target: p.target
    }));
  }

  getCompiler(target, outputType, language) {
    return this.compilers.find(c =>
      ((typeof c.canHandleTarget === "function" && c.canHandleTarget(target)) || c.supportedTargetDevices.includes(target)) &&
      c.supportedOutputTypes.includes(outputType) &&
      c.supportedLanguages.includes(language.toUpperCase())
    );
  }

  getProgrammer(target) {
    return this.programmers.find(p =>
      p.target === target
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

  async program({ target, source, destination, username, password }) {
    const programmer = this.getProgrammer(target);
    if (!programmer) {
      throw new Error(`No programmer found for target ${target}.`);
    }
    programmer.options = {
      source,
      destination,
      username,
      password
    }
    if (await programmer.program() === false) {
      throw new Error(`Failed to program ${target} ${destination}`);
    }
  }

}

// === CLI Entry Point ===
if (process.argv[1] === fileURLToPath(import.meta.url)) {

    if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage:
  node nodalis.js --action <action> [options]

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

  --action deploy  Programs a device based on a protocol.
    --target        The device/protocol targeted for programming.
    --source    The path to the file or folder to use for programming.
    --destination   The destination of the target device.
    --username      The username for programming the device, if needed.
    --password      The password for programming the device, if needed.

Examples:
  node nodalis.js --action list-compilers

  node nodalis.js --action compile \\
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

  const app = new Nodalis();

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
      app.program({
        target: argMap.target,
        source: argMap.source,
        destination: argMap.destination,
        username: argMap.username,
        password: argMap.password
      }).then(() => {
        console.log('Deployment completed.');
      }).catch(err => {
        console.error(`Deployment failed: ${err.message}`);
      });
      break;
    }

    default: {
      console.error(`Unknown or missing action: ${argMap.action}`);
      console.error(`Valid actions: list-compilers, compile, deploy`);
      break;
    }
  }
}

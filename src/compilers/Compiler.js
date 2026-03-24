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

import fs from 'fs';
import path from 'path';

export const IECLanguage = Object.freeze({
  LADDER_DIAGRAM: 'LD',
  STRUCTURED_TEXT: 'ST',
  FUNCTION_BLOCK_DIAGRAM: 'FBD',
  INSTRUCTION_LIST: 'IL',
  SEQUENTIAL_FUNCTION_CHART: 'SFC'
});

export const OutputType = Object.freeze({
  EXECUTABLE: 'executable',
  NODE_APP: 'node',
  SOURCE_CODE: 'code'
});

export const CommunicationProtocol = Object.freeze({
  MODBUS: 'Modbus',
  BACNET: 'BACnet',
  OPC_UA: 'OPCUA',
  GPIO: 'GPIO',
  CUSTOM: 'Custom'
});

/**
 * @typedef {Object} CompilerOptions
 * @property {string} sourcePath - Source file or folder path
 * @property {string} outputPath - Output destination folder path
 * @property {string} target - The target type for the compiler.
 * @property {string} resourceName - The name of the resource to compile, if IEC.
 * @property {string} outputType - One of OutputType values
 */

/**
 * Abstract base class for all compilers.
 */
export class Compiler {
  /**
   * @param {CompilerOptions} options 
   */
  constructor(options) {
    if (new.target === Compiler) {
      throw new Error('Cannot instantiate abstract class Compiler directly.');
    }

    this.options = options;
  }

  isExecutableOutput() {
    return this.options?.outputType === OutputType.EXECUTABLE;
  }

  getExecutableOutputPath() {
    return path.join(this.options.outputPath, 'bin');
  }

  getStructuredTextBundleArtifactName() {
    return 'nodalisplc.st';
  }

  cleanupStructuredTextBundleArtifacts(sourcePath) {
    const artifactPath = path.join(sourcePath, this.getStructuredTextBundleArtifactName());
    if (fs.existsSync(artifactPath) && fs.lstatSync(artifactPath).isFile()) {
      fs.rmSync(artifactPath, { force: true });
    }
  }

  listStructuredTextBundleFiles(sourcePath) {
    const bundleArtifactName = this.getStructuredTextBundleArtifactName().toLowerCase();
    return fs.readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => entry.isFile()
        && entry.name.toLowerCase().endsWith('.st')
        && entry.name.toLowerCase() !== bundleArtifactName)
      .map((entry) => entry.name);
  }

  loadStructuredTextBundle(sourcePath, resourceName) {
    const stFiles = this.listStructuredTextBundleFiles(sourcePath);

    if (stFiles.length === 0) {
      throw new Error(`No .st files found in source directory "${sourcePath}".`);
    }

    const normalizedResource = String(resourceName || '').trim();
    const candidateNames = new Set([
      normalizedResource,
      normalizedResource.toLowerCase(),
      normalizedResource.toLowerCase().endsWith('.st') ? normalizedResource.toLowerCase() : `${normalizedResource.toLowerCase()}.st`
    ]);

    const entryFile = stFiles.find((file) => {
      const lower = file.toLowerCase();
      return candidateNames.has(file) || candidateNames.has(lower);
    });

    if (!entryFile) {
      throw new Error(`resourceName "${resourceName}" is not an .st file in "${sourcePath}".`);
    }

    const orderedFiles = [
      ...stFiles.filter((file) => file !== entryFile).sort((a, b) => a.localeCompare(b)),
      entryFile
    ];

    let combinedSource = '';
    let currentLine = 1;
    const fileLineMappings = [];

    for (const file of orderedFiles) {
      const fileSource = fs.readFileSync(path.join(sourcePath, file), 'utf-8').trim();
      if (fileSource.length === 0) continue;

      if (combinedSource.length > 0) {
        combinedSource += '\n\n';
        currentLine += 1;
      }

      const lineCount = fileSource.split('\n').length;
      fileLineMappings.push({
        file,
        startLine: currentLine,
        endLine: currentLine + lineCount - 1
      });
      combinedSource += fileSource;
      currentLine += lineCount;
    }

    const entrySource = fs.readFileSync(path.join(sourcePath, entryFile), 'utf-8');
    const entryProgramName = this.extractFirstProgramName(entrySource) || path.basename(entryFile, path.extname(entryFile));

    return { combinedSource, entryProgramName, fileLineMappings };
  }

  extractFirstProgramName(sourceCode) {
    const match = String(sourceCode || '').match(/^\s*PROGRAM\s+([A-Za-z_]\w*)/im);
    return match ? match[1] : null;
  }

  annotateStructuredTextBundleError(error, fileLineMappings = []) {
    if (!error?.line || !Array.isArray(fileLineMappings) || fileLineMappings.length === 0) {
      return error;
    }

    const mapping = fileLineMappings.find(({ startLine, endLine }) => error.line >= startLine && error.line <= endLine);
    if (!mapping) {
      return error;
    }

    const localLine = error.line - mapping.startLine + 1;
    const column = error.column ?? error.sourceLocation?.column ?? 1;
    const baseMessage = String(error.message || 'Structured Text error').replace(
      /\s+at line \d+, column \d+$/,
      ''
    );

    error.bundleLine = error.line;
    error.file = mapping.file;
    error.line = localLine;
    error.column = column;
    error.sourceLocation = {
      file: mapping.file,
      line: localLine,
      column,
      bundleLine: error.bundleLine
    };
    error.message = `${baseMessage} in ${mapping.file} at line ${localLine}, column ${column} (bundle line ${error.bundleLine})`;
    return error;
  }

  parseStructuredTextWithBundleContext(parseFn, sourceCode, fileLineMappings) {
    try {
      return parseFn(sourceCode);
    } catch (error) {
      throw this.annotateStructuredTextBundleError(error, fileLineMappings);
    }
  }

  transpileStructuredTextWithBundleContext(transpileFn, parsed, fileLineMappings) {
    try {
      return transpileFn(parsed);
    } catch (error) {
      throw this.annotateStructuredTextBundleError(error, fileLineMappings);
    }
  }

  /** @returns {string[]} */
  get supportedLanguages() {
    throw new Error('supportedLanguages must be implemented by subclass.');
  }

  /** @returns {string[]} */
  get supportedOutputTypes() {
    throw new Error('supportedOutputTypes must be implemented by subclass.');
  }

  /** @returns {string[]} */
  get supportedTargetDevices() {
    throw new Error('supportedTargetDevices must be implemented by subclass.');
  }

  /** @returns {string[]} */
  get supportedProtocols() {
    throw new Error('supportedProtocols must be implemented by subclass.');
  }

  // Optional compiler-specific metadata

  /** @returns {string|undefined} */
  get compilerVersion() {
    return undefined;
  }

  /** @returns {string|undefined} */
  get targetPlatform() {
    return undefined;
  }

  /** @returns {string|undefined} */
  get optimizationLevel() {
    return undefined;
  }

  /**
   * Perform the compilation.
   * @returns {Promise<void>}
   */
  async compile() {
    throw new Error('compile() must be implemented by subclass.');
  }
}

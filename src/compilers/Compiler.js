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
  ETHERNET_IP: 'Ethernet/IP',
  PROFINET: 'Profinet',
  OPC_UA: 'OPC UA',
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


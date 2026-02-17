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

export const ProgrammingTargets = Object.freeze({
    MTI: 'MTI',
    FILE: 'FILE',
    SSH: 'SSH',
    ARDUINO: 'arduino'
});

/**
 * @typedef {Object} ProgrammerOptions
 * @property {string} source - Source file or folder path
 * @property {string} destination - Output destination folder path, ip address, or URI.
 * @property {string} username - Username for programming.
 * @property {string} password - Password for programming.
 */

export class Programmer{

    /**
     * 
     * @param {ProgrammerOptions} options Options for the programmer.
     */
    constructor(options) {
        if (new.target === Programmer) {
            throw new Error('Cannot instantiate abstract class Programmer directly.');
        }

        this.options = options;
    }

    /**
   * Perform the programming.
   * @returns {Promise<bool>}
   */
    async program() {
        throw new Error('program() must be implemented by subclass.');
    }
}

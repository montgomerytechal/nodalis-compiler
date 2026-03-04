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
import { Programmer } from "./Programmer.js";
import { runMticp } from "mticp-npm";
/**
 * @typedef {Object} ProgrammerOptions
 * @property {string} source - Source file or folder path
 * @property {string} destination - Output destination folder path, ip address, or URI.
 * @property {string} username - Username for programming.
 * @property {string} password - Password for programming.
 */

export class MTIProgrammer extends Programmer {
    constructor(options) {
        super(options);
        this.name = "MTIProgrammer";
        this.target = "MTI";
        this.required = [];
    }

    async program() {
        let result = true;
        try {
            runMticp([
                "action=sendxml",
                `src=${this.options.source}`,
                `dst=${this.options.destination}`
            ]).then(output => {
                if (output) {
                    console.log(output);
                }
            })
            .catch(err => {
                // Print any error from the binary and exit non-zero
                console.error(err.message || err);
            });
        }
        catch (e) {
            result = false;
            console.error(e);
        }
        return result;
    }
}
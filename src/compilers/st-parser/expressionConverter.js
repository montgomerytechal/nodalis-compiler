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


export function convertExpression(expr) {
  var results =  expr
    .replace(/\bAND\b/gi, '&&')
    .replace(/\bOR\b/gi, '||')
    .replace(/\bNOT\b/gi, '!')
    .replace(/\bMOD\b/gi, '%')
    .replace(/\bDIV\b/gi, '/')
    .replace(/<>/g, '!=')
    .replace(/:=/g, '=')
    .replace(/\bTRUE\b/gi, 'true')
    .replace(/\bFALSE\b/gi, 'false')
    .replace(/(?<![=!<>])=(?![=])/g, '=='); // '=' becomes '==' if not already comparison
    const parts = results.split(" ");
    results = "";
    parts.forEach((e) => {
        if(/^%[IQM]/i.test(e)){
            results += `readAddress("${e}") `;
        }
        else{
            results += e + " ";
        }
    });
    results = results.trim();
    return results;
}

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


export function convertExpression(expr, isjsfb = false, jsfbVars = []) {
  if (Array.isArray(expr)) {
    if (!isjsfb) {
      expr = expr.join(" ");
    } else {
      let jsexpr = "";
      expr.forEach((e) => {
        let ev = e.split(".")[0];
        if (jsfbVars.includes(ev)) {
          ev = "this." + e;
        }
        jsexpr += (jsexpr ? " " : "") + ev;
      });
      expr = jsexpr;//.replace(/([^\s])/g, ' $1 ').replace(/\s+/g, ' ').trim();  // ✨ ensure spacing
    }
  }

  let results = expr
    .replace(/\bAND\b/gi, '&&')
    .replace(/\bOR\b/gi, '||')
    .replace(/\bNOT\b/gi, '!')
    .replace(/\bMOD\b/gi, '%')
    .replace(/\bDIV\b/gi, '/')
    .replace(/<>/g, '!=')
    .replace(/:=/g, '=')
    .replace(/\bTRUE\b/gi, 'true')
    .replace(/\bFALSE\b/gi, 'false')
    .replace(/\b(?<![><!])=(?!=)/g, '==');  // ✅ fix assignment/comparison

    const tokens = results.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '=' &&
        tokens[i - 1] !== '<' &&
        tokens[i - 1] !== '>' &&
        tokens[i - 1] !== '!' &&
        tokens[i + 1] !== '='
    ) {
      tokens[i] = '==';
    }
  }
  results = tokens.join(' ');

  // Replace %I/Q/M references
  const parts = results.split(/\s+/);
  results = parts.map(e => /^%[IQM]\d+(\.\d+)?$/i.test(e) ? getReadAddressExpression(e) : e).join(' ');

  if (results.indexOf("read") === -1) {
    results = results.replace(/\b(?!%)(([A-Za-z_]\w*)\.(\d+))\b/g, (_, full, base, bit) => {
      return `getBit(&${base}, ${bit})`;
    });
  }

  return results;
}


/**
 * 
 * @param {string} addr 
 * @returns 
 */
export function getReadAddressExpression(addr){
  var result = `readDWord("${addr}")`;
  try{
    if(addr.indexOf(".")){
      result = `readBit("${addr}")`;
    }
    else{
      var width = addr.substring(2, 3).toUpperCase();
      switch(width){
        case "X":
          result = `readByte("${addr}")`;
        break;
        case "W":
          `readWord("${addr}")`;
        break;
      }
    }
  }
  catch(e){
    console.error(e);
  }
  return result;
}

export function getWriteAddressExpression(addr, value){
  var result = `writeDWord("${addr}", ${value})`;
  try{
    if(addr.indexOf(".") > -1){
      result = `writeBit("${addr}", ${value})`;
    }
    else{
      var width = addr.substring(2, 3).toUpperCase();
      switch(width){
        case "X":
          result = `writeByte("${addr}", ${value})`;
        break;
        case "W":
          `writeWord("${addr}", ${value})`;
        break;
      }
    }
  }
  catch(e){
    console.error(e);
  }
  return result;
}


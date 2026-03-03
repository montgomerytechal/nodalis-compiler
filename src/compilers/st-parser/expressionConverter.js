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



/**
 * @description Expression Converter
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */

export const StandardFunctions = {
  "ABS": ["IN"],
  "SQRT": ["IN"],
  "LN": ["IN"],
  "LOG": ["IN"],
  "EXP": ["IN"],
  "SIN": ["IN"],
  "COS": ["IN"],
  "TAN": ["IN"],
  "ASIN": ["IN"],
  "ATAN": ["IN"],
  "ADD": ["IN..."],
  "MUL": ["IN..."],
  "SUB": ["IN1", "IN2"],
  "DIV": ["IN1", "IN2"],
  "MOD": ["IN1", "IN2"],
  "EXPT": ["IN1", "IN2"],
  "MOVE": ["IN"],
  "SHL": ["IN", "N"],
  "SHR": ["IN", "N"],
  "ROR": ["IN", "N"],
  "ROL": ["IN", "N"],
  "AND": ["IN..."],
  "OR": ["IN..."],
  "XOR": ["IN..."],
  "NOT": ["IN"],
  "SEL": ["G", "IN0", "IN1"],
  "MAX": ["IN..."],
  "MIN": ["IN..."],
  "LIMIT": ["MN", "IN", "MX"],
  "MUX": ["K", "IN..."],
  "GT": ["IN..."],
  "GE": ["IN..."],
  "EQ": ["IN..."],
  "LE": ["IN..."],
  "LT": ["IN..."],
  "NE": ["IN..."]
};

/**
 * Converts an ST expression to be more understable to JS and C++
 * @param {Array | string} expr An array of tokens or a string representing the expression.
 * @param {boolean} isjsfb Expresses whether this expression is within a JS function block.
 * @param {string[]} jsfbVars An array of variable names defined in the JS function block.
 * @returns {string} Returns a converted expression.
 */
export function convertExpression(expr, isjsfb = false, jsfbVars = [], isjs=false) {
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

  expr = normalizeFormalFunctionCalls(expr);

  let results = expr
    .replace(/\bAND\b/gi, '&')
    .replace(/\bOR\b/gi, '|')
    .replace(/\bXOR\b/gi, '^')
    .replace(/\bNOT\b/gi, '!')
    .replace(/\bMOD\b/gi, '%')
    .replace(/\bDIV\b/gi, '/')
    .replace(/<>/g, '!=')
    .replace(/:=/g, '=')
    .replace(/\bTRUE\b/gi, 'true')
    .replace(/\bFALSE\b/gi, 'false')
    .replace(/\b(?<![><!])=(?!=)/g, '==');  // ✅ fix assignment/comparison

  results = rewriteExponentOperator(results, isjs);

  // JS accepts 0o..., but C++ requires legacy octal form 0...
  if (!isjs) {
    results = results.replace(/\b0o([0-7]+)\b/gi, '0$1');
  }

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
  results = parts.map((e, index, tks) => {
    // Don't touch raw address reads
    if (/^%[IQM][XBWDL]?\d+(\.\d+)?$/i.test(e)) return getReadAddressExpression(e);

    // Don't wrap literals or operators
    if (/^(true|false|null|[+-]?\d+|[+-]?(?:(?:\d+\.\d*|\d*\.\d+)(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+)|0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-f]+|!|&&|\|\||==|!=|>=|<=|>|<|=|\+|-|\*|\/|%|\(|\)|,|&|\||\^)$/i.test(e)) return e;

    // Don't wrap known function expressions (e.g., getBit)
    if (/^getBit\(/.test(e)) return e;

    // Don't wrap dot-bit references already processed
    if (/^&?[A-Za-z_]\w*\.\d+$/.test(e)) return e;
    // token is a function call
    if (tks.length > index && tks[index + 1] === "(") return e;
    // Otherwise, wrap in resolve()
    if(isjs)
      return `resolve(${e})`;
    else return e;
  }).join(' ');
  //if (results.indexOf("read") === -1) {
  results = results.replace(/\b(?<!%)(([A-Za-z_]\w*)\.(\d+))\b/g, (_, full, base, bit) => {
    return `getBit(${isjs ? "" : "&"}${base}, ${bit})`;
    });
  //}
  
  return results;
}

function rewriteExponentOperator(expression, isjs) {
  let result = String(expression || '');
  const operand = String.raw`(?:\([^()]*\)|[A-Za-z_]\w*(?:\.\d+)?|[+-]?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?))`;
  const pattern = new RegExp(`(${operand})\\s*\\*\\*\\s*(${operand})`);
  const replacement = isjs
    ? (_, left, right) => `Math.pow ( ${left} , ${right} )`
    : (_, left, right) => `pow ( ${left} , ${right} )`;

  while (pattern.test(result)) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function normalizeFormalFunctionCalls(expr) {
  if (typeof expr !== 'string' || expr.indexOf('(') === -1) return expr;

  let result = '';
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (isIdentStart(ch)) {
      const start = i;
      i++;
      while (i < expr.length && isIdentPart(expr[i])) i++;
      const fnName = expr.slice(start, i);

      let j = i;
      while (j < expr.length && /\s/.test(expr[j])) j++;

      if (j < expr.length && expr[j] === '(') {
        const end = findMatchingParen(expr, j);
        if (end !== -1) {
          const rawArgs = expr.slice(j + 1, end);
          const normalizedArgs = normalizeFormalFunctionCalls(rawArgs);
          const rewrittenArgs = rewriteCallArguments(fnName, normalizedArgs);
          result += `${fnName} ( ${rewrittenArgs} )`;
          i = end + 1;
          continue;
        }
      }

      result += fnName;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function rewriteCallArguments(fnName, argsText) {
  const args = splitTopLevelArgs(argsText).map((arg) => arg.trim()).filter((arg) => arg.length > 0);
  if (args.length === 0) return '';

  const parsed = args.map(parseNamedArgument);
  const hasNamedArgs = parsed.some((a) => a.kind === 'named');
  if (!hasNamedArgs) return args.join(' , ');

  const positional = parsed
    .filter((a) => a.kind === 'positional')
    .map((a) => a.value);

  const named = parsed.filter((a) => a.kind === 'named');
  const signature = StandardFunctions[String(fnName || '').toUpperCase()];
  if (!signature) {
    return [...positional, ...named.map((a) => a.value)].join(' , ');
  }

  named.sort((a, b) => compareNamedArgsBySignature(a.name, b.name, signature));
  return [...positional, ...named.map((a) => a.value)].join(' , ');
}

function parseNamedArgument(arg) {
  let depth = 0;
  for (let i = 0; i < arg.length - 1; i++) {
    const ch = arg[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ':' && arg[i + 1] === '=' && depth === 0) {
      const name = arg.slice(0, i).trim();
      const value = arg.slice(i + 2).trim();
      if (/^[A-Za-z_]\w*$/.test(name)) {
        return { kind: 'named', name, value };
      }
      break;
    }
  }

  return { kind: 'positional', value: arg };
}

function compareNamedArgsBySignature(leftName, rightName, signature) {
  const left = getParamSortKey(leftName, signature);
  const right = getParamSortKey(rightName, signature);
  if (left.index !== right.index) return left.index - right.index;
  if (left.rank !== right.rank) return left.rank - right.rank;
  return left.name.localeCompare(right.name);
}

function getParamSortKey(paramName, signature) {
  const name = String(paramName || '').toUpperCase();
  for (let i = 0; i < signature.length; i++) {
    const sig = String(signature[i] || '').toUpperCase();
    if (sig.endsWith('...')) {
      const prefix = sig.slice(0, -3);
      if (name.startsWith(prefix)) {
        const suffix = name.slice(prefix.length);
        let numericSuffix = Number.MAX_SAFE_INTEGER;
        if (suffix.length === 0) numericSuffix = 0;
        else if (/^\d+$/.test(suffix)) numericSuffix = Number.parseInt(suffix, 10);
        return { index: i, rank: numericSuffix, name };
      }
      continue;
    }

    if (name === sig) {
      return { index: i, rank: 0, name };
    }
  }

  return { index: signature.length + 1, rank: Number.MAX_SAFE_INTEGER, name };
}

function splitTopLevelArgs(text) {
  const args = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }

  args.push(text.slice(start));
  return args;
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isIdentStart(ch) {
  return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch) {
  return /[A-Za-z0-9_]/.test(ch);
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

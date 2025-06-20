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
 * @description Javascript Transpiler
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */

import { convertExpression, getWriteAddressExpression } from './expressionConverter.js';
let fbVars = [];
let refVars = [];
/**
 * Converts the tokenized ST code to Javascript.
 * @param {{body: {type: string, name: string, varSections: [], statements: []}}[]} ast The tokenized code.
 * @returns {string} The transpiled code.
 */
export function transpile(ast) {
  const lines = [];

  for (const block of ast.body) {
    switch (block.type) {
      case 'GlobalVars':
        lines.push('// Global variable declarations');
        lines.push(...declareVars(block.variables));
        break;

      case 'ProgramDeclaration':
        lines.push(`export function ${block.name}() { // PROGRAM:${block.name}`);
        lines.push(...declareVars(block.varSections),false, block.name);
        lines.push(...transpileStatements(block.statements));
        lines.push('}');
        break;

      case 'FunctionDeclaration':
        lines.push(`export function ${block.name}() { // FUNCTION:${block.name}`);
        lines.push(...declareVars(block.varSections, false, block.name));
        lines.push(...transpileStatements(block.statements));

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`${block.name} =`)) {
            lines[i] = lines[i].replace(`${block.name} =`, 'return');
          }
        }

        lines.push('}');
        break;

      case 'FunctionBlockDeclaration':
        lines.push(`export class ${block.name} { // FUNCTION_BLOCK:${block.name}`);
        lines.push('  constructor() {');
        lines.push(...declareVars(block.varSections, true, block.name).map(line => `    ${line}`));
        lines.push('  }');
        lines.push('  call() {');
        lines.push(...transpileStatements(block.statements, true).map(line => `    ${line}`));
        lines.push('  }');
        lines.push('}');
        break;
    }
  }
  return lines.join('\n');
}

/**
 * Converts a single statement to Javascript
 * @param {{type: string, left: string, right: string, condition:string[], elseIfBlocks: [], elseBlock: [], body: []}} stmt The tokenized statement to convert.
 * @returns {string} the converted statement.
 */
function mapStatement(stmt, infb = false) {
  try {
    switch (stmt.type) {
      case 'ASSIGN': {
        let left = stmt.left;
        var e = left.split(".")[0];
        if(infb && fbVars.includes(e)) {
            left = "this." + left;
        }
            
        const rightExpr = convertExpression(stmt.right, infb, fbVars, true);

        if (isIOAddress(left)) {
          return getWriteAddressExpression(left, rightExpr) + ";";
        } else if (isBitSelector(left)) {
          const [varName, bitIndex] = left.split('.');
          return `setBit(${varName}, ${bitIndex}, ${rightExpr});`;
        }

        return `${left} = ${rightExpr};`;
      }

      case 'IF': {
        const cond = convertExpression(stmt.condition, infb, fbVars,true);
        const lines = [];

        lines.push(`if (${cond}) {`);
        lines.push(...transpileStatements(stmt.thenBlock, infb).map(s => `  ${s}`));
        lines.push(`}`);

        if (stmt.elseIfBlocks?.length) {
          for (const elif of stmt.elseIfBlocks) {
            const elifCond = convertExpression(elif.condition, infb, fbVars,true);
            lines.push(`else if (${elifCond}) {`);
            lines.push(...transpileStatements(elif.block, infb).map(s => `  ${s}`));
            lines.push('}');
          }
        }

        if (stmt.elseBlock?.length) {
          lines.push('else {');
          lines.push(...transpileStatements(stmt.elseBlock, infb).map(s => `  ${s}`));
          lines.push('}');
        }

        return lines;
      }

      case 'WHILE': {
        const cond = convertExpression(stmt.condition, infb, fbVars,true);
        return [
          `while (${cond}) {`,
          ...transpileStatements(stmt.body, infb).map(s => `  ${s}`),
          `}`
        ];
      }

      case 'FOR':
        return [
          `for (let ${stmt.variable} = ${stmt.from}; ${stmt.variable} <= ${stmt.to}; ${stmt.variable} += ${stmt.step}) {`,
          ...transpileStatements(stmt.body, infb).map(s => `  ${s}`),
          `}`
        ];

      case 'REPEAT': {
        const cond = convertExpression(stmt.condition, infb, fbVars,true);
        return [
          `do {`,
          ...transpileStatements(stmt.body, infb).map(s => `  ${s}`),
          `} while (!(${cond}));`
        ];
      }

      case 'CALL':
        let ext = "";
        if(infb && fbVars.includes(stmt.name)){
            ext = "this.";
        }
        return [`${ext}${stmt.name}.call();`];

      default:
        return [`// Unsupported statement type: ${stmt.type}`];
    }
  } catch (e) {
    console.error("Error transpiling statement", stmt, e);
    return [`// Failed to transpile: ${JSON.stringify(stmt)}`];
  }
}

/**
 * Transpiles an array of statements.
 * @param {{type: string, left: string, right: string, condition:string[], elseIfBlocks: [], elseBlock: [], body: []}[]} statements The statements to transpile.
 * @returns {string[]} Returns an array of transpiled statements.
 */
function transpileStatements(statements, infb=false) {
  return statements?.flatMap((stmt) => mapStatement(stmt, infb));
}

/**
 * Creates a transpiled section of declared variables.
 * @param {{type: string, address: string, initialValue: string, sectionType: string}[]} varSections An array of variable tokens.
 * @returns {string[]} An array of declaration statements.
 */
function declareVars(varSections, infb = false, blockName = "") {
  if(infb){
    fbVars = [];
  }
  return varSections.map(v => {
    const isFunctionBlock = !mapType(v.type) || mapType(v.type) === 'any';
    const decl = infb ? "this." : "let ";
    if(infb) fbVars.push(v.name);
    if (v.address) {
      const addr = v.address.startsWith('%') ? v.address : '%' + v.address;
      refVars.push(v.name);
      return `${decl}${v.name} = createReference("${addr}");`;
    }

    const fullVarName = blockName ? `${blockName}.${v.name}` : v.name;

    const initValue = (v.initialValue !== undefined && v.initialValue !== null)
      ? ` = ${v.initialValue}`
      : isFunctionBlock ? ` = newStatic("${fullVarName}", ${v.type})` : infb ? " = null" : "";

    return `${decl}${v.name}${initValue};`;
  });
}

/**
 * Determines whether the expression is an address reference.
 * @param {string} expr The expression to evaluate.
 * @returns Returns true if the expression is an address reference.
 */
function isIOAddress(expr) {
  return typeof expr === 'string' && /^%[IQM]/i.test(expr);
}

/**
 * Determins whether the expression is an address reference with a bit selector.
 * @param {string} expr The expression to evaluate.
 * @returns Returns true if the expression has a bit selector.
 */
function isBitSelector(expr) {
  return typeof expr === 'string' && /^[A-Za-z_]\w*\.\d+$/.test(expr);
}

function mapType(type) {
  const jsTypes = {
    'BOOL': 'boolean',
    'BYTE': 'number',
    'WORD': 'number',
    'DWORD': 'number',
    'LWORD': 'number',
    'SINT': 'number',
    'INT': 'number',
    'DINT': 'number',
    'LINT': 'number',
    'USINT': 'number',
    'UINT': 'number',
    'UDINT': 'number',
    'ULINT': 'number',
    'REAL': 'number',
    'LREAL': 'number',
    'TIME': 'number',
    'DATE': 'string',
    'TIME_OF_DAY': 'string',
    'DATE_AND_TIME': 'string',
    'STRING': 'string',
    'WSTRING': 'string'
  };
  return jsTypes[type?.trim().toUpperCase()] || 'any';
}
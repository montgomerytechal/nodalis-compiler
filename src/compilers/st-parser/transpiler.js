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

import { convertExpression } from './expressionConverter.js';
import { getWriteAddressExpression } from './expressionConverter.js';

export function transpile(ast) {
  const lines = [];

  for (const block of ast.body) {
    switch (block.type) {
      case 'GlobalVars':
        lines.push('// Global variable declarations');
        lines.push(...declareVars(block.variables));
        break;
      case 'ProgramDeclaration':
        lines.push(`void ${block.name}() { //PROGRAM:${block.name}`);
        lines.push(...declareVars(block.varSections));
        lines.push(...transpileStatements(block.statements));
        lines.push('}');
        break;

      case 'FunctionDeclaration':
        lines.push(`${mapType(block.returnType)} ${block.name}() { //FUNCTION:${block.name}`);
        lines.push(...declareVars(block.varSections));
        lines.push(...transpileStatements(block.statements));
        lines.push('}');

        for(var x = 0; x < lines.length; x++){
            var l = lines[x];
            if(l.indexOf(`${block.name} =`) > -1){
                lines[x] = l.replace(`${block.name} =`, "return");
            }
        }

        break;

      case 'FunctionBlockDeclaration':
        lines.push(`class ${block.name} {//FUNCTION_BLOCK:${block.name}`);
        lines.push('public:');
        //for (const v of block.varSections) {
          lines.push(...declareVars(block.varSections));
        //}
        lines.push('  void operator()() {');
        lines.push(...transpileStatements(block.statements).map(line => `    ${line}`));
        lines.push('  }');
        lines.push('};');
        break;
    }
    lines.push('');
  }

  return lines.join('\n');
}

function mapStatement(stmt){
  try{
    switch (stmt.type) {
        case 'ASSIGN': {
          const left = stmt.left;
          const rightExpr = convertExpression(stmt.right);
          if (isIOAddress(left)) {
            return getWriteAddressExpression(left, rightExpr) + ";";
          } else if (isBitSelector(left)) {
            const [varName, bitIndex] = left.split('.');
            return `setBit(&${varName}, ${bitIndex}, ${rightExpr});`;
          }
          return `${left} = ${rightExpr};`;
        }

        case 'IF': {
          const cond = convertExpression(Array.isArray(stmt.condition) ? stmt.condition.join(' ') : stmt.condition);
          const lines = [];

          lines.push(`if (${cond}) {`);
          lines.push(...transpileStatements(stmt.thenBlock).map(s => `  ${s}`));
          lines.push(`}`);

          if (stmt.elseIfBlocks && stmt.elseIfBlocks.length > 0) {
            for (const elif of stmt.elseIfBlocks) {
              const elifCond = convertExpression(Array.isArray(elif.condition) ? elif.condition.join(' ') : elif.condition);
              lines.push(`else if (${elifCond}) {`);
              lines.push(...transpileStatements(elif.block).map(s => `  ${s}`));
              lines.push(`}`);
            }
          }

          if (stmt.elseBlock && stmt.elseBlock.length > 0) {
            lines.push(`else {`);
            lines.push(...transpileStatements(stmt.elseBlock).map(s => `  ${s}`));
            lines.push(`}`);
          }

          return lines;
        }

        case 'WHILE':
          const wcond = convertExpression(Array.isArray(stmt.condition) ? stmt.condition.join(' ') : stmt.condition);
          return [
            `while (${wcond}) {`,
            ...transpileStatements(stmt.body)?.map(s => `  ${s}`),
            `}`
          ];

        case 'FOR':
          return [
            `for (int ${stmt.variable} = ${stmt.start}; ${stmt.variable} <= ${stmt.end}; ${stmt.variable} += ${stmt.step}) {`,
            ...transpileStatements(stmt.body)?.map(s => `  ${s}`),
            `}`
          ];
        case "CALL":
          return [stmt.name + "();"];
        default:
          return [`// unsupported: ${stmt.type}`];
      }
  }
  catch(e){
    console.error(e + "\n" + JSON.stringify(stmt));
  }
  return "// uncompilable statement " + JSON.stringify(stmt);
}

function transpileStatements(statements) {
  return statements?.flatMap(mapStatement);
}


function declareVars(varSections) {
  return varSections.map(v => {
    var cleanedType = v.type.trim().toUpperCase();
    const isFunctionBlockType = !mapType(cleanedType) || mapType(cleanedType) === 'auto';
    let init = "";
    cleanedType = mapType(cleanedType);
    if(v.address){
      cleanedType = "RefVar<" + cleanedType + ">";
      var addr = v.address;
      if(!addr.startsWith("%")) addr = "%" + addr;
      init = `("${addr}")`
    }
    else if (v.initialValue !== undefined && v.initialValue !== null) {
      init = ` = ${v.initialValue}`;
    }
    if (v.sectionType==='VAR' && isFunctionBlockType) {
      return `static ${v.type} ${v.name};`; // assume Function Block type
    }
    return `${cleanedType} ${v.name}${init};`;
  });
}


export function mapType(type) {
  const types = {
    'BOOL': 'bool',
    'BYTE': 'uint8_t',
    'WORD': 'uint16_t',
    'DWORD': 'uint32_t',
    'LWORD': 'uint64_t',
    'SINT': 'int8_t',
    'INT': 'int16_t',
    'DINT': 'int32_t',
    'LINT': 'int64_t',
    'USINT': 'uint8_t',
    'UINT': 'uint16_t',
    'UDINT': 'uint32_t',
    'ULINT': 'uint64_t',
    'REAL': 'float',
    'LREAL': 'double',
    'TIME': 'uint32_t',
    'DATE': 'std::string',
    'TIME_OF_DAY': 'std::string',
    'DATE_AND_TIME': 'std::string',
    'STRING': 'std::string',
    'WSTRING': 'std::wstring'
  };
  return types[type.trim().toUpperCase()] || 'auto';
}

function isBitSelector(expr) {
  return typeof expr === 'string' && /^[A-Za-z_]\w*\.\d+$/.test(expr);
}

function isIOAddress(expr) {
  return typeof expr === 'string' && /^%[IQM]/i.test(expr);
}
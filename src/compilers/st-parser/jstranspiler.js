/* eslint-disable curly */
/* eslint-disable eqeqeq */

import { convertExpression, getWriteAddressExpression } from './expressionConverter.js';
let fbVars = [];
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
        lines.push(...declareVars(block.varSections));
        lines.push(...transpileStatements(block.statements));
        lines.push('}');
        break;

      case 'FunctionDeclaration':
        lines.push(`export function ${block.name}() { // FUNCTION:${block.name}`);
        lines.push(...declareVars(block.varSections));
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
        lines.push(...declareVars(block.varSections, true).map(line => `    ${line}`));
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

function mapStatement(stmt, infb = false) {
  try {
    switch (stmt.type) {
      case 'ASSIGN': {
        let left = stmt.left;
        var e = left.split(".")[0];
        if(infb && fbVars.includes(e)) {
            left = "this." + left;
        }
            
        const rightExpr = convertExpression(stmt.right, infb, fbVars);

        if (isIOAddress(left)) {
          return getWriteAddressExpression(left, rightExpr) + ";";
        } else if (isBitSelector(left)) {
          const [varName, bitIndex] = left.split('.');
          return `setBit(${varName}, ${bitIndex}, ${rightExpr});`;
        }

        return `${left} = ${rightExpr};`;
      }

      case 'IF': {
        const cond = convertExpression(stmt.condition, infb, fbVars);
        const lines = [];

        lines.push(`if (${cond}) {`);
        lines.push(...transpileStatements(stmt.thenBlock, infb).map(s => `  ${s}`));
        lines.push(`}`);

        if (stmt.elseIfBlocks?.length) {
          for (const elif of stmt.elseIfBlocks) {
            const elifCond = convertExpression(elif.condition, infb, fbVars);
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
        const cond = convertExpression(stmt.condition, infb, fbVars);
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
        const cond = convertExpression(stmt.condition, infb, fbVars);
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

function transpileStatements(statements, infb=false) {
  return statements?.flatMap((stmt) => mapStatement(stmt, infb));
}

function declareVars(varSections, infb = false) {
  if(infb){
    fbVars = [];
  }
  return varSections.map(v => {
    const isFunctionBlock = !mapType(v.type) || mapType(v.type) === 'any';
    const decl = infb ? "this." : "let ";
    if(infb) fbVars.push(v.name);
    if (v.address) {
      const addr = v.address.startsWith('%') ? v.address : '%' + v.address;
      return `${decl}${v.name} = new RefVar("${addr}");`;
    }

    const initValue = (v.initialValue !== undefined && v.initialValue !== null)
      ? ` = ${v.initialValue}`
      : isFunctionBlock ? ` = new ${v.type}()` : infb ? " = null" : "";

    return `${decl}${v.name}${initValue};`;
  });
}

function isIOAddress(expr) {
  return typeof expr === 'string' && /^%[IQM]/i.test(expr);
}

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
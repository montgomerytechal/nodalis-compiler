// --- transpiler.js ---

import { convertExpression } from './expressionConverter.js';

export function transpile(ast) {
  const lines = [];

  for (const block of ast.body) {
    switch (block.type) {
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
        for (const v of block.varSections) {
          lines.push(`  ${mapType(v.type)} ${v.name};`);
        }
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

function transpileStatements(statements) {
  return statements?.flatMap(stmt => {
    switch (stmt.type) {
      case 'ASSIGN':
        let left = stmt.left;
        let right = convertExpression(stmt.right.join(" "));
        if(/^%[IQM]/i.test(left)){
            return `writeAddress("${left}", ${right})`;
        }
        else{
            return `${left} = ${right};`;
        }

      case 'IF':
        return [
          `if (${convertExpression(stmt.condition)}) {`,
          ...transpileStatements(stmt.thenBranch)?.map(s => `  ${s}`),
          `} else {`,
          ...transpileStatements(stmt.elseBranch)?.map(s => `  ${s}`),
          `}`
        ];

      case 'WHILE':
        return [
          `while (${convertExpression(stmt.condition)}) {`,
          ...transpileStatements(stmt.body)?.map(s => `  ${s}`),
          `}`
        ];

      case 'FOR':
        return [
          `for (int ${stmt.variable} = ${stmt.start}; ${stmt.variable} <= ${stmt.end}; ${stmt.variable} += ${stmt.step}) {`,
          ...transpileStatements(stmt.body)?.map(s => `  ${s}`),
          `}`
        ];

      default:
        return [`// unsupported: ${stmt.type}`];
    }
  });
}

function declareVars(varSections) {
  return varSections.map(v => `${mapType(v.type)} ${v.name};`);
}

function mapType(type) {
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
  return types[type.toUpperCase()] || 'auto';
}

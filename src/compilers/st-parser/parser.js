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

import { tokenize } from './tokenizer.js';
import {mapType} from "./gcctranspiler.js";

export function parseStructuredText(code) {
  const tokens = tokenize(code);
  let position = 0;

  function peek(offset = 0) {
    return tokens[position + offset];
  }

  function consume() {
    return tokens[position++];
  }

  function expect(value) {
    const token = consume();
    if (!token || token.value.toUpperCase() !== value.toUpperCase()) {
      throw new Error(`Expected '${value}', but got '${token?.value}'`);
    }
    return token;
  }

  function parseBlock() {
    const token = peek();
    if (!token) return null;

    switch (token.value.toUpperCase()) {
      case 'PROGRAM':
        return parseProgram();
      case 'FUNCTION':
        return parseFunction();
      case 'FUNCTION_BLOCK':
        return parseFunctionBlock();
      case 'VAR_GLOBAL':
        return parseGlobalVarSection();
      default:
        consume();
        return null;
    }
  }

  function parseGlobalVarSection() {
    expect('VAR_GLOBAL');
    const variables = [];

    while (peek() && peek().value.toUpperCase() !== 'END_VAR') {
      const name = consume().value;
      let address = null;
      let token = peek();
      if (peek()?.value.toUpperCase?.() === 'AT') {
        consume(); // skip 'AT'
        const addrToken = consume();
        if (addrToken?.type === 'ADDRESS' || addrToken?.type === 'IDENTIFIER') {
          address = addrToken.value;
        } else {
          throw new Error(`Expected address after AT, got '${addrToken?.value}'`);
        }
      }
      expect(':');
      const type = consume().value;
      let initialValue = null;

      if (peek()?.value === ':=') {
        consume(); // consume ':='
        initialValue = consume().value;
      }
      variables.push({ name, type, address, initialValue, sectionType: 'VAR_GLOBAL' });
      if (peek()?.value === ';') consume();
    }

    expect('END_VAR');
    return { type: 'GlobalVars', variables };
  }


  function parseVarSection() {
    const variables = [];
    const sectionType = consume().value.toUpperCase();

    while (peek() && peek().value.toUpperCase() !== 'END_VAR') {
      const name = consume().value;
      expect(':');
      const type = consume().value;
      let initialValue = null;

      if (peek()?.value === ':=') {
        consume(); // consume ':='
        initialValue = consume().value;
      }
      variables.push({ name, type, initialValue, sectionType });
      if (peek()?.value === ';') consume();
    }
    expect('END_VAR');
    return variables;
  }

  function parseStatements(until) {
    const statements = [];
    while (peek() && peek().value.toUpperCase() !== until) {
      const stmt = parseStatement();
      if (stmt) statements.push(stmt);
    }
    return statements;
  }

function parseStatement() {
  const token = peek();
  if (!token) return null;

  if (token.value.toUpperCase() === 'IF') return parseIf();
  if (token.value.toUpperCase() === 'WHILE') return parseWhile();
  if (token.value.toUpperCase() === 'FOR') return parseFor();
  if (token.value.toUpperCase() === 'REPEAT') return parseRepeat();
  if (token.value.toUpperCase() === 'CASE') return parseCase();

  // Assignment: x := y;
  const lhsTokens = [];
let i = 0;
while (peek(i) && peek(i).value !== ':=' && peek(i).value !== ';') {
  lhsTokens.push(peek(i));
  i++;
}
if (peek(i)?.value === ':=') {
  const lhs = lhsTokens.map(t => t.value).join('');
  for (let j = 0; j < i + 1; j++) consume(); // consume LHS and :=

  const right = [];
  while (peek() && peek().value !== ';') {
    right.push(consume().value);
  }
  if (peek()?.value === ';') consume();
  return { type: 'ASSIGN', left: lhs, right };
}

  // Function block call like: T1();
  if (token.value && peek(1)?.value === '(' && peek(2)?.value === ')') {
    const name = consume().value;
    consume(); // (
    consume(); // )
    if (peek()?.value === ';') consume();
    return { type: 'CALL', name };
  }

  consume(); // Skip unknown
  return null;
}


function parseIf() {
  consume(); // IF

  // Collect condition tokens until THEN
  const conditionTokens = [];
  while (peek() && peek().value.toUpperCase() !== 'THEN') {
    conditionTokens.push(consume().value);
  }
  consume(); // THEN

  const thenBlock = parseStatementsUntil(['ELSIF', 'ELSE', 'END_IF']);
  const elseIfBlocks = [];
  let elseBlock = null;

  while (peek()?.value.toUpperCase() === 'ELSIF') {
    consume(); // ELSIF
    const elifCondTokens = [];
    while (peek() && peek().value.toUpperCase() !== 'THEN') {
      elifCondTokens.push(consume().value);
    }
    consume(); // THEN
    const elifBlock = parseStatementsUntil(['ELSIF', 'ELSE', 'END_IF']);
    elseIfBlocks.push({ condition: elifCondTokens, block: elifBlock });
  }

  if (peek()?.value.toUpperCase() === 'ELSE') {
    consume(); // ELSE
    elseBlock = parseStatementsUntil(['END_IF']);
  }

  if (peek()?.value.toUpperCase() === 'END_IF') {
    consume(); // END_IF
  }

  return {
    type: 'IF',
    condition: conditionTokens,
    thenBlock,
    elseIfBlocks,
    elseBlock
  };
}


function parseStatementsUntil(endTokens) {
  const statements = [];
  while (peek() && !endTokens.includes(peek().value.toUpperCase())) {
    const stmt = parseStatement();
    if (stmt) {
      statements.push(stmt);
    } else {
      console.warn('⚠️ Unrecognized statement at token:', peek());
      consume(); // prevent infinite loop
    }
  }
  return statements;
}


  function parseWhile() {
    consume(); // WHILE
    const condition = [];
    while (peek() && peek().value.toUpperCase() !== 'DO') {
      condition.push(consume().value);
    }
    expect('DO');
    const body = parseStatements('END_WHILE');
    expect('END_WHILE');
    return { type: 'WHILE', condition, body };
  }

  function parseFor() {
    consume(); // FOR
    const variable = consume().value;
    expect(':=');
    const from = consume().value;
    expect('TO');
    const to = consume().value;
    let step = '1';
    if (peek()?.value.toUpperCase() === 'BY') {
      consume();
      step = consume().value;
    }
    expect('DO');
    const body = parseStatements('END_FOR');
    expect('END_FOR');
    return { type: 'FOR', variable, from, to, step, body };
  }

  function parseRepeat() {
    consume(); // REPEAT
    const body = parseStatements('UNTIL');
    expect('UNTIL');
    const condition = [];
    while (peek() && peek().value !== ';') {
      condition.push(consume().value);
    }
    if (peek()?.value === ';') consume();
    return { type: 'REPEAT', condition, body };
  }

  function parseCase() {
    consume(); // CASE
    const expression = [];
    while (peek() && peek().value.toUpperCase() !== 'OF') {
      expression.push(consume().value);
    }
    expect('OF');
    const branches = [];
    while (peek() && peek().value.toUpperCase() !== 'END_CASE') {
      const label = consume().value;
      expect(':');
      const body = parseStatements('ELSE');
      branches.push({ label, body });
    }
    expect('END_CASE');
    return { type: 'CASE', expression, branches };
  }

  function parseProgram() {
    expect('PROGRAM');
    const name = consume().value;
    const vars = [];
    const stmts = [];

    while (peek() && peek().value.toUpperCase().startsWith('VAR')) {
      vars.push(...parseVarSection());
    }
    vars.forEach((v) => {
      if(mapType(v.type) === "auto"){
        stmts.push({type: "CALL", name: v.name});
      }
    });
    stmts.push(...parseStatements('END_PROGRAM'));
    expect('END_PROGRAM');

    return { type: 'ProgramDeclaration', name, varSections: vars, statements: stmts };
  }

  function parseFunction() {
    expect('FUNCTION');
    const name = consume().value;
    expect(':');
    const returnType = consume().value;
    const vars = [];
    const stmts = [];

    while (peek() && peek().value.toUpperCase().startsWith('VAR')) {
      vars.push(...parseVarSection());
    }
    vars.forEach((v) => {
      if(mapType(v.type) === "auto"){
        stmts.push({type: "CALL", name: v.name});
      }
    });
    stmts.push(...parseStatements('END_FUNCTION'));
    expect('END_FUNCTION');

    return { type: 'FunctionDeclaration', name, returnType, varSections: vars, statements: stmts };
  }

  function parseFunctionBlock() {
    expect('FUNCTION_BLOCK');
    const name = consume().value;
    const vars = [];
    const stmts = [];

    while (peek() && peek().value.toUpperCase().startsWith('VAR')) {
      vars.push(...parseVarSection());
    }
    vars.forEach((v) => {
      if(mapType(v.type) === "auto"){
        stmts.push({type: "CALL", name: v.name});
      }
    });
    stmts.push(...parseStatements('END_FUNCTION_BLOCK'));
    expect('END_FUNCTION_BLOCK');

    return { type: 'FunctionBlockDeclaration', name, varSections: vars, statements: stmts };
  }

  const body = [];
  while (position < tokens.length) {
    const block = parseBlock();
    if (block) body.push(block);
  }

  return { type: 'Program', body };
}
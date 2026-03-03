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
 * @description Structured Text Parser
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */

import { tokenize } from './tokenizer.js';

/**
 * Parses a block of structured text code and divides it into statement objects that can then be transpiled.
 * @param {string} code A block of Structured Text Code
 * @returns {[]} An array of tokenized and parsed statements.
 */
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
        const initTokens = [];
        while (peek() && peek().value !== ';' && peek().value.toUpperCase() !== 'END_VAR') {
          initTokens.push(consume().value);
        }
        initialValue = initTokens.join('');
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
        const initTokens = [];
        while (peek() && peek().value !== ';' && peek().value.toUpperCase() !== 'END_VAR') {
          initTokens.push(consume().value);
        }
        initialValue = initTokens.join('');
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

  // Call statement like: Foo(...);
  if (token.type === 'IDENTIFIER' && peek(1)?.value === '(') {
    const name = consume().value; // IDENTIFIER
    consume(); // '('

    const args = [];
    let depth = 1;

    while (peek() && depth > 0) {
      const t = consume();

      if (t.value === '(') depth++;
      else if (t.value === ')') depth--;

      if (depth > 0) args.push(t.value); // don't include final ')'
    }

    // optional semicolon
    if (peek()?.value === ';') consume();

    return { type: 'CALL', name, args };
  }

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
    const startPos = position;
    const stmt = parseStatement();
    if (stmt) {
      statements.push(stmt);
    } else if (position === startPos) {
      // Prevent infinite loops if a branch returns null without consuming.
      consume();
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
    while (peek() && peek().value.toUpperCase() !== 'END_REPEAT') {
      condition.push(consume().value);
    }
    expect('END_REPEAT');
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
    while (peek() && !['ELSE', 'END_CASE'].includes(peek().value.toUpperCase())) {
      const labels = [];
      while (peek() && peek().value !== ':') {
        const tk = consume().value;
        if (tk !== ',') labels.push(tk);
      }
      expect(':');
      const body = [];
      while (peek() && !isCaseBranchBoundary(peek())) {
        const stmt = parseStatement();
        if (stmt) body.push(stmt);
      }
      branches.push({ label: labels.join(','), body });
    }
    let elseBlock = null;
    if (peek()?.value.toUpperCase() === 'ELSE') {
      consume(); // ELSE
      elseBlock = [];
      while (peek() && peek().value.toUpperCase() !== 'END_CASE') {
        const stmt = parseStatement();
        if (stmt) elseBlock.push(stmt);
      }
    }
    expect('END_CASE');
    return { type: 'CASE', expression, branches, elseBlock };
  }

  function isCaseBranchBoundary(token) {
    if (!token) return true;
    const upper = token.value.toUpperCase();
    if (upper === 'ELSE' || upper === 'END_CASE') return true;
    return peek(1)?.value === ':' || peek(1)?.value === ',';
  }

  function parseProgram() {
    expect('PROGRAM');
    const name = consume().value;
    const vars = [];
    const stmts = [];

    while (peek() && peek().value.toUpperCase().startsWith('VAR')) {
      vars.push(...parseVarSection());
    }

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

// --- parser.js ---

import { tokenize } from './tokenizer.js';

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
      default:
        consume();
        return null;
    }
  }

  function parseVarSection() {
    const variables = [];
    const sectionType = consume().value.toUpperCase();

    while (peek() && peek().value.toUpperCase() !== 'END_VAR') {
      const name = consume().value;
      expect(':');
      const type = consume().value;
      variables.push({ name, type, sectionType });
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

    const upper = token.value.toUpperCase();
    if (upper === 'IF') return parseIf();
    if (upper === 'WHILE') return parseWhile();
    if (upper === 'FOR') return parseFor();
    if (upper === 'REPEAT') return parseRepeat();
    if (upper === 'CASE') return parseCase();

    const col = peek(1);
    const eq = peek(2);
    if (col?.value === ':' && eq?.value === '=') {
      const left = consume().value;
      consume();
      consume();
      const right = [];
      while (peek() && peek().value !== ';') {
        right.push(consume().value);
      }
      if (peek()?.value === ';') consume();
      return { type: 'ASSIGN', left, right };
    }

    // Function call
    if (peek(1)?.value === '(') {
      const name = consume().value;
      consume(); // (
      const args = [];
      while (peek() && peek().value !== ')') {
        args.push(consume().value);
        if (peek()?.value === ',') consume();
      }
      consume(); // )
      if (peek()?.value === ';') consume();
      return { type: 'CALL', name, args };
    }

    consume();
    return null;
  }

  function parseIf() {
    consume(); // IF
    const condition = consume().value;
    consume(); // THEN
    const thenBlock = parseBlock(['ELSIF', 'ELSE', 'END_IF']);
    const elseIfBlocks = [];
    let elseBlock = null;

    while (peek().value.toUpperCase() === 'ELSIF') {
      consume(); // ELSIF
      const elifCond = consume().value;
      consume(); // THEN
      const elifBlock = parseBlock(['ELSIF', 'ELSE', 'END_IF']);
      elseIfBlocks.push({ condition: elifCond, block: elifBlock });
    }

    if (peek().value.toUpperCase() === 'ELSE') {
      consume();
      elseBlock = parseBlock(['END_IF']);
    }

    return { type: 'IF', condition, thenBlock, elseIfBlocks, elseBlock };
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
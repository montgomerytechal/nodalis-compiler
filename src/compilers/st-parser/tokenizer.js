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
 * @description Structured Text Tokenizer
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */

/**
 * Tokenizes a block of structured text into their types and values.
 * @param {string} code A block of structured text code.
 * @returns {{type: string, value: string}[]} An array of tokens.
 */
const INTEGER_TYPE_PATTERN = '(?:BYTE|WORD|DWORD|LWORD|SINT|INT|DINT|LINT|USINT|UINT|UDINT|ULINT)';
const REAL_TYPE_PATTERN = '(?:REAL|LREAL)';
const REAL_LITERAL_PATTERN = '(?:(?:\\d+\\.\\d*|\\d*\\.\\d+)(?:[eE][+-]?\\d+)?|\\d+[eE][+-]?\\d+)';
const TYPED_INTEGER_LITERAL_PATTERN = `(?:${INTEGER_TYPE_PATTERN}#(?:2#[01_]+|8#[0-7_]+|16#[0-9a-f_]+|[+-]?\\d+))`;
const TYPED_REAL_LITERAL_PATTERN = `(?:${REAL_TYPE_PATTERN}#[+-]?(?:${REAL_LITERAL_PATTERN}|\\d+))`;
const UNTYPED_LITERAL_PATTERN = `(?:2#[01_]+|8#[0-7_]+|16#[0-9a-f_]+|${REAL_LITERAL_PATTERN}|\\d+)`;
const NUMBER_TOKEN_PATTERN = `(?:${TYPED_INTEGER_LITERAL_PATTERN}|${TYPED_REAL_LITERAL_PATTERN}|${UNTYPED_LITERAL_PATTERN})`;

export function tokenize(code) {
  const tokens = [];
  let match;
  // Remove single-line comments (//...)
  code = code.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments ((*...*))
  code = code.replace(/\(\*[\s\S]*?\*\)/g, '');

  //const regex = /(%[IQM][A-Z]?[0-9]+(?:\.[0-9]+)?)|(:=)|([A-Za-z_]\w*\.\d+)|([A-Za-z_]\w*\.\w+)|([A-Za-z_]\w*)|(\d+)|([:;()<>+\-*/=])/g;
  const regex = new RegExp(`(%[IQM][A-Z]*\\d+(?:\\.\\d+)?)|(:=|=>|>=|<=|<>|!=)|([A-Za-z_]\\w*\\.\\d+)|([A-Za-z_]\\w*\\.\\w+)|(${NUMBER_TOKEN_PATTERN})|([A-Za-z_]\\w*)|([<>+\\-*/=;():,])`, 'gi');

while ((match = regex.exec(code)) !== null) {
  const [_, address, compoundSymbol, bitIdentifier, propIdentifier, number, identifier, symbol] = match;

  if (address) 
    tokens.push({ type: 'ADDRESS', value: address });
  else if (compoundSymbol)
    tokens.push({ type: 'SYMBOL', value: compoundSymbol });
  else if (bitIdentifier)
    tokens.push({ type: 'IDENTIFIER', value: bitIdentifier });
  else if (propIdentifier)
    tokens.push({ type: 'IDENTIFIER', value: propIdentifier });
  else if (identifier)
    tokens.push({ type: 'IDENTIFIER', value: identifier });
  else if (number)
    tokens.push({ type: 'NUMBER', value: normalizeNumericLiteral(number) });
  else if (symbol)
    tokens.push({ type: 'SYMBOL', value: symbol });

  }
  return tokens;
}

function normalizeNumericLiteral(value) {
  const typedValue = String(value).replace(
    new RegExp(`^(?:${INTEGER_TYPE_PATTERN}|${REAL_TYPE_PATTERN})#`, 'i'),
    ''
  );

  const match = typedValue.match(/^(2|8|16)#([0-9a-f_]+)$/i);
  if (!match) return typedValue;
  const radix = match[1];
  const digits = match[2].replace(/_/g, '');
  if (radix === '2') return `0b${digits}`;
  if (radix === '8') return `0o${digits}`;
  return `0x${digits}`;
}

function getTokenType(value) {
  const keywords = new Set([
    'PROGRAM', 'FUNCTION_BLOCK', 'FUNCTION', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR', 'END_VAR',
    'END_FUNCTION_BLOCK', 'END_FUNCTION', 'END_PROGRAM'
  ]);

  const symbols = new Set([':=', '=>', ';', ':', '(', ')', '+', '-', '*', '/', '>', '<', '=']);

  if (keywords.has(value.toUpperCase())) return 'KEYWORD';
  if (symbols.has(value)) return 'SYMBOL';
  if (new RegExp(`^${NUMBER_TOKEN_PATTERN}$`, 'i').test(value)) return 'NUMBER';
  if (/^[A-Za-z_]\w*$|(%[IQM][\d.]+)/.test(value)) return 'IDENTIFIER';

  return 'UNKNOWN';
}

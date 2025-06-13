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

export function tokenize(code) {
  const tokens = [];
  let match;
  //const regex = /(%[IQM][A-Z]?[0-9]+(?:\.[0-9]+)?)|(:=)|([A-Za-z_]\w*\.\d+)|([A-Za-z_]\w*\.\w+)|([A-Za-z_]\w*)|(\d+)|([:;()<>+\-*/=])/g;
  const regex = /(%[IQM][A-Z]*\d+(?:\.\d+)?)|(:=|>=|<=|<>|!=)|([A-Za-z_]\w*\.\d+)|([A-Za-z_]\w*\.\w+)|([A-Za-z_]\w*)|(\d+)|([<>+\-*/=;():])/g;

while ((match = regex.exec(code)) !== null) {
  const [_, address, compoundSymbol, bitIdentifier, propIdentifier, identifier, number, symbol] = match;

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
    tokens.push({ type: 'NUMBER', value: number });
  else if (symbol)
    tokens.push({ type: 'SYMBOL', value: symbol });

  }
  return tokens;
}

function getTokenType(value) {
  const keywords = new Set([
    'PROGRAM', 'FUNCTION_BLOCK', 'FUNCTION', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR', 'END_VAR',
    'END_FUNCTION_BLOCK', 'END_FUNCTION', 'END_PROGRAM'
  ]);

  const symbols = new Set([':=', ';', ':', '(', ')', '+', '-', '*', '/', '>', '<', '=']);

  if (keywords.has(value.toUpperCase())) return 'KEYWORD';
  if (symbols.has(value)) return 'SYMBOL';
  if (/^\d+$/.test(value)) return 'NUMBER';
  if (/^[A-Za-z_]\w*$|(%[IQM][\d.]+)/.test(value)) return 'IDENTIFIER';

  return 'UNKNOWN';
}


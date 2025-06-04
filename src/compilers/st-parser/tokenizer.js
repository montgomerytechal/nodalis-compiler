
// --- tokenizer.js ---

export function tokenize(code) {
  const tokens = [];

  const regex = /\b(?:PROGRAM|FUNCTION_BLOCK|FUNCTION|VAR_INPUT|VAR_OUTPUT|VAR|END_VAR|END_FUNCTION_BLOCK|END_FUNCTION|END_PROGRAM|:=|\b[A-Za-z_]\w*\b|\d+|;|:|\(|\)|\+|\-|\*|\/|\>|\<|\=)\b|[^\s]/gi;

  let match;
  while ((match = regex.exec(code)) !== null) {
    const value = match[0];
    if (value.trim()) {
      tokens.push({ type: getTokenType(value), value });
    }
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
  if (/^[A-Za-z_]\w*$/.test(value)) return 'IDENTIFIER';

  return 'UNKNOWN';
}


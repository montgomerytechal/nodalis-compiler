import assert from 'assert';
import { parseStructuredText } from '../../src/compilers/st-parser/parser.js';
import { transpile } from '../../src/compilers/st-parser/jstranspiler.js';
import { transpile as transpileCpp } from '../../src/compilers/st-parser/gcctranspiler.js';

const source = `
PROGRAM Test
VAR
  litVar6 : BYTE;
  TmpVar1 : DINT;
  bTmpVar1 : BOOL;
  iI : INT;
  bTmpVar3 : BOOL;
END_VAR

litVar6 := BYTE#01;
TmpVar1 := DINT#3 MOD DINT#2;
bTmpVar1 := DINT#2 <= DINT#2;
REPEAT
  iI := iI + 1;
  bTmpVar3 := NOT bTmpVar3;
UNTIL iI = 10
END_REPEAT;
END_PROGRAM
`;

const output = transpile(parseStructuredText(source));

assert.match(output, /litVar6 = 1;/);
assert.match(output, /TmpVar1 = 3 % 2;/);
assert.doesNotMatch(output, /resolve\(%\)/);
assert.match(output, /bTmpVar1 = 2 <= 2;/);
assert.doesNotMatch(output, /resolve\(<=\)|resolve\(>=\)/);
assert.match(output, /\} while \(!\(resolve\(iI\) == 10\)\);/);
assert.doesNotMatch(output, /END_REPEAT/);
assert.match(
  transpile(parseStructuredText(`
PROGRAM ExitJs
VAR
  i : INT;
END_VAR
FOR i := 0 TO 10 DO
  EXIT;
END_FOR;
END_PROGRAM
`)),
  /break;/
);

assert.match(
  transpileCpp(parseStructuredText(`
PROGRAM ExitCpp
VAR
  i : INT;
END_VAR
FOR i := 0 TO 10 DO
  EXIT;
END_FOR;
END_PROGRAM
`)),
  /break;/
);

assert.match(
  transpile(parseStructuredText(`
PROGRAM CaseJs
VAR
  i : INT;
END_VAR
CASE i OF
  1, 2: i := 3;
  ELSE
    i := 4;
END_CASE;
END_PROGRAM
`)),
  /else if|if \(resolve\(i\) == 1 \|\| resolve\(i\) == 2\)/
);

assert.match(
  transpileCpp(parseStructuredText(`
PROGRAM RepeatCpp
VAR
  i : INT;
END_VAR
REPEAT
  i := i + 1;
UNTIL i = 10
END_REPEAT;
END_PROGRAM
`)),
  /do \{[\s\S]*\} while \(!\(i == 10\)\);/
);

assert.match(
  transpileCpp(parseStructuredText(`
PROGRAM DefaultInitCpp
VAR
  flag : BOOL;
  count : INT;
END_VAR
flag := NOT flag;
END_PROGRAM
`)),
  /bool flag\{\};[\s\S]*int16_t count\{\};[\s\S]*flag = ! flag;/
);

assert.match(
  transpileCpp(parseStructuredText(`
PROGRAM NumericNotCpp
VAR
  value : LWORD;
END_VAR
value := LWORD#8 AND NOT LWORD#0;
END_PROGRAM
`)),
  /value = 8 & ~0;/
);

console.log('ST parser/transpiler regression checks passed.');

assert.throws(
  () => parseStructuredText(`
PROGRAM Broken
VAR
  Value BOOL;
END_VAR
END_PROGRAM
`),
  (err) => {
    assert.match(err.message, /line 4, column 9/);
    assert.match(err.message, /Expected ':'/);
    return true;
  }
);

console.log('Line-aware error reporting regression checks passed.');

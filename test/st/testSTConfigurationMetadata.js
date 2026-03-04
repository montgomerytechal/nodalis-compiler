import assert from 'assert';
import { parseStructuredText, buildCompilerMetadataDirectives } from '../../src/compilers/st-parser/parser.js';
import { transpile } from '../../src/compilers/st-parser/jstranspiler.js';

const source = `
CONFIGURATION Cfg
RESOURCE Res1 ON PLC
TASK MainTask (INTERVAL := T#10ms, PRIORITY := 1);
PROGRAM mainProg WITH MainTask : Main;
END_RESOURCE
END_CONFIGURATION

PROGRAM Main
VAR
  counter : INT;
END_VAR
counter := counter + 1;
END_PROGRAM
`;

const ast = parseStructuredText(source);
const directives = buildCompilerMetadataDirectives(ast);
const output = transpile(ast);

assert.match(directives, /\/\/Task=\{"Name":"MainTask", "Interval":"10", "Priority":"1"\}/);
assert.match(directives, /\/\/Instance=\{"TypeName":"Main", "Name":"mainProg", "AssociatedTaskName":"MainTask"\}/);
assert.match(output, /export function Main\(\) \{ \/\/ PROGRAM:Main/);

console.log('ST configuration/resource task metadata checks passed.');

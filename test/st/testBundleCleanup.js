import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JSCompiler } from '../../src/compilers/JSCompiler.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nodalis-bundle-cleanup-'));
const sourceDir = path.join(tempRoot, 'src');
const outputDir = path.join(tempRoot, 'out');

fs.mkdirSync(sourceDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(path.join(sourceDir, 'Helper.st'), `
FUNCTION_BLOCK Helper
VAR
  Flag : BOOL;
END_VAR
END_FUNCTION_BLOCK
`.trim());

fs.writeFileSync(path.join(sourceDir, 'T_MAIN.st'), `
PROGRAM T_MAIN
VAR
  value : INT;
END_VAR
value := 1;
END_PROGRAM
`.trim());

fs.writeFileSync(path.join(sourceDir, 'nodalisplc.st'), `
PROGRAM STALE
VAR
  value : INT;
END_VAR
value := 999;
END_PROGRAM
`.trim());

const compiler = new JSCompiler({
  sourcePath: sourceDir,
  outputPath: outputDir,
  target: 'jint',
  outputType: 'code',
  language: 'ST',
  resourceName: 'T_MAIN'
});

await compiler.compile();

assert.ok(!fs.existsSync(path.join(sourceDir, 'nodalisplc.st')));

const bundledSt = fs.readFileSync(path.join(outputDir, 'nodalisplc.st'), 'utf-8');
assert.match(bundledSt, /PROGRAM T_MAIN/);
assert.match(bundledSt, /FUNCTION_BLOCK Helper/);
assert.doesNotMatch(bundledSt, /PROGRAM STALE/);

console.log('Bundle cleanup regression checks passed.');

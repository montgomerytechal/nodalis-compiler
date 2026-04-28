import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CPPCompiler } from '../../src/compilers/CPPCompiler.js';

async function compileBundle(sourceDir, outputDir, resourceName = 'T_MAIN') {
  const compiler = new CPPCompiler({
    sourcePath: sourceDir,
    outputPath: outputDir,
    target: 'linux-x64',
    outputType: 'code',
    language: 'ST',
    resourceName
  });

  await compiler.compile();
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nodalis-cpp-bundle-exports-'));

const customSourceDir = path.join(tempRoot, 'custom-src');
const customOutputDir = path.join(tempRoot, 'custom-out');
fs.mkdirSync(customSourceDir, { recursive: true });
fs.mkdirSync(customOutputDir, { recursive: true });

fs.writeFileSync(path.join(customSourceDir, 'T_MAIN.st'), `
PROGRAM T_MAIN
VAR
  passed : BOOL;
  count : INT;
END_VAR
passed := TRUE;
count := 42;
END_PROGRAM
`.trim());

fs.writeFileSync(path.join(customSourceDir, 'exports.json'), JSON.stringify({
  T_MAIN: [
    { global: 'ConformityPassed', address: '%MX0.0', variable: 'passed' },
    { global: 'CycleCount', type: 'INT', address: '%MW1', variable: 'count' }
  ],
  OTHER: [
    { global: 'OtherResult', address: '%MX0.1', variable: 'otherPassed' }
  ]
}, null, 4));

await compileBundle(customSourceDir, customOutputDir);

const customBundledSt = fs.readFileSync(path.join(customOutputDir, 'nodalisplc.st'), 'utf-8');
assert.match(customBundledSt, /^VAR_GLOBAL\n\s+ConformityPassed AT %MX0\.0 : BOOL;\n\/\/Global=\{"Name":"ConformityPassed","Address":"%MX0\.0"\}\n\s+CycleCount AT %MW1 : INT;\n\/\/Global=\{"Name":"CycleCount","Address":"%MW1"\}\nEND_VAR/);
assert.match(customBundledSt, /count := 42;\nConformityPassed := passed;\nCycleCount := count;\nEND_PROGRAM/);
assert.doesNotMatch(customBundledSt, /OtherResult/);

const customCpp = fs.readFileSync(path.join(customOutputDir, 'T_MAIN.cpp'), 'utf-8');
assert.match(customCpp, /opcServer\.mapVariable\("ConformityPassed", "%MX0\.0"\);/);
assert.match(customCpp, /opcServer\.mapVariable\("CycleCount", "%MW1"\);/);

const mismatchSourceDir = path.join(tempRoot, 'mismatch-src');
const mismatchOutputDir = path.join(tempRoot, 'mismatch-out');
fs.mkdirSync(mismatchSourceDir, { recursive: true });
fs.mkdirSync(mismatchOutputDir, { recursive: true });

fs.writeFileSync(path.join(mismatchSourceDir, 'OTHER.st'), `
PROGRAM OTHER
VAR
  otherPassed : BOOL;
END_VAR
otherPassed := TRUE;
END_PROGRAM
`.trim());

fs.writeFileSync(path.join(mismatchSourceDir, 'exports.json'), JSON.stringify({
  T_MAIN: [
    { global: 'Result', address: '%MX0.0', variable: 'bResult' }
  ]
}, null, 4));

await compileBundle(mismatchSourceDir, mismatchOutputDir, 'OTHER');

const mismatchBundledSt = fs.readFileSync(path.join(mismatchOutputDir, 'nodalisplc.st'), 'utf-8');
assert.doesNotMatch(mismatchBundledSt, /VAR_GLOBAL/);
assert.doesNotMatch(mismatchBundledSt, /Result := bResult/);

const mismatchCpp = fs.readFileSync(path.join(mismatchOutputDir, 'OTHER.cpp'), 'utf-8');
assert.doesNotMatch(mismatchCpp, /opcServer\.mapVariable\("Result"/);

const defaultSourceDir = path.join(tempRoot, 'default-src');
const defaultOutputDir = path.join(tempRoot, 'default-out');
fs.mkdirSync(defaultSourceDir, { recursive: true });
fs.mkdirSync(defaultOutputDir, { recursive: true });

fs.writeFileSync(path.join(defaultSourceDir, 'T_MAIN.st'), `
PROGRAM T_MAIN
VAR
  bResult : BOOL;
END_VAR
bResult := TRUE;
END_PROGRAM
`.trim());

await compileBundle(defaultSourceDir, defaultOutputDir);

const defaultExports = JSON.parse(fs.readFileSync(path.join(defaultSourceDir, 'exports.json'), 'utf-8'));
assert.deepStrictEqual(defaultExports, {
  T_MAIN: [{ global: 'Result', type: 'BOOL', address: '%MX0.0', variable: 'bResult' }]
});

const defaultBundledSt = fs.readFileSync(path.join(defaultOutputDir, 'nodalisplc.st'), 'utf-8');
assert.match(defaultBundledSt, /^VAR_GLOBAL\n\s+Result AT %MX0\.0 : BOOL;\n\/\/Global=\{"Name":"Result","Address":"%MX0\.0"\}\nEND_VAR/);
assert.match(defaultBundledSt, /bResult := TRUE;\nResult := bResult;\nEND_PROGRAM/);

const defaultMismatchSourceDir = path.join(tempRoot, 'default-mismatch-src');
const defaultMismatchOutputDir = path.join(tempRoot, 'default-mismatch-out');
fs.mkdirSync(defaultMismatchSourceDir, { recursive: true });
fs.mkdirSync(defaultMismatchOutputDir, { recursive: true });

fs.writeFileSync(path.join(defaultMismatchSourceDir, 'OTHER.st'), `
PROGRAM OTHER
VAR
  bResult : BOOL;
END_VAR
bResult := TRUE;
END_PROGRAM
`.trim());

await compileBundle(defaultMismatchSourceDir, defaultMismatchOutputDir, 'OTHER');

const defaultMismatchExports = JSON.parse(fs.readFileSync(path.join(defaultMismatchSourceDir, 'exports.json'), 'utf-8'));
assert.deepStrictEqual(defaultMismatchExports, {
  T_MAIN: [{ global: 'Result', type: 'BOOL', address: '%MX0.0', variable: 'bResult' }]
});

const defaultMismatchBundledSt = fs.readFileSync(path.join(defaultMismatchOutputDir, 'nodalisplc.st'), 'utf-8');
assert.doesNotMatch(defaultMismatchBundledSt, /VAR_GLOBAL/);
assert.doesNotMatch(defaultMismatchBundledSt, /Result := bResult/);

console.log('C++ bundle exports regression checks passed.');

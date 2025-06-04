import fs from 'fs';
import path from 'path';
import { GenericCPPCompiler } from '../../src/compilers/GenericCPPCompiler.js';

const fixtureName = 'plc';
const inputPath = path.resolve('test/st/fixtures', `${fixtureName}.st`);
const expectedPath = path.resolve('test/st/fixtures', `${fixtureName}.cpp`);
const outputPath = path.resolve('test/st/output');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function runTest() {
  // Clean output dir
  fs.rmSync(outputPath, { recursive: true, force: true });

  const compiler = new GenericCPPCompiler({
    sourcePath: inputPath,
    outputPath,
    target: 'code',
  });

  compiler.compile();

  const actualPath = path.join(outputPath, `${fixtureName}.cpp`);
  const actual = fs.readFileSync(actualPath, 'utf-8');
  const expected = fs.readFileSync(expectedPath, 'utf-8');

  const normActual = normalize(actual);
  const normExpected = normalize(expected);

  if (normActual === normExpected) {
    console.log(`✅ Passed: ${fixtureName}`);
  } else {
    console.error(`❌ Failed: ${fixtureName}`);
    console.log('--- Expected ---');
    console.log(expected);
    console.log('--- Got ---');
    console.log(actual);
  }
}

runTest();
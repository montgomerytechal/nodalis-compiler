import fs from 'fs';
import path from 'path';
import { GenericCPPCompiler } from '../../src/compilers/GenericCPPCompiler.js';

var fixtureName = 'plc';
var inputPath = path.resolve('test/st/fixtures', `${fixtureName}.st`);
var expectedPath = path.resolve('test/st/fixtures', `${fixtureName}.cpp`);
var outputPath = path.resolve('test/st/output');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function runTest() {
  // Clean output dir
  fs.rmSync(outputPath, { recursive: true, force: true });

  var compiler = new GenericCPPCompiler({
    sourcePath: inputPath,
    outputPath,
    target: 'code',
  });

  compiler.compile();

  var actualPath = path.join(outputPath, `${fixtureName}.cpp`);
  var actual = fs.readFileSync(actualPath, 'utf-8');
  var expected = fs.readFileSync(expectedPath, 'utf-8');

  var normActual = normalize(actual);
  var normExpected = normalize(expected);

  if (normActual === normExpected) {
    console.log(`✅ Passed: ${fixtureName}`);
  } else {
    console.error(`❌ Failed: ${fixtureName}`);
    console.log('--- Expected ---');
    console.log(expected);
    console.log('--- Got ---');
    console.log(actual);
  }
  fixtureName = "plc1";
  inputPath = path.resolve('test/st/fixtures', `${fixtureName}.iec`);
  expectedPath = path.resolve('test/st/fixtures', `${fixtureName}.cpp`);
  compiler = new GenericCPPCompiler({
    sourcePath: inputPath,
    outputPath,
    target: 'code',
    resourceName: "PLC1"
  });
  compiler.compile();

}

runTest();
import fs from 'fs';
import path from 'path';
import { CPPCompiler } from '../../src/compilers/CPPCompiler.js';

var inputPath = path.resolve('test/st/fixtures', `PLC-1.st`);
var outputPath = path.resolve('test/st/output');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function runTest() {


  const targets = ["windows-x64", "windows-arm64", "linux-x64", "linux-arm", "linux-arm64", "macos-x64", "macos-arm64"];
  inputPath = path.resolve('test/st/fixtures', `PLC-1.st`);

  targets.forEach(async t => {
    outputPath = path.resolve('test/st/output') + "/" + t;
    fs.rmSync(outputPath, { recursive: true, force: true });

    await new CPPCompiler({
      sourcePath: inputPath,
      outputPath,
      target: t,
      outputType: "executable",
      resourceName: "MainResource"
    }).compile();
  });

}

runTest();
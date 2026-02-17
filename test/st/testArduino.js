import fs from 'fs';
import path from 'path';
import { CPPCompiler } from '../../src/compilers/CPPCompiler.js';

var inputPath = path.resolve('test/st/fixtures', `plc1.iec`);
var outputPath = path.resolve('test/st/output');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function runTest() {


  const targets = ["arduino-opta", "arduino-portenta-h7"];
  inputPath = path.resolve('test/st/fixtures', `plc1.iec`);

  targets.forEach(async t => {
    outputPath = path.resolve('test/st/output') + "/" + t;
    fs.rmSync(outputPath, { recursive: true, force: true });

    await new CPPCompiler({
      sourcePath: inputPath,
      outputPath,
      target: t,
      outputType: "executable",
      resourceName: "PLC1"
    }).compile();
  });

}

runTest();

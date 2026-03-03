import fs from 'fs';
import path from 'path';
import { ArduinoCompiler } from '../../src/compilers/ArduinoCompiler.js';

var inputPath = path.resolve('test/st/fixtures', `plc1.iec`);
var outputPath = path.resolve('test/st/output');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function runTest() {


  const targets = ["arduino-opta"];
  inputPath = path.resolve('test/st/fixtures', `plc1.iec`);

  targets.forEach(async t => {
    outputPath = path.resolve('test/st/output') + "/" + t;
    fs.rmSync(outputPath, { recursive: true, force: true });

    await new ArduinoCompiler({
      sourcePath: inputPath,
      outputPath,
      target: t,
      outputType: "executable",
      resourceName: "PLC1"
    }).compile();
  });

}

runTest();

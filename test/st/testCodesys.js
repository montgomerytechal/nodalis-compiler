import fs from 'fs';
import path from 'path';
import { CodeSysCompiler } from '../../src/compilers/CodeSysCompiler.js';

var inputPath = path.resolve('test/st/fixtures', `plc1.iec`);
var outputPath = path.resolve('test/st/output/codesys');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function runTest() {


  inputPath = path.resolve('test/st/fixtures', `plc1.iec`);

  fs.rmSync(outputPath, { recursive: true, force: true });
    await new CodeSysCompiler({
      sourcePath: inputPath,
      outputPath,
      target: "codesys",
      outputType: "executable",
      resourceName: "PLC1"
    }).compile();

}

runTest();
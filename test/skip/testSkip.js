import fs from 'fs';
import path from 'path';
import { SkipCompiler } from '../../src/compilers/SkipCompiler.js';

var fixtureName = 'example';
var inputPath = path.resolve('test/skip/fixtures', `${fixtureName}.skip`);
var outputPath = path.resolve('test/skip/output');

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function runTest() {
  // Clean output dir
  fs.rmSync(outputPath, { recursive: true, force: true });

  let compiler = new SkipCompiler({
    sourcePath: inputPath,
    outputPath,
    target: 'iec',
    outputType: "code"
  });
  compiler.compile();

  compiler = new SkipCompiler({
    sourcePath: inputPath,
    outputPath,
    target: 'st',
    outputType: "code"
  });
  compiler.compile();

  compiler = new SkipCompiler({
    sourcePath: inputPath,
    outputPath,
    target: 'xml',
    outputType: "code"
  });
  compiler.compile();

}

runTest();
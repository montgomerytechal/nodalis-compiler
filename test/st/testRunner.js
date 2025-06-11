// testRunner.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStructuredText } from '../../src/compilers/st-parser/parser.js';
import { transpile } from '../../src/compilers/st-parser/cpptranspiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

function runTest(filename) {
  const source = fs.readFileSync(path.join(fixturesDir, filename + '.st'), 'utf8');
  const expected = fs.readFileSync(path.join(fixturesDir, filename + '.cpp'), 'utf8').trim();

  try {
    const ast = parseStructuredText(source);
    const output = transpile(ast).trim();

    const normalizeLines = str =>
    str
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    if (normalizeLines(output) === normalizeLines(expected)) {

      console.log(`✅ Passed: ${filename}`);
    } else {
      console.log(`❌ Failed: ${filename}`);
      console.log('--- Expected ---\n' + expected);
      console.log('--- Got ---\n' + output);
    }
  } catch (err) {
    console.error(`💥 Error in: ${filename}`);
    console.error(err);
  }
}

function runAllTests() {
  const files = fs.readdirSync(fixturesDir)
    .filter(f => f.endsWith('.st'))
    .map(f => f.replace('.st', ''));

  for (const file of files) {
    runTest(file);
  }
}

runAllTests();

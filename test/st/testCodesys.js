import fs from 'fs';
import path from 'path';
import { CodeSysCompiler } from '../../src/compilers/CodeSysCompiler.js';

var inputPath = path.resolve('test/st/fixtures', `plc1.iec`);
var outputPath = path.resolve('test/st/output/codesys');
var templateProjectPath = process.env.CODESYS_TEMPLATE_PROJECT
  ? path.resolve(process.env.CODESYS_TEMPLATE_PROJECT)
  : null;
var exportTemplatePath = process.env.CODESYS_EXPORT_TEMPLATE
  ? path.resolve(process.env.CODESYS_EXPORT_TEMPLATE)
  : null;

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function runTest() {


  inputPath = path.resolve('test/st/fixtures', `plc1.iec`);

  fs.rmSync(outputPath, { recursive: true, force: true });
    await new CodeSysCompiler({
      sourcePath: inputPath,
      outputPath,
      target: "codesys-win64",
      outputType: "executable",
      resourceName: "PLC1",
      ...(templateProjectPath ? { codesysProjectTemplateFile: templateProjectPath } : {}),
      ...(exportTemplatePath ? { codesysExportTemplateFile: exportTemplatePath } : {})
    }).compile();

}

runTest();

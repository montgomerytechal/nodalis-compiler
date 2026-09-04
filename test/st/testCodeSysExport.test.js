import fs from 'fs';
import path from 'path';
import { DOMParser } from 'xmldom';
import { Project } from '../../src/compilers/iec-parser/parser.js';
import { transpile } from '../../src/compilers/st-parser/codesystranspiler.js';
import { CodeSysExport } from '../../src/compilers/codesys-export.js';
import { CODESYS_TARGETS, CodeSysCompiler } from '../../src/compilers/CodeSysCompiler.js';

const root = process.cwd();
const templateXML = fs.readFileSync(path.join(root, 'src/compilers/templates/codesys-default.export'), 'utf8');
const projectXML = fs.readFileSync(path.join(root, 'test/st/fixtures/plc1.iec'), 'utf8');

describe('CODESYS export', () => {
  test('supports direct programmatic construction', () => {
    const model = new CodeSysExport(templateXML);
    model.addProgram('Run', 'PROGRAM Run\nVAR\nEND_VAR', 'value := value + 1;');
    model.addFunctionBlock('Counter', 'FUNCTION_BLOCK Counter\nVAR\nEND_VAR', 'count := count + 1;');
    model.addGlobalVariable('value', 'DINT', '%MW0', '0');
    model.addTask('Fast', '10', '2', ['Run']);
    const xml = model.toXML();
    expect(new DOMParser().parseFromString(xml).documentElement.tagName).toBe('ExportFile');
    expect(xml).toContain('PROGRAM Run');
    expect(xml).toContain('FUNCTION_BLOCK Counter');
    expect(xml).toContain('value AT %MW0 : DINT := 0;');
    expect(xml).toContain('t#10ms');
  });

  test('transpiles IEC programs, function blocks, globals, and tasks', () => {
    const project = Project.fromXML(projectXML);
    const namespace = project.Types.GlobalNamespace.NamespaceDecl;
    const ldProgram = namespace.Programs.find(program => program.MainBody.BodyContent.Type === 'LD');
    const syntheticLdFunctionBlock = namespace.FunctionBlocks[0];
    syntheticLdFunctionBlock.Name = 'LD_FUNCTION_BLOCK';
    syntheticLdFunctionBlock.MainBody = ldProgram.MainBody;

    const model = transpile(project, { templateXML, resourceName: 'PLC1' });
    const xml = model.toXML();
    expect(model.programs.length).toBeGreaterThan(0);
    expect(model.functionBlocks.length).toBeGreaterThan(0);
    expect(model.programs.find(program => program.name === ldProgram.Name).implementation)
      .toContain('PLS1.IN := SW1;');
    expect(model.functionBlocks.find(functionBlock => functionBlock.name === 'LD_FUNCTION_BLOCK').implementation)
      .toContain('PLS1.IN := SW1;');
    expect(xml).toContain('<ExportFile>');
    expect(xml).toContain('%QX0.0 := (PLS1.Q);');
    expect(xml).not.toContain('<LdObject');
    expect(xml).not.toContain('PROGRAM PLC_PRG\nVAR\nEND_VAR');
  });

  test('compiler writes an importable export artifact', async () => {
    const outputPath = path.join(root, 'test/st/output/codesys-test');
    const outputFile = await new CodeSysCompiler({
      sourcePath: path.join(root, 'test/st/fixtures/plc1.iec'),
      outputPath,
      target: 'codesys-win64',
      outputType: 'code',
      resourceName: 'PLC1'
    }).compile();
    expect(path.basename(outputFile)).toBe('PLC1.export');
    expect(fs.readFileSync(outputFile, 'utf8')).toContain('<ExportFile>');
  });

  test.each(Object.entries(CODESYS_TARGETS))('selects only the device tree for %s', async (target, deviceName) => {
    const outputPath = path.join(root, 'test/st/output/codesys-targets', target);
    const outputFile = await new CodeSysCompiler({
      sourcePath: path.join(root, 'test/st/fixtures/plc1.iec'),
      outputPath,
      target,
      outputType: 'code',
      resourceName: 'PLC1'
    }).compile();
    const xml = fs.readFileSync(outputFile, 'utf8');
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    const rootDeviceNames = Array.from(document.getElementsByTagName('Single'))
      .filter(node => node.getAttribute('Name') === 'MetaObject')
      .filter(node => Array.from(node.childNodes).some(child => child.nodeType === 1
        && child.getAttribute('Name') === 'ParentGuid'
        && child.textContent === '00000000-0000-0000-0000-000000000000'))
      .map(node => Array.from(node.childNodes).find(child => child.nodeType === 1 && child.getAttribute('Name') === 'Name')?.textContent);

    expect(rootDeviceNames).toEqual([deviceName]);
    expect(xml).toContain('PROGRAM PLC_LD');
    expect(xml).toContain('Task Configuration');
    expect(xml).toContain('VAR_GLOBAL');
  });

  test('rejects an unknown CODESYS target', async () => {
    const compiler = new CodeSysCompiler({
      sourcePath: path.join(root, 'test/st/fixtures/plc1.iec'),
      outputPath: path.join(root, 'test/st/output/codesys-invalid'),
      target: 'codesys-unknown',
      outputType: 'code',
      resourceName: 'PLC1'
    });
    await expect(compiler.compile()).rejects.toThrow('Unsupported CODESYS target');
  });
});

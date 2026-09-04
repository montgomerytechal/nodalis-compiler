import {
  CodeSysExport,
  CodeSysFunctionBlock,
  CodeSysGlobalVariable,
  CodeSysProgram,
  CodeSysTask
} from '../codesys-export.js';

function splitPou(source, endMarker) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  let declarationEnd = -1;
  for (let index = 1; index < lines.length; index++) {
    if (/^\s*END_VAR\s*$/i.test(lines[index])) declarationEnd = index;
  }
  const end = lines.findIndex(line => new RegExp(`^\\s*${endMarker}\\s*;?\\s*$`, 'i').test(line));
  if (declarationEnd < 0 || end < 0) throw new Error(`Could not split CODESYS POU ending in ${endMarker}.`);
  return {
    declaration: lines.slice(0, declarationEnd + 1).join('\n').trim(),
    implementation: lines.slice(declarationEnd + 1, end).join('\n').trim()
  };
}

function addressOf(variable) {
  const address = variable?.Address;
  if (!address) return '';
  const suffix = String(address.Address || '');
  return `%${address.Location || ''}${address.Size || ''}${suffix ? (suffix.startsWith('.') ? suffix : suffix) : ''}`;
}

/**
 * Converts an IEC parser Project into a native CODESYS export model.
 * @param {import('../iec-parser/parser.js').Project} project
 * @param {{templateXML: string, templateDeviceName?: string, resourceName?: string, applicationName?: string, deviceName?: string}} options
 * @returns {CodeSysExport}
 */
export function transpile(project, options = {}) {
  if (!project?.Types?.GlobalNamespace?.NamespaceDecl) throw new TypeError('A parsed IEC Project is required.');
  if (!options.templateXML) throw new Error('options.templateXML is required.');

  const configuration = project.Instances?.Configurations?.[0];
  const resources = configuration?.Resources || [];
  const resource = options.resourceName
    ? resources.find(item => item.Name === options.resourceName)
    : resources[0];
  if (!resource) throw new Error(`No IEC resource was found${options.resourceName ? ` named "${options.resourceName}"` : ''}.`);

  const output = new CodeSysExport(options.templateXML, options);
  const namespace = project.Types.GlobalNamespace.NamespaceDecl;
  for (const program of namespace.Programs || []) {
    const parts = splitPou(program.toST(), 'END_PROGRAM');
    output.addProgram(new CodeSysProgram({ name: program.Name, ...parts }));
  }
  for (const functionBlock of namespace.FunctionBlocks || []) {
    const parts = splitPou(functionBlock.toST(), 'END_FUNCTION_BLOCK');
    output.addFunctionBlock(new CodeSysFunctionBlock({ name: functionBlock.Name, ...parts }));
  }
  for (const variable of resource.GlobalVars?.Variables || []) {
    output.addGlobalVariable(new CodeSysGlobalVariable({
      name: variable.Name,
      type: variable.Type?.TypeName || 'BOOL',
      address: addressOf(variable)
    }));
  }

  const instances = resource.ProgramInstances || [];
  for (const task of resource.Tasks || []) {
    const programs = instances
      .filter(instance => !instance.AssociatedTaskName || instance.AssociatedTaskName === task.Name)
      .map(instance => instance.TypeName);
    output.addTask(new CodeSysTask({
      name: task.Name,
      interval: task.Interval,
      priority: task.Priority,
      programs
    }));
  }
  if (output.tasks.length === 0 && output.programs.length > 0) {
    output.addTask(new CodeSysTask({ name: 'MainTask', interval: 'T#20ms', priority: '1', programs: output.programs.map(item => item.name) }));
  }
  return output;
}

export default transpile;

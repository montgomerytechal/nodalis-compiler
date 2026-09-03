import fs from 'fs';
import { randomUUID } from 'crypto';
import { DOMParser, XMLSerializer } from 'xmldom';

const TYPES = Object.freeze({
  APPLICATION: '639b491f-5557-464c-af91-1471bac9f549',
  GVL: 'ffbfa93a-b94d-45fc-a329-229860183b1d',
  POU: '6f9dac99-8de1-4efc-8465-68ac443b7d08',
  TASK_CONFIGURATION: 'ae1de277-a207-4a28-9efb-456c06bd52f3',
  TASK: '98a2708a-9b18-4f31-82ed-a1465b24fa2d'
});

function child(element, tagName, name) {
  for (let node = element?.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && node.tagName === tagName && (name === undefined || node.getAttribute('Name') === name)) return node;
  }
  return null;
}

function descendants(element, tagName, name) {
  return Array.from(element.getElementsByTagName(tagName)).filter(node => name === undefined || node.getAttribute('Name') === name);
}

function value(element, tagName, name) {
  return child(element, tagName, name)?.textContent || '';
}

function setValue(element, tagName, name, newValue) {
  const node = child(element, tagName, name);
  if (!node) throw new Error(`Invalid CODESYS template: missing ${tagName}[Name="${name}"]`);
  while (node.firstChild) node.removeChild(node.firstChild);
  node.appendChild(node.ownerDocument.createTextNode(String(newValue ?? '')));
}

function normalizeGuid(guid = randomUUID()) {
  return String(guid).replace(/[{}]/g, '').toLowerCase();
}

export class CodeSysProgram {
  constructor(nameOrOptions, declaration = '', implementation = '') {
    const options = typeof nameOrOptions === 'object' ? nameOrOptions : { name: nameOrOptions, declaration, implementation };
    this.name = options.name || '';
    this.declaration = options.declaration || `PROGRAM ${this.name}\nVAR\nEND_VAR`;
    this.implementation = options.implementation || '';
    this.guid = normalizeGuid(options.guid);
  }
}

export class CodeSysFunctionBlock extends CodeSysProgram {
  constructor(nameOrOptions, declaration = '', implementation = '') {
    super(nameOrOptions, declaration, implementation);
    const explicitlyProvided = typeof nameOrOptions === 'object' ? nameOrOptions.declaration : declaration;
    if (!explicitlyProvided) this.declaration = `FUNCTION_BLOCK ${this.name}\nVAR_INPUT\nEND_VAR\nVAR_OUTPUT\nEND_VAR\nVAR\nEND_VAR`;
  }
}

export class CodeSysGlobalVariable {
  constructor(nameOrOptions, type = 'BOOL', address = '', initialValue = '') {
    const options = typeof nameOrOptions === 'object' ? nameOrOptions : { name: nameOrOptions, type, address, initialValue };
    this.name = options.name || '';
    this.type = options.type || 'BOOL';
    this.address = options.address || '';
    this.initialValue = options.initialValue ?? '';
  }

  toST() {
    const address = this.address ? ` AT ${this.address.startsWith('%') ? this.address : `%${this.address}`}` : '';
    const initial = this.initialValue !== '' ? ` := ${this.initialValue}` : '';
    return `    ${this.name}${address} : ${this.type}${initial};`;
  }
}

export class CodeSysTask {
  constructor(nameOrOptions, interval = 'T#20ms', priority = '1', programs = []) {
    const options = typeof nameOrOptions === 'object' ? nameOrOptions : { name: nameOrOptions, interval, priority, programs };
    this.name = options.name || 'MainTask';
    this.interval = String(options.interval || 'T#20ms');
    this.priority = String(options.priority ?? '1');
    this.programs = [...(options.programs || [])];
    this.guid = normalizeGuid(options.guid);
    this.taskGuid = normalizeGuid(options.taskGuid);
  }
}

/** A programmatic representation of the native CODESYS ExportFile archive. */
export class CodeSysExport {
  constructor(templateXML, options = {}) {
    if (!templateXML) throw new Error('A CODESYS export template is required.');
    this.templateXML = templateXML;
    this.deviceName = options.deviceName || 'Device';
    this.applicationName = options.applicationName || 'Application';
    this.globalVariableListName = options.globalVariableListName || 'GVL';
    this.programs = [];
    this.functionBlocks = [];
    this.tasks = [];
    this.globalVariables = [];
  }

  static fromTemplateFile(templatePath, options) {
    return new CodeSysExport(fs.readFileSync(templatePath, 'utf8'), options);
  }

  static fromXML(templateXML, options) {
    return new CodeSysExport(templateXML, options);
  }

  addProgram(program, declaration, implementation) {
    const item = program instanceof CodeSysProgram ? program : new CodeSysProgram(program, declaration, implementation);
    this.programs.push(item);
    return item;
  }

  addFunctionBlock(functionBlock, declaration, implementation) {
    const item = functionBlock instanceof CodeSysFunctionBlock ? functionBlock : new CodeSysFunctionBlock(functionBlock, declaration, implementation);
    this.functionBlocks.push(item);
    return item;
  }

  addTask(task, interval, priority, programs) {
    const item = task instanceof CodeSysTask ? task : new CodeSysTask(task, interval, priority, programs);
    this.tasks.push(item);
    return item;
  }

  addGlobalVariable(variable, type, address, initialValue) {
    const item = variable instanceof CodeSysGlobalVariable ? variable : new CodeSysGlobalVariable(variable, type, address, initialValue);
    this.globalVariables.push(item);
    return item;
  }

  toXML() {
    const document = new DOMParser().parseFromString(this.templateXML, 'text/xml');
    const entryList = descendants(document, 'List2', 'EntryList')[0];
    if (!entryList) throw new Error('Invalid CODESYS template: EntryList was not found.');
    const entries = Array.from(entryList.childNodes).filter(node => node.nodeType === 1 && node.tagName === 'Single');
    const typeOf = entry => value(child(entry, 'Single', 'MetaObject'), 'Single', 'TypeGuid').replace(/[{}]/g, '').toLowerCase();
    const exemplar = type => entries.find(entry => typeOf(entry) === type);
    const application = exemplar(TYPES.APPLICATION);
    const gvl = exemplar(TYPES.GVL);
    const pou = exemplar(TYPES.POU);
    const taskConfig = exemplar(TYPES.TASK_CONFIGURATION);
    const task = exemplar(TYPES.TASK);
    if (![application, gvl, pou, taskConfig, task].every(Boolean)) throw new Error('The CODESYS template does not contain all required application object exemplars.');

    const applicationGuid = value(child(application, 'Single', 'MetaObject'), 'Single', 'Guid');
    const taskConfigGuid = value(child(taskConfig, 'Single', 'MetaObject'), 'Single', 'Guid');
    setValue(child(application, 'Single', 'MetaObject'), 'Single', 'Name', this.applicationName);

    for (const entry of entries) {
      const meta = child(entry, 'Single', 'MetaObject');
      if (value(meta, 'Single', 'Name') === 'Device') setValue(meta, 'Single', 'Name', this.deviceName);
      const pathNode = child(entry, 'Array', 'Path');
      for (const part of Array.from(pathNode?.childNodes || [])) {
        if (part.nodeType !== 1) continue;
        if (part.textContent === 'Device') part.textContent = this.deviceName;
        if (part.textContent === 'Application') part.textContent = this.applicationName;
      }
    }

    for (const entry of entries) {
      if ([TYPES.POU, TYPES.TASK].includes(typeOf(entry))) entryList.removeChild(entry);
    }

    setValue(child(gvl, 'Single', 'MetaObject'), 'Single', 'Name', this.globalVariableListName);
    const gvlBlob = descendants(gvl, 'Single', 'TextBlobForSerialisation')[0];
    gvlBlob.textContent = `VAR_GLOBAL\n${this.globalVariables.map(item => item.toST()).join('\n')}\nEND_VAR`;

    const configureEntry = (entry, item, parentGuid, parentPath) => {
      const meta = child(entry, 'Single', 'MetaObject');
      setValue(meta, 'Single', 'Guid', item.guid);
      setValue(meta, 'Single', 'ParentGuid', parentGuid);
      setValue(meta, 'Single', 'Name', item.name);
      setValue(entry, 'Single', 'ParentSVNodeGuid', parentGuid);
      const pathNode = child(entry, 'Array', 'Path');
      while (pathNode.firstChild) pathNode.removeChild(pathNode.firstChild);
      for (const part of parentPath) {
        const partNode = document.createElement('Single');
        partNode.setAttribute('Type', 'string');
        partNode.appendChild(document.createTextNode(part));
        pathNode.appendChild(partNode);
      }
    };

    for (const item of [...this.programs, ...this.functionBlocks]) {
      const entry = pou.cloneNode(true);
      configureEntry(entry, item, applicationGuid, [this.deviceName, 'PLC Logic', this.applicationName]);
      const blobs = descendants(entry, 'Single', 'TextBlobForSerialisation');
      blobs[0].textContent = item.implementation;
      blobs[1].textContent = item.declaration;
      const lineIds = descendants(entry, 'Single', 'LineInfoPersistence');
      lineIds[0].textContent = `${item.guid}_Impl_LineIds`;
      lineIds[1].textContent = `${item.guid}_Decl_LineIds`;
      entryList.insertBefore(entry, taskConfig);
    }

    for (const item of this.tasks) {
      const entry = task.cloneNode(true);
      configureEntry(entry, item, taskConfigGuid, [this.deviceName, 'PLC Logic', this.applicationName, 'Task Configuration']);
      const object = child(entry, 'Single', 'Object');
      setValue(object, 'Single', 'Priority', item.priority);
      const interval = child(object, 'Single', 'Interval');
      setValue(interval, 'Single', 'Time', /^t#/i.test(item.interval) ? item.interval.toLowerCase() : `t#${item.interval}ms`);
      setValue(object, 'Single', 'TaskGuid', item.taskGuid);
      const pouList = child(object, 'List', 'PouList');
      const pouExemplar = Array.from(pouList.childNodes).find(node => node.nodeType === 1);
      while (pouList.firstChild) pouList.removeChild(pouList.firstChild);
      for (const programName of item.programs) {
        const association = pouExemplar.cloneNode(true);
        setValue(association, 'Single', 'Name', programName);
        pouList.appendChild(association);
      }
      entryList.appendChild(entry);
    }

    return new XMLSerializer().serializeToString(document);
  }

  toString() { return this.toXML(); }
}

export default CodeSysExport;

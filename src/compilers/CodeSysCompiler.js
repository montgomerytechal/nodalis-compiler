/* eslint-disable curly */
/* eslint-disable eqeqeq */
// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from "./Compiler.js";
import * as iec from "./iec-parser/parser.js";

const DEFAULT_TEMPLATE = "{codesysCommand} --noUI --project {projectFile} --runscript {scriptFile}";

function quoteShellValue(value) {
  const normalized = String(value ?? "");
  if (process.platform === "win32") {
    return `"${normalized.replaceAll('"', '\\"')}"`;
  }
  return `'${normalized.replaceAll("'", "'\"'\"'")}'`;
}

function applyTemplate(template, variables) {
  let output = String(template || "").trim();
  for (const [key, rawValue] of Object.entries(variables)) {
    output = output.replaceAll(`{${key}}`, quoteShellValue(rawValue));
  }
  return output;
}

function parseJsonDirectiveValue(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    // Map lines are emitted as escaped JSON text in ST comments.
  }
  try {
    const decoded = JSON.parse(`"${value}"`);
    if (typeof decoded === "string") {
      const trimmed = decoded.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return JSON.parse(trimmed);
      }
    }
    return decoded;
  } catch {
    return null;
  }
}

function sanitizeIECIdentifier(name, fallback = "PLC_PRG") {
  const normalized = String(name ?? "").trim().replace(/[^A-Za-z0-9_]/g, "_");
  if (!normalized) return fallback;
  if (/^[0-9]/.test(normalized)) return `_${normalized}`;
  return normalized;
}

function transposeAddressForCodeSys(address) {
  const raw = String(address ?? "").trim();
  if (!raw) return "";
  const hasPercent = raw.startsWith("%");
  const normalized = hasPercent ? raw.slice(1) : raw;
  const match = normalized.match(/^([IQMiqm])([XBWDLxbwdl]?)(\*|\d+)(\.\d+)?$/);
  if (!match) {
    return hasPercent ? `%${normalized.toUpperCase()}` : normalized.toUpperCase();
  }

  const memory = String(match[1] ?? "").toUpperCase();
  let size = String(match[2] ?? "").toUpperCase();
  const position = String(match[3] ?? "");
  const bit = String(match[4] ?? "");

  if (size === "L") {
    size = "D";
    if (position !== "*" && /^-?\d+$/.test(position)) {
      const posNum = Number.parseInt(position, 10);
      if (!Number.isNaN(posNum)) {
        return `%${memory}${size}${posNum * 2}${bit}`;
      }
    }
  }

  return `%${memory}${size}${position}${bit}`;
}

function toAddressLiteral(address) {
  const normalized = transposeAddressForCodeSys(address);
  if (!normalized) return "";
  return normalized.toUpperCase();
}

function inferTypeForMap(map) {
  const bits = Number.parseInt(String(map?.RemoteSize ?? "").trim(), 10);
  if (Number.isNaN(bits) || bits <= 1) return "BOOL";
  if (bits <= 8) return "BYTE";
  if (bits <= 16) return "WORD";
  if (bits <= 32) return "DWORD";
  return "LWORD";
}

function inferTypeForAddress(address) {
  const original = String(address ?? "").trim().replace(/^%/, "").toUpperCase();
  if (original.startsWith("IL") || original.startsWith("QL") || original.startsWith("ML")) return "LWORD";
  const normalized = toAddressLiteral(address);
  if (normalized.startsWith("%IX") || normalized.startsWith("%QX") || normalized.startsWith("%MX")) return "BOOL";
  if (normalized.startsWith("%IB") || normalized.startsWith("%QB") || normalized.startsWith("%MB")) return "BYTE";
  if (normalized.startsWith("%IW") || normalized.startsWith("%QW") || normalized.startsWith("%MW")) return "WORD";
  if (normalized.startsWith("%ID") || normalized.startsWith("%QD") || normalized.startsWith("%MD")) return "DWORD";
  if (normalized.startsWith("%IL") || normalized.startsWith("%QL") || normalized.startsWith("%ML")) return "LWORD";
  return "BOOL";
}

function extractProgramsFromST(stCode) {
  const source = String(stCode ?? "");
  const programRegex = /PROGRAM\s+([A-Za-z_][A-Za-z0-9_]*)\b([\s\S]*?)END_PROGRAM/gi;
  const programs = [];
  let match;
  while ((match = programRegex.exec(source)) !== null) {
    const pouName = sanitizeIECIdentifier(match[1], "PLC_PRG");
    const body = String(match[2] ?? "").replace(/^\s*\n/, "").replace(/\s*$/, "");
    const varBlocks = [];
    const varRegex = /\b(VAR(?:_[A-Z]+)?(?:\s+[A-Z_]+)?)\b[\s\S]*?END_VAR/gi;
    let varMatch;
    while ((varMatch = varRegex.exec(body)) !== null) {
      varBlocks.push(varMatch[0].trim());
    }
    let implementation = body;
    if (varBlocks.length > 0) {
      implementation = implementation.replace(varRegex, "").trim();
    }
    programs.push({
      pouName,
      declaration: varBlocks.join("\n\n").trim(),
      implementation: implementation.trim()
    });
  }
  return programs;
}

function transposeAddressesInDeclarationText(declarationText) {
  return String(declarationText ?? "").replace(
    /\bAT\s+(%?[IQMiqm][A-Za-z]?(?:\*|\d+)(?:\.\d+)?)/g,
    (full, addr) => full.replace(addr, transposeAddressForCodeSys(addr))
  );
}

function extractCodeSysDirectives(stCode) {
  const maps = [];
  const globals = [];
  const lines = String(stCode ?? "").split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//Map=")) {
      const parsed = parseJsonDirectiveValue(trimmed.substring(trimmed.indexOf("=") + 1));
      if (parsed && typeof parsed === "object") {
        maps.push(parsed);
      }
    } else if (trimmed.startsWith("//Global=")) {
      const parsed = parseJsonDirectiveValue(trimmed.substring(trimmed.indexOf("=") + 1));
      if (parsed && typeof parsed === "object") {
        globals.push(parsed);
      }
    }
  });
  return { maps, globals };
}

function buildGlobalDeclarationFromMaps(maps, globals) {
  const declarations = [];
  const usedNames = new Set();
  const addDeclaration = (name, address, type, comment) => {
    const safeName = sanitizeIECIdentifier(name, "IO_VAR");
    if (!address) return;
    let finalName = safeName;
    let i = 1;
    while (usedNames.has(finalName)) {
      i += 1;
      finalName = `${safeName}_${i}`;
    }
    usedNames.add(finalName);
    const commentSuffix = comment ? ` // ${comment}` : "";
    declarations.push(`  ${finalName} AT ${address} : ${type};${commentSuffix}`);
  };

  globals.forEach((global, idx) => {
    const name = String(global?.Name ?? "").trim() || `GLOBAL_${idx + 1}`;
    const rawAddress = String(global?.Address ?? "").trim();
    const address = toAddressLiteral(rawAddress);
    addDeclaration(name, address, inferTypeForAddress(rawAddress), "from //Global");
  });

  maps.forEach((map, idx) => {
    const internalAddress = toAddressLiteral(map?.InternalAddress);
    if (!internalAddress) return;
    const protocol = String(map?.Protocol ?? "").trim();
    const remoteAddress = String(map?.RemoteAddress ?? "").trim();
    const resource = String(map?.Resource ?? "").trim();
    const baseName = `MAP_${protocol || "IO"}_${idx + 1}`;
    const mapCommentParts = [];
    if (resource) mapCommentParts.push(`resource=${resource}`);
    if (remoteAddress) mapCommentParts.push(`remote=${remoteAddress}`);
    addDeclaration(baseName, internalAddress, inferTypeForMap(map), mapCommentParts.join(", "));
  });

  if (declarations.length === 0) return "";
  return `VAR_GLOBAL\n${declarations.join("\n")}\nEND_VAR`;
}

function buildCodeSysScript(configPath) {
  const configFileName = path.basename(configPath);
  return `import io
import json
import os
import traceback

def _log(message):
    try:
        system.write_message(str(message))
    except Exception:
        print(str(message))

def _read_file(path):
    with io.open(path, "r", encoding="utf-8") as fp:
        return fp.read()

def _write_text(doc, text):
    if doc is None:
        return
    doc.replace(text or "")

def _safe_find_first(obj, name):
    try:
        matches = obj.find(name, True)
        if matches and len(matches) > 0:
            return matches[0]
    except Exception:
        return None
    return None

def _safe_children(obj):
    try:
        return obj.get_children(True)
    except Exception:
        return []

def _find_pou_container(project):
    candidates = []
    try:
        if project.active_application is not None:
            candidates.append(project.active_application)
    except Exception:
        pass
    app = _safe_find_first(project, "Application")
    if app is not None:
        candidates.append(app)
    for child in _safe_children(project):
        candidates.append(child)
    for candidate in candidates:
        if candidate is None:
            continue
        if hasattr(candidate, "create_program"):
            return candidate
    return None

def _find_or_create_gvl(container, gvl_name):
    existing = _safe_find_first(container, gvl_name)
    if existing is not None:
        return existing
    if hasattr(container, "create_gvl"):
        return container.create_gvl(gvl_name)
    return None

def _find_or_create_program(container, pou_name):
    existing = _safe_find_first(container, pou_name)
    if existing is not None:
        return existing
    if hasattr(container, "create_program"):
        return container.create_program(pou_name)
    return None

def _first_application(project):
    try:
        if project.active_application is not None:
            return project.active_application
    except Exception:
        pass
    for child in _safe_children(project):
        try:
            if getattr(child, "is_application", False):
                return child
        except Exception:
            pass
    app = _safe_find_first(project, "Application")
    if app is not None:
        return app
    return None

def _open_or_create_project(project_path):
    if os.path.exists(project_path):
        return projects.open(project_path, primary=True)
    return projects.create(project_path, primary=True)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "${configFileName.replaceAll("\\", "\\\\")}")
    config = json.loads(_read_file(config_path))

    project_path = config["projectFile"]
    pou_name = config["pouName"]
    declaration_text = config.get("pouDeclaration", "") or ""
    implementation_text = config.get("pouImplementation", "") or ""
    gvl_name = config.get("gvlName", "NODALIS_IO_MAP")
    gvl_declaration = config.get("gvlDeclaration", "") or ""
    boot_app_file = config.get("bootApplicationFile")

    _log("Opening or creating project: " + project_path)
    project = _open_or_create_project(project_path)

    container = _find_pou_container(project)
    if container is None:
        raise Exception("Could not locate an IEC object container. Provide a project template with an Application node.")

    pou = _find_or_create_program(container, pou_name)
    if pou is None:
        raise Exception("Could not create or find POU '" + pou_name + "'.")

    if hasattr(pou, "textual_declaration"):
        _write_text(pou.textual_declaration, declaration_text)
    if hasattr(pou, "textual_implementation"):
        _write_text(pou.textual_implementation, implementation_text)

    if gvl_declaration.strip():
        gvl = _find_or_create_gvl(container, gvl_name)
        if gvl is not None and hasattr(gvl, "textual_declaration"):
            _write_text(gvl.textual_declaration, gvl_declaration)

    app = _first_application(project)
    if app is not None:
        try:
            project.active_application = app
        except Exception:
            pass
        if hasattr(app, "build"):
            _log("Building active application...")
            app.build()
        if boot_app_file and hasattr(app, "create_boot_application"):
            _log("Creating boot application: " + boot_app_file)
            app.create_boot_application(boot_app_file)

    project.save()
    _log("CODESYS scripting workflow completed.")

if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        _log("CODESYS script failed: " + str(ex))
        _log(traceback.format_exc())
        raise
`;
}

export class CodeSysCompiler extends Compiler {
  constructor(options) {
    super(options);
    this.name = "CodeSysCompiler";
  }

  get supportedLanguages() {
    return [IECLanguage.STRUCTURED_TEXT, IECLanguage.LADDER_DIAGRAM];
  }

  get supportedOutputTypes() {
    return [OutputType.SOURCE_CODE, OutputType.EXECUTABLE];
  }

  get supportedTargetDevices() {
    return ["codesys"];
  }

  get supportedProtocols() {
    return [
      CommunicationProtocol.MODBUS,
      CommunicationProtocol.BACNET,
      CommunicationProtocol.OPC_UA,
      CommunicationProtocol.GPIO,
      CommunicationProtocol.CUSTOM
    ];
  }

  get compilerVersion() {
    return "0.1.0";
  }

  async compile() {
    const { sourcePath, outputPath, outputType, resourceName } = this.options;
    const resolvedSourcePath = path.resolve(sourcePath);
    const resolvedOutputPath = path.resolve(outputPath);
    const sourceText = fs.readFileSync(resolvedSourcePath, "utf-8");
    const sourceBaseName = path.basename(resolvedSourcePath, path.extname(resolvedSourcePath));
    const projectBaseName = sanitizeIECIdentifier(resourceName || sourceBaseName, "NodalisProject");
    const projectFilePath = path.resolve(
      this.options?.codesysProjectFile || path.join(resolvedOutputPath, `${projectBaseName}.project`)
    );
    const programBlocks = extractProgramsFromST(sourceText);

    let stCode = sourceText;
    if (resolvedSourcePath.toLowerCase().endsWith(".iec") || resolvedSourcePath.toLowerCase().endsWith(".xml")) {
      if (!resourceName || String(resourceName).trim().length === 0) {
        throw new Error("CodeSysCompiler requires resourceName when sourcePath is .iec or .xml.");
      }
      stCode = this.#extractResourceST(sourceText, resourceName);
    }

    fs.mkdirSync(resolvedOutputPath, { recursive: true });

    const extractedPrograms = extractProgramsFromST(stCode);
    const firstProgram = extractedPrograms[0] || programBlocks[0] || null;
    const defaultPouName = firstProgram?.pouName || sanitizeIECIdentifier(`${projectBaseName}_PRG`, "PLC_PRG");
    const pouName = sanitizeIECIdentifier(this.options?.codesysPouName || defaultPouName, defaultPouName);
    const pouDeclaration = transposeAddressesInDeclarationText(firstProgram?.declaration || "VAR\nEND_VAR");
    const pouImplementation = firstProgram?.implementation || stCode;
    const directives = extractCodeSysDirectives(stCode);
    const gvlDeclaration = buildGlobalDeclarationFromMaps(directives.maps, directives.globals);

    const stFilePath = path.join(resolvedOutputPath, `${sourceBaseName}.codesys.st`);
    fs.writeFileSync(stFilePath, stCode, "utf-8");
    const scriptFilePath = path.join(resolvedOutputPath, "codesys-build.py");
    const bootApplicationFile = path.join(resolvedOutputPath, `${projectBaseName}.app`);

    const isWindowsHost = process.platform === "win32";
    const buildConfig = {
      compiler: "CodeSysCompiler",
      generatedAt: new Date().toISOString(),
      hostPlatform: process.platform,
      sourcePath: resolvedSourcePath,
      sourceType: path.extname(resolvedSourcePath).toLowerCase(),
      resourceName: resourceName || null,
      stFile: stFilePath,
      scriptFile: scriptFilePath,
      projectFile: projectFilePath,
      pouName,
      pouDeclaration,
      pouImplementation,
      gvlName: "NODALIS_IO_MAP",
      gvlDeclaration,
      mapCount: directives.maps.length,
      globalCount: directives.globals.length,
      maps: directives.maps,
      globals: directives.globals,
      bootApplicationFile,
      outputPath: resolvedOutputPath,
      executionMode: isWindowsHost ? "local" : "handoff-windows",
      notes: [
        "Generated CODESYS automation manifest for project creation/update.",
        "The generated codesys-build.py script creates/opens the project, upserts a POU, applies IO globals from //Map and //Global directives, and builds the active application.",
        "Configure a CODESYS command via compiler options or env vars.",
        "Supported template placeholders: {codesysCommand}, {projectDir}, {projectFile}, {scriptFile}, {buildConfig}, {sourcePath}, {stFile}, {outputDir}, {resourceName}, {pouName}"
      ]
    };
    const buildConfigPath = path.join(resolvedOutputPath, "codesys-build.json");
    fs.writeFileSync(buildConfigPath, JSON.stringify(buildConfig, null, 2), "utf-8");
    fs.writeFileSync(scriptFilePath, buildCodeSysScript(buildConfigPath), "utf-8");

    await this._writeHelperScripts(resolvedOutputPath, {
      projectFile: projectFilePath,
      scriptFile: scriptFilePath
    });

    if (outputType === OutputType.EXECUTABLE) {
      if (!isWindowsHost) {
        this._writeWindowsHandoffInstructions(resolvedOutputPath, {
          projectFile: projectFilePath,
          scriptFile: scriptFilePath
        });
        console.warn(
          `CodeSysCompiler generated CODESYS automation scripts at "${resolvedOutputPath}". ` +
          "Run codesys-build.ps1 on a Windows machine with CODESYS installed."
        );
        return;
      }
      this._runConfiguredBuildCommand({
        projectDir: resolvedOutputPath,
        projectFile: projectFilePath,
        scriptFile: scriptFilePath,
        buildConfig: buildConfigPath,
        sourcePath: resolvedSourcePath,
        stFile: stFilePath,
        outputDir: resolvedOutputPath,
        resourceName: resourceName || sourceBaseName,
        pouName
      });
    }
  }

  #extractResourceST(iecXml, resourceName) {
    let stcode = "";
    const project = iec.Project.fromXML(iecXml);
    project.Instances.Configurations.forEach(configuration => {
      if (stcode.length > 0) return;
      const resource = configuration.Resources.find(r => r.Name === resourceName);
      if (resource) {
        stcode = resource.toST();
      }
    });

    if (stcode.length === 0) {
      throw new Error(`No IEC resource was found by the name "${resourceName}" or it could not be parsed.`);
    }
    return stcode;
  }

  async _writeHelperScripts(outputPath, { projectFile, scriptFile }) {
    const projectFileName = path.basename(projectFile);
    const scriptFileName = path.basename(scriptFile);
    const shScript = `#!/usr/bin/env bash
set -euo pipefail

# Fill CODESYS_BUILD_CMD with your local CODESYS automation invocation.
# Placeholders: {codesysCommand} {projectDir} {projectFile} {scriptFile} {buildConfig} {sourcePath} {stFile} {outputDir} {resourceName} {pouName}
CODESYS_BUILD_CMD="\${CODESYS_BUILD_CMD:-}"

if [ -z "$CODESYS_BUILD_CMD" ]; then
  echo "CODESYS_BUILD_CMD is not set. Nothing to run."
  exit 0
fi

echo "Running: $CODESYS_BUILD_CMD"
eval "$CODESYS_BUILD_CMD"
`;

    const psScript = `param(
  [string]$CodesysExe = $env:CODESYS_COMMAND,
  [string]$CodesysBuildCmd = $env:CODESYS_BUILD_CMD
)

if ([string]::IsNullOrWhiteSpace($CodesysBuildCmd)) {
  if ([string]::IsNullOrWhiteSpace($CodesysExe)) {
    $defaultCmd = Get-Command "CODESYS.exe" -ErrorAction SilentlyContinue
    if ($null -ne $defaultCmd) {
      $CodesysExe = $defaultCmd.Source
    }
  }

  if ([string]::IsNullOrWhiteSpace($CodesysExe)) {
    Write-Error "Set CODESYS_COMMAND (or pass -CodesysExe) to your CODESYS executable path."
    exit 1
  }

  $projectFile = Join-Path $PSScriptRoot "${projectFileName.replaceAll("\\", "\\\\")}"
  $scriptFile = Join-Path $PSScriptRoot "${scriptFileName.replaceAll("\\", "\\\\")}"
  $CodesysBuildCmd = '"' + $CodesysExe + '" --noUI --project "' + $projectFile + '" --runscript "' + $scriptFile + '"'
}

Write-Host "Running: $CodesysBuildCmd"
Invoke-Expression $CodesysBuildCmd
`;

    const shPath = path.join(outputPath, "codesys-build.sh");
    fs.writeFileSync(shPath, shScript, "utf-8");
    fs.chmodSync(shPath, 0o755);
    fs.writeFileSync(path.join(outputPath, "codesys-build.ps1"), psScript, "utf-8");
  }

  _writeWindowsHandoffInstructions(outputPath, { projectFile, scriptFile }) {
    const projectFileName = path.basename(projectFile);
    const scriptFileName = path.basename(scriptFile);
    const instructions = `This output was generated on a non-Windows host.

To build the CODESYS project, copy this output folder to a Windows machine with CODESYS installed and run:

  powershell -ExecutionPolicy Bypass -File .\\codesys-build.ps1 -CodesysExe "C:\\Path\\To\\CODESYS.exe"

Inputs used by the generated script:
  Project: .\\${projectFileName}
  Script : .\\${scriptFileName}

You can also set environment variable CODESYS_COMMAND on Windows and run:

  powershell -ExecutionPolicy Bypass -File .\\codesys-build.ps1
`;
    fs.writeFileSync(path.join(outputPath, "RUN_ON_WINDOWS.txt"), instructions, "utf-8");
  }

  _runConfiguredBuildCommand({ projectDir, projectFile, scriptFile, buildConfig, sourcePath, stFile, outputDir, resourceName, pouName }) {
    const template =
      this.options?.codesysCommandTemplate ||
      process.env.CODESYS_BUILD_TEMPLATE ||
      DEFAULT_TEMPLATE;
    const codesysCommand =
      this.options?.codesysCommand ||
      process.env.CODESYS_COMMAND ||
      process.env.CODESYS_EXE ||
      "";

    if (!codesysCommand) {
      throw new Error(
        "CodeSysCompiler scaffold generated output, but no CODESYS command was configured for executable build. " +
        "Set options.codesysCommand (or CODESYS_COMMAND) and optionally options.codesysCommandTemplate."
      );
    }

    const command = applyTemplate(template, {
      codesysCommand,
      projectDir,
      projectFile,
      scriptFile,
      buildConfig,
      sourcePath,
      stFile,
      outputDir,
      resourceName,
      pouName
    });

    execSync(command, { stdio: "inherit", shell: true, cwd: projectDir });
  }
}

export default CodeSysCompiler;

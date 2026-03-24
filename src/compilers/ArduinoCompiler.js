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

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Compiler, IECLanguage, OutputType, CommunicationProtocol } from './Compiler.js';
import * as iec from './iec-parser/parser.js';
import { parseStructuredText, buildCompilerMetadataDirectives } from './st-parser/parser.js';
import { transpile } from './st-parser/gcctranspiler.js';
import { DEFAULT_ARDUINO_FQBN } from './arduinoDefaults.js';
import { getManagedArduinoCliPath, getManagedArduinoCliExecOptions } from '../toolchains.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODBUS_ARDUINO_CORE_IDS = new Set([
    'arduino:megaavr',
    'arduino:samd',
    'arduino:mbed_nano',
    'arduino:mbed_portenta',
    'arduino:mbed_opta'
]);

const UNSUPPORTED_ARDUINO_MODBUS_FQBNS = new Set([
    'arduino:mbed_portenta:portenta_x8'
]);

const UNSUPPORTED_ARDUINO_TARGET_ALIASES = {
    'arduino-portenta-x8': 'arduino:mbed_portenta:portenta_x8',
    'arduino-portenta_x8': 'arduino:mbed_portenta:portenta_x8'
};

let CachedArduinoTargetTable = null;

const getExecOutputText = (bufferOrString) => {
    if (typeof bufferOrString === 'string') return bufferOrString.trim();
    if (Buffer.isBuffer(bufferOrString)) return bufferOrString.toString('utf8').trim();
    return '';
};

export class ArduinoCompiler extends Compiler {
    constructor(options) {
        super(options);
        this.name = 'ArduinoCompiler';
    }

    get supportedLanguages() {
        return [IECLanguage.STRUCTURED_TEXT, IECLanguage.LADDER_DIAGRAM];
    }

    get supportedOutputTypes() {
        return [OutputType.EXECUTABLE, OutputType.SOURCE_CODE];
    }

    get supportedTargetDevices() {
        return this.getArduinoTargetTable().targets;
    }

    canHandleTarget(target) {
        if (typeof target !== 'string') return false;
        if (target.startsWith('arduino:')) return true;
        return this.supportedTargetDevices.includes(target);
    }

    get supportedProtocols() {
        return [CommunicationProtocol.MODBUS, CommunicationProtocol.GPIO];
    }

    get compilerVersion() {
        return '1.0.0';
    }

    async compile() {
        const { sourcePath, outputPath, target, outputType, resourceName, language } = this.options;
        const sourcePathStat = fs.lstatSync(sourcePath);
        const sourceIsDirectory = sourcePathStat.isDirectory();
        const isStructuredTextLanguage = String(language || '').toUpperCase() === IECLanguage.STRUCTURED_TEXT;
        const directoryBundleMode = sourceIsDirectory && isStructuredTextLanguage && typeof resourceName === 'string' && resourceName.trim().length > 0;
        let bundleFileLineMappings = [];
        let compilerConfig = {};

        const sourceDir = sourceIsDirectory ? sourcePath : path.dirname(sourcePath);
        const toolchainConfigPath = path.join(sourceDir, 'toolchain.json');
        if (fs.existsSync(toolchainConfigPath)) {
            try {
                const customToolchain = JSON.parse(fs.readFileSync(toolchainConfigPath, 'utf-8'));
                if (typeof customToolchain !== 'object' || customToolchain === null) {
                    throw new Error('The toolchain configuration must be a JSON object.');
                }
                compilerConfig = customToolchain;
            } catch (err) {
                throw new Error(`Failed to load toolchain configuration from ${toolchainConfigPath}: ${err.message}`);
            }
        }

        const sourceName = directoryBundleMode ? resourceName : sourcePath;
        let filename = path.basename(sourceName, path.extname(sourceName));
        let sourceCode = '';
        let bundleEntryProgram = '';
        if (directoryBundleMode) {
            this.cleanupStructuredTextBundleArtifacts(sourcePath);
            const { combinedSource, entryProgramName, fileLineMappings } = this.loadStructuredTextBundle(sourcePath, resourceName);
            sourceCode = combinedSource;
            bundleEntryProgram = entryProgramName;
            bundleFileLineMappings = fileLineMappings;
        } else {
            sourceCode = fs.readFileSync(sourcePath, 'utf-8');
        }
        const sketchName = path.basename(path.resolve(outputPath));
        const inoFile = path.join(outputPath, `${sketchName}.ino`);
        const stFile = path.join(outputPath, directoryBundleMode ? 'nodalisplc.st' : `${filename}.st`);
        if (directoryBundleMode) {
            fs.mkdirSync(outputPath, { recursive: true });
            fs.writeFileSync(stFile, sourceCode);
        }
        if (sourcePath.toLowerCase().endsWith('.iec') || sourcePath.toLowerCase().endsWith('.xml')) {
            if (typeof resourceName === 'undefined' || resourceName === null || resourceName.length === 0) {
                throw new Error('You must provide the resourceName option for an IEC project file.');
            }
            let stcode = '';
            const iecProj = iec.Project.fromXML(sourceCode);
            iecProj.Instances.Configurations.forEach(
                /**
                 * @param {iec.Configuration} c
                 */
                (c) => {
                    if (stcode.length > 0) return;
                    /**
                     * @type {iec.Resource}
                     */
                    const res = c.Resources.find(r => r.Name === resourceName);
                    if (res) {
                        stcode = res.toST();
                    }
                }
            );
            if (stcode.length > 0) {
                sourceCode = stcode;
            }
            else {
                throw new Error('No resource was found by the name ' + resourceName + ' or the resource could not be parsed.');
            }
        }

        const parsed = this.parseStructuredTextWithBundleContext(parseStructuredText, sourceCode, bundleFileLineMappings);
        const transpiledCode = this.transpileStructuredTextWithBundleContext(transpile, parsed, bundleFileLineMappings);

        let tasks = [];
        let programs = [];
        let globals = [];
        let taskCode = '';
        let mapCode = '';

        const metadataDirectives = buildCompilerMetadataDirectives(parsed);
        const metadataAwareSource = metadataDirectives.length > 0 ? `${metadataDirectives}${sourceCode}` : sourceCode;
        const lines = metadataAwareSource.split('\n');
        lines.forEach((line) => {
            if (line.trim().startsWith('//Task=')) {
                const task = JSON.parse(line.substring(line.indexOf('=') + 1).trim());
                task.Instances = [];
                tasks.push(task);
            }
            else if (line.trim().startsWith('//Instance=')) {
                const instance = JSON.parse(line.substring(line.indexOf('=') + 1).trim());
                const task = tasks.find((t) => t.Name === instance.AssociatedTaskName);
                if (task) {
                    task.Instances.push(instance);
                }
            }
            else if (line.trim().startsWith('//Map=')) {
                mapCode += `mapIO("${line.substring(line.indexOf('=') + 1).trim()}");\n`;
            }
            else if (line.indexOf('//Global=') > -1) {
                const global = JSON.parse(line.substring(line.indexOf('=') + 1).trim());
                globals.push(`modbusServer.mapVariable("${global.Name}", "${global.Address}");`);
            }
            else if (line.trim().startsWith('PROGRAM')) {
                let pname = line.trim().substring(line.trim().indexOf(' ') + 1).trim();
                if (pname.includes(' ')) {
                    pname = pname.substring(pname.indexOf(' ') + 1);
                }
                if (pname.includes('//')) {
                    pname = pname.substring(pname.indexOf('//') + 1);
                }
                if (pname.includes('(*')) {
                    pname = pname.substring(pname.indexOf('(*') + 1);
                }
                programs.push(pname);
            }
        });

        if (tasks.length > 0) {
            tasks.forEach((t) => {
                let progCode = '';
                t.Instances.forEach((i) => {
                    progCode += i.TypeName + '();\n';
                });
                taskCode += `\n    if(PROGRAM_COUNT % ${t.Interval} == 0){\n        ${progCode}\n    }\n`;
            });
        }
        else if (directoryBundleMode) {
            taskCode += `\n    if(PROGRAM_COUNT % 100 == 0){\n        ${bundleEntryProgram}();\n    }\n`;
        }
        else {
            programs.forEach((p) => {
                taskCode += p + '();\n';
            });
        }

        const inoCode = `#include "nodalis.h"
#include <stdint.h>
#include <Ethernet.h>
#include "modbus.h"
#include "network_config.h"

NodalisModbusTcpServer modbusServer;
IPAddress localIp;

#if defined(LEDR)
const int NODALIS_HEARTBEAT_LED_PIN = LEDR;
#elif defined(LED_BUILTIN)
const int NODALIS_HEARTBEAT_LED_PIN = LED_BUILTIN;
#else
const int NODALIS_HEARTBEAT_LED_PIN = -1;
#endif

void nodalisHeartbeatTask() {
  if (NODALIS_HEARTBEAT_LED_PIN < 0) {
    return;
  }

  static uint64_t lastToggle = 0;
  static bool ledState = false;
  const uint64_t now = elapsed();
  if (now - lastToggle < 500) {
    return;
  }

  lastToggle = now;
  ledState = !ledState;
  digitalWrite(NODALIS_HEARTBEAT_LED_PIN, ledState ? HIGH : LOW);
}
${transpiledCode}

void setup() {
  Serial.begin(115200);
  nodalisLogInfo("Setup starting");
  if (NODALIS_HEARTBEAT_LED_PIN >= 0) {
    pinMode(NODALIS_HEARTBEAT_LED_PIN, OUTPUT);
    digitalWrite(NODALIS_HEARTBEAT_LED_PIN, LOW);
  }
  localIp = nodalisLoadIpAddress();
  nodalisBeginEthernet(localIp);
  nodalisLogInfo("Ethernet initialized");
  ${globals.join('\n')}
  if (!modbusServer.start()) {
    nodalisLogError("Modbus server start failed");
  }
  ${mapCode}
  nodalisLogInfo("Setup complete");
}

void loop() {
  nodalisPollSerialIpConfig(localIp);
  modbusServer.poll();
  superviseIO();
  nodalisHeartbeatTask();
  ${taskCode}
  delay(1);
  PROGRAM_COUNT++;
  if(PROGRAM_COUNT == UINT64_MAX){
      PROGRAM_COUNT = 0;
  }
}`;

        fs.mkdirSync(outputPath, { recursive: true });
        fs.writeFileSync(inoFile, inoCode);
        if (sourcePath.toLowerCase().endsWith('.iec') || sourcePath.toLowerCase().endsWith('.xml')) {
            fs.writeFileSync(stFile, sourceCode);
        }

        const supportDir = path.resolve(__dirname + '/support/arduino');
        fs.cpSync(path.join(supportDir, 'nodalis.h'), path.join(outputPath, 'nodalis.h'), { force: true });
        fs.cpSync(path.join(supportDir, 'nodalis.cpp'), path.join(outputPath, 'nodalis.cpp'), { force: true });
        fs.cpSync(path.join(supportDir, 'modbus.h'), path.join(outputPath, 'modbus.h'), { force: true });
        fs.cpSync(path.join(supportDir, 'modbus.cpp'), path.join(outputPath, 'modbus.cpp'), { force: true });
        fs.cpSync(path.join(supportDir, 'gpio.h'), path.join(outputPath, 'gpio.h'), { force: true });
        fs.cpSync(path.join(supportDir, 'gpio.cpp'), path.join(outputPath, 'gpio.cpp'), { force: true });
        fs.cpSync(path.join(supportDir, 'network_config.h'), path.join(outputPath, 'network_config.h'), { force: true });
        fs.cpSync(path.join(supportDir, 'network_config.cpp'), path.join(outputPath, 'network_config.cpp'), { force: true });
        fs.cpSync(path.join(supportDir, 'json.hpp'), path.join(outputPath, 'json.hpp'), { force: true });

        if (this.isExecutableOutput()) {
            const arduinoCli = compilerConfig.arduino_cli || compilerConfig.arduinoCli || getManagedArduinoCliPath();
            const arduinoFqbn = this.resolveArduinoFqbn(target, compilerConfig);
            if (!arduinoFqbn) {
                throw new Error(`No Arduino FQBN configured for target "${target}". Use an explicit FQBN target (e.g. arduino:mbed_opta:opta) or add "arduino_fqbn" to toolchain.json.`);
            }

            this.assertArduinoModbusTargetSupported(arduinoFqbn);
            this.ensureArduinoCoreInstalled(arduinoCli, arduinoFqbn);

            const buildDir = path.join(outputPath, 'build');
            const binDir = this.getExecutableOutputPath();
            fs.mkdirSync(buildDir, { recursive: true });
            fs.mkdirSync(binDir, { recursive: true });
            const arduinoCompileCmd = `${arduinoCli} compile --fqbn "${arduinoFqbn}" "${outputPath}" --build-path "${buildDir}" --output-dir "${binDir}" --export-binaries`;
            try {
                execSync(arduinoCompileCmd, getManagedArduinoCliExecOptions({ stdio: 'pipe' }));
            } catch (err) {
                const stderrText = getExecOutputText(err?.stderr);
                const stdoutText = getExecOutputText(err?.stdout);
                const compilerOutput = [stderrText, stdoutText].filter(Boolean).join('\n');
                const missingArduinoLibrary = compilerOutput.includes('ArduinoModbus.h') || compilerOutput.includes('No such file or directory');
                const details = compilerOutput || err.message;
                throw new Error(
                    `Arduino CLI build failed for "${arduinoFqbn}". ` +
                    `${missingArduinoLibrary
                        ? 'Run "nodalis --action get-toolchains" to install the managed Arduino cores and libraries.'
                        : 'Verify arduino-cli, board core, and library availability.'}\n${details}`
                );
            }
        }
    }

    resolveArduinoFqbn(target, compilerConfig = {}) {
        const explicit = compilerConfig.arduino_fqbn || compilerConfig.arduinoFqbn;
        if (explicit && typeof explicit === 'string' && explicit.includes(':')) {
            return explicit;
        }
        if (typeof target === 'string' && target.startsWith('arduino:')) {
            return target;
        }
        if (typeof target === 'string' && UNSUPPORTED_ARDUINO_TARGET_ALIASES[target]) {
            return UNSUPPORTED_ARDUINO_TARGET_ALIASES[target];
        }
        const table = this.getArduinoTargetTable();
        return table.targetToFqbn[target] || DEFAULT_ARDUINO_FQBN[target] || null;
    }

    ensureArduinoCoreInstalled(arduinoCli, arduinoFqbn) {
        const fqbnParts = arduinoFqbn.split(':');
        if (fqbnParts.length < 3) {
            throw new Error(`Invalid Arduino FQBN "${arduinoFqbn}".`);
        }
        const coreId = `${fqbnParts[0]}:${fqbnParts[1]}`;

        let coreList = '';
        try {
            coreList = execSync(`${arduinoCli} core list`, getManagedArduinoCliExecOptions({ encoding: 'utf8' }));
        } catch (err) {
            throw new Error(`Failed to query installed Arduino cores using "${arduinoCli}". ${err.message}`);
        }
        if (coreList.includes(coreId)) {
            return;
        }

        try {
            execSync(`${arduinoCli} core update-index`, getManagedArduinoCliExecOptions({ stdio: 'inherit' }));
            execSync(`${arduinoCli} core install ${coreId}`, getManagedArduinoCliExecOptions({ stdio: 'inherit' }));
        } catch (err) {
            throw new Error(`Failed to install Arduino core "${coreId}" required for ${arduinoFqbn}. ${err.message}`);
        }
    }

    assertArduinoModbusTargetSupported(arduinoFqbn) {
        if (UNSUPPORTED_ARDUINO_MODBUS_FQBNS.has(arduinoFqbn)) {
            throw new Error(
                `Arduino target "${arduinoFqbn}" is currently unsupported for Modbus-TCP builds. ` +
                'Use a supported target like "arduino:mbed_portenta:envie_m7" or "arduino:mbed_opta:opta".'
            );
        }
    }

    getArduinoTargetTable(refresh = false) {
        if (!refresh && CachedArduinoTargetTable) {
            return CachedArduinoTargetTable;
        }

        const targetToFqbn = { ...DEFAULT_ARDUINO_FQBN };
        const targets = Object.keys(DEFAULT_ARDUINO_FQBN);

        try {
            const boardListRaw = execSync(
                `${getManagedArduinoCliPath()} board listall --format json`,
                getManagedArduinoCliExecOptions({ encoding: 'utf8' })
            );
            const boardList = JSON.parse(boardListRaw);
            const boards = Array.isArray(boardList.boards) ? boardList.boards : [];

            for (const board of boards) {
                const fqbn = board?.fqbn;
                if (!fqbn || typeof fqbn !== 'string') {
                    continue;
                }
                const parts = fqbn.split(':');
                if (parts.length < 3) {
                    continue;
                }
                const coreId = `${parts[0]}:${parts[1]}`;
                if (!MODBUS_ARDUINO_CORE_IDS.has(coreId)) {
                    continue;
                }
                if (UNSUPPORTED_ARDUINO_MODBUS_FQBNS.has(fqbn)) {
                    continue;
                }

                if (!targetToFqbn[fqbn]) {
                    targetToFqbn[fqbn] = fqbn;
                    targets.push(fqbn);
                }

                const boardId = parts[2];
                const alias = `arduino-${boardId.toLowerCase()}`;
                if (!targetToFqbn[alias]) {
                    targetToFqbn[alias] = fqbn;
                    targets.push(alias);
                }

                const boardName = typeof board?.name === 'string' ? board.name : '';
                if (boardName.length > 0) {
                    let nameSlug = boardName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                    nameSlug = nameSlug.replace(/^arduino-/, '');
                    if (nameSlug.length > 0) {
                        const nameAlias = `arduino-${nameSlug}`;
                        if (!targetToFqbn[nameAlias]) {
                            targetToFqbn[nameAlias] = fqbn;
                            targets.push(nameAlias);
                        }
                    }
                }
            }
        } catch {
            // Keep defaults when arduino-cli is unavailable.
        }

        CachedArduinoTargetTable = { targetToFqbn, targets };
        return CachedArduinoTargetTable;
    }
}

export default ArduinoCompiler;

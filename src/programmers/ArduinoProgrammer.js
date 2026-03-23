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

import fs from 'fs/promises';
import path from 'path';
import { Programmer } from './Programmer.js';
import { runCommand } from './utils.js';
import { getManagedArduinoCliExecOptions, getManagedArduinoCliPath } from '../toolchains.js';

const ARDUINO_UPLOAD_NON_FATAL_STDERR_PATTERNS = [
  /dfu-util:\s*Warning:\s*Invalid DFU suffix signature/i,
  /dfu-util:\s*A valid DFU suffix will be required in a future dfu-util release/i
];

function classifyUploadStderr(stderrText) {
  const lines = String(stderrText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { fatal: [], nonFatal: [] };
  }

  const fatal = [];
  const nonFatal = [];

  for (const line of lines) {
    const isKnownNonFatal = ARDUINO_UPLOAD_NON_FATAL_STDERR_PATTERNS.some(pattern => pattern.test(line));
    if (isKnownNonFatal) {
      nonFatal.push(line);
      continue;
    }
    fatal.push(line);
  }

  return { fatal, nonFatal };
}

export class ArduinoProgrammer extends Programmer {
  constructor(options) {
    super(options);
    this.name = 'ArduinoProgrammer';
    this.target = 'arduino';
    this.required = ["fqbn"];
  }

  async program() {
    const source = this.options?.source;
    const port = this.options?.destination;
    const fqbn = this.options?.arduinoFqbn || this.options?.fqbn;

    if (!source || !port || !fqbn) {
      throw new Error('ArduinoProgrammer requires source, destination (serial port), and arduinoFqbn.');
    }

    const sourcePath = path.resolve(source);
    const sourceStat = await fs.stat(sourcePath);

    const args = ['upload', '-p', port, '--fqbn', fqbn];

    if (!sourceStat.isDirectory()) {
      const ext = path.extname(sourcePath).toLowerCase();
      if (ext === '.hex' || ext === '.bin') {
        args.push('--input-file', sourcePath);
      }
      else {
        args.push(path.dirname(sourcePath));
      }
    }
    else {
      const entries = await fs.readdir(sourcePath);
      const hasSketch = entries.some(file => file.endsWith('.ino'));
      if (hasSketch) {
        args.push(sourcePath);
      }
      else {
        args.push('--input-dir', sourcePath);
      }
    }

    const { stdout, stderr } = await runCommand(
      getManagedArduinoCliPath(),
      args,
      getManagedArduinoCliExecOptions()
    );
    if (stdout) {
      console.log(stdout.trim());
    }
    if (stderr) {
      const { fatal, nonFatal } = classifyUploadStderr(stderr);
      if (nonFatal.length > 0) {
        console.log(nonFatal.join('\n'));
      }
      if (fatal.length > 0) {
        console.error(fatal.join('\n'));
      }
    }

    return true;
  }
}

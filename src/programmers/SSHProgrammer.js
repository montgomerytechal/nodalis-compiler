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
import os from 'os';
import path from 'path';
import readline from 'readline/promises';
import { stdin, stdout } from 'process';
import { Programmer } from './Programmer.js';
import {
  copyPathToDirectory,
  DEPLOY_EXCLUDED_DIRECTORIES,
  ensureDirectory,
  inferEntryPoint,
  inferRuntime,
  quoteForPosixSingle,
  runCommand,
  runCommandInteractive,
  sanitizeName,
  shouldIncludeDeployPayloadFile,
  toPosixPath
} from './utils.js';

export class SSHProgrammer extends Programmer {
  constructor(options) {
    super(options);
    this.name = 'SSHProgrammer';
    this.target = 'SSH';
  }

  async program() {
    const source = this.options?.source;
    const destination = this.options?.destination;
    if (!source || !destination) {
      throw new Error('SSHProgrammer requires source and destination. Destination must be host or host:/path.');
    }

    const sourcePath = path.resolve(source);
    const sourceStat = await fs.stat(sourcePath);
    const packageName = sanitizeName(
      this.options?.packageName || path.basename(sourcePath, path.extname(sourcePath)),
      'nodalis-app'
    );

    const { host, remotePathFromDestination } = this.#parseDestination(destination);
    const remotePath = this.options?.remotePath || remotePathFromDestination || `/opt/${packageName}`;
    const sshPort = String(this.options?.sshPort || 22);

    const credentials = await this.#resolveCredentials(this.options?.username, this.options?.password);

    const entryPoint = await inferEntryPoint(sourcePath, this.options?.runtime || 'auto', this.options?.entryPoint);
    const normalizedEntryPoint = toPosixPath(entryPoint);
    const entryPointSourcePath = sourceStat.isDirectory()
      ? path.join(sourcePath, normalizedEntryPoint)
      : sourcePath;
    if (!await shouldIncludeDeployPayloadFile(entryPointSourcePath)) {
      throw new Error(`Entry point "${entryPoint}" is not deployable. Payload only includes JS and binary files.`);
    }
    const runtime = inferRuntime(normalizedEntryPoint, this.options?.runtime || 'auto');
    const remoteProgramPath = `${remotePath}/${normalizedEntryPoint}`;
    const launchCommand = runtime === 'node'
      ? `node ${quoteForPosixSingle(remoteProgramPath)}`
      : quoteForPosixSingle(remoteProgramPath);

    let payloadTempRoot = '';
    let transferSourcePath = sourcePath;
    if (sourceStat.isDirectory()) {
      payloadTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nodalis-ssh-'));
      transferSourcePath = path.join(payloadTempRoot, 'payload');
      await ensureDirectory(transferSourcePath);
      await copyPathToDirectory(sourcePath, transferSourcePath, {
        filter: shouldIncludeDeployPayloadFile,
        excludeDirectoryNames: [...DEPLOY_EXCLUDED_DIRECTORIES]
      });
    }
    else if (!await shouldIncludeDeployPayloadFile(sourcePath, sourceStat)) {
      throw new Error('Source file is not deployable. Payload only includes JS and binary files.');
    }

    try {
      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        `mkdir -p ${quoteForPosixSingle(remotePath)}`
      ]);

      if (sourceStat.isDirectory()) {
        await this.#runScp(credentials.password, [
          '-P',
          sshPort,
          '-r',
          `${transferSourcePath}/.`,
          `${credentials.username}@${host}:${remotePath}/`
        ]);
      }
      else {
        await this.#runScp(credentials.password, [
          '-P',
          sshPort,
          sourcePath,
          `${credentials.username}@${host}:${remotePath}/`
        ]);
      }

      const cronLine = `@reboot ${launchCommand}`;
      const remoteScript = `CRON_LINE=${quoteForPosixSingle(cronLine)}; (crontab -l 2>/dev/null | grep -F -v \"${'$'}CRON_LINE\"; echo \"${'$'}CRON_LINE\") | crontab -`;

      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        `sh -lc ${quoteForPosixSingle(remoteScript)}`
      ]);
    }
    finally {
      if (payloadTempRoot) {
        await fs.rm(payloadTempRoot, { recursive: true, force: true });
      }
    }

    return true;
  }

  #parseDestination(destination) {
    const splitIndex = destination.indexOf(':');
    if (splitIndex === -1) {
      return { host: destination, remotePathFromDestination: '' };
    }

    return {
      host: destination.substring(0, splitIndex),
      remotePathFromDestination: destination.substring(splitIndex + 1)
    };
  }

  async #resolveCredentials(username, password) {
    let resolvedUsername = username;
    let resolvedPassword = password;

    if (resolvedUsername && resolvedPassword) {
      return { username: resolvedUsername, password: resolvedPassword };
    }

    const rl = readline.createInterface({
      input: stdin,
      output: stdout
    });

    try {
      if (!resolvedUsername) {
        resolvedUsername = (await rl.question('SSH username: ')).trim();
      }

      if (!resolvedPassword) {
        resolvedPassword = (await rl.question('SSH password (leave blank for key/interactive auth): ')).trim();
      }
    }
    finally {
      rl.close();
    }

    return {
      username: resolvedUsername,
      password: resolvedPassword
    };
  }

  async #commandExists(command) {
    try {
      await runCommand('which', [command]);
      return true;
    }
    catch {
      return false;
    }
  }

  async #runScp(password, args) {
    if (password && await this.#commandExists('sshpass')) {
      await runCommandInteractive('sshpass', ['-p', password, 'scp', ...args]);
      return;
    }

    await runCommandInteractive('scp', args);
  }

  async #runSsh(password, args) {
    if (password && await this.#commandExists('sshpass')) {
      await runCommandInteractive('sshpass', ['-p', password, 'ssh', ...args]);
      return;
    }

    await runCommandInteractive('ssh', args);
  }
}

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
    this.required = ["username", "password"];
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
    const remoteStagingPath = `/tmp/${packageName}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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
        `mkdir -p ${quoteForPosixSingle(remoteStagingPath)}`
      ]);

      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        this.#buildSudoCommand(
          credentials.password,
          `mkdir -p ${quoteForPosixSingle(remotePath)}`
        )
      ]);

      if (sourceStat.isDirectory()) {
        await this.#runScp(credentials.password, [
          '-P',
          sshPort,
          '-r',
          `${transferSourcePath}/.`,
          `${credentials.username}@${host}:${remoteStagingPath}/`
        ]);
      }
      else {
        await this.#runScp(credentials.password, [
          '-P',
          sshPort,
          sourcePath,
          `${credentials.username}@${host}:${remoteStagingPath}/`
        ]);
      }

      const installCommand = sourceStat.isDirectory()
        ? `cp -a ${quoteForPosixSingle(`${remoteStagingPath}/.`)} ${quoteForPosixSingle(`${remotePath}/`)}`
        : `cp -a ${quoteForPosixSingle(path.posix.join(remoteStagingPath, path.basename(sourcePath)))} ${quoteForPosixSingle(`${remotePath}/`)}`;

      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        this.#buildSudoCommand(credentials.password, this.#buildStopProgramCommand(remoteProgramPath, runtime))
      ]);

      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        this.#buildSudoCommand(credentials.password, installCommand)
      ]);

      const cronLine = `@reboot ${launchCommand}`;
      const remoteScript = `CRON_LINE=${quoteForPosixSingle(cronLine)}; (crontab -l 2>/dev/null | grep -F -v "${'$'}CRON_LINE"; echo "${'$'}CRON_LINE") | crontab -`;

      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        this.#buildSudoCommand(credentials.password, remoteScript)
      ]);

      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        this.#buildSudoCommand(credentials.password, 'reboot')
      ]);
    }
    finally {
      await this.#cleanupRemoteStaging(credentials, host, sshPort, remoteStagingPath);
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
    if (password) {
      if (await this.#commandExists('sshpass')) {
        await runCommandInteractive('sshpass', ['-p', password, 'scp', ...args]);
        return;
      }

      await this.#runWithSshAskPass('scp', args, password);
      return;
    }

    await runCommandInteractive('scp', args);
  }

  async #runSsh(password, args) {
    const sshArgs = ['-tt', ...args];

    if (password) {
      if (await this.#commandExists('sshpass')) {
        await runCommandInteractive('sshpass', ['-p', password, 'ssh', ...sshArgs]);
        return;
      }

      await this.#runWithSshAskPass('ssh', sshArgs, password);
      return;
    }

    await runCommandInteractive('ssh', sshArgs);
  }

  #buildSudoCommand(password, command) {
    if (password) {
      return `echo ${quoteForPosixSingle(password)} | sudo -S -p '' sh -lc ${quoteForPosixSingle(command)}`;
    }

    return `sudo sh -lc ${quoteForPosixSingle(command)}`;
  }

  #buildStopProgramCommand(remoteProgramPath, runtime) {
    const quotedPath = quoteForPosixSingle(remoteProgramPath);
    const quotedProgramName = quoteForPosixSingle(path.posix.basename(remoteProgramPath));
    return `
if command -v pgrep >/dev/null 2>&1; then
  if [ ${quoteForPosixSingle(runtime)} = 'node' ]; then
    pids=$(ps -eo pid=,args= | awk '
      index($0, ${quotedPath}) > 0 && $1 != "'$$'" && $1 != "'"$PPID"'" { print $1 }
    ' 2>/dev/null || true)
  else
    pids=$(pgrep -x -- ${quotedProgramName} 2>/dev/null || true)
  fi

  target_pids=""
  for pid in $pids; do
    if [ "$pid" = "$$" ] || [ "$pid" = "$PPID" ]; then
      continue
    fi
    target_pids="$target_pids $pid"
  done

  if [ -n "$target_pids" ]; then
    kill $target_pids >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5; do
      sleep 1
      remaining=""
      for pid in $target_pids; do
        if kill -0 "$pid" >/dev/null 2>&1; then
          remaining="$remaining $pid"
        fi
      done
      if [ -z "$remaining" ]; then
        exit 0
      fi
      target_pids="$remaining"
    done
    kill -9 $target_pids >/dev/null 2>&1 || true
  fi
fi
`.trim();
  }

  async #cleanupRemoteStaging(credentials, host, sshPort, remoteStagingPath) {
    if (!remoteStagingPath) {
      return;
    }

    try {
      await this.#runSsh(credentials.password, [
        '-p',
        sshPort,
        `${credentials.username}@${host}`,
        `rm -rf ${quoteForPosixSingle(remoteStagingPath)}`
      ]);
    }
    catch {
      // Cleanup is best effort; deployment already succeeded or failed for another reason.
    }
  }

  async #runWithSshAskPass(command, args, password) {
    const askPassPath = path.join(os.tmpdir(), `nodalis-askpass-${process.pid}-${Date.now()}.sh`);

    try {
      await fs.writeFile(askPassPath, `#!/bin/sh\necho ${quoteForPosixSingle(password)}\n`, 'utf8');
      await fs.chmod(askPassPath, 0o700);
      await runCommandInteractive(command, args, {
        env: {
          ...process.env,
          SSH_ASKPASS: askPassPath,
          SSH_ASKPASS_REQUIRE: 'force',
          DISPLAY: process.env.DISPLAY || 'nodalis:0'
        }
      });
    }
    finally {
      await fs.rm(askPassPath, { force: true });
    }
  }
}

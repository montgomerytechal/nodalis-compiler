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
import {
  copyPathToDirectory,
  createZipArchive,
  DEPLOY_EXCLUDED_DIRECTORIES,
  ensureDirectory,
  inferEntryPoint,
  inferRuntime,
  sanitizeName,
  shouldIncludeDeployPayloadFile,
  toPosixPath
} from './utils.js';

export class FileProgrammer extends Programmer {
  constructor(options) {
    super(options);
    this.name = 'FileProgrammer';
    this.target = 'FILE';
  }

  async program() {
    const source = this.options?.source;
    const destination = this.options?.destination;
    if (!source || !destination) {
      throw new Error('FileProgrammer requires both source and destination paths.');
    }

    const sourcePath = path.resolve(source);
    const sourceStat = await fs.stat(sourcePath);
    const destinationPath = path.resolve(destination);
    const packageName = sanitizeName(
      this.options?.packageName || path.basename(sourcePath, path.extname(sourcePath)),
      'nodalis-app'
    );

    await ensureDirectory(destinationPath);

    const buildDirectory = path.join(destinationPath, `${packageName}-bundle`);
    const payloadDirectory = path.join(buildDirectory, 'payload');
    await fs.rm(buildDirectory, { recursive: true, force: true });
    await ensureDirectory(payloadDirectory);

    const excludePathPrefixes = sourceStat.isDirectory() && this.#isWithinDirectory(sourcePath, destinationPath)
      ? [destinationPath]
      : [];
    await copyPathToDirectory(sourcePath, payloadDirectory, {
      filter: shouldIncludeDeployPayloadFile,
      excludeDirectoryNames: [...DEPLOY_EXCLUDED_DIRECTORIES],
      excludePathPrefixes
    });

    const entryPoint = await inferEntryPoint(sourcePath, this.options?.runtime || 'auto', this.options?.entryPoint);
    const entryPointSourcePath = sourceStat.isDirectory()
      ? path.join(sourcePath, entryPoint)
      : sourcePath;
    if (!await shouldIncludeDeployPayloadFile(entryPointSourcePath)) {
      throw new Error(`Entry point "${entryPoint}" is not deployable. Payload only includes JS and binary files.`);
    }
    const runtime = inferRuntime(entryPoint, this.options?.runtime || 'auto');
    const normalizedEntryPoint = toPosixPath(entryPoint);

    await this.#createRuntimeScripts(buildDirectory, normalizedEntryPoint, runtime);
    await this.#createInstallScripts(buildDirectory, packageName);

    const zipPath = path.join(destinationPath, `${packageName}.zip`);
    await createZipArchive(buildDirectory, zipPath);

    await this.#createBootstrapScripts(destinationPath, packageName, zipPath);

    return true;
  }

  #isWithinDirectory(parentPath, childPath) {
    const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  async #createRuntimeScripts(buildDirectory, entryPoint, runtime) {
    const runSh = `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${'$'}{BASH_SOURCE[0]}")" && pwd)"
if [ "${runtime}" = "node" ]; then
  exec node "${'$'}SCRIPT_DIR/payload/${entryPoint}"
fi
exec "${'$'}SCRIPT_DIR/payload/${entryPoint}"
`;

    const runCmd = `@echo off
set SCRIPT_DIR=%~dp0
if /I "${runtime}"=="node" (
  node "%SCRIPT_DIR%payload\\${entryPoint.replaceAll('/', '\\')}"
) else (
  "%SCRIPT_DIR%payload\\${entryPoint.replaceAll('/', '\\')}"
)
`;

    await fs.writeFile(path.join(buildDirectory, 'run.sh'), runSh, 'utf8');
    await fs.chmod(path.join(buildDirectory, 'run.sh'), 0o755);
    await fs.writeFile(path.join(buildDirectory, 'run.cmd'), runCmd, 'utf8');
  }

  async #createInstallScripts(buildDirectory, packageName) {
    const installLinux = `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${'$'}{BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${'$'}{1:-/opt/${packageName}}"
SERVICE_NAME="${'$'}{2:-${packageName}}"

mkdir -p "${'$'}INSTALL_DIR"
cp -R "${'$'}SCRIPT_DIR/"* "${'$'}INSTALL_DIR/"
chmod +x "${'$'}INSTALL_DIR/run.sh"

if command -v systemctl >/dev/null 2>&1 && [ "${'$'}(id -u)" -eq 0 ]; then
  cat > "/etc/systemd/system/${'$'}SERVICE_NAME.service" <<SERVICE
[Unit]
Description=Nodalis ${packageName}
After=network.target

[Service]
Type=simple
ExecStart=${'$'}INSTALL_DIR/run.sh
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
SERVICE
  systemctl daemon-reload
  systemctl enable "${'$'}SERVICE_NAME"
  systemctl restart "${'$'}SERVICE_NAME"
else
  CRON_LINE="@reboot ${'$'}INSTALL_DIR/run.sh"
  (crontab -l 2>/dev/null | grep -F -v "${'$'}CRON_LINE"; echo "${'$'}CRON_LINE") | crontab -
fi

echo "Installed ${packageName} to ${'$'}INSTALL_DIR"
`;

    const installWindows = `param(
  [string]${'$'}InstallDir = "${'$'}env:ProgramData\\Nodalis\\${packageName}",
  [string]${'$'}TaskName = "${packageName}"
)

${'$'}ScriptDir = Split-Path -Parent ${'$'}MyInvocation.MyCommand.Path
New-Item -Path ${'$'}InstallDir -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path ${'$'}ScriptDir '*') -Destination ${'$'}InstallDir -Recurse -Force

${'$'}runCmd = Join-Path ${'$'}InstallDir 'run.cmd'
${'$'}taskCommand = '"' + ${'$'}runCmd + '"'
schtasks /Create /TN ${'$'}TaskName /TR ${'$'}taskCommand /SC ONSTART /RL HIGHEST /F | Out-Null
Write-Host "Installed ${packageName} to ${'$'}InstallDir"
`;

    await fs.writeFile(path.join(buildDirectory, 'install-linux.sh'), installLinux, 'utf8');
    await fs.chmod(path.join(buildDirectory, 'install-linux.sh'), 0o755);
    await fs.writeFile(path.join(buildDirectory, 'install-windows.ps1'), installWindows, 'utf8');
  }

  async #createBootstrapScripts(destinationDirectory, packageName, zipPath) {
    const zipName = path.basename(zipPath);

    const deployLinux = `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${'$'}{BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${'$'}{1:-${'$'}SCRIPT_DIR/${packageName}}"
INSTALL_DIR="${'$'}{2:-/opt/${packageName}}"
SERVICE_NAME="${'$'}{3:-${packageName}}"

mkdir -p "${'$'}WORK_DIR"
unzip -o "${'$'}SCRIPT_DIR/${zipName}" -d "${'$'}WORK_DIR"
bash "${'$'}WORK_DIR/install-linux.sh" "${'$'}INSTALL_DIR" "${'$'}SERVICE_NAME"
`;

    const deployWindows = `param(
  [string]${'$'}WorkDir = (Join-Path ${'$'}PSScriptRoot '${packageName}'),
  [string]${'$'}InstallDir = "${'$'}env:ProgramData\\Nodalis\\${packageName}",
  [string]${'$'}TaskName = "${packageName}"
)

New-Item -Path ${'$'}WorkDir -ItemType Directory -Force | Out-Null
Expand-Archive -Path (Join-Path ${'$'}PSScriptRoot '${zipName}') -DestinationPath ${'$'}WorkDir -Force
& (Join-Path ${'$'}WorkDir 'install-windows.ps1') -InstallDir ${'$'}InstallDir -TaskName ${'$'}TaskName
`;

    await fs.writeFile(path.join(destinationDirectory, `${packageName}-deploy-linux.sh`), deployLinux, 'utf8');
    await fs.chmod(path.join(destinationDirectory, `${packageName}-deploy-linux.sh`), 0o755);
    await fs.writeFile(path.join(destinationDirectory, `${packageName}-deploy-windows.ps1`), deployWindows, 'utf8');
  }
}

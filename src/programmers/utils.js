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
import { spawn } from 'child_process';

const DEPLOYABLE_JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const DEPLOYABLE_BINARY_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.node',
  '.bin',
  '.elf',
  '.out',
  '.wasm',
  '.sh',
  '.ps1',
  '.bat'
]);
const EXCLUDED_STATIC_LIBRARY_EXTENSIONS = new Set(['.a', '.lib', '.o', '.pdb']);
export const DEPLOY_EXCLUDED_DIRECTORIES = new Set(['bacnet-stack', 'open62541']);

export async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      reject(new Error(`Command failed (${command} ${args.join(' ')}): ${stderr || stdout}`));
    });
  });
}

export async function runCommandInteractive(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve({ code });
        return;
      }
      reject(new Error(`Command failed (${command} ${args.join(' ')}) with exit code ${code}`));
    });
  });
}

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  }
  catch {
    return false;
  }
}

export async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function shouldIncludeDeployPayloadFile(filePath, stat) {
  const fileStat = stat || await fs.stat(filePath);
  if (!fileStat.isFile()) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (DEPLOYABLE_JS_EXTENSIONS.has(extension)) {
    return true;
  }

  if (EXCLUDED_STATIC_LIBRARY_EXTENSIONS.has(extension)) {
    return false;
  }

  if (DEPLOYABLE_BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  return extension.length === 0 && (fileStat.mode & 0o111) !== 0;
}

export async function copyPathToDirectory(sourcePath, destinationDir, options = {}) {
  const filter = options?.filter;
  const excludeDirectoryNames = new Set(
    (Array.isArray(options?.excludeDirectoryNames) ? options.excludeDirectoryNames : [])
      .map(name => String(name).toLowerCase())
  );
  const excludePathPrefixes = Array.isArray(options?.excludePathPrefixes)
    ? options.excludePathPrefixes.map(candidate => path.resolve(candidate))
    : [];
  const isExcludedPath = candidatePath => {
    const resolvedCandidate = path.resolve(candidatePath);
    return excludePathPrefixes.some(prefix => {
      const relative = path.relative(prefix, resolvedCandidate);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  };
  const isExcludedDirectoryByName = candidatePath =>
    excludeDirectoryNames.has(path.basename(candidatePath).toLowerCase());
  const cpFilter = filter
    ? async candidateSourcePath => {
      if (isExcludedPath(candidateSourcePath)) {
        return false;
      }
      const candidateStat = await fs.stat(candidateSourcePath);
      if (candidateStat.isDirectory()) {
        if (isExcludedDirectoryByName(candidateSourcePath)) {
          return false;
        }
        return true;
      }
      return Boolean(await filter(candidateSourcePath, candidateStat));
    }
    : undefined;

  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(sourcePath);
    for (const entry of entries) {
      const entrySourcePath = path.join(sourcePath, entry);
      if (isExcludedPath(entrySourcePath)) {
        continue;
      }
      const entryStat = await fs.stat(entrySourcePath);
      if (entryStat.isDirectory() && isExcludedDirectoryByName(entrySourcePath)) {
        continue;
      }
      await fs.cp(entrySourcePath, path.join(destinationDir, entry), {
        recursive: true,
        force: true,
        filter: cpFilter
      });
    }
    return;
  }

  if (isExcludedPath(sourcePath)) {
    return;
  }

  if (filter && !await filter(sourcePath, stat)) {
    return;
  }

  await fs.cp(sourcePath, path.join(destinationDir, path.basename(sourcePath)), {
    recursive: false,
    force: true
  });
}

export async function createZipArchive(sourceDirectory, destinationZipPath) {
  await fs.rm(destinationZipPath, { force: true });

  if (process.platform === 'win32') {
    const escapedSource = `${sourceDirectory.replace(/'/g, "''")}\\*`;
    const escapedDestination = destinationZipPath.replace(/'/g, "''");
    const script = `Compress-Archive -Path '${escapedSource}' -DestinationPath '${escapedDestination}' -Force`;
    await runCommand('powershell', ['-NoProfile', '-Command', script]);
    return;
  }

  await runCommand('zip', ['-r', destinationZipPath, '.'], { cwd: sourceDirectory });
}

export function sanitizeName(name, fallback = 'nodalis-deploy') {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return fallback;
  }
  return name.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function toPosixPath(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

export function inferRuntime(entryPoint, runtime = 'auto') {
  if (runtime && runtime !== 'auto') {
    return runtime;
  }

  const extension = path.extname(entryPoint || '').toLowerCase();
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
    return 'node';
  }

  return 'executable';
}

export async function inferEntryPoint(sourcePath, runtime = 'auto', providedEntryPoint) {
  if (providedEntryPoint && providedEntryPoint.trim()) {
    return providedEntryPoint.trim();
  }

  const stat = await fs.stat(sourcePath);
  if (!stat.isDirectory()) {
    return path.basename(sourcePath);
  }

  const candidates = ['nodalisplc', 'nodalisplc.exe', 'nodalisplc.js'];
  const candidateDirectories = ['bin', ''];
  for (const directory of candidateDirectories) {
    for (const candidate of candidates) {
      const relativeCandidate = directory ? path.join(directory, candidate) : candidate;
      if (await exists(path.join(sourcePath, relativeCandidate))) {
        return toPosixPath(relativeCandidate);
      }
    }
  }

  const inferredRuntime = inferRuntime('', runtime);
  if (inferredRuntime === 'node') {
    const binNodeEntry = path.join('bin', 'nodalisplc.js');
    if (await exists(path.join(sourcePath, binNodeEntry))) {
      return toPosixPath(binNodeEntry);
    }
    return "nodalisplc.js"
  }

  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile()).map(entry => entry.name);
  if (files.length > 0) {
    return files[0];
  }

  const binEntriesPath = path.join(sourcePath, 'bin');
  if (await exists(binEntriesPath)) {
    const binEntries = await fs.readdir(binEntriesPath, { withFileTypes: true });
    const binFiles = binEntries.filter(entry => entry.isFile()).map(entry => entry.name);
    if (binFiles.length > 0) {
      return toPosixPath(path.join('bin', binFiles[0]));
    }
  }

  throw new Error(`Could not infer entry point for source directory: ${sourcePath}`);
}

export function quoteForPosixSingle(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

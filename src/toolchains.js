import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { execFileSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { DEFAULT_ARDUINO_FQBNS } from './compilers/arduinoDefaults.js';

const ZIG_VERSION = '0.15.2';
const ARDUINO_CLI_VERSION = '1.3.1';
const TOOLCHAIN_ROOT = path.join(os.homedir(), '.nodalis', 'toolchains');
const WRAPPER_EXTENSION = process.platform === 'win32' ? '.cmd' : '';
const DEFAULT_ARDUINO_LIBRARIES = ['ArduinoModbus'];

const TARGET_TRIPLES = {
    'linux-arm': 'arm-linux-gnueabihf',
    'linux-arm64': 'aarch64-linux-gnu',
    'linux-x64': 'x86_64-linux-gnu',
    'macos-arm64': 'aarch64-macos',
    'macos-x64': 'x86_64-macos',
    'windows-arm64': 'aarch64-windows-gnu',
    'windows-x64': 'x86_64-windows-gnu'
};

const normalizeHostOS = (value) => {
    if (value === 'win32') return 'windows';
    if (value === 'darwin') return 'macos';
    if (value === 'linux') return 'linux';
    throw new Error(`Unsupported host operating system: ${value}`);
};

const normalizeHostArch = (value) => {
    if (value === 'x64') return 'x64';
    if (value === 'arm64') return 'arm64';
    if (value.startsWith('arm')) return 'arm';
    throw new Error(`Unsupported host architecture: ${value}`);
};

const stripArchiveExtension = (archiveName) => {
    if (archiveName.endsWith('.tar.gz')) return archiveName.slice(0, -7);
    if (archiveName.endsWith('.tar.xz')) return archiveName.slice(0, -7);
    if (archiveName.endsWith('.zip')) return archiveName.slice(0, -4);
    return archiveName;
};

const getWrapperDir = () => path.join(TOOLCHAIN_ROOT, 'zig', ZIG_VERSION, 'wrappers');

const getWrapperPath = (target) => path.join(getWrapperDir(), `zig-${target}-c++${WRAPPER_EXTENSION}`);

const getArduinoCliRootDir = () => path.join(TOOLCHAIN_ROOT, 'arduino-cli', ARDUINO_CLI_VERSION);

const getArduinoCliDataDir = () => path.join(getArduinoCliRootDir(), 'data');

const getArduinoCliDownloadsDir = () => path.join(getArduinoCliRootDir(), 'downloads');

const getArduinoCliUserDir = () => path.join(getArduinoCliRootDir(), 'user');

const getZigInstallDir = (host = detectHostPlatform()) => {
    const archiveName = getZigArchiveName(host);
    return path.join(TOOLCHAIN_ROOT, 'zig', ZIG_VERSION, stripArchiveExtension(archiveName));
};

const getZigBinaryPath = (host = detectHostPlatform()) => {
    const installDir = getZigInstallDir(host);
    return path.join(installDir, process.platform === 'win32' ? 'zig.exe' : 'zig');
};

const getArduinoCliArchiveName = (host = detectHostPlatform()) => {
    if (host.os === 'windows') {
        const archSegment = host.arch === 'arm64' ? 'Windows_ARM64' : host.arch === 'x64' ? 'Windows_64bit' : null;
        if (!archSegment) {
            throw new Error(`Unsupported Windows host architecture for arduino-cli: ${host.arch}`);
        }
        return `arduino-cli_${ARDUINO_CLI_VERSION}_${archSegment}.zip`;
    }

    if (host.os === 'macos') {
        const archSegment = host.arch === 'arm64' ? 'macOS_ARM64' : host.arch === 'x64' ? 'macOS_64bit' : null;
        if (!archSegment) {
            throw new Error(`Unsupported macOS host architecture for arduino-cli: ${host.arch}`);
        }
        return `arduino-cli_${ARDUINO_CLI_VERSION}_${archSegment}.tar.gz`;
    }

    if (host.os === 'linux') {
        if (host.arch === 'x64') return `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`;
        if (host.arch === 'arm64') return `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz`;
        if (host.arch === 'arm') return `arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARMv7.tar.gz`;
    }

    throw new Error(`Unsupported arduino-cli host platform ${host.os}-${host.arch}`);
};

const getArduinoCliInstallDir = (host = detectHostPlatform()) => {
    return path.join(getArduinoCliRootDir(), `${host.os}-${host.arch}`);
};

export const getManagedArduinoCliPath = (host = detectHostPlatform()) => {
    const installDir = getArduinoCliInstallDir(host);
    return path.join(installDir, host.os === 'windows' ? 'arduino-cli.exe' : 'arduino-cli');
};

const getSupportedTargetsForHost = (host = detectHostPlatform()) => {
    const targets = ['linux-arm', 'linux-arm64', 'linux-x64', 'windows-arm64', 'windows-x64'];
    if (host.os === 'macos') {
        targets.push('macos-arm64', 'macos-x64');
    }
    return targets;
};

const getZigArchiveName = (host = detectHostPlatform()) => {
    if (host.os === 'windows') {
        const archSegment = host.arch === 'arm64' ? 'aarch64' : host.arch === 'x64' ? 'x86_64' : null;
        if (!archSegment) {
            throw new Error(`Unsupported Windows host architecture for Zig: ${host.arch}`);
        }
        return `zig-${archSegment}-windows-${ZIG_VERSION}.zip`;
    }

    if (host.os === 'macos') {
        const archSegment = host.arch === 'arm64' ? 'aarch64' : host.arch === 'x64' ? 'x86_64' : null;
        if (!archSegment) {
            throw new Error(`Unsupported macOS host architecture for Zig: ${host.arch}`);
        }
        return `zig-${archSegment}-macos-${ZIG_VERSION}.tar.xz`;
    }

    if (host.os === 'linux') {
        if (host.arch === 'x64') return `zig-x86_64-linux-${ZIG_VERSION}.tar.xz`;
        if (host.arch === 'arm64') return `zig-aarch64-linux-${ZIG_VERSION}.tar.xz`;
        if (host.arch === 'arm') return `zig-arm-linux-${ZIG_VERSION}.tar.xz`;
    }

    throw new Error(`Unsupported Zig host platform ${host.os}-${host.arch}`);
};

const writeWrapper = (wrapperPath, zigBinaryPath, targetTriple) => {
    fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });

    if (process.platform === 'win32') {
        const windowsScript = [
            '@echo off',
            `"%~dp0..\\${path.basename(path.dirname(zigBinaryPath))}\\zig.exe" c++ -target ${targetTriple} %*`
        ].join('\r\n');
        fs.writeFileSync(wrapperPath, windowsScript);
        return;
    }

    const posixScript = [
        '#!/bin/sh',
        `exec "${zigBinaryPath}" c++ -target ${targetTriple} "$@"`
    ].join('\n');
    fs.writeFileSync(wrapperPath, posixScript, { mode: 0o755 });
    fs.chmodSync(wrapperPath, 0o755);
};

const ensureWrappers = (host = detectHostPlatform()) => {
    const zigBinaryPath = getZigBinaryPath(host);
    for (const target of getSupportedTargetsForHost(host)) {
        const targetTriple = TARGET_TRIPLES[target];
        if (!targetTriple) continue;
        writeWrapper(getWrapperPath(target), zigBinaryPath, targetTriple);
    }
};

export const detectHostPlatform = () => ({
    os: normalizeHostOS(os.platform()),
    arch: normalizeHostArch(os.arch())
});

export const getToolchainRoot = () => TOOLCHAIN_ROOT;

export const getManagedArduinoCliExecOptions = (overrides = {}) => ({
    ...overrides,
    env: {
        ...process.env,
        ARDUINO_DIRECTORIES_DATA: getArduinoCliDataDir(),
        ARDUINO_DIRECTORIES_DOWNLOADS: getArduinoCliDownloadsDir(),
        ARDUINO_DIRECTORIES_USER: getArduinoCliUserDir(),
        ...(overrides.env || {})
    }
});

export const isManagedZigCompiler = (compilerPath) => String(compilerPath || '').includes(`${path.sep}.nodalis${path.sep}toolchains${path.sep}zig${path.sep}`);

export const getDefaultToolchain = (host = detectHostPlatform()) => {
    return getSupportedTargetsForHost(host).reduce((acc, target) => {
        acc[target] = getWrapperPath(target);
        return acc;
    }, {});
};

const downloadFile = async (url, destinationPath) => {
    await new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                downloadFile(response.headers.location, destinationPath).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`Download failed with HTTP ${response.statusCode} for ${url}`));
                return;
            }

            const fileStream = fs.createWriteStream(destinationPath);
            pipeline(response, fileStream).then(resolve).catch(reject);
        });

        request.on('error', reject);
    });
};

const extractArchive = (archivePath, destinationDir) => {
    fs.mkdirSync(destinationDir, { recursive: true });

    if (archivePath.endsWith('.zip')) {
        if (process.platform !== 'win32') {
            throw new Error(`ZIP extraction is only configured for Windows hosts: ${archivePath}`);
        }

        execFileSync(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`
            ],
            { stdio: 'inherit' }
        );
        return;
    }

    execFileSync('tar', ['-xf', archivePath, '-C', destinationDir], { stdio: 'inherit' });
};

const ensureArduinoCliDirs = () => {
    fs.mkdirSync(getArduinoCliRootDir(), { recursive: true });
    fs.mkdirSync(getArduinoCliDataDir(), { recursive: true });
    fs.mkdirSync(getArduinoCliDownloadsDir(), { recursive: true });
    fs.mkdirSync(getArduinoCliUserDir(), { recursive: true });
};

const installDefaultArduinoCores = (arduinoCliPath) => {
    execFileSync(arduinoCliPath, ['core', 'update-index'], getManagedArduinoCliExecOptions({ stdio: 'inherit' }));

    const coreIds = [...new Set(
        DEFAULT_ARDUINO_FQBNS.map((fqbn) => {
            const parts = String(fqbn).split(':');
            return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
        }).filter(Boolean)
    )];

    for (const coreId of coreIds) {
        execFileSync(arduinoCliPath, ['core', 'install', coreId], getManagedArduinoCliExecOptions({ stdio: 'inherit' }));
    }
};

const installDefaultArduinoLibraries = (arduinoCliPath) => {
    for (const libraryName of DEFAULT_ARDUINO_LIBRARIES) {
        execFileSync(
            arduinoCliPath,
            ['lib', 'install', libraryName],
            getManagedArduinoCliExecOptions({ stdio: 'inherit' })
        );
    }
};

export const installDefaultToolchains = async () => {
    const host = detectHostPlatform();
    const archiveName = getZigArchiveName(host);
    const rootDir = path.join(TOOLCHAIN_ROOT, 'zig', ZIG_VERSION);
    const archivePath = path.join(rootDir, archiveName);
    const installDir = getZigInstallDir(host);
    const zigBinaryPath = getZigBinaryPath(host);

    fs.mkdirSync(rootDir, { recursive: true });

    const results = [];
    if (!fs.existsSync(zigBinaryPath)) {
        const downloadUrl = `https://ziglang.org/download/${ZIG_VERSION}/${archiveName}`;

        try {
            await downloadFile(downloadUrl, archivePath);
            extractArchive(archivePath, rootDir);
            fs.rmSync(archivePath, { force: true });
            results.push({
                id: 'zig',
                status: 'installed',
                installDir,
                downloadUrl
            });
        } catch (err) {
            fs.rmSync(archivePath, { force: true });
            results.push({
                id: 'zig',
                status: 'failed',
                downloadUrl,
                error: err.message
            });
            return {
                host,
                rootDir: TOOLCHAIN_ROOT,
                toolchains: results,
                defaultToolchain: getDefaultToolchain(host)
            };
        }
    } else {
        results.push({
            id: 'zig',
            status: 'already-installed',
            installDir
        });
    }

    ensureWrappers(host);

    const arduinoArchiveName = getArduinoCliArchiveName(host);
    const arduinoRootDir = getArduinoCliRootDir();
    const arduinoArchivePath = path.join(arduinoRootDir, arduinoArchiveName);
    const arduinoInstallDir = getArduinoCliInstallDir(host);
    const arduinoCliPath = getManagedArduinoCliPath(host);

    ensureArduinoCliDirs();

    if (!fs.existsSync(arduinoCliPath)) {
        const downloadUrl = `https://downloads.arduino.cc/arduino-cli/${arduinoArchiveName}`;

        try {
            await downloadFile(downloadUrl, arduinoArchivePath);
            fs.mkdirSync(arduinoInstallDir, { recursive: true });
            extractArchive(arduinoArchivePath, arduinoInstallDir);
            fs.rmSync(arduinoArchivePath, { force: true });
            results.push({
                id: 'arduino-cli',
                status: 'installed',
                installDir: arduinoInstallDir,
                downloadUrl
            });
        } catch (err) {
            fs.rmSync(arduinoArchivePath, { force: true });
            results.push({
                id: 'arduino-cli',
                status: 'failed',
                downloadUrl,
                error: err.message
            });
            return {
                host,
                rootDir: TOOLCHAIN_ROOT,
                toolchains: results,
                defaultToolchain: getDefaultToolchain(host),
                arduinoCli: arduinoCliPath,
                defaultArduinoFqbns: DEFAULT_ARDUINO_FQBNS
            };
        }
    } else {
        results.push({
            id: 'arduino-cli',
            status: 'already-installed',
            installDir: arduinoInstallDir
        });
    }

    try {
        installDefaultArduinoCores(arduinoCliPath);
        results.push({
            id: 'arduino-default-cores',
            status: 'installed',
            fqbns: DEFAULT_ARDUINO_FQBNS
        });
    } catch (err) {
        results.push({
            id: 'arduino-default-cores',
            status: 'failed',
            fqbns: DEFAULT_ARDUINO_FQBNS,
            error: err.message
        });
    }

    try {
        installDefaultArduinoLibraries(arduinoCliPath);
        results.push({
            id: 'arduino-default-libraries',
            status: 'installed',
            libraries: DEFAULT_ARDUINO_LIBRARIES
        });
    } catch (err) {
        results.push({
            id: 'arduino-default-libraries',
            status: 'failed',
            libraries: DEFAULT_ARDUINO_LIBRARIES,
            error: err.message
        });
    }

    return {
        host,
        rootDir: TOOLCHAIN_ROOT,
        toolchains: [
            ...results,
            ...getSupportedTargetsForHost(host).map((target) => ({
                id: target,
                status: 'ready',
                compiler: getWrapperPath(target),
                targetTriple: TARGET_TRIPLES[target]
            }))
        ],
        defaultToolchain: getDefaultToolchain(host),
        arduinoCli: arduinoCliPath,
        defaultArduinoFqbns: DEFAULT_ARDUINO_FQBNS,
        defaultArduinoLibraries: DEFAULT_ARDUINO_LIBRARIES
    };
};

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
// Type declarations for the "nodalis-compiler" package

/** Supported IEC 61131-3 languages (string codes) */
export type IECLanguageCode = 'LD' | 'ST' | 'FBD' | 'IL' | 'SFC';

/** Supported output types */
export type OutputTypeCode = 'executable' | 'node' | 'code';

/** Supported communication protocols */
export type CommunicationProtocolCode =
    | 'Modbus'
    | 'BACnet'
    | 'Ethernet/IP'
    | 'Profinet'
    | 'OPC UA'
    | 'Custom';

/** Information about a compiler returned by Nodalis.listCompilers() */
export interface CompilerInfo {
    /** Class name, e.g. "CPPCompiler", "JSCompiler", "SkipCompiler" */
    name: string;
    supportedTargets: string[];        // e.g. ['linux', 'macos', 'windows']
    supportedOutputTypes: string[];    // e.g. ['executable', 'code']
    supportedLanguages: string[];      // e.g. ['ST', 'LD']
    supportedProtocols: string[];      // e.g. ['Modbus', 'OPC UA']
    compilerVersion?: string;
}

/** Information about a programmer returned by Nodalis.listProgrammers() */
export interface ProgrammerInfo {
    name: string;
    target: string;
}

/** Options for Nodalis.compile(...) */
export interface CompileOptions {
    /** Target platform, e.g. 'nodejs', 'generic-cpp', 'iec', 'st', 'xml', 'jint' */
    target: string;

    /** Output type, e.g. 'code' | 'executable' */
    outputType: string;

    /** Destination folder for generated output */
    outputPath: string;

    /**
     * Resource name to compile when using IEC project files (.iec / .xml).
     * Required for IEC project compilation.
     */
    resourceName?: string;

    /** Path to the source file (.st, .iec, .xml, .skip, etc.) */
    sourcePath: string;

    /** Language code (e.g. 'st', 'ld', 'skip'). Case-insensitive. */
    language: string;
}

/** Options for Nodalis.program(...) */
export interface ProgramOptions {
    /** Programming target (e.g. 'MTI') */
    target: string;

    /** Source file or folder to program from */
    source: string;

    /** Destination address / path / URI (device IP, folder, etc.) */
    destination: string;

    /** Optional username for programming */
    username?: string;

    /** Optional password for programming */
    password?: string;
}

/**
 * Main entry point class exported by the nodalis-compiler package.
 * Wraps the available compilers and programmers and provides high-level
 * compile / deploy operations.
 */
export class Nodalis {
    constructor();

    /**
     * List available compilers and their supported targets, output types, languages,
     * protocols, and version data.
     */
    listCompilers(): CompilerInfo[];

    /**
     * List available programmers and their targets.
     */
    listProgrammers(): ProgrammerInfo[];

    /**
     * Get a specific compiler instance matching target, outputType, and language,
     * or undefined if no match is found.
     */
    getCompiler(
        target: string,
        outputType: string,
        language: string
    ): unknown;

    /**
     * Get a specific programmer instance matching the target,
     * or undefined if no match is found.
     */
    getProgrammer(target: string): unknown;

    /**
     * High-level compile operation.
     * Validates the input, selects a compiler implementation, and runs it.
     */
    compile(options: CompileOptions): Promise<void>;

    /**
     * High-level programming/deployment operation.
     * Selects the appropriate programmer and executes it.
     */
    program(options: ProgramOptions): Promise<void>;
}

/**
 * Alias for the CompileList type from the underlying mticp-npm package.
 * This is declared as any here to avoid requiring type declarations from mticp-npm.
 */
export type MTICompileList = any;

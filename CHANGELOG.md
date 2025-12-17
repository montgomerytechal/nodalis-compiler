# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.13] - 2025-12-17

- Added cross-compilation for the CPPCompiler. Added more detail to the README for compilers.

## [1.0.12] - 2025-12-16

- Fixed issue with copying support files for CPP and JS compilers.
- Updated mticp
- Fixed issue with IEC parser and set/reset coils.

## [1.0.6]

- Fixed issue with JS compile where program was not compiling exactly right.
- Integrated latest version of mticp-npm.

## [1.0.5]

- Changed JSCompiler to avoid including the setup and run functions if we are just compiling generic ST.

## [1.0.4]

- Added support for TypeScript types.

## [1.0.3]

- Added access to MTICompileList.

## [1.0.2]

- Added deploy action to command line.
- Added Programmer and MTIProgrammer for programming MTI Devices.

## [1.0.1] - 2025-12-08

### Added

- Added support for Skipper Sheets using the SkipCompiler through mticp-npm.
- Added changelog

### Changed


### Fixed


## [1.0.0] - 2025-11-21

- Initial public release of `nodalis-compiler`.
- Basic support for compiling IEC-61131-3/10 sources (e.g., `.st`, `.iec`) into platform-specific code for multiple targets (e.g., Node.js and generic C++). :contentReference[oaicite:11]{index=11}  
- Early version of the CLI and compiler abstractions.


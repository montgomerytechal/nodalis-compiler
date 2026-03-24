# Changelog

## [1.0.29] 2026-03-04
- Fixed issues with bunding ST folder and reporting errors.
- Improved support for loop structures.

## [1.0.28] 2026-03-23
- Improved support for Arduino, fully tested Arduino compile -> program stack.
- Added a command line interface for nodalis on Arduino to use in setting IP, read/write of bits, and map info.

## [1.0.27] 2026-03-20
- Corrected issues with SSH Programmer.

## [1.0.26] 2026-03-19
- Improved error handling on programming.

## [1.0.25] 2026-03-18
- Added line number errors to compilers.
- Changed bacnet to use remote address property in mapping as the instance number.

## [1.0.24] 2026-03-04
- Added support for CONFIGURATION, RESOURCE, TASK, and PROGRAM (instance) keywords in ST.
- Added "required" arrays to programmers for communicating required parameters beyond the base params when calling program.

## [1.0.23] 2026-03-03
- Changed IEC parser to interpret Function Blocks that are actually standard functions to a formal function call.
- Fixed nodejs/jint compiles to put executables in a bin folder.
- Fixed syntax errors with repeat.
- Prevent stale files in ST bundle compile.
- Added a new "action" for "get-toolchains", which will download the necessary toolchains for CPP and Arduino.

## [1.0.17] 2026-02-25
- Added support for compilation of multiple ST files as a single project.
- Added support for formal parameters.
- Added all standard math, logic, comparison, and select functions.
- Added support for type casting.
- Tested to PLCOpen reliability standard.
- Added support for Arduino targets.
- Added File and SSH programmers.

## [1.0.16] - 2026-02-13

- Fixed issues with compiling function blocks in jint.
- Fixed TP function block in NodalisEngine.

## [1.0.15] - 2026-02-10

- Fixed issue with calling functions. Changed AND/OR to bitwise operators in JS/C

## [1.0.14] - 2026-02-06

- Added support for BACNET-IP to Generic C++ and JINT compilers.

## [1.0.14] - 2026-02-06

- Added support for BACNET-IP to Generic C++ and JINT compilers.

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


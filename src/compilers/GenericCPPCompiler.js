import { execSync } from 'child_process';
import fs from 'fs';
import Compiler from './Compiler.js';

import { parseStructuredText } from '../st-parser/parser.js';
import { transpile } from '../st-parser/transpiler.js';

class GenericCPPCompiler extends Compiler {
    constructor(options) {
        super(options);
        this.name = 'GenericCPPCompiler';
        this.supportedLanguages = ['ST', 'LD'];
        this.supportedTargets = ['code', 'executable'];
        this.supportedDevices = ['generic'];
        this.supportedProtocols = ['Modbus'];
    }

    compile() {
        const { sourcePath, outputPath, target } = this.options;
        const sourceCode = fs.readFileSync(sourcePath, 'utf-8');
        const parsed = parseStructuredText(sourceCode);
        const transpiledCode = transpile(parsed);

        const filename = path.basename(sourcePath, path.extname(sourcePath));
        const cppFile = path.join(outputPath, `${filename}.cpp`);

        const cppCode = `#include \"imperium.h\"\n#include \"modbus_support.h\"\n\n${transpiledCode}\n\nint main() {\n  while (true) {\n    gatherInputs();\n    task();\n    handleOutputs();\n    std::this_thread::sleep_for(std::chrono::milliseconds(1));\n  }\n  return 0;\n}\n`;

        fs.mkdirSync(outputPath, { recursive: true });
        fs.writeFileSync(cppFile, cppCode);

        // Copy core headers and cpp support files
        const coreFiles = [
            'imperium.h',
            'imperium.cpp',
            'modbus_support.h',
            'modbus_support.cpp'
        ];

        const coreDir = path.resolve('./support/generic');
        for (const file of coreFiles) {
            fs.copyFileSync(path.join(coreDir, file), path.join(outputPath, file));
        }

        if (target === 'executable') {
            let compiler = null;
            try {
            execSync('clang++ --version', { stdio: 'ignore' });
            compiler = 'clang++';
            } catch {
            try {
                execSync('g++ --version', { stdio: 'ignore' });
                compiler = 'g++';
            } catch {
                throw new Error('No C++ compiler found (clang++ or g++)');
            }
            }

            const exeFile = path.join(outputPath, filename);
            const compileCmd = `${compiler} -std=c++17 -o \"${exeFile}\" \"${cppFile}\" \"${path.join(outputPath, 'imperium.cpp')}\" \"${path.join(outputPath, 'modbus_support.cpp')}\"`;
            execSync(compileCmd, { stdio: 'inherit' });
        }
    }

}

export default GenericCPPCompiler;

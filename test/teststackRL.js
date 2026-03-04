import { Nodalis } from "../src/nodalis.js";
import fs from "fs";
import path from "path";
const nodalis = new Nodalis();
const sourceDir = "/Users/nathanskipper/Projects/MTISDK/docs/IEC61131/Testing/RLTest";
const outputPath = "./test/st/output/rl";

fs.rmSync(outputPath, { recursive: true, force: true });


await nodalis.compile({
    target: "macos-arm64",
    sourcePath:sourceDir,
    language: "ST",
    outputType: "executable",
    outputPath: outputPath,
    resourceName: "T_MAIN"
});
    

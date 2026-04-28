import { Nodalis } from "../src/nodalis.js";
import fs from "fs";
const nodalis = new Nodalis();
const outputPath = "./test/st/output/macos-arm64";

fs.rmSync(outputPath, { recursive: true, force: true });

await nodalis.compile({
    target: "macos-arm64",
    sourcePath: "/Users/nathanskipper/Projects/MTISDK/docs/IEC61131/Testing/RLTest",
    language: "ST",
    outputType: "executable",
    outputPath,
    resourceName: "T_MAIN"
});

// await nodalis.program({
//     target: "SSH",
//     source: outputPath,
//     destination: "192.168.9.160",
//     username: "mti",
//     password: "MTI-System"

// });

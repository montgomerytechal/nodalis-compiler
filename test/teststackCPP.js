import { Nodalis } from "../src/nodalis.js";
import fs from "fs";
const nodalis = new Nodalis();
const outputPath = "./test/st/output/linux-arm64";

fs.rmSync(outputPath, { recursive: true, force: true });

await nodalis.compile({
    target: "linux-arm64",
    sourcePath: "./test/st/fixtures/plc1.iec",
    language: "LD",
    outputType: "executable",
    outputPath,
    resourceName: "PLC1"
});

await nodalis.program({
    target: "FILE",
    source: outputPath,
    destination: "./test/st/output/linux-arm64/deploy",

});

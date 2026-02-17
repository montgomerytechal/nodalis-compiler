import { Nodalis } from "../src/nodalis.js";
import fs from "fs";
import path from "path";
const nodalis = new Nodalis();
let outputPath = "./test/st/output/node";

fs.rmSync(outputPath, { recursive: true, force: true });

await nodalis.compile({
    target: "nodejs",
    sourcePath: "./test/st/fixtures/plc1.iec",
    language: "LD",
    outputType: "executable",
    outputPath,
    resourceName: "PLC1"
});

await nodalis.program({
    target: "FILE",
    source: outputPath,
    destination: `${outputPath}/deploy`,

});

outputPath = "./test/st/output/jint";

fs.rmSync(outputPath, { recursive: true, force: true });

await nodalis.compile({
    target: "jint",
    sourcePath: "./test/st/fixtures/plc1.iec",
    language: "LD",
    outputType: "executable",
    outputPath,
    resourceName: "PLC1"
});

const jintpath = path.join(outputPath, "publish", "linux-arm64");
await nodalis.program({
    target: "FILE",
    source: jintpath,
    destination: `${jintpath}/deploy`,

});

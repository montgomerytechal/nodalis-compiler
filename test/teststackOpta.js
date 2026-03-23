import { Nodalis } from "../src/nodalis.js";
import fs from "fs";
import path from "path";
const nodalis = new Nodalis();
const outputPath = "./test/st/output/opta";

fs.rmSync(outputPath, { recursive: true, force: true });

await nodalis.compile({
    target: "arduino-opta",
    sourcePath: "./test/st/fixtures/plc1.iec",
    language: "LD",
    outputType: "executable",
    outputPath,
    resourceName: "PLC1"
});

await nodalis.program({
    target: "arduino",
    source: path.join(outputPath, "bin"),
    destination: "/dev/cu.usbmodem1101",
    username: "mti",
    password: "MTI-System",
    fqbn: "arduino:mbed_opta:opta"

});

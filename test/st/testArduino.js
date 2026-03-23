import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { ArduinoCompiler } from '../../src/compilers/ArduinoCompiler.js';

var inputPath = path.resolve('test/st/fixtures', `plc1.iec`);
var outputPath = path.resolve('test/st/output');

async function runTest() {
  const targets = ["arduino-opta"];
  inputPath = path.resolve('test/st/fixtures', `plc1.iec`);

  for (const t of targets) {
    outputPath = path.resolve('test/st/output') + "/" + t;
    fs.rmSync(outputPath, { recursive: true, force: true });

    await new ArduinoCompiler({
      sourcePath: inputPath,
      outputPath,
      target: t,
      outputType: "source_code",
      resourceName: "PLC1"
    }).compile();

    const sketchName = path.basename(path.resolve(outputPath));
    const inoPath = path.join(outputPath, `${sketchName}.ino`);
    const ino = fs.readFileSync(inoPath, 'utf8');
    const networkHeaderPath = path.join(outputPath, 'network_config.h');
    const networkSourcePath = path.join(outputPath, 'network_config.cpp');

    assert.ok(ino.includes('#include <Ethernet.h>'));
    assert.ok(ino.includes('#include "network_config.h"'));
    assert.ok(ino.includes('localIp = nodalisLoadIpAddress();'));
    assert.ok(ino.includes('nodalisBeginEthernet(localIp);'));
    assert.ok(ino.includes('nodalisPollSerialIpConfig(localIp);'));
    assert.ok(fs.existsSync(networkHeaderPath));
    assert.ok(fs.existsSync(networkSourcePath));
  }
}

await runTest();

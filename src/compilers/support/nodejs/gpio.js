// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import fs from "fs";
import { IOClient } from "./IOClient.js";

function isLinux() {
  return process.platform === "linux";
}

function normalizeChip(chip) {
  if (!chip || chip.length === 0) {
    return "gpiochip0";
  }

  const lower = String(chip).toLowerCase();
  if (lower.startsWith("gpiochip")) {
    return lower;
  }

  return `gpiochip${lower}`;
}

function parseIntSafe(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function readIntFile(path) {
  try {
    const raw = fs.readFileSync(path, "utf8").trim();
    const parsed = parseIntSafe(raw);
    return parsed === null ? null : parsed;
  } catch {
    return null;
  }
}

function writeTextFile(path, value) {
  try {
    fs.writeFileSync(path, value, "utf8");
    return true;
  } catch {
    return false;
  }
}

export class GPIOClient extends IOClient {
  constructor() {
    super("GPIO");
    this.pinByRemote = new Map();
  }

  connect() {
    this.connected = isLinux();
  }

  onMappingAdded(map) {
    if (!isLinux()) {
      return;
    }

    const startPin = this.resolveGlobalPin(map.moduleID, map.remoteAddress);
    if (startPin === null) {
      return;
    }

    const direction = map.direction === "Output" ? "out" : "in";
    const width = map.width > 1 ? map.width : 1;
    for (let bit = 0; bit < width; bit += 1) {
      const pin = startPin + bit;
      if (!this.ensureExported(pin)) {
        return;
      }
      if (!writeTextFile(`/sys/class/gpio/gpio${pin}/active_low`, "1")) {
        return;
      }
      if (!writeTextFile(`/sys/class/gpio/gpio${pin}/direction`, direction)) {
        return;
      }
    }

    this.pinByRemote.set(map.remoteAddress, startPin);
  }

  resolveGlobalPin(moduleID, remoteAddress) {
    const offset = parseIntSafe(remoteAddress);
    if (offset === null || offset < 0) {
      return null;
    }

    const chip = normalizeChip(moduleID);
    const base = readIntFile(`/sys/class/gpio/${chip}/base`);
    if (base === null) {
      // Fallback to absolute pin addressing when gpiochip metadata is unavailable.
      return offset;
    }

    return base + offset;
  }

  ensureExported(globalPin) {
    const gpioPath = `/sys/class/gpio/gpio${globalPin}`;
    if (fs.existsSync(gpioPath)) {
      return true;
    }

    if (!writeTextFile("/sys/class/gpio/export", String(globalPin))) {
      return fs.existsSync(gpioPath);
    }

    return true;
  }

  resolveRemotePin(remote) {
    if (this.pinByRemote.has(remote)) {
      return this.pinByRemote.get(remote);
    }

    const map = this.mappings.find(m => m.remoteAddress === remote);
    if (!map) {
      return null;
    }

    return this.resolveGlobalPin(map.moduleID || this.moduleID, remote);
  }

  readValue(remote, callback) {
    if (!isLinux()) {
      return;
    }

    const globalPin = this.resolveRemotePin(remote);
    if (globalPin === null) {
      return;
    }

    try {
      const raw = fs.readFileSync(`/sys/class/gpio/gpio${globalPin}/value`, "utf8").trim();
      callback(raw === "0" ? 0 : 1);
    } catch {
      // Intentionally ignored: GPIO reads are best-effort.
    }
  }

  writeValue(remote, value) {
    if (!isLinux()) {
      return;
    }

    const globalPin = this.resolveRemotePin(remote);
    if (globalPin === null) {
      return;
    }

    writeTextFile(`/sys/class/gpio/gpio${globalPin}/value`, value === 0 ? "0" : "1");
  }

  readBit(remote, callback) {
    this.readValue(remote, callback);
  }

  writeBit(remote, value) {
    this.writeValue(remote, value ? 1 : 0);
  }

  readWidthValue(remote, width, callback) {
    if (!isLinux()) {
      return;
    }

    const startPin = this.resolveRemotePin(remote);
    if (startPin === null) {
      return;
    }

    let value = 0n;
    for (let bit = 0; bit < width; bit += 1) {
      try {
        const raw = fs.readFileSync(`/sys/class/gpio/gpio${startPin + bit}/value`, "utf8").trim();
        if (raw !== "0") {
          value |= (1n << BigInt(bit));
        }
      } catch {
        return;
      }
    }

    callback(value);
  }

  writeWidthValue(remote, width, value) {
    if (!isLinux()) {
      return;
    }

    const startPin = this.resolveRemotePin(remote);
    if (startPin === null) {
      return;
    }

    const normalized = typeof value === "bigint" ? value : BigInt(value >>> 0);
    for (let bit = 0; bit < width; bit += 1) {
      const bitValue = ((normalized >> BigInt(bit)) & 1n) === 1n ? "1" : "0";
      if (!writeTextFile(`/sys/class/gpio/gpio${startPin + bit}/value`, bitValue)) {
        return;
      }
    }
  }

  readByte(remote, callback) {
    this.readWidthValue(remote, 8, v => callback(Number(v & 0xFFn)));
  }

  writeByte(remote, value) {
    this.writeWidthValue(remote, 8, BigInt(value & 0xFF));
  }

  readWord(remote, callback) {
    this.readWidthValue(remote, 16, v => callback(Number(v & 0xFFFFn)));
  }

  writeWord(remote, value) {
    this.writeWidthValue(remote, 16, BigInt(value & 0xFFFF));
  }

  readDWord(remote, callback) {
    this.readWidthValue(remote, 32, v => callback(Number(v & 0xFFFFFFFFn)));
  }

  writeDWord(remote, value) {
    this.writeWidthValue(remote, 32, BigInt(value >>> 0));
  }

  readLWord(remote, callback) {
    this.readWidthValue(remote, 64, callback);
  }

  writeLWord(remote, value) {
    this.writeWidthValue(remote, 64, value);
  }
}

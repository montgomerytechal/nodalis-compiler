// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

import { IOClient } from "./IOClient.js";

const DEFAULT_BACNET_PORT = 47808; // 0xBAC0
const UINT32_SCALE = 4294967296;
const UINT32_MASK = 0xFFFFFFFFn;

function uint64ToDouble(value) {
  let raw = 0n;
  if (typeof value === "bigint") {
    raw = value;
  } else if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return 0;
    }
    raw = BigInt(Math.max(0, Math.floor(value)));
  } else if (typeof value === "string") {
    const parsed = BigInt(value || "0");
    raw = parsed < 0n ? 0n : parsed;
  }

  const fractional = Number(raw & UINT32_MASK);
  const upper = Number((raw >> 32n) & UINT32_MASK);
  const signedUpper = upper >= 0x80000000 ? upper - 0x100000000 : upper;
  return signedUpper + (fractional / UINT32_SCALE);
}

function doubleToUint64(value) {
  if (!Number.isFinite(value)) {
    return 0n;
  }

  const minVal = -2147483648;
  const maxVal = 2147483647 + (1 - (1 / UINT32_SCALE));
  let x = value;
  if (x < minVal) x = minVal;
  if (x > maxVal) x = maxVal;

  const intPart = Math.floor(x);
  const frac = x - intPart;
  let integer = intPart | 0;
  let scaled = Math.round(frac * UINT32_SCALE);

  if (scaled >= UINT32_SCALE) {
    scaled = 0;
    if (integer < 2147483647) {
      integer += 1;
    } else {
      scaled = UINT32_SCALE - 1;
    }
  }

  const upper = BigInt(integer >>> 0);
  const lower = BigInt(scaled >>> 0);
  const encoded = (upper << 32n) | lower;
  return encoded;
}

function parseInteger(value, fallback = null) {
  if (value === null || typeof value === "undefined" || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseJsonConfig(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return raw;
  }
  return {};
}

function normalizeEnumKey(input) {
  return String(input ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function resolveEnumValue(table, raw, fallback) {
  if (!table) return fallback;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const numeric = Number.parseInt(raw, 10);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const normalized = normalizeEnumKey(raw);
    for (const [key, value] of Object.entries(table)) {
      if (normalizeEnumKey(key) === normalized) {
        return value;
      }
    }
  }
  return fallback;
}

function parseRemoteString(remote) {
  const tokens = String(remote ?? "")
    .split(/[:|]/)
    .map(t => t.trim())
    .filter(Boolean);
  if (tokens.length < 3) {
    return null;
  }

  return {
    objectType: tokens[0],
    objectInstance: tokens[1],
    propertyId: tokens[2],
    arrayIndex: tokens.length > 3 ? tokens[3] : null
  };
}

export class BacnetClient extends IOClient {
  constructor() {
    super("BACNET");
    this.client = null;
    this.bacnet = null;
    this.remoteByAddress = new Map();
    this.remoteHost = "";
    this.remotePort = DEFAULT_BACNET_PORT;
    this._connecting = false;
  }

  connect() {
    if (this.connected || this._connecting) {
      return;
    }

    this._connecting = true;
    this.#loadAndCreateClient()
      .then(() => {
        this.connected = true;
      })
      .catch(err => {
        this.connected = false;
        console.error("BACnet connect error:", err?.message || err);
      })
      .finally(() => {
        this._connecting = false;
      });
  }

  onMappingAdded(map) {
    if (!this.remoteHost) {
      this.remoteHost = String(map.moduleID || "").trim();
    }
    const configuredPort = parseInteger(map.modulePort, null);
    if (configuredPort !== null) {
      this.remotePort = configuredPort;
    }

    this.remoteByAddress.delete(map.remoteAddress);
    if (this.bacnet) {
      const point = this.#parseRemoteDefinition(map);
      if (point) {
        this.remoteByAddress.set(map.remoteAddress, point);
      }
    }
  }

  readBit(remote, callback) {
    this.#readValue(remote, callback, value => (value ? 1 : 0));
  }

  writeBit(remote, value) {
    this.#writeValue(remote, value ? 1 : 0, "b");
  }

  readByte(remote, callback) {
    this.#readValue(remote, callback, value => Number((typeof value === "bigint" ? (value & 0xFFn) : BigInt(Number(value) & 0xFF))));
  }

  writeByte(remote, value) {
    this.#writeValue(remote, Number(value) & 0xFF, "u");
  }

  readWord(remote, callback) {
    this.#readValue(remote, callback, value => Number((typeof value === "bigint" ? (value & 0xFFFFn) : BigInt(Number(value) & 0xFFFF))));
  }

  writeWord(remote, value) {
    this.#writeValue(remote, Number(value) & 0xFFFF, "u");
  }

  readDWord(remote, callback) {
    this.#readValue(remote, callback, value => {
      if (typeof value === "bigint") {
        return Number(value & 0xFFFFFFFFn) >>> 0;
      }
      return Number(value) >>> 0;
    });
  }

  writeDWord(remote, value) {
    this.#writeValue(remote, Number(value) >>> 0, "u");
  }

  async #loadAndCreateClient() {
    if (this.client) {
      return;
    }

    const bacstackModule = await import("bacstack");
    const Bacnet = bacstackModule.default || bacstackModule;
    this.bacnet = Bacnet;
    this.client = new Bacnet({
      apduTimeout: 3000,
      interface: "0.0.0.0"
    });

    this.client.on("error", err => {
      console.error("BACnet client error:", err?.message || err);
      this.connected = false;
    });
  }

  #resolveRemotePoint(remoteAddress) {
    if (this.remoteByAddress.has(remoteAddress)) {
      return this.remoteByAddress.get(remoteAddress);
    }

    const map = this.mappings.find(m => m.remoteAddress === remoteAddress);
    if (!map) {
      return null;
    }

    const parsed = this.#parseRemoteDefinition(map);
    if (parsed) {
      this.remoteByAddress.set(remoteAddress, parsed);
    }
    return parsed;
  }

  #parseRemoteDefinition(map) {
    const config = parseJsonConfig(map.additionalProperties);
    const stringRemote = parseRemoteString(map.remoteAddress);

    const objectTypeRaw = config.objectType ?? config.ObjectType ?? stringRemote?.objectType ?? 0;
    const propertyIdRaw = config.propertyId ?? config.PropertyId ?? stringRemote?.propertyId ?? 85;
    const arrayIndexRaw = config.arrayIndex ?? config.ArrayIndex ?? stringRemote?.arrayIndex ?? null;
    const valueType = String(config.valueType ?? config.ValueType ?? "e").toLowerCase();

    const objectType = resolveEnumValue(this.bacnet?.enum?.ObjectType, objectTypeRaw, parseInteger(objectTypeRaw, 0));
    const objectInstance = parseInteger(map.remoteAddress, null);
    const propertyId = resolveEnumValue(this.bacnet?.enum?.PropertyIdentifier, propertyIdRaw, parseInteger(propertyIdRaw, 85));
    const arrayIndex = parseInteger(arrayIndexRaw, null);

    return {
      objectType,
      objectInstance,
      propertyId,
      arrayIndex,
      valueType
    };
  }

  #requestAddress() {
    if (!this.remoteHost) {
      return null;
    }
    return { address: this.remoteHost, port: this.remotePort || DEFAULT_BACNET_PORT };
  }

  #readValue(remote, callback, converter) {
    if (!this.client || !this.connected) {
      return;
    }

    const point = this.#resolveRemotePoint(remote);
    const target = this.#requestAddress();
    if (!point || !target) {
      return;
    }

    const options = {};
    if (point.arrayIndex !== null) {
      options.arrayIndex = point.arrayIndex;
    }

    this.client.readProperty(
      target,
      point.objectType,
      point.objectInstance,
      point.propertyId,
      options,
      (err, value) => {
        if (err) {
          console.error("BACnet read error:", err.message || err);
          return;
        }

        const first = value?.values?.[0];
        const raw = typeof first?.value === "undefined" ? null : first.value;
        if (raw === null) {
          return;
        }

        let translated = raw;
        if (point.valueType === "f" || point.valueType === "d") {
          translated = doubleToUint64(Number(raw));
        }

        callback(converter(translated));
      }
    );
  }

  #writeValue(remote, rawValue, widthType) {
    if (!this.client || !this.connected) {
      return;
    }

    const point = this.#resolveRemotePoint(remote);
    const target = this.#requestAddress();
    if (!point || !target) {
      return;
    }

    const appTag = this.#resolveApplicationTag(point.valueType || widthType);
    let translatedValue = rawValue;
    if (point.valueType === "f" || point.valueType === "d") {
      translatedValue = uint64ToDouble(rawValue);
    }
    const payload = [{ type: appTag, value: translatedValue }];
    const options = {};
    if (point.arrayIndex !== null) {
      options.arrayIndex = point.arrayIndex;
    }

    this.client.writeProperty(
      target,
      point.objectType,
      point.objectInstance,
      point.propertyId,
      payload,
      options,
      err => {
        if (err) {
          console.error("BACnet write error:", err.message || err);
        }
      }
    );
  }

  #resolveApplicationTag(valueType) {
    const tags = this.bacnet?.enum?.ApplicationTag || {};
    const v = String(valueType || "e").toLowerCase();
    if (v === "e") return tags.ENUMERATED ?? 9;
    if (v === "b") return tags.BOOLEAN ?? 1;
    if (v === "i") return tags.SIGNED_INTEGER ?? 3;
    if (v === "f") return tags.REAL ?? 4;
    if (v === "d") return tags.DOUBLE ?? 5;
    if (v === "u") return tags.UNSIGNED_INTEGER ?? 2;
    return tags.ENUMERATED ?? 9;
  }
}

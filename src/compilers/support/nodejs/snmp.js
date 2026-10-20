// Copyright [2026] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { IOClient } from "./IOClient.js";
import { execFile } from "node:child_process";

const DEFAULT_PORT = 161;
const DEFAULT_COMMUNITY = "public";
const DEFAULT_TIMEOUT = 3000;
const PING_TIMEOUT = 500;

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function property(config, name, fallback) {
  const key = Object.keys(config).find(candidate =>
    candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? fallback : config[key];
}

function bufferToBigInt(buffer) {
  let result = 0n;
  for (const byte of buffer) result = (result << 8n) | BigInt(byte);
  return result;
}

function toBigInt(value) {
  if (typeof value === "bigint") return value >= 0n ? value : null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? BigInt(Math.trunc(value)) : null;
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return bufferToBigInt(value);
  }
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

function bigIntToBuffer(value) {
  const result = Buffer.alloc(8);
  let remaining = value;
  for (let index = result.length - 1; index >= 0; index--) {
    result[index] = Number(remaining & 0xFFn);
    remaining >>= 8n;
  }
  return result;
}

function displayValue(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8").trim();
  }
  return String(value ?? "").trim();
}

function varbindToBigInt(varbind, snmp) {
  if (varbind.type === snmp.ObjectType.OctetString &&
      (Buffer.isBuffer(varbind.value) || varbind.value instanceof Uint8Array)) {
    return toBigInt(Buffer.from(varbind.value).toString("utf8"));
  }
  return toBigInt(varbind.value);
}

function conditionValue(varbind, snmp) {
  if (varbind.type === snmp.ObjectType.Counter64) {
    return bufferToBigInt(varbind.value).toString();
  }
  return displayValue(varbind.value);
}

export class SNMPClient extends IOClient {
  constructor() {
    super("SNMP");
    this.snmp = null;
    this.sessions = new Map();
    this._connecting = false;
  }

  connect() {
    if (this.connected || this._connecting) return;
    if (this.mappings.every(map => this.#isPing(map))) {
      this.connected = this.mappings.length > 0;
      return;
    }
    this._connecting = true;
    import("net-snmp")
      .then(module => {
        this.snmp = module.default || module;
        this.connected = true;
      })
      .catch(error => {
        this.connected = false;
        console.error("SNMP connect error:", error?.message || error);
      })
      .finally(() => {
        this._connecting = false;
      });
  }

  close() {
    for (const session of this.sessions.values()) session.close();
    this.sessions.clear();
    this.connected = false;
  }

  readBit(remote, callback) {
    const map = this.#findMapping(remote);
    if (this.#isPing(map)) {
      this.#ping(callback);
      return;
    }
    this.#get(remote, varbind => {
      const config = parseConfig(map?.additionalProperties);
      const configured = property(config, "onConditions", "");
      if (String(configured).trim()) {
        const actual = conditionValue(varbind, this.snmp).toLowerCase();
        const isOn = String(configured).split(",")
          .map(condition => condition.trim().toLowerCase())
          .filter(Boolean)
          .includes(actual);
        callback(isOn ? 1 : 0);
        return;
      }

      const numeric = varbindToBigInt(varbind, this.snmp);
      if (numeric !== null) callback(numeric === 0n ? 0 : 1);
      else if (/^(true|false)$/i.test(displayValue(varbind.value)))
        callback(/^true$/i.test(displayValue(varbind.value)) ? 1 : 0);
    });
  }

  readByte(remote, callback) {
    this.#readNumeric(remote, 0xFFn, callback);
  }

  readWord(remote, callback) {
    this.#readNumeric(remote, 0xFFFFn, callback);
  }

  readDWord(remote, callback) {
    this.#readNumeric(remote, 0xFFFFFFFFn, callback);
  }

  writeBit(remote, value) {
    this.#setNumeric(remote, value ? 1n : 0n);
  }

  writeByte(remote, value) {
    this.#setNumeric(remote, BigInt(Number(value) & 0xFF));
  }

  writeWord(remote, value) {
    this.#setNumeric(remote, BigInt(Number(value) & 0xFFFF));
  }

  writeDWord(remote, value) {
    this.#setNumeric(remote, BigInt(Number(value) >>> 0));
  }

  #readNumeric(remote, mask, callback) {
    const map = this.#findMapping(remote);
    if (this.#isPing(map)) {
      this.#ping(callback);
      return;
    }
    this.#get(remote, varbind => {
      const value = varbindToBigInt(varbind, this.snmp);
      if (value !== null) callback(Number(value & mask));
    });
  }

  #get(remote, callback) {
    const map = this.#findMapping(remote);
    const session = this.#sessionFor(map);
    if (!map || !session) return;

    session.get([String(remote)], (error, varbinds) => {
      if (error) {
        console.error(`SNMP GET failed for ${this.moduleID}/${remote}:`, error.message || error);
        return;
      }
      const varbind = varbinds?.[0];
      if (!varbind || this.snmp.isVarbindError(varbind)) {
        console.error(`SNMP GET failed for ${this.moduleID}/${remote}:`,
          varbind ? this.snmp.varbindError(varbind) : "empty response");
        return;
      }
      callback(varbind);
    });
  }

  #setNumeric(remote, value) {
    if (this.#isPing(this.#findMapping(remote))) return;
    this.#get(remote, current => {
      const map = this.#findMapping(remote);
      const session = this.#sessionFor(map);
      if (!session) return;

      const replacement = this.#valueForType(current.type, value);
      if (replacement === null) {
        console.error(`SNMP SET failed for ${this.moduleID}/${remote}: unsupported object type ${current.type}`);
        return;
      }

      session.set([{ oid: String(remote), type: current.type, value: replacement }],
        (error, varbinds) => {
          if (error) {
            console.error(`SNMP SET failed for ${this.moduleID}/${remote}:`, error.message || error);
            return;
          }
          const varbind = varbinds?.[0];
          if (!varbind || this.snmp.isVarbindError(varbind)) {
            console.error(`SNMP SET failed for ${this.moduleID}/${remote}:`,
              varbind ? this.snmp.varbindError(varbind) : "empty response");
          }
        });
    });
  }

  #valueForType(type, value) {
    const objectType = this.snmp.ObjectType;
    if (type === objectType.Counter64) return bigIntToBuffer(value);
    if (type === objectType.OctetString) return value.toString();
    if (type === objectType.Integer && value <= 0x7FFFFFFFn) return Number(value);
    if ((type === objectType.Counter || type === objectType.Gauge ||
         type === objectType.TimeTicks || type === objectType.Unsigned32) &&
        value <= 0xFFFFFFFFn) return Number(value);
    return null;
  }

  #findMapping(remote) {
    return this.mappings.find(map => String(map.remoteAddress) === String(remote));
  }

  #isPing(map) {
    if (!map) return false;
    const config = parseConfig(map.additionalProperties);
    return String(property(config, "version", "v2c")).trim().toLowerCase() === "ping";
  }

  #ping(callback) {
    const host = String(this.moduleID);
    const args = process.platform === "win32"
      ? ["-n", "1", "-w", String(PING_TIMEOUT), host]
      : process.platform === "darwin"
        ? ["-c", "1", "-W", String(PING_TIMEOUT), host]
        : ["-c", "1", "-W", "1", host];
    execFile("ping", args, { timeout: PING_TIMEOUT + 250 }, error => callback(error ? 0 : 1));
  }

  #sessionFor(map) {
    if (!this.connected || !this.snmp || !map || this.#isPing(map)) return null;
    const config = parseConfig(map.additionalProperties);
    const community = String(property(config, "community", DEFAULT_COMMUNITY));
    const requestedVersion = String(property(config, "version", "v2c")).trim().toLowerCase();
    const version = ["1", "v1", "snmpv1"].includes(requestedVersion)
      ? this.snmp.Version1 : this.snmp.Version2c;
    const parsedPort = Number.parseInt(map.modulePort, 10);
    const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
    const key = `${map.moduleID}\u0000${port}\u0000${community}\u0000${version}`;
    if (!this.sessions.has(key)) {
      this.sessions.set(key, this.snmp.createSession(String(map.moduleID), community, {
        port,
        version,
        timeout: DEFAULT_TIMEOUT
      }));
    }
    return this.sessions.get(key);
  }
}

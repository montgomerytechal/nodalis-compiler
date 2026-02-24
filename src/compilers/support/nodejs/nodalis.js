// Copyright [2025] Nathan Skipper
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


/**
 * @description Nodalis PLC for NodeJs
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */
import {IOClient, IOMap, setTiming, setMemoryAccess} from "./IOClient.js"
import {ModbusClient} from "./modbus.js";
import { OPCClient } from "./opcua.js";
import { GPIOClient } from "./gpio.js";
import { BacnetClient } from "./bacnet.js";

const MEMORY = Array.from({ length: 64 }, () =>
  Array.from({ length: 16 }, () => new Uint8Array(8))
);

export let PROGRAM_START = Date.now();
export function elapsed() {
  return Date.now() - PROGRAM_START;
}

setTiming(elapsed);
setMemoryAccess({
  readBitFunc: readBit,
  readByteFunc: readByte,
  readWordFunc: readWord,
  readDWordFunc: readDWord,
  writeBitFunc: writeBit,
  writeByteFunc: writeByte,
  writeWordFunc: writeWord,
  writeDWordFunc: writeDWord
});

const Statics = {};

export function newStatic(varname, Class){
  var ret = null;
  if(typeof Statics[varname] !== "undefined"){
    ret = Statics[varname];
  }
  else{
    ret = new Class();
    Statics[varname] = ret;
  }
  return ret;
}

export function resolve(val) {
  return val instanceof RefVar ? val.value : val;
}

export function createReference(address){
  return new RefVar(address);
}
export class RefVar {
  /**
   * 
   * @param {string} address 
   */
  constructor(address) {
    this.address = address;
    this.type = "bit"; // "bit", "byte", "word", "dword"
    const width = address.substring(2, 3).toUpperCase();
    if(address.indexOf(".") === -1){
      switch(width){
        case "X": this.type = "byte"; break;
        case "W": this.type = "word"; break;
        case "D": this.type = "dword"; break;
      }
    }
    
  }

  get value() {
    switch (this.type) {
      case 'bit': return readBit(this.address);
      case 'byte': return readByte(this.address);
      case 'word': return readWord(this.address);
      case 'dword': return readDWord(this.address);
      default: throw new Error('Unsupported RefVar type: ' + this.type);
    }
  }

  set value(val) {
    switch (this.type) {
      case 'bit': return writeBit(this.address, val);
      case 'byte': return writeByte(this.address, val);
      case 'word': return writeWord(this.address, val);
      case 'dword': return writeDWord(this.address, val);
      default: throw new Error('Unsupported RefVar type: ' + this.type);
    }
  }

  getBit(bit) {
    const temp = this.value;
    const buffer = Buffer.allocUnsafe(4);
    if (this.type === 'byte') buffer.writeUInt8(temp);
    else if (this.type === 'word') buffer.writeUInt16LE(temp);
    else if (this.type === 'dword') buffer.writeUInt32LE(temp);
    else throw new Error("Cannot use getBit on bit type");

    return (buffer[Math.floor(bit / 8)] & (1 << (bit % 8))) !== 0;
  }

  setBit(bit, value) {
    const temp = this.value;
    const buffer = Buffer.allocUnsafe(4);
    if (this.type === 'byte') buffer.writeUInt8(temp);
    else if (this.type === 'word') buffer.writeUInt16LE(temp);
    else if (this.type === 'dword') buffer.writeUInt32LE(temp);
    else throw new Error("Cannot use setBit on bit type");

    const byteIndex = Math.floor(bit / 8);
    const bitMask = 1 << (bit % 8);
    if (value) buffer[byteIndex] |= bitMask;
    else buffer[byteIndex] &= ~bitMask;

    const updated =
      this.type === 'byte' ? buffer.readUInt8(0) :
      this.type === 'word' ? buffer.readUInt16LE(0) :
      buffer.readUInt32LE(0);
    this.value = updated;
  }
  valueOf() {
    return this.value;  // so JS treats it like a number or boolean
  }

  [Symbol.toPrimitive](hint) {
    return this.value;
  }

}

export function parseAddress(address) {
  const regex = /^%([IQM])([XWD])([0-9]+)(?:\.(\d+))?$/i;
  const match = address.match(regex);
  if (!match) throw new Error("Invalid address: " + address);
  const [, space, type, indexStr, bitStr] = match;
  const width = type.toUpperCase() === "X" ? 8 : type.toUpperCase() === "W" ? 16 : 32;
  const index = parseInt(indexStr, 10);
  const bit = bitStr !== undefined ? parseInt(bitStr, 10) : -1;
  return [space.toUpperCase(), width, index, bit];
}

export function getMemoryByte(space, addr) {
  let r = -1, c = 0, b = 0;
  switch (space) {
    case 'Q': r = Math.floor((addr * 8) / 64); c = 1; b = addr % 8; break;
    case 'I': r = Math.floor((addr * 8) / 64); c = 0; b = addr % 8; break;
    case 'M': r = Math.floor((addr * 8) / (64 * 14)); c = Math.floor(addr / 112) + 2; b = addr % 8; break;
    default: throw new Error("Invalid space");
  }
  return MEMORY[r]?.[c];
}

export function getMemoryTyped(space, addr, type) {
  const byteOffset = type === 2 ? addr * 2 : type === 4 ? addr * 4 : addr;
  const r = Math.floor(byteOffset / 64);
  const c = space === 'Q' ? 1 : space === 'I' ? 0 : Math.floor(addr / 112) + 2;
  const base = MEMORY[r]?.[c];
  if (!base) throw new Error("Invalid memory");
  return new DataView(base.buffer, base.byteOffset, base.byteLength);
}

export function getBit(buffer, bit) {
  const byte = Math.floor(bit / 8);
  const mask = 1 << (bit % 8);
  let compVal = 0;
  if(buffer instanceof Uint8Array){
    compVal = buffer[byte];
  }
  else if(buffer instanceof RefVar){
    compVal = buffer.value;
  }
  else{
    compVal = buffer;
  }
  return (compVal & mask) !== 0;
}

export function setBit(buffer, bit, value) {
  const byte = Math.floor(bit / 8);
  const mask = 1 << (bit % 8);
  if(buffer instanceof Uint8Array){
    if (value) buffer[byte] |= mask;
    else buffer[byte] &= ~mask;
  }
  else if(buffer instanceof RefVar){
    buffer.setBit(bit, value);
  }
}

export function readByte(address) {
  const [space, width, index, bit] = parseAddress(address);
  if (width !== 8 || bit > -1) throw new Error("Invalid byte address: " + address);
  return getMemoryByte(space, index)[0];
}

export function writeByte(address, value) {
  const [space, width, index, bit] = parseAddress(address);
  if (width !== 8 || bit > -1) throw new Error("Invalid byte address: " + address);
  getMemoryByte(space, index)[0] = value;
}

export function readWord(address) {
  const [space, width, index, bit] = parseAddress(address);
  if (width !== 16 || bit > -1) throw new Error("Invalid word address: " + address);
  return getMemoryTyped(space, index, 2).getUint16(0, true);
}

export function writeWord(address, value) {
  const [space, width, index, bit] = parseAddress(address);
  if (width !== 16 || bit > -1) throw new Error("Invalid word address: " + address);
  getMemoryTyped(space, index, 2).setUint16(0, value, true);
}

export function readDWord(address) {
  const [space, width, index, bit] = parseAddress(address);
  if (width !== 32 || bit > -1) throw new Error("Invalid dword address: " + address);
  return getMemoryTyped(space, index, 4).getUint32(0, true);
}

export function writeDWord(address, value) {
  const [space, width, index, bit] = parseAddress(address);
  if (width !== 32 || bit > -1) throw new Error("Invalid dword address: " + address);
  getMemoryTyped(space, index, 4).setUint32(0, value, true);
}

export function readBit(address) {
  const [space, width, index, bit] = parseAddress(address);
  if (bit === -1) throw new Error("Missing bit index in address: " + address);
  const buffer = getMemoryByte(space, index);
  return getBit(buffer, bit);
}

export function writeBit(address, value) {
  const [space, width, index, bit] = parseAddress(address);
  if (bit === -1) throw new Error("Missing bit index in address: " + address);
  const buffer = getMemoryByte(space, index);
  setBit(buffer, bit, value);
}

export function readAddress(address){
  if(address.includes(".")){
    return readBit(address);
  }
  else{
    switch(address[2]){
      case "X":
        return readByte(address);
      
      case "W":
        return readWord(address);
      
      case "D":
        return readDWord(address);
      
    }
  }
}

export function writeAddress(address, value){
  if(address.includes(".")){
    writeBit(address, value);
  }
  else{
    switch(address[2]){
      case "X":
        writeByte(address, value);
      break;
      case "W":
        writeWord(address, value);
      break;
      case "D":
        writeDWord(address, value);
      break;
    }
  }
}

// Function Block base class pattern
export class FunctionBlock {
  call() {}
}

// Logic Gates
export const AND = (a, b) => a && b;
export const OR = (a, b) => a || b;
export const XOR = (a, b) => a !== b;
export const NOR = (a, b) => !(a || b);
export const NAND = (a, b) => !(a && b);
export const NOT = (a) => !(a);

export class TON extends FunctionBlock {
  constructor() {
    super();
    this.IN = false;
    this.PT = 0;
    this.Q = false;
    this.ET = 0;
    this._startTime = 0;
  }
  call() {
    if (this.IN) {
      if (this._startTime === 0) this._startTime = elapsed();
      this.ET = elapsed() - this._startTime;
      this.Q = this.ET >= this.PT;
    } else {
      this._startTime = 0;
      this.ET = 0;
      this.Q = false;
    }
  }
}

export class TOF extends FunctionBlock {
  constructor() {
    super();
    this.IN = false;
    this.PT = 0;
    this.Q = false;
    this.ET = 0;
    this._startTime = 0;
  }
  call() {
    if (this.IN) {
      this.Q = true;
      this._startTime = 0;
      this.ET = 0;
    } else if (this.Q) {
      if (this._startTime === 0) this._startTime = elapsed();
      this.ET = elapsed() - this._startTime;
      if (this.ET >= this.PT) this.Q = false;
    }
  }
}

export class TP extends FunctionBlock {
  constructor() {
    super();
    this.IN = false;
    this.PT = 0;
    this.Q = false;
    this.ET = 0;
    this._startTime = 0;
    this._lastIN = false;
  }
  call() {
    this.Q = false;
    if (!this._lastIN && this.IN) {
      this._lastIN = this.IN;
      this.ET = 0;
      this._startTime = 0;
    }
    if (this.IN) {
      this.Q = true;
    } else if (this._lastIN && !this.IN) {
      if (this._startTime === 0) this._startTime = elapsed();
      this.ET = elapsed() - this._startTime;
      this.Q = this.PT >= this.ET;
      if (!this.Q) this._lastIN = false;
    }
  }
}

export class R_TRIG extends FunctionBlock {
  constructor() {
    super();
    this.CLK = false;
    this.OUT = false;
    this._lastCLK = false;
  }
  call() {
    this.OUT = this.CLK && !this._lastCLK;
    this._lastCLK = this.CLK;
  }
}

export class F_TRIG extends FunctionBlock {
  constructor() {
    super();
    this.CLK = false;
    this.OUT = false;
    this._lastCLK = false;
  }
  call() {
    this.OUT = !this.CLK && this._lastCLK;
    this._lastCLK = this.CLK;
  }
}

export class CTU extends FunctionBlock {
  constructor() {
    super();
    this.CU = false;
    this.R = false;
    this.PV = 0;
    this.CV = 0;
    this.Q = false;
    this._lastCU = false;
  }
  call() {
    if (this.R) {
      this.CV = 0;
    } else if (this.CU && !this._lastCU) {
      this.CV++;
    }
    this.Q = this.CV >= this.PV;
    this._lastCU = this.CU;
  }
}

export class CTD extends FunctionBlock {
  constructor() {
    super();
    this.CD = false;
    this.LD = false;
    this.PV = 0;
    this.CV = 0;
    this.Q = false;
    this._lastCD = false;
  }
  call() {
    if (this.LD) {
      this.CV = this.PV;
    } else if (this.CD && !this._lastCD && this.CV > 0) {
      this.CV--;
    }
    this.Q = this.CV === 0;
    this._lastCD = this.CD;
  }
}

export class CTUD extends FunctionBlock {
  constructor() {
    super();
    this.CU = false;
    this.CD = false;
    this.R = false;
    this.LD = false;
    this.PV = 0;
    this.CV = 0;
    this.QU = false;
    this.QD = false;
    this._lastCU = false;
    this._lastCD = false;
  }
  call() {
    if (this.R) {
      this.CV = 0;
    } else if (this.LD) {
      this.CV = this.PV;
    } else {
      if (this.CU && !this._lastCU) this.CV++;
      if (this.CD && !this._lastCD && this.CV > 0) this.CV--;
    }
    this.QU = this.CV >= this.PV;
    this.QD = this.CV === 0;
    this._lastCU = this.CU;
    this._lastCD = this.CD;
  }
}

export const EQ = (a, b) => a === b;
export const NE = (a, b) => a !== b;
export const LT = (a, b) => a < b;
export const GT = (a, b) => a > b;
export const GE = (a, b) => a >= b;
export const LE = (a, b) => a <= b;

export const MOVE = (IN, OUT) => {
  OUT = IN;
}


export const SEL = (G, IN0, IN1) => {
  return G ? IN1 : IN0;
}

export const MUX = (K, ...INS) => {

  if (K < 0 || K >= INS.length) {
    throw new RangeError("MUX selector out of range.");
  }
  return INS[K];
}

export const MIN = Math.min;

export const MAX = Math.max;

export const LIMIT = (MN, IN, MX) => {
  if (IN < MN) return MN;
  else if (IN > MX) return MX;
  else return IN;
}

export const ADD = (...args) => {
  return args.reduce((sum, val) => sum + val, 0);
};

export const MUL = (...args) => {
  return args.reduce((prod, val) => prod * val, 1);
};

export const DIV = (IN1, IN2) => {
  return IN1 / IN2;
};

export const SUB = (IN1, IN2) => {
  return IN1 - IN2;
};

export const EXPT = (IN1, IN2) => {
  return Math.pow(IN1, IN2);
  // or: return IN1 ** IN2;
};

export const LOG = (IN) => {
  return Math.log10(IN);   // base-10 log
};

export const LN = (IN) => {
  return Math.log(IN);     // natural log
};

export const MOD = (IN1, IN2) => {
  return IN1 % IN2;
};

export const SIN = (IN) => {
  return Math.sin(IN);
};

export const COS = (IN) => {
  return Math.cos(IN);
};

export const TAN = (IN) => {
  return Math.tan(IN);
};

export const ASIN = (IN) => {
  return Math.asin(IN);
};

export const ACOS = (IN) => {
  return Math.acos(IN);
};

export const ATAN = (IN) => {
  return Math.atan(IN);
};

export const ABS = (IN) => {
  return Math.abs(IN);
};

export const SQRT = (IN) => {
  return Math.sqrt(IN);
};

export const EXP = (IN) => {
  return Math.exp(IN);
};

export const SHL = (IN, N) => {
  N = N & 31; // normalize to 0..31
  return (IN << N) | 0;
};

// Logical shift right (fills with 0s)
export const SHR = (IN, N) => {
  N = N & 31;
  return (IN >>> N) >>> 0;
};

// Rotate left (32-bit)
export const ROL = (IN, N) => {
  N = N & 31;
  IN = IN >>> 0; // force unsigned 32-bit
  return ((IN << N) | (IN >>> (32 - N))) >>> 0;
};

// Rotate right (32-bit)
export const ROR = (IN, N) => {
  N = N & 31;
  IN = IN >>> 0; // force unsigned 32-bit
  return ((IN >>> N) | (IN << (32 - N))) >>> 0;
};


const Clients = [];

function findClient(map) {
  for (const client of Clients) {
    if (client.hasMapping(map.localAddress)) return client;
    if (client.moduleID === map.moduleID) {
      client.addMapping(map);
      return client;
    }
  }
  return null;
}

function createClient(map) {
  const protocol = String(map.protocol || "").toUpperCase();
  if (protocol === "MODBUS-TCP") {
    const modbusClient = new ModbusClient();
    modbusClient.addMapping(map);
    modbusClient.connect();
    return modbusClient;
  }
  else if (protocol === "OPCUA") {
    const opcClient = new OPCClient();
    opcClient.addMapping(map);
    opcClient.connect();
    return opcClient;
  }
  else if (protocol === "BACNET" || protocol === "BACNET-IP") {
    const bacnetClient = new BacnetClient();
    bacnetClient.addMapping(map);
    bacnetClient.connect();
    return bacnetClient;
  }
  else if (protocol === "GPIO") {
    if (process.platform !== "linux") {
      return null;
    }
    const gpioClient = new GPIOClient();
    gpioClient.addMapping(map);
    gpioClient.connect();
    return gpioClient;
  }
  
  return null;
}

export function mapIO(mapStr) {
  try {
    const newMap = new IOMap(mapStr);
    const existing = findClient(newMap);
    if (!existing) {
      const client = createClient(newMap);
      if (client) Clients.push(client);
    }
  } catch (e) {
    console.error("MapIO Exception:", e.message);
  }
}

export function superviseIO() {
  try {
    for (const client of Clients) {
      client.poll();
    }
  } catch (e) {
    console.error("SuperviseIO Exception:", e.message);
  }
}

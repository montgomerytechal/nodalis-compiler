let elapsed = () => {return Date.now();};
let readBit = null;
let writeBit = null;
let readByte = null;
let writeByte = null;
let readWord = null;
let writeWord = null;
let readDWord = null;
let writeDWord = null;

export function setTiming(el){
    elapsed = el;
}

export function setMemoryAccess(options){
    const { readBitFunc, readByteFunc, readWordFunc, readDWordFunc, writeBitFunc, writeByteFunc, writeWordFunc, writeDWordFunc } = options;
    readBit = readBitFunc;
    readByte = readByteFunc;
    readWord = readWordFunc;
    readDWord = readDWordFunc;
    writeBit = writeBitFunc;
    writeByte = writeByteFunc;
    writeWord = writeWordFunc;
    writeDWord = writeDWordFunc;
}

export class IOMap {
  constructor(jsonStr) {
    const j = JSON.parse(jsonStr);
    this.moduleID = j.ModuleID;
    this.modulePort = j.ModulePort;
    this.localAddress = j.InternalAddress;
    this.remoteAddress = j.RemoteAddress;
    this.width = parseInt(j.RemoteSize);
    this.interval = parseInt(j.PollTime);
    this.protocol = j.Protocol;
    this.additionalProperties = j.AdditionalProperties || {};
    this.direction = this.localAddress.includes("%Q") ? "Output" : "Input";
    this.lastPoll = elapsed();
    this.bit = -1;
  }
}

export class IOClient {
  constructor(protocol) {
    this.protocol = protocol;
    this.connected = false;
    this.moduleID = "";
    this.lastAttempt = 0;
    this.mappings = [];
  }

  addMapping(map) {
    if (!this.hasMapping(map.localAddress)) {
      if (this.mappings.length === 0) {
        this.moduleID = map.moduleID;
      }
      console.log(`Adding map for ${map.moduleID}:${map.modulePort}->${map.localAddress}`);
      this.mappings.push(map);
    }
  }

  hasMapping(localAddress) {
    return this.mappings.some(m => m.localAddress === localAddress);
  }

  poll() {
    if (this.connected) {
      for (const map of this.mappings) {
        try {
          if (elapsed() - map.lastPoll > map.interval) {
            map.lastPoll = elapsed();
            if (map.direction === "Output") {
              let val;
              switch (map.width) {
                case 1: val = readBit(map.localAddress); this.writeBit(map.remoteAddress, val ? 1 : 0); break;
                case 8: val = readByte(map.localAddress); this.writeByte(map.remoteAddress, val); break;
                case 16: val = readWord(map.localAddress); this.writeWord(map.remoteAddress, val); break;
                case 32: val = readDWord(map.localAddress); this.writeDWord(map.remoteAddress, val); break;
              }
            } else if (map.direction === "Input") {
              switch (map.width) {
                case 1: this.readBit(map.remoteAddress, (bit) => writeBit(map.localAddress, !!bit)); break;
                case 8: this.readByte(map.remoteAddress, (val) => writeByte(map.localAddress, val)); break;
                case 16: this.readWord(map.remoteAddress, (val) => writeWord(map.localAddress, val)); break;
                case 32: this.readDWord(map.remoteAddress, (val) => writeDWord(map.localAddress, val)); break;
              }
            }
          }
        } catch (e) {
          console.error("IO Poll Error:", e);
        }
      }
    } else if (elapsed() - this.lastAttempt >= 15000) {
      this.lastAttempt = elapsed();
      this.connect();
    }
  }

  // Abstract methods
  readBit(remote, callback) {}
  writeBit(remote, value) {}
  readByte(remote, callback) {}
  writeByte(remote, value) {}
  readWord(remote, callback) {}
  writeWord(remote, value) {}
  readDWord(remote, callback) {}
  writeDWord(remote, value) {}
  connect() {}
}
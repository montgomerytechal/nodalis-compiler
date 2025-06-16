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
 * @description Modbus Client for NodeJS
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */
import * as Modbus from "jsmodbus";
import * as net from "net";
import {IOClient, IOMap} from "./IOClient.js";

export class ModbusClient extends IOClient {
  constructor() {
    super('MODBUS-TCP');
    this.socket = null;
    this.client = null;
  }

  connect() {
    try {
      this.socket = new net.Socket();
      this.client = new Modbus.client.TCP(this.socket);
      const map = this.mappings[0];
      const [host, port] = [map.moduleID, map.modulePort];
      this.socket.connect({ host, port: parseInt(port) }, () => {
        console.log('Modbus connected to', host, port);
        this.connected = true;
      });
      this.socket.on('error', err => {
        console.error('Modbus socket error:', err.message);
        this.connected = false;
      });
      this.socket.on('close', () => {
        this.connected = false;
      });
    } catch (e) {
      console.error('Connect error:', e.message);
      this.connected = false;
    }
  }

  readBit(address, cb) {
    const reg = parseInt(address);
    this.client.readDiscreteInputs(reg, 1)
      .then(res => 
        cb(res.response._body.valuesAsArray[0]))
      .catch(err => console.error('readBit error', err.message));
  }

  writeBit(address, value) {
    const reg = parseInt(address);
    this.client.writeSingleCoil(reg, value)
      .catch(err => console.error('writeBit error', err.message));
  }

  readByte(address, cb) {
    const reg = parseInt(address);
    this.client.readHoldingRegisters(reg, 1)
      .then(res => cb(res.response._body.valuesAsBuffer[1]))
      .catch(err => console.error('readByte error', err.message));
  }

  writeByte(address, value) {
    const reg = parseInt(address);
    this.client.writeSingleRegister(reg, value)
      .catch(err => console.error('writeByte error', err.message));
  }

  readWord(address, cb) {
    const reg = parseInt(address);
    this.client.readHoldingRegisters(reg, 1)
      .then(res => cb(res.response._body.valuesAsBuffer.readUInt16BE(0)))
      .catch(err => console.error('readWord error', err.message));
  }

  writeWord(address, value) {
    const reg = parseInt(address);
    this.client.writeSingleRegister(reg, value)
      .catch(err => console.error('writeWord error', err.message));
  }

  readDWord(address, cb) {
    const reg = parseInt(address);
    this.client.readHoldingRegisters(reg, 2)
      .then(res => {
        const b = res.response._body.valuesAsBuffer;
        const val = b.readUInt32BE(0);
        cb(val);
      })
      .catch(err => console.error('readDWord error', err.message));
  }

  writeDWord(address, value) {
    const reg = parseInt(address);
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(value);
    this.client.writeMultipleRegisters(reg, buf)
      .catch(err => console.error('writeDWord error', err.message));
  }
}


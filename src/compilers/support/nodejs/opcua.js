import { IOClient } from './IOClient.js';
import {
  OPCUAClient,
  AttributeIds,
  DataType,
  StatusCodes,
  Variant
} from 'node-opcua';

export class OPCClient extends IOClient {
  constructor(endpointUrl) {
    super('OPCUA');
    this.endpointUrl = endpointUrl;
    this.client = OPCUAClient.create({ endpoint_must_exist: false });
    this.session = null;
  }

  async connect() {
    try {
        if(this.moduleID.length > 0){
            this.endpointUrl = this.moduleID;
        }
      console.log(`Connecting to OPC UA server at ${this.endpointUrl}`);
      await this.client.connect(this.endpointUrl);
      this.session = await this.client.createSession();
      this.connected = true;
      console.log("OPC UA connected.");
    } catch (err) {
      console.error("OPC UA connection error:", err);
      this.connected = false;
    }
  }

  getNodeId(remote) {
    // Expects node format: "SW2" -> "ns=1;s=SW2"
    return `ns=1;s=${remote}`;
  }

  async readValue(remote, dataType, callback) {
    if (!this.connected) return callback(null);
    try {
      const nodeId = this.getNodeId(remote);
      const result = await this.session.read({
        nodeId,
        attributeId: AttributeIds.Value
      });
      callback(result.value.value);
    } catch (err) {
      console.error(`Read error [${remote}]`, err);
      callback(null);
    }
  }

  async writeValue(remote, value, dataType) {
    if (!this.connected) return;
    try {
      const nodeId = this.getNodeId(remote);
      const variant = new Variant({ dataType, value });
      const statusCode = await this.session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value: variant }
      });
      if (statusCode !== StatusCodes.Good) {
        console.warn(`Write to ${remote} failed: ${statusCode.toString()}`);
      }
    } catch (err) {
      console.error(`Write error [${remote}]`, err);
    }
  }

  readBit(remote, callback) {
    this.readValue(remote, DataType.Boolean, callback);
  }

  writeBit(remote, value) {
    this.writeValue(remote, !!value, DataType.Boolean);
  }

  readByte(remote, callback) {
    this.readValue(remote, DataType.Byte, callback);
  }

  writeByte(remote, value) {
    this.writeValue(remote, value, DataType.Byte);
  }

  readWord(remote, callback) {
    this.readValue(remote, DataType.UInt16, callback);
  }

  writeWord(remote, value) {
    this.writeValue(remote, value, DataType.UInt16);
  }

  readDWord(remote, callback) {
    this.readValue(remote, DataType.UInt32, callback);
  }

  writeDWord(remote, value) {
    this.writeValue(remote, value, DataType.UInt32);
  }
}

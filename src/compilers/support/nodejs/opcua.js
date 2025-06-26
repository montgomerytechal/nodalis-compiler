import { IOClient } from './IOClient.js';
import {
  OPCUAClient,
  AttributeIds,
  DataType,
  StatusCodes,
  Variant,
  OPCUAServer
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


export class OPCServer {
  constructor() {
    this.server = new OPCUAServer({
      port: 4840,
      resourcePath: "/UA/Imperium",
      buildInfo: {
        productName: "ImperiumServer",
        buildNumber: "1",
        buildDate: new Date()
      }
    });

    this.addressMap = new Map(); // maps nodeId -> address string
    this.readCallback = null;
    this.writeCallback = null;
  }

  setReadWriteHandlers(readHandler, writeHandler) {
    this.readCallback = readHandler;
    this.writeCallback = writeHandler;
  }

  async initialize() {
    await this.server.initialize();
    const addressSpace = this.server.engine.addressSpace;
    this.namespace = addressSpace.getOwnNamespace();
  }

  async start() {
    await this.initialize();
    await this.server.start();
    console.log("OPCUA Server is now listening at", this.server.endpoints[0].endpointDescriptions()[0].endpointUrl);
  }

  async stop() {
    await this.server.shutdown(1000);
    console.log("OPCUA Server has shut down.");
  }

  mapVariable(varname, addr) {
    const nodeId = `ns=1;s=${varname}`;
    this.addressMap.set(nodeId, addr);

    this.namespace.addVariable({
      organizedBy: this.server.engine.addressSpace.rootFolder.objects,
      nodeId: nodeId,
      browseName: varname,
      dataType: this._guessDataType(addr),
      value: {
        get: () => this._read(addr),
        set: (variant) => this._write(addr, variant)
      }
    });
  }

  _read(addr) {
    if (!this.readCallback) return new Variant({ dataType: DataType.Boolean, value: false });
    const val = this.readCallback(addr);
    return new Variant(this._valueToVariant(val));
  }

  _write(addr, variant) {
    if (!this.writeCallback) return StatusCodes.BadNotWritable;
    this.writeCallback(addr, variant.value);
    return StatusCodes.Good;
  }

  _guessDataType(addr) {
    if (addr.includes(".")) return DataType.Boolean;
    switch (addr[2]) {
      case 'X': return DataType.Byte;
      case 'W': return DataType.UInt16;
      case 'D': return DataType.UInt32;
      default: return DataType.Boolean;
    }
  }

  _valueToVariant(value) {
    const type = typeof value;
    if (type === "boolean") return { dataType: DataType.Boolean, value };
    if (type === "number") {
      if (value <= 255) return { dataType: DataType.Byte, value };
      if (value <= 65535) return { dataType: DataType.UInt16, value };
      return { dataType: DataType.UInt32, value };
    }
    return { dataType: DataType.Null, value: null };
  }
}

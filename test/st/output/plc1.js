import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord,
        getBit, setBit, IOClient, RefVar, superviseIO, mapIO
} from "./imperium.js";
// Global variable declarations
let SW1 = new RefVar("%IX0.0");
export class PLS { // FUNCTION_BLOCK:PLS
  constructor() {
    this.EN = null;
    this.PT = null;
    this.Q = null;
    this.Timer = new TP();
    this.Time = null;
  }
  call() {
    this.Timer.call();
    this.Timer.IN = this.EN;
    this.Timer.PT = this.PT;
    this.Q = ( this.Timer.Q );
  }
}
export function PLC_LD() { // PROGRAM:PLC_LD
let PLS1 = new TP();
PLS1.call();
PLS1.IN = SW1;
PLS1.PT = 1000;
writeBit("%QX0.0", ( PLS1.Q ));
writeBit("%QX0.1", ( ( ! SW1 ) ));
writeBit("%QX0.2", ( ( ( PLS1.ET >= 500 ) ) ));
}

export function setup(){
    mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"16\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"17\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.1\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");

}

export function run() {
  setup();
  console.log("PLC1 is running!");
  setInterval(1, superviseIO);
  
    setInterval(100, () => {
        PLC_LD();

    });

}
import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord,
        getBit, setBit, resolve, newStatic, RefVar, superviseIO, mapIO, createReference,
        TON, TOF, TP, R_TRIG, F_TRIG, CTU, CTD, CTUD,
        AND, OR, XOR, NOR, NAND, NOT, ASSIGNMENT,
        EQ, NE, LT, GT, GE, LE,
        MOVE, SEL, MUX, MIN, MAX, LIMIT
} from "./imperium.js";
// Global variable declarations
let SW1 = createReference("%IX0.0");
let SW2 = createReference("%IX0.1");
export class PLS { // FUNCTION_BLOCK:PLS
  constructor() {
    this.EN = null;
    this.PT = null;
    this.Q = null;
    this.Timer = newStatic("PLS.Timer", TP);
    this.Time = null;
  }
  call() {
    this.Timer.call();
    this.Timer.IN = resolve(this.EN);
    this.Timer.PT = resolve(this.PT);
    this.Q = ( resolve(this.Timer.Q) );
  }
}
export function PLC_LD() { // PROGRAM:PLC_LD
let PLS1 = newStatic("PLS1", TP);
false
PLC_LD
PLS1.call();
PLS1.IN = resolve(SW1);
PLS1.PT = 1000;
writeBit("%QX0.0", ( ( resolve(SW2) ) || resolve(PLS1.Q) ));
}

export function setup(){
    mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"16\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"opc.tcp://localhost:4334/UA/imperium\",\"ModulePort\":\"0\",\"Protocol\":\"OPCUA\",\"RemoteAddress\":\"Input1\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.1\",\"Resource\":\"PLC1\",\"PollTime\":\"1000\",\"ProtocolProperties\":\"{}\"}");

    console.log("PLC1 is running!");
}

export function run(){
    setInterval(superviseIO, 1); 
    
    setInterval(() => {
        PLC_LD();

    }, 100);

    
}

setup();
run();
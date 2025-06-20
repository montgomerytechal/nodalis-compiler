import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord,
        getBit, setBit, resolve, newStatic, RefVar, superviseIO, mapIO, createReference,
        TON, TOF, TP, R_TRIG, F_TRIG, CTU, CTD, CTUD,
        AND, OR, XOR, NOR, NAND, NOT, ASSIGNMENT,
        EQ, NE, LT, GT, GE, LE,
        MOVE, SEL, MUX, MIN, MAX, LIMIT
} from "./imperium.js";
export class Timer { // FUNCTION_BLOCK:Timer
  constructor() {
    this.Start = null;
    this.Done = null;
    this.Counter = 0;
  }
  call() {
    this.Counter = resolve(this.Counter) + 1;
  }
}
export function PLC_PROG() { // PROGRAM:PLC_PROG
let T1 = newStatic("T1", Timer);
let IN;
false
PLC_PROG
T1.call();
IN = readBit("%I0001.0");
if (resolve(T1.Start) == true && ! resolve(T1.Done)) {
  writeBit("%Q0001.0", 1);
}
else if (resolve(T1.Done) == true) {
  T1.Start = false;
  writeBit("%Q0001.0", 0);
}
}

export function setup(){
    
    console.log("ImperiumPLC is running!");
}

export function run(){
    setInterval(superviseIO, 1); 
    setInterval(() => {
PLC_PROG();
}, 100);
    
}

setup();
run();
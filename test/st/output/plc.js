import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord,
        getBit, setBit, resolve, newStatic, RefVar, superviseIO, mapIO,
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
    this.Counter = resolve(this.Counter + 1);
  }
}
export function PLC_PROG() { // PROGRAM:PLC_PROG
let T1 = newStatic("T1", Timer);
let IN;
false
PLC_PROG
T1.call();
IN = resolve(readBit("%I0001.0"));
if (T1.Start == true && ! T1.Done) {
  writeBit("%Q0001.0", 1);
}
else if (T1.Done == true) {
  T1.Start = resolve(false);
  writeBit("%Q0001.0", 0);
}
}

export function setup(){
    
}

export function run(){
    setInterval(superviseIO, 1); 
    setInterval(() => {
PLC_PROG();
}, 100);
    console.log("ImperiumPLC is running!");
}

setup();
run();
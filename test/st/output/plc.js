import {
        readBit, writeBit, readByte, writeByte, readWord, writeWord, readDWord, writeDWord,
        getBit, setBit, IOClient, RefVar, superviseIO, mapIO
} from "./imperium.js";
export class Timer { // FUNCTION_BLOCK:Timer
  constructor() {
    this.Start = null;
    this.Done = null;
    this.Counter = 0;
  }
  call() {
    this.Counter = this.Counter + 1;
  }
}
export function PLC_PROG() { // PROGRAM:PLC_PROG
let T1 = new Timer();
let IN;
T1.call();
IN = readBit("%I0001.0");
if (T1.Start == true && ! T1.Done) {
  writeBit("%Q0001.0", 1);
}
else if (T1.Done == true) {
  T1.Start = false;
  writeBit("%Q0001.0", 0);
}
}

export function setup(){
    
}

export function run() {
  setup();
  console.log("ImperiumPLC is running!");
  setInterval(1, superviseIO);
  setInterval(100, () => {
PLC_PROG();
});
}
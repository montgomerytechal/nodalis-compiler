#include "imperium.h"
#include "modbus.h"
class Timer {//FUNCTION_BLOCK:Timer
public:
  bool Start;
  bool Done;
  int16_t Counter;
  void operator()() {
    Counter = Counter + 1;
  }
};

void PLC_PROG() { //PROGRAM:PLC_PROG
auto T1;
uint64_t IN;
IN = % I0001 . 0;
// uncompilable statement {"type":"IF","condition":"T1","thenBlock":null,"elseIfBlocks":[],"elseBlock":null}
0 = 1;
Done = true THEN T1 . Start : == false;
0 = 0;
}


int main() {
  uint cycleCount = 0;
  while (true) {
    gatherInputs();
    PLC_PROG();

    handleOutputs();
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
    cycleCount++;
    if(cycleCount >= 604800000){
        cycleCount = 0;
    }
   }
  return 0;
}
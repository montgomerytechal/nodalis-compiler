#include "imperium.h"
#include "modbus.h"
class PLS {//FUNCTION_BLOCK:PLS
public:
  bool EN;
  int16_t PT;
  bool Q;
  auto Timer;
  int16_t Time;
  void operator()() {
  }
};

void PLC_LD() { //PROGRAM:PLC_LD
auto TP00010;
}


int main() {
  uint cycleCount = 0;
  while (true) {
    gatherInputs();
    
    if(cycleCount % 100 == 0){
        PLC_LD();

    }

    handleOutputs();
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
    cycleCount++;
    if(cycleCount >= 604800000){
        cycleCount = 0;
    }
   }
  return 0;
}
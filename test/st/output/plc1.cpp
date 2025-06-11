#include "imperium.h"
#include <chrono>
#include <thread>
#include <cstdint>
#include <limits>
// Global variable declarations
uint64_t LD0001;
uint64_t IL0001;
uint64_t BI0001;
uint64_t CI0001;
uint64_t BO0001;
uint64_t CO0001;
RefVar<uint32_t> SW0001_0("%MD0");

class PLS {//FUNCTION_BLOCK:PLS
public:
bool EN;
int16_t PT;
bool Q;
static TP Timer;
int16_t Time;
  void operator()() {
    Timer();
    Timer.IN = EN;
    Timer.PT = PT;
    Q = ( Timer.Q );
  }
};

void PLC_LD() { //PROGRAM:PLC_LD
static TP TP00010;
int16_t Time;
TP00010();
TP00010.IN = ! getBit(&IL0001, 0) && ( ( getBit(&SW0001_0, 0) ) );
TP00010.PT = 1000;
Time = ( TP00010.ET );
writeBit("%Q0.0", ! ( ( ( Time > 2000 ) ) || TP00010.Q ));
}


int main() {
  while (true) {
    gatherInputs();
    
    if(PROGRAM_COUNT % 100 == 0){
        PLC_LD();

    }

    handleOutputs();
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
    PROGRAM_COUNT++;
    if(PROGRAM_COUNT >= std::numeric_limits<uint64_t>::max()){
        PROGRAM_COUNT = 0;
    }
   }
  return 0;
}
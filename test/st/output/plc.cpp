#include "imperium.h"
#include <chrono>
#include <thread>
#include <cstdint>
#include <limits>
class Timer {//FUNCTION_BLOCK:Timer
public:
bool Start;
bool Done;
int16_t Counter = 0;
  void operator()() {
    Counter = Counter + 1;
  }
};

void PLC_PROG() { //PROGRAM:PLC_PROG
static Timer T1;
uint64_t IN;
T1();
IN = readBit("%I0001.0");
if (T1.Start == true && ! T1.Done) {
  writeBit("%Q0001.0", 1);
}
else if (T1.Done == true) {
  T1.Start = false;
  writeBit("%Q0001.0", 0);
}
}


int main() {
  
  std::cout << "ImperiumPLC is running!\n";
  while (true) {
    try{
        superviseIO();
        PLC_PROG();

        std::this_thread::sleep_for(std::chrono::milliseconds(1));
        PROGRAM_COUNT++;
        if(PROGRAM_COUNT >= std::numeric_limits<uint64_t>::max()){
            PROGRAM_COUNT = 0;
        }
    }
    catch(const std::exception& e){
        std::cout << "Caught exception: " << e.what() << "\n";
    }
  }
  return 0;
}
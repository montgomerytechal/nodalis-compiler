#include "imperium.h"
#include <chrono>
#include <thread>
#include <cstdint>
#include <limits>
// Global variable declarations
RefVar<bool> SW1("%IX0.0");

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
writeBit("%QX0.0", ! ( ( SW1 ) ));
}


int main() {
  mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0001\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0017\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");

  while (true) {
    try{
        superviseIO();
        
    if(PROGRAM_COUNT % 100 == 0){
        PLC_LD();

    }

        std::this_thread::sleep_for(std::chrono::milliseconds(1));
        PROGRAM_COUNT++;
        if(PROGRAM_COUNT >= std::numeric_limits<uint64_t>::max()){
            PROGRAM_COUNT = 0;
        }
    }
    catch(const std::exception& e){
        std::cout << "Caught exception: " << e.what() << std::endl;
    }
  }
  return 0;
}
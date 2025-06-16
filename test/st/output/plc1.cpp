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
static TP PLS1;
PLS1();
PLS1.IN = SW1;
PLS1.PT = 1000;
writeBit("%QX0.0", ( PLS1.Q ));
writeBit("%QX0.1", ( ( ! SW1 ) ));
writeBit("%QX0.2", ( ( ( PLS1.ET >= 500 ) ) ));
}


int main() {
  mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"16\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");
mapIO("{\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"17\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.1\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}");

  std::cout << "PLC1 is running!\n";
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
        std::cout << "Caught exception: " << e.what() << "\n";
    }
  }
  return 0;
}
#include "imperium.h"
#include "modbus_support.h"

class Timer {
public:
  bool Start;
  bool Done;
  int16_t Counter;

  void operator()() {
    Counter = Counter + 1;
  }
};

void PLC_PROG() {
  Timer T1;
  uint64_t IN = readAddress("%I0001.0");
  if ((T1.Start = true) && !T1.Done) {
    writeAddress("%Q0001.0", 1);
  } else if ((T1.Done = true)) {
    T1.Start = false;
    writeAddress("%Q0001.0", 0);
  }
}

int main() {
  while (true) {
    gatherInputs();
    PLC_PROG();
    handleOutputs();
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
  return 0;
}

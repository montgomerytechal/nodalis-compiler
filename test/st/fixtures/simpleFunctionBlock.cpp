class Timer {//FUNCTION_BLOCK:Timer
public:
  bool Start;
  bool Done;
  int16_t Counter;
  void operator()() {
    Counter = Counter + 1;
  }
};

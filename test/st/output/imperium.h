#pragma once
#include <cstdint>
#include <string>
#include <chrono>
#include <type_traits> // for std::is_same
extern uint64_t PROGRAM_COUNT;
extern std::chrono::steady_clock::time_point PROGRAM_START;

uint64_t elapsed();

class TP{
    public:
        bool Q;
        bool IN;
        uint64_t PT;
        uint64_t ET;
    

    void operator()(){
        Q = false;
        if(!lastIN && IN){
            lastIN = IN;
            ET = 0;
            startTime = 0;
        }
        if(IN){
            Q = true;
        }
        else if(lastIN && !IN){
            if(startTime == 0){
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            if(PT <= ET){
                Q = true;
            }
        }
    }
    private:
        bool lastIN = false;
        uint64_t startTime = 0;
};


void gatherInputs();
void handleOutputs();
uint32_t readDWord(std::string address);
uint16_t readWord(std::string address);
uint8_t readByte(std::string address);
bool readBit(std::string address);
void writeDWord(std::string address, uint32_t value);
void writeWord(std::string address, uint16_t value);
void writeByte(std::string address, uint8_t value);
void writeBit(std::string address, bool value);
bool getBit(void* var, int bit);
void setBit(void* var, int bit, bool value);

template<typename T>
class RefVar {
private:
    std::string address;
    T cache;

public:
    RefVar(const std::string& addr) : address(addr) {
        cache = read();
    }

    RefVar<T>& operator=(T value) {
        cache = value;
        write(value);
        return *this;
    }

    operator T() const {
        return read();
    }

    T* operator&(){
        return &cache;
    }

private:
    T read() const {
        if constexpr (std::is_same_v<T, bool>) {
            return readBit(address);
        } else if constexpr (std::is_same_v<T, uint8_t>) {
            return readByte(address);
        } else if constexpr (std::is_same_v<T, uint16_t>) {
            return readWord(address);
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            return readDWord(address);
        } else {
            static_assert(!std::is_same_v<T, T>, "Unsupported type for RefVar");
        }
    }

    void write(T value) const {
        if constexpr (std::is_same_v<T, bool>) {
            writeBit(address, value);
        } else if constexpr (std::is_same_v<T, uint8_t>) {
            writeByte(address, value);
        } else if constexpr (std::is_same_v<T, uint16_t>) {
            writeWord(address, value);
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            writeDWord(address, value);
        } else {
            static_assert(!std::is_same_v<T, T>, "Unsupported type for RefVar");
        }
    }
};
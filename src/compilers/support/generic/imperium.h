#pragma once
#include <cstdint>
#include <string>
#include <chrono>
#include <type_traits> // for std::is_same
extern uint64_t PROGRAM_COUNT;
extern std::chrono::steady_clock::time_point PROGRAM_START;

/**
 * Defines the total memory block for this PLC. This memory is a grid of 64x16 "sheets" or pages of memory.
 * The first column is the row of 64, the second column is 16 registers for that sheet.
 * Addresses are reserved based on MTI's standard registers, AI (physical inputs), AO (physical outputs),
 * SW (switch inputs from HMIs), LD (LED outputs to HMIs), BI, BO, CI, BO (all free memory locations for logical operations)
 * PROTECT, BREACH, TROUBLE, STAT1, STAT2, MISC1, MISC2, MISC3.
 * Standard IEC address references break down in the following ways:
 * %I - corresponds to the AI register MEMORY[x][0]. If requesting %IX0, the sheet row would be calculated by r = floor((0*8)/64) - which would yield 0.
 *  To reference each individual byte, we would get uint8_t* bytes = &MEMORY[r][0]; We then can reference the byte within this row by getting b = 0 % 8;
 *  We can then get the value of that byte by referencing bytes[b];
 * %Q - Same as %I, except uint8_t* bytes = &MEMORY[r][1];
 * %M - Virtual memory used for program interface. This takes up the other 14 columns in a row. A reference to %MX[a], where a is a numerical byte address would be used to calculate
 *  r = floor((a*14*8)/64). If a is 0, this would yield row 0. If 14, it 
 */
extern uint64_t[][] MEMORY;

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
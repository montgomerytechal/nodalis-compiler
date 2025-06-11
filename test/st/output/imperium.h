// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @description Imperium PLC Header
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */
#pragma once
#include <cstdint>
#include <string>
#include <cctype>
#include <chrono>
#include <type_traits> // for std::is_same
#include <math.h>
#include <vector>
#include <regex>
#include <stdexcept>
#include "json.hpp"
using json = nlohmann::json;

#pragma region "Program Timing"
extern uint64_t PROGRAM_COUNT;
extern std::chrono::steady_clock::time_point PROGRAM_START;
uint64_t elapsed();
#pragma endregion
#pragma region "Memory Handling"

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
 *  r = floor((a*8)/(64*14)). If a is 0, this would yield row 0. If a is 112, it would yield 1. The column would be c = floor(a/(8*14)) + 2, so 0 would yield 2 and 112 would also yield 2.
 *  The byte would be obtained by b = a % 8, so 0 would yield 0, and 112 would yield 0.
 */
extern uint64_t MEMORY[64][16];

inline std::string toLowerCase(const std::string& input) {
    std::string result = input;
    for (size_t i = 0; i < result.size(); ++i) {
        result[i] = std::tolower(result[i]);
    }
    return result;
}

/**
 * Defines the memory space designations for use in getting memory addresses.
 */
enum MEMORY_SPACE : int {
    I, //input memory space
    Q, //output memory space
    M, //Virtual memory space
};

inline std::vector<int> parseAddress(const std::string& address) {
    std::regex pattern(R"(%([IQM])([XBWDL])(\d+)(?:\.(\d+))?)", std::regex::icase);
    std::smatch match;

    if (std::regex_match(address, match, pattern)) {
        std::string space = match[1].str();   // I, Q, M
        std::string type = match[2].str();    // X, W, D, etc.
        std::string index = match[3].str();   // 0, 1, ...
        std::string bit = match[4].matched ? match[4].str() : ""; // bit if present

        
        int ispace = -1;
        int addr = -1;
        int ibit = -1;
        int width = -1;
        if(toLowerCase(space) == "m"){
            ispace = MEMORY_SPACE::M;
        }
        else if(toLowerCase(space) == "q"){
            ispace = MEMORY_SPACE::Q;
        }
        else if(toLowerCase(space) == "i"){
            ispace = MEMORY_SPACE::I;
        }

        if(toLowerCase(type) == "x"){
            width = 8;
        }
        else if(toLowerCase(type) == "w"){
            width = 16;
        }
        else if(toLowerCase(type) == "d"){
            width = 32;
        }

        

        addr = std::stoi(index);
        return {ispace, width, addr, ibit};
    }

    throw std::invalid_argument("Invalid address format: " + address);
}

/**
 * Gets a byte pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address
 * @param addr The byte index to pull from.
 * @returns Returns a byte pointer to the memory address, or 0 if there is no memory at the given address.
 */
inline uint8_t* getMemoryByte(int space, int addr){
    uint8_t* ret = 0;
    int r = -1, c = 0, b = 0;
    switch(space){
        case MEMORY_SPACE::Q:
            r = floor((addr*8)/64);
            c = 1;
            b = addr % 8;
        break;
        case MEMORY_SPACE::I:
            r = floor((addr*8)/64);
            c = 0;
            b = addr % 8;
        break;
        case MEMORY_SPACE::M:
            r = floor((addr*8)/(64*14));
            c = floor(addr/112) + 2;
            b = addr % 8;
        break;
    }
    if(r >= 0){
        ret = (uint8_t*)(MEMORY[r][c]) + b;
    }
    return ret;
}
/**
 * Gets a word pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address.
 * @param addr The word index to pull from.
 * @returns Returns a word pointer to a memory address, or 0 if there is no memory at the given address.
 */
inline uint16_t* getMemoryWord(int space, int addr){
    return (uint16_t*)getMemoryByte(space, addr * 2);
}
/**
 * Gets a double word pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address
 * @param addr The double word index to pull from.
 * @return Returns a double word pointer to a memory address, or 0 if there is no memory at the given address.
 */
inline uint32_t* getMemoryDWord(int space, int addr){
    return (uint32_t*) getMemoryByte(space, addr*4);
}

/**
 * Reads the 32 bit value at a given address.
 * @param address The address of the memory to get the 32 bit value from.
 * @returns Returns a 32 bit value
 */
 uint32_t readDWord(std::string address);
/**
 * Reads the 16 bit value at a given address.
 * @param address The address of the memory to get the 16 bit value from.
 * @returns Returns a 16 bit value
 */
 uint16_t readWord(std::string address);
/**
 * Reads the 8 bit value at a given address.
 * @param address The address of the memory to get the 8 bit value from.
 * @returns Returns a 8 bit value
 */
uint8_t readByte(std::string address);
/**
 * Reads the bit value at a given address.
 * @param address The address of the memory to get the bit value from.
 * @returns Returns a boolean value indicating the status of the bit.
 */
bool readBit(std::string address);
/**
 * Writes a 32 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 32 bit value to write to memory.
 */
void writeDWord(std::string address, uint32_t value);
/**
 * Writes a 16 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 16 bit value to write to memory.
 */
void writeWord(std::string address, uint16_t value);
/**
 * Writes a 8 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 8 bit value to write to memory.
 */
void writeByte(std::string address, uint8_t value);
/**
 * Writes a bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The bit value to write to memory.
 */
void writeBit(std::string address, bool value);
/**
 * Gets the bit value from a variable
 * @param var A pointer to the variable from which to get the bit.
 * @param bit The number of the bit to get
 * @returns Returns the state of the bit.
 */
bool getBit(void* var, int bit);
/**
 * Sets the bit in a variable.
 * @param var A pointer to the variable to which to set the bit.
 * @param bit The bit to set.
 * @param value The state to set the bit to.
 */
void setBit(void* var, int bit, bool value);
#pragma endregion

/**
 * The RefVar class provides a means of declaring a variable with a reference to memory, similar to a pointer.
 */
template<typename T>
class RefVar {
private:
/**
 * The address of the memory.
 */
    std::string address;
    /**
     * The cached value of the address
     */
    T cache;

public:
    /**
     * Constructs a new RefVar object based on a given address
     * @param addr The address to reference.
     */
    RefVar(const std::string& addr) : address(addr) {
        cache = read();
    }
    /**
     * Provides an assignment operator for RefVar so that it acts just like a primitive variable.
     * @param value The value to assign.
     */
    RefVar<T>& operator=(T value) {
        cache = value;
        write(value);
        return *this;
    }

    /**
     * Provides a reference operator to provide a reference to this RefVar.
     */
    RefVar<T>& operator&(){
        return *this;
    }

    /**
     * Provides an expression operator so that a RefVar object can be used in a statement like any other variable and return its memory value.
     */
    operator T() const {
        return read();
    }

private:
    /**
     * Reads the value of the reference from memory.
     */
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
    /**
     * Writes the value to the memory referenced.
     * @param value The value to assign to the memory.
     */
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
/**
 * Gets a bit from a RefVar object.
 * @param var a reference to the RefVar object
 * @param bit The bit to read.
 * @returns Returns the state of the bit.
 */
template<typename T>
bool getBit(RefVar<T>& var, int bit){
    T ref = var;
    return getBit(&ref, bit);
}
/**
 * Sets a bit in a RefVar object
 * @param var A reference to the RefVar object.
 * @param bit The bit to set.
 * @param value The state to set the bit to.
 */
template<typename T>
void setBit(RefVar<T>& var, int bit, bool value){
    T ref = var;
    setBit(&ref, bit, value);
    var = ref;
}

/**
 * Gathers the inputs for the PLC.
 */
void gatherInputs();
/**
 * Assigns the outputs for the PLC.
 */
void handleOutputs();

#pragma region "Standard Function Blocks"

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

#pragma endregion
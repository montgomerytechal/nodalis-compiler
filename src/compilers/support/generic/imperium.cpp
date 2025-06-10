#include "imperium.h"
#include <iostream>
#include <map>

uint64_t PROGRAM_COUNT = 0;
uint64_t[][] MEMORY = new uint64_t[64][16];

std::chrono::steady_clock::time_point PROGRAM_START = std::chrono::steady_clock::now();
uint64_t elapsed() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - PROGRAM_START
    ).count();
}

void gatherInputs(){

}

void handleOutputs(){

}

uint32_t readDWord(std::string address){

}
uint16_t readWord(std::string address){

}
uint8_t readByte(std::string address){

}
bool readBit(std::string address){

}
void writeDWord(std::string address, uint32_t value){

}
void writeWord(std::string address, uint16_t value){

}
void writeByte(std::string address, uint8_t value){

}
void writeBit(std::string address, bool value){

}
bool getBit(void* var, int bit) {
    // Advance to the byte containing the bit
    uint8_t* bytePtr = static_cast<uint8_t*>(var) + (bit / 8);

    // Mask out the bit within the byte
    uint8_t mask = 1 << (bit % 8);

    // Return true if the bit is set
    return (*bytePtr & mask) != 0;
}

void setBit(void* var, int bit, bool value) {
    uint8_t* bytePtr = static_cast<uint8_t*>(var) + (bit / 8);
    uint8_t mask = 1 << (bit % 8);

    if (value) {
        *bytePtr |= mask;  // Set the bit
    } else {
        *bytePtr &= ~mask; // Clear the bit
    }
}
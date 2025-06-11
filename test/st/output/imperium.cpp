#include "imperium.h"
#include <iostream>
#include <map>


uint64_t PROGRAM_COUNT = 0;
uint64_t MEMORY[64][16] = { 0 };

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
   std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(width != 32){
    throw std::invalid_argument("Invalid address type: " + address);
   }
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   return *getMemoryDWord(space, index);
}
uint16_t readWord(std::string address){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(width != 16){
    throw std::invalid_argument("Invalid address type: " + address);
   }
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   return *getMemoryWord(space, index);
}
uint8_t readByte(std::string address){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(width != 8){
    throw std::invalid_argument("Invalid address type: " + address);
   }
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   return *getMemoryByte(space, index);
}
bool readBit(std::string address){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   uint32_t val = 0;
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit == -1)
   {
    throw std::invalid_argument("Invalid address bit: " + address);
   }
   if(width == -1){
    throw std::invalid_argument("Invalid address size: " + address);
   }
   bool ret = false;
   switch(width){
    case 8:
        ret = getBit(getMemoryByte(space, index), bit);
        break;
    case 16:
        ret = getBit(getMemoryWord(space, index), bit);
        break;
    case 32:
        ret = getBit(getMemoryDWord(space, index), bit);
        break;
   }
   return ret;
}
void writeDWord(std::string address, uint32_t value){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(width != 32){
    throw std::invalid_argument("Invalid address type: " + address);
   }
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   uint32_t* temp = getMemoryDWord(space, index);
   *temp = value;
}
void writeWord(std::string address, uint16_t value){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(width != 16){
    throw std::invalid_argument("Invalid address type: " + address);
   }
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   uint16_t* temp = getMemoryWord(space, index);
   *temp = value;
}
void writeByte(std::string address, uint8_t value){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(width != 8){
    throw std::invalid_argument("Invalid address type: " + address);
   }
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   uint8_t* temp = getMemoryByte(space, index);
   *temp = value;
}
void writeBit(std::string address, bool value){
    std::vector<int> parts = parseAddress(address);
   int space = parts[0], width = parts[1], index = parts[2], bit = parts[3];
   
   if(space == -1){
    throw std::invalid_argument("Invalid address space: " + address);
   }
   if(index == -1){
    throw std::invalid_argument("Invalid address index: " + address);
   }
   if(bit > -1){
    throw std::invalid_argument("Invalid address format. Reference specifies a bit: " + address);
   }
   if(bit == -1)
   {
    throw std::invalid_argument("Invalid address bit: " + address);
   }
   if(width == -1){
    throw std::invalid_argument("Invalid address size: " + address);
   }
   switch(width){
    case 8:
        setBit(getMemoryByte(space, index), bit, value);
        break;
    case 16:
        setBit(getMemoryWord(space, index), bit, value);
        break;
    case 32:
        setBit(getMemoryDWord(space, index), bit, value);
        break;
   }
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

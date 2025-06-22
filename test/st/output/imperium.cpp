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
 * @description Imperium PLC Code
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */
#include "imperium.h"
#include <iostream>
#include <map>
#include "modbus.h"
#include "opcua.h"

uint64_t PROGRAM_COUNT = 0;
uint64_t MEMORY[64][16] = { 0 };

std::chrono::steady_clock::time_point PROGRAM_START = std::chrono::steady_clock::now();
uint64_t elapsed() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - PROGRAM_START
    ).count();
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

std::vector<std::unique_ptr<IOClient>> Clients;

IOMap::IOMap(std::string mapJson){
    json j = json::parse(mapJson);
    moduleID = j["ModuleID"];
    modulePort = j["ModulePort"];
    localAddress = j["InternalAddress"];
    remoteAddress = j["RemoteAddress"];
    width = std::atoi(j["RemoteSize"].get<std::string>().c_str());
    interval = std::atoi(j["PollTime"].get<std::string>().c_str());
    protocol = j["Protocol"];
    additionalProperties = j["AdditionalProperties"];
    if(localAddress.find("%Q") != std::string::npos){
        direction = IOType::Output;
    }
    else{
        direction = IOType::Input;
    }
    lastPoll = elapsed();
}

IOMap::IOMap(){

}

IOClient::IOClient(const std::string& protocol) : protocol(protocol) {
    connected = false;
}

void IOClient::addMapping(const IOMap& map) {
    if(!hasMapping(map.localAddress)){
        if(mappings.size() == 0){
            moduleID = map.moduleID;
        }
        std::cout << "Adding map for " << map.moduleID.c_str() << ":" << map.modulePort.c_str() << "->" << map.localAddress.c_str() << "\n";
        mappings.push_back(map);
    }
}

bool IOClient::hasMapping(std::string localAddress){
    for (const auto& map : mappings) {
        if(map.localAddress == localAddress){
            return true;
        }
    }
    return false;
}

const std::string& IOClient::getProtocol() const {
    return protocol;
}

const std::string& IOClient::getModuleID() const {
    return moduleID;
}

void IOClient::poll() {
    if(connected){
        for (auto& map : mappings) {
            try {
                if(elapsed() - map.lastPoll > map.interval){
                    map.lastPoll = elapsed();
                    if (map.direction == IOType::Output) {
                        switch (map.width) {
                            case 1: {
                                int bit = ::readBit(map.localAddress);
                                writeBit(map.remoteAddress, bit);
                                break;
                            }
                            case 8: {
                                uint8_t val = ::readByte(map.localAddress);
                                writeByte(map.remoteAddress, val);
                                break;
                            }
                            case 16: {
                                uint16_t val = ::readWord(map.localAddress);
                                writeWord(map.remoteAddress, val);
                                break;
                            }
                            case 32: {
                                uint32_t val = ::readDWord(map.localAddress);
                                writeDWord(map.remoteAddress, val);
                                break;
                            }
                        }
                    }
                    else if (map.direction == IOType::Input) {

                        switch (map.width) {
                            case 1: {
                                int bit = 0;
                                if (readBit(map.remoteAddress, bit)) {
                                    ::writeBit(map.localAddress, bit > 0);
                                }
                                break;
                            }
                            case 8: {
                                uint8_t val = 0;
                                if (readByte(map.remoteAddress, val)) {
                                    ::writeByte(map.localAddress, val);
                                }
                                break;
                            }
                            case 16: {
                                uint16_t val = 0;
                                if (readWord(map.remoteAddress, val)) {
                                    ::writeWord(map.localAddress, val);
                                }
                                break;
                            }
                            case 32: {
                                uint32_t val = 0;
                                if (readDWord(map.remoteAddress, val)) {
                                    ::writeDWord(map.localAddress, val);
                                }
                                break;
                            }
                        }
                    } 
                }
            }
            catch (const std::exception& e) {
            // handle error or log it
            }
        } 
        
    }
    else if(elapsed() - lastAttempt >= 15000){
        lastAttempt = elapsed();
        connect();
    }
}



IOClient* findClient(IOMap map){
    for(int x = 0; x < Clients.size(); x++){
        if(Clients[x]->hasMapping(map.localAddress)){
            return Clients[x].get();
        }
        else if(Clients[x]->getModuleID() == map.moduleID){
            Clients[x]->addMapping(map);
            return Clients[x].get();
        }
        
    }
    return nullptr;
}
std::unique_ptr<IOClient> createClient(IOMap& map){
   
    if(map.protocol == "MODBUS-TCP"){
        auto ret = std::make_unique<ModbusClient>();
        ret->addMapping(map);
        return ret;
    }
    else if(map.protocol == "OPCUA"){
        auto ret = std::make_unique<OPCUAClient>();
        ret->addMapping(map);
        return ret;
    }
    return nullptr;
}

void mapIO(std::string map){
    try{
        IOMap newMap(map);
        IOClient* existing = findClient(newMap);
        if(existing == nullptr){
            auto client = createClient(newMap);
            if(client) Clients.push_back(std::move(client));
        }
    }
    catch(const std::exception& e){
        std::cout << "Caught exception: " << e.what() << "\n";
    }
    

}

void superviseIO(){
    try{
        for(int x = 0; x < Clients.size(); x++){
            Clients[x]->poll();
        }
    }
    catch(const std::exception& e){
        std::cout << "Caught exception: " << e.what() << "\n";
    }
}

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
 * @description Imperium PLC Modbus
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */
#ifndef MODBUS_H
#define MODBUS_H

#include <cstdint>
#include <vector>
#include <map>
#include <string>

#ifdef _WIN32
    #include <winsock2.h>
    typedef int socklen_t;
#else
    #include <sys/socket.h>
    #include <arpa/inet.h>
    #include <unistd.h>
#endif

// MODBUS function codes
enum ModbusFunctionCode {
    READ_COILS = 0x01,
    READ_DISCRETE_INPUTS = 0x02,
    READ_HOLDING_REGISTERS = 0x03,
    READ_INPUT_REGISTERS = 0x04,
    WRITE_SINGLE_COIL = 0x05,
    WRITE_SINGLE_REGISTER = 0x06,
    WRITE_MULTIPLE_COILS = 0x0F,
    WRITE_MULTIPLE_REGISTERS = 0x10
};

struct ModbusRequest {
    uint8_t address;
    uint8_t function;
    uint16_t startAddress;
    uint16_t quantity;
    std::vector<uint8_t> data;
};

struct ModbusResponse {
    uint8_t address;
    uint8_t function;
    std::vector<uint8_t> data;
    uint8_t exceptionCode;
};

// Server implementation
class ModbusServer {
public:
    ModbusServer();

    void setCoil(uint16_t address, bool value);
    bool getCoil(uint16_t address);

    void setDiscreteInput(uint16_t address, bool value);
    bool getDiscreteInput(uint16_t address);

    void setRegister(uint16_t address, uint16_t value);
    uint16_t getRegister(uint16_t address);

    ModbusResponse handleRequest(const ModbusRequest& request);

private:
    std::map<uint16_t, bool> coils;
    std::map<uint16_t, bool> discreteInputs;
    std::map<uint16_t, uint16_t> holdingRegisters;
};

// Client implementation
class ModbusClient {
public:
    ModbusClient(uint8_t deviceAddress);
    ~ModbusClient();

    bool connectTCP(const std::string& ip, uint16_t port);
    void disconnect();

    ModbusRequest createReadRequest(uint8_t function, uint16_t startAddress, uint16_t quantity);
    ModbusRequest createWriteSingleCoil(uint16_t address, bool value);
    ModbusRequest createWriteSingleRegister(uint16_t address, uint16_t value);

    bool sendRequest(const ModbusRequest& request, ModbusResponse& response);

private:
    int sockfd;
    uint8_t deviceAddress;
    bool connected;

    bool sendRaw(const std::vector<uint8_t>& requestPDU, std::vector<uint8_t>& responsePDU);
};

#endif // MODBUS_H
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
#include "modbus.h"
#include <cstring>
#include <iostream>

#ifdef _WIN32
    #pragma comment(lib, "ws2_32.lib")
#endif

// ========== Server Implementation ==========

ModbusServer::ModbusServer() {}

void ModbusServer::setCoil(uint16_t address, bool value) {
    coils[address] = value;
}

bool ModbusServer::getCoil(uint16_t address) {
    return coils[address];
}

void ModbusServer::setDiscreteInput(uint16_t address, bool value) {
    discreteInputs[address] = value;
}

bool ModbusServer::getDiscreteInput(uint16_t address) {
    return discreteInputs[address];
}

void ModbusServer::setRegister(uint16_t address, uint16_t value) {
    holdingRegisters[address] = value;
}

uint16_t ModbusServer::getRegister(uint16_t address) {
    return holdingRegisters[address];
}

ModbusResponse ModbusServer::handleRequest(const ModbusRequest& request) {
    ModbusResponse res;
    res.address = request.address;
    res.function = request.function;
    res.exceptionCode = 0;

    switch (request.function) {
        case READ_COILS:
        case READ_DISCRETE_INPUTS: {
            for (uint16_t i = 0; i < request.quantity; ++i) {
                bool bit = (request.function == READ_COILS)
                    ? getCoil(request.startAddress + i)
                    : getDiscreteInput(request.startAddress + i);
                if (i % 8 == 0)
                    res.data.push_back(0);
                if (bit)
                    res.data[i / 8] |= (1 << (i % 8));
            }
            break;
        }

        case READ_HOLDING_REGISTERS:
        case READ_INPUT_REGISTERS: {
            for (uint16_t i = 0; i < request.quantity; ++i) {
                uint16_t val = getRegister(request.startAddress + i);
                res.data.push_back(val >> 8);
                res.data.push_back(val & 0xFF);
            }
            break;
        }

        case WRITE_SINGLE_COIL: {
            if (request.data.size() < 2) { res.exceptionCode = 0x03; break; }
            bool value = (request.data[0] == 0xFF);
            setCoil(request.startAddress, value);
            res.data = request.data;
            break;
        }

        case WRITE_SINGLE_REGISTER: {
            if (request.data.size() < 2) { res.exceptionCode = 0x03; break; }
            uint16_t value = (request.data[0] << 8) | request.data[1];
            setRegister(request.startAddress, value);
            res.data = request.data;
            break;
        }

        default:
            res.exceptionCode = 0x01;
            break;
    }

    return res;
}

// ========== Client Implementation ==========

ModbusClient::ModbusClient(uint8_t deviceAddress)
    : deviceAddress(deviceAddress), connected(false), sockfd(-1) {
#ifdef _WIN32
    WSADATA wsa;
    WSAStartup(MAKEWORD(2,2), &wsa);
#endif
}

ModbusClient::~ModbusClient() {
    disconnect();
}

bool ModbusClient::connectTCP(const std::string& ip, uint16_t port) {
    sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) return false;

    sockaddr_in serverAddr;
    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(port);
    inet_pton(AF_INET, ip.c_str(), &serverAddr.sin_addr);

    if (connect(sockfd, (sockaddr*)&serverAddr, sizeof(serverAddr)) < 0) {
        disconnect();
        return false;
    }

    connected = true;
    return true;
}

void ModbusClient::disconnect() {
    if (connected) {
#ifdef _WIN32
        closesocket(sockfd);
#else
        close(sockfd);
#endif
        connected = false;
    }
}

ModbusRequest ModbusClient::createReadRequest(uint8_t function, uint16_t startAddress, uint16_t quantity) {
    return { deviceAddress, function, startAddress, quantity, {} };
}

ModbusRequest ModbusClient::createWriteSingleCoil(uint16_t address, bool value) {
    std::vector<uint8_t> data = value ? std::vector<uint8_t>{0xFF, 0x00} : std::vector<uint8_t>{0x00, 0x00};
    return { deviceAddress, WRITE_SINGLE_COIL, address, 1, data };
}

ModbusRequest ModbusClient::createWriteSingleRegister(uint16_t address, uint16_t value) {
    std::vector<uint8_t> data = { static_cast<uint8_t>(value >> 8), static_cast<uint8_t>(value & 0xFF) };
    return { deviceAddress, WRITE_SINGLE_REGISTER, address, 1, data };
}

bool ModbusClient::sendRequest(const ModbusRequest& req, ModbusResponse& resp) {
    std::vector<uint8_t> pdu = {
        req.function,
        static_cast<uint8_t>(req.startAddress >> 8),
        static_cast<uint8_t>(req.startAddress & 0xFF),
        static_cast<uint8_t>(req.quantity >> 8),
        static_cast<uint8_t>(req.quantity & 0xFF)
    };
    pdu.insert(pdu.end(), req.data.begin(), req.data.end());

    std::vector<uint8_t> response;
    if (!sendRaw(pdu, response)) return false;

    if (response.size() < 2) return false;
    resp.address = req.address;
    resp.function = response[0];
    resp.data.assign(response.begin() + 1, response.end());
    resp.exceptionCode = (resp.function & 0x80) ? resp.data[0] : 0;

    return true;
}

bool ModbusClient::sendRaw(const std::vector<uint8_t>& pdu, std::vector<uint8_t>& response) {
    if (!connected) return false;

    // MBAP header (7 bytes): Transaction ID, Protocol ID, Length, Unit ID
    uint8_t mbap[7] = {0x00, 0x01, 0x00, 0x00,
                       static_cast<uint8_t>((pdu.size() + 1) >> 8),
                       static_cast<uint8_t>((pdu.size() + 1) & 0xFF),
                       deviceAddress};

    std::vector<uint8_t> packet(mbap, mbap + 7);
    packet.insert(packet.end(), pdu.begin(), pdu.end());

    if (send(sockfd, reinterpret_cast<const char*>(packet.data()), packet.size(), 0) < 0)
        return false;

    uint8_t buf[260] = {0};
    int len = recv(sockfd, reinterpret_cast<char*>(buf), sizeof(buf), 0);
    if (len < 9) return false;

    response.assign(buf + 7, buf + len);
    return true;
}

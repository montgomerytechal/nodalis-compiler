// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

#pragma once
#ifndef NODALIS_MODBUS_H
#define NODALIS_MODBUS_H

#include <ArduinoModbus.h>
#include <Ethernet.h>

#include <cstdint>
#include <map>
#include <string>
#include <unordered_map>
#include <vector>

#include "nodalis.h"

enum ModbusFunctionCode
{
    READ_COILS = 0x01,
    READ_DISCRETE_INPUTS = 0x02,
    READ_HOLDING_REGISTERS = 0x03,
    READ_INPUT_REGISTERS = 0x04,
    WRITE_SINGLE_COIL = 0x05,
    WRITE_SINGLE_REGISTER = 0x06,
    WRITE_MULTIPLE_COILS = 0x0F,
    WRITE_MULTIPLE_REGISTERS = 0x10
};

struct ModbusRequest
{
    uint8_t address;
    uint8_t function;
    uint16_t startAddress;
    uint16_t quantity;
    std::vector<uint8_t> data;
};

struct ModbusResponse
{
    uint8_t address;
    uint8_t function;
    std::vector<uint8_t> data;
    uint8_t exceptionCode;
};

class NodalisModbusServer
{
public:
    NodalisModbusServer();

    void setCoil(uint16_t address, bool value);
    bool getCoil(uint16_t address);

    void setDiscreteInput(uint16_t address, bool value);
    bool getDiscreteInput(uint16_t address);

    void setRegister(uint16_t address, uint16_t value);
    uint16_t getRegister(uint16_t address);

    ModbusResponse handleRequest(const ModbusRequest &request);

private:
    std::map<uint16_t, bool> coils;
    std::map<uint16_t, bool> discreteInputs;
    std::map<uint16_t, uint16_t> holdingRegisters;
};

class NodalisModbusClient : public IOClient
{
public:
    NodalisModbusClient(const std::string &ip = "", uint16_t port = 502, uint8_t unitId = 1);
    ~NodalisModbusClient() override;

    bool connectTCP(const std::string &ip, uint16_t port);
    void disconnect();

    ModbusRequest createReadRequest(uint8_t function, uint16_t startAddress, uint16_t quantity);
    ModbusRequest createWriteSingleCoil(uint16_t address, bool value);
    ModbusRequest createWriteSingleRegister(uint16_t address, uint16_t value);

    bool sendRequest(const ModbusRequest &request, ModbusResponse &response);

protected:
    std::string ip;
    uint16_t port;

    bool readBit(const std::string &remote, int &result) override;
    bool writeBit(const std::string &remote, int value) override;
    bool readByte(const std::string &remote, uint8_t &result) override;
    bool writeByte(const std::string &remote, uint8_t value) override;
    bool readWord(const std::string &remote, uint16_t &result) override;
    bool writeWord(const std::string &remote, uint16_t value) override;
    bool readDWord(const std::string &remote, uint32_t &result) override;
    bool writeDWord(const std::string &remote, uint32_t value) override;
    bool readLWord(const std::string &remote, uint64_t &result) override;
    bool writeLWord(const std::string &remote, uint64_t value) override;
    void connect() override;
    void onMappingAdded(const IOMap &map) override;

private:
    EthernetClient tcpClient;
    ModbusTCPClient modbusTcpClient;
    IPAddress serverIp;
    uint8_t deviceAddress;
    bool serverResolved;

    uint16_t parseRemoteAddress(const std::string &remote) const;
    uint8_t parseUnitId(const IOMap &map) const;
    bool ensureConnected();
    bool parseIp(const std::string &value, IPAddress &out) const;
};

class NodalisModbusTcpServer
{
public:
    explicit NodalisModbusTcpServer(uint16_t port = 502);

    bool start(uint8_t serverId = 0xFF);
    void mapVariable(const std::string &name, const std::string &address);
    void poll();

private:
    struct GlobalMap
    {
        std::string name;
        std::string address;
        int width = 16;
        bool isBit = false;
        int bit = -1;
        uint16_t coilAddress = 0;
        uint16_t registerAddress = 0;
        uint64_t shadowValue = 0;
        bool initialized = false;
    };

    bool writeServerValue(const GlobalMap &map, uint64_t value);
    bool readServerValue(const GlobalMap &map, uint64_t &value);
    uint64_t readMemoryValue(const GlobalMap &map) const;
    void writeMemoryValue(const GlobalMap &map, uint64_t value) const;

    uint16_t port;
    EthernetServer tcpServer;
    ModbusTCPServer modbusServer;
    std::vector<GlobalMap> globals;
    std::unordered_map<std::string, size_t> lookupByName;
    int maxCoil = -1;
    int maxHolding = -1;
    bool started = false;
};

#endif

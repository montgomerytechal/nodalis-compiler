#include "modbus.h"

#include <cstdio>
#include <cstdlib>

NodalisModbusServer::NodalisModbusServer() {}

void NodalisModbusServer::setCoil(uint16_t address, bool value) { coils[address] = value; }
bool NodalisModbusServer::getCoil(uint16_t address) { return coils[address]; }

void NodalisModbusServer::setDiscreteInput(uint16_t address, bool value) { discreteInputs[address] = value; }
bool NodalisModbusServer::getDiscreteInput(uint16_t address) { return discreteInputs[address]; }

void NodalisModbusServer::setRegister(uint16_t address, uint16_t value) { holdingRegisters[address] = value; }
uint16_t NodalisModbusServer::getRegister(uint16_t address) { return holdingRegisters[address]; }

ModbusResponse NodalisModbusServer::handleRequest(const ModbusRequest &request)
{
    ModbusResponse res;
    res.address = request.address;
    res.function = request.function;
    res.exceptionCode = 0;

    switch (request.function)
    {
    case READ_HOLDING_REGISTERS:
    case READ_INPUT_REGISTERS:
        for (uint16_t i = 0; i < request.quantity; ++i)
        {
            const uint16_t val = getRegister(static_cast<uint16_t>(request.startAddress + i));
            res.data.push_back(static_cast<uint8_t>(val >> 8));
            res.data.push_back(static_cast<uint8_t>(val & 0xFF));
        }
        break;
    case WRITE_SINGLE_REGISTER:
        if (request.data.size() >= 2)
        {
            const uint16_t value = static_cast<uint16_t>((request.data[0] << 8) | request.data[1]);
            setRegister(request.startAddress, value);
            res.data = request.data;
        }
        else
        {
            res.exceptionCode = 0x03;
        }
        break;
    default:
        res.exceptionCode = 0x01;
        break;
    }

    return res;
}

NodalisModbusClient::NodalisModbusClient(const std::string &ip, uint16_t port, uint8_t unitId)
    : IOClient("MODBUS-TCP"),
      ip(ip),
      port(port),
      modbusTcpClient(tcpClient),
      deviceAddress(unitId == 0 ? 1 : unitId),
      serverResolved(false)
{
    if (!ip.empty())
    {
        serverResolved = parseIp(ip, serverIp);
        if (!serverResolved)
        {
            logErrorThrottled("Invalid remote IP " + ip);
        }
    }
}

NodalisModbusClient::~NodalisModbusClient() { disconnect(); }

bool NodalisModbusClient::parseIp(const std::string &value, IPAddress &out) const
{
    unsigned int a = 0;
    unsigned int b = 0;
    unsigned int c = 0;
    unsigned int d = 0;
    if (std::sscanf(value.c_str(), "%u.%u.%u.%u", &a, &b, &c, &d) != 4)
    {
        return false;
    }
    if (a > 255 || b > 255 || c > 255 || d > 255)
    {
        return false;
    }
    out = IPAddress(a, b, c, d);
    return true;
}

uint8_t NodalisModbusClient::parseUnitId(const IOMap &map) const
{
    if (map.additionalProperties.contains("UnitID") && map.additionalProperties["UnitID"].is_number_integer())
    {
        return static_cast<uint8_t>(map.additionalProperties["UnitID"].get<int>());
    }
    if (map.additionalProperties.contains("UnitId") && map.additionalProperties["UnitId"].is_number_integer())
    {
        return static_cast<uint8_t>(map.additionalProperties["UnitId"].get<int>());
    }
    if (map.additionalProperties.contains("unitId") && map.additionalProperties["unitId"].is_number_integer())
    {
        return static_cast<uint8_t>(map.additionalProperties["unitId"].get<int>());
    }
    return deviceAddress;
}

void NodalisModbusClient::onMappingAdded(const IOMap &map)
{
    if (ip.empty() && !map.moduleID.empty())
    {
        ip = map.moduleID;
    }
    if (!map.modulePort.empty())
    {
        port = static_cast<uint16_t>(std::atoi(map.modulePort.c_str()));
    }
    deviceAddress = parseUnitId(map);

    if (!ip.empty())
    {
        serverResolved = parseIp(ip, serverIp);
    }
}

void NodalisModbusClient::connect()
{
    if (!ip.empty() && !serverResolved)
    {
        serverResolved = parseIp(ip, serverIp);
        if (!serverResolved)
        {
            logErrorThrottled("Could not parse target IP " + ip);
        }
    }
    connected = ensureConnected();
}

bool NodalisModbusClient::connectTCP(const std::string &newIp, uint16_t newPort)
{
    ip = newIp;
    port = newPort;
    serverResolved = parseIp(ip, serverIp);
    connected = ensureConnected();
    return connected;
}

bool NodalisModbusClient::ensureConnected()
{
    if (!serverResolved)
    {
        logErrorThrottled("Server IP is unresolved");
        return false;
    }
    if (modbusTcpClient.connected())
    {
        return true;
    }
    const uint16_t effectivePort = (port == 0) ? 502 : port;
    const bool started = modbusTcpClient.begin(serverIp, effectivePort) == 1;
    if (!started)
    {
        logErrorThrottled("TCP connect failed to " + ip + ":" + std::to_string(effectivePort));
    }
    return started;
}

void NodalisModbusClient::disconnect()
{
    modbusTcpClient.stop();
    connected = false;
}

ModbusRequest NodalisModbusClient::createReadRequest(uint8_t function, uint16_t startAddress, uint16_t quantity)
{
    return {deviceAddress, function, startAddress, quantity, {}};
}

ModbusRequest NodalisModbusClient::createWriteSingleCoil(uint16_t address, bool value)
{
    std::vector<uint8_t> data = value ? std::vector<uint8_t>{0xFF, 0x00} : std::vector<uint8_t>{0x00, 0x00};
    return {deviceAddress, WRITE_SINGLE_COIL, address, 0, data};
}

ModbusRequest NodalisModbusClient::createWriteSingleRegister(uint16_t address, uint16_t value)
{
    std::vector<uint8_t> data = {static_cast<uint8_t>(value >> 8), static_cast<uint8_t>(value & 0xFF)};
    return {deviceAddress, WRITE_SINGLE_REGISTER, address, 1, data};
}

bool NodalisModbusClient::sendRequest(const ModbusRequest &request, ModbusResponse &response)
{
    response.address = request.address;
    response.function = request.function;
    response.exceptionCode = 1;
    return false;
}

bool NodalisModbusClient::parseRemoteAddress(const std::string &remote, uint16_t &address) const
{
    char *endPtr = nullptr;
    const long parsed = std::strtol(remote.c_str(), &endPtr, 10);
    if (endPtr == remote.c_str() || *endPtr != '\0' || parsed < 0 || parsed > 65535)
    {
        return false;
    }
    address = static_cast<uint16_t>(parsed & 0xFFFF);
    return true;
}

bool NodalisModbusClient::readBit(const std::string &remote, int &result)
{
    if (!ensureConnected())
    {
        return false;
    }
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote bit address \"" + remote + "\"");
        return false;
    }
    const long val = modbusTcpClient.discreteInputRead(deviceAddress, addr);
    if (val < 0)
    {
        logErrorThrottled("Discrete input read failed remote=\"" + remote + "\" parsed=" + std::to_string(addr) +
                          " unit=" + std::to_string(deviceAddress) + ": " + modbusTcpClient.lastError());
        return false;
    }
    result = (val == 0) ? 0 : 1;
    return true;
}

bool NodalisModbusClient::writeBit(const std::string &remote, int value)
{
    if (!ensureConnected())
    {
        return false;
    }
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote bit address \"" + remote + "\"");
        return false;
    }
    const int rc = modbusTcpClient.coilWrite(deviceAddress, addr, value != 0);
    if (rc != 1)
    {
        logErrorThrottled("Coil write failed remote=\"" + remote + "\" parsed=" + std::to_string(addr) +
                          " unit=" + std::to_string(deviceAddress) + ": " + modbusTcpClient.lastError());
        return false;
    }
    return true;
}

bool NodalisModbusClient::readByte(const std::string &remote, uint8_t &result)
{
    uint16_t word = 0;
    if (!readWord(remote, word))
    {
        return false;
    }
    result = static_cast<uint8_t>(word & 0x00FF);
    return true;
}

bool NodalisModbusClient::writeByte(const std::string &remote, uint8_t value)
{
    return writeWord(remote, static_cast<uint16_t>(value));
}

bool NodalisModbusClient::readWord(const std::string &remote, uint16_t &result)
{
    if (!ensureConnected())
    {
        return false;
    }
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote register address \"" + remote + "\"");
        return false;
    }
    const long val = modbusTcpClient.holdingRegisterRead(deviceAddress, addr);
    if (val < 0)
    {
        logErrorThrottled("Holding register read failed remote=\"" + remote + "\" parsed=" + std::to_string(addr) +
                          " unit=" + std::to_string(deviceAddress) + ": " + modbusTcpClient.lastError());
        return false;
    }
    result = static_cast<uint16_t>(val & 0xFFFF);
    return true;
}

bool NodalisModbusClient::writeWord(const std::string &remote, uint16_t value)
{
    if (!ensureConnected())
    {
        return false;
    }
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote register address \"" + remote + "\"");
        return false;
    }
    const int rc = modbusTcpClient.holdingRegisterWrite(deviceAddress, addr, value);
    if (rc != 1)
    {
        logErrorThrottled("Holding register write failed remote=\"" + remote + "\" parsed=" + std::to_string(addr) +
                          " unit=" + std::to_string(deviceAddress) + ": " + modbusTcpClient.lastError());
        return false;
    }
    return true;
}

bool NodalisModbusClient::readDWord(const std::string &remote, uint32_t &result)
{
    uint16_t hi = 0;
    uint16_t lo = 0;
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote register address \"" + remote + "\"");
        return false;
    }

    if (!readWord(std::to_string(addr), hi))
    {
        return false;
    }
    if (!readWord(std::to_string(static_cast<uint16_t>(addr + 1)), lo))
    {
        return false;
    }

    result = (static_cast<uint32_t>(hi) << 16) | static_cast<uint32_t>(lo);
    return true;
}

bool NodalisModbusClient::writeDWord(const std::string &remote, uint32_t value)
{
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote register address \"" + remote + "\"");
        return false;
    }
    const uint16_t hi = static_cast<uint16_t>((value >> 16) & 0xFFFF);
    const uint16_t lo = static_cast<uint16_t>(value & 0xFFFF);

    if (!writeWord(std::to_string(addr), hi))
    {
        return false;
    }
    return writeWord(std::to_string(static_cast<uint16_t>(addr + 1)), lo);
}

bool NodalisModbusClient::readLWord(const std::string &remote, uint64_t &result)
{
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote register address \"" + remote + "\"");
        return false;
    }
    uint16_t regs[4] = {0, 0, 0, 0};

    for (uint16_t i = 0; i < 4; ++i)
    {
        if (!readWord(std::to_string(static_cast<uint16_t>(addr + i)), regs[i]))
        {
            return false;
        }
    }

    result = (static_cast<uint64_t>(regs[0]) << 48) |
             (static_cast<uint64_t>(regs[1]) << 32) |
             (static_cast<uint64_t>(regs[2]) << 16) |
             static_cast<uint64_t>(regs[3]);
    return true;
}

bool NodalisModbusClient::writeLWord(const std::string &remote, uint64_t value)
{
    uint16_t addr = 0;
    if (!parseRemoteAddress(remote, addr))
    {
        logErrorThrottled("Invalid remote register address \"" + remote + "\"");
        return false;
    }
    const uint16_t regs[4] = {
        static_cast<uint16_t>((value >> 48) & 0xFFFF),
        static_cast<uint16_t>((value >> 32) & 0xFFFF),
        static_cast<uint16_t>((value >> 16) & 0xFFFF),
        static_cast<uint16_t>(value & 0xFFFF)};

    for (uint16_t i = 0; i < 4; ++i)
    {
        if (!writeWord(std::to_string(static_cast<uint16_t>(addr + i)), regs[i]))
        {
            return false;
        }
    }
    return true;
}

NodalisModbusTcpServer::NodalisModbusTcpServer(uint16_t port)
    : port(port), tcpServer(port), modbusServer()
{
}

void NodalisModbusTcpServer::mapVariable(const std::string &name, const std::string &address)
{
    const std::vector<int> parts = parseAddress(address);
    if (parts.size() != 4 || parts[0] < 0 || parts[2] < 0)
    {
        return;
    }

    GlobalMap map;
    map.name = name;
    map.address = address;
    map.width = parts[1];
    map.bit = parts[3];
    map.isBit = parts[3] >= 0;

    if (map.isBit)
    {
        map.coilAddress = static_cast<uint16_t>((parts[2] * map.width) + map.bit);
        if (static_cast<int>(map.coilAddress) > maxCoil)
        {
            maxCoil = map.coilAddress;
        }
    }
    else
    {
        switch (map.width)
        {
        case 8:
        case 16:
            map.registerAddress = static_cast<uint16_t>(parts[2]);
            break;
        case 32:
            map.registerAddress = static_cast<uint16_t>(parts[2] * 2);
            break;
        case 64:
            map.registerAddress = static_cast<uint16_t>(parts[2] * 4);
            break;
        default:
            map.registerAddress = static_cast<uint16_t>(parts[2]);
            break;
        }

        int lastRegister = map.registerAddress;
        if (map.width == 32)
            lastRegister += 1;
        if (map.width == 64)
            lastRegister += 3;
        if (lastRegister > maxHolding)
        {
            maxHolding = lastRegister;
        }
    }

    lookupByName[name] = globals.size();
    globals.push_back(map);
}

bool NodalisModbusTcpServer::start(uint8_t serverId)
{
    if (started)
    {
        return true;
    }

    if (modbusServer.begin(serverId) != 1)
    {
        nodalisLogError("Failed to start Modbus TCP server");
        return false;
    }

    if (maxCoil >= 0)
    {
        modbusServer.configureCoils(0, maxCoil + 1);
    }
    if (maxHolding >= 0)
    {
        modbusServer.configureHoldingRegisters(0, maxHolding + 1);
    }

    tcpServer.begin();
    started = true;
    nodalisLogInfo("Modbus TCP server started");

    for (size_t i = 0; i < globals.size(); ++i)
    {
        GlobalMap &map = globals[i];
        const uint64_t memValue = readMemoryValue(map);
        writeServerValue(map, memValue);
        map.shadowValue = memValue;
        map.initialized = true;
    }

    return true;
}

void NodalisModbusTcpServer::poll()
{
    if (!started)
    {
        return;
    }

    EthernetClient client = tcpServer.available();
    if (client)
    {
        nodalisLogInfo("Accepted Modbus TCP client");
        modbusServer.accept(client);
    }
    modbusServer.poll();

    for (size_t i = 0; i < globals.size(); ++i)
    {
        GlobalMap &map = globals[i];
        uint64_t serverValue = 0;
        if (readServerValue(map, serverValue) && (!map.initialized || serverValue != map.shadowValue))
        {
            writeMemoryValue(map, serverValue);
            map.shadowValue = serverValue;
            map.initialized = true;
        }

        const uint64_t memoryValue = readMemoryValue(map);
        if (!map.initialized || memoryValue != map.shadowValue)
        {
            if (writeServerValue(map, memoryValue))
            {
                map.shadowValue = memoryValue;
                map.initialized = true;
            }
        }
    }
}

bool NodalisModbusTcpServer::readServerValue(const GlobalMap &map, uint64_t &value)
{
    if (map.isBit)
    {
        const int bitVal = modbusServer.coilRead(map.coilAddress);
        if (bitVal < 0)
            return false;
        value = (bitVal == 0) ? 0 : 1;
        return true;
    }

    if (map.width == 8 || map.width == 16)
    {
        const long reg = modbusServer.holdingRegisterRead(map.registerAddress);
        if (reg < 0)
            return false;
        value = static_cast<uint16_t>(reg & 0xFFFF);
        return true;
    }

    if (map.width == 32)
    {
        const long hi = modbusServer.holdingRegisterRead(map.registerAddress);
        const long lo = modbusServer.holdingRegisterRead(static_cast<uint16_t>(map.registerAddress + 1));
        if (hi < 0 || lo < 0)
            return false;
        value = (static_cast<uint32_t>(hi & 0xFFFF) << 16) | static_cast<uint32_t>(lo & 0xFFFF);
        return true;
    }

    if (map.width == 64)
    {
        uint64_t result = 0;
        for (uint16_t i = 0; i < 4; ++i)
        {
            const long reg = modbusServer.holdingRegisterRead(static_cast<uint16_t>(map.registerAddress + i));
            if (reg < 0)
                return false;
            result = (result << 16) | static_cast<uint16_t>(reg & 0xFFFF);
        }
        value = result;
        return true;
    }

    return false;
}

bool NodalisModbusTcpServer::writeServerValue(const GlobalMap &map, uint64_t value)
{
    if (map.isBit)
    {
        return modbusServer.coilWrite(map.coilAddress, value == 0 ? 0 : 1) == 1;
    }

    if (map.width == 8 || map.width == 16)
    {
        return modbusServer.holdingRegisterWrite(map.registerAddress, static_cast<uint16_t>(value & 0xFFFF)) == 1;
    }

    if (map.width == 32)
    {
        const uint16_t hi = static_cast<uint16_t>((value >> 16) & 0xFFFF);
        const uint16_t lo = static_cast<uint16_t>(value & 0xFFFF);
        if (modbusServer.holdingRegisterWrite(map.registerAddress, hi) != 1)
            return false;
        return modbusServer.holdingRegisterWrite(static_cast<uint16_t>(map.registerAddress + 1), lo) == 1;
    }

    if (map.width == 64)
    {
        for (uint16_t i = 0; i < 4; ++i)
        {
            const uint16_t shift = static_cast<uint16_t>((3 - i) * 16);
            const uint16_t reg = static_cast<uint16_t>((value >> shift) & 0xFFFF);
            if (modbusServer.holdingRegisterWrite(static_cast<uint16_t>(map.registerAddress + i), reg) != 1)
                return false;
        }
        return true;
    }

    return false;
}

uint64_t NodalisModbusTcpServer::readMemoryValue(const GlobalMap &map) const
{
    if (map.isBit)
    {
        return readBit(map.address) ? 1 : 0;
    }

    if (map.width == 8)
        return readByte(map.address);
    if (map.width == 16)
        return readWord(map.address);
    if (map.width == 32)
        return readDWord(map.address);
    if (map.width == 64)
        return readLWord(map.address);
    return 0;
}

void NodalisModbusTcpServer::writeMemoryValue(const GlobalMap &map, uint64_t value) const
{
    if (map.isBit)
    {
        writeBit(map.address, value != 0);
        return;
    }

    if (map.width == 8)
    {
        writeByte(map.address, static_cast<uint8_t>(value & 0xFF));
        return;
    }
    if (map.width == 16)
    {
        writeWord(map.address, static_cast<uint16_t>(value & 0xFFFF));
        return;
    }
    if (map.width == 32)
    {
        writeDWord(map.address, static_cast<uint32_t>(value & 0xFFFFFFFFULL));
        return;
    }
    if (map.width == 64)
    {
        writeLWord(map.address, value);
    }
}

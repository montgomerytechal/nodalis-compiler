#include "opcua.h"

OPCUAClient::OPCUAClient() : IOClient("opcua") {}
OPCUAClient::~OPCUAClient() = default;

void OPCUAClient::connect() { connected = true; }

bool OPCUAClient::readBit(const std::string &remote, int &result)
{
    uint8_t val = 0;
    const bool ok = readByte(remote, val);
    result = (val & 0x01U) ? 1 : 0;
    return ok;
}

bool OPCUAClient::writeBit(const std::string &remote, int value)
{
    return writeByte(remote, static_cast<uint8_t>(value ? 1 : 0));
}

bool OPCUAClient::readByte(const std::string &remote, uint8_t &result)
{
    result = static_cast<uint8_t>(cache[remote] & 0xFFU);
    return true;
}

bool OPCUAClient::writeByte(const std::string &remote, uint8_t value)
{
    cache[remote] = static_cast<uint64_t>(value);
    return true;
}

bool OPCUAClient::readWord(const std::string &remote, uint16_t &result)
{
    result = static_cast<uint16_t>(cache[remote] & 0xFFFFU);
    return true;
}

bool OPCUAClient::writeWord(const std::string &remote, uint16_t value)
{
    cache[remote] = static_cast<uint64_t>(value);
    return true;
}

bool OPCUAClient::readDWord(const std::string &remote, uint32_t &result)
{
    result = static_cast<uint32_t>(cache[remote] & 0xFFFFFFFFULL);
    return true;
}

bool OPCUAClient::writeDWord(const std::string &remote, uint32_t value)
{
    cache[remote] = static_cast<uint64_t>(value);
    return true;
}

bool OPCUAClient::readLWord(const std::string &remote, uint64_t &result)
{
    result = cache[remote];
    return true;
}

bool OPCUAClient::writeLWord(const std::string &remote, uint64_t value)
{
    cache[remote] = value;
    return true;
}

OPCUAServer::OPCUAServer() = default;
OPCUAServer::~OPCUAServer() = default;

void OPCUAServer::start() { running = true; }
void OPCUAServer::stop() { running = false; }

void OPCUAServer::mapVariable(std::string varname, std::string addr)
{
    mappedVars[varname] = addr;
}

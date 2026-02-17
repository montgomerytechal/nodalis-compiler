#include "bacnet.h"

BACNETClient::BACNETClient(const std::string &ip, uint16_t port)
    : IOClient("BACNET"), remoteIp(ip), remotePort(port == 0 ? 0xBAC0 : port) {}

BACNETClient::~BACNETClient() = default;

void BACNETClient::connect()
{
    connected = bacnetEnabled;
    if (!connected)
    {
        // Keep client silent/no-op unless BACnet is explicitly enabled in this target.
    }
}

bool BACNETClient::readBit(const std::string &remote, int &result)
{
    uint8_t value = 0;
    const bool ok = readByte(remote, value);
    result = (value & 0x01U) ? 1 : 0;
    return ok;
}

bool BACNETClient::writeBit(const std::string &remote, int value)
{
    return writeByte(remote, static_cast<uint8_t>(value ? 1 : 0));
}

bool BACNETClient::readByte(const std::string &remote, uint8_t &result)
{
    if (!bacnetEnabled)
        return false;
    result = static_cast<uint8_t>(cache[remote] & 0xFFU);
    return true;
}

bool BACNETClient::writeByte(const std::string &remote, uint8_t value)
{
    if (!bacnetEnabled)
        return false;
    cache[remote] = static_cast<uint64_t>(value);
    return true;
}

bool BACNETClient::readWord(const std::string &remote, uint16_t &result)
{
    if (!bacnetEnabled)
        return false;
    result = static_cast<uint16_t>(cache[remote] & 0xFFFFU);
    return true;
}

bool BACNETClient::writeWord(const std::string &remote, uint16_t value)
{
    if (!bacnetEnabled)
        return false;
    cache[remote] = static_cast<uint64_t>(value);
    return true;
}

bool BACNETClient::readDWord(const std::string &remote, uint32_t &result)
{
    if (!bacnetEnabled)
        return false;
    result = static_cast<uint32_t>(cache[remote] & 0xFFFFFFFFULL);
    return true;
}

bool BACNETClient::writeDWord(const std::string &remote, uint32_t value)
{
    if (!bacnetEnabled)
        return false;
    cache[remote] = static_cast<uint64_t>(value);
    return true;
}

bool BACNETClient::readLWord(const std::string &remote, uint64_t &result)
{
    if (!bacnetEnabled)
        return false;
    result = cache[remote];
    return true;
}

bool BACNETClient::writeLWord(const std::string &remote, uint64_t value)
{
    if (!bacnetEnabled)
        return false;
    cache[remote] = value;
    return true;
}

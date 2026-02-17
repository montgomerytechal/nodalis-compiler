#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>

#include "nodalis.h"

class BACNETClient : public IOClient
{
public:
    BACNETClient(const std::string &ip = "", uint16_t port = 0xBAC0);
    ~BACNETClient() override;

protected:
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

private:
    std::string remoteIp;
    uint16_t remotePort;

#if defined(NODALIS_ENABLE_BACNET)
    bool bacnetEnabled = true;
#else
    bool bacnetEnabled = false;
#endif

    std::unordered_map<std::string, uint64_t> cache;
};

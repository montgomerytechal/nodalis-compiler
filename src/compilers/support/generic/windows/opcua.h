#pragma once
#include "nodalis.h"


class OPCUAClient : public IOClient {
public:
    OPCUAClient();
    ~OPCUAClient();

protected:
    void connect() override;

    bool readBit(const std::string& remote, int& result) override;
    bool writeBit(const std::string& remote, int value) override;
    bool readByte(const std::string& remote, uint8_t& result) override;
    bool writeByte(const std::string& remote, uint8_t value) override;
    bool readWord(const std::string& remote, uint16_t& result) override;
    bool writeWord(const std::string& remote, uint16_t value) override;
    bool readDWord(const std::string& remote, uint32_t& result) override;
    bool writeDWord(const std::string& remote, uint32_t value) override;
    bool readLWord(const std::string &remote, uint64_t &result) override;
    bool writeLWord(const std::string &remote, uint64_t value) override;

private:
   
    std::string endpointUrl;
};

class OPCUAServer {
public:
    OPCUAServer();
    ~OPCUAServer();

    void start();
    void stop();
    void mapVariable(std::string varname, std::string addr);

private:
    void run();

};

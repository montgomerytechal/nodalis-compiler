// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

#pragma once
#ifndef NODALIS_GPIO_H
#define NODALIS_GPIO_H

#include <string>
#include <unordered_map>

#include "nodalis.h"

class NodalisGPIOClient : public IOClient
{
public:
    NodalisGPIOClient();
    ~NodalisGPIOClient() override = default;

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
    void onMappingAdded(const IOMap &map) override;

private:
    std::unordered_map<std::string, uint8_t> pinByRemote;

    bool parsePin(const std::string &remote, uint8_t &pin) const;
    bool resolvePin(const std::string &remote, uint8_t &pin) const;
};

#endif

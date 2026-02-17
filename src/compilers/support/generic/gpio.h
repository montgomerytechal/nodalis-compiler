// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

#pragma once
#ifndef GPIO_H
#define GPIO_H

#include <string>
#include <unordered_map>

#include "nodalis.h"

class GPIOClient : public IOClient
{
public:
    GPIOClient();
    ~GPIOClient() override = default;

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
#ifdef __linux__
    std::unordered_map<std::string, int> pinByRemote;

    std::string normalizeChipName(const std::string &chip) const;
    bool readIntFile(const std::string &path, int &value) const;
    bool writeTextFile(const std::string &path, const std::string &value) const;
    bool ensureExported(int globalPin) const;
    bool ensureDirection(int globalPin, const std::string &direction) const;
    bool resolveGlobalPin(const IOMap &map, int &globalPin) const;
    bool resolveRemotePin(const std::string &remote, int &globalPin) const;
    bool readGpioValue(int globalPin, int &value) const;
    bool writeGpioValue(int globalPin, int value) const;
#endif
};

#endif // GPIO_H

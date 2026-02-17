// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

#include "gpio.h"

#include <cstdlib>

NodalisGPIOClient::NodalisGPIOClient() : IOClient("GPIO") {}

void NodalisGPIOClient::connect()
{
    connected = true;
}

void NodalisGPIOClient::onMappingAdded(const IOMap &map)
{
    uint8_t startPin = 0;
    if (!parsePin(map.remoteAddress, startPin))
    {
        return;
    }

    const int width = (map.width > 1) ? map.width : 1;
    const int mode = (map.direction == IOType::Output) ? OUTPUT : INPUT;
    for (int bit = 0; bit < width; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        pinMode(pin, mode);
    }
    pinByRemote[map.remoteAddress] = startPin;
}

bool NodalisGPIOClient::parsePin(const std::string &remote, uint8_t &pin) const
{
    char *endPtr = nullptr;
    const long parsed = std::strtol(remote.c_str(), &endPtr, 10);
    if (endPtr == remote.c_str() || parsed < 0 || parsed > 255)
    {
        return false;
    }

    pin = static_cast<uint8_t>(parsed);
    return true;
}

bool NodalisGPIOClient::resolvePin(const std::string &remote, uint8_t &pin) const
{
    const auto it = pinByRemote.find(remote);
    if (it != pinByRemote.end())
    {
        pin = it->second;
        return true;
    }

    return parsePin(remote, pin);
}

bool NodalisGPIOClient::readBit(const std::string &remote, int &result)
{
    uint8_t pin = 0;
    if (!resolvePin(remote, pin))
    {
        return false;
    }

    result = (digitalRead(pin) == HIGH) ? 1 : 0;
    return true;
}

bool NodalisGPIOClient::writeBit(const std::string &remote, int value)
{
    uint8_t pin = 0;
    if (!resolvePin(remote, pin))
    {
        return false;
    }

    digitalWrite(pin, value == 0 ? LOW : HIGH);
    return true;
}

bool NodalisGPIOClient::readByte(const std::string &remote, uint8_t &result)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 8; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        if (digitalRead(pin) == HIGH)
        {
            result |= static_cast<uint8_t>(1U << bit);
        }
    }
    return true;
}

bool NodalisGPIOClient::writeByte(const std::string &remote, uint8_t value)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 8; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        const bool bitValue = ((value >> bit) & 0x01U) != 0;
        digitalWrite(pin, bitValue ? HIGH : LOW);
    }
    return true;
}

bool NodalisGPIOClient::readWord(const std::string &remote, uint16_t &result)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 16; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        if (digitalRead(pin) == HIGH)
        {
            result |= static_cast<uint16_t>(1U << bit);
        }
    }
    return true;
}

bool NodalisGPIOClient::writeWord(const std::string &remote, uint16_t value)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 16; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        const bool bitValue = ((value >> bit) & 0x01U) != 0;
        digitalWrite(pin, bitValue ? HIGH : LOW);
    }
    return true;
}

bool NodalisGPIOClient::readDWord(const std::string &remote, uint32_t &result)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 32; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        if (digitalRead(pin) == HIGH)
        {
            result |= (static_cast<uint32_t>(1) << bit);
        }
    }
    return true;
}

bool NodalisGPIOClient::writeDWord(const std::string &remote, uint32_t value)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 32; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        const bool bitValue = ((value >> bit) & static_cast<uint32_t>(1)) != 0;
        digitalWrite(pin, bitValue ? HIGH : LOW);
    }
    return true;
}

bool NodalisGPIOClient::readLWord(const std::string &remote, uint64_t &result)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 64; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        if (digitalRead(pin) == HIGH)
        {
            result |= (static_cast<uint64_t>(1) << bit);
        }
    }
    return true;
}

bool NodalisGPIOClient::writeLWord(const std::string &remote, uint64_t value)
{
    uint8_t startPin = 0;
    if (!resolvePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 64; ++bit)
    {
        const uint8_t pin = static_cast<uint8_t>(startPin + bit);
        const bool bitValue = ((value >> bit) & static_cast<uint64_t>(1)) != 0;
        digitalWrite(pin, bitValue ? HIGH : LOW);
    }
    return true;
}

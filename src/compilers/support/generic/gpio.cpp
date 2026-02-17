// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

#include "gpio.h"

#include <cstdlib>
#include <fstream>

#ifdef __linux__
#include <filesystem>
#endif

GPIOClient::GPIOClient() : IOClient("GPIO") {}

void GPIOClient::connect()
{
#ifdef __linux__
    connected = true;
#else
    connected = false;
#endif
}

void GPIOClient::onMappingAdded(const IOMap &map)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveGlobalPin(map, startPin))
    {
        return;
    }
    const std::string direction = (map.direction == IOType::Output) ? "out" : "in";
    const int width = (map.width > 1) ? map.width : 1;
    for (int bit = 0; bit < width; ++bit)
    {
        const int pin = startPin + bit;
        if (!ensureExported(pin))
        {
            return;
        }
        if (!ensureDirection(pin, direction))
        {
            return;
        }
    }

    pinByRemote[map.remoteAddress] = startPin;
#else
    (void)map;
#endif
}

bool GPIOClient::readBit(const std::string &remote, int &result)
{
#ifdef __linux__
    int globalPin = -1;
    if (!resolveRemotePin(remote, globalPin))
    {
        return false;
    }
    return readGpioValue(globalPin, result);
#else
    (void)remote;
    result = 0;
    return false;
#endif
}

bool GPIOClient::writeBit(const std::string &remote, int value)
{
#ifdef __linux__
    int globalPin = -1;
    if (!resolveRemotePin(remote, globalPin))
    {
        return false;
    }
    return writeGpioValue(globalPin, value);
#else
    (void)remote;
    (void)value;
    return false;
#endif
}

bool GPIOClient::readByte(const std::string &remote, uint8_t &result)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 8; ++bit)
    {
        int pinValue = 0;
        if (!readGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
        if (pinValue != 0)
        {
            result |= static_cast<uint8_t>(1U << bit);
        }
    }
    return true;
#else
    (void)remote;
    result = 0;
    return false;
#endif
}

bool GPIOClient::writeByte(const std::string &remote, uint8_t value)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 8; ++bit)
    {
        const int pinValue = ((value >> bit) & 0x01U) != 0 ? 1 : 0;
        if (!writeGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
    }
    return true;
#else
    (void)remote;
    (void)value;
    return false;
#endif
}

bool GPIOClient::readWord(const std::string &remote, uint16_t &result)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 16; ++bit)
    {
        int pinValue = 0;
        if (!readGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
        if (pinValue != 0)
        {
            result |= static_cast<uint16_t>(1U << bit);
        }
    }
    return true;
#else
    (void)remote;
    result = 0;
    return false;
#endif
}

bool GPIOClient::writeWord(const std::string &remote, uint16_t value)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 16; ++bit)
    {
        const int pinValue = ((value >> bit) & 0x01U) != 0 ? 1 : 0;
        if (!writeGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
    }
    return true;
#else
    (void)remote;
    (void)value;
    return false;
#endif
}

bool GPIOClient::readDWord(const std::string &remote, uint32_t &result)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 32; ++bit)
    {
        int pinValue = 0;
        if (!readGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
        if (pinValue != 0)
        {
            result |= (static_cast<uint32_t>(1) << bit);
        }
    }
    return true;
#else
    (void)remote;
    result = 0;
    return false;
#endif
}

bool GPIOClient::writeDWord(const std::string &remote, uint32_t value)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 32; ++bit)
    {
        const int pinValue = ((value >> bit) & static_cast<uint32_t>(1)) != 0 ? 1 : 0;
        if (!writeGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
    }
    return true;
#else
    (void)remote;
    (void)value;
    return false;
#endif
}

bool GPIOClient::readLWord(const std::string &remote, uint64_t &result)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    result = 0;
    for (int bit = 0; bit < 64; ++bit)
    {
        int pinValue = 0;
        if (!readGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
        if (pinValue != 0)
        {
            result |= (static_cast<uint64_t>(1) << bit);
        }
    }
    return true;
#else
    (void)remote;
    result = 0;
    return false;
#endif
}

bool GPIOClient::writeLWord(const std::string &remote, uint64_t value)
{
#ifdef __linux__
    int startPin = -1;
    if (!resolveRemotePin(remote, startPin))
    {
        return false;
    }

    for (int bit = 0; bit < 64; ++bit)
    {
        const int pinValue = ((value >> bit) & static_cast<uint64_t>(1)) != 0 ? 1 : 0;
        if (!writeGpioValue(startPin + bit, pinValue))
        {
            return false;
        }
    }
    return true;
#else
    (void)remote;
    (void)value;
    return false;
#endif
}

#ifdef __linux__
std::string GPIOClient::normalizeChipName(const std::string &chip) const
{
    if (chip.empty())
    {
        return "gpiochip0";
    }

    const std::string lower = toLowerCase(chip);
    if (lower.rfind("gpiochip", 0) == 0)
    {
        return lower;
    }

    return "gpiochip" + lower;
}

bool GPIOClient::readIntFile(const std::string &path, int &value) const
{
    std::ifstream in(path);
    if (!in)
    {
        return false;
    }
    in >> value;
    return in.good() || in.eof();
}

bool GPIOClient::writeTextFile(const std::string &path, const std::string &value) const
{
    std::ofstream out(path);
    if (!out)
    {
        return false;
    }
    out << value;
    return out.good();
}

bool GPIOClient::ensureExported(int globalPin) const
{
    const std::string gpioPath = "/sys/class/gpio/gpio" + std::to_string(globalPin);
    if (std::filesystem::exists(gpioPath))
    {
        return true;
    }

    if (!writeTextFile("/sys/class/gpio/export", std::to_string(globalPin)))
    {
        return std::filesystem::exists(gpioPath);
    }

    return true;
}

bool GPIOClient::ensureDirection(int globalPin, const std::string &direction) const
{
    return writeTextFile("/sys/class/gpio/gpio" + std::to_string(globalPin) + "/direction", direction);
}

bool GPIOClient::resolveGlobalPin(const IOMap &map, int &globalPin) const
{
    const std::string chipName = normalizeChipName(map.moduleID);
    const std::string chipBasePath = "/sys/class/gpio/" + chipName + "/base";

    char *endPtr = nullptr;
    const long offset = std::strtol(map.remoteAddress.c_str(), &endPtr, 10);
    if (endPtr == map.remoteAddress.c_str() || offset < 0)
    {
        return false;
    }

    int base = 0;
    if (!readIntFile(chipBasePath, base))
    {
        // Fallback to absolute pin numbering if gpiochip base is unavailable.
        globalPin = static_cast<int>(offset);
        return true;
    }

    globalPin = base + static_cast<int>(offset);
    return true;
}

bool GPIOClient::resolveRemotePin(const std::string &remote, int &globalPin) const
{
    const auto it = pinByRemote.find(remote);
    if (it != pinByRemote.end())
    {
        globalPin = it->second;
        return true;
    }

    IOMap temp;
    temp.moduleID = moduleID;
    temp.remoteAddress = remote;
    return resolveGlobalPin(temp, globalPin);
}

bool GPIOClient::readGpioValue(int globalPin, int &value) const
{
    std::ifstream in("/sys/class/gpio/gpio" + std::to_string(globalPin) + "/value");
    if (!in)
    {
        return false;
    }

    char c = '0';
    in >> c;
    if (!in)
    {
        return false;
    }

    value = (c == '0') ? 0 : 1;
    return true;
}

bool GPIOClient::writeGpioValue(int globalPin, int value) const
{
    return writeTextFile("/sys/class/gpio/gpio" + std::to_string(globalPin) + "/value", (value == 0) ? "0" : "1");
}
#endif

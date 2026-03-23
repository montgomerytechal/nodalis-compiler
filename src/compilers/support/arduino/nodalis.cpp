#include "nodalis.h"

#include "modbus.h"
#include "gpio.h"

uint64_t PROGRAM_COUNT = 0;
uint64_t MEMORY[64][16] = {0};

uint64_t elapsed()
{
    return static_cast<uint64_t>(millis());
}

bool nodalisSerialReady()
{
    return static_cast<bool>(Serial);
}

static void nodalisLog(const char *level, const String &message)
{
    if (!nodalisSerialReady())
        return;
    Serial.print("[Nodalis][");
    Serial.print(level);
    Serial.print("] ");
    Serial.println(message);
}

void nodalisLogInfo(const String &message)
{
    nodalisLog("INFO", message);
}

void nodalisLogError(const String &message)
{
    nodalisLog("ERROR", message);
}

static bool validAddressParts(const std::vector<int> &parts, int expectedWidth, bool allowBit)
{
    if (parts.size() != 4)
        return false;
    if (parts[0] < 0 || parts[2] < 0)
        return false;
    if (expectedWidth > 0 && parts[1] != expectedWidth)
        return false;
    if (!allowBit && parts[3] >= 0)
        return false;
    if (allowBit && parts[3] < 0)
        return false;
    return true;
}

uint64_t readLWord(std::string address)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 64, false))
        return 0;
    uint64_t *ptr = getMemoryLWord(parts[0], parts[2]);
    return ptr ? *ptr : 0;
}

uint32_t readDWord(std::string address)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 32, false))
        return 0;
    uint32_t *ptr = getMemoryDWord(parts[0], parts[2]);
    return ptr ? *ptr : 0;
}

uint16_t readWord(std::string address)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 16, false))
        return 0;
    uint16_t *ptr = getMemoryWord(parts[0], parts[2]);
    return ptr ? *ptr : 0;
}

uint8_t readByte(std::string address)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 8, false))
        return 0;
    uint8_t *ptr = getMemoryByte(parts[0], parts[2]);
    return ptr ? *ptr : 0;
}

bool readBit(std::string address)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, -1, true))
        return false;
    switch (parts[1])
    {
    case 8:
        return getBit(getMemoryByte(parts[0], parts[2]), parts[3]);
    case 16:
        return getBit(getMemoryWord(parts[0], parts[2]), parts[3]);
    case 32:
        return getBit(getMemoryDWord(parts[0], parts[2]), parts[3]);
    case 64:
        return getBit(getMemoryLWord(parts[0], parts[2]), parts[3]);
    default:
        return false;
    }
}

void writeLWord(std::string address, uint64_t value)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 64, false))
        return;
    uint64_t *ptr = getMemoryLWord(parts[0], parts[2]);
    if (ptr)
        *ptr = value;
}

void writeDWord(std::string address, uint32_t value)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 32, false))
        return;
    uint32_t *ptr = getMemoryDWord(parts[0], parts[2]);
    if (ptr)
        *ptr = value;
}

void writeWord(std::string address, uint16_t value)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 16, false))
        return;
    uint16_t *ptr = getMemoryWord(parts[0], parts[2]);
    if (ptr)
        *ptr = value;
}

void writeByte(std::string address, uint8_t value)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, 8, false))
        return;
    uint8_t *ptr = getMemoryByte(parts[0], parts[2]);
    if (ptr)
        *ptr = value;
}

void writeBit(std::string address, bool value)
{
    const std::vector<int> parts = parseAddress(address);
    if (!validAddressParts(parts, -1, true))
        return;
    switch (parts[1])
    {
    case 8:
        setBit(getMemoryByte(parts[0], parts[2]), parts[3], value);
        break;
    case 16:
        setBit(getMemoryWord(parts[0], parts[2]), parts[3], value);
        break;
    case 32:
        setBit(getMemoryDWord(parts[0], parts[2]), parts[3], value);
        break;
    case 64:
        setBit(getMemoryLWord(parts[0], parts[2]), parts[3], value);
        break;
    default:
        break;
    }
}

bool getBit(void *var, int bit)
{
    if (!var || bit < 0)
        return false;
    uint8_t *bytePtr = static_cast<uint8_t *>(var) + (bit / 8);
    const uint8_t mask = static_cast<uint8_t>(1U << (bit % 8));
    return (*bytePtr & mask) != 0;
}

void setBit(void *var, int bit, bool value)
{
    if (!var || bit < 0)
        return;
    uint8_t *bytePtr = static_cast<uint8_t *>(var) + (bit / 8);
    const uint8_t mask = static_cast<uint8_t>(1U << (bit % 8));
    if (value)
        *bytePtr |= mask;
    else
        *bytePtr &= static_cast<uint8_t>(~mask);
}

std::vector<std::unique_ptr<IOClient>> Clients;

IOMap::IOMap(std::string mapJson)
{
    const json j = json::parse(mapJson);
    moduleID = j.value("ModuleID", "");
    modulePort = j.value("ModulePort", "");
    localAddress = j.value("InternalAddress", "");
    remoteAddress = j.value("RemoteAddress", "");
    protocol = j.value("Protocol", "");
    additionalProperties = j.value("ProtocolProperties", json::object());
    width = std::atoi(j.value("RemoteSize", "16").c_str());
    interval = std::atoi(j.value("PollTime", "500").c_str());
    direction = localAddress.find("%Q") != std::string::npos ? IOType::Output : IOType::Input;
    lastPoll = elapsed();
}

IOMap::IOMap() {}

IOClient::IOClient(const std::string &protocol) : connected(false), protocol(protocol) {}

void IOClient::addMapping(const IOMap &map)
{
    if (!hasMapping(map.localAddress))
    {
        if (mappings.empty())
            moduleID = map.moduleID;
        mappings.push_back(map);
        onMappingAdded(mappings.back());
        logInfo("Added map " + describeMapping(mappings.back()));
    }
    else
    {
        logInfo("Skipping duplicate map " + describeMapping(map));
    }
}

bool IOClient::hasMapping(std::string localAddress)
{
    for (const auto &map : mappings)
    {
        if (map.localAddress == localAddress)
            return true;
    }
    return false;
}

void IOClient::dumpMappings() const
{
    nodalisLogInfo(String(protocol.c_str()) + ": mapping dump begin");
    for (size_t i = 0; i < mappings.size(); ++i)
    {
        nodalisLogInfo(String(protocol.c_str()) + ": " + describeMapping(mappings[i]).c_str());
    }
    nodalisLogInfo(String(protocol.c_str()) + ": mapping dump end");
}

const std::string &IOClient::getProtocol() const { return protocol; }
const std::string &IOClient::getModuleID() const { return moduleID; }

void IOClient::logInfo(const std::string &message) const
{
    nodalisLogInfo(String(protocol.c_str()) + ": " + message.c_str());
}

void IOClient::logErrorThrottled(const std::string &message)
{
    const uint64_t now = elapsed();
    if (now - lastErrorReport < 2000)
        return;
    lastErrorReport = now;
    nodalisLogError(String(protocol.c_str()) + ": " + message.c_str());
}

std::string IOClient::describeMapping(const IOMap &map) const
{
    std::string text = map.localAddress + " <= " + map.remoteAddress + " [" + map.protocol + "]";
    if (!map.moduleID.empty())
        text += " module=" + map.moduleID;
    if (!map.modulePort.empty())
        text += ":" + map.modulePort;
    return text;
}

void IOClient::poll()
{
    if (!connected)
    {
        if (elapsed() - lastAttempt >= 15000)
        {
            lastAttempt = elapsed();
            logInfo("Attempting connection");
            connect();
            if (connected)
                logInfo("Connection ready");
            else
                logErrorThrottled("Connection attempt failed");
        }
        return;
    }

    for (auto &map : mappings)
    {
        if (elapsed() - map.lastPoll <= static_cast<uint64_t>(map.interval))
            continue;
        map.lastPoll = elapsed();

        if (map.direction == IOType::Output)
        {
            bool success = true;
            switch (map.width)
            {
            case 1:
                success = writeBit(map.remoteAddress, ::readBit(map.localAddress) ? 1 : 0);
                break;
            case 8:
                success = writeByte(map.remoteAddress, ::readByte(map.localAddress));
                break;
            case 16:
                success = writeWord(map.remoteAddress, ::readWord(map.localAddress));
                break;
            case 32:
                success = writeDWord(map.remoteAddress, ::readDWord(map.localAddress));
                break;
            case 64:
                success = writeLWord(map.remoteAddress, ::readLWord(map.localAddress));
                break;
            default:
                success = false;
                break;
            }
            if (!success)
                logErrorThrottled("Write failed for " + describeMapping(map));
            continue;
        }

        if (map.direction == IOType::Input)
        {
            bool success = true;
            switch (map.width)
            {
            case 1:
            {
                int val = 0;
                success = readBit(map.remoteAddress, val);
                if (success)
                    ::writeBit(map.localAddress, val != 0);
                break;
            }
            case 8:
            {
                uint8_t val = 0;
                success = readByte(map.remoteAddress, val);
                if (success)
                    ::writeByte(map.localAddress, val);
                break;
            }
            case 16:
            {
                uint16_t val = 0;
                success = readWord(map.remoteAddress, val);
                if (success)
                    ::writeWord(map.localAddress, val);
                break;
            }
            case 32:
            {
                uint32_t val = 0;
                success = readDWord(map.remoteAddress, val);
                if (success)
                    ::writeDWord(map.localAddress, val);
                break;
            }
            case 64:
            {
                uint64_t val = 0;
                success = readLWord(map.remoteAddress, val);
                if (success)
                    ::writeLWord(map.localAddress, val);
                break;
            }
            default:
                success = false;
                break;
            }
            if (!success)
                logErrorThrottled("Read failed for " + describeMapping(map));
        }
    }
}

IOClient *findClient(IOMap map)
{
    for (size_t i = 0; i < Clients.size(); ++i)
    {
        if (Clients[i]->hasMapping(map.localAddress))
            return Clients[i].get();
        if (Clients[i]->getModuleID() == map.moduleID)
        {
            Clients[i]->addMapping(map);
            return Clients[i].get();
        }
    }
    return nullptr;
}

std::unique_ptr<IOClient> createClient(IOMap &map)
{
    const std::string proto = toLowerCase(map.protocol);
    if (proto == "modbus-tcp")
    {
        auto ret = std::make_unique<NodalisModbusClient>();
        ret->addMapping(map);
        return ret;
    }
    if (proto == "gpio")
    {
        auto ret = std::make_unique<NodalisGPIOClient>();
        ret->addMapping(map);
        return ret;
    }
    return nullptr;
}

void mapIO(std::string map)
{
    IOMap newMap(map);
    nodalisLogInfo(String("Loading map: ") + newMap.localAddress.c_str() + " <= " + newMap.remoteAddress.c_str() + " [" + newMap.protocol.c_str() + "]");
    IOClient *existing = findClient(newMap);
    if (!existing)
    {
        std::unique_ptr<IOClient> client = createClient(newMap);
        if (client)
        {
            nodalisLogInfo(String("Created IO client for protocol ") + newMap.protocol.c_str());
            Clients.push_back(std::move(client));
        }
        else
        {
            nodalisLogError(String("Unsupported IO protocol: ") + newMap.protocol.c_str());
        }
    }
}

void superviseIO()
{
    for (size_t i = 0; i < Clients.size(); ++i)
    {
        Clients[i]->poll();
    }
}

void nodalisDumpMappings()
{
    if (Clients.empty())
    {
        nodalisLogInfo("No IO clients loaded");
        return;
    }

    for (size_t i = 0; i < Clients.size(); ++i)
    {
        Clients[i]->dumpMappings();
    }
}

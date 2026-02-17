#include "nodalis.h"

#include "modbus.h"

uint64_t PROGRAM_COUNT = 0;
uint64_t MEMORY[64][16] = {0};

uint64_t elapsed()
{
    return static_cast<uint64_t>(millis());
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

const std::string &IOClient::getProtocol() const { return protocol; }
const std::string &IOClient::getModuleID() const { return moduleID; }

void IOClient::poll()
{
    if (!connected)
    {
        if (elapsed() - lastAttempt >= 15000)
        {
            lastAttempt = elapsed();
            connect();
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
            switch (map.width)
            {
            case 1:
                writeBit(map.remoteAddress, ::readBit(map.localAddress) ? 1 : 0);
                break;
            case 8:
                writeByte(map.remoteAddress, ::readByte(map.localAddress));
                break;
            case 16:
                writeWord(map.remoteAddress, ::readWord(map.localAddress));
                break;
            case 32:
                writeDWord(map.remoteAddress, ::readDWord(map.localAddress));
                break;
            case 64:
                writeLWord(map.remoteAddress, ::readLWord(map.localAddress));
                break;
            default:
                break;
            }
            continue;
        }

        if (map.direction == IOType::Input)
        {
            switch (map.width)
            {
            case 1:
            {
                int val = 0;
                if (readBit(map.remoteAddress, val))
                    writeBit(map.localAddress, val != 0);
                break;
            }
            case 8:
            {
                uint8_t val = 0;
                if (readByte(map.remoteAddress, val))
                    writeByte(map.localAddress, val);
                break;
            }
            case 16:
            {
                uint16_t val = 0;
                if (readWord(map.remoteAddress, val))
                    writeWord(map.localAddress, val);
                break;
            }
            case 32:
            {
                uint32_t val = 0;
                if (readDWord(map.remoteAddress, val))
                    writeDWord(map.localAddress, val);
                break;
            }
            case 64:
            {
                uint64_t val = 0;
                if (readLWord(map.remoteAddress, val))
                    writeLWord(map.localAddress, val);
                break;
            }
            default:
                break;
            }
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
    return nullptr;
}

void mapIO(std::string map)
{
    IOMap newMap(map);
    IOClient *existing = findClient(newMap);
    if (!existing)
    {
        std::unique_ptr<IOClient> client = createClient(newMap);
        if (client)
            Clients.push_back(std::move(client));
    }
}

void superviseIO()
{
    for (size_t i = 0; i < Clients.size(); ++i)
    {
        Clients[i]->poll();
    }
}

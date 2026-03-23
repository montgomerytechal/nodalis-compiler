#include "network_config.h"
#include "nodalis.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

#if defined(ARDUINO_ARCH_MBED) && __has_include(<BlockDevice.h>) && __has_include(<MBRBlockDevice.h>) && __has_include(<LittleFileSystem.h>) && __has_include(<FATFileSystem.h>)
#include <BlockDevice.h>
#include <MBRBlockDevice.h>
#include <LittleFileSystem.h>
#include <FATFileSystem.h>
#define NODALIS_HAS_OPTA_FS 1
#else
#define NODALIS_HAS_OPTA_FS 0
#endif

#if defined(ARDUINO_ARCH_MBED) && __has_include(<kvstore_global_api.h>)
#include <kvstore_global_api.h>
#define NODALIS_HAS_KVSTORE 1
#else
#define NODALIS_HAS_KVSTORE 0
#endif

#if !NODALIS_HAS_KVSTORE && __has_include(<EEPROM.h>)
#include <EEPROM.h>
#define NODALIS_HAS_EEPROM 1
#else
#define NODALIS_HAS_EEPROM 0
#endif

namespace
{
const uint8_t DEFAULT_MAC[6] = {0x02, 0x4E, 0x4F, 0x44, 0x41, 0x4C};
const int EEPROM_BASE = 0;
const uint8_t EEPROM_MAGIC_0 = 0x4E;
const uint8_t EEPROM_MAGIC_1 = 0x49;
const uint8_t EEPROM_VERSION = 0x01;
const size_t SERIAL_BUFFER_LIMIT = 48;
const char *KVSTORE_IP_KEY = "/kv/nodalis_ip";
const char *USERDATA_IP_PATH = "/user/nodalis_ip.bin";

String serialBuffer;

bool nodalisIsBitAddress(const String &address)
{
    const std::vector<int> parts = parseAddress(std::string(address.c_str()));
    return parts.size() == 4 && parts[0] >= 0 && parts[2] >= 0 && parts[3] >= 0;
}

void nodalisPrintBitValue(const String &address)
{
    Serial.print(address);
    Serial.print(" = ");
    Serial.println(readBit(std::string(address.c_str())) ? 1 : 0);
}

bool nodalisHandleBitCommand(const String &command, const String &upper)
{
    if (upper == "MAPS")
    {
        nodalisDumpMappings();
        return true;
    }

    if (upper.startsWith("READBIT "))
    {
        String address = command.substring(8);
        address.trim();
        if (!nodalisIsBitAddress(address))
        {
            Serial.println("Invalid bit address.");
            return true;
        }
        nodalisPrintBitValue(address);
        return true;
    }

    if (upper.startsWith("WRITEBIT "))
    {
        const int splitIndex = command.lastIndexOf(' ');
        if (splitIndex <= 8)
        {
            Serial.println("Usage: WRITEBIT %IX0.0 1");
            return true;
        }

        String address = command.substring(9, splitIndex);
        String valueText = command.substring(splitIndex + 1);
        address.trim();
        valueText.trim();

        if (!nodalisIsBitAddress(address) || (valueText != "0" && valueText != "1"))
        {
            Serial.println("Usage: WRITEBIT %IX0.0 1");
            return true;
        }

        writeBit(std::string(address.c_str()), valueText == "1");
        nodalisPrintBitValue(address);
        return true;
    }

    return false;
}

bool nodalisParseIpString(const String &input, IPAddress &ip)
{
    unsigned int octets[4] = {0, 0, 0, 0};
    int octetIndex = 0;
    unsigned int current = 0;
    bool hasDigit = false;

    for (size_t i = 0; i < input.length(); ++i)
    {
        const char ch = input.charAt(i);
        if (ch >= '0' && ch <= '9')
        {
            hasDigit = true;
            current = (current * 10U) + static_cast<unsigned int>(ch - '0');
            if (current > 255U)
            {
                return false;
            }
            continue;
        }

        if (ch != '.' || !hasDigit || octetIndex >= 3)
        {
            return false;
        }

        octets[octetIndex++] = current;
        current = 0;
        hasDigit = false;
    }

    if (!hasDigit || octetIndex != 3)
    {
        return false;
    }

    octets[octetIndex] = current;
    ip = IPAddress(octets[0], octets[1], octets[2], octets[3]);
    return true;
}

String nodalisNormalizeCommand(String value)
{
    value.trim();
    while (value.startsWith(" "))
    {
        value.remove(0, 1);
    }
    return value;
}

uint8_t nodalisChecksum(const IPAddress &ip)
{
    return static_cast<uint8_t>(ip[0] ^ ip[1] ^ ip[2] ^ ip[3] ^ EEPROM_VERSION);
}

#if NODALIS_HAS_OPTA_FS || NODALIS_HAS_KVSTORE
struct PersistentIpRecord
{
    uint8_t magic0;
    uint8_t magic1;
    uint8_t version;
    uint8_t ip[4];
    uint8_t checksum;
};
#endif

#if NODALIS_HAS_OPTA_FS
template <typename FileSystemType>
bool nodalisReadRecordFromFileSystem(mbed::MBRBlockDevice &userData, FileSystemType &fs, PersistentIpRecord &record)
{
    if (fs.mount(&userData) != 0)
    {
        return false;
    }

    bool success = false;
    FILE *fp = fopen(USERDATA_IP_PATH, "rb");
    if (fp)
    {
        const size_t readCount = fread(&record, sizeof(record), 1, fp);
        fclose(fp);
        success = (readCount == 1);
    }
    fs.unmount();
    return success;
}

template <typename FileSystemType>
bool nodalisWriteRecordToFileSystem(mbed::MBRBlockDevice &userData, FileSystemType &fs, const PersistentIpRecord &record)
{
    if (fs.mount(&userData) != 0)
    {
        return false;
    }

    bool success = false;
    FILE *fp = fopen(USERDATA_IP_PATH, "wb");
    if (fp)
    {
        const size_t writeCount = fwrite(&record, sizeof(record), 1, fp);
        fflush(fp);
        fclose(fp);
        success = (writeCount == 1);
    }
    fs.unmount();
    return success;
}

bool nodalisReadStoredIpFromUserData(IPAddress &ip)
{
    mbed::BlockDevice *root = mbed::BlockDevice::get_default_instance();
    if (!root || root->init() != 0)
    {
        return false;
    }

    mbed::MBRBlockDevice userData(root, 4);
    mbed::LittleFileSystem littleFs("user");
    mbed::FATFileSystem fatFs("user");
    PersistentIpRecord record = {};

    const bool readOk = nodalisReadRecordFromFileSystem(userData, littleFs, record) ||
                        nodalisReadRecordFromFileSystem(userData, fatFs, record);
    root->deinit();

    if (!readOk)
    {
        return false;
    }

    if (record.magic0 != EEPROM_MAGIC_0 || record.magic1 != EEPROM_MAGIC_1 || record.version != EEPROM_VERSION)
    {
        return false;
    }

    IPAddress stored(record.ip[0], record.ip[1], record.ip[2], record.ip[3]);
    if (record.checksum != nodalisChecksum(stored))
    {
        return false;
    }

    ip = stored;
    return true;
}

bool nodalisWriteStoredIpToUserData(const IPAddress &ip)
{
    mbed::BlockDevice *root = mbed::BlockDevice::get_default_instance();
    if (!root || root->init() != 0)
    {
        return false;
    }

    mbed::MBRBlockDevice userData(root, 4);
    mbed::LittleFileSystem littleFs("user");
    mbed::FATFileSystem fatFs("user");
    const PersistentIpRecord record = {
        EEPROM_MAGIC_0,
        EEPROM_MAGIC_1,
        EEPROM_VERSION,
        {ip[0], ip[1], ip[2], ip[3]},
        nodalisChecksum(ip)
    };

    const bool writeOk = nodalisWriteRecordToFileSystem(userData, littleFs, record) ||
                         nodalisWriteRecordToFileSystem(userData, fatFs, record);
    root->deinit();
    return writeOk;
}
#endif

#if NODALIS_HAS_KVSTORE

bool nodalisReadStoredIp(IPAddress &ip)
{
#if NODALIS_HAS_OPTA_FS
    if (nodalisReadStoredIpFromUserData(ip))
    {
        return true;
    }
#endif
    PersistentIpRecord record = {};
    size_t actualSize = 0;
    const int readResult = kv_get(KVSTORE_IP_KEY, &record, sizeof(record), &actualSize);
    if (readResult != 0 || actualSize != sizeof(record))
    {
        return false;
    }

    if (record.magic0 != EEPROM_MAGIC_0 || record.magic1 != EEPROM_MAGIC_1 || record.version != EEPROM_VERSION)
    {
        return false;
    }

    IPAddress stored(record.ip[0], record.ip[1], record.ip[2], record.ip[3]);
    if (record.checksum != nodalisChecksum(stored))
    {
        return false;
    }

    ip = stored;
    return true;
}

bool nodalisWriteStoredIp(const IPAddress &ip)
{
#if NODALIS_HAS_OPTA_FS
    if (nodalisWriteStoredIpToUserData(ip))
    {
        return true;
    }
#endif
    PersistentIpRecord record = {
        EEPROM_MAGIC_0,
        EEPROM_MAGIC_1,
        EEPROM_VERSION,
        {ip[0], ip[1], ip[2], ip[3]},
        nodalisChecksum(ip)
    };
    return kv_set(KVSTORE_IP_KEY, &record, sizeof(record), 0) == 0;
}

#elif NODALIS_HAS_EEPROM
bool nodalisReadStoredIp(IPAddress &ip)
{
    if (EEPROM.read(EEPROM_BASE) != EEPROM_MAGIC_0 || EEPROM.read(EEPROM_BASE + 1) != EEPROM_MAGIC_1 || EEPROM.read(EEPROM_BASE + 2) != EEPROM_VERSION)
    {
        return false;
    }

    IPAddress stored(
        EEPROM.read(EEPROM_BASE + 3),
        EEPROM.read(EEPROM_BASE + 4),
        EEPROM.read(EEPROM_BASE + 5),
        EEPROM.read(EEPROM_BASE + 6));

    if (EEPROM.read(EEPROM_BASE + 7) != nodalisChecksum(stored))
    {
        return false;
    }

    ip = stored;
    return true;
}

bool nodalisWriteStoredIp(const IPAddress &ip)
{
    EEPROM.update(EEPROM_BASE, EEPROM_MAGIC_0);
    EEPROM.update(EEPROM_BASE + 1, EEPROM_MAGIC_1);
    EEPROM.update(EEPROM_BASE + 2, EEPROM_VERSION);
    EEPROM.update(EEPROM_BASE + 3, ip[0]);
    EEPROM.update(EEPROM_BASE + 4, ip[1]);
    EEPROM.update(EEPROM_BASE + 5, ip[2]);
    EEPROM.update(EEPROM_BASE + 6, ip[3]);
    EEPROM.update(EEPROM_BASE + 7, nodalisChecksum(ip));
    return true;
}
#endif

void nodalisProcessSerialCommand(String command, IPAddress &currentIp)
{
    command = nodalisNormalizeCommand(command);
    if (command.length() == 0)
    {
        return;
    }

    String upper = command;
    upper.toUpperCase();

    if (nodalisHandleBitCommand(command, upper))
    {
        return;
    }

    if (upper == "HELP" || upper == "IP HELP")
    {
        nodalisPrintNetworkConfigHelp();
        return;
    }

    if (upper == "IP?" || upper == "SHOW IP")
    {
        nodalisPrintCurrentIp(currentIp);
        return;
    }

    String ipText = command;
    if (upper.startsWith("SETIP "))
    {
        ipText = command.substring(6);
        ipText.trim();
    }
    else if (upper.startsWith("IP "))
    {
        ipText = command.substring(3);
        ipText.trim();
    }

    IPAddress newIp;
    if (!nodalisParseIpString(ipText, newIp))
    {
        Serial.println("Invalid IP. Use SETIP a.b.c.d or IP?");
        return;
    }

    const bool ipChanged = !(newIp == currentIp);
    currentIp = newIp;
#if NODALIS_HAS_KVSTORE || NODALIS_HAS_EEPROM
    if (nodalisWriteStoredIp(currentIp))
    {
        Serial.println(ipChanged ? "Stored new IP address." : "Stored current IP address.");
    }
    else
    {
        Serial.println("Failed to store IP address.");
    }
#else
    Serial.println(ipChanged ? "Persistent storage not available. IP will reset on reboot." : "IP address unchanged and persistent storage not available.");
#endif
    Serial.println(ipChanged ? "Applying IP address..." : "IP address unchanged.");
    nodalisBeginEthernet(currentIp);
    nodalisPrintCurrentIp(currentIp);
}
} // namespace

IPAddress nodalisDefaultIpAddress()
{
    return IPAddress(192, 168, 1, 15);
}

IPAddress nodalisLoadIpAddress()
{
    IPAddress ip = nodalisDefaultIpAddress();
#if NODALIS_HAS_KVSTORE || NODALIS_HAS_EEPROM
    IPAddress stored;
    if (nodalisReadStoredIp(stored))
    {
        ip = stored;
    }
#endif
    return ip;
}

void nodalisBeginEthernet(const IPAddress &ip)
{
#if defined(ARDUINO_ARCH_MBED)
    Ethernet.begin(ip);
#else
    Ethernet.begin(const_cast<uint8_t *>(DEFAULT_MAC), ip);
#endif
}

void nodalisPrintCurrentIp(const IPAddress &ip)
{
    Serial.print("Ethernet IP: ");
    Serial.println(ip);
}

void nodalisPrintNetworkConfigHelp()
{
    Serial.println("Serial commands: HELP, IP?, SETIP a.b.c.d, MAPS, READBIT %IX0.0, WRITEBIT %IX0.0 1");
}

void nodalisPollSerialIpConfig(IPAddress &currentIp)
{
    while (Serial.available() > 0)
    {
        const char ch = static_cast<char>(Serial.read());
        if (ch == '\r')
        {
            continue;
        }

        if (ch == '\n')
        {
            nodalisProcessSerialCommand(serialBuffer, currentIp);
            serialBuffer = "";
            continue;
        }

        if (isPrintable(static_cast<unsigned char>(ch)))
        {
            if (serialBuffer.length() < SERIAL_BUFFER_LIMIT)
            {
                serialBuffer += ch;
            }
            else
            {
                serialBuffer = "";
                Serial.println("Command too long.");
            }
        }
    }
}

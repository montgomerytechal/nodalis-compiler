#include "bacnet.h"
#include <algorithm>
#include <array>
#include <cctype>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <cstdlib>
#include <chrono>
#include <optional>
#include <vector>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
#else
#include <ifaddrs.h>

#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#endif

namespace {
    constexpr size_t PDU_BUFFER_SIZE = MAX_APDU + 64;

    std::string normalizeKey(const std::string& input) {
        std::string normalized;
        normalized.reserve(input.size());
        for (char ch : input) {
            if (std::isalnum(static_cast<unsigned char>(ch))) {
                normalized.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(ch))));
            }
        }
        return normalized;
    }

    template<typename T>
    bool extractNumber(const json& data, const std::string& key, T& value) {
        if (!data.contains(key)) {
            return false;
        }
        const json& token = data.at(key);
        if (token.is_string()) {
            value = static_cast<T>(std::stoll(token.get<std::string>()));
            return true;
        }
        if (token.is_number_integer()) {
            value = static_cast<T>(token.get<int64_t>());
            return true;
        }
        if (token.is_number_unsigned()) {
            value = static_cast<T>(token.get<uint64_t>());
            return true;
        }
        return false;
    }

    std::optional<std::string> extractString(const json& data, const std::string& key) {
        if (!data.contains(key)) {
            return std::nullopt;
        }
        const json& token = data.at(key);
        if (token.is_string()) {
            return token.get<std::string>();
        }
        if (token.is_number()) {
            return std::to_string(token.get<int64_t>());
        }
        return std::nullopt;
    }
}
static const char *pdu_type_name(uint8_t pduType)
{
    switch (pduType)
    {
    case PDU_TYPE_SIMPLE_ACK:
        return "SIMPLE_ACK";
    case PDU_TYPE_COMPLEX_ACK:
        return "COMPLEX_ACK";
    case PDU_TYPE_ERROR:
        return "ERROR";
    case PDU_TYPE_REJECT:
        return "REJECT";
    case PDU_TYPE_ABORT:
        return "ABORT";
    case PDU_TYPE_CONFIRMED_SERVICE_REQUEST:
        return "CONFIRMED_REQ";
    case PDU_TYPE_UNCONFIRMED_SERVICE_REQUEST:
        return "UNCONFIRMED_REQ";
    default:
        return "OTHER";
    }
}

// Best-effort decode of BACnet Error PDU's error-class and error-code.
// Works with common bacnet-stack decode signatures that are non-const.
static bool decode_error_class_code(
    const uint8_t *apdu, int apduLen, int offset,
    uint32_t &errClass, uint32_t &errCode)
{
    errClass = 0;
    errCode = 0;

    if (!apdu || apduLen <= offset)
        return false;

    const uint8_t *p = apdu + offset;
    int len = apduLen - offset;

    uint8_t tag_number = 0;
    uint32_t len_value_type = 0;

    // context tag 0 (error-class)
    int lvt = decode_tag_number_and_value(const_cast<uint8_t *>(p), &tag_number, &len_value_type);
    if (lvt <= 0 || tag_number != 0)
        return false;
    p += lvt;
    len -= lvt;
    if (len <= 0)
        return false;

    int used = decode_enumerated(const_cast<uint8_t *>(p), len, &errClass);
    if (used <= 0)
        return false;
    p += used;
    len -= used;

    // context tag 1 (error-code)
    lvt = decode_tag_number_and_value(const_cast<uint8_t *>(p), &tag_number, &len_value_type);
    if (lvt <= 0 || tag_number != 1)
        return false;
    p += lvt;
    len -= lvt;
    if (len <= 0)
        return false;

    used = decode_enumerated(const_cast<uint8_t *>(p), len, &errCode);
    if (used <= 0)
        return false;

    return true;
}

// Small hex dump helper for debugging
static void dump_hex(const uint8_t *b, int n)
{
    for (int i = 0; i < n; i++)
        std::printf("%02X ", b[i]);
    std::printf("\n");
}

BACNETClient::BACNETClient(const std::string& ip, uint16_t port)
    : IOClient("BACNET"), remoteIp(ip), remotePort(port == 0 ? 0xBAC0 : port) {
}

BACNETClient::~BACNETClient() {
    if (datalinkReady) {
        datalink_cleanup();
#ifdef _WIN32
        WSACleanup();
#endif
    }
}

void BACNETClient::connect() {
    if (connected) {
        return;
    }

    if (remoteIp.empty() && !mappings.empty()) {
        remoteIp = mappings[0].moduleID;
    }
    if (remotePort == 0 && !mappings.empty()) {
        remotePort = static_cast<uint16_t>(std::strtoul(mappings[0].modulePort.c_str(), nullptr, 10));
    }
    if (remotePort == 0) {
        remotePort = 0xBAC0;
    }

    if (remoteIp.empty()) {
        return;
    }
    std::cout << "BACNET-IP attempting to connect to " << remoteIp.c_str() << ":" << remotePort << "\n";

    connected = ensureDatalink();
    if (connected)
    {
        std::cout << "BACNET-IP successfully connected to " << remoteIp.c_str() << ":" << remotePort << "\n";
    }
    else
    {
        std::cout << "BACNET-IP failed to connect to " << remoteIp.c_str() << ":" << remotePort << "\n";
    }
}

void BACNETClient::onMappingAdded(const IOMap& map) {
    if (!map.modulePort.empty() && remotePort == 0) {
        remotePort = static_cast<uint16_t>(std::strtoul(map.modulePort.c_str(), nullptr, 10));
    }
    if (remoteIp.empty()) {
        remoteIp = map.moduleID;
    }

    BACnetRemotePoint point;
    if (parseRemoteDefinition(map, point)) {
        remoteCache[map.remoteAddress] = point;
        std::cout << "BACNET-IP added map for Instance = " << point.objectInstance << ", Object Type = " << point.objectType << " Property ID = " << point.propertyId << " Value Type = " << point.valueType << "\n";
    }
}

#ifndef _WIN32
static std::string iface_name_for_local_ip(const std::string &localIp)
{
    struct ifaddrs *ifaddr = nullptr;
    if (getifaddrs(&ifaddr) != 0)
    {
        throw std::runtime_error("getifaddrs() failed");
    }

    std::string found;
    for (auto *ifa = ifaddr; ifa != nullptr; ifa = ifa->ifa_next)
    {
        if (!ifa->ifa_addr)
            continue;
        if (ifa->ifa_addr->sa_family != AF_INET)
            continue;

        auto *sa = (sockaddr_in *)ifa->ifa_addr;
        char buf[INET_ADDRSTRLEN] = {0};
        if (!inet_ntop(AF_INET, &sa->sin_addr, buf, sizeof(buf)))
            continue;

        if (localIp == buf)
        {
            found = ifa->ifa_name; // e.g. "en0", "eth0"
            break;
        }
    }

    freeifaddrs(ifaddr);

    if (found.empty())
    {
        throw std::runtime_error("No interface found with IP: " + localIp);
    }
    return found;
}

#endif

static std::string get_local_ip_for_remote(const std::string &remoteIp, uint16_t remotePort)
{
#ifdef _WIN32
    // Make sure Winsock is up (call once globally in your app if you prefer)
    static bool wsaInit = false;
    if (!wsaInit)
    {
        WSADATA wsaData;
        int r = WSAStartup(MAKEWORD(2, 2), &wsaData);
        if (r != 0)
            throw std::runtime_error("WSAStartup failed");
        wsaInit = true;
    }
#endif

    // Create UDP socket
    int sock =
#ifdef _WIN32
        (int)socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
#else
        socket(AF_INET, SOCK_DGRAM, 0);
#endif
    if (sock < 0)
        throw std::runtime_error("socket() failed");

    // Build remote address
    sockaddr_in remote{};
    remote.sin_family = AF_INET;
    remote.sin_port = htons(remotePort);
    if (inet_pton(AF_INET, remoteIp.c_str(), &remote.sin_addr) != 1)
    {
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        throw std::runtime_error("inet_pton() failed for remoteIp: " + remoteIp);
    }

    // "Connect" UDP socket (doesn't send packets; just sets default route/interface)
    if (
#ifdef _WIN32
        connect(sock, (sockaddr *)&remote, sizeof(remote)) == SOCKET_ERROR
#else
        connect(sock, (sockaddr *)&remote, sizeof(remote)) < 0
#endif
    )
    {
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        throw std::runtime_error("connect() failed");
    }

    // Query local address chosen by OS routing
    sockaddr_in local{};
#ifdef _WIN32
    int localLen = sizeof(local);
#else
    socklen_t localLen = sizeof(local);
#endif
    if (
#ifdef _WIN32
        getsockname(sock, (sockaddr *)&local, &localLen) == SOCKET_ERROR
#else
        getsockname(sock, (sockaddr *)&local, &localLen) < 0
#endif
    )
    {
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        throw std::runtime_error("getsockname() failed");
    }

    // Convert local IP to string
    char buf[INET_ADDRSTRLEN] = {0};
    if (!inet_ntop(AF_INET, &local.sin_addr, buf, sizeof(buf)))
    {
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        throw std::runtime_error("inet_ntop() failed");
    }

#ifdef _WIN32
    closesocket(sock);
#else
    close(sock);
#endif

    return std::string(buf);
}

bool BACNETClient::ensureDatalink() {
    if (datalinkReady) {
        return true;
    }
#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        std::cerr << "BACnet: Failed to initialize WinSock\n";
        return false;
    }
#endif
    std::string localIp = get_local_ip_for_remote(remoteIp, 47808);

#ifdef _WIN32
    // Windows bacnet-stack ports commonly accept dotted IP for BACNET_IFACE
    std::string ifaceParam = localIp;
#else
    // BSD/Linux ports commonly expect the interface name (en0/eth0)
    std::string ifaceParam = iface_name_for_local_ip(localIp);
#endif

    char ifname[64];
    std::snprintf(ifname, sizeof(ifname), "%s", ifaceParam.c_str());
    datalink_init(ifname);
    address_init();
    // tsm_init();
    datalinkReady = true;
    return true;
}

BACNET_ADDRESS BACNETClient::buildAddress() const {
    BACNET_ADDRESS dest{};
    dest.net = 0;
    dest.len = 0;
    dest.mac_len = 6;
    dest.mac[4] = static_cast<uint8_t>((remotePort >> 8) & 0xFF);
    dest.mac[5] = static_cast<uint8_t>(remotePort & 0xFF);

    in_addr addr{};
    if (inet_pton(AF_INET, remoteIp.c_str(), &addr) != 1) {
        throw std::runtime_error("Invalid BACnet IP address: " + remoteIp);
    }
    const uint8_t* bytes = reinterpret_cast<const uint8_t*>(&addr.s_addr);
    std::copy(bytes, bytes + 4, dest.mac);
    return dest;
}

uint8_t BACNETClient::nextInvokeId() {
    uint8_t current = invokeId++;
    if (invokeId == 0) {
        invokeId = 1;
    }
    return current;
}

bool BACNETClient::resolveRemote(const std::string& remote, BACnetRemotePoint& point) {
    auto cached = remoteCache.find(remote);
    if (cached != remoteCache.end()) {
        point = cached->second;
        return true;
    }

    for (const auto& map : mappings) {
        if (map.remoteAddress == remote) {
            if (parseRemoteDefinition(map, point)) {
                remoteCache[remote] = point;
                return true;
            }
        }
    }
    return false;
}

bool BACNETClient::parseRemoteDefinition(const IOMap &map, BACnetRemotePoint &point)
{
    json config = nullptr;
    point.objectInstance = static_cast<uint32_t>(std::stoll(map.remoteAddress));
    if (map.additionalProperties.is_string())
    {
        std::cout << "BACNET-IP Additional Properties is a string.\n";
        config = json::parse(map.additionalProperties.get<std::string>());
    }
    else
    {
        config = map.additionalProperties;
        std::cout << "BACNET-IP Additional Properties is an object.\n";
    }

    if (parseJsonRemote(config, point))
    {
        return true;
    }

    return false;
}

bool BACNETClient::parseJsonRemote(const json& config, BACnetRemotePoint& point) {
    auto objectTypeToken = extractString(config, "objectType");
    if (!objectTypeToken) {
        objectTypeToken = extractString(config, "ObjectType");
    }
    if (objectTypeToken) {
        point.objectType = parseObjectType(*objectTypeToken);
    }
    else
    {
        std::cout << "BACNET-IP no object type\n";
        std::cout << config.dump() << "\n";
    }

    uint32_t instance = 0;
    if (extractNumber(config, "objectInstance", instance) ||
        extractNumber(config, "ObjectInstance", instance)) {
        point.objectInstance = instance;
    }

    auto propertyToken = extractString(config, "propertyId");
    if (!propertyToken) {
        propertyToken = extractString(config, "PropertyId");
    }
    if (propertyToken) {
        point.propertyId = parsePropertyId(*propertyToken);
    }
    else
    {
        std::cout << "BACNET-IP no property id\n";
    }

    auto valueTypeToken = extractString(config, "valueType");
    if (!valueTypeToken)
    {
        valueTypeToken = extractString(config, "ValueType");
    }
    if (valueTypeToken)
    {
        point.valueType = parseValueType(*valueTypeToken);
    }
    else
    {
        std::cout << "BACNET-IP no value type\n";
    }

    int32_t arrayIndex = point.arrayIndex;
    if (extractNumber(config, "arrayIndex", arrayIndex) ||
        extractNumber(config, "ArrayIndex", arrayIndex))
    {
        point.arrayIndex = arrayIndex;
    }

    return true;
}

bool BACNETClient::parseStringRemote(const std::string &definition, BACnetRemotePoint &point) const
{
    std::vector<std::string> tokens;
    std::string current;
    for (char ch : definition)
    {
        if (ch == ':' || ch == '|')
        {
            if (!current.empty())
            {
                tokens.push_back(current);
                current.clear();
            }
        }
        else
        {
            current.push_back(ch);
        }
    }
    if (!current.empty())
    {
        tokens.push_back(current);
    }

    if (tokens.size() < 3)
    {
        return false;
    }

    point.objectType = parseObjectType(tokens[0]);
    point.objectInstance = static_cast<uint32_t>(std::stoul(tokens[1]));
    point.propertyId = parsePropertyId(tokens[2]);
    if (tokens.size() > 3)
    {
        point.arrayIndex = static_cast<int32_t>(std::stol(tokens[3]));
    }
    return true;
}

BACNET_OBJECT_TYPE BACNETClient::parseObjectType(const std::string &raw) const
{
    std::cout << "BACNET-IP parsing object type " << raw.c_str() << "\n";
    return static_cast<BACNET_OBJECT_TYPE>(std::stoi(raw));
}

BACNET_PROPERTY_ID BACNETClient::parsePropertyId(const std::string &raw) const
{
    std::cout << "BACNET-IP parsing property id " << raw.c_str() << "\n";
    return static_cast<BACNET_PROPERTY_ID>(std::stoi(raw));
}

uint8_t BACNETClient::parseValueType(const std::string &raw) const
{
    std::cout << "BACNET-IP parsing value type " << raw.c_str() << "\n";
    BACNET_APPLICATION_TAG result = BACNET_APPLICATION_TAG_ENUMERATED;
    if (raw == "i")
    {
        result = BACNET_APPLICATION_TAG_SIGNED_INT;
    }
    else if (raw == "u")
    {
        result = BACNET_APPLICATION_TAG_UNSIGNED_INT;
    }
    else if (raw == "d")
    {
        result = BACNET_APPLICATION_TAG_DOUBLE;
    }
    else if (raw == "b")
    {
        result = BACNET_APPLICATION_TAG_BOOLEAN;
    }
    else if (raw == "f")
    {
        result = BACNET_APPLICATION_TAG_REAL;
    }
    return static_cast<uint8_t>(result);
}

bool BACNETClient::performRead(const BACnetRemotePoint &point, BACNET_APPLICATION_DATA_VALUE &value)
{
    if (!ensureDatalink())
    {
        return false;
    }

    BACNET_ADDRESS dest = buildAddress();
    BACNET_NPDU_DATA npdu;
    npdu_encode_npdu_data(&npdu, true, MESSAGE_PRIORITY_NORMAL);

    BACNET_READ_PROPERTY_DATA request{};
    request.object_type = point.objectType;
    request.object_instance = point.objectInstance;
    request.object_property = point.propertyId;
    request.array_index = point.arrayIndex;

    std::array<uint8_t, PDU_BUFFER_SIZE> buffer{};
    int pduLen = npdu_encode_pdu(buffer.data(), &dest, nullptr, &npdu);
    if (pduLen < 0)
    {
        return false;
    }

    uint8_t invoke = nextInvokeId();
    pduLen += rp_encode_apdu(buffer.data() + pduLen, invoke, &request);

    if (datalink_send_pdu(&dest, &npdu, buffer.data(), pduLen) <= 0)
    {
        return false;
    }

    const auto deadline = std::chrono::steady_clock::now() + REQUEST_TIMEOUT;

    while (std::chrono::steady_clock::now() < deadline)
    {
        BACNET_ADDRESS source{};
        std::array<uint8_t, PDU_BUFFER_SIZE> rx{};
        int received = datalink_receive(&source, rx.data(), rx.size(), 10);
        if (received <= 0)
        {
            continue;
        }

        // ---- NPDU decode (with BVLC fallback) ----
        BACNET_NPDU_DATA rxNpdu{};
        int offset = npdu_decode(rx.data(), nullptr, &source, &rxNpdu);

        // If decode failed and packet looks like BVLC (BACnet/IP), retry after 4-byte BVLC header.
        if (offset < 0 && received >= 4 && rx[0] == 0x81)
        {
            offset = npdu_decode(rx.data() + 4, nullptr, &source, &rxNpdu);
            if (offset >= 0)
            {
                offset += 4; // adjust back to original rx buffer offset
            }
        }

        if (offset < 0)
        {
            continue;
        }

        int apdu_len = received - offset;
        if (apdu_len < 2)
        {
            continue;
        }

        uint8_t *apdu = rx.data() + offset;

        // IMPORTANT: your stack's PDU_TYPE_* constants appear to already be 0x10/0x20/0x30...
        // So compare using (apdu[0] & 0xF0) directly to PDU_TYPE_* (no shifts).
        uint8_t pduType = (apdu[0] & 0xF0);

        // Only these contain invoke id at apdu[1]
        bool hasInvoke = (pduType == PDU_TYPE_SIMPLE_ACK ||
                          pduType == PDU_TYPE_COMPLEX_ACK ||
                          pduType == PDU_TYPE_ERROR ||
                          pduType == PDU_TYPE_REJECT ||
                          pduType == PDU_TYPE_ABORT);

        if (!hasInvoke)
        {
            continue;
        }

        // Must match our invoke id
        if (apdu[1] != invoke)
        {
            continue;
        }

        // ---- Success case: ComplexACK for ReadProperty ----
        if (pduType == PDU_TYPE_COMPLEX_ACK)
        {
            if (apdu_len < 3)
            {
                continue;
            }
            if (apdu[2] != SERVICE_CONFIRMED_READ_PROPERTY)
            {
                continue;
            }

            BACNET_READ_PROPERTY_DATA ack{};
            if (rp_ack_decode_service_request(apdu + 3, apdu_len - 3, &ack) < 0)
            {
                continue;
            }
            if (!ack.application_data || ack.application_data_len <= 0)
            {
                return false;
            }
            if (bacapp_decode_application_data(ack.application_data, ack.application_data_len, &value) < 0)
            {
                return false;
            }
            return true;
        }

        // ---- ERROR / REJECT / ABORT handling (robust) ----

        if (pduType == PDU_TYPE_ERROR)
        {
            uint8_t service = (apdu_len >= 3) ? apdu[2] : 0xFF;
            uint32_t errClass = 0, errCode = 0;
            bool decoded = (apdu_len > 3) && decode_error_class_code(apdu, apdu_len, 3, errClass, errCode);

            std::cout << "BACNET-IP performRead got ERROR for invoke=" << int(invoke)
                      << " service=" << int(service);

            if (decoded)
            {
                std::cout << " errClass=" << errClass << " errCode=" << errCode;
            }
            else
            {
                std::cout << " (could not decode error class/code)";
            }
            std::cout << "\n";

            return false;
        }

        if (pduType == PDU_TYPE_REJECT)
        {
            uint8_t reason = (apdu_len >= 3) ? apdu[2] : 0xFF;
            std::cout << "BACNET-IP performRead got REJECT for invoke=" << int(invoke)
                      << " reason=" << int(reason) << "\n";
            return false;
        }

        if (pduType == PDU_TYPE_ABORT)
        {
            uint8_t reason = (apdu_len >= 3) ? apdu[2] : 0xFF;
            bool server = (apdu[0] & 0x01) != 0;
            std::cout << "BACNET-IP performRead got ABORT for invoke=" << int(invoke)
                      << " reason=" << int(reason)
                      << " server=" << (server ? "true" : "false") << "\n";
            return false;
        }

        // SimpleACK is not expected for ReadProperty; ignore.
    }

    return false;
}

bool BACNETClient::performWrite(const BACnetRemotePoint &point, const BACNET_APPLICATION_DATA_VALUE &value)
{
    if (!ensureDatalink())
    {
        return false;
    }

    BACNET_ADDRESS dest = buildAddress();
    BACNET_NPDU_DATA npdu;
    npdu_encode_npdu_data(&npdu, false, MESSAGE_PRIORITY_NORMAL);

    std::array<uint8_t, PDU_BUFFER_SIZE> buffer{};
    int pduLen = npdu_encode_pdu(buffer.data(), &dest, nullptr, &npdu);
    if (pduLen < 0)
    {
        return false;
    }

    BACNET_WRITE_PROPERTY_DATA request{};
    request.object_type = point.objectType;
    request.object_instance = point.objectInstance;
    request.object_property = point.propertyId;
    request.array_index = point.arrayIndex;
    request.priority = 16;

    std::array<uint8_t, MAX_APDU> app{};
    BACNET_APPLICATION_DATA_VALUE copy = value;
    int appLen = bacapp_encode_application_data(app.data(), &copy);
    if (appLen <= 0)
    {
        return false;
    }
    request.application_data_len = appLen;
    std::memcpy(request.application_data, app.data(),
                static_cast<size_t>(appLen));

    uint8_t invoke = nextInvokeId();
    pduLen += wp_encode_apdu(buffer.data() + pduLen, invoke, &request);

    if (datalink_send_pdu(&dest, &npdu, buffer.data(), pduLen) <= 0)
    {
        return false;
    }

    const auto deadline = std::chrono::steady_clock::now() + REQUEST_TIMEOUT;

    while (std::chrono::steady_clock::now() < deadline)
    {
        BACNET_ADDRESS source{};
        std::array<uint8_t, PDU_BUFFER_SIZE> rx{};
        int received = datalink_receive(&source, rx.data(), rx.size(), 10);
        if (received <= 0)
        {
            continue;
        }

        // std::cout << "RX " << received << " bytes\n";
        // int n = received < 16 ? received : 16;
        // for (int i = 0; i < n; i++)
        // {
        //     printf("%02X ", rx[i]);
        // }
        // printf("\n");

        // ---- NPDU decode (with BVLC fallback) ----
        BACNET_NPDU_DATA rxNpdu{};
        int offset = npdu_decode(rx.data(), nullptr, &source, &rxNpdu);

        // If decode failed and packet looks like BVLC (BACnet/IP), retry after 4-byte BVLC header.
        if (offset < 0 && received >= 4 && rx[0] == 0x81)
        {
            offset = npdu_decode(rx.data() + 4, nullptr, &source, &rxNpdu);
            if (offset >= 0)
            {
                offset += 4; // adjust back to original rx buffer offset
            }
        }

        if (offset < 0)
        {
            continue;
        }

        int apdu_len = received - offset;
        if (apdu_len < 1)
        {
            continue;
        }

        uint8_t *apdu = rx.data() + offset;
        uint8_t pduType = (apdu[0] & 0xF0);

        // std::cout << "offset=" << offset << " apdu_len=" << apdu_len << "\n";
        // if (apdu_len >= 1)
        // {
        //     printf("pduType=0x%02X (%s)\n", pduType, pdu_type_name(pduType));
        // }
        // if (apdu_len >= 2)
        // {
        //     std::cout << "invoke=" << int(apdu[1]) << " (expect " << int(invoke) << ")\n";
        // }
        // if (apdu_len >= 3)
        // {
        //     std::cout << "service=" << int(apdu[2]) << "\n";
        // }

        // Only these response types contain an invoke id at apdu[1]
        bool hasInvoke = (pduType == PDU_TYPE_SIMPLE_ACK ||
                          pduType == PDU_TYPE_COMPLEX_ACK ||
                          pduType == PDU_TYPE_ERROR ||
                          pduType == PDU_TYPE_REJECT ||
                          pduType == PDU_TYPE_ABORT);

        if (!hasInvoke)
        {
            // Not a confirmed-service reply; ignore
            continue;
        }

        if (apdu_len < 2)
        {
            // Should not happen for these types, but be safe
            continue;
        }

        // Must match our invoke id
        if (apdu[1] != invoke)
        {
            continue;
        }

        // ---- Robust response handling ----

        // SUCCESS: SimpleACK for WriteProperty
        if (pduType == PDU_TYPE_SIMPLE_ACK)
        {
            if (apdu_len >= 3 && apdu[2] == SERVICE_CONFIRMED_WRITE_PROPERTY)
            {
                return true;
            }
            // SimpleACK but not for WriteProperty; ignore
            continue;
        }

        // ERROR: device understood but rejected with error class/code
        if (pduType == PDU_TYPE_ERROR)
        {
            uint8_t service = (apdu_len >= 3) ? apdu[2] : 0xFF;
            uint32_t errClass = 0, errCode = 0;
            bool decoded = (apdu_len > 3) && decode_error_class_code(apdu, apdu_len, 3, errClass, errCode);

            std::cout << "BACNET-IP performWrite got ERROR for invoke=" << int(invoke)
                      << " service=" << int(service);

            if (decoded)
            {
                std::cout << " errClass=" << errClass << " errCode=" << errCode;
            }
            else
            {
                std::cout << " (could not decode error class/code)";
            }
            std::cout << "\n";

            return false;
        }

        // REJECT: device rejected request (invalid params, unsupported service, etc.)
        if (pduType == PDU_TYPE_REJECT)
        {
            uint8_t reason = (apdu_len >= 3) ? apdu[2] : 0xFF;
            std::cout << "BACNET-IP performWrite got REJECT for invoke=" << int(invoke)
                      << " reason=" << int(reason) << "\n";
            return false;
        }

        // ABORT: device aborted processing
        if (pduType == PDU_TYPE_ABORT)
        {
            uint8_t reason = (apdu_len >= 3) ? apdu[2] : 0xFF;
            bool server = (apdu[0] & 0x01) != 0; // BACnet: bit0 indicates server abort
            std::cout << "BACNET-IP performWrite got ABORT for invoke=" << int(invoke)
                      << " reason=" << int(reason)
                      << " server=" << (server ? "true" : "false") << "\n";
            return false;
        }

        // COMPLEX_ACK: not expected for WriteProperty; log and keep waiting
        if (pduType == PDU_TYPE_COMPLEX_ACK)
        {
            uint8_t service = (apdu_len >= 3) ? apdu[2] : 0xFF;
            std::cout << "BACNET-IP performWrite got COMPLEX_ACK for invoke=" << int(invoke)
                      << " service=" << int(service) << " (unexpected for WriteProperty)\n";
            continue;
        }

        // Anything else with invoke id: log and keep listening
        std::cout << "BACNET-IP performWrite got " << pdu_type_name(pduType)
                  << " for invoke=" << int(invoke) << " (unhandled)\n";
    }

    std::cout << "BACNET-IP performWrite Did not receive ACK\n";
    return false;
}

bool BACNETClient::readBit(const std::string& remote, int& result) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE value{};
    if (!performRead(point, value)) {
        return false;
    }
    bool decoded = false;
    if (!decodeNumeric(value, decoded)) {
        return false;
    }
    result = decoded ? 1 : 0;
    return true;
}

bool BACNETClient::writeBit(const std::string& remote, int value) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        std::cout << "BACNET-IP writeBit Could not resolve remote " << remote.c_str() << "\n";
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE app{};
    if (!encodeValue(value, point, app))
    {
        std::cout << "BACNET-IP writeBit Could not encode value " << value << "\n";
        return false;
    }
    return performWrite(point, app);
}

bool BACNETClient::readByte(const std::string& remote, uint8_t& result) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE value{};
    if (!performRead(point, value)) {
        return false;
    }
    uint32_t decoded = 0;
    if (!decodeNumeric(value, decoded)) {
        return false;
    }
    result = static_cast<uint8_t>(decoded & 0xFF);
    return true;
}

bool BACNETClient::writeByte(const std::string& remote, uint8_t value) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE app{};
    if (!encodeValue(value, point, app))
    {
        return false;
    }
    return performWrite(point, app);
}

bool BACNETClient::readWord(const std::string& remote, uint16_t& result) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE value{};
    if (!performRead(point, value)) {
        return false;
    }
    uint32_t decoded = 0;
    if (!decodeNumeric(value, decoded)) {
        return false;
    }
    result = static_cast<uint16_t>(decoded & 0xFFFF);
    return true;
}

bool BACNETClient::writeWord(const std::string& remote, uint16_t value) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE app{};
    if (!encodeValue(value, point, app))
    {
        return false;
    }
    return performWrite(point, app);
}

bool BACNETClient::readDWord(const std::string& remote, uint32_t& result) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE value{};
    if (!performRead(point, value)) {
        return false;
    }
    uint32_t decoded = 0;
    if (!decodeNumeric(value, decoded)) {
        return false;
    }
    result = decoded;
    return true;
}

bool BACNETClient::writeDWord(const std::string& remote, uint32_t value) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE app{};
    if (!encodeValue(value, point, app))
    {
        return false;
    }
    return performWrite(point, app);
}

bool BACNETClient::readLWord(const std::string& remote, uint64_t& result) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE value{};
    if (!performRead(point, value)) {
        return false;
    }
    uint64_t decoded = 0;
    if (!decodeNumeric(value, decoded)) {
        return false;
    }
    result = decoded;
    return true;
}

bool BACNETClient::writeLWord(const std::string& remote, uint64_t value) {
    BACnetRemotePoint point;
    if (!resolveRemote(remote, point)) {
        return false;
    }
    BACNET_APPLICATION_DATA_VALUE app{};
    if (!encodeValue(value, point, app))
    {
        return false;
    }
    return performWrite(point, app);
}

bool BACNETClient::encodeValue(uint64_t raw, BACnetRemotePoint point, BACNET_APPLICATION_DATA_VALUE &value)
{
    value.tag = point.valueType;
    switch (point.valueType)
    {
    case BACNET_APPLICATION_TAG_ENUMERATED:
        value.type.Enumerated = static_cast<uint32_t>(raw & 0xFFFFFFFF);
        return true;
    case BACNET_APPLICATION_TAG_REAL:
        value.type.Real = static_cast<float>(uint64_to_double(raw));
        return true;
    case BACNET_APPLICATION_TAG_UNSIGNED_INT:
        value.type.Unsigned_Int = static_cast<uint32_t>(raw & 0xFFFFFFFF);
        return true;
    case BACNET_APPLICATION_TAG_SIGNED_INT:
        value.type.Signed_Int = static_cast<int32_t>(raw & 0xFFFFFFFF);
        return true;
    case BACNET_APPLICATION_TAG_DOUBLE:
        value.type.Double = static_cast<double>(uint64_to_double(raw));
        return true;
    case BACNET_APPLICATION_TAG_BOOLEAN:
        value.type.Boolean = raw > 0;
        return true;
    default:
        return false;
    }
}

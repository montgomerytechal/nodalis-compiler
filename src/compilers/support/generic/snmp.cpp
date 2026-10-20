// Copyright [2026] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "snmp.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <sstream>

namespace {
std::string trim(std::string value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return {};
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(),
        [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}

const json* property(const json& object, const std::string& name) {
    if (!object.is_object()) return nullptr;
    const std::string wanted = lower(name);
    for (auto it = object.begin(); it != object.end(); ++it) {
        if (lower(it.key()) == wanted) return &it.value();
    }
    return nullptr;
}

json normalizeProperties(const json& input) {
    if (input.is_object()) return input;
    if (input.is_string()) {
        try { return json::parse(input.get<std::string>()); }
        catch (...) {}
    }
    return json::object();
}
}

SNMPClient::SNMPClient() : IOClient("SNMP") {
    static bool initialized = false;
    if (!initialized) {
        SOCK_STARTUP;
        init_snmp("nodalis");
        initialized = true;
    }
}

SNMPClient::~SNMPClient() {
    for (auto& entry : points) {
        if (entry.second.session) snmp_sess_close(entry.second.session);
    }
}

void SNMPClient::onMappingAdded(const IOMap& map) {
    PointConfig config;
    const json properties = normalizeProperties(map.additionalProperties);
    if (const json* value = property(properties, "community")) {
        if (value->is_string() && !value->get<std::string>().empty())
            config.community = value->get<std::string>();
    }
    if (const json* value = property(properties, "version")) {
        const std::string version = lower(value->is_string() ? value->get<std::string>() : value->dump());
        config.ping = version == "ping";
        if (!config.ping) {
            config.version = (version == "1" || version == "v1" || version == "snmpv1")
                ? SNMP_VERSION_1 : SNMP_VERSION_2c;
        }
    }
    if (const json* value = property(properties, "onconditions")) {
        const std::string conditions = value->is_string() ? value->get<std::string>() : value->dump();
        std::stringstream stream(conditions);
        std::string condition;
        while (std::getline(stream, condition, ',')) {
            condition = lower(trim(condition));
            if (!condition.empty()) config.onConditions.insert(condition);
        }
    }
    points[map.remoteAddress] = std::move(config);
}

SNMPClient::PointConfig& SNMPClient::configFor(const std::string& remote) {
    return points[remote];
}

bool SNMPClient::openSession(PointConfig& config) {
    if (config.ping) return true;
    if (config.session) return true;
    netsnmp_session session{};
    snmp_sess_init(&session);
    std::string peer = moduleID;
    if (!mappings.empty() && !mappings.front().modulePort.empty() && mappings.front().modulePort != "161") {
        peer += ":" + mappings.front().modulePort;
    }
    session.peername = const_cast<char*>(peer.c_str());
    session.version = config.version;
    session.community = reinterpret_cast<u_char*>(const_cast<char*>(config.community.c_str()));
    session.community_len = config.community.size();
    session.timeout = 3000000L;
    session.retries = 1;
    config.session = snmp_sess_open(&session);
    if (!config.session) {
        snmp_sess_perror("SNMP session", &session);
        return false;
    }
    return true;
}

void SNMPClient::connect() {
    connected = !points.empty();
    for (auto& entry : points) connected = openSession(entry.second) && connected;
}

bool SNMPClient::readPing(const std::string& remote, uint64_t& result) {
    PointConfig& config = configFor(remote);
    if (!config.ping) return false;

    // Only address characters are accepted before invoking the platform ping
    // utility. This keeps the command safe and deliberately excludes options.
    if (moduleID.empty() || !std::all_of(moduleID.begin(), moduleID.end(), [](unsigned char c) {
        return std::isalnum(c) || c == '.' || c == ':' || c == '-' || c == '_';
    })) {
        result = 0;
        return true;
    }

#if defined(_WIN32)
    const std::string command = "ping -n 1 -w 500 " + moduleID + " >NUL 2>&1";
#elif defined(__APPLE__)
    const std::string command = "ping -c 1 -W 500 " + moduleID + " >/dev/null 2>&1";
#else
    const std::string command = "ping -c 1 -W 1 " + moduleID + " >/dev/null 2>&1";
#endif
    result = std::system(command.c_str()) == 0 ? 1 : 0;
    return true;
}

bool SNMPClient::parseOid(const std::string& text, std::vector<oid>& result) const {
    result.clear();
    std::string value = trim(text);
    if (!value.empty() && value.front() == '.') value.erase(value.begin());
    if (value.empty()) return false;
    std::stringstream stream(value);
    std::string component;
    while (std::getline(stream, component, '.')) {
        if (component.empty() || !std::all_of(component.begin(), component.end(),
            [](unsigned char c) { return std::isdigit(c); })) return false;
        try {
            const unsigned long long number = std::stoull(component);
            if (number > std::numeric_limits<oid>::max()) return false;
            result.push_back(static_cast<oid>(number));
        } catch (...) { return false; }
    }
    return result.size() >= 2;
}

bool SNMPClient::getValue(const std::string& remote, Value& result) {
    PointConfig& config = configFor(remote);
    if (!openSession(config)) { connected = false; return false; }
    std::vector<oid> objectId;
    if (!parseOid(remote, objectId)) {
        std::cerr << "Invalid numeric SNMP OID: " << remote << '\n';
        return false;
    }
    netsnmp_pdu* request = snmp_pdu_create(SNMP_MSG_GET);
    snmp_add_null_var(request, objectId.data(), objectId.size());
    netsnmp_pdu* response = nullptr;
    const int status = snmp_sess_synch_response(config.session, request, &response);
    bool success = false;
    if (status == STAT_SUCCESS && response && response->errstat == SNMP_ERR_NOERROR && response->variables) {
        const netsnmp_variable_list* variable = response->variables;
        result = {};
        result.type = variable->type;
        if ((variable->type == ASN_INTEGER || variable->type == ASN_BOOLEAN) && variable->val.integer) {
            result.signedValue = *variable->val.integer;
            success = true;
        } else if ((variable->type == ASN_COUNTER || variable->type == ASN_GAUGE ||
                    variable->type == ASN_TIMETICKS || variable->type == ASN_UINTEGER) && variable->val.integer) {
            result.unsignedValue = static_cast<unsigned long>(*variable->val.integer);
            success = true;
        } else if (variable->type == ASN_COUNTER64 && variable->val.counter64) {
            result.unsignedValue = (static_cast<uint64_t>(variable->val.counter64->high) << 32) |
                                   variable->val.counter64->low;
            success = true;
        } else if (variable->type == ASN_OCTET_STR && variable->val.string) {
            result.bytes.assign(variable->val.string, variable->val.string + variable->val_len);
            success = true;
        }
    }
    if (response) snmp_free_pdu(response);
    return success;
}

bool SNMPClient::valueAsUnsigned(const Value& value, uint64_t& result) const {
    if (value.type == ASN_INTEGER || value.type == ASN_BOOLEAN) {
        if (value.signedValue < 0) return false;
        result = static_cast<uint64_t>(value.signedValue);
        return true;
    }
    if (value.type == ASN_COUNTER || value.type == ASN_GAUGE || value.type == ASN_TIMETICKS ||
        value.type == ASN_UINTEGER || value.type == ASN_COUNTER64) {
        result = value.unsignedValue;
        return true;
    }
    if (value.type == ASN_OCTET_STR) {
        try {
            const std::string text(value.bytes.begin(), value.bytes.end());
            size_t used = 0;
            result = std::stoull(trim(text), &used, 10);
            return used == trim(text).size();
        } catch (...) { return false; }
    }
    return false;
}

std::string SNMPClient::valueAsString(const Value& value) const {
    if (value.type == ASN_INTEGER || value.type == ASN_BOOLEAN) return std::to_string(value.signedValue);
    if (value.type == ASN_COUNTER || value.type == ASN_GAUGE || value.type == ASN_TIMETICKS ||
        value.type == ASN_UINTEGER || value.type == ASN_COUNTER64) return std::to_string(value.unsignedValue);
    if (value.type == ASN_OCTET_STR) return std::string(value.bytes.begin(), value.bytes.end());
    return {};
}

bool SNMPClient::setValue(const std::string& remote, uint64_t value) {
    PointConfig& config = configFor(remote);
    if (config.ping) return false;
    Value current;
    if (!getValue(remote, current)) return false;
    std::vector<oid> objectId;
    if (!parseOid(remote, objectId)) return false;
    netsnmp_pdu* request = snmp_pdu_create(SNMP_MSG_SET);
    if (current.type == ASN_INTEGER || current.type == ASN_BOOLEAN) {
        const long converted = static_cast<long>(value);
        snmp_pdu_add_variable(request, objectId.data(), objectId.size(), current.type, &converted, sizeof(converted));
    } else if (current.type == ASN_COUNTER64) {
        counter64 converted{static_cast<u_long>(value >> 32), static_cast<u_long>(value & 0xffffffffULL)};
        snmp_pdu_add_variable(request, objectId.data(), objectId.size(), current.type, &converted, sizeof(converted));
    } else if (current.type == ASN_COUNTER || current.type == ASN_GAUGE ||
               current.type == ASN_TIMETICKS || current.type == ASN_UINTEGER) {
        const u_long converted = static_cast<u_long>(value);
        snmp_pdu_add_variable(request, objectId.data(), objectId.size(), current.type, &converted, sizeof(converted));
    } else if (current.type == ASN_OCTET_STR) {
        const std::string converted = std::to_string(value);
        snmp_pdu_add_variable(request, objectId.data(), objectId.size(), current.type, converted.data(), converted.size());
    } else {
        snmp_free_pdu(request);
        return false;
    }
    netsnmp_pdu* response = nullptr;
    const int status = snmp_sess_synch_response(config.session, request, &response);
    const bool success = status == STAT_SUCCESS && response && response->errstat == SNMP_ERR_NOERROR;
    if (response) snmp_free_pdu(response);
    return success;
}

bool SNMPClient::readBit(const std::string& remote, int& result) {
    uint64_t pingResult = 0;
    if (configFor(remote).ping) {
        const bool success = readPing(remote, pingResult);
        result = pingResult != 0 ? 1 : 0;
        return success;
    }
    Value value;
    if (!getValue(remote, value)) return false;
    const auto& conditions = configFor(remote).onConditions;
    if (!conditions.empty()) result = conditions.count(lower(trim(valueAsString(value)))) ? 1 : 0;
    else {
        uint64_t number = 0;
        if (valueAsUnsigned(value, number)) result = number != 0;
        else {
            const std::string text = lower(trim(valueAsString(value)));
            result = (text == "true" || text == "on" || text == "yes") ? 1 : 0;
        }
    }
    return true;
}

bool SNMPClient::writeBit(const std::string& remote, int value) { return setValue(remote, value ? 1 : 0); }
bool SNMPClient::readByte(const std::string& remote, uint8_t& result) { uint64_t v; if (!readLWord(remote, v) || v > UINT8_MAX) return false; result = static_cast<uint8_t>(v); return true; }
bool SNMPClient::writeByte(const std::string& remote, uint8_t value) { return setValue(remote, value); }
bool SNMPClient::readWord(const std::string& remote, uint16_t& result) { uint64_t v; if (!readLWord(remote, v) || v > UINT16_MAX) return false; result = static_cast<uint16_t>(v); return true; }
bool SNMPClient::writeWord(const std::string& remote, uint16_t value) { return setValue(remote, value); }
bool SNMPClient::readDWord(const std::string& remote, uint32_t& result) { uint64_t v; if (!readLWord(remote, v) || v > UINT32_MAX) return false; result = static_cast<uint32_t>(v); return true; }
bool SNMPClient::writeDWord(const std::string& remote, uint32_t value) { return setValue(remote, value); }
bool SNMPClient::readLWord(const std::string& remote, uint64_t& result) {
    if (configFor(remote).ping) return readPing(remote, result);
    Value value;
    return getValue(remote, value) && valueAsUnsigned(value, result);
}
bool SNMPClient::writeLWord(const std::string& remote, uint64_t value) { return setValue(remote, value); }

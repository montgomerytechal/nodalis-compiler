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

#pragma once

#include "nodalis.h"

#include <cstdint>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

extern "C" {
#include <net-snmp/net-snmp-config.h>
#include <net-snmp/net-snmp-includes.h>
}

class SNMPClient : public IOClient {
public:
    SNMPClient();
    ~SNMPClient() override;

protected:
    bool readBit(const std::string& remote, int& result) override;
    bool writeBit(const std::string& remote, int value) override;
    bool readByte(const std::string& remote, uint8_t& result) override;
    bool writeByte(const std::string& remote, uint8_t value) override;
    bool readWord(const std::string& remote, uint16_t& result) override;
    bool writeWord(const std::string& remote, uint16_t value) override;
    bool readDWord(const std::string& remote, uint32_t& result) override;
    bool writeDWord(const std::string& remote, uint32_t value) override;
    bool readLWord(const std::string& remote, uint64_t& result) override;
    bool writeLWord(const std::string& remote, uint64_t value) override;
    void connect() override;
    void onMappingAdded(const IOMap& map) override;

private:
    struct PointConfig {
        std::string community = "public";
        long version = SNMP_VERSION_2c;
        bool ping = false;
        std::unordered_set<std::string> onConditions;
        void* session = nullptr;
    };

    struct Value {
        u_char type = ASN_NULL;
        int64_t signedValue = 0;
        uint64_t unsignedValue = 0;
        std::vector<uint8_t> bytes;
    };

    std::unordered_map<std::string, PointConfig> points;

    PointConfig& configFor(const std::string& remote);
    bool openSession(PointConfig& config);
    bool parseOid(const std::string& text, std::vector<oid>& result) const;
    bool getValue(const std::string& remote, Value& result);
    bool setValue(const std::string& remote, uint64_t value);
    bool readPing(const std::string& remote, uint64_t& result);
    bool valueAsUnsigned(const Value& value, uint64_t& result) const;
    std::string valueAsString(const Value& value) const;
};

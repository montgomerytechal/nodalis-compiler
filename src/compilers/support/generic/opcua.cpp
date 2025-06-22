#include "opcua.h"
#include <iostream>

OPCUAClient::OPCUAClient()
    : IOClient("opcua"), endpointUrl("opc.tcp://localhost:4840") {
    client = UA_Client_new();
    UA_ClientConfig_setDefault(UA_Client_getConfig(client));
}

OPCUAClient::~OPCUAClient() {
    UA_Client_disconnect(client);
    UA_Client_delete(client);
}

void OPCUAClient::connect() {
    if (!connected) {
        if (UA_Client_connect(client, moduleID.c_str()) == UA_STATUSCODE_GOOD) {
            connected = true;
        } else {
            connected = false;
        }
    }
}

template<typename T>
bool OPCUAClient::readValue(const std::string& nodeIdStr, T& value, const UA_DataType* type) {
    UA_Variant val;
    UA_Variant_init(&val);

    UA_NodeId nodeId = UA_NODEID_STRING_ALLOC(1, nodeIdStr.c_str());
    UA_StatusCode status = UA_Client_readValueAttribute(client, nodeId, &val);
    UA_NodeId_clear(&nodeId);

    if (status == UA_STATUSCODE_GOOD && UA_Variant_hasScalarType(&val, type)) {
        value = *(T*)val.data;
        return true;
    }
    return false;
}

template<typename T>
bool OPCUAClient::writeValue(const std::string& nodeIdStr, T value, const UA_DataType* type) {
    UA_Variant val;
    UA_Variant_setScalar(&val, &value, type);

    UA_NodeId nodeId = UA_NODEID_STRING_ALLOC(1, nodeIdStr.c_str());
    UA_StatusCode status = UA_Client_writeValueAttribute(client, nodeId, &val);
    UA_NodeId_clear(&nodeId);

    return status == UA_STATUSCODE_GOOD;
}

// Implement required IOClient methods

bool OPCUAClient::readBit(const std::string& remote, int& result) {
    bool val;
    bool success = readValue(remote, val, &UA_TYPES[UA_TYPES_BOOLEAN]);
    result = val;
    return success;
}

bool OPCUAClient::writeBit(const std::string& remote, int value) {
    bool val = value != 0;
    return writeValue(remote, val, &UA_TYPES[UA_TYPES_BOOLEAN]);
}

bool OPCUAClient::readByte(const std::string& remote, uint8_t& result) {
    return readValue(remote, result, &UA_TYPES[UA_TYPES_BYTE]);
}

bool OPCUAClient::writeByte(const std::string& remote, uint8_t value) {
    return writeValue(remote, value, &UA_TYPES[UA_TYPES_BYTE]);
}

bool OPCUAClient::readWord(const std::string& remote, uint16_t& result) {
    return readValue(remote, result, &UA_TYPES[UA_TYPES_UINT16]);
}

bool OPCUAClient::writeWord(const std::string& remote, uint16_t value) {
    return writeValue(remote, value, &UA_TYPES[UA_TYPES_UINT16]);
}

bool OPCUAClient::readDWord(const std::string& remote, uint32_t& result) {
    return readValue(remote, result, &UA_TYPES[UA_TYPES_UINT32]);
}

bool OPCUAClient::writeDWord(const std::string& remote, uint32_t value) {
    return writeValue(remote, value, &UA_TYPES[UA_TYPES_UINT32]);
}

static UA_StatusCode staticRead(UA_Server*, const UA_NodeId*, void*, const UA_NodeId*, void* nodeContext,
                                UA_Boolean, const UA_NumericRange*, UA_DataValue* dataValue) {
    auto* addr = static_cast<std::string*>(nodeContext);
    UA_StatusCode res = UA_STATUSCODE_BAD;
    if(addr->find('.') != std::string::npos){
        bool bval = readBit(*addr);
        UA_Variant_setScalarCopy(&dataValue->value, &bval, &UA_TYPES[UA_TYPES_BOOLEAN]);
        dataValue->hasValue = true;
        res = UA_STATUSCODE_GOOD;
    }
    else{
        char size = addr->c_str()[2];
        uint8_t byval;
        uint16_t wval;
        uint32_t dval;
        switch(size){
            case 'X':
                byval = readByte(*addr);
                UA_Variant_setScalarCopy(&dataValue->value, &byval, &UA_TYPES[UA_TYPES_BYTE]);
                dataValue->hasValue = true;
                res = UA_STATUSCODE_GOOD;
                break;
            case 'W':
                wval = readWord(*addr);
                UA_Variant_setScalarCopy(&dataValue->value, &wval, &UA_TYPES[UA_TYPES_UINT16]);
                dataValue->hasValue = true;
                res = UA_STATUSCODE_GOOD;
                break;
            case 'D':
                dval = readDWord(*addr);
                UA_Variant_setScalarCopy(&dataValue->value, &dval, &UA_TYPES[UA_TYPES_UINT32]);
                dataValue->hasValue = true;
                res = UA_STATUSCODE_GOOD;
                break;
        }
    }
    
    return res;
}

static UA_StatusCode staticWrite(UA_Server*, const UA_NodeId*, void*, const UA_NodeId*, void* nodeContext,
                                 const UA_NumericRange*, const UA_DataValue* dataValue) {
    auto* addr = static_cast<std::string*>(nodeContext);
    if (UA_Variant_hasScalarType(&dataValue->value, &UA_TYPES[UA_TYPES_UINT16])) {
        uint16_t value = *(uint16_t*)dataValue->value.data;
        writeWord(*addr, value);
        return UA_STATUSCODE_GOOD;
    }
    else if (UA_Variant_hasScalarType(&dataValue->value, &UA_TYPES[UA_TYPES_UINT32])) {
        uint32_t value = *(uint32_t*)dataValue->value.data;
        writeDWord(*addr, value);
        return UA_STATUSCODE_GOOD;
    }
    else if (UA_Variant_hasScalarType(&dataValue->value, &UA_TYPES[UA_TYPES_BYTE])) {
        uint8_t value = *(uint8_t*)dataValue->value.data;
        writeByte(*addr, value);
        return UA_STATUSCODE_GOOD;
    }
    else if (UA_Variant_hasScalarType(&dataValue->value, &UA_TYPES[UA_TYPES_BOOLEAN])) {
        bool value = *(bool*)dataValue->value.data;
        writeBit(*addr, value);
        return UA_STATUSCODE_GOOD;
    }
    return UA_STATUSCODE_BADTYPEMISMATCH;
}

OPCUAServer::OPCUAServer() {
    server = UA_Server_new();
    UA_ServerConfig* config = UA_Server_getConfig(server);

    // Initialize config (minimal or default)
    UA_ServerConfig_setDefault(config);  // or UA_ServerConfig_setMinimal(config, 4840, NULL);

    // Now change endpoint URL(s)
    for (size_t i = 0; i < config->endpointsSize; ++i) {
        UA_EndpointDescription* endpoint = &config->endpoints[i];

        UA_String_clear(&endpoint->endpointUrl);
        endpoint->endpointUrl = UA_STRING_ALLOC("opc.tcp://0.0.0.0:4840");
    }
    running = false;
}

OPCUAServer::~OPCUAServer() {
    stop();
    UA_Server_delete(server);
}

void OPCUAServer::start() {
    if (!running) {
        running = true;
        serverThread = std::thread(&OPCUAServer::run, this);
    }
}

void OPCUAServer::stop() {
    if (running) {
        running = false;
        UA_Server_run_shutdown(server);
        if (serverThread.joinable())
            serverThread.join();
    }
}

void OPCUAServer::run() {
    UA_Server_run(server, (const volatile UA_Boolean*)&running);
}

void OPCUAServer::mapVariable(std::string varname, std::string addr){
    auto* addrStr = new std::string(addr.c_str());

    UA_DataSource ds;
    ds.read = staticRead;
    ds.write = staticWrite;
    char* lang = (char*)malloc(6);
    strcpy(lang, "en-US");
    UA_VariableAttributes attr = UA_VariableAttributes_default;
    attr.displayName = UA_LOCALIZEDTEXT(lang,(char*) varname.c_str());
    attr.accessLevel = UA_ACCESSLEVELMASK_READ | UA_ACCESSLEVELMASK_WRITE;
    if(addr.find('.') != std::string::npos){
        UA_Server_addDataSourceVariableNode(
            server,
            UA_NODEID_STRING(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_OBJECTSFOLDER),
            UA_NODEID_NUMERIC(0, UA_NS0ID_ORGANIZES),
            UA_QUALIFIEDNAME(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_BASEDATAVARIABLETYPE),
            attr,
            ds,
            addrStr,  // pass the address as a string*
            nullptr
        );
    }
    else if(addr.c_str()[2] == 'X'){
        UA_Server_addDataSourceVariableNode(
            server,
            UA_NODEID_STRING(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_OBJECTSFOLDER),
            UA_NODEID_NUMERIC(0, UA_NS0ID_ORGANIZES),
            UA_QUALIFIEDNAME(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_BASEDATAVARIABLETYPE),
            attr,
            ds,
            addrStr,  // pass the address as a string*
            nullptr
        );
    }
    else if(addr.c_str()[2] == 'W'){
        UA_Server_addDataSourceVariableNode(
            server,
            UA_NODEID_STRING(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_OBJECTSFOLDER),
            UA_NODEID_NUMERIC(0, UA_NS0ID_ORGANIZES),
            UA_QUALIFIEDNAME(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_BASEDATAVARIABLETYPE),
            attr,
            ds,
            addrStr,  // pass the address as a string*
            nullptr
        );
    }
    else if(addr.c_str()[2] == 'D'){
        UA_Server_addDataSourceVariableNode(
            server,
            UA_NODEID_STRING(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_OBJECTSFOLDER),
            UA_NODEID_NUMERIC(0, UA_NS0ID_ORGANIZES),
            UA_QUALIFIEDNAME(1, (char*)varname.c_str()),
            UA_NODEID_NUMERIC(0, UA_NS0ID_BASEDATAVARIABLETYPE),
            attr,
            ds,
            addrStr,  // pass the address as a string*
            nullptr
        );
    }
    
}

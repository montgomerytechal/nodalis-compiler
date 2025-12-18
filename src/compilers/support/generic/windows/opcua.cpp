#include "opcua.h"
#include <iostream>

OPCUAClient::OPCUAClient()
    : IOClient("opcua"), endpointUrl("opc.tcp://localhost:4840") {
    
}

OPCUAClient::~OPCUAClient() {
}

void OPCUAClient::connect() {
    
}


// Implement required IOClient methods

bool OPCUAClient::readBit(const std::string& remote, int& result) {
    return false;
}

bool OPCUAClient::writeBit(const std::string& remote, int value) {
    return false;
}

bool OPCUAClient::readByte(const std::string& remote, uint8_t& result) {
    return false;
}

bool OPCUAClient::writeByte(const std::string& remote, uint8_t value) {
    return false;
}

bool OPCUAClient::readWord(const std::string& remote, uint16_t& result) {
    return false;
}

bool OPCUAClient::writeWord(const std::string& remote, uint16_t value) {
    return false;
}

bool OPCUAClient::readDWord(const std::string& remote, uint32_t& result) {
    return false;
}

bool OPCUAClient::writeDWord(const std::string& remote, uint32_t value) {
    return false;
}

bool OPCUAClient::readLWord(const std::string &remote, uint64_t &result)
{
    return false;
}

bool OPCUAClient::writeLWord(const std::string &remote, uint64_t value)
{
    return false;
}

OPCUAServer::OPCUAServer() {
    
}

OPCUAServer::~OPCUAServer() {
    
}

void OPCUAServer::start() {
    
}

void OPCUAServer::stop() {
    
}

void OPCUAServer::run() {
}

void OPCUAServer::mapVariable(std::string varname, std::string addr){
   
    
}

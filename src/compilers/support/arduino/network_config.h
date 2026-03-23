// Copyright [2025] Nathan Skipper
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

#pragma once
#ifndef NODALIS_NETWORK_CONFIG_H
#define NODALIS_NETWORK_CONFIG_H

#include <Arduino.h>
#include <Ethernet.h>

IPAddress nodalisDefaultIpAddress();
IPAddress nodalisLoadIpAddress();
void nodalisBeginEthernet(const IPAddress &ip);
void nodalisPrintCurrentIp(const IPAddress &ip);
void nodalisPrintNetworkConfigHelp();
void nodalisPollSerialIpConfig(IPAddress &currentIp);

#endif

// Copyright [2025] Nathan Skipper
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

/// <summary>
/// OPC client implementation for .NET
/// </summary>

using Opc.Ua;
using Opc.Ua.Client;
using Opc.Ua.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace Nodalis
{
    /// <summary>
    /// Implements the IOClient framework for OPC/UA modules.
    /// </summary>
    public class OPCClient : IOClient
    {
        private readonly ITelemetryContext _telemetry = DefaultTelemetry.Create(null);
        private ISession? _session;
        private ApplicationConfiguration? _config;
        /// <summary>
        /// Instantiates a new OPCClient.
        /// </summary>
        public OPCClient() : base("OPCUA") { }
        /// <summary>
        /// Connects to the OPC device based on the mappings supplied.
        /// </summary>
        public override void Connect()
        {
            Task.Run(async () =>
            {
                try
                {
                    var map = mappings[0];
                    string endpointUrl = map.moduleID;

                    _config = new ApplicationConfiguration(_telemetry)
                    {
                        ApplicationName = "NodalisOPCUAClient",
                        ApplicationType = ApplicationType.Client,
                        SecurityConfiguration = CreateSecurityConfiguration(),
                        TransportConfigurations = new TransportConfigurationCollection(),
                        TransportQuotas = new TransportQuotas { OperationTimeout = 15000 },
                        ClientConfiguration = new ClientConfiguration { DefaultSessionTimeout = 60000 }
                    };
                    await _config.ValidateAsync(ApplicationType.Client);
                    await _config.CertificateValidator.UpdateAsync(_config, default);

                    var app = new ApplicationInstance(_telemetry)
                    {
                        ApplicationName = "NodalisOPCUAClient",
                        ApplicationType = ApplicationType.Client,
                        ApplicationConfiguration = _config
                    };
                    await app.CheckApplicationInstanceCertificatesAsync(false, 0);

                    var endpoint = await CoreClientUtils.SelectEndpointAsync(_config, endpointUrl, false, 15000, _telemetry, default);
                    var endpointConfig = EndpointConfiguration.Create(_config);
                    var configuredEndpoint = new ConfiguredEndpoint(null, endpoint, endpointConfig);

                    var sessionFactory = new DefaultSessionFactory(_telemetry);

                    _session = await sessionFactory.CreateAsync(
                        _config,
                        (ITransportWaitingConnection?)null,
                        configuredEndpoint,
                        true,
                        false,
                        _config.ApplicationName,
                        60000,
                        new UserIdentity(),
                        null,
                        default
                    );
                    connected = true;
                    Console.WriteLine("OPC UA connected.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("OPC UA connection error: " + ex.Message);
                    connected = false;
                }
            });
        }

        private static SecurityConfiguration CreateSecurityConfiguration()
        {
            string pkiRoot = Path.Combine(AppContext.BaseDirectory, "pki");
            string ownStore = Path.Combine(pkiRoot, "own");
            string trustedPeerStore = Path.Combine(pkiRoot, "trusted");
            string trustedIssuerStore = Path.Combine(pkiRoot, "issuer");
            string rejectedStore = Path.Combine(pkiRoot, "rejected");

            Directory.CreateDirectory(ownStore);
            Directory.CreateDirectory(trustedPeerStore);
            Directory.CreateDirectory(trustedIssuerStore);
            Directory.CreateDirectory(rejectedStore);

            return new SecurityConfiguration
            {
                ApplicationCertificate = new CertificateIdentifier
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = ownStore,
                    SubjectName = "CN=NodalisOPCUAClient"
                },
                TrustedPeerCertificates = new CertificateTrustList
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = trustedPeerStore
                },
                TrustedIssuerCertificates = new CertificateTrustList
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = trustedIssuerStore
                },
                RejectedCertificateStore = new CertificateTrustList
                {
                    StoreType = CertificateStoreType.Directory,
                    StorePath = rejectedStore
                },
                AutoAcceptUntrustedCertificates = true
            };
        }

        private NodeId GetNodeId(string remote) => new NodeId($"s={remote}", 1);

        public override bool ReadBit(string address, out int result)
        {
            return ReadValue(address, out result, BuiltInType.Boolean);
        }

        public override bool WriteBit(string address, int value)
        {
            return WriteVal(address, value != 0, BuiltInType.Boolean);
        }

        public override bool ReadByte(string address, out byte result)
        {
            return ReadValue(address, out result, BuiltInType.Byte);
        }

        public override bool WriteByte(string address, byte value)
        {
            return WriteVal(address, value, BuiltInType.Byte);
        }

        public override bool ReadWord(string address, out ushort result)
        {
            return ReadValue(address, out result, BuiltInType.UInt16);
        }

        public override bool WriteWord(string address, ushort value)
        {
            return WriteVal(address, value, BuiltInType.UInt16);
        }

        public override bool ReadDWord(string address, out uint result)
        {
            return ReadValue(address, out result, BuiltInType.UInt32);
        }

        public override bool WriteDWord(string address, uint value)
        {
            return WriteVal(address, value, BuiltInType.UInt32);
        }

        public override bool ReadLWord(string address, out ulong result)
        {
            return ReadValue(address, out result, BuiltInType.UInt64);
        }

        public override bool WriteLWord(string address, ulong value)
        {
            return WriteVal(address, value, BuiltInType.UInt64);
        }

        private bool ReadValue<T>(string address, out T result, BuiltInType type)
        {
            result = default!;
            if (!connected || _session == null) return false;

            try
            {
                var nodeId = GetNodeId(address);
                var value = _session.ReadValueAsync(nodeId, default).GetAwaiter().GetResult();
                if (value.Value is T cast)
                {
                    result = cast;
                    return true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Read error [{address}]: {ex.Message}");
            }
            return false;
        }

        private bool WriteVal<T>(string address, T value, BuiltInType type)
        {
            if (!connected || _session == null) return false;

            try
            {
                var writeValue = new WriteValue
                {
                    NodeId = GetNodeId(address),
                    AttributeId = Attributes.Value,
                    Value = new DataValue(new Variant(value))
                };

                writeValue.Value.StatusCode = StatusCodes.Good;
                writeValue.Value.ServerTimestamp = DateTime.MinValue;
                writeValue.Value.SourceTimestamp = DateTime.MinValue;

                var writeResponse = _session.WriteAsync(null, new WriteValueCollection { writeValue }, default)
                    .GetAwaiter()
                    .GetResult();
                var statusCodes = writeResponse.Results;
                if (StatusCode.IsBad(statusCodes[0]))
                {
                    Console.WriteLine($"Write failed for {address}: {statusCodes[0]}");
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Write error [{address}]: {ex.Message}");
            }
            return false;
        }
    }
}

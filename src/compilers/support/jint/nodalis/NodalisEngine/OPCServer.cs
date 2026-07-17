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
/// OPC Server implementation for .NET
/// </summary>
/// 

using Microsoft.Extensions.Logging.Abstractions;
using Opc.Ua;
using Opc.Ua.Configuration;
using Opc.Ua.Server;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
namespace Nodalis
{

    internal sealed class NullTelemetry : TelemetryContextBase
    {
        public NullTelemetry()
            : base(NullLoggerFactory.Instance)
        {
        }
    }

    internal sealed class NodalisLoggerProvider : ILoggerProvider
    {
        private readonly NodalisEngine _engine;

        public NodalisLoggerProvider(NodalisEngine engine)
        {
            _engine = engine;
        }

        public ILogger CreateLogger(string categoryName)
        {
            return new NodalisTelemetryLogger(_engine, categoryName);
        }

        public void Dispose()
        {
            // Nothing to dispose.
        }
    }

    internal sealed class NodalisTelemetryLogger : ILogger
    {
        private readonly NodalisEngine _engine;
        private readonly string _categoryName;

        public NodalisTelemetryLogger(
            NodalisEngine engine,
            string categoryName)
        {
            _engine = engine;
            _categoryName = categoryName;
        }

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull
        {
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            // Change this to Information later if Debug/Trace is too verbose.
            return logLevel >= LogLevel.Information;
        }

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
                return;

            string message;

            try
            {
                message = formatter(state, exception);
            }
            catch
            {
                message = state?.ToString() ?? string.Empty;
            }

            string completeMessage =
                $"OPC [{logLevel}] {_categoryName} [{eventId.Id}]: " +
                message;

            if (exception != null)
            {
                completeMessage +=
                    Environment.NewLine +
                    exception;
            }

            switch (logLevel)
            {
                case LogLevel.Critical:
                case LogLevel.Error:
                    _engine.LogError(completeMessage);
                    break;

                case LogLevel.Warning:
                    // Use LogError if your engine only has debug/error methods,
                    // or change this to your warning-level method.
                    _engine.LogDebug(completeMessage);
                    break;

                default:
                    _engine.LogMessage(completeMessage);
                    break;
            }
        }
    }

    /// <summary>
    /// The OPCServer provides a server interface for handling inputs and outputs for OPC/UA
    /// </summary>
    public class OPCServer
    {
        private ITelemetryContext _telemetry;
        private ApplicationInstance _application;
        private readonly NodalisEngine _engine;
        private readonly Dictionary<string, string> _addressMap;
        private StandardServer? _server;
        /// <summary>
        /// Instantiates a new OPCServer with the given engine.
        /// </summary>
        /// <param name="engine">The NodalisEngine object to use for memory.</param>
        public OPCServer(NodalisEngine engine)
        {
            _engine = engine;
            try
            {
                _engine.LogDebug("Instantiating OPC Server.");
                _addressMap = new();

            }
            catch (Exception e)
            {
                _engine.LogError("OPCServer error: " + e.ToString());
            }
            _engine.LogDebug("OPC Server is instantiated.");
        }

        /// <summary>
        /// Maps a OPC/UA variable name to a PLC address.
        /// </summary>
        /// <param name="varName">The OPC variable name.</param>
        /// <param name="address">The PLC address associated with the variable.</param>
        public void MapVariable(string varName, string address)
        {
            _addressMap[varName] = address;
        }

        private void LogOpcAssemblies()
        {
            Type[] types =
            {
        typeof(Opc.Ua.ApplicationConfiguration),
        typeof(Opc.Ua.Configuration.ApplicationInstance),
        typeof(Opc.Ua.Server.StandardServer),
        typeof(Opc.Ua.CertificateValidator)
    };

            foreach (Type type in types)
            {
                var assembly = type.Assembly;

                _engine.LogDebug(
                    $"OPC assembly: Type={type.FullName}, " +
                    $"Assembly={assembly.GetName().Name}, " +
                    $"Version={assembly.GetName().Version}, " +
                    $"Location={assembly.Location}");
            }
        }

        /// <summary>
        /// Starts the server.
        /// </summary>
        /// <param name="hostname">The hostname or IP address for the server.</param>
        /// <returns></returns>
        public async Task StartAsync(string hostname = "localhost")
        {
            await Task.Yield();
            _engine.LogDebug("OPC: Creating telemetry.");
            _telemetry = _telemetry = DefaultTelemetry.Create(builder =>
            {
                builder.ClearProviders();

                builder.SetMinimumLevel(LogLevel.Warning);

                builder.AddProvider(
                    new NodalisLoggerProvider(_engine));
            });
            _engine.LogDebug("OPC: Creating ApplicationInstance.");
            _application = new ApplicationInstance(_telemetry)
            {
                ApplicationName = "NodalisServer",
                ApplicationType = ApplicationType.Server,
                ConfigSectionName = "NodalisServer"
            };

            _engine.LogDebug("OPC: Creating configuration.");
            var config = new ApplicationConfiguration(_telemetry)
            {
                ApplicationName = "NodalisServer",
                ApplicationType = ApplicationType.Server,
                ApplicationUri = $"urn:{hostname}:NodalisServer",
                ServerConfiguration = new ServerConfiguration
                {
                    BaseAddresses =
                    {
                        $"opc.tcp://{hostname}:4840/UA/Nodalis"
                    },

                    SecurityPolicies =
                    {
                        new ServerSecurityPolicy
                        {
                            SecurityMode = MessageSecurityMode.None,
                            SecurityPolicyUri = SecurityPolicies.None
                        }
                    },

                    UserTokenPolicies =
                    {
                        new UserTokenPolicy
                        {
                            TokenType = UserTokenType.Anonymous
                        }
                    },

                    DiagnosticsEnabled = false,
                    MaxSessionCount = 2,
                    MaxSubscriptionCount = 4,
                    MinRequestThreadCount = 1,
                    MaxRequestThreadCount = 4,
                    MaxQueuedRequestCount = 20,
                    MaxRegistrationInterval = 0,
                    MultiCastDnsEnabled = false
                },
                TransportQuotas = new TransportQuotas
                {
                    OperationTimeout = 15000
                },
                SecurityConfiguration = CreateSecurityConfiguration(),
                CertificateValidator = new CertificateValidator(_telemetry),
                //DiagnosticsConfiguration = new DiagnosticsConfiguration { Enabled = true },
                Extensions = new XmlElementCollection()
            };

            _engine.LogDebug("OPC: Validating configuration.");
            await config.ValidateAsync(ApplicationType.Server);

            _engine.LogDebug("OPC: Updating certificate validator.");
            await config.CertificateValidator.UpdateAsync(config, default);

            _application.ApplicationConfiguration = config;

            _engine.LogDebug("OPC: Checking application certificate.");
            bool certificateValid =
            await _application.CheckApplicationInstanceCertificatesAsync(
                silent: true);

            _engine.LogDebug(
                $"OPC: Certificate valid result = {certificateValid}");

            var certificateIdentifier =
                config.SecurityConfiguration.ApplicationCertificate;

            _engine.LogDebug(
                $"OPC: Certificate store = {certificateIdentifier.StorePath}");

            _engine.LogDebug(
                $"OPC: Certificate subject = {certificateIdentifier.SubjectName}");

            _engine.LogDebug(
                $"OPC: Loaded certificate is null = " +
                $"{certificateIdentifier.Certificate == null}");
            _engine.LogDebug("OPC: Creating server.");
            _server = new NodalisServer(_engine, _addressMap);

            _engine.LogDebug("OPC: Starting server.");
            try
            {
                LogOpcAssemblies();
                await _application.StartAsync(_server);

                _engine.LogDebug(
                    $"OPC UA Server started at opc.tcp://{hostname}:4840/UA/Nodalis");
            }
            catch (Exception ex)
            {
                _engine.LogError("OPC server startup failed: " + ex.ToString());


            }

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
                    SubjectName = "CN=NodalisServer"
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
        /// <summary>
        /// Stops the server.
        /// </summary>
        /// <returns></returns>
        public async Task StopAsync()
        {
            if (_server != null)
            {
                await _server.StopAsync(default);
                Console.WriteLine("OPC UA Server stopped.");
            }
        }

        private class NodalisServer : StandardServer
        {
            private readonly NodalisEngine _engine;
            private readonly Dictionary<string, string> _map;

            public NodalisServer(NodalisEngine engine, Dictionary<string, string> map) : base()
            {
                _engine = engine;
                _map = map;
            }

            protected override MasterNodeManager CreateMasterNodeManager(IServerInternal server, ApplicationConfiguration config)
            {
                try
                {
                    _engine.LogDebug("OPC: CreateMasterNodeManager entered.");

                    var nodeManagers = new List<INodeManager>
                {
                    new NodalisNodeManager(
                        server,
                        config,
                        _engine,
                        _map)
                };

                    _engine.LogDebug("OPC: NodalisNodeManager created.");

                    var manager = new MasterNodeManager(
                        server,
                        config,
                        null,
                        nodeManagers.ToArray());

                    _engine.LogDebug("OPC: MasterNodeManager created.");

                    return manager;
                }
                catch (Exception ex)
                {
                    _engine.LogError(
                        "OPC CreateMasterNodeManager failed: " +
                        ex.GetType().FullName + ": " +
                        ex.Message + Environment.NewLine +
                        ex.StackTrace);
                    return null;
                }
            }

            private class NodalisNodeManager : CustomNodeManager2
            {
                private readonly NodalisEngine _engine;
                private readonly Dictionary<string, string> _addressMap;

                public NodalisNodeManager(IServerInternal server, ApplicationConfiguration config, NodalisEngine engine, Dictionary<string, string> map)
                    : base(server, config, "http://nodalis.local/UA/")
                {
                    try
                    {
                        engine.LogDebug(
                            "OPC: NodalisNodeManager constructor entered.");
                        _engine = engine;
                        _addressMap = map;
                        SystemContext.NodeIdFactory = this;
                        engine.LogDebug(
                            "OPC: NodalisNodeManager constructor completed.");
                    }
                    catch (Exception ex)
                    {
                        engine.LogError(
                            "OPC NodalisNodeManager constructor failed: " +
                            ex.GetType().FullName + ": " +
                            ex.Message + Environment.NewLine +
                            ex.StackTrace);
                    }
                }

                private FolderState CreateFolder(
                    NodeState parent,
                    string path,
                    string name,
                    IDictionary<NodeId, IList<IReference>> externalReferences,
                    ushort namespaceIndex)
                {
                    var folder = new FolderState(parent)
                    {
                        SymbolicName = name,
                        ReferenceTypeId = ReferenceTypeIds.Organizes,
                        TypeDefinitionId = ObjectTypeIds.FolderType,
                        NodeId = new NodeId(path, namespaceIndex),
                        BrowseName = new QualifiedName(name, namespaceIndex),
                        DisplayName = name,
                        EventNotifier = EventNotifiers.None
                    };

                    if (externalReferences.TryGetValue(ObjectIds.ObjectsFolder, out var references))
                        references.Add(new NodeStateReference(ReferenceTypeIds.Organizes, false, folder.NodeId));
                    else
                        externalReferences[ObjectIds.ObjectsFolder] = new List<IReference>
                    {
                        new NodeStateReference(ReferenceTypeIds.Organizes, false, folder.NodeId)
                    };

                    AddPredefinedNode(SystemContext, folder);
                    return folder;
                }

                private ServiceResult ReadValueHandler(
                    ISystemContext context,
                    NodeState node,
                    NumericRange indexRange,
                    QualifiedName name,
                    ref object value,
                    ref StatusCode statusCode,
                    ref DateTime timestamp)
                {
                    if (node is BaseDataVariableState variable &&
                        _addressMap.TryGetValue(variable.SymbolicName, out var addr))
                    {
                        try
                        {
                            value = ReadFromEngine(addr);
                            statusCode = StatusCodes.Good;
                            timestamp = DateTime.UtcNow;
                            return ServiceResult.Good;
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Read error for {addr}: {ex.Message}");
                            return StatusCodes.BadUnexpectedError;
                        }
                    }

                    return StatusCodes.BadNodeIdUnknown;
                }

                public override void CreateAddressSpace(IDictionary<NodeId, IList<IReference>> externalReferences)
                {
                    try
                    {
                        _engine.LogDebug(
                            $"OPC: CreateAddressSpace entered with {_addressMap.Count} mappings.");

                        var folder = CreateFolder(
                            null,
                            "Nodalis",
                            "Nodalis",
                            externalReferences,
                            NamespaceIndex);

                        _engine.LogDebug("OPC: Root folder created.");
                        var nodelog = "";
                        foreach (var entry in _addressMap)
                        {
                            string name = entry.Key;
                            string addr = entry.Value;
                            nodelog += $"OPC: Creating node '{name}' for '{addr}'.\n";
                            var dataType = GetDataType(addr);

                            var variable = new BaseDataVariableState(folder)
                            {
                                SymbolicName = name,
                                ReferenceTypeId = ReferenceTypeIds.Organizes,
                                NodeId = new NodeId(name, NamespaceIndex),
                                BrowseName = new QualifiedName(name, NamespaceIndex),
                                DisplayName = name,
                                DataType = dataType,
                                TypeDefinitionId = VariableTypeIds.BaseDataVariableType,
                                ValueRank = ValueRanks.Scalar,
                                AccessLevel = AccessLevels.CurrentReadOrWrite,
                                UserAccessLevel = AccessLevels.CurrentReadOrWrite
                            };

                            // Define read delegate
                            variable.OnReadValue = ReadValueHandler;


                            // Define write delegate
                            variable.OnSimpleWriteValue = (ISystemContext context, NodeState node, ref object val) =>
                            {
                                try
                                {
                                    WriteToEngine(addr, val);
                                    return ServiceResult.Good;
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Write error for {addr}: {ex.Message}");
                                    return StatusCodes.BadUnexpectedError;
                                }
                            };

                            folder.AddChild(variable);
                            AddPredefinedNode(SystemContext, variable);
                        }
                        _engine.LogDebug(nodelog);
                        _engine.LogDebug("OPC: CreateAddressSpace completed.");
                    }
                    catch (Exception ex)
                    {
                        _engine.LogError(
                            "OPC CreateAddressSpace failed: " +
                            ex.GetType().FullName + ": " +
                            ex.Message + Environment.NewLine +
                            ex.StackTrace);
                    }
                }

                private object ReadFromEngine(string address)
                {
                    if (address.Contains(".")) return _engine.ReadBit(address);
                    else if (address.Contains("X")) return _engine.ReadByte(address);
                    else if (address.Contains("W")) return _engine.ReadWord(address);
                    else if (address.Contains("D")) return _engine.ReadDWord(address);
                    else if (address.Contains("L")) return _engine.ReadLWord(address);
                    return false;
                }

                private void WriteToEngine(string address, object value)
                {
                    switch (value)
                    {
                        case bool b: _engine.WriteBit(address, b); break;
                        case byte bt: _engine.WriteByte(address, bt); break;
                        case ushort us: _engine.WriteWord(address, us); break;
                        case uint ui: _engine.WriteDWord(address, ui); break;
                        case ulong ui64: _engine.WriteLWord(address, ui64); break;
                        default: throw new InvalidCastException($"Unsupported value type: {value?.GetType()?.Name}");
                    }
                }


                private NodeId GetDataType(string address)
                {
                    if (address.Contains(".")) return DataTypeIds.Boolean;
                    else if (address.Contains("X")) return DataTypeIds.Byte;
                    else if (address.Contains("W")) return DataTypeIds.UInt16;
                    else if (address.Contains("D")) return DataTypeIds.UInt32;
                    else if (address.Contains("L")) return DataTypeIds.UInt64;
                    return DataTypeIds.Boolean;
                }



            }
        }
    }
}

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
using Opc.Ua;
using Opc.Ua.Configuration;
using Opc.Ua.Server;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Nodalis
{
    /// <summary>
    /// The OPCServer provides a server interface for handling inputs and outputs for OPC/UA
    /// </summary>
    public class OPCServer
    {
        private ApplicationInstance _application;
        private NodalisEngine _engine;
        private Dictionary<string, string> _addressMap = new();
        private NodalisNodeManager? _nodeManager;
        private StandardServer? _server;
        /// <summary>
        /// Instantiates a new OPCServer with the given engine.
        /// </summary>
        /// <param name="engine">The NodalisEngine object to use for memory.</param>
        public OPCServer(NodalisEngine engine)
        {
            _engine = engine;
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

        /// <summary>
        /// Starts the server.
        /// </summary>
        /// <returns></returns>
        public async Task StartAsync()
        {
            _application = new ApplicationInstance
            {
                ApplicationName = "NodalisServer",
                ApplicationType = ApplicationType.Server,
                ConfigSectionName = "NodalisServer"
            };

            var config = new ApplicationConfiguration
            {
                ApplicationName = "NodalisServer",
                ApplicationType = ApplicationType.Server,
                ApplicationUri = "urn:localhost:NodalisServer",
                ServerConfiguration = new ServerConfiguration
                {
                    BaseAddresses = { "opc.tcp://localhost:4840/UA/Nodalis" }
                },
                TransportQuotas = new TransportQuotas { OperationTimeout = 15000 },
                SecurityConfiguration = new SecurityConfiguration
                {
                    ApplicationCertificate = new CertificateIdentifier(),
                    AutoAcceptUntrustedCertificates = true
                },
                CertificateValidator = new CertificateValidator(),
                //DiagnosticsConfiguration = new DiagnosticsConfiguration { Enabled = true },
                Extensions = new XmlElementCollection()
            };

            await config.Validate(ApplicationType.Server);

            _application.ApplicationConfiguration = config;

            _server = new NodalisServer(_engine, _addressMap);
            _application.Start(_server);

            Console.WriteLine("OPC UA Server started at: opc.tcp://localhost:4840/UA/Nodalis");
        }
        /// <summary>
        /// Stops the server.
        /// </summary>
        /// <returns></returns>
        public async Task StopAsync()
        {
            if (_server != null)
            {
                 _server.Stop();
                Console.WriteLine("OPC UA Server stopped.");
            }
        }

        private class NodalisServer : StandardServer
        {
            private readonly NodalisEngine _engine;
            private readonly Dictionary<string, string> _map;

            public NodalisServer(NodalisEngine engine, Dictionary<string, string> map)
            {
                _engine = engine;
                _map = map;
            }

            protected override MasterNodeManager CreateMasterNodeManager(IServerInternal server, ApplicationConfiguration config)
            {
                var nodeManagers = new List<INodeManager>
                {
                    new NodalisNodeManager(server, config, _engine, _map)
                };

                return new MasterNodeManager(server, config, null, nodeManagers.ToArray());
            }
        }

        private class NodalisNodeManager : CustomNodeManager2
        {
            private readonly NodalisEngine _engine;
            private readonly Dictionary<string, string> _addressMap;

            public NodalisNodeManager(IServerInternal server, ApplicationConfiguration config, NodalisEngine engine, Dictionary<string, string> map)
                : base(server, config, "http://nodalis.local/UA/")
            {
                _engine = engine;
                _addressMap = map;
                SystemContext.NodeIdFactory = this;
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
                var folder = CreateFolder(
                    null,
                    "Nodalis",
                    "Nodalis",
                    externalReferences,
                    NamespaceIndex
                );

                foreach (var entry in _addressMap)
                {
                    string name = entry.Key;
                    string addr = entry.Value;
                    var dataType = GetDataType(addr);

                    var variable = new BaseDataVariableState(folder)
                    {
                        SymbolicName = name,
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

                    AddPredefinedNode(SystemContext, variable);
                }
            }

            private object ReadFromEngine(string address)
            {
                if (address.Contains(".")) return _engine.ReadBit(address);
                else if (address.Contains("X")) return _engine.ReadByte(address);
                else if (address.Contains("W")) return _engine.ReadWord(address);
                else if (address.Contains("D")) return _engine.ReadDWord(address);
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
                    default: throw new InvalidCastException($"Unsupported value type: {value?.GetType()?.Name}");
                }
            }


            private NodeId GetDataType(string address)
            {
                if (address.Contains(".")) return DataTypeIds.Boolean;
                else if (address.Contains("X")) return DataTypeIds.Byte;
                else if (address.Contains("W")) return DataTypeIds.UInt16;
                else if (address.Contains("D")) return DataTypeIds.UInt32;
                return DataTypeIds.Boolean;
            }

            
           
        }
    }
}

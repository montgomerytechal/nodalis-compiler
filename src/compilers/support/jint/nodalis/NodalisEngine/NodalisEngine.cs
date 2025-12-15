#nullable enable

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
/// Nodalis Framework for .NET
/// </summary>

using System;
using System.Collections.Generic;
using System.Text.Json;
using Jint;
using Jint.Native;
using Jint.Native.Object;
using Jint.Native.Function;
using Jint.Runtime.Interop;
using Jint.Runtime;
namespace Nodalis
{
    /// <summary>
    /// The StaticStore class creates a list of statically declared variables in JS.
    /// </summary>
    public class StaticStore
    {
        private readonly Dictionary<string, JsValue> _store = new();
        /// <summary>
        /// Tries to get the vlaue of a key.
        /// </summary>
        /// <param name="key">The key representing the name of the static variable.</param>
        /// <param name="value">The variable in which to return the value, if it exists.</param>
        /// <returns></returns>
        public bool TryGetValue(string key, out JsValue value) =>
            _store.TryGetValue(key, out value);
        /// <summary>
        /// Gets or sets the value represented by the key.
        /// </summary>
        /// <param name="key">The name of the static variable.</param>
        /// <returns></returns>
        public JsValue this[string key]
        {
            get => _store[key];
            set => _store[key] = value;
        }
    }

    /// <summary>
    /// Defines the types of IO.
    /// </summary>
    public enum IOType { Input, Output }

    /// <summary>
    /// The IOMap represents a single mapping of an IO device address.
    /// </summary>
    public class IOMap
    {
        /// <summary>
        /// The local address associated with the IO point.
        /// </summary>
        public string localAddress;
        /// <summary>
        /// The remote address (on the module) for the IO point.
        /// </summary>
        public string remoteAddress;
        /// <summary>
        /// The ID of the module (either the IP address or another way of identifying it.)
        /// </summary>
        public string moduleID;
        /// <summary>
        /// The port of the module.
        /// </summary>
        public string modulePort;
        /// <summary>
        /// The protocol for the module.
        /// </summary>
        public string protocol;
        /// <summary>
        /// The direction of the IO.
        /// </summary>
        public IOType direction;
        /// <summary>
        /// The width (in bits) of the interface.
        /// </summary>
        public int width;
        /// <summary>
        /// The interval (in milliseconds) at which to poll the module for updates.
        /// </summary>
        public int interval;
        /// <summary>
        /// The last time the device was polled.
        /// </summary>
        public long lastPoll = 0;
        /// <summary>
        /// A list of protocol-specific properties.
        /// </summary>
        public Dictionary<string, string>? protocolProperties;
        /// <summary>
        /// Constructs a new map based on the json configuration of it.
        /// </summary>
        /// <param name="json">A json string representing the map.</param>
        public IOMap(string json)
        {
            var dict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            localAddress = dict["InternalAddress"];
            remoteAddress = dict["RemoteAddress"];
            moduleID = dict["ModuleID"];
            modulePort = dict["ModulePort"];
            protocol = dict["Protocol"];
            direction = localAddress.StartsWith("%Q") ? IOType.Output : IOType.Input;
            width = int.Parse(dict["RemoteSize"]);
            interval = int.Parse(dict["PollTime"]);
            if (dict.TryGetValue("ProtocolProperties", out var nestedJson))
            {
                try
                {
                    protocolProperties = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(nestedJson);
                }
                catch
                {
                    protocolProperties = null;
                }
            }
        }
    }
    /// <summary>
    /// IOClient defines the behavior for an IO interface between the engine and a module.
    /// </summary>
    public abstract class IOClient
    {
        /// <summary>
        /// Indicates whether it is connected or not.
        /// </summary>
        public bool connected = false;
        /// <summary>
        /// The protocol for the module.
        /// </summary>
        public string protocol;
        /// <summary>
        /// The ID (IP address or other ID) of the module.
        /// </summary>
        public string moduleID;
        /// <summary>
        /// The list of mappings for this module.
        /// </summary>
        protected List<IOMap> mappings = new();
        /// <summary>
        /// The last attempt to poll the module.
        /// </summary>
        protected long lastAttempt = 0;
        /// <summary>
        /// Constructs a new client with the given protocol.
        /// </summary>
        /// <param name="protocol">The name of the protocol</param>
        protected IOClient(string protocol)
        {
            this.protocol = protocol;
        }

        /// <summary>
        /// Adds a mapping object to the client.
        /// </summary>
        /// <param name="map">The map object defining the mapping.</param>
        public void AddMapping(IOMap map)
        {
            if (!mappings.Exists(m => m.localAddress == map.localAddress))
            {
                if (mappings.Count == 0)
                {
                    moduleID = map.moduleID;
                    
                }
                mappings.Add(map);
            }
        }
        /// <summary>
        /// Indicates whether this client has a map to the given address.
        /// </summary>
        /// <param name="localAddress">The local address to search for.</param>
        /// <returns>Returns true if the mapping is facilitated by this client.</returns>
        public bool HasMapping(string localAddress) => mappings.Exists(m => m.localAddress == localAddress);

        /// <summary>
        /// Polls each map within this client for updates, based on the interval set for each map.
        /// </summary>
        /// <param name="engine">The NodalisEngine from which to get and set addresses.</param>
        public void Poll(NodalisEngine engine)
        {
            foreach (var map in mappings)
            {
                if (engine.ElapsedMilliseconds - map.lastPoll >= map.interval)
                {
                    map.lastPoll = engine.ElapsedMilliseconds;
                    try
                    {
                        if (map.direction == IOType.Output)
                        {
                            switch (map.width)
                            {
                                case 1: WriteBit(map.remoteAddress, engine.ReadBit(map.localAddress) ? 1 : 0); break;
                                case 8: WriteByte(map.remoteAddress, engine.ReadByte(map.localAddress)); break;
                                case 16: WriteWord(map.remoteAddress, engine.ReadWord(map.localAddress)); break;
                                case 32: WriteDWord(map.remoteAddress, engine.ReadDWord(map.localAddress)); break;
                                case 64: WriteLWord(map.remoteAddress, engine.ReadLWord(map.localAddress)); break;
                            }
                        }
                        else
                        {
                            switch (map.width)
                            {
                                case 1: if (ReadBit(map.remoteAddress, out var bit)) engine.WriteBit(map.localAddress, bit != 0); break;
                                case 8: if (ReadByte(map.remoteAddress, out var b)) engine.WriteByte(map.localAddress, b); break;
                                case 16: if (ReadWord(map.remoteAddress, out var w)) engine.WriteWord(map.localAddress, w); break;
                                case 32: if (ReadDWord(map.remoteAddress, out var d)) engine.WriteDWord(map.localAddress, d); break;
                                case 64: if (ReadLWord(map.remoteAddress, out var l)) engine.WriteLWord(map.localAddress, l); break;
                            }
                        }
                    }
                    catch { }
                }
            }
        }
        /// <summary>
        /// Connects to the module.
        /// </summary>
        public abstract void Connect();
        /// <summary>
        /// Reads a bit from the remote module.
        /// </summary>
        /// <param name="address">The address to read</param>
        /// <param name="result">The variable to which the result should be saved.</param>
        /// <returns>Returns true if the bit is read.</returns>
        public abstract bool ReadBit(string address, out int result);
        /// <summary>
        /// Writes a bit to the remote module.
        /// </summary>
        /// <param name="address">The address to which the value should be written.</param>
        /// <param name="value">The value to write.</param>
        /// <returns>Returns true if the bit was written.</returns>
        public abstract bool WriteBit(string address, int value);
        /// <summary>
        /// Reads a byte from the remote module.
        /// </summary>
        /// <param name="address">The address to read.</param>
        /// <param name="result">The variable for storing the result.</param>
        /// <returns>Returns true if the byte was read.</returns>
        public abstract bool ReadByte(string address, out byte result);
        /// <summary>
        /// Writes a byte to the remote module.
        /// </summary>
        /// <param name="address">The address to write.</param>
        /// <param name="value">The value to write.</param>
        /// <returns>Returns true if the byte is written.</returns>
        public abstract bool WriteByte(string address, byte value);
        /// <summary>
        /// Reads a word (unsigned short) from the remote module.
        /// </summary>
        /// <param name="address">The addres to read.</param>
        /// <param name="result">The variable into which to store the result.</param>
        /// <returns>Returns true if the word was read.</returns>
        public abstract bool ReadWord(string address, out ushort result);
        /// <summary>
        /// Writes a word to the remote module.
        /// </summary>
        /// <param name="address">The address to write.</param>
        /// <param name="value">The value to write.</param>
        /// <returns>Returns true if the word was written.</returns>
        public abstract bool WriteWord(string address, ushort value);
        /// <summary>
        /// Reads a double word (unsigned integer) from the remote module.
        /// </summary>
        /// <param name="address">The address to read.</param>
        /// <param name="result">The variable to store the result.</param>
        /// <returns>Returns true if the double word was read.</returns>
        public abstract bool ReadDWord(string address, out uint result);
        /// <summary>
        /// Writes a double word to the remote module.
        /// </summary>
        /// <param name="address">The address to write.</param>
        /// <param name="value">The value to write.</param>
        /// <returns>Returns true if the value was written.</returns>
        public abstract bool WriteDWord(string address, uint value);
        /// <summary>
        /// Reads a long word (unsigned long) from the remote module.
        /// </summary>
        /// <param name="address">The address to read.</param>
        /// <param name="result">The variable to store the result.</param>
        /// <returns>Returns true if the value was read.</returns>
        public abstract bool ReadLWord(string address, out ulong result);
        /// <summary>
        /// Writes a long word to the remote module.
        /// </summary>
        /// <param name="address">The address to write.</param>
        /// <param name="value">The value to write.</param>
        /// <returns>Returns true if the value was written.</returns>
        public abstract bool WriteLWord(string address, ulong value);
    }

    /// <summary>
    /// Provides a framework for representing a functionblock from JS.
    /// </summary>
    public class FunctionBlock
    {
        private readonly ObjectInstance _jsObj;
        private readonly Engine _engine;
        /// <summary>
        /// Instantiates a new functionblock object with the given engine and class name.
        /// </summary>
        /// <param name="engine">The JSEngine to use in executing the block.</param>
        /// <param name="className">The name of the function block.</param>
        public FunctionBlock(Engine engine, string className)
        {
            _engine = engine;
            var constructor = engine.GetValue(className);
            _jsObj = engine.Invoke(constructor).AsObject();
        }
        /// <summary>
        /// Sets the property of a functionblock.
        /// </summary>
        /// <param name="name">The name of the property.</param>
        /// <param name="value">The value to set.</param>
        public void Set(string name, object value) =>
            _jsObj.Set(name, JsValue.FromObject(_engine, value), throwOnError: true);

        /// <summary>
        /// Gets the property of a functionblock.
        /// </summary>
        /// <typeparam name="T">The type of the property to read.</typeparam>
        /// <param name="name">The name of the property to read.</param>
        /// <returns>The value of the property that was read.</returns>
        public T Get<T>(string name) =>
            _jsObj.Get(name).ToObject() is T t ? t : default;
        /// <summary>
        /// Calls the functionality of the function block (JS code must implement the function "call()")
        /// </summary>
        public void Call()
        {
            var callFn = _jsObj.Get("call");
            _engine.Invoke(callFn, _jsObj);
        }
    }

    /// <summary>
    /// Defines the functionality for providing memory and PLC behavior based on the Nodalis framework.
    /// </summary>
    public abstract partial class NodalisEngine
    {
        private readonly StaticStore _staticStore = new();
        /// <summary>
        /// The Jint engine to use in executing code.
        /// </summary>
        protected readonly Engine JsEngine = new Engine(cfg => { cfg.AllowClr(); });

        private readonly List<IOClient> Clients = new();
        private readonly DateTime StartTime = DateTime.UtcNow;

        /// <summary>
        /// The elapsed time since the engine was instantiated.
        /// </summary>
        public long ElapsedMilliseconds => (long)(DateTime.UtcNow - StartTime).TotalMilliseconds;

        /// <summary>
        /// Instantiates a new engine.
        /// </summary>
        public NodalisEngine()
        {
            InjectBindings();
        }

        /// <summary>
        /// Loads the javascript code for the engine.
        /// </summary>
        /// <param name="code">The javascript code to load.</param>
        public void Load(string code) => JsEngine.Execute(code);
        /// <summary>
        /// Calls the "setup()" function within JS that was previously loaded by "Load"
        /// </summary>
        public void Setup() => JsEngine.Invoke("setup");
        /// <summary>
        /// Calls the "run()" function within JS that was previously loaded by "Load"
        /// </summary>
        public void Execute() => JsEngine.Invoke("run");
        /// <summary>
        /// Instantiates a new FunctionBlock from the Javascript.
        /// </summary>
        /// <param name="name">The name of the FunctionBlock</param>
        /// <returns>Returns a new FunctionBlock object</returns>
        public FunctionBlock CreateFunctionBlock(string name)
        {
            return new FunctionBlock(JsEngine, name);
        }
        /// <summary>
        /// Maps the IOClient for the engine based on the JSON given.
        /// </summary>
        /// <param name="json">The JSON string representing a mapping of IO.</param>
        public void MapIO(string json)
        {
            try
            {
                var map = new IOMap(json);
                var client = Clients.Find(c => c.HasMapping(map.localAddress) || c.moduleID == map.moduleID);
                if (client == null)
                { 
                    client = CreateClient(map);
                    if (client != null)
                    {
                        client.Connect();
                        Clients.Add(client);
                    }
                }
                else client.AddMapping(map);
            }
            catch (Exception ex) { Console.WriteLine($"mapIO error: {ex.Message}"); }
        }
        /// <summary>
        /// Supervises the IOClients that have been added based on mappings.
        /// </summary>
        public void SuperviseIO()
        {
            foreach (var client in Clients)
            {
                client.Poll(this);
            }
        }
        /// <summary>
        /// Creates an IO Client based on the map.
        /// </summary>
        /// <param name="map">The map to use to create the client.</param>
        /// <returns>Returns a new IOClient, or null if the mapping isn't supported.</returns>
        protected virtual IOClient? CreateClient(IOMap map)
        {
            IOClient client = null;
            if (map.protocol == "MODBUS-TCP")
                client = new ModbusClient();
            else if (map.protocol == "OPCUA")
                client = new OPCClient();
            if (client != null)
                {
                    client.AddMapping(map);
                }
            return client;
        }
        /// <summary>
        /// Gets a bit from a value
        /// </summary>
        /// <param name="value">A value from which to read a bit.</param>
        /// <param name="bit">The bit address.</param>
        /// <returns>Returns the state of the bit.</returns>
        public static bool GetBit(ulong value, int bit)
        {
            return (value & (1u << bit)) != 0;
        }
        /// <summary>
        /// Sets a bit in a vlaue.
        /// </summary>
        /// <param name="value">The value to set the bit in.</param>
        /// <param name="bit">The bit address to set.</param>
        /// <param name="state">The sate of the bit to set.</param>
        public static void SetBit(ref ulong value, int bit, bool state)
        {
            value = state ? (value | (1u << bit)) : (value & ~(1u << bit));
        }

        /// <summary>
        /// Gets a bit from a reference variable.
        /// </summary>
        /// <typeparam name="T">The type of the refvar</typeparam>
        /// <param name="var">The RefVar to get the bit from</param>
        /// <param name="bit">The bit address to get.</param>
        /// <returns>Returns the state of the bit.</returns>
        public static bool GetBit<T>(RefVar<T> var, int bit) where T : struct
        {
            ulong val = Convert.ToUInt64(var.Value);
            return (val & (1u << bit)) != 0;
        }
        /// <summary>
        /// Sets the bit within a refvar object.
        /// </summary>
        /// <typeparam name="T">The type of the refvar</typeparam>
        /// <param name="var">The RefVar to set.</param>
        /// <param name="bit">The bit address.</param>
        /// <param name="state">The state of the bit to set.</param>
        public static void SetBit<T>(ref RefVar<T> var, int bit, bool state) where T : struct
        {
            ulong val = Convert.ToUInt64(var.Value);
            val = state ? (val | (1u << bit)) : (val & ~(1u << bit));
            var.Value = (T)Convert.ChangeType(val, typeof(T));
        }
        /// <summary>
        /// Reads a bit from memory.
        /// </summary>
        /// <param name="address">The address to read.</param>
        /// <returns>Returns the state of the bit.</returns>
        public abstract bool ReadBit(string address);
        /// <summary>
        /// Writes a bit to memory.
        /// </summary>
        /// <param name="address">The memory address to write.</param>
        /// <param name="value">The value of the bit to write.</param>
        public abstract void WriteBit(string address, bool value);
        /// <summary>
        /// Reads a byte from memory.
        /// </summary>
        /// <param name="address">The memory address to read.</param>
        /// <returns>Returns the value of the byte.</returns>
        public abstract byte ReadByte(string address);
        /// <summary>
        /// Writes a byte to memory.
        /// </summary>
        /// <param name="address">The memory address to write.</param>
        /// <param name="value">The byte value to write.</param>
        public abstract void WriteByte(string address, byte value);
        /// <summary>
        /// Reads a word (unsigned short) from memory.
        /// </summary>
        /// <param name="address">The memory address to read.</param>
        /// <returns>Returns the word value.</returns>
        public abstract ushort ReadWord(string address);
        /// <summary>
        /// Writes a word (unsigned short) to memory.
        /// </summary>
        /// <param name="address">The memory address to write.</param>
        /// <param name="value">The value to write.</param>
        public abstract void WriteWord(string address, ushort value);
        /// <summary>
        /// Reads a double word (unsigned integer) from memory.
        /// </summary>
        /// <param name="address">The memory address to read.</param>
        /// <returns>Returns the double word value.</returns>
        public abstract uint ReadDWord(string address);
        /// <summary>
        /// Writes a double word (unsigned integer) to memory.
        /// </summary>
        /// <param name="address">The memory address to write.</param>
        /// <param name="value">The double word to write.</param>
        public abstract void WriteDWord(string address, uint value);
        /// <summary>
        /// Reads a long word (unsigned long) from memory.
        /// </summary>
        /// <param name="address">The address to read.</param>
        /// <returns>Returns a long word value</returns>
        public abstract ulong ReadLWord(string address);
        /// <summary>
        /// Writes a long word (unsigned long) to memory.
        /// </summary>
        /// <param name="address">The address to write.</param>
        /// <param name="value">The value to write.</param>
        public abstract void WriteLWord(string address, ulong value);
        /// <summary>
        /// Creates a RefVar object based on the type of the address given.
        /// </summary>
        /// <param name="address">The address to create a reference for.</param>
        /// <returns></returns>
        public object CreateReference(string address)
        {
            address = address.ToUpperInvariant();

            Type type = typeof(bool);
            if (address.Contains(".")) type = typeof(bool);
            else if (address.Contains("W")) type = typeof(ushort);
            else if (address.Contains("D")) type = typeof(uint);
            else if (address.Contains("X")) type = typeof(byte);

            var refVarType = typeof(RefVar<>).MakeGenericType(type);
            var instance = Activator.CreateInstance(refVarType, this, address);
            return instance;
        }

        /// <summary>
        /// Injects a function into the Javascript Engine so that it can be referenced by Javascript.
        /// </summary>
        /// <param name="name">The name of the function to inject.</param>
        /// <param name="func">The function to call.</param>
        protected void injectCustomFunction(string name, Delegate func)
        {
            JsEngine.SetValue(name, func);
        }
        /// <summary>
        /// Injects an action (a void function) into Javascript so that it can be referenced in the script.
        /// </summary>
        /// <param name="name">The name of the function.</param>
        /// <param name="action">The action to reference.</param>
        protected void injectCustomAction(string name, Action action)
        {
            JsEngine.SetValue(name, action);
        }

        /// <summary>
        /// Injects a global variable into Javascript
        /// </summary>
        /// <param name="name">The name of the variable</param>
        /// <param name="variable">The reference to the variable.</param>
        protected void injectCustomVariable(string name, object variable)
        {
            JsEngine.SetValue(name, variable);
        }

        private void InjectBindings()
        {
            JsEngine.SetValue("readBit", new Func<string, bool>(ReadBit));
            JsEngine.SetValue("writeBit", new Action<string, bool>(WriteBit));
            JsEngine.SetValue("readByte", new Func<string, byte>(ReadByte));
            JsEngine.SetValue("writeByte", new Action<string, byte>(WriteByte));
            JsEngine.SetValue("readWord", new Func<string, ushort>(ReadWord));
            JsEngine.SetValue("writeWord", new Action<string, ushort>(WriteWord));
            JsEngine.SetValue("readDWord", new Func<string, uint>(ReadDWord));
            JsEngine.SetValue("writeDWord", new Action<string, uint>(WriteDWord));
            JsEngine.SetValue("readLWord", new Func<string, ulong>(ReadLWord));
            JsEngine.SetValue("writeLWord", new Action<string, ulong>(WriteLWord));
            JsEngine.SetValue("elapsed", new Func<long>(() => ElapsedMilliseconds));
            JsEngine.SetValue("mapIO", new Action<string>(MapIO));
            JsEngine.SetValue("superviseIO", new Action(SuperviseIO));
            JsEngine.SetValue("writeDWord", new Action<string, uint>(WriteDWord));
            JsEngine.SetValue("log", new Action<string>(Console.WriteLine));
            JsEngine.SetValue("error", new Action<string>(Console.Error.WriteLine));

            JsEngine.SetValue("getBit", new ClrFunctionInstance(JsEngine, "getBit", (thisObj, args) =>
            {
                if (args[0].IsObject())
                {
                    var jsObj = args[0].AsObject();
                    var refObj = jsObj.ToObject();
                    if (refObj != null && refObj.GetType().IsGenericType && refObj.GetType().GetGenericTypeDefinition() == typeof(RefVar<>))
                    {

                        var bit = (int)args[1].AsNumber();
                        var method = typeof(NodalisEngine).GetMethod("GetBit").MakeGenericMethod(refObj.GetType().GetGenericArguments()[0]);
                        return (bool)method.Invoke(null, new[] { refObj, bit });
                    }
                    else
                    {
                        return false;
                    }
                }
                else
                {
                    var value = (uint)args[0].AsNumber();
                    var bit = (int)args[1].AsNumber();
                    return GetBit(value, bit);
                }
            }));

            JsEngine.SetValue("setBit", new ClrFunctionInstance(JsEngine, "setBit", (thisObj, args) =>
            {
                if (args[0].ToObject() is RefVar<bool> refVar)
                {
                    var jsObj = args[0].AsObject();
                    var refObj = jsObj.ToObject();
                    var bit = (int)args[1].AsNumber();
                    var state = args[2].AsBoolean();
                    var method = typeof(NodalisEngine).GetMethod("SetBit", new[] { refObj.GetType(), typeof(int), typeof(bool) });
                    if (method != null)
                    {
                        var parameters = new object[] { refObj, bit, state };
                        method.Invoke(null, parameters);
                    }
                    return JsValue.Undefined;
                }
                else
                {
                    var value = (ulong)args[0].AsNumber();
                    var bit = (int)args[1].AsNumber();
                    var state = args[2].AsBoolean();
                    SetBit(ref value, bit, state);
                    return JsValue.FromObject(JsEngine, value);
                }
            }));

            JsEngine.SetValue("createReference", new Func<string, object>(CreateReference));


            JsEngine.SetValue("newStatic", new ClrFunctionInstance(JsEngine, "newStatic", (thisObj, args) =>
            {
                var key = args[0].AsString();
                var jsCtor = args[1];

                if (!_staticStore.TryGetValue(key, out var instance))
                {
                    var jsInstance = JsEngine.Invoke(jsCtor);
                    _staticStore[key] = jsInstance;
                    return jsInstance;
                }

                return (JsValue)_staticStore[key];
            }));

            JsEngine.SetValue("resolve", new ClrFunctionInstance(JsEngine, "resolve", (thisObj, args) =>
            {
                var val = args[0].ToObject();
                if (val != null && val.GetType().IsGenericType &&
                    val.GetType().GetGenericTypeDefinition() == typeof(RefVar<>))
                {
                    var valueProp = val.GetType().GetProperty("Value");
                    return JsValue.FromObject(JsEngine, valueProp.GetValue(val));
                }
                return args[0];
            }));

            var types = new[] {
                typeof(TON), typeof(TOF), typeof(TP), typeof(AND), typeof(OR), typeof(NOT), typeof(XOR),
                typeof(NAND), typeof(NOR), typeof(SR), typeof(RS), typeof(R_TRIG), typeof(F_TRIG),
                typeof(CTU), typeof(CTD), typeof(CTUD), typeof(EQ), typeof(NE), typeof(LT),
                typeof(GT), typeof(GE), typeof(LE), typeof(MOVE), typeof(SEL), typeof(MUX),
                typeof(MIN), typeof(MAX), typeof(LIMIT), typeof(ASSIGNMENT)
            };
            foreach (var t in types)
                JsEngine.SetValue(t.Name, TypeReference.CreateTypeReference(JsEngine, t));
        }
    }

    /// <summary>
    /// Defines a reference variable, used like a pointer.
    /// </summary>
    /// <typeparam name="T">The type of the reference.</typeparam>
    public class RefVar<T> where T : struct
    {
        /// <summary>
        /// When assigned, the RefVar returns the value it contains.
        /// </summary>
        /// <param name="r">The RefVar to obtain the value from</param>
        public static implicit operator T(RefVar<T> r)
        {
            return r.Value;
        }

        private readonly NodalisEngine _engine;
        private readonly string _address;
        /// <summary>
        /// Constructs a new RefVar based on the NodalisEngine and the PLC address.
        /// </summary>
        /// <param name="engine">The engine to use in referencing memory.</param>
        /// <param name="address">The PLC address from which to create the reference.</param>
        public RefVar(NodalisEngine engine, string address)
        {
            _engine = engine;
            _address = address;
        }
        /// <summary>
        /// Gets or sets the value of the reference.
        /// </summary>
        public T Value
        {
            get => Read();
            set => Write(value);
        }
        /// <summary>
        /// Gets the address of the reference.
        /// </summary>
        public string Address => _address;

        private T Read()
        {
            if (typeof(T) == typeof(bool))
                return (T)(object)_engine.ReadBit(_address);
            if (typeof(T) == typeof(byte))
                return (T)(object)_engine.ReadByte(_address);
            if (typeof(T) == typeof(ushort))
                return (T)(object)_engine.ReadWord(_address);
            if (typeof(T) == typeof(uint))
                return (T)(object)_engine.ReadDWord(_address);
            throw new NotSupportedException($"Unsupported RefVar type: {typeof(T)}");
        }

        private void Write(T value)
        {
            if (typeof(T) == typeof(bool))
                _engine.WriteBit(_address, (bool)(object)value);
            else if (typeof(T) == typeof(byte))
                _engine.WriteByte(_address, (byte)(object)value);
            else if (typeof(T) == typeof(ushort))
                _engine.WriteWord(_address, (ushort)(object)value);
            else if (typeof(T) == typeof(uint))
                _engine.WriteDWord(_address, (uint)(object)value);
            else throw new NotSupportedException($"Unsupported RefVar type: {typeof(T)}");
        }
    }

    /// <summary>
    /// Implements the TON function block.
    /// </summary>
    public class TON
    {
        public bool IN;
        public long PT;
        public bool Q;
        public long ET;
        private long start = 0;

        public void call()
        {
            if (IN)
            {
                if (start == 0) start = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                ET = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - start;
                Q = ET >= PT;
            }
            else
            {
                start = 0;
                ET = 0;
                Q = false;
            }
        }
    }
    /// <summary>
    /// Implements the TOF function block.
    /// </summary>
    public class TOF
    {
        public bool IN;
        public long PT;
        public bool Q;
        public long ET;
        private long start = 0;

        public void call()
        {
            if (IN)
            {
                Q = true;
                start = 0;
                ET = 0;
            }
            else if (Q)
            {
                if (start == 0) start = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                ET = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - start;
                if (ET >= PT) Q = false;
            }
        }
    }
    /// <summary>
    /// Implements the TP function block.
    /// </summary>
    public class TP
    {
        public bool IN;
        public long PT;
        public bool Q;
        public long ET;
        private bool lastIN = false;
        private long start = 0;

        public void call()
        {
            Q = false;
            if (!lastIN && IN)
            {
                lastIN = IN;
                ET = 0;
                start = 0;
            }
            if (IN)
            {
                Q = true;
            }
            else if (lastIN && !IN)
            {
                if (start == 0) start = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                ET = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - start;
                if (PT >= ET) Q = true;
                else lastIN = false;
            }
        }
    }
    /// <summary>
    /// Implements the AND function block.
    /// </summary>
    public class AND
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = IN1 && IN2;
    }
    /// <summary>
    /// Implements the OR function block.
    /// </summary>
    public class OR
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = IN1 || IN2;
    }
    /// <summary>
    /// Implements the NOT function block.
    /// </summary>
    public class NOT
    {
        public bool IN;
        public bool OUT;
        public void call() => OUT = !IN;
    }
    /// <summary>
    /// Implements the XOR function block.
    /// </summary>
    public class XOR
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = IN1 ^ IN2;
    }
    /// <summary>
    /// Implements the NAND function block.
    /// </summary>
    public class NAND
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = !(IN1 && IN2);
    }
    /// <summary>
    /// Implements the NOR function block.
    /// </summary>
    public class NOR
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = !(IN1 || IN2);
    }
    /// <summary>
    /// Implements the SR function block.
    /// </summary>
    public class SR
    {
        public bool S1;
        public bool R;
        public bool Q1;
        public void call()
        {
            if (R) Q1 = false;
            if (S1) Q1 = true;
        }
    }
    /// <summary>
    /// Implements the RS function block.
    /// </summary>
    public class RS
    {
        public bool S;
        public bool R1;
        public bool Q1;
        public void call()
        {
            if (S) Q1 = true;
            if (R1) Q1 = false;
        }
    }
    /// <summary>
    /// Implements the R_TRIG function block.
    /// </summary>
    public class R_TRIG
    {
        public bool CLK;
        public bool OUT;
        private bool last;
        public void call()
        {
            OUT = CLK && !last;
            last = CLK;
        }
    }
    /// <summary>
    /// Implements the F_TRIG function block.
    /// </summary>
    public class F_TRIG
    {
        public bool CLK;
        public bool OUT;
        private bool last;
        public void call()
        {
            OUT = !CLK && last;
            last = CLK;
        }
    }
    /// <summary>
    /// Implements the CTU function block.
    /// </summary>
    public class CTU
    {
        public bool CU;
        public bool R;
        public ushort PV;
        public ushort CV;
        public bool Q;
        private bool lastCU;

        public void call()
        {
            if (R)
                CV = 0;
            else if (CU && !lastCU)
                CV++;
            Q = CV >= PV;
            lastCU = CU;
        }
    }
    /// <summary>
    /// Implements the CTD function block.
    /// </summary>
    public class CTD
    {
        public bool CD;
        public bool LD;
        public ushort PV;
        public ushort CV;
        public bool Q;
        private bool lastCD;

        public void call()
        {
            if (LD)
                CV = PV;
            else if (CD && !lastCD && CV > 0)
                CV--;
            Q = CV == 0;
            lastCD = CD;
        }
    }
    /// <summary>
    /// Implements the CTUD function block.
    /// </summary>
    public class CTUD
    {
        public bool CU;
        public bool CD;
        public bool R;
        public bool LD;
        public ushort PV;
        public ushort CV;
        public bool QU;
        public bool QD;
        private bool lastCU;
        private bool lastCD;

        public void call()
        {
            if (R)
                CV = 0;
            else if (LD)
                CV = PV;
            else
            {
                if (CU && !lastCU) CV++;
                if (CD && !lastCD && CV > 0) CV--;
            }
            QU = CV >= PV;
            QD = CV == 0;
            lastCU = CU;
            lastCD = CD;
        }
    }
    /// <summary>
    /// implements the EQ function block.
    /// </summary>
    public class EQ
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 == IN2;
    }
    /// <summary>
    /// Implements the NE function block.
    /// </summary>
    public class NE
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 != IN2;
    }
    /// <summary>
    /// Implements the LT function block.
    /// </summary>
    public class LT
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 < IN2;
    }
    /// <summary>
    /// Implements GT function block.
    /// </summary>
    public class GT
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 > IN2;
    }
    /// <summary>
    /// Implements the GE function block.
    /// </summary>
    public class GE
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 >= IN2;
    }
    /// <summary>
    /// Implements the LE function block.
    /// </summary>
    public class LE
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 <= IN2;
    }
    /// <summary>
    /// Implements the MOVE function block.
    /// </summary>
    public class MOVE
    {
        public uint IN;
        public uint OUT;
        public void call() => OUT = IN;
    }
    /// <summary>
    /// Implements the SEL function block.
    /// </summary>
    public class SEL
    {
        public bool G;
        public uint IN0;
        public uint IN1;
        public uint OUT;
        public void call() => OUT = G ? IN1 : IN0;
    }
    /// <summary>
    /// Implements the MUX function block.
    /// </summary>
    public class MUX
    {
        public bool K;
        public uint IN0;
        public uint IN1;
        public uint OUT;
        public void call() => OUT = K ? IN1 : IN0;
    }
    /// <summary>
    /// Implements the MIN function block.
    /// </summary>
    public class MIN
    {
        public uint IN1;
        public uint IN2;
        public uint OUT;
        public void call() => OUT = Math.Min(IN1, IN2);
    }
    /// <summary>
    /// Implements the MAX function block.
    /// </summary>
    public class MAX
    {
        public uint IN1;
        public uint IN2;
        public uint OUT;
        public void call() => OUT = Math.Max(IN1, IN2);
    }
    /// <summary>
    /// Implements the LIMIT function block.
    /// </summary>
    public class LIMIT
    {
        public uint MN;
        public uint IN;
        public uint MX;
        public uint OUT;
        public void call()
        {
            if (IN < MN) OUT = MN;
            else if (IN > MX) OUT = MX;
            else OUT = IN;
        }
    }
    /// <summary>
    /// Implements the ASSIGNMENT function block.
    /// </summary>
    public class ASSIGNMENT
    {
        public bool IN;
        public bool OUT;
        public void call() => OUT = IN;
    }
}

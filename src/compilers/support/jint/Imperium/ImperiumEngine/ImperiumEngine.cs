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
/// Imperium Framework for .NET
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
namespace Imperium
{
    public class StaticStore
    {
        private readonly Dictionary<string, JsValue> _store = new();

        public bool TryGetValue(string key, out JsValue value) =>
            _store.TryGetValue(key, out value);

        public JsValue this[string key]
        {
            get => _store[key];
            set => _store[key] = value;
        }
    }


    public enum IOType { Input, Output }

    public class IOMap
    {
        public string localAddress;
        public string remoteAddress;
        public string moduleID;
        public string modulePort;
        public string protocol;
        public IOType direction;
        public int width;
        public int interval;
        public long lastPoll = 0;
        public Dictionary<string, string>? protocolProperties;
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
    
    public abstract class IOClient
    {
        public bool connected = false;
        public string protocol;
        public string moduleID;
        protected List<IOMap> mappings = new();
        protected long lastAttempt = 0;

        protected IOClient(string protocol)
        {
            this.protocol = protocol;
        }

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

        public bool HasMapping(string localAddress) => mappings.Exists(m => m.localAddress == localAddress);

        public void Poll(ImperiumEngine engine)
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
                            }
                        }
                    }
                    catch { }
                }
            }
        }

        public abstract void Connect();
        public abstract bool ReadBit(string address, out int result);
        public abstract bool WriteBit(string address, int value);
        public abstract bool ReadByte(string address, out byte result);
        public abstract bool WriteByte(string address, byte value);
        public abstract bool ReadWord(string address, out ushort result);
        public abstract bool WriteWord(string address, ushort value);
        public abstract bool ReadDWord(string address, out uint result);
        public abstract bool WriteDWord(string address, uint value);
    }

    public class FunctionBlock
    {
        private readonly ObjectInstance _jsObj;
        private readonly Engine _engine;

        public FunctionBlock(Engine engine, string className)
        {
            _engine = engine;
            var constructor = engine.GetValue(className);
            _jsObj = engine.Invoke(constructor).AsObject();            
        }

        public void Set(string name, object value) =>
            _jsObj.Set(name, JsValue.FromObject(_engine, value), throwOnError: true);

        public T Get<T>(string name) =>
            _jsObj.Get(name).ToObject() is T t ? t : default;

        public void Call()
        {
            var callFn = _jsObj.Get("call");
            _engine.Invoke(callFn, _jsObj);  
        }             
    }


    public abstract partial class ImperiumEngine
    {
        private readonly StaticStore _staticStore = new();
        protected readonly Engine JsEngine = new Engine(cfg => { cfg.AllowClr(); });
        private readonly List<IOClient> Clients = new();
        private readonly DateTime StartTime = DateTime.UtcNow;

        public long ElapsedMilliseconds => (long)(DateTime.UtcNow - StartTime).TotalMilliseconds;

        public ImperiumEngine()
        {
            InjectBindings();
        }

        public void Load(string code) => JsEngine.Execute(code);
        public void Setup() => JsEngine.Invoke("setup");
        public void Execute() => JsEngine.Invoke("run");
        public FunctionBlock CreateFunctionBlock(string name)
        {
            return new FunctionBlock(JsEngine, name);
        }

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

        public void SuperviseIO()
        {
            foreach (var client in Clients)
            {
                client.Poll(this);
            }
        }

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

        public static bool GetBit(uint value, int bit)
        {
            return (value & (1u << bit)) != 0;
        }

        public static void SetBit(ref uint value, int bit, bool state)
        {
            value = state ? (value | (1u << bit)) : (value & ~(1u << bit));
        }

        public static bool GetBit<T>(RefVar<T> var, int bit) where T : struct
        {
            uint val = Convert.ToUInt32(var.Value);
            return (val & (1u << bit)) != 0;
        }

        public static void SetBit<T>(ref RefVar<T> var, int bit, bool state) where T : struct
        {
            uint val = Convert.ToUInt32(var.Value);
            val = state ? (val | (1u << bit)) : (val & ~(1u << bit));
            var.Value = (T)Convert.ChangeType(val, typeof(T));
        }

        public abstract bool ReadBit(string address);
        public abstract void WriteBit(string address, bool value);
        public abstract byte ReadByte(string address);
        public abstract void WriteByte(string address, byte value);
        public abstract ushort ReadWord(string address);
        public abstract void WriteWord(string address, ushort value);
        public abstract uint ReadDWord(string address);
        public abstract void WriteDWord(string address, uint value);
        
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
                        var method = typeof(ImperiumEngine).GetMethod("GetBit").MakeGenericMethod(refObj.GetType().GetGenericArguments()[0]);
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
                    var method = typeof(ImperiumEngine).GetMethod("SetBit", new[] { refObj.GetType(), typeof(int), typeof(bool) });
                    if (method != null)
                    {
                        var parameters = new object[] { refObj, bit, state };
                        method.Invoke(null, parameters);
                    }
                    return JsValue.Undefined;
                }
                else
                {
                    var value = (uint)args[0].AsNumber();
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


    public class RefVar<T> where T : struct
        {
            public static implicit operator T(RefVar<T> r)
            {
                return r.Value;
            }

            private readonly ImperiumEngine _engine;
            private readonly string _address;

            public RefVar(ImperiumEngine engine, string address)
            {
                _engine = engine;
                _address = address;
            }

            public T Value
            {
                get => Read();
                set => Write(value);
            }

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

    public class AND
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = IN1 && IN2;
    }

    public class OR
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = IN1 || IN2;
    }

    public class NOT
    {
        public bool IN;
        public bool OUT;
        public void call() => OUT = !IN;
    }

    public class XOR
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = IN1 ^ IN2;
    }

    public class NAND
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = !(IN1 && IN2);
    }

    public class NOR
    {
        public bool IN1;
        public bool IN2;
        public bool OUT;
        public void call() => OUT = !(IN1 || IN2);
    }

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

    public class EQ
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 == IN2;
    }

    public class NE
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 != IN2;
    }

    public class LT
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 < IN2;
    }

    public class GT
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 > IN2;
    }

    public class GE
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 >= IN2;
    }

    public class LE
    {
        public uint IN1;
        public uint IN2;
        public bool OUT;
        public void call() => OUT = IN1 <= IN2;
    }

    public class MOVE
    {
        public uint IN;
        public uint OUT;
        public void call() => OUT = IN;
    }

    public class SEL
    {
        public bool G;
        public uint IN0;
        public uint IN1;
        public uint OUT;
        public void call() => OUT = G ? IN1 : IN0;
    }

    public class MUX
    {
        public bool K;
        public uint IN0;
        public uint IN1;
        public uint OUT;
        public void call() => OUT = K ? IN1 : IN0;
    }

    public class MIN
    {
        public uint IN1;
        public uint IN2;
        public uint OUT;
        public void call() => OUT = Math.Min(IN1, IN2);
    }

    public class MAX
    {
        public uint IN1;
        public uint IN2;
        public uint OUT;
        public void call() => OUT = Math.Max(IN1, IN2);
    }

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

    public class ASSIGNMENT
    {
        public bool IN;
        public bool OUT;
        public void call() => OUT = IN;
    }
}

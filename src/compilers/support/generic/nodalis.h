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

/**
 * @description Nodalis PLC Header
 * @author Nathan Skipper, MTI
 * @version 1.0.2
 * @copyright Apache 2.0
 */
#pragma once
#include <iostream>
#include <cstdint>
#include <string>
#include <cctype>
#include <chrono>
#include <type_traits> // for std::is_same
#include <math.h>
#include <vector>
#include <regex>
#include <stdexcept>
#define JSON_USE_IMPLICIT_CONVERSIONS 1
#define JSON_USE_WIDE_STRING 1
#include "json.hpp"
using json = nlohmann::json;

#pragma region "Program Timing"
extern uint64_t PROGRAM_COUNT;
extern std::chrono::steady_clock::time_point PROGRAM_START;
/**
 * Provides the number of milliseconds since the program started.
 * @returns Returns a ulong of the elapsed time, in milliseconds.
 */
uint64_t elapsed();
#pragma endregion
#pragma region "Memory Handling"

/**
 * Defines the total memory block for this PLC. This memory is a grid of 64x16 "sheets" or pages of memory.
 * The first column is the row of 64, the second column is 16 registers for that sheet.
 * Addresses are reserved based on MTI's standard registers, AI (physical inputs), AO (physical outputs),
 * SW (switch inputs from HMIs), LD (LED outputs to HMIs), BI, BO, CI, CO (all free memory locations for logical operations)
 * PROTECT, BREACH, TROUBLE, STAT1, STAT2, MISC1, MISC2, MISC3.
 * Standard IEC address references break down in the following ways:
 * %I - corresponds to the AI register MEMORY[x][0]. If requesting %IX0, the sheet row would be calculated by r = floor((0*8)/64) - which would yield 0.
 *  To reference each individual byte, we would get uint8_t* bytes = &MEMORY[r][0]; We then can reference the byte within this row by getting b = 0 % 8;
 *  We can then get the value of that byte by referencing bytes[b];
 * %Q - Same as %I, except uint8_t* bytes = &MEMORY[r][1];
 * %M - Virtual memory used for program interface. This takes up the other 14 columns in a row. A reference to %MX[a], where a is a numerical byte address would be used to calculate
 *  r = floor((a*8)/(64*14)). If a is 0, this would yield row 0. If a is 112, it would yield 1. The column would be c = floor(a/(8*14)) + 2, so 0 would yield 2 and 112 would also yield 2.
 *  The byte would be obtained by b = a % 8, so 0 would yield 0, and 112 would yield 0.
 */
extern uint64_t MEMORY[64][16];

inline std::string toLowerCase(const std::string& input) {
    std::string result = input;
    for (size_t i = 0; i < result.size(); ++i) {
        result[i] = std::tolower(result[i]);
    }
    return result;
}

/**
 * Defines the memory space designations for use in getting memory addresses.
 */
enum MEMORY_SPACE : int {
    I, //input memory space
    Q, //output memory space
    M, //Virtual memory space
};

/**
 * Parses a ST address reference into a vector with the memory space, type, byte index, and bit broken out.
 * @param address A string representing the ST address.
 * @returns Returns a vector with four elements: the memory space (Input, Output, or Virtual), the width in bits, the address index, and the bit.
 */
inline std::vector<int> parseAddress(const std::string& address) {
    std::regex pattern(R"(%([IQM])([XBWDL])(\d+)(?:\.(\d+))?)", std::regex::icase);
    std::smatch match;

    if (std::regex_match(address, match, pattern)) {
        std::string space = match[1].str();   // I, Q, M
        std::string type = match[2].str();    // X, W, D, etc.
        std::string index = match[3].str();   // 0, 1, ...
        std::string bit = match[4].matched ? match[4].str() : ""; // bit if present

        
        int ispace = -1;
        int addr = -1;
        int ibit = -1;
        int width = -1;
        if(toLowerCase(space) == "m"){
            ispace = MEMORY_SPACE::M;
        }
        else if(toLowerCase(space) == "q"){
            ispace = MEMORY_SPACE::Q;
        }
        else if(toLowerCase(space) == "i"){
            ispace = MEMORY_SPACE::I;
        }

        if(toLowerCase(type) == "x"){
            width = 8;
        }
        else if(toLowerCase(type) == "w"){
            width = 16;
        }
        else if(toLowerCase(type) == "d"){
            width = 32;
        }
        else if (toLowerCase(type) == "l")
        {
            width = 32;
        }

        if(bit != ""){
            ibit = std::stoi(bit);
        }
        

        addr = std::stoi(index);
        return {ispace, width, addr, ibit};
    }

    throw std::invalid_argument("Invalid address format: " + address);
}

/**
 * Gets a byte pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address
 * @param addr The byte index to pull from.
 * @returns Returns a byte pointer to the memory address, or 0 if there is no memory at the given address.
 */
inline uint8_t* getMemoryByte(int space, int addr){
    uint8_t* ret = 0;
    int r = -1, c = 0, b = 0;
    switch(space){
        case MEMORY_SPACE::Q:
            r = floor((addr*8)/64);
            c = 1;
            b = addr % 8;
        break;
        case MEMORY_SPACE::I:
            r = floor((addr*8)/64);
            c = 0;
            b = addr % 8;
        break;
        case MEMORY_SPACE::M:
            r = floor((addr*8)/(64*14));
            c = floor(addr/112) + 2;
            b = addr % 8;
        break;
    }
    if(r >= 0){
        ret = (uint8_t*)(&MEMORY[r][c]) + b;
    }
    return ret;
}
/**
 * Gets a word pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address.
 * @param addr The word index to pull from.
 * @returns Returns a word pointer to a memory address, or 0 if there is no memory at the given address.
 */
inline uint16_t* getMemoryWord(int space, int addr){
    return (uint16_t*)getMemoryByte(space, addr * 2);
}
/**
 * Gets a double word pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address
 * @param addr The double word index to pull from.
 * @return Returns a double word pointer to a memory address, or 0 if there is no memory at the given address.
 */
inline uint32_t* getMemoryDWord(int space, int addr){
    return (uint32_t*) getMemoryByte(space, addr*4);
}

/**
 * Gets a long word pointer to a memory address in a certain memory space.
 * @param space The memory space from which to get the address
 * @param addr The double word index to pull from.
 * @return Returns a long word pointer to a memory address, or 0 if there is no memory at the given address.
 */
inline uint64_t *getMemoryLWord(int space, int addr)
{
    return (uint64_t *)getMemoryByte(space, addr * 8);
}

/**
 * Reads the 64 bit value at a given address.
 * @param address The address of the memory to get the 64 bit value from.
 * @returns Returns a 64 bit value
 */
uint64_t readLWord(std::string address);

/**
 * Reads the 32 bit value at a given address.
 * @param address The address of the memory to get the 32 bit value from.
 * @returns Returns a 32 bit value
 */
 uint32_t readDWord(std::string address);
/**
 * Reads the 16 bit value at a given address.
 * @param address The address of the memory to get the 16 bit value from.
 * @returns Returns a 16 bit value
 */
 uint16_t readWord(std::string address);
/**
 * Reads the 8 bit value at a given address.
 * @param address The address of the memory to get the 8 bit value from.
 * @returns Returns a 8 bit value
 */
uint8_t readByte(std::string address);
/**
 * Reads the bit value at a given address.
 * @param address The address of the memory to get the bit value from.
 * @returns Returns a boolean value indicating the status of the bit.
 */
bool readBit(std::string address);

/**
 * Writes a 64 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 64 bit value to write to memory.
 */
void writeDWord(std::string address, uint32_t value);

/**
 * Writes a 32 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 32 bit value to write to memory.
 */
void writeDWord(std::string address, uint32_t value);
/**
 * Writes a 16 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 16 bit value to write to memory.
 */
void writeWord(std::string address, uint16_t value);
/**
 * Writes a 8 bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The 8 bit value to write to memory.
 */
void writeByte(std::string address, uint8_t value);
/**
 * Writes a bit value to an address in memory.
 * @param address The address of memory to write to.
 * @param value The bit value to write to memory.
 */
void writeBit(std::string address, bool value);
/**
 * Gets the bit value from a variable
 * @param var A pointer to the variable from which to get the bit.
 * @param bit The number of the bit to get
 * @returns Returns the state of the bit.
 */
bool getBit(void* var, int bit);
/**
 * Sets the bit in a variable.
 * @param var A pointer to the variable to which to set the bit.
 * @param bit The bit to set.
 * @param value The state to set the bit to.
 */
void setBit(void* var, int bit, bool value);
#pragma endregion
#pragma region "Reference Handling"

/**
 * The RefVar class provides a means of declaring a variable with a reference to memory, similar to a pointer.
 */
template<typename T>
class RefVar {
private:
/**
 * The address of the memory.
 */
    std::string address;
    /**
     * The cached value of the address
     */
    T cache;

public:
    /**
     * Constructs a new RefVar object based on a given address
     * @param addr The address to reference.
     */
    RefVar(const std::string& addr) : address(addr) {
        cache = read();
    }

    virtual ~RefVar() = default;
    /**
     * Provides an assignment operator for RefVar so that it acts just like a primitive variable.
     * @param value The value to assign.
     */
    RefVar<T>& operator=(T value) {
        cache = value;
        write(value);
        return *this;
    }

    /**
     * Provides a reference operator to provide a reference to this RefVar.
     */
    RefVar<T>& operator&(){
        return *this;
    }

    /**
     * Provides an expression operator so that a RefVar object can be used in a statement like any other variable and return its memory value.
     */
    operator T() const {
        return read();
    }

private:
    /**
     * Reads the value of the reference from memory.
     */
    T read() const {
        if constexpr (std::is_same_v<T, bool>) {
            return readBit(address);
        } else if constexpr (std::is_same_v<T, uint8_t>) {
            return readByte(address);
        } else if constexpr (std::is_same_v<T, uint16_t>) {
            return readWord(address);
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            return readDWord(address);
        }
        else if constexpr (std::is_same_v<T, uint64_t>)
        {
            return readLWord(address);
        }
        else
        {
            static_assert(!std::is_same_v<T, T>, "Unsupported type for RefVar");
        }
    }
    /**
     * Writes the value to the memory referenced.
     * @param value The value to assign to the memory.
     */
    void write(T value) const {
        if constexpr (std::is_same_v<T, bool>) {
            writeBit(address, value);
        } else if constexpr (std::is_same_v<T, uint8_t>) {
            writeByte(address, value);
        } else if constexpr (std::is_same_v<T, uint16_t>) {
            writeWord(address, value);
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            writeDWord(address, value);
        }
        else if constexpr (std::is_same_v<T, uint64_t>)
        {
            writeLWord(address, value);
        }
        else
        {
            static_assert(!std::is_same_v<T, T>, "Unsupported type for RefVar");
        }
    }
};

/**
 * Gets a bit from a RefVar object.
 * @param var a reference to the RefVar object
 * @param bit The bit to read.
 * @returns Returns the state of the bit.
 */
template<typename T>
bool getBit(RefVar<T>& var, int bit){
    T ref = var;
    return getBit(&ref, bit);
}
/**
 * Sets a bit in a RefVar object
 * @param var A reference to the RefVar object.
 * @param bit The bit to set.
 * @param value The state to set the bit to.
 */
template<typename T>
void setBit(RefVar<T>& var, int bit, bool value){
    T ref = var;
    setBit(&ref, bit, value);
    var = ref;
}
#pragma endregion
#pragma region "IO Handling"
/**
 * Handles the aquisition of IO inputs and the application of IO outputs.
 */
void superviseIO();

// Identifies direction of I/O mapping
enum class IOType {
    Input,
    Output
};

/**
 * Defines a single mapping between a remote IO module address and an internal address in the PLC.
 */
class IOMap {
public:
    /**
     * The direction of the IO interface.
     */
    IOType direction;
    /**
     * The unique identifier of the module. This can be the IP address or a unit ID.
     */
    std::string moduleID;
    /**
     * The port for the module communications port. In TCP/IP coms, this is the TCP port. In serial, this is the serial port.
     */
    std::string modulePort;
    /**
     * The name of the protocol for this map.
     */
    std::string protocol;
    /**
     * Additional properties, as defined by the protocol.
     */
    json additionalProperties;
    /**
     * The remote address, as it is understood by the protocol.
     */
    std::string remoteAddress;  // e.g. "40001"
    /**
     * The local address, which is a memory address reference.
     */
    std::string localAddress;   // e.g. "%MW1"
    /**
     * The bit of the address.
     */
    int bit = -1;               // Optional bit index
    /**
     * The width of the input to read from the remote and store in the address.
     */
    int width = 16;             // 8, 16, or 32
    /**
     * The interval at which the module should be polled for this address.
     */
    int interval = 500;
    /**
     * The last time the module was polled, in Milliseconds.
     */
    uint64_t lastPoll = 0;
    /**
     * Constructs a new IOMap object based on a string of JSON.
     * @param A string of JSON properties.
     */
    IOMap(std::string mapJson);
    IOMap();
};

/**
 * The IOClient is an abstract class implemented by all protocol clients that will be used in Nodalis.
 */
class IOClient {
public:
    /**
    * Indicates whether the IOClient is connected to its remote module.
    */
    bool connected;
    IOClient(const std::string& protocol);
    virtual ~IOClient() = default;

    void addMapping(const IOMap& map);
    bool hasMapping(std::string localAddress);

    void poll(); // Reads and writes mapped I/O

    const std::string& getProtocol() const;
    const std::string& getModuleID() const;
protected:
    std::string protocol;
    std::string moduleID;
    std::vector<IOMap> mappings;
    uint64_t lastAttempt = 0;

    // Must be implemented by derived classes
    virtual bool readBit(const std::string& remote, int& result) = 0;
    virtual bool writeBit(const std::string& remote, int value) = 0;
    virtual bool readByte(const std::string& remote, uint8_t& result) = 0;
    virtual bool writeByte(const std::string& remote, uint8_t value) = 0;
    virtual bool readWord(const std::string& remote, uint16_t& result) = 0;
    virtual bool writeWord(const std::string& remote, uint16_t value) = 0;
    virtual bool readDWord(const std::string& remote, uint32_t& result) = 0;
    virtual bool writeDWord(const std::string& remote, uint32_t value) = 0;
    virtual bool readLWord(const std::string &remote, uint64_t &result) = 0;
    virtual bool writeLWord(const std::string &remote, uint64_t value) = 0;
    virtual void connect() = 0;
    virtual void onMappingAdded(const IOMap& map) { (void)map; }
};

extern std::vector<std::unique_ptr<IOClient>> Clients;

IOClient* findClient(IOMap map);
std::unique_ptr<IOClient> createClient(IOMap& map);


void mapIO(std::string map);

#pragma endregion

#pragma region "Standard Function Blocks"

class TP{
    public:
        bool Q;
        bool IN;
        uint64_t PT;
        uint64_t ET;
    

    void operator()(){
        Q = false;
        if(!lastIN && IN){
            lastIN = IN;
            ET = 0;
            startTime = 0;
        }
        if(IN){
            Q = true;
        }
        else if(lastIN && !IN){
            if(startTime == 0){
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            if(PT >= ET){
                Q = true;
            }
            else{
                lastIN = false;
            }
        }
    }
    private:
        bool lastIN = false;
        uint64_t startTime = 0;
};

// TON: On-delay timer
class TON {
public:
    bool IN;
    uint64_t PT;
    bool Q = false;
    uint64_t ET = 0;

    void operator()() {
        if (IN) {
            if (startTime == 0) {
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            Q = ET >= PT;
        } else {
            startTime = 0;
            ET = 0;
            Q = false;
        }
    }

private:
    uint64_t startTime = 0;
};

// TOF: Off-delay timer
class TOF {
public:
    bool IN;
    uint64_t PT;
    bool Q = false;
    uint64_t ET = 0;

    void operator()() {
        if (IN) {
            Q = true;
            startTime = 0;
            ET = 0;
        } else if (Q) {
            if (startTime == 0) {
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            if (ET >= PT) {
                Q = false;
            }
        }
    }

private:
    uint64_t startTime = 0;
};
template <typename T>
inline T AND(T IN1, T IN2)
{
    return IN1 & IN2;
}
template <typename T>
inline T OR(T IN1, T IN2)
{
    return IN1 | IN2;
}
template <typename T>
inline T XOR(T IN1, T IN2)
{
    return IN1 ^ IN2;
}
template <typename T>
inline T NOR(T IN1, T IN2)
{
    return ~(IN1 | IN2);
}
template <typename T>
inline T NAND(T IN1, T IN2)
{
    return ~(IN1 & IN2);
}
template <typename T>
inline T NOT(T IN)
{
    return ~(IN);
}

// Set/Reset flip-flops
class SR {
public:
    bool S1 = false;
    bool R = false;
    bool Q1 = false;

    void operator()() {
        if (R) Q1 = false;
        if (S1) Q1 = true;
    }
};

class RS {
public:
    bool S = false;
    bool R1 = false;
    bool Q1 = false;

    void operator()() {
        if (S) Q1 = true;
        if (R1) Q1 = false;
    }
};

// Rising-edge Trigger
class R_TRIG {
public:
    bool CLK = false;
    bool Q = false;

    void operator()() {
        Q = CLK && !lastCLK;
        lastCLK = CLK;
    }

private:
    bool lastCLK = false;
};

// Falling-edge Trigger
class F_TRIG {
public:
    bool CLK = false;
    bool Q = false;

    void operator()() {
        Q = !CLK && lastCLK;
        lastCLK = CLK;
    }

private:
    bool lastCLK = false;
};

// Up Counter
class CTU {
public:
    bool CU = false;
    bool R = false;
    uint16_t PV = 0;
    uint16_t CV = 0;
    bool Q = false;

    void operator()() {
        if (R) {
            CV = 0;
        } else if (CU && !lastCU) {
            CV++;
        }
        Q = CV >= PV;
        lastCU = CU;
    }

private:
    bool lastCU = false;
};

// Down Counter
class CTD {
public:
    bool CD = false;
    bool LD = false;
    uint16_t PV = 0;
    uint16_t CV = 0;
    bool Q = false;

    void operator()() {
        if (LD) {
            CV = PV;
        } else if (CD && !lastCD && CV > 0) {
            CV--;
        }
        Q = CV == 0;
        lastCD = CD;
    }

private:
    bool lastCD = false;
};

// Up/Down Counter
class CTUD {
public:
    bool CU = false;
    bool CD = false;
    bool R = false;
    bool LD = false;
    uint16_t PV = 0;
    uint16_t CV = 0;
    bool QU = false;
    bool QD = false;

    void operator()() {
        if (R) {
            CV = 0;
        } else if (LD) {
            CV = PV;
        } else {
            if (CU && !lastCU) CV++;
            if (CD && !lastCD && CV > 0) CV--;
        }

        QU = CV >= PV;
        QD = CV == 0;

        lastCU = CU;
        lastCD = CD;
    }

private:
    bool lastCU = false;
    bool lastCD = false;
};

// Comparison blocks
#define COMP_BLOCK(NAME, EXPR)  \
    template <typename T>       \
    inline T NAME(T IN1, T IN2) \
    {                           \
        return (EXPR);          \
    };

COMP_BLOCK(EQ, IN1 == IN2)
COMP_BLOCK(NE, IN1 != IN2)
COMP_BLOCK(LT, IN1 < IN2)
COMP_BLOCK(GT, IN1 > IN2)
COMP_BLOCK(GE, IN1 >= IN2)
COMP_BLOCK(LE, IN1 <= IN2)
#undef COMP_BLOCK

template <typename T>
inline T MOVE(T IN, T &OUT)
{
    OUT = IN;
};

template <typename T>
inline T SEL(bool G, T IN0, T IN1)
{
    return G ? IN1 : IN0;
};

template <typename T, typename... Ts>
inline T MUX(std::size_t K, T in0, Ts... rest)
{
    constexpr std::size_t N = 1 + sizeof...(Ts);
    if (K >= N)
    {
        throw std::out_of_range("MUX selector out of range");
    }

    auto values = std::tuple<T, Ts...>(in0, rest...);
    return std::apply(
        [K](auto... elems) -> T
        {
            T arr[] = {elems...};
            return arr[K];
        },
        values);
};

// ============================================================
// Type helpers
// ============================================================

template <typename T>
using decay_t = typename std::decay<T>::type;

template <typename T>
inline constexpr bool is_integral_v = std::is_integral<decay_t<T>>::value;

template <typename T>
inline constexpr bool is_floating_v = std::is_floating_point<decay_t<T>>::value;

template <typename T>
inline constexpr bool is_arithmetic_v = std::is_arithmetic<decay_t<T>>::value;

template <typename T>
using enable_if_integral_t = std::enable_if_t<is_integral_v<T>, int>;

template <typename T>
using enable_if_arithmetic_t = std::enable_if_t<is_arithmetic_v<T>, int>;

template <typename T>
using enable_if_floating_t = std::enable_if_t<is_floating_v<T>, int>;

// ============================================================
// Selection / limit
// ============================================================

template <typename T>
inline T MAX(const T &a, const T &b)
{
    return (a < b) ? b : a;
}

template <typename T, typename... Ts>
inline T MAX(const T &a, const T &b, const Ts &...rest)
{
    return MAX(MAX(a, b), rest...);
}

template <typename T>
inline T MIN(const T &a, const T &b)
{
    return (b < a) ? b : a;
}

template <typename T, typename... Ts>
inline T MIN(const T &a, const T &b, const Ts &...rest)
{
    return MIN(MIN(a, b), rest...);
}

template <typename T>
inline T LIMIT(const T &mn, const T &in, const T &mx)
{
    // IEC-style clamp: MIN(MAX(IN, MN), MX)
    return MIN(MAX(in, mn), mx);
}

// ============================================================
// Arithmetic
// ============================================================

template <typename T>
inline T ADD(const T &a, const T &b)
{
    return a + b;
}

template <typename T, typename... Ts>
inline T ADD(const T &a, const T &b, const Ts &...rest)
{
    return ADD(static_cast<T>(a + b), rest...);
}

template <typename T>
inline T MUL(const T &a, const T &b)
{
    return a * b;
}

template <typename T, typename... Ts>
inline T MUL(const T &a, const T &b, const Ts &...rest)
{
    return MUL(static_cast<T>(a * b), rest...);
}

template <typename T>
inline T SUB(const T &a, const T &b)
{
    return a - b;
}

template <typename T>
inline T DIV(const T &a, const T &b)
{
    return a / b;
}

template <typename T, enable_if_integral_t<T> = 0>
inline T MOD(const T &a, const T &b)
{
    return a % b;
}

// Floating-point MOD variant (optional but useful)
template <typename T, enable_if_floating_t<T> = 0>
inline T MOD(const T &a, const T &b)
{
    return std::fmod(a, b);
}

template <typename T>
inline T EXPT(const T &base, const T &exp)
{
    using R = decltype(std::pow(base, exp));
    return static_cast<T>(std::pow(static_cast<R>(base), static_cast<R>(exp)));
}

// ============================================================
// Math / transcendental
// (Return type follows std::<fn> result type)
// ============================================================

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto SIN(T x) -> decltype(std::sin(x))
{
    return std::sin(x);
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto COS(T x) -> decltype(std::cos(x))
{
    return std::cos(x);
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto TAN(T x) -> decltype(std::tan(x))
{
    return std::tan(x);
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto ASIN(T x) -> decltype(std::asin(x))
{
    return std::asin(x);
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto ACOS(T x) -> decltype(std::acos(x))
{
    return std::acos(x);
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto ATAN(T x) -> decltype(std::atan(x))
{
    return std::atan(x);
}

template <typename T, std::enable_if_t<std::is_signed<T>::value, int> = 0>
inline auto ABS(T x) -> decltype(std::abs(x))
{
    return std::abs(x);
}

template <typename T, std::enable_if_t<std::is_unsigned<T>::value, int> = 0>
inline T ABS(T x)
{
    return x;
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto SQRT(T x) -> decltype(std::sqrt(x))
{
    return std::sqrt(x);
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto LN(T x) -> decltype(std::log(x))
{
    return std::log(x); // natural log
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto LOG(T x) -> decltype(std::log10(x))
{
    return std::log10(x); // base-10 log
}

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto EXP(T x) -> decltype(std::exp(x))
{
    return std::exp(x);
}

// ============================================================
// Bit shifts / rotates
// ============================================================

// IEC SHL/SHR usually mean logical shifts on bit strings.
// For signed inputs, behavior can be surprising; recommend unsigned IEC types.

template <typename T, enable_if_integral_t<T> = 0>
inline T SHL(T in, unsigned int n)
{
    constexpr unsigned W = std::numeric_limits<std::make_unsigned_t<T>>::digits;
    if (W == 0)
        return in;
    if (n >= W)
        return static_cast<T>(0);
    using U = std::make_unsigned_t<T>;
    return static_cast<T>(static_cast<U>(in) << n);
}

template <typename T, enable_if_integral_t<T> = 0>
inline T SHR(T in, unsigned int n)
{
    constexpr unsigned W = std::numeric_limits<std::make_unsigned_t<T>>::digits;
    if (W == 0)
        return in;
    if (n >= W)
        return static_cast<T>(0);
    using U = std::make_unsigned_t<T>;
    return static_cast<T>(static_cast<U>(in) >> n); // logical shift right
}

// Rotate left
template <typename T, enable_if_integral_t<T> = 0>
inline T ROL(T in, unsigned int n)
{
    using U = std::make_unsigned_t<T>;
    constexpr unsigned W = std::numeric_limits<U>::digits;
    static_assert(W > 0, "Integral type width must be > 0");

    U x = static_cast<U>(in);
    n %= W;
    if (n == 0)
        return static_cast<T>(x);
    return static_cast<T>((x << n) | (x >> (W - n)));
}

// Rotate right
template <typename T, enable_if_integral_t<T> = 0>
inline T ROR(T in, unsigned int n)
{
    using U = std::make_unsigned_t<T>;
    constexpr unsigned W = std::numeric_limits<U>::digits;
    static_assert(W > 0, "Integral type width must be > 0");

    U x = static_cast<U>(in);
    n %= W;
    if (n == 0)
        return static_cast<T>(x);
    return static_cast<T>((x >> n) | (x << (W - n)));
}

// Type conversion functions
#pragma region "INT_TO..."
inline int32_t INT_TO_DINT(int16_t v)
{
    return (int32_t)v;
}

inline uint16_t INT_TO_UINT(int16_t v)
{
    return (uint16_t)v;
}

inline uint32_t INT_TO_UDINT(int16_t v)
{
    return (uint32_t)v;
}

inline float INT_TO_REAL(int16_t v)
{
    return (float)v;
}

inline double INT_TO_LREAL(int16_t v)
{
    return (double)v;
}

inline uint16_t INT_TO_WORD(int16_t v)
{
    return (uint16_t)v;
}

inline uint32_t INT_TO_DWORD(int16_t v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "DINT_TO..."
inline int16_t DINT_TO_INT(int32_t v)
{
    return (int32_t)v;
}

inline uint16_t DINT_TO_UINT(int32_t v)
{
    return (uint16_t)v;
}

inline uint32_t DINT_TO_UDINT(int32_t v)
{
    return (uint32_t)v;
}

inline float DINT_TO_REAL(int32_t v)
{
    return (float)v;
}

inline double DINT_TO_LREAL(int32_t v)
{
    return (double)v;
}

inline uint16_t DINT_TO_WORD(int32_t v)
{
    return (uint16_t)v;
}

inline uint32_t DINT_TO_DWORD(int32_t v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "UINT_TO..."
inline int32_t UINT_TO_DINT(uint16_t v)
{
    return (int32_t)v;
}

inline int16_t UINT_TO_INT(uint16_t v)
{
    return (uint16_t)v;
}

inline uint32_t UINT_TO_UDINT(int16_t v)
{
    return (uint32_t)v;
}

inline float UINT_TO_REAL(uint16_t v)
{
    return (float)v;
}

inline double UINT_TO_LREAL(uint16_t v)
{
    return (double)v;
}

inline uint16_t UINT_TO_WORD(uint16_t v)
{
    return (uint16_t)v;
}

inline uint32_t UINT_TO_DWORD(uint16_t v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "UDINT_TO..."
inline int32_t UDINT_TO_DINT(uint32_t v)
{
    return (int32_t)v;
}

inline int16_t UDINT_TO_INT(uint32_t v)
{
    return (int16_t)v;
}

inline uint16_t UDINT_TO_UINT(uint32_t v)
{
    return (uint16_t)v;
}

inline float UDINT_TO_REAL(uint32_t v)
{
    return (float)v;
}

inline double UDINT_TO_LREAL(uint32_t v)
{
    return (double)v;
}

inline uint16_t UDINT_TO_WORD(uint32_t v)
{
    return (uint16_t)v;
}

inline uint32_t UDINT_TO_DWORD(uint32_t v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "REAL_TO..."
inline int32_t REAL_TO_DINT(float v)
{
    return (int32_t)v;
}

inline int16_t REAL_TO_INT(float v)
{
    return (int16_t)v;
}

inline uint16_t REAL_TO_UINT(float v)
{
    return (uint16_t)v;
}

inline float REAL_TO_UDINT(float v)
{
    return (float)v;
}

inline double REAL_TO_LREAL(float v)
{
    return (double)v;
}

inline uint16_t REAL_TO_WORD(float v)
{
    return (uint16_t)v;
}

inline uint32_t REAL_TO_DWORD(float v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "LREAL_TO..."
inline int32_t LREAL_TO_DINT(double v)
{
    return (int32_t)v;
}

inline int16_t LREAL_TO_INT(double v)
{
    return (int16_t)v;
}

inline uint16_t LREAL_TO_UINT(double v)
{
    return (uint16_t)v;
}

inline float LREAL_TO_UDINT(double v)
{
    return (float)v;
}

inline float LREAL_TO_REAL(double v)
{
    return (float)v;
}

inline uint16_t LREAL_TO_WORD(double v)
{
    return (uint16_t)v;
}

inline uint32_t LREAL_TO_DWORD(double v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "WORD_TO..."
inline int32_t WORD_TO_DINT(uint16_t v)
{
    return (int32_t)v;
}

inline int16_t WORD_TO_INT(uint16_t v)
{
    return (uint16_t)v;
}

inline uint32_t WORD_TO_UDINT(int16_t v)
{
    return (uint32_t)v;
}

inline float WORD_TO_REAL(uint16_t v)
{
    return (float)v;
}

inline double WORD_TO_LREAL(uint16_t v)
{
    return (double)v;
}

inline uint16_t WORD_TO_UINT(uint16_t v)
{
    return (uint16_t)v;
}

inline uint32_t WORD_TO_DWORD(uint16_t v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma region "DWORD_TO..."
inline int32_t DWORD_TO_DINT(uint32_t v)
{
    return (int32_t)v;
}

inline int16_t DWORD_TO_INT(uint32_t v)
{
    return (int16_t)v;
}

inline uint16_t DWORD_TO_UINT(uint32_t v)
{
    return (uint16_t)v;
}

inline float DWORD_TO_REAL(uint32_t v)
{
    return (float)v;
}

inline double DWORD_TO_LREAL(uint32_t v)
{
    return (double)v;
}

inline uint16_t DWORD_TO_WORD(uint32_t v)
{
    return (uint16_t)v;
}

inline uint32_t DWORD_TO_UDINT(uint32_t v)
{
    return (uint32_t)v;
}
#pragma endregion

#pragma endregion

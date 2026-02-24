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

#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <memory>
#include <string>
#include <type_traits>
#include <vector>
#include <Arduino.h>

#ifdef abs
#undef abs
#endif

#ifdef min
#undef min
#endif

#ifdef max
#undef max
#endif

#define JSON_USE_IMPLICIT_CONVERSIONS 1
#define JSON_USE_WIDE_STRING 1
#include "json.hpp"
using json = nlohmann::json;

extern uint64_t PROGRAM_COUNT;
extern uint64_t MEMORY[64][16];

uint64_t elapsed();

inline std::string toLowerCase(const std::string &input)
{
    std::string result = input;
    for (size_t i = 0; i < result.size(); ++i)
    {
        result[i] = static_cast<char>(std::tolower(static_cast<unsigned char>(result[i])));
    }
    return result;
}

enum MEMORY_SPACE : int
{
    I,
    Q,
    M,
};

inline std::vector<int> parseAddress(const std::string &address)
{
    if (address.size() < 4 || address[0] != '%')
    {
        return {-1, -1, -1, -1};
    }

    const char spaceChar = static_cast<char>(std::toupper(static_cast<unsigned char>(address[1])));
    const char typeChar = static_cast<char>(std::toupper(static_cast<unsigned char>(address[2])));

    int ispace = -1;
    if (spaceChar == 'I')
        ispace = MEMORY_SPACE::I;
    if (spaceChar == 'Q')
        ispace = MEMORY_SPACE::Q;
    if (spaceChar == 'M')
        ispace = MEMORY_SPACE::M;

    int width = -1;
    if (typeChar == 'X')
        width = 8;
    if (typeChar == 'B')
        width = 8;
    if (typeChar == 'W')
        width = 16;
    if (typeChar == 'D')
        width = 32;
    if (typeChar == 'L')
        width = 64;

    size_t i = 3;
    while (i < address.size() && std::isspace(static_cast<unsigned char>(address[i])))
    {
        ++i;
    }

    if (i >= address.size() || !std::isdigit(static_cast<unsigned char>(address[i])))
    {
        return {-1, -1, -1, -1};
    }

    int addr = 0;
    while (i < address.size() && std::isdigit(static_cast<unsigned char>(address[i])))
    {
        addr = (addr * 10) + (address[i] - '0');
        ++i;
    }

    int bit = -1;
    if (i < address.size() && address[i] == '.')
    {
        ++i;
        if (i >= address.size() || !std::isdigit(static_cast<unsigned char>(address[i])))
        {
            return {-1, -1, -1, -1};
        }
        bit = 0;
        while (i < address.size() && std::isdigit(static_cast<unsigned char>(address[i])))
        {
            bit = (bit * 10) + (address[i] - '0');
            ++i;
        }
    }

    return {ispace, width, addr, bit};
}

inline uint8_t *getMemoryByte(int space, int addr)
{
    uint8_t *ret = nullptr;
    int r = -1;
    int c = 0;
    int b = 0;
    switch (space)
    {
    case MEMORY_SPACE::Q:
        r = (addr * 8) / 64;
        c = 1;
        b = addr % 8;
        break;
    case MEMORY_SPACE::I:
        r = (addr * 8) / 64;
        c = 0;
        b = addr % 8;
        break;
    case MEMORY_SPACE::M:
        r = (addr * 8) / (64 * 14);
        c = (addr / 112) + 2;
        b = addr % 8;
        break;
    default:
        return nullptr;
    }

    if (r < 0 || r >= 64 || c < 0 || c >= 16)
    {
        return nullptr;
    }

    ret = reinterpret_cast<uint8_t *>(&MEMORY[r][c]) + b;
    return ret;
}

inline uint16_t *getMemoryWord(int space, int addr)
{
    return reinterpret_cast<uint16_t *>(getMemoryByte(space, addr * 2));
}

inline uint32_t *getMemoryDWord(int space, int addr)
{
    return reinterpret_cast<uint32_t *>(getMemoryByte(space, addr * 4));
}

inline uint64_t *getMemoryLWord(int space, int addr)
{
    return reinterpret_cast<uint64_t *>(getMemoryByte(space, addr * 8));
}

uint64_t readLWord(std::string address);
uint32_t readDWord(std::string address);
uint16_t readWord(std::string address);
uint8_t readByte(std::string address);
bool readBit(std::string address);

void writeLWord(std::string address, uint64_t value);
void writeDWord(std::string address, uint32_t value);
void writeWord(std::string address, uint16_t value);
void writeByte(std::string address, uint8_t value);
void writeBit(std::string address, bool value);

bool getBit(void *var, int bit);
void setBit(void *var, int bit, bool value);

template <typename T>
class RefVar
{
private:
    std::string address;

public:
    explicit RefVar(const std::string &addr) : address(addr) {}
    virtual ~RefVar() = default;

    RefVar<T> &operator=(T value)
    {
        write(value);
        return *this;
    }

    RefVar<T> &operator&() { return *this; }

    operator T() const { return read(); }

private:
    T read() const
    {
        if (std::is_same<T, bool>::value)
            return static_cast<T>(readBit(address));
        if (std::is_same<T, uint8_t>::value)
            return static_cast<T>(readByte(address));
        if (std::is_same<T, uint16_t>::value)
            return static_cast<T>(readWord(address));
        if (std::is_same<T, uint32_t>::value)
            return static_cast<T>(readDWord(address));
        if (std::is_same<T, uint64_t>::value)
            return static_cast<T>(readLWord(address));
        return static_cast<T>(0);
    }

    void write(T value) const
    {
        if (std::is_same<T, bool>::value)
            writeBit(address, value != 0);
        if (std::is_same<T, uint8_t>::value)
            writeByte(address, static_cast<uint8_t>(value));
        if (std::is_same<T, uint16_t>::value)
            writeWord(address, static_cast<uint16_t>(value));
        if (std::is_same<T, uint32_t>::value)
            writeDWord(address, static_cast<uint32_t>(value));
        if (std::is_same<T, uint64_t>::value)
            writeLWord(address, static_cast<uint64_t>(value));
    }
};

template <typename T>
bool getBit(RefVar<T> &var, int bit)
{
    T ref = var;
    return getBit(&ref, bit);
}

template <typename T>
void setBit(RefVar<T> &var, int bit, bool value)
{
    T ref = var;
    setBit(&ref, bit, value);
    var = ref;
}

void superviseIO();

enum class IOType
{
    Input,
    Output
};

class IOMap
{
public:
    IOType direction = IOType::Input;
    std::string moduleID;
    std::string modulePort;
    std::string protocol;
    json additionalProperties;
    std::string remoteAddress;
    std::string localAddress;
    int bit = -1;
    int width = 16;
    int interval = 500;
    uint64_t lastPoll = 0;

    explicit IOMap(std::string mapJson);
    IOMap();
};

class IOClient
{
public:
    bool connected;
    explicit IOClient(const std::string &protocol);
    virtual ~IOClient() = default;

    void addMapping(const IOMap &map);
    bool hasMapping(std::string localAddress);
    void poll();

    const std::string &getProtocol() const;
    const std::string &getModuleID() const;

protected:
    std::string protocol;
    std::string moduleID;
    std::vector<IOMap> mappings;
    uint64_t lastAttempt = 0;

    virtual bool readBit(const std::string &remote, int &result) = 0;
    virtual bool writeBit(const std::string &remote, int value) = 0;
    virtual bool readByte(const std::string &remote, uint8_t &result) = 0;
    virtual bool writeByte(const std::string &remote, uint8_t value) = 0;
    virtual bool readWord(const std::string &remote, uint16_t &result) = 0;
    virtual bool writeWord(const std::string &remote, uint16_t value) = 0;
    virtual bool readDWord(const std::string &remote, uint32_t &result) = 0;
    virtual bool writeDWord(const std::string &remote, uint32_t value) = 0;
    virtual bool readLWord(const std::string &remote, uint64_t &result) = 0;
    virtual bool writeLWord(const std::string &remote, uint64_t value) = 0;
    virtual void connect() = 0;
    virtual void onMappingAdded(const IOMap &map)
    {
        (void)map;
    }
};

extern std::vector<std::unique_ptr<IOClient>> Clients;

IOClient *findClient(IOMap map);
std::unique_ptr<IOClient> createClient(IOMap &map);
void mapIO(std::string map);

class TP
{
public:
    bool Q = false;
    bool IN = false;
    uint64_t PT = 0;
    uint64_t ET = 0;

    void operator()()
    {
        Q = false;
        if (!lastIN && IN)
        {
            lastIN = IN;
            ET = 0;
            startTime = 0;
        }
        if (IN)
        {
            Q = true;
        }
        else if (lastIN && !IN)
        {
            if (startTime == 0)
            {
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            if (PT >= ET)
            {
                Q = true;
            }
            else
            {
                lastIN = false;
            }
        }
    }

private:
    bool lastIN = false;
    uint64_t startTime = 0;
};

class TON
{
public:
    bool IN = false;
    uint64_t PT = 0;
    bool Q = false;
    uint64_t ET = 0;

    void operator()()
    {
        if (IN)
        {
            if (startTime == 0)
            {
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            Q = ET >= PT;
        }
        else
        {
            startTime = 0;
            ET = 0;
            Q = false;
        }
    }

private:
    uint64_t startTime = 0;
};

class TOF
{
public:
    bool IN = false;
    uint64_t PT = 0;
    bool Q = false;
    uint64_t ET = 0;

    void operator()()
    {
        if (IN)
        {
            Q = true;
            startTime = 0;
            ET = 0;
        }
        else if (Q)
        {
            if (startTime == 0)
            {
                startTime = elapsed();
            }
            ET = elapsed() - startTime;
            if (ET >= PT)
            {
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
class SR
{
public:
    bool S1 = false;
    bool R = false;
    bool Q1 = false;

    void operator()()
    {
        if (R)
            Q1 = false;
        if (S1)
            Q1 = true;
    }
};

class RS
{
public:
    bool S = false;
    bool R1 = false;
    bool Q1 = false;

    void operator()()
    {
        if (S)
            Q1 = true;
        if (R1)
            Q1 = false;
    }
};

// Rising-edge Trigger
class R_TRIG
{
public:
    bool CLK = false;
    bool OUT = false;

    void operator()()
    {
        OUT = CLK && !lastCLK;
        lastCLK = CLK;
    }

private:
    bool lastCLK = false;
};

// Falling-edge Trigger
class F_TRIG
{
public:
    bool CLK = false;
    bool OUT = false;

    void operator()()
    {
        OUT = !CLK && lastCLK;
        lastCLK = CLK;
    }

private:
    bool lastCLK = false;
};

// Up Counter
class CTU
{
public:
    bool CU = false;
    bool R = false;
    uint16_t PV = 0;
    uint16_t CV = 0;
    bool Q = false;

    void operator()()
    {
        if (R)
        {
            CV = 0;
        }
        else if (CU && !lastCU)
        {
            CV++;
        }
        Q = CV >= PV;
        lastCU = CU;
    }

private:
    bool lastCU = false;
};

// Down Counter
class CTD
{
public:
    bool CD = false;
    bool LD = false;
    uint16_t PV = 0;
    uint16_t CV = 0;
    bool Q = false;

    void operator()()
    {
        if (LD)
        {
            CV = PV;
        }
        else if (CD && !lastCD && CV > 0)
        {
            CV--;
        }
        Q = CV == 0;
        lastCD = CD;
    }

private:
    bool lastCD = false;
};

// Up/Down Counter
class CTUD
{
public:
    bool CU = false;
    bool CD = false;
    bool R = false;
    bool LD = false;
    uint16_t PV = 0;
    uint16_t CV = 0;
    bool QU = false;
    bool QD = false;

    void operator()()
    {
        if (R)
        {
            CV = 0;
        }
        else if (LD)
        {
            CV = PV;
        }
        else
        {
            if (CU && !lastCU)
                CV++;
            if (CD && !lastCD && CV > 0)
                CV--;
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

template <typename T, enable_if_arithmetic_t<T> = 0>
inline auto ABS(T x) -> decltype(std::abs(x))
{
    return std::abs(x);
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

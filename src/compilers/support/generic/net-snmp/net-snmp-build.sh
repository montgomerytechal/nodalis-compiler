#!/bin/sh

# Copyright [2026] Nathan Skipper
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Builds the Net-SNMP static client library for the same targets and with the
# same toolchains used by bacnet-stack/bacnet-build.sh.
#
# This file must be placed in the root of a Net-SNMP source checkout to work.
# Output directories are created under dist/[os]-[arch]. Each contains:
#   include/net-snmp/...  public and generated headers
#   lib/libnetsnmp.a      static SNMP client library

set -eu

SCRIPT_DIR=$(printf %s "$(CDPATH= cd -- "$(dirname "$0")" && pwd)")

clean_source_tree() {
    if [ -f "$SCRIPT_DIR/Makefile" ]; then
        make -C "$SCRIPT_DIR" distclean >/dev/null 2>&1 || make -C "$SCRIPT_DIR" clean
    fi
}

build_target() {
    TARGET=$1
    HOST=$2
    CC_VALUE=$3
    AR_VALUE=$4
    RANLIB_VALUE=$5

    DEST="$SCRIPT_DIR/dist/$TARGET"
    echo "Making Net-SNMP for $TARGET To $DEST"

    clean_source_tree
    rm -rf "$DEST"
    mkdir -p "$DEST/include" "$DEST/lib"

    HOST_OPTION=""
    if [ -n "$HOST" ]; then
        HOST_OPTION="--host=$HOST"
    fi

    # Nodalis currently needs only numeric-OID SNMP v1/v2c manager requests.
    # Excluding MIB loading, applications, agents, scripts, and OpenSSL keeps
    # the archive self-contained and avoids installing a runtime MIB directory.
    CC="$CC_VALUE" \
    AR="$AR_VALUE" \
    RANLIB="$RANLIB_VALUE" \
    "$SCRIPT_DIR/configure" \
        $HOST_OPTION \
        --prefix="$DEST" \
        --with-defaults \
        --disable-shared \
        --enable-static \
        --disable-agent \
        --disable-applications \
        --disable-manuals \
        --disable-scripts \
        --disable-mibs \
        --disable-mib-loading \
        --disable-embedded-perl \
        --without-perl-modules \
        --without-python-modules \
        --without-openssl \
        --with-transports=UDP

    make -C "$SCRIPT_DIR/snmplib"

    cp "$SCRIPT_DIR/snmplib/.libs/libnetsnmp.a" "$DEST/lib/libnetsnmp.a"
    rsync -a --delete \
        --prune-empty-dirs \
        --include '*/' \
        --include '*.h' --include '*.hpp' \
        --exclude '*' \
        "$SCRIPT_DIR/include/" "$DEST/include/"

    if [ -f "$SCRIPT_DIR/COPYING" ]; then
        cp "$SCRIPT_DIR/COPYING" "$DEST/COPYING"
    fi
}

# Make for Linux-arm
build_target \
    linux-arm \
    arm-linux-gnueabi \
    arm-linux-gnueabi-gcc \
    arm-linux-gnueabi-ar \
    arm-linux-gnueabi-ranlib

# Make for Linux-arm64
build_target \
    linux-arm64 \
    aarch64-linux-gnu \
    aarch64-linux-gnu-gcc \
    aarch64-linux-gnu-ar \
    aarch64-linux-gnu-ranlib

# Make for Linux-x64
build_target \
    linux-x64 \
    x86_64-linux-gnu \
    x86_64-linux-gnu-gcc \
    x86_64-linux-gnu-ar \
    x86_64-linux-gnu-ranlib

# Make for MacOS arm64
build_target \
    macos-arm64 \
    aarch64-apple-darwin \
    "clang -arch arm64" \
    llvm-ar \
    llvm-ranlib

# Make for MacOS x64
build_target \
    macos-x64 \
    x86_64-apple-darwin \
    "clang -arch x86_64" \
    llvm-ar \
    llvm-ranlib

# Make for Windows x64
build_target \
    windows-x64 \
    x86_64-w64-mingw32 \
    x86_64-w64-mingw32-gcc \
    x86_64-w64-mingw32-ar \
    x86_64-w64-mingw32-ranlib

# Make for Windows arm64
build_target \
    windows-arm64 \
    aarch64-w64-mingw32 \
    /opt/llvm-mingw/bin/aarch64-w64-mingw32-gcc \
    /opt/llvm-mingw/bin/aarch64-w64-mingw32-ar \
    /opt/llvm-mingw/bin/aarch64-w64-mingw32-ranlib

clean_source_tree
echo "Finished building Net-SNMP static libraries under $SCRIPT_DIR/dist."

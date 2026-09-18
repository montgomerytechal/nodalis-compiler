#Builds the open62541 static library for macos, linux, and windows in arm, arm64, and x64.
#This file must be in the root of the bacnet-stack repo to work.
#Output directories are created under lib/[os]-[arch].
SCRIPT_DIR=$(printf %s $(CDPATH= cd -- "$(dirname "$0")" && pwd))

#Make for Windows arm64
DEST=$SCRIPT_DIR/lib/windows-arm64
echo "Making Windows arm64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
/opt/llvm-mingw/bin/aarch64-w64-mingw32-gcc -std=c11 -D_DEFAULT_SOURCE -c "$SCRIPT_DIR/src/win32/open62541.c" -o "$DEST/open62541.lib"

#Make for Windows arm64
SCRIPT_DIR=$(printf %s $(CDPATH= cd -- "$(dirname "$0")" && pwd))
DEST=$SCRIPT_DIR/lib/windows-x64
echo "Making Windows x64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
/opt/llvm-mingw/bin/x86_64-w64-mingw32-gcc -std=c11 -D_DEFAULT_SOURCE -c "$SCRIPT_DIR/src/win32/open62541.c" -o "$DEST/open62541.lib"

#Make for Linux Arm
DEST=$SCRIPT_DIR/lib/linux-arm
echo "Making Linux Arm To $DEST"
rm -rf $DEST
mkdir -p $DEST
arm-linux-gnueabi-gcc -std=c11 -D_GNU_SOURCE -D_DEFAULT_SOURCE -D_XOPEN_SOURCE=600 -c "$SCRIPT_DIR/src/posix/open62541.c" -o "$DEST/open62541.o"

#Make for Linux Arm64
DEST=$SCRIPT_DIR/lib/linux-arm64
echo "Making Linux Arm64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
aarch64-linux-gnu-gcc -std=c11 -D_GNU_SOURCE -D_DEFAULT_SOURCE -D_XOPEN_SOURCE=600 -c "$SCRIPT_DIR/src/posix/open62541.c" -o "$DEST/open62541.o"

#Make for Linux x64
DEST=$SCRIPT_DIR/lib/linux-x64
echo "Making Linux x64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
x86_64-linux-gnu-gcc -std=c11 -D_GNU_SOURCE -D_DEFAULT_SOURCE -D_XOPEN_SOURCE=600 -c "$SCRIPT_DIR/src/posix/open62541.c" -o "$DEST/open62541.o"

#Make for MacOS x64
DEST=$SCRIPT_DIR/lib/macos-x64
echo "Making Macos x64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
clang -arch x86_64 -std=c11 -D_DEFAULT_SOURCE -c "$SCRIPT_DIR/src/posix/open62541.c" -o "$DEST/open62541.o"

#Make for MacOS arm64
DEST=$SCRIPT_DIR/lib/macos-arm64
echo "Making Macos arm64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
clang -arch arm64 -std=c11 -D_DEFAULT_SOURCE -c "$SCRIPT_DIR/src/posix/open62541.c" -o "$DEST/open62541.o"
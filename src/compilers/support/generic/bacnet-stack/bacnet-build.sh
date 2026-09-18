#Builds the bacnet-stack static library for macos, linux, and windows in arm, arm64, and x64.
#This file must be in the root of the bacnet-stack repo to work.
#Output directories are created under dist/[os]-[arch].
SCRIPT_DIR=$(printf %s $(CDPATH= cd -- "$(dirname "$0")" && pwd))

#Make for Linux-arm
DEST=$SCRIPT_DIR/dist/linux-arm
echo "Making Linux-Arm To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=linux \
    BACNET_LIB_DIR=$DEST \
    CC=arm-linux-gnueabi-gcc \
    AR=arm-linux-gnueabi-ar \
    RANLIB=arm-linux-gnueabi-ranlib

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/linux"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/linux/"


#Make for Linux-arm64
DEST=$(printf %s "$SCRIPT_DIR/dist/macos-arm64")
echo "Making Linux-Arm64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=linux \
    BACNET_LIB_DIR=$DEST \
    CC=aarch64-linux-gnu-gcc \
    AR=aarch64-linux-gnu-ar \
    RANLIB=aarch64-linux-gnu-ranlib 

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/linux"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/linux/"

#Make for Linux-x64
DEST=$SCRIPT_DIR/dist/linux-x64
echo "Making Linux-x64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=linux \
    BACNET_LIB_DIR=$DEST \
    CC=x86_64-linux-gnu-gcc \
    AR=x86_64-linux-gnu-ar \
    RANLIB=x86_64-linux-gnu-ranlib 

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/linux"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/linux/"

#Make for MacOS arm64
DEST="$SCRIPT_DIR/dist/macos-arm64"
echo "Making MacOS arm64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=bsd \
    BACNET_LIB_DIR=$DEST \
    CC="clang -arch arm64" \
    AR=llvm-ar \
    RANLIB=llvm-ranlib 

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/bsd"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/bsd/"

#Make for MacOS x64
DEST="$SCRIPT_DIR/dist/macos-x64"
echo "Making MacOS x64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=bsd \
    BACNET_LIB_DIR=$DEST \
    CC="clang -arch x86_64" \
    AR=llvm-ar \
    RANLIB=llvm-ranlib 

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/bsd"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/bsd/"

#Make for Windows x64
DEST=$SCRIPT_DIR/dist/windows-x64
echo "Making Windows x64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=win32 \
    BACNET_LIB_DIR=$DEST \
    CC=x86_64-w64-mingw32-gcc \
    AR=x86_64-w64-mingw32-ar \
    RANLIB=x86_64-w64-mingw32-ranlib 

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/win32"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/win32/"

#Make for Windows arm64
DEST=$SCRIPT_DIR/dist/windows-arm64
echo "Making Windows arm64 To $DEST"
rm -rf $DEST
mkdir -p $DEST
make clean
make library \
    BACDL=bip \
    BACNET_PORT=win32 \
    BACNET_LIB_DIR=$DEST \
    CC=/opt/llvm-mingw/bin/aarch64-w64-mingw32-gcc \
    AR=/opt/llvm-mingw/bin/aarch64-w64-mingw32-ar \
    RANLIB=/opt/llvm-mingw/bin/aarch64-w64-mingw32-ranlib

mkdir -p "$DEST/include/bacnet"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      src/bacnet/ "$DEST/include/bacnet/"

mkdir -p "$DEST/include/ports/win32"
rsync -a --delete \
      --prune-empty-dirs \
      --include '*/' \
      --include '*.h' --include '*.hpp' \
      --exclude '*' \
      ports/linux/ "$DEST/include/ports/win32/"
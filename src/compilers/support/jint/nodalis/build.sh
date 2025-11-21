#!/bin/bash
set -e

echo "Building NodalisEngine..."
dotnet build NodalisEngine/NodalisEngine.csproj

echo "Publishing NodalisPLC for Windows..."
dotnet publish NodalisPLC/NodalisPLC.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/win-x64
cp "NodalisPLC/bootstrap.bat" publish/win-x64/bootstrap.bat

echo "Publishing NodalisPLC for Linux..."
dotnet publish NodalisPLC/NodalisPLC.csproj -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/linux-x64
cp "NodalisPLC/bootstrap.sh" publish/linux-x64/bootstrap.sh

echo "Publishing NodalisPLC for macOS..."
dotnet publish NodalisPLC/NodalisPLC.csproj -c Release -r osx-x64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/osx-x64
cp "NodalisPLC/bootstrap.sh" publish/osx-x64/bootstrap.sh

echo "Publishing NodalisPLC for macOS ARM64..."
dotnet publish NodalisPLC/NodalisPLC.csproj -c Release -r osx-arm64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/osx-arm64
cp "NodalisPLC/bootstrap.sh" publish/osx-arm64/bootstrap.sh

echo Publishing NodalisPLC for Linux ARM 32-bit...
dotnet publish NodalisPLC/NodalisPLC.csproj -c Release -r linux-arm --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/linux-arm
cp "NodalisPLC/bootstrap.sh" publish/linux-arm/bootstrap.sh

echo Publishing NodalisPLC for Linux ARM 64-bit...
dotnet publish NodalisPLC/NodalisPLC.csproj -c Release -r linux-arm64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/linux-arm64
cp "NodalisPLC/bootstrap.sh" publish/linux-arm64/bootstrap.sh

echo "Build complete."

@echo off
echo Building ImperiumEngine...
dotnet build ImperiumEngine/ImperiumEngine.csproj

echo Publishing ImperiumPLC for Windows...
dotnet publish ImperiumPLC/ImperiumPLC.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/win-x64
copy "ImperiumPLC/bootstrap.bat" publish/win-x64/bootstrap.bat

echo Publishing ImperiumPLC for Linux...
dotnet publish ImperiumPLC/ImperiumPLC.csproj -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/linux-x64
copy "ImperiumPLC/bootstrap.sh" publish/linux-x64/bootstrap.sh

echo Publishing ImperiumPLC for macOS...
dotnet publish ImperiumPLC/ImperiumPLC.csproj -c Release -r osx-x64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/osx-x64
copy "ImperiumPLC/bootstrap.sh" publish/osx-x64/bootstrap.sh

echo Publishing ImperiumPLC for Raspberry Pi ARM 32-bit...
dotnet publish ImperiumPLC/ImperiumPLC.csproj -c Release -r linux-arm --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/linux-arm
copy "ImperiumPLC/bootstrap.sh" publish/linux-arm/bootstrap.sh

echo Publishing ImperiumPLC for Raspberry Pi ARM 64-bit...
dotnet publish ImperiumPLC/ImperiumPLC.csproj -c Release -r linux-arm64 --self-contained true /p:PublishSingleFile=true /p:Trim=true -o publish/linux-arm64
copy "ImperiumPLC/bootstrap.sh" publish/linux-arm64/bootstrap.sh

echo Build complete.

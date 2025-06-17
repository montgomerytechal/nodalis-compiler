@echo off
set SCRIPT={script}  REM to be replaced by JSCompiler

set DIR=%~dp0
"%DIR%ImperiumPLC.exe" %SCRIPT%

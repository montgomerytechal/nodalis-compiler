<#
.SYNOPSIS
Reads SNMP MIB files and produces a grouped text report of their objects.

.DESCRIPTION
Uses the Net-SNMP snmptranslate executable to resolve each OBJECT-TYPE in the
MIB files found in MibDirectory. Files are processed alphabetically. The report
groups objects under their MIB module and includes the numeric OID, value type,
and any enumerated values declared by the object.

This script requires the Net-SNMP command-line binaries. Download Net-SNMP from
https://www.net-snmp.org/download.html and supply the directory containing
snmptranslate.exe (Windows) or snmptranslate (Linux/macOS) through SnmpBinPath.
The static libraries used to build Nodalis do not include this command-line
executable.

.PARAMETER SnmpBinPath
Directory containing the Net-SNMP command-line binaries. The script looks for
snmptranslate.exe and then snmptranslate in this directory. You may also supply
the complete path to the snmptranslate executable itself. When omitted, this
defaults to the bin directory beneath the directory containing this script.

.PARAMETER MibDirectory
Directory containing the MIB files. Files whose contents contain a valid
"<module> DEFINITIONS ::= BEGIN" declaration are treated as MIB files. Keep
imported/dependency MIBs in this directory so snmptranslate can resolve them.
When omitted, this defaults to share\snmp\mibs beneath the directory containing
this script.

.PARAMETER Filter
Optional comma-delimited list of case-insensitive literal filters. A MIB is
included when any filter occurs in either its filename or its contents. For
example, use "ARUBA,FAN,ENTITY" to include MIB files matching any of those
terms. Empty entries and surrounding whitespace are ignored. When omitted or
empty, every recognized MIB in MibDirectory is included.

.PARAMETER OutputFile
Path of the text report to create. Existing files are overwritten. When this
parameter is omitted, the report is written to snmp-mib-report.txt in the
current directory.

.EXAMPLE
.\snmp-mib-reader.ps1 -SnmpBinPath "C:\Net-SNMP\bin" -MibDirectory "C:\MIBs"

Reads all recognized MIB files and writes .\snmp-mib-report.txt.

.EXAMPLE
.\snmp-mib-reader.ps1 -SnmpBinPath "C:\Net-SNMP\bin" -MibDirectory "C:\MIBs" -Filter "EATON" -OutputFile "C:\Reports\eaton-objects.txt"

Reads only MIB files whose filename or contents contain EATON and writes the
result to C:\Reports\eaton-objects.txt.

.EXAMPLE
.\snmp-mib-reader.ps1 -SnmpBinPath "C:\Net-SNMP\bin" -MibDirectory "C:\MIBs" -Filter "ARUBA,FAN,ENTITY"

Reads MIB files whose filename or contents contain ARUBA, FAN, or ENTITY.

.EXAMPLE
pwsh ./snmp-mib-reader.ps1 -SnmpBinPath "/opt/net-snmp/bin/snmptranslate" -MibDirectory "/opt/mibs" -OutputFile "./all-mibs.txt"

Uses a complete executable path when running the script with PowerShell on
Linux or macOS.

.NOTES
Run Get-Help .\snmp-mib-reader.ps1 -Full to display this help.

Copyright [2026] Nathan Skipper

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations.
#>

[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$SnmpBinPath = (Join-Path $PSScriptRoot 'bin'),

    [ValidateNotNullOrEmpty()]
    [string]$MibDirectory = (Join-Path (Join-Path (Join-Path $PSScriptRoot 'share') 'snmp') 'mibs'),

    [Parameter()]
    [string]$Filter,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$OutputFile = (Join-Path (Get-Location) 'snmp-mib-report.txt')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-SnmpTranslate {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return (Resolve-Path -LiteralPath $Path).Path
    }

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "SnmpBinPath does not exist: $Path"
    }

    foreach ($name in @('snmptranslate.exe', 'snmptranslate')) {
        $candidate = Join-Path $Path $name
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Could not find snmptranslate.exe or snmptranslate in SnmpBinPath: $Path. Download the Net-SNMP command-line binaries from https://www.net-snmp.org/download.html."
}

function Invoke-SnmpTranslate {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string]$MibPath,
        [Parameter(Mandatory = $true)][string]$ModuleName,
        [Parameter(Mandatory = $true)][string]$ObjectName
    )

    # Prefixing the path with '+' preserves Net-SNMP's built-in MIB search
    # directories while adding the caller's vendor/dependency MIB directory.
    $arguments = @('-M', "+$MibPath", '-m', $ModuleName, '-On', '-Td', "${ModuleName}::${ObjectName}")
    $commandOutput = @(& $Executable @arguments 2>&1 | ForEach-Object { $_.ToString() })
    if ($LASTEXITCODE -ne 0) {
        throw "snmptranslate failed for ${ModuleName}::${ObjectName}: $($commandOutput -join ' ')"
    }

    return $commandOutput
}

function Get-SyntaxDetails {
    param([Parameter(Mandatory = $true)][string[]]$Details)

    $syntaxParts = [System.Collections.Generic.List[string]]::new()
    $collecting = $false
    $braceDepth = 0

    foreach ($line in $Details) {
        if (-not $collecting) {
            if ($line -match '^\s*SYNTAX\s+(.+?)\s*$') {
                $collecting = $true
                $part = $Matches[1].Trim()
                $syntaxParts.Add($part)
                $braceDepth += ([regex]::Matches($part, '\{').Count - [regex]::Matches($part, '\}').Count)
                if ($braceDepth -le 0) { break }
            }
            continue
        }

        $part = $line.Trim()
        if ($part -match '^(UNITS|MAX-ACCESS|ACCESS|STATUS|DESCRIPTION|REFERENCE|INDEX|AUGMENTS|DEFVAL)\b') {
            break
        }
        $syntaxParts.Add($part)
        $braceDepth += ([regex]::Matches($part, '\{').Count - [regex]::Matches($part, '\}').Count)
        if ($braceDepth -le 0) { break }
    }

    if ($syntaxParts.Count -eq 0) {
        return [pscustomobject]@{ ValueType = 'Unknown'; PossibleValues = '(not enumerated)' }
    }

    $syntax = (($syntaxParts -join ' ') -replace '\s+', ' ').Trim()
    $valueType = $syntax
    $possibleValues = '(not enumerated)'
    if ($syntax -match '^(.*?)\s*\{(.*)\}\s*$') {
        $valueType = $Matches[1].Trim()
        $enumeration = $Matches[2]
        $values = @([regex]::Matches($enumeration, '([A-Za-z][A-Za-z0-9-]*)\s*\(\s*(-?\d+)\s*\)') |
            ForEach-Object { "$($_.Groups[1].Value)=$($_.Groups[2].Value)" })
        if ($values.Count -gt 0) {
            $possibleValues = $values -join ', '
        }
    }

    return [pscustomobject]@{ ValueType = $valueType; PossibleValues = $possibleValues }
}

$snmpTranslate = Resolve-SnmpTranslate -Path $SnmpBinPath
if (-not (Test-Path -LiteralPath $MibDirectory -PathType Container)) {
    throw "MibDirectory does not exist or is not a directory: $MibDirectory"
}
$resolvedMibDirectory = (Resolve-Path -LiteralPath $MibDirectory).Path

$filters = @($Filter -split ',' |
    ForEach-Object { $_.Trim() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

$outputParent = Split-Path -Parent ([System.IO.Path]::GetFullPath($OutputFile))
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
    throw "The parent directory for OutputFile does not exist: $outputParent"
}
$resolvedOutputFile = [System.IO.Path]::GetFullPath($OutputFile)

$mibs = [System.Collections.Generic.List[object]]::new()
foreach ($file in @(Get-ChildItem -LiteralPath $resolvedMibDirectory -File | Sort-Object Name)) {
    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw
    }
    catch {
        Write-Warning "Skipping unreadable file '$($file.FullName)': $($_.Exception.Message)"
        continue
    }

    if ($content -notmatch '(?im)^\s*([A-Za-z][A-Za-z0-9-]*)\s+DEFINITIONS\s*::=\s*BEGIN') {
        continue
    }
    $moduleName = $Matches[1]

    if ($filters.Count -gt 0) {
        $matchesFilter = $false
        foreach ($filterTerm in $filters) {
            $matchesName = $file.Name.IndexOf($filterTerm, [StringComparison]::OrdinalIgnoreCase) -ge 0
            $matchesContent = $content.IndexOf($filterTerm, [StringComparison]::OrdinalIgnoreCase) -ge 0
            if ($matchesName -or $matchesContent) {
                $matchesFilter = $true
                break
            }
        }
        if (-not $matchesFilter) { continue }
    }

    $objectNames = @([regex]::Matches($content, '(?im)^\s*([A-Za-z][A-Za-z0-9-]*)\s+OBJECT-TYPE\b') |
        ForEach-Object { $_.Groups[1].Value } |
        Select-Object -Unique)
    $mibs.Add([pscustomobject]@{
        File = $file
        ModuleName = $moduleName
        ObjectNames = $objectNames
    })
}

$report = [System.Collections.Generic.List[string]]::new()
foreach ($mib in $mibs) {
    $report.Add($mib.ModuleName)
    foreach ($objectName in $mib.ObjectNames) {
        try {
            $details = @(Invoke-SnmpTranslate -Executable $snmpTranslate -MibPath $resolvedMibDirectory -ModuleName $mib.ModuleName -ObjectName $objectName)
            $oidLine = $details | Where-Object { $_ -match '^\s*\.\d+(?:\.\d+)*\s*$' } | Select-Object -First 1
            # Net-SNMP's -On format prefixes absolute numeric OIDs with a dot.
            # RemoteAddress uses the portable numeric form without that prefix.
            $oid = if ($null -eq $oidLine) { 'Unknown' } else { $oidLine.Trim().TrimStart('.') }
            $syntax = Get-SyntaxDetails -Details $details

            $report.Add("`t$objectName")
            $report.Add("`t`tOID: $oid")
            $report.Add("`t`tValue Type: $($syntax.ValueType)")
            $report.Add("`t`tPossible Values: $($syntax.PossibleValues)")
        }
        catch {
            Write-Warning $_.Exception.Message
            $report.Add("`t$objectName")
            $report.Add("`t`tOID: Unresolved")
            $report.Add("`t`tValue Type: Unresolved")
            $report.Add("`t`tPossible Values: Unresolved")
        }
    }
    $report.Add('')
}

$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($resolvedOutputFile, $report, $utf8WithoutBom)
Write-Host "Wrote $($mibs.Count) MIB group(s) to $resolvedOutputFile"

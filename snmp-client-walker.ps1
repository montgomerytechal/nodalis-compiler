<#
.SYNOPSIS
Walks one or more IPv4 SNMP agents and writes a grouped object-instance report.

.DESCRIPTION
Checks each target for an SNMP response and, when one is received, performs an
SNMP walk beginning at the ISO root. Targets can be a single IPv4 address, an
inclusive start-end range, or an IPv4 CIDR network. Results are grouped by IP
address and indented for readability. During the scan, the console reports
progress, whether each address responds to SNMP, and the number of walked and
matching object instances. Major OID branches are walked independently, so a
failure in one branch does not discard successful rows or prevent the remaining
branches from being attempted.

The script uses the Net-SNMP snmpget and snmpwalk executables. By default it
expects the Net-SNMP directory layout to exist beside this script: executables
in bin and MIB files in share\snmp\mibs.

.PARAMETER Target
A single IPv4 address, an inclusive range such as 192.0.2.10-192.0.2.20, or a
CIDR network such as 192.0.2.0/24.

.PARAMETER SnmpBinPath
Directory containing snmpget and snmpwalk, or the complete path to either
executable. When a complete executable path is supplied, the other executable
is located in the same directory. Defaults to bin beneath this script's
directory.

.PARAMETER MibDirectory
Directory containing MIB files used to resolve symbolic object names. Defaults
to share\snmp\mibs beneath this script's directory.

.PARAMETER OutputFile
Report path. Existing files are overwritten. Defaults to
snmp-client-walk-report.txt in the current directory.

.PARAMETER Community
SNMP v1/v2c community. Defaults to public.

.PARAMETER Filter
Optional comma-delimited list of object names to report. Matching is
case-insensitive and applies to the object name without its instance suffix.
For example, "upsOutputSource,hrDeviceStatus" includes upsOutputSource.0 and
all indexed hrDeviceStatus instances. When omitted or empty, all walked object
instances are reported.

.PARAMETER Version
SNMP protocol version. Supported values are 1, v1, 2, 2c, and v2c. Defaults to
v2c.

.PARAMETER TimeoutSeconds
Timeout, in seconds, for each request attempt. Defaults to 1.

.PARAMETER Retries
Number of retries after the initial request. Defaults to 0 so unreachable hosts
are skipped quickly.

.PARAMETER MaxHosts
Maximum number of addresses accepted from a range. Defaults to 4096 as a guard
against accidentally walking a very large network.

.EXAMPLE
.\snmp-client-walker.ps1 -Target 192.0.2.10

Walks one agent using the default Net-SNMP paths and public community.

.EXAMPLE
.\snmp-client-walker.ps1 -Target "192.0.2.10-192.0.2.20" -Community monitor -OutputFile .\switches.txt

Checks and walks every address in the inclusive range.

.EXAMPLE
.\snmp-client-walker.ps1 -Target 192.0.2.0/24 -Version v2c -TimeoutSeconds 1

Checks and walks every address in the CIDR network, including its network and
broadcast addresses because the input represents an explicit numeric range.

.EXAMPLE
.\snmp-client-walker.ps1 -Target 192.0.2.0/24 -Filter "upsOutputSource,hrDeviceStatus"

Reports only upsOutputSource and hrDeviceStatus instances from responsive
agents in the target network.

.NOTES
Run Get-Help .\snmp-client-walker.ps1 -Full to display this help.

Copyright [2026] Nathan Skipper

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Target,

    [ValidateNotNullOrEmpty()]
    [string]$SnmpBinPath = (Join-Path $PSScriptRoot 'bin'),

    [ValidateNotNullOrEmpty()]
    [string]$MibDirectory = (Join-Path (Join-Path (Join-Path $PSScriptRoot 'share') 'snmp') 'mibs'),

    [ValidateNotNullOrEmpty()]
    [string]$OutputFile = (Join-Path (Get-Location) 'snmp-client-walk-report.txt'),

    [ValidateNotNullOrEmpty()]
    [string]$Community = 'public',

    [string]$Filter,

    [ValidateSet('1', 'v1', '2', '2c', 'v2c')]
    [string]$Version = 'v2c',

    [ValidateRange(1, 60)]
    [int]$TimeoutSeconds = 1,

    [ValidateRange(0, 10)]
    [int]$Retries = 0,

    [ValidateRange(1, 16777216)]
    [int]$MaxHosts = 4096
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-NetSnmpTools {
    param([Parameter(Mandatory = $true)][string]$Path)

    $directory = $Path
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $directory = Split-Path -Parent (Resolve-Path -LiteralPath $Path).Path
    }
    elseif (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "SnmpBinPath does not exist: $Path"
    }

    $tools = @{}
    foreach ($toolName in @('snmpget', 'snmpwalk')) {
        $resolved = $null
        foreach ($fileName in @("$toolName.exe", $toolName)) {
            $candidate = Join-Path $directory $fileName
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $resolved = (Resolve-Path -LiteralPath $candidate).Path
                break
            }
        }
        if ($null -eq $resolved) {
            throw "Could not find $toolName.exe or $toolName in SnmpBinPath: $directory"
        }
        $tools[$toolName] = $resolved
    }
    return $tools
}

function ConvertTo-IPv4Number {
    param([Parameter(Mandatory = $true)][string]$Address)

    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsed) -or
        $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
        throw "Invalid IPv4 address: $Address"
    }
    $bytes = $parsed.GetAddressBytes()
    return [uint64]$bytes[0] * 16777216 +
        [uint64]$bytes[1] * 65536 +
        [uint64]$bytes[2] * 256 +
        [uint64]$bytes[3]
}

function ConvertFrom-IPv4Number {
    param([Parameter(Mandatory = $true)][uint64]$Value)

    if ($Value -gt 4294967295) { throw "IPv4 numeric value is out of range: $Value" }
    return '{0}.{1}.{2}.{3}' -f
        (($Value -shr 24) -band 255),
        (($Value -shr 16) -band 255),
        (($Value -shr 8) -band 255),
        ($Value -band 255)
}

function Resolve-IPv4Targets {
    param(
        [Parameter(Mandatory = $true)][string]$Expression,
        [Parameter(Mandatory = $true)][int]$Limit
    )

    $text = $Expression.Trim()
    [uint64]$first = 0
    [uint64]$last = 0

    if ($text -match '^\s*([^/]+)\s*/\s*(\d{1,2})\s*$') {
        $address = ConvertTo-IPv4Number -Address $Matches[1].Trim()
        $prefixLength = [int]$Matches[2]
        if ($prefixLength -lt 0 -or $prefixLength -gt 32) {
            throw "Invalid IPv4 CIDR prefix length: $prefixLength"
        }
        $hostBits = 32 - $prefixLength
        [uint64]$hostMask = if ($hostBits -eq 0) { 0 } else { ([uint64]1 -shl $hostBits) - 1 }
        $first = $address -band ([uint64]4294967295 -bxor $hostMask)
        $last = $first + $hostMask
    }
    elseif ($text -match '^\s*([^\s]+)\s*-\s*([^\s]+)\s*$') {
        $first = ConvertTo-IPv4Number -Address $Matches[1]
        $last = ConvertTo-IPv4Number -Address $Matches[2]
        if ($last -lt $first) { throw "The end of the IPv4 range precedes its start: $text" }
    }
    else {
        $first = ConvertTo-IPv4Number -Address $text
        $last = $first
    }

    $count = $last - $first + 1
    if ($count -gt $Limit) {
        throw "Target range contains $count addresses, exceeding MaxHosts ($Limit). Increase -MaxHosts explicitly to continue."
    }

    $addresses = [System.Collections.Generic.List[string]]::new()
    for ([uint64]$current = $first; $current -le $last; $current++) {
        $addresses.Add((ConvertFrom-IPv4Number -Value $current))
    }
    return $addresses
}

$tools = Resolve-NetSnmpTools -Path $SnmpBinPath
if (-not (Test-Path -LiteralPath $MibDirectory -PathType Container)) {
    throw "MibDirectory does not exist or is not a directory: $MibDirectory"
}
$resolvedMibDirectory = (Resolve-Path -LiteralPath $MibDirectory).Path
$targets = @(Resolve-IPv4Targets -Expression $Target -Limit $MaxHosts)
$filters = @($Filter -split ',' |
    ForEach-Object { $_.Trim() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

$outputParent = Split-Path -Parent ([System.IO.Path]::GetFullPath($OutputFile))
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
    throw "The parent directory for OutputFile does not exist: $outputParent"
}
$resolvedOutputFile = [System.IO.Path]::GetFullPath($OutputFile)

$normalizedVersion = if ($Version -in @('1', 'v1')) { '1' } else { '2c' }
$commonArguments = @(
    '-v', $normalizedVersion,
    '-c', $Community,
    '-t', $TimeoutSeconds.ToString([Globalization.CultureInfo]::InvariantCulture),
    '-r', $Retries.ToString([Globalization.CultureInfo]::InvariantCulture),
    '-M', "+$resolvedMibDirectory",
    '-m', 'ALL'
)

$report = [System.Collections.Generic.List[string]]::new()
$responsiveCount = 0
$reportedHostCount = 0
$targetIndex = 0
foreach ($ip in $targets) {
    $targetIndex++
    $percentComplete = [int](($targetIndex - 1) * 100 / $targets.Count)
    Write-Progress -Activity 'Walking SNMP targets' -Status "Checking $ip ($targetIndex of $($targets.Count))" -PercentComplete $percentComplete
    Write-Host "[$targetIndex/$($targets.Count)] $ip - checking for SNMP..."
    Write-Verbose "Checking SNMP on $ip"
    $savedErrorActionPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 wraps native stderr as NativeCommandError.
        # Keep an expected timeout non-terminating long enough to inspect the
        # executable's exit code, while retaining Stop behavior elsewhere.
        $ErrorActionPreference = 'Continue'
        $probeOutput = @(& $tools.snmpget @commonArguments '-On' $ip '.1.3.6.1.2.1.1.1.0' 2>$null |
            ForEach-Object { $_.ToString() })
        $probeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $savedErrorActionPreference
    }
    if ($probeExitCode -ne 0) {
        Write-Host "[$targetIndex/$($targets.Count)] $ip - no SNMP response."
        Write-Verbose "No SNMP response from $ip; skipping."
        continue
    }

    Write-Progress -Activity 'Walking SNMP targets' -Status "Walking $ip ($targetIndex of $($targets.Count))" -PercentComplete $percentComplete
    Write-Verbose "Walking $ip"

    # Walk the major, disjoint Internet branches separately. A failure in one
    # branch must not discard rows already returned or prevent later branches
    # from being attempted. These cover MIB-II, private/vendor MIBs, and the
    # SNMP framework/notification MIBs respectively.
    $walkRoots = @('.1.3.6.1.2', '.1.3.6.1.4', '.1.3.6.1.6')
    $walkOutput = [System.Collections.Generic.List[string]]::new()
    $failedWalkRoots = [System.Collections.Generic.List[string]]::new()
    foreach ($walkRoot in $walkRoots) {
        $savedErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $rootOutput = @(& $tools.snmpwalk @commonArguments '-Os' $ip $walkRoot 2>$null |
                ForEach-Object { $_.ToString() })
            $walkExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $savedErrorActionPreference
        }

        foreach ($line in $rootOutput) { $walkOutput.Add($line) }
        if ($walkExitCode -ne 0) {
            $failedWalkRoots.Add($walkRoot)
            Write-Verbose "SNMP walk of $walkRoot did not complete for $ip; continuing with the next branch."
        }
    }

    $responsiveCount++
    $hostLines = [System.Collections.Generic.List[string]]::new()
    $walkedInstanceCount = 0
    foreach ($line in $walkOutput) {
        # Net-SNMP may emit MIB-loader diagnostics on stderr while still
        # succeeding. Only report actual "object-instance = value" rows.
        if ($line -match '^\s*\S+\s+=\s+.*$') {
            $walkedInstanceCount++
            # Net-SNMP can prefix unresolved absolute numeric OIDs with a dot.
            # Use the same portable numeric form as RemoteAddress.
            $formattedLine = $line.Trim() -replace '^\.', ''
            $objectIdentifier = ($formattedLine -split '\s+=\s+', 2)[0]
            $shortIdentifier = ($objectIdentifier -split '::')[-1]
            $objectName = ($shortIdentifier -split '\.', 2)[0]
            if ($filters.Count -eq 0 -or $filters -contains $objectName) {
                $hostLines.Add("`t$formattedLine")
            }
        }
    }

    if ($hostLines.Count -gt 0) {
        if ($report.Count -gt 0) { $report.Add('') }
        $report.Add($ip)
        foreach ($hostLine in $hostLines) { $report.Add($hostLine) }
        $reportedHostCount++
    }

    $partialWalkText = if ($failedWalkRoots.Count -gt 0) {
        " Partial walk; failed branch(es): $($failedWalkRoots -join ',')."
    }
    else { '' }

    if ($filters.Count -gt 0) {
        Write-Host "[$targetIndex/$($targets.Count)] $ip - SNMP found; $($hostLines.Count) matching instance(s) reported ($walkedInstanceCount total walked).$partialWalkText"
    }
    else {
        Write-Host "[$targetIndex/$($targets.Count)] $ip - SNMP found; $walkedInstanceCount instance(s) reported.$partialWalkText"
    }
}
Write-Progress -Activity 'Walking SNMP targets' -Completed

if ($report.Count -eq 0) {
    if ($responsiveCount -eq 0) {
        $report.Add('(No SNMP-responsive hosts found)')
    }
    else {
        $report.Add('(No matching SNMP object instances found)')
    }
}
$report | Set-Content -LiteralPath $resolvedOutputFile -Encoding UTF8
Write-Output "Wrote SNMP walk report for $reportedHostCount host(s); $responsiveCount of $($targets.Count) target(s) responded to SNMP. Output: $resolvedOutputFile"

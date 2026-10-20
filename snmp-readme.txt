SNMP SETUP, MIB DISCOVERY, AND NODALIS TOOLING GUIDE
====================================================

Last updated: October 20, 2026

This guide covers SNMP v1/v2c discovery for the Nodalis tools in this folder.
Menus, commands, MIB support, and object names vary by exact model and firmware.
Always use the administration guide and MIB package for the installed version.

SECURITY FIRST
--------------

SNMP v1 and v2c community strings are sent without encryption. Use a unique,
non-default, read-only community; permit UDP 161 only from the monitoring host;
place management interfaces on a protected management VLAN; and never expose
SNMP to the Internet. Use SNMPv3 where the equipment and monitoring client both
support it. The current Nodalis SNMP client and walker support v1/v2c polling,
not SNMPv3.

SNMP polling uses UDP 161. Traps normally use UDP 162 and are separate from the
polling performed by snmp-client-walker.ps1.


1. INSTALL NET-SNMP
-------------------

Net-SNMP supplies snmpget, snmpwalk, and snmptranslate. The Nodalis runtime does
not need these programs to poll a configured numeric OID; the two PowerShell
utilities do need them.

Official project and documentation:
  https://www.net-snmp.org/
  https://www.net-snmp.org/download.html
  https://www.net-snmp.org/docs/man/
  https://www.net-snmp.org/docs/README.win32.html

Windows:

1. Obtain a trustworthy Windows Net-SNMP build or build the current official
   source with the documented Windows/MSYS2 process. Some prebuilt Windows
   packages found elsewhere are old; verify their source, version, signature,
   and hash before installing.
2. The manager-side command-line applications are sufficient. You do not need
   to install the Net-SNMP agent service merely to run these tools.
3. Place the installation beside these scripts using this layout:

       C:\usr\snmp-mib-reader.ps1
       C:\usr\snmp-client-walker.ps1
       C:\usr\bin\snmpget.exe
       C:\usr\bin\snmpwalk.exe
       C:\usr\bin\snmptranslate.exe
       C:\usr\share\snmp\mibs\...

   These are the scripts' default paths. A different layout can be supplied
   with -SnmpBinPath and -MibDirectory.
4. Test the installation:

       C:\usr\bin\snmpget.exe --version
       C:\usr\bin\snmpwalk.exe --version
       C:\usr\bin\snmptranslate.exe --version

Linux (package names vary by distribution):

       sudo apt install snmp snmp-mibs-downloader

or:

       sudo dnf install net-snmp-utils

macOS:

       brew install net-snmp

When using a system installation instead of the adjacent layout, pass its bin
and MIB paths explicitly to the scripts.


2. FIND PRODUCT MIB FILES
-------------------------

General procedure:

1. Record the exact manufacturer, model, management-card/controller model, and
   firmware or operating-system version.
2. Search the manufacturer's support/download portal for that exact product and
   release. Look under MIB, SNMP, network management, monitoring, firmware, or
   integration downloads.
3. Download the complete MIB bundle, not just the product MIB. Vendor MIBs often
   import standard or vendor dependency MIBs.
4. Keep all dependencies together under share\snmp\mibs. Preserve the original
   filenames.
5. Do not assume that possessing a MIB means the device implements every object
   in it. Firmware, chassis, installed options, and licenses determine what the
   live agent exposes. Confirm with the walker.
6. Do not download random renamed MIBs from unaudited aggregation sites when an
   official vendor copy is available.

Useful standard MIBs:

  SNMPv2-MIB             System identity and uptime
  IF-MIB                 Network-interface state and counters
  HOST-RESOURCES-MIB     Host CPU, storage, devices, and processes
  UPS-MIB (RFC 1628)     Vendor-neutral UPS status
  ENTITY-MIB             Physical component inventory
  ENTITY-STATE-MIB       Physical component operational/alarm state
  ENTITY-SENSOR-MIB      Temperature and other physical sensors

Product-specific locations and likely packages:

Avigilon servers, NVRs, and workstations
  - Avigilon Unity/ACC Server runs on Windows. Start with HOST-RESOURCES-MIB and
    the underlying server manufacturer's management MIBs (commonly Dell iDRAC/
    OpenManage or HPE iLO/Insight Management) for disks, RAID, fans, supplies,
    and temperature.
  - Obtain the Windows and hardware-agent MIBs from Microsoft/Dell/HPE, matched
    to the installed management agent or BMC firmware.
  - Avigilon cameras and appliances that expose their own SNMP objects publish
    product MIBs through Avigilon Support and Downloads:
      https://www.avigilon.com/support-and-downloads
    Avigilon's camera documentation directs users to Network > SNMP and to the
    device MIB on that site:
      https://docs.avigilon.com/bundle/thermal-camera-web-interface/page/network-and-security/snmp.htm
  - Do not assume the Avigilon Windows application itself supplies an SNMP MIB.
    Windows SNMP and the hardware management agent are normally the sources for
    server hardware status.

Windows PCs and servers
  - Windows SNMP includes HOSTMIB.MIB / HOST-RESOURCES-MIB support. Microsoft
    describes the installed extension MIBs here:
      https://learn.microsoft.com/en-us/windows/win32/snmp/the-snmp-management-information-base-mib-
  - Generic Windows SNMP exposes capacity and generic device state, but normally
    does not expose complete SMART, RAID, fan, supply, or temperature health.
  - For server hardware, install and use the OEM agent/BMC integration and MIBs:
      Dell: iDRAC/OpenManage SNMP Reference Guide and Dell Storage MIBs
      HPE:  iLO/Insight Management MIB update kit, especially CPQIDA-MIB
      Lenovo: XClarity Controller/OneCLI SNMP MIB package

Eaton UPS
  - Search Eaton's support/download site for the exact UPS and network card,
    including Network-M2, Network-M3, PXG, or ePDU where applicable.
  - Common files/modules include UPS-MIB, EATON-UPS-MIB, XUPS-MIB,
    EATON-EMP-MIB, and card-specific MIBs. Names vary by generation.
  - Include RFC 1628 UPS-MIB when the card supports the standard UPS tree.
  - Vendor site: https://www.eaton.com/

APC / Schneider Electric UPS
  - Download the PowerNet MIB and reference guide for the exact NMC firmware
    from Schneider Electric/APC Support. A frequently used filename is
    powernet*.mib; the version changes over time.
  - Also load UPS-MIB/RFC 1628 when supported. Schneider documents the standard
    UPS tree at 1.3.6.1.2.1.33:
      https://www.se.com/eg/en/faqs/FA156148/
  - Product downloads: https://www.apc.com/ and https://www.se.com/

Aruba switches
  - Download the MIB bundle for the exact switch series and AOS-CX or AOS-S
    firmware from the Aruba Support Portal:
      https://networkingsupport.hpe.com/downloads
  - AOS-CX commonly uses ARUBA-WIRED-* MIBs plus ENTITY-MIB,
    ENTITY-STATE-MIB, and ENTITY-SENSOR-MIB. Fan data may require
    ARUBA-WIRED-FAN-MIB.
  - Older AOS-S/ProVision switches commonly use HP-ICF-CHASSIS,
    HP-ICF-FAN/POWER-related modules, and hpicf* objects.
  - AOS-CX SNMP/MIB guide:
      https://www.arubanetworks.com/techdocs/AOS-CX/10.14/PDF/snmp_mib.pdf

Cisco switches
  - Use Cisco's MIB Locator/Object Navigator and the MIB package for the exact
    platform and IOS, IOS XE, NX-OS, or Catalyst OS release.
  - Common modules include CISCO-ENVMON-MIB, CISCO-ENTITY-FRU-CONTROL-MIB,
    CISCO-ENTITY-SENSOR-MIB, ENTITY-MIB, ENTITY-STATE-MIB, and IF-MIB.
  - Platform support differs; an object listed in a MIB may be absent on a
    particular switch.
  - Cisco SNMP documentation:
      https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/snmp/configuration/xe-2/snmp-xe-2-book.pdf

Generac, Kohler, and Caterpillar generators
  - There is no universal generator MIB shared by these brands. SNMP support is
    normally provided by a particular generator controller, communications
    gateway, remote-monitoring appliance, ATS controller, or third-party
    Modbus-to-SNMP gateway.
  - Identify the exact controller/gateway first. Obtain its firmware-matched MIB
    from the manufacturer's dealer/support portal or the gateway vendor.
  - Ask specifically for the "SNMP MIB", "communications protocol manual", and
    "point list" for the installed controller. Many generator products expose
    Modbus but not native SNMP; a MIB from another controller will not work.
  - Kohler's communications overview confirms SNMP availability is dependent on
    the generator communications architecture:
      https://resources.kohler.com/power/kohler/industrial/pdf/Digital_Communications_in_Elec_Gen_Systems_White_Paper.pdf
  - Starting points:
      Generac: https://www.generac.com/support/
      Kohler Energy: https://www.kohlerenergy.com/support/
      Caterpillar Electric Power: https://www.cat.com/en_US/support.html


3. USE snmp-mib-reader.ps1 TO FIND OBJECTS
------------------------------------------

The reader parses local MIB files and uses snmptranslate to produce a reference
of object names, numeric base OIDs, value types, and enumerated values. It does
not contact a device.

Default adjacent layout:

       .\snmp-mib-reader.ps1

Filter for one or more terms (matching a filename or its contents):

       .\snmp-mib-reader.ps1 -Filter "EATON,UPS,FAN,ENTITY"

Use explicit paths when Net-SNMP or the MIBs are elsewhere:

       .\snmp-mib-reader.ps1 `
           -SnmpBinPath "C:\Net-SNMP\bin" `
           -MibDirectory "C:\MIBs" `
           -Filter "APC,UPS" `
           -OutputFile "C:\Reports\apc-objects.txt"

Important OID rules:

  - The report removes Net-SNMP's leading dot. Use 1.3.6..., not .1.3.6...
    for a Nodalis RemoteAddress.
  - A scalar object normally needs an instance suffix of .0 when polled.
    Example base object: 1.3.6.1.2.1.33.1.4.1
    Live scalar instance: 1.3.6.1.2.1.33.1.4.1.0
  - A table column needs its actual row index, such as .1, .2, or a compound
    index. Do not guess the index; discover it with the client walker.
  - Table and entry container objects are generally not directly readable
    values.

Show complete help:

       Get-Help .\snmp-mib-reader.ps1 -Full


4. USE snmp-client-walker.ps1 TO FIND LIVE INSTANCES
----------------------------------------------------

The walker probes each IPv4 target with snmpget. It silently skips addresses
that do not respond, walks responsive agents from the ISO root, displays live
status, removes leading dots from numeric OIDs, and groups instances by IP.

Single device:

       .\snmp-client-walker.ps1 `
           -Target "192.168.9.20" `
           -Community "YOUR_READ_ONLY_COMMUNITY"

Inclusive range:

       .\snmp-client-walker.ps1 `
           -Target "192.168.9.10-192.168.9.253" `
           -Community "YOUR_READ_ONLY_COMMUNITY"

CIDR range:

       .\snmp-client-walker.ps1 `
           -Target "192.168.9.0/24" `
           -Community "YOUR_READ_ONLY_COMMUNITY"

Filter by comma-delimited base object names:

       .\snmp-client-walker.ps1 `
           -Target "192.168.9.10-192.168.9.253" `
           -Community "YOUR_READ_ONLY_COMMUNITY" `
           -Filter "upsOutputSource,hrDeviceStatus" `
           -OutputFile ".\health-instances.txt"

The filter is case-insensitive. A filter of hrDeviceStatus includes every live
instance such as hrDeviceStatus.1 and hrDeviceStatus.2. Hosts without matching
instances are omitted. The default timeout is one second with zero retries, and
MaxHosts defaults to 4096.

Show complete help:

       Get-Help .\snmp-client-walker.ps1 -Full


5. ENABLE SNMP ON WINDOWS PCS AND SERVERS
-----------------------------------------

The legacy Microsoft SNMP service is optional and supports v1/v2c, not SNMPv3.
For security-sensitive or Internet-facing systems, prefer a maintained SNMPv3
agent or another secured monitoring method.

Windows client editions:

1. Open Settings > Apps > Optional features > Add an optional feature.
2. Install "Simple Network Management Protocol (SNMP)" and, where required,
   "WMI SNMP Provider".
3. Open services.msc. Set SNMP Service to Automatic and start it.
4. Open SNMP Service properties > Security.
5. Add a unique community with READ ONLY rights.
6. Select "Accept SNMP packets from these hosts" and add only the monitoring
   server's IP address.
7. Create/enable a Windows Firewall inbound rule for UDP 161, scoped to the
   monitoring server's source IP and the appropriate network profile.
8. Restart SNMP Service after configuration changes and test with snmpget.

Windows Server may also install the feature with an elevated PowerShell prompt
(availability and feature name depend on the Server release):

       Install-WindowsFeature SNMP-Service -IncludeManagementTools

For Windows client capability installation, administrators commonly use:

       Add-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
       Add-WindowsCapability -Online -Name "WMI-SNMP-Provider.Client~~~~0.0.1.0"

Manage communities and permitted managers through the SNMP Service Security tab,
Group Policy, MDM, or the corresponding policy registry configuration. Microsoft
documents community and permitted-manager policy here:
  https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-admx-snmp
  https://learn.microsoft.com/en-us/windows/win32/snmp/configuring-snmp-service

For physical disk, RAID, power supply, fan, and temperature health, install and
configure the server manufacturer's management agent or use its BMC/iDRAC/iLO
address. Windows HOST-RESOURCES-MIB alone is not a substitute for hardware
management instrumentation.


6. ENABLE SNMP ON ARUBA AND CISCO SWITCHES
------------------------------------------

Use a dedicated read-only community and restrict it with an ACL to the Nodalis
or monitoring host. Save the configuration and test from the actual monitoring
host so routing, VRF, ACL, and firewall behavior are included.

Aruba AOS-CX (representative; verify against the installed release):

       configure terminal
       snmp-server vrf default
       snmp-server community YOUR_COMMUNITY
           access-level ro
       exit
       write memory

Associate the community with an IPv4 ACL that permits only the monitoring host.
Management-interface deployments may use the mgmt VRF instead of default.
AOS-CX documents snmp-server community, read-only access, ACL association, and
VRF enablement in its release-specific SNMP/MIB guide.

Aruba AOS-S/ProVision syntax differs. A typical configuration uses an
snmp-server community command with operator/read-only access and an authorized
manager restriction. Use the switch's exact Management and Configuration Guide;
do not paste AOS-CX commands into AOS-S.

Cisco IOS/IOS XE (representative):

       configure terminal
       ip access-list standard SNMP-MANAGERS
           permit <MONITORING_HOST_IP>
       exit
       snmp-server community YOUR_COMMUNITY RO SNMP-MANAGERS
       snmp-server location YOUR_LOCATION
       snmp-server contact YOUR_CONTACT
       end
       write memory

NX-OS and other Cisco operating systems use different syntax. Use Cisco's
release-specific SNMP configuration guide. Verify with show snmp community or
the equivalent command, and confirm UDP 161 is permitted through management ACLs.


7. ENABLE SNMP ON EATON AND APC UPS DEVICES
-------------------------------------------

The UPS must have a network management card or embedded network-management
interface that supports SNMP. A serial/USB-only UPS cannot be polled directly
over IP without another agent or gateway.

Eaton (menu names vary by Network-M2/M3/PXG/card firmware):

1. Sign in to the card's HTTPS administration page.
2. Open Settings/Configuration > Network > SNMP (or Access/SNMP).
3. Enable SNMP v1/v2c if it is disabled.
4. Create a unique read-only community.
5. Restrict the authorized manager/NMS address to the monitoring host.
6. Apply/save; reboot the card only if its guide requires it.
7. Confirm UDP 161 and test sysDescr.0, upsOutputSource.0, then vendor objects.

APC/Schneider NMC2/NMC3 (menu names vary by firmware):

1. Sign in to the NMC web UI over HTTPS.
2. Open Configuration > Network > SNMPv1 > Access and enable SNMPv1 access
   (the UI often labels v1/v2c community access as SNMPv1).
3. Under Access Control, configure the community, read-only rights, and the
   monitoring host/NMS IP. Disable unused default access profiles.
4. Apply/save and test UDP 161.
5. For CLI-capable NMC2 firmware, Schneider documents `snmp -S enable` plus
   access-control community, rights, and NMS address options:
      https://iportal.se.com/contents/docs/ups-pmar-9llm9n_r1_en.pdf

Do not confuse trap receiver configuration with polling access. The walker needs
read access on UDP 161 even if traps to UDP 162 are already configured.


8. ENABLE SNMP ON GENERAC, KOHLER, AND CAT GENERATORS
-----------------------------------------------------

There is no safe universal procedure. First identify the generator controller,
communications gateway, and any ATS controller. Many installations use Modbus
TCP/RTU natively and add SNMP through a gateway.

For each installed controller/gateway:

1. Obtain the exact communications manual, firmware-matched MIB, and point list
   from the manufacturer, authorized dealer, or gateway vendor.
2. Assign a static management IP, subnet, gateway, and DNS/NTP settings as
   required by the site design.
3. Enable SNMP polling, choose v2c only when necessary, create a unique read-only
   community, and restrict the NMS/manager IP to the monitoring host.
4. Permit UDP 161 between the monitoring host and generator management network.
5. If traps are desired, separately set the trap destination and UDP 162.
6. Save/restart the communications module if required.
7. Test sysDescr.0. Then walk the device and compare results with the controller
   display while deliberately exercising only safe, approved test states.

If the controller documentation mentions only Modbus registers and no SNMP
agent/MIB, use its supported Modbus integration or an approved Modbus-to-SNMP
gateway. Never load a similarly named MIB and assume it applies.


9. ENABLE SNMP ON AVIGILON SERVERS
----------------------------------

For an Avigilon Unity/ACC Windows server or workstation:

1. Configure the Windows SNMP service as described in section 5.
2. Install/configure the physical server's OEM management software or poll its
   BMC (for example, Dell iDRAC or HPE iLO) for RAID, disk, fan, supply, and
   temperature health.
3. Restrict communities and UDP 161 to the monitoring host.
4. Test Windows HOST-RESOURCES-MIB objects and the OEM hardware MIB separately.
5. Confirm that the Avigilon Client/server-status view shows the expected host
   information. Some Avigilon server hardware information is available only
   when the Windows server's SNMP service is enabled.

For an Avigilon camera/device with an SNMP page:

1. Sign in to the device web interface.
2. Navigate to Network > SNMP.
3. Enable SNMP and select v2c if using the current walker.
4. Configure the read community and permitted/trap manager fields as supported.
5. Apply and download the exact device MIB from Avigilon Support.

Avigilon documents device SNMP configuration here:
  https://docs.avigilon.com/bundle/thermal-camera-web-interface/page/network-and-security/snmp.htm


10. POPULAR HEALTH OBJECT NAMES
-------------------------------

These are candidate names to search for and then verify with the MIB reader and
client walker. They are not guaranteed on every model. Table objects require the
live index found by walking; scalars normally use .0.

Universal identity/reachability
  sysDescr.0                 SNMPv2-MIB; identity/agent response
  sysObjectID.0              SNMPv2-MIB; identifies vendor/product family
  sysUpTime.0                SNMPv2-MIB; uptime/reboot detection
  ifOperStatus.<index>        IF-MIB; interface operational state

Windows PCs/servers and Avigilon Windows servers
  hrSystemUptime.0           HOST-RESOURCES-MIB; host uptime
  hrDeviceStatus.<index>     Generic device running/warning/down/testing/unknown
  hrStorageDescr.<index>     Identifies a filesystem/storage row
  hrStorageSize.<index>      Total allocation units
  hrStorageUsed.<index>      Used allocation units
  hrProcessorLoad.<index>    Per-processor recent load

  Disk caution: hrStorage* reports logical capacity, not SMART/RAID health.
  Prefer the hardware vendor's objects:

  Dell OpenManage/iDRAC
    physicalDiskComponentStatus.<index>
    physicalDiskRollUpStatus.<index> (when implemented)
    arrayDiskState.<index>
    arrayDiskRollUpStatus.<index>
    arrayDiskComponentStatus.<index>
    virtualDiskState.<index>
    virtualDiskComponentStatus.<index>
    systemStatePowerSupplyStatusCombined.0 (agent/version dependent)
    systemStateTemperatureStatusCombined.0 (agent/version dependent)

    Dell status enums commonly use OK=3, nonCritical=4, critical=5, and
    nonRecoverable=6. Confirm in the installed Dell MIB.

  HPE ProLiant/iLO
    cpqDaPhyDrvStatus.<index>          Physical-drive status
    cpqDaPhyDrvFailureCode.<index>     Failure detail
    cpqDaPhyDrvSSDWearStatus.<index>   SSD endurance status where supported
    cpqDaLogDrvStatus.<index>          Logical-drive/array status
    cpqHeFltTolPowerSupplyCondition.<index>
    cpqHeTemperatureCondition.<index>
    cpqHeThermalCondition.0

    HPE documents failed(3) and predictiveFailure(4) as important physical
    drive replacement conditions; confirm all enum values in CPQIDA-MIB.

UPS standard objects (UPS-MIB / RFC 1628; Eaton and APC commonly support these)
  upsBatteryStatus.0            unknown/normal/low/depleted
  upsSecondsOnBattery.0         Seconds since transfer to battery
  upsEstimatedMinutesRemaining.0
  upsEstimatedChargeRemaining.0
  upsBatteryVoltage.0
  upsBatteryTemperature.0       Battery temperature, not room temperature
  upsOutputSource.0             Includes normal, bypass, battery, booster, reducer
  upsOutputFrequency.0
  upsOutputPercentLoad.<index>
  upsAlarmsPresent.0            Count of active alarm conditions
  upsAlarmDescr.<index>         Active alarm identifier table
  upsTestResultsSummary.0

  A useful "not normal output source" alarm for the standard upsOutputSource
  enumeration is onConditions "1,2,4,5,6,7" because normal is 3.

Eaton UPS/vendor objects (XUPS/EATON MIB availability varies)
  xupsOutputSource.0
  xupsBatteryStatus.0
  xupsBatTimeRemaining.0
  xupsOutputLoad.<index> or related output-load objects
  xupsEnvRemoteTemp.0
  xupsEnvRemoteHumidity.0
  xupsContactState.<index>
  xupsAlarms or alarm-table objects (names vary by MIB generation)

APC/Schneider PowerNet objects (model/firmware dependent)
  upsBasicBatteryStatus.0
  upsAdvBatteryCapacity.0
  upsAdvBatteryRunTimeRemaining.0
  upsBasicOutputStatus.0
  upsAdvOutputLoad.0
  upsAdvBatteryTemperature.0
  upsBasicStateOutputState.0 or model-specific output-state objects
  mUpsEnvironAmbientTemperature.0 / environmental-probe variants
  active alarm/event objects in PowerNet MIB

  Prefer the standard UPS-MIB names when they supply the required value and use
  PowerNet objects for APC-specific detail.

Aruba AOS-S/ProVision switches
  hpicfFanState.<index>          Fan state; many models use ok=5
  hpicfPsState.<index>           Power-supply state
  hpicfSensorStatus.<index>      Generic hardware sensor condition
  hpicfSensorDescr.<index>       Identifies the sensor row
  hpSystemAirCurrentTemp.<index>
  hpSystemAirOverTemp.<index>

Aruba AOS-CX switches
  Search ARUBA-WIRED-FAN-MIB for arubaWired*Fan* state/RPM objects.
  Search ENTITY-MIB for entPhysicalDescr/entPhysicalClass.
  Search ENTITY-STATE-MIB for entStateOper and entStateAlarm.
  Search ENTITY-SENSOR-MIB for entPhySensorValue and entPhySensorOperStatus.
  Search the firmware-matched power/status MIB for supplies. Exact Aruba names
  change across product and firmware families; discover live indexes by walking.

Cisco switches
  ciscoEnvMonTemperatureState.<index>  CISCO-ENVMON-MIB
  ciscoEnvMonTemperatureStatusValue.<index>
  ciscoEnvMonFanState.<index>
  ciscoEnvMonSupplyState.<index>
  ciscoEnvMonSupplyStatusDescr.<index>
  chassisTempAlarm.0                    CISCO-STACK-MIB on older platforms
  chassisMinorAlarm.0
  chassisMajorAlarm.0
  cefcFRUPowerOperStatus.<index>        CISCO-ENTITY-FRU-CONTROL-MIB
  cefcFanTrayOperStatus.<index>
  entSensorValue.<index> / related CISCO-ENTITY-SENSOR-MIB objects

  CISCO-ENVMON state objects commonly use normal=1, warning=2, critical=3,
  shutdown=4, notPresent=5, and notFunctioning=6. Verify platform support and
  the exact enum in the MIB. Cisco documents ciscoEnvMonSupplyState here:
    https://www.cisco.com/c/en/us/support/docs/ip/simple-network-management-protocol-snmp/17434-power-supply-changes.html

Generac, Kohler, and Caterpillar generators
  No cross-vendor object names can safely be prescribed. Search the exact MIB
  for terms such as:

    generatorStatus, gensetStatus, engineState, operatingState, runStatus,
    commonAlarm, shutdownAlarm, warningAlarm, emergencyStop,
    utilityAvailable, utilityStatus, mainsStatus, transferSwitchStatus,
    source1Available, source2Available, activeSource,
    batteryVoltage, coolantTemperature, engineTemperature, oilPressure,
    fuelLevel, engineSpeed, frequency, outputVoltage, outputCurrent,
    activePower, runHours, startCount, controllerCommunicationStatus

  Determine "on backup" from the controller/ATS active-source or utility-loss
  object defined by that product, not from a guessed name. Determine overtemp
  from the documented alarm/status enum or threshold state, not merely a raw
  temperature without units and scaling.


FINAL VALIDATION CHECKLIST
--------------------------

1. Verify device model, controller/card, and firmware.
2. Use a unique read-only community restricted to the monitoring host.
3. Confirm UDP 161 routing/firewall/ACL access.
4. Test sysDescr.0 and sysUpTime.0.
5. Load the complete firmware-matched MIB bundle.
6. Use snmp-mib-reader.ps1 to find candidate objects and enum meanings.
7. Use snmp-client-walker.ps1 to discover actual instances and indexes.
8. Compare SNMP values with the device's UI/CLI during a known-good state.
9. Test alarms only through an approved, safe maintenance procedure.
10. Record the exact OID instance, expected normal value, alarm values, units,
    scaling, polling interval, and device firmware in the project documentation.

Never treat reachability alone as overall health. A device can answer SNMP while
a disk, supply, fan, battery, sensor, network link, or generator subsystem is in
an alarm state.

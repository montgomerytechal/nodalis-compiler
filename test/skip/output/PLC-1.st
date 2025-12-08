//Task={"Name":"A10001Task", "Interval":"100", "Priority":"1"}
//Task={"Name":"A10002Task", "Interval":"100", "Priority":"1"}
//Task={"Name":"A10003Task", "Interval":"100", "Priority":"1"}
//Task={"Name":"A10004Task", "Interval":"100", "Priority":"1"}
//Task={"Name":"A10005Task", "Interval":"100", "Priority":"1"}

            //Instance={"TypeName":"A10001", "Name":"A10001-Instance", "AssociatedTaskName":"A10001Task"}
//Instance={"TypeName":"A10002", "Name":"A10002-Instance", "AssociatedTaskName":"A10002Task"}
//Instance={"TypeName":"A10003", "Name":"A10003-Instance", "AssociatedTaskName":"A10003Task"}
//Instance={"TypeName":"A10004", "Name":"A10004-Instance", "AssociatedTaskName":"A10004Task"}
//Instance={"TypeName":"A10005", "Name":"A10005-Instance", "AssociatedTaskName":"A10005Task"}

            //Map={ "ModuleID": "192.168.9.15" "ModulePort": "" "Protocol": "MTI" "RemoteAddress": "0" "RemoteSize": "64" "InternalAddress": "%IL0" "Resource": "MainResource" "PollTime": "100" "Properties": ""}
//Map={ "ModuleID": "192.168.9.15" "ModulePort": "" "Protocol": "MTI" "RemoteAddress": "1" "RemoteSize": "64" "InternalAddress": "%IL16" "Resource": "MainResource" "PollTime": "100" "Properties": ""}
//Map={ "ModuleID": "192.168.9.15" "ModulePort": "" "Protocol": "MTI" "RemoteAddress": "2" "RemoteSize": "64" "InternalAddress": "%IL32" "Resource": "MainResource" "PollTime": "100" "Properties": ""}
//Map={ "ModuleID": "192.168.9.15" "ModulePort": "" "Protocol": "MTI" "RemoteAddress": "3" "RemoteSize": "64" "InternalAddress": "%IL48" "Resource": "MainResource" "PollTime": "100" "Properties": ""}
//Map={ "ModuleID": "192.168.9.15" "ModulePort": "" "Protocol": "MTI" "RemoteAddress": "4" "RemoteSize": "64" "InternalAddress": "%IL64" "Resource": "MainResource" "PollTime": "100" "Properties": "{}"}

            VAR_GLOBAL
                ERS1 : BOOL;
ERS2 : BOOL;
ALSL : BOOL;
ALARM : LWORD;
            END_VAR
            PROGRAM A10001
VAR
DAIAO1 : BOOL
DA8 : MUX
DA9 : MUX
DA10 : MUX
DA11 : MUX
ENS1 : BOOL
ENS2 : BOOL
EN12 : MUX
EN13 : MUX
EN14 : MUX
EN15 : MUX
EN16 : MUX
ILOA10001 : BOOL
PSDAI21 : MUX
GPS1 : BOOL
GPS2 : BOOL
IL1 : BOOL
IL2 : BOOL
ERRT : BOOL
ERST1 : TON
ERST2 : TON
FIRE48 : R_TRIG
FIRE49 : R_TRIG
FIRE50 : R_TRIG
FIRE51 : R_TRIG
FIRE52 : R_TRIG
FIRE53 : R_TRIG
FIRE54 : R_TRIG
FIRE55 : R_TRIG
ERRS1 : RS
ERRT1 : RS
ERRS2 : RS
ERRT2 : RS
TP32 : TP
TP33 : TP
TG1 : BOOL
END_VAR

%ML3.5 := ((%ML0.5));

%ML5.6 := ((%ML0.6));

%ML0.7 := ((%ML2.7));

%ML0.8 := ((%ML4.8));

%ML0.9 := ((%IL0.9));

DAIAO1 := ((%QL0.20));

DA8.K := DAIAO1;
DA8.IN0 := 0;
DA8.IN1 := %IL0.8;
%IL0.8 := (DA8.OUT);

DA9.K := DAIAO1;
DA9.IN0 := 0;
DA9.IN1 := %IL0.9;
%IL0.9 := (DA9.OUT);

DA10.K := DAIAO1;
DA10.IN0 := 0;
DA10.IN1 := %IL0.10;
%IL0.10 := (DA10.OUT);

DA11.K := DAIAO1;
DA11.IN0 := 0;
DA11.IN1 := %IL0.11;
%IL0.11 := (DA11.OUT);

ENS1 := ((%ML0.38));

ENS2 := ((%ML0.39));

EN12.K := ENS1;
EN12.IN0 := %ML0.12;
EN12.IN1 := 0;
%ML0.12 := (EN12.OUT);

EN13.K := ENS1;
EN13.IN0 := %ML0.13;
EN13.IN1 := 0;
%ML0.13 := (EN13.OUT);

EN14.K := ENS1;
EN14.IN0 := %ML0.14;
EN14.IN1 := 0;
%ML0.14 := (EN14.OUT);

EN15.K := ENS2;
EN15.IN0 := %ML0.15;
EN15.IN1 := 0;
%ML0.15 := (EN15.OUT);

EN16.K := ENS2;
EN16.IN0 := %ML0.16;
EN16.IN1 := 0;
%ML0.16 := (EN16.OUT);

ILOA10001 := ((%ML0.42));

%ML3.10 := ((%IL0.10));

%ML5.11 := ((%IL0.11));

%ML3.12 := ((%ML2.12));

%ML5.13 := ((%ML2.13));

%ML3.18 := ((%ML0.18));

%ML5.19 := ((%ML0.19));

PSDAI21.K := %IL0.21;
PSDAI21.IN0 := 0;
PSDAI21.IN1 := %ML0;
%ML0 := (PSDAI21.OUT);
%IL0.21 := ((%IL0.21));

GPS1 := ((%ML0.34));

GPS2 := ((%ML0.35));

%ML0.0 := ((NOT %ML6.0 AND ((GPS1))) OR (%ML0.0));

%ML0.1 := ((NOT %ML6.1 AND ((GPS1))) OR (%ML0.1));

%ML0.2 := ((NOT %ML6.2 AND ((GPS1))) OR (%ML0.2));

%ML0.3 := ((NOT %ML6.3 AND ((GPS1))) OR (%ML0.3));

%ML0.4 := ((NOT %ML6.4 AND ((GPS1))) OR (%ML0.4));

%ML0.5 := ((NOT %ML6.5 AND ((GPS1))) OR (%ML0.5));

%ML0.6 := ((NOT %ML6.6 AND ((GPS1))) OR (%ML0.6));

%ML0.7 := ((NOT %ML6.7 AND ((GPS1))) OR (%ML0.7));

%ML0.8 := ((NOT %ML6.8 AND ((GPS1))) OR (%ML0.8));

%ML0.9 := ((NOT %ML6.9 AND ((GPS1))) OR (%ML0.9));

%ML0.10 := ((NOT %ML6.10 AND ((GPS1))) OR (%ML0.10));

%ML0.11 := ((NOT %ML6.11 AND ((GPS1))) OR (%ML0.11));

%ML0.12 := ((NOT %ML6.12 AND ((GPS1))) OR (%ML0.12));

%ML0.13 := ((NOT %ML6.13 AND ((GPS1))) OR (%ML0.13));

%ML0.14 := ((NOT %ML6.14 AND ((GPS1))) OR (%ML0.14));

%ML0.15 := ((NOT %ML6.15 AND ((GPS1))) OR (%ML0.15));

%ML0.16 := ((NOT %ML6.16 AND ((GPS2))) OR (%ML0.16));

%ML0.17 := ((NOT %ML6.17 AND ((GPS2))) OR (%ML0.17));

%ML0.18 := ((NOT %ML6.18 AND ((GPS2))) OR (%ML0.18));

%ML0.19 := ((NOT %ML6.19 AND ((GPS2))) OR (%ML0.19));

%ML0.20 := ((NOT %ML6.20 AND ((GPS2))) OR (%ML0.20));

%ML0.21 := ((NOT %ML6.21 AND ((GPS2))) OR (%ML0.21));

%ML0.22 := ((NOT %ML6.22 AND ((GPS2))) OR (%ML0.22));

%ML0.23 := ((NOT %ML6.23 AND ((GPS2))) OR (%ML0.23));

IGM0.K := NOT ILOA10001 AND ((%ML0.0) OR (%QL0.0));
IGM0.IN0 := 1;
IGM0.IN1 := IL1;
IL1 := (IGM0.OUT);
IG.0 := ((NOT ILOA10001 AND ((%ML0.0) OR (%QL0.0))));

IGM1.K := NOT ILOA10001 AND ((%ML0.1) OR (%QL0.1));
IGM1.IN0 := 1;
IGM1.IN1 := IL1;
IL1 := (IGM1.OUT);
IG.1 := ((NOT ILOA10001 AND ((%ML0.1) OR (%QL0.1))));

IGM2.K := NOT ILOA10001 AND ((%ML0.2) OR (%QL0.2));
IGM2.IN0 := 1;
IGM2.IN1 := IL1;
IL1 := (IGM2.OUT);
IG.2 := ((NOT ILOA10001 AND ((%ML0.2) OR (%QL0.2))));

IGM3.K := NOT ILOA10001 AND ((%ML0.3) OR (%QL0.3));
IGM3.IN0 := 1;
IGM3.IN1 := IL1;
IL1 := (IGM3.OUT);
IG.3 := ((NOT ILOA10001 AND ((%ML0.3) OR (%QL0.3))));

IGM4.K := NOT ILOA10001 AND ((%ML0.4) OR (%QL0.4));
IGM4.IN0 := 1;
IGM4.IN1 := IL1;
IL1 := (IGM4.OUT);
IG.4 := ((NOT ILOA10001 AND ((%ML0.4) OR (%QL0.4))));

IGM5.K := NOT ILOA10001 AND ((%ML0.5) OR (%QL0.5));
IGM5.IN0 := 1;
IGM5.IN1 := IL1;
IL1 := (IGM5.OUT);
IG.5 := ((NOT ILOA10001 AND ((%ML0.5) OR (%QL0.5))));

IGM6.K := NOT ILOA10001 AND ((%ML0.6) OR (%QL0.6));
IGM6.IN0 := 1;
IGM6.IN1 := IL1;
IL1 := (IGM6.OUT);
IG.6 := ((NOT ILOA10001 AND ((%ML0.6) OR (%QL0.6))));

IGM7.K := NOT ILOA10001 AND ((%ML0.7) OR (%QL0.7));
IGM7.IN0 := 1;
IGM7.IN1 := IL1;
IL1 := (IGM7.OUT);
IG.7 := ((NOT ILOA10001 AND ((%ML0.7) OR (%QL0.7))));

IGM8.K := NOT ILOA10001 AND ((%ML0.8) OR (%QL0.8));
IGM8.IN0 := 1;
IGM8.IN1 := IL2;
IL2 := (IGM8.OUT);
IG.8 := ((NOT ILOA10001 AND ((%ML0.8) OR (%QL0.8))));

IGM9.K := NOT ILOA10001 AND ((%ML0.9) OR (%QL0.9));
IGM9.IN0 := 1;
IGM9.IN1 := IL2;
IL2 := (IGM9.OUT);
IG.9 := ((NOT ILOA10001 AND ((%ML0.9) OR (%QL0.9))));

IGM10.K := NOT ILOA10001 AND ((%ML0.10) OR (%QL0.10));
IGM10.IN0 := 1;
IGM10.IN1 := IL2;
IL2 := (IGM10.OUT);
IG.10 := ((NOT ILOA10001 AND ((%ML0.10) OR (%QL0.10))));

IGM11.K := NOT ILOA10001 AND ((%ML0.11) OR (%QL0.11));
IGM11.IN0 := 1;
IGM11.IN1 := IL2;
IL2 := (IGM11.OUT);
IG.11 := ((NOT ILOA10001 AND ((%ML0.11) OR (%QL0.11))));

IGM12.K := NOT ILOA10001 AND ((%ML0.12) OR (%QL0.12));
IGM12.IN0 := 1;
IGM12.IN1 := IL2;
IL2 := (IGM12.OUT);
IG.12 := ((NOT ILOA10001 AND ((%ML0.12) OR (%QL0.12))));

IGM13.K := NOT ILOA10001 AND ((%ML0.13) OR (%QL0.13));
IGM13.IN0 := 1;
IGM13.IN1 := IL2;
IL2 := (IGM13.OUT);
IG.13 := ((NOT ILOA10001 AND ((%ML0.13) OR (%QL0.13))));

IGM14.K := NOT ILOA10001 AND ((%ML0.14) OR (%QL0.14));
IGM14.IN0 := 1;
IGM14.IN1 := IL2;
IL2 := (IGM14.OUT);
IG.14 := ((NOT ILOA10001 AND ((%ML0.14) OR (%QL0.14))));

IGM15.K := NOT ILOA10001 AND ((%ML0.15) OR (%QL0.15));
IGM15.IN0 := 1;
IGM15.IN1 := IL2;
IL2 := (IGM15.OUT);
IG.15 := ((NOT ILOA10001 AND ((%ML0.15) OR (%QL0.15))));

%ML1.40 := ((IL1));

%ML1.41 := ((IL2));

ERST1.IN := ERS1;
ERST1.PT := 0*500;
%QL0.0 := ((%QL0.0) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 1*500;
%QL0.1 := ((%QL0.1) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 2*500;
%QL0.2 := ((%QL0.2) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 3*500;
%QL0.3 := ((%QL0.3) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 4*500;
%QL0.4 := ((%QL0.4) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 5*500;
%QL0.5 := ((%QL0.5) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 6*500;
%QL0.6 := ((%QL0.6) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 7*500;
%QL0.7 := ((%QL0.7) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 8*500;
%QL0.8 := ((%QL0.8) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 9*500;
%QL0.9 := ((%QL0.9) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 10*500;
%QL0.10 := ((%QL0.10) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 11*500;
%QL0.11 := ((%QL0.11) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 12*500;
%QL0.12 := ((%QL0.12) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 13*500;
%QL0.13 := ((%QL0.13) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 14*500;
%QL0.14 := ((%QL0.14) OR ERST1.Q);

ERST1.IN := ERS1;
ERST1.PT := 15*500;
%QL0.15 := ((%QL0.15) OR ERST1.Q);

ERST2.IN := ERS2;
ERST2.PT := 16*500;
%QL0.16 := ((%QL0.16) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 17*500;
%QL0.17 := ((%QL0.17) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 18*500;
%QL0.18 := ((%QL0.18) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 19*500;
%QL0.19 := ((%QL0.19) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 20*500;
%QL0.20 := ((%QL0.20) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 21*500;
%QL0.21 := ((%QL0.21) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 22*500;
%QL0.22 := ((%QL0.22) OR ERST2.Q);

ERST2.IN := ERS2;
ERST2.PT := 23*500;
%QL0.23 := ((%QL0.23) OR ERST2.Q);

%ML1.56 := ((NOT ALSL AND (((ALARM > 0)))));

IF ((%ML0.56)) THEN
 ALSL := 1;
END_IF;;

MUX57.K := %ML0.57;
MUX57.IN0 := 0;
MUX57.IN1 := ALARM;
ALARM := (MUX57.OUT);
%ML1.57 := ((%ML0.57));

MUX57.K := %ML0.57;
MUX57.IN0 := 0;
MUX57.IN1 := ALSL;
ALSL := (MUX57.OUT);
%ML1.57 := ((%ML0.57));

FIRE48.CLK := %IL0.48;
IF (FIRE48.OUT) THEN
 ALARM.48 := 1;
END_IF;;

%ML1.48 := ((%IL0.48));

FIRE48.CLK := %IL0.48;
ALSL := (FIRE48.OUT);

FIRE49.CLK := %IL0.49;
IF (FIRE49.OUT) THEN
 ALARM.49 := 1;
END_IF;;

%ML1.49 := ((%IL0.49));

FIRE49.CLK := %IL0.49;
ALSL := (FIRE49.OUT);

FIRE50.CLK := %IL0.50;
IF (FIRE50.OUT) THEN
 ALARM.50 := 1;
END_IF;;

%ML1.50 := ((%IL0.50));

FIRE50.CLK := %IL0.50;
ALSL := (FIRE50.OUT);

FIRE51.CLK := %IL0.51;
IF (FIRE51.OUT) THEN
 ALARM.51 := 1;
END_IF;;

%ML1.51 := ((%IL0.51));

FIRE51.CLK := %IL0.51;
ALSL := (FIRE51.OUT);

FIRE52.CLK := %IL0.52;
IF (FIRE52.OUT) THEN
 ALARM.52 := 1;
END_IF;;

%ML1.52 := ((%IL0.52));

FIRE52.CLK := %IL0.52;
ALSL := (FIRE52.OUT);

FIRE53.CLK := %IL0.53;
IF (FIRE53.OUT) THEN
 ALARM.53 := 1;
END_IF;;

%ML1.53 := ((%IL0.53));

FIRE53.CLK := %IL0.53;
ALSL := (FIRE53.OUT);

FIRE54.CLK := %IL0.54;
IF (FIRE54.OUT) THEN
 ALARM.54 := 1;
END_IF;;

%ML1.54 := ((%IL0.54));

FIRE54.CLK := %IL0.54;
ALSL := (FIRE54.OUT);

FIRE55.CLK := %IL0.55;
IF (FIRE55.OUT) THEN
 ALARM.55 := 1;
END_IF;;

%ML1.55 := ((%IL0.55));

FIRE55.CLK := %IL0.55;
ALSL := (FIRE55.OUT);

ERRS1.R1 := %ML0.36;
ERRT := (ERRS1.Q1);
ERRT1.R1 := ERRT;
ERS1 := (ERRT1.Q1);
IF ((%ML0.36)) THEN
 ERS1 := 1;
END_IF;;

ERRS2.R1 := %ML0.37;
ERRT := (ERRS2.Q1);
ERRT2.R1 := ERRT;
ERS2 := (ERRT2.Q1);
IF ((%ML0.37)) THEN
 ERS2 := 1;
END_IF;;

TP32.IN := NOT IG.32 AND ((%ML0.32));
TP32.PT := 1*60000;
%QL0.32 := (TP32.Q);

TP33.IN := NOT IG.33 AND ((%ML0.33));
TP33.PT := 1000/2;
%QL0.33 := (TP33.Q);

%QL0.43 := ((NOT IG.43 AND ((%ML0.43))));

IF ((%ML0.44)) THEN
 TG1 := 1;
END_IF;;

%QL0.46 := ((NOT IG.46 AND ((TG1))));

%QL0.47 := ((NOT IG.47 AND ((TG1))));

IF ((%ML0.45)) THEN
 TG1 := 0;
END_IF;;

%ML1.0 := ((%IL0.0));

%ML1.1 := ((%IL0.1));

%ML1.2 := ((%IL0.2));

%ML1.3 := ((%IL0.3));

%ML1.4 := ((%IL0.4));

%ML1.5 := ((%IL0.5));

%ML1.6 := ((%IL0.6));

%ML1.7 := ((%IL0.7));

%ML1.8 := ((%IL0.8));

%ML1.9 := ((%IL0.9));

%ML1.10 := ((%IL0.10));

%ML1.11 := ((%IL0.11));

%ML1.12 := ((%IL0.12));

%ML1.13 := ((%IL0.13));

%ML1.14 := ((%IL0.14));

%ML1.15 := ((%IL0.15));

%ML1.16 := ((%IL0.16));

%ML1.17 := ((%IL0.17));

%ML1.18 := ((%IL0.18));

%ML1.19 := ((%IL0.19));

%ML1.20 := ((%IL0.20));

%ML1.21 := ((%IL0.21));

%ML1.22 := ((%IL0.22));

%ML1.23 := ((%IL0.23));

%ML1.24 := ((%IL0.24));

%ML1.25 := ((%IL0.25));

%ML1.26 := ((%IL0.26));

%ML1.27 := ((%IL0.27));

%ML1.28 := ((%IL0.28));

%ML1.29 := ((%IL0.29));

%ML1.30 := ((%IL0.30));

%ML1.31 := ((%IL0.31));

%ML0.8 := ((%ML4.8));


END_PROGRAM
PROGRAM A10002
VAR

END_VAR

AX.8 := ((AX.8 AND ((%IL16.21))));

AX.8 := ((AX.8 AND ((%ML16.22))));

%QL16.23 := ((AX.8) OR (OX.8));

OX.5 := ((%IL16.12) OR (OX.5));

OX.5 := ((%ML16.13) OR (OX.5));

%QL16.14 := ((AX.5) OR (OX.5));


END_PROGRAM
PROGRAM A10003
VAR

END_VAR


END_PROGRAM
PROGRAM A10004
VAR

END_VAR


END_PROGRAM
PROGRAM A10005
VAR
TP0 : TP
TP1 : TP
TP2 : TP
TP3 : TP
TP4 : TP
TP5 : TP
TP6 : TP
TP7 : TP
TP8 : TP
TP9 : TP
TP10 : TP
TP11 : TP
TP12 : TP
TP13 : TP
TP14 : TP
TP15 : TP
TP16 : TP
TP17 : TP
TP18 : TP
TP19 : TP
TP20 : TP
TP21 : TP
TP22 : TP
TP23 : TP
TOG2 : BOOL
TOG24 : BOOL
TOG25 : BOOL
TOG26 : BOOL
TOG27 : BOOL
TOG28 : BOOL
TOG29 : BOOL
TOG30 : BOOL
TOG31 : BOOL
END_VAR

TP0.IN := NOT IG.0 AND ((%ML64.0));
TP0.PT := 2*1000;
%QL64.0 := (TP0.Q);

TP1.IN := NOT IG.1 AND ((%ML64.1));
TP1.PT := 2*1000;
%QL64.1 := (TP1.Q);

TP2.IN := NOT IG.2 AND ((%ML64.2));
TP2.PT := 2*1000;
%QL64.2 := (TP2.Q);

TP3.IN := NOT IG.3 AND ((%ML64.3));
TP3.PT := 2*1000;
%QL64.3 := (TP3.Q);

TP4.IN := NOT IG.4 AND ((%ML64.4));
TP4.PT := 2*1000;
%QL64.4 := (TP4.Q);

TP5.IN := NOT IG.5 AND ((%ML64.5));
TP5.PT := 2*1000;
%QL64.5 := (TP5.Q);

TP6.IN := NOT IG.6 AND ((%ML64.6));
TP6.PT := 2*1000;
%QL64.6 := (TP6.Q);

TP7.IN := NOT IG.7 AND ((%ML64.7));
TP7.PT := 2*1000;
%QL64.7 := (TP7.Q);

TP8.IN := NOT IG.8 AND ((%ML64.8));
TP8.PT := 2*1000;
%QL64.8 := (TP8.Q);

TP9.IN := NOT IG.9 AND ((%ML64.9));
TP9.PT := 2*1000;
%QL64.9 := (TP9.Q);

TP10.IN := NOT IG.10 AND ((%ML64.10));
TP10.PT := 2*1000;
%QL64.10 := (TP10.Q);

TP11.IN := NOT IG.11 AND ((%ML64.11));
TP11.PT := 2*1000;
%QL64.11 := (TP11.Q);

TP12.IN := NOT IG.12 AND ((%ML64.12));
TP12.PT := 2*1000;
%QL64.12 := (TP12.Q);

TP13.IN := NOT IG.13 AND ((%ML64.13));
TP13.PT := 2*1000;
%QL64.13 := (TP13.Q);

TP14.IN := NOT IG.14 AND ((%ML64.14));
TP14.PT := 2*1000;
%QL64.14 := (TP14.Q);

TP15.IN := NOT IG.15 AND ((%ML64.15));
TP15.PT := 2*1000;
%QL64.15 := (TP15.Q);

TP16.IN := NOT IG.16 AND ((%ML64.16));
TP16.PT := 2*1000;
%QL64.16 := (TP16.Q);

TP17.IN := NOT IG.17 AND ((%ML64.17));
TP17.PT := 2*1000;
%QL64.17 := (TP17.Q);

TP18.IN := NOT IG.18 AND ((%ML64.18));
TP18.PT := 2*1000;
%QL64.18 := (TP18.Q);

TP19.IN := NOT IG.19 AND ((%ML64.19));
TP19.PT := 2*1000;
%QL64.19 := (TP19.Q);

TP20.IN := NOT IG.20 AND ((%ML64.20));
TP20.PT := 2*1000;
%QL64.20 := (TP20.Q);

TP21.IN := NOT IG.21 AND ((%ML64.21));
TP21.PT := 2*1000;
%QL64.21 := (TP21.Q);

TP22.IN := NOT IG.22 AND ((%ML64.22));
TP22.PT := 2*1000;
%QL64.22 := (TP22.Q);

TP23.IN := NOT IG.23 AND ((%ML64.23));
TP23.PT := 2*1000;
%QL64.23 := (TP23.Q);

TP1.IN := NOT IG.1 AND ((%ML64.1));
TP1.PT := 3*1000;
%QL64.1 := (TP1.Q);

IF ((NOT %QL64.2 AND ((%ML64.2)))) THEN
 TOG2 := 1;
END_IF;;

IF ((%QL64.2 AND ((%ML64.2)))) THEN
 TOG2 := 0;
END_IF;;

%QL64.2 := ((NOT IG.2 AND ((TOG2))));

IF ((NOT %QL64.24 AND ((%ML64.24)))) THEN
 TOG24 := 1;
END_IF;;

IF ((%QL64.24 AND ((%ML64.24)))) THEN
 TOG24 := 0;
END_IF;;

%QL64.24 := ((NOT IG.24 AND ((TOG24))));

IF ((NOT %QL64.25 AND ((%ML64.25)))) THEN
 TOG25 := 1;
END_IF;;

IF ((%QL64.25 AND ((%ML64.25)))) THEN
 TOG25 := 0;
END_IF;;

%QL64.25 := ((NOT IG.25 AND ((TOG25))));

IF ((NOT %QL64.26 AND ((%ML64.26)))) THEN
 TOG26 := 1;
END_IF;;

IF ((%QL64.26 AND ((%ML64.26)))) THEN
 TOG26 := 0;
END_IF;;

%QL64.26 := ((NOT IG.26 AND ((TOG26))));

IF ((NOT %QL64.27 AND ((%ML64.27)))) THEN
 TOG27 := 1;
END_IF;;

IF ((%QL64.27 AND ((%ML64.27)))) THEN
 TOG27 := 0;
END_IF;;

%QL64.27 := ((NOT IG.27 AND ((TOG27))));

IF ((NOT %QL64.28 AND ((%ML64.28)))) THEN
 TOG28 := 1;
END_IF;;

IF ((%QL64.28 AND ((%ML64.28)))) THEN
 TOG28 := 0;
END_IF;;

%QL64.28 := ((NOT IG.28 AND ((TOG28))));

IF ((NOT %QL64.29 AND ((%ML64.29)))) THEN
 TOG29 := 1;
END_IF;;

IF ((%QL64.29 AND ((%ML64.29)))) THEN
 TOG29 := 0;
END_IF;;

%QL64.29 := ((NOT IG.29 AND ((TOG29))));

IF ((NOT %QL64.30 AND ((%ML64.30)))) THEN
 TOG30 := 1;
END_IF;;

IF ((%QL64.30 AND ((%ML64.30)))) THEN
 TOG30 := 0;
END_IF;;

%QL64.30 := ((NOT IG.30 AND ((TOG30))));

IF ((NOT %QL64.31 AND ((%ML64.31)))) THEN
 TOG31 := 1;
END_IF;;

IF ((%QL64.31 AND ((%ML64.31)))) THEN
 TOG31 := 0;
END_IF;;

%QL64.31 := ((NOT IG.31 AND ((TOG31))));

%ML65.0 := ((%QL64.0));

%ML65.1 := ((%QL64.1));

%ML65.2 := ((%QL64.2));

%ML65.3 := ((%QL64.3));

%ML65.4 := ((%QL64.4));

%ML65.5 := ((%QL64.5));

%ML65.6 := ((%QL64.6));

%ML65.7 := ((%QL64.7));

%ML65.8 := ((%QL64.8));

%ML65.9 := ((%QL64.9));

%ML65.10 := ((%QL64.10));

%ML65.11 := ((%QL64.11));

%ML65.12 := ((%QL64.12));

%ML65.13 := ((%QL64.13));

%ML65.14 := ((%QL64.14));

%ML65.15 := ((%QL64.15));

%ML65.16 := ((%QL64.16));

%ML65.17 := ((%QL64.17));

%ML65.18 := ((%QL64.18));

%ML65.19 := ((%QL64.19));

%ML65.20 := ((%QL64.20));

%ML65.21 := ((%QL64.21));

%ML65.22 := ((%QL64.22));

%ML65.23 := ((%QL64.23));

%ML65.24 := ((%QL64.24));

%ML65.25 := ((%QL64.25));

%ML65.26 := ((%QL64.26));

%ML65.27 := ((%QL64.27));

%ML65.28 := ((%QL64.28));

%ML65.29 := ((%QL64.29));

%ML65.30 := ((%QL64.30));

%ML65.31 := ((%QL64.31));


END_PROGRAM

            

//Map={"ModuleID":"192.168.9.100","ModulePort":"552","Protocol":"MODBUS-TCP","RemoteAddress":"1001","RemoteSize":"1","InternalAddress":"%IX0.0","Resource":"PLC1","PollTime":"500","ProtocolProperties":"{}"}

//Task={"Name":"T100", "Interval":"100", "Priority":"1"}

//Instance={"TypeName":"PLC_LD", "Name":"MainThread", "AssociatedTaskName":"T100"}

VAR_GLOBAL
    LD0001  : LWORD;
IL0001  : LWORD;
BI0001  : LWORD;
CI0001  : LWORD;
BO0001  : LWORD;
CO0001  : LWORD;
SW0001_0  AT %MD0 : DWORD;

END_VAR
FUNCTION_BLOCK PLS
    VAR_INPUT
        EN : BOOL;
PT : INT;

    END_VAR
    VAR_OUTPUT
        Q : BOOL;

    END_VAR
    VAR
        Timer  : TP;
Time  : INT;

    END_VAR
    Timer.IN := EN;
Timer.PT := PT;
Q := (Timer.Q);

END_FUNCTION_BLOCK
PROGRAM PLC_LD
    VAR
        TP00010  : TP;
Time  : INT;

    END_VAR
    TP00010.IN := NOT IL0001.0 AND ((SW0001_0.0));
TP00010.PT := 1000;
Time := (TP00010.ET);
%Q0.0 := NOT (((Time > 2000)) OR TP00010.Q);

END_PROGRAM


//Map={\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0001\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}
//Map={\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0017\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}

//Task={"Name":"T100", "Interval":"100", "Priority":"1"}

//Instance={"TypeName":"PLC_LD", "Name":"MainThread", "AssociatedTaskName":"T100"}

VAR_GLOBAL
    SW1  AT %IX0.0 : BOOL;

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
        
    END_VAR
    %QX0.0 := NOT ((SW1));

END_PROGRAM

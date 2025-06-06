//Task={"Name":"T100", "Interval":"100", "Priority":"1"}

//Instance={"TypeName":"PLC_LD", "Name":"MainThread", "AssociatedTaskName":"T100"}

VAR_GLOBAL
    SW0001  : LWORD;

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
    
END_FUNCTION_BLOCK

        PROGRAM PLC_LD
    VAR
        TP00010  : TP;

    END_VAR
    
END_PROGRAM

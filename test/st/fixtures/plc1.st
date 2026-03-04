
//Map={\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"0\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%IX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}
//Map={\"ModuleID\":\"192.168.9.17\",\"ModulePort\":\"5502\",\"Protocol\":\"MODBUS-TCP\",\"RemoteAddress\":\"16\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.0\",\"Resource\":\"PLC1\",\"PollTime\":\"500\",\"ProtocolProperties\":\"{}\"}
//Map={\"ModuleID\":\"192.168.9.19\",\"ModulePort\":\"47808\",\"Protocol\":\"BACNET-IP\",\"RemoteAddress\":\"100\",\"RemoteSize\":\"1\",\"InternalAddress\":\"%QX0.1\",\"Resource\":\"PLC1\",\"PollTime\":\"1000\",\"ProtocolProperties\":\"{\\\"ObjectInstance\\\":\\\"400101\\\",\\\"ObjectType\\\":\\\"4\\\",\\\"PropertyId\\\":\\\"85\\\",\\\"ValueType\\\":\\\"e\\\"}\"}

//Task={"Name":"T100", "Interval":"100", "Priority":"1"}

//Instance={"TypeName":"PLC_LD", "Name":"MainThread", "AssociatedTaskName":"T100"}

VAR_GLOBAL
    SW1  AT %IX0.0 : BOOL;
//Global={"Name":"SW1", "Address":"%IX0.0"}
SW2  AT %IX0.1 : BOOL;
//Global={"Name":"SW2", "Address":"%IX0.1"}

END_VAR
FUNCTION_BLOCK CMP
    VAR_INPUT
        CV1 : INT;
CV2 : INT;

    END_VAR
    VAR_OUTPUT
        Q : INT;

    END_VAR
    VAR
        
    END_VAR
    (*Compares two integers (CV1 and CV2) *)
(* If CV1 is greater than CV2, Q = 1 *)
(* If CV2 is greater than CV1, Q = -1 *)
(* If CV1 = CV2, Q = 0 *)
IF CV1 = CV2 THEN
    Q := 0;
ELSIF CV1 > CV2 THEN
    Q := 1;
ELSE
    Q := -1;
END_IF;
END_FUNCTION_BLOCK
FUNCTION_BLOCK COUNTER
    VAR_INPUT
        IN : BOOL;
SV : INT;
RV : INT;

    END_VAR
    VAR_OUTPUT
        R : BOOL;
CV : INT;

    END_VAR
    VAR
        CMP1  : CMP;
CMPO  : INT;

    END_VAR
    (*Counts up from SV to RV each time IN is true. *)
(*If SV = RV, then R = true, otherwise false. *)
(*CV represents the current value. *)

IF CV = 0 THEN
    CV := SV;
END_IF;

IF IN THEN
    CV := CV + 1;
END_IF;
CMP1(CV1 := CV, CV2 := RV, Q => CMPO);

IF CMPO < 0 THEN
    CV := SV;
    R := TRUE;
END_IF;
END_FUNCTION_BLOCK
FUNCTION_BLOCK INTTEST
    VAR_INPUT
        V : INT;

    END_VAR
    VAR_OUTPUT
        Q : BOOL;

    END_VAR
    VAR
        VBYTE  : BYTE;
VWORD  : WORD;
VDWORD  : DWORD;
VLWORD  : LWORD;
VSINT  : SINT;
VINT  : INT;
VDINT  : DINT;
VLINT  : LINT;
VUSINT  : USINT;
VUINT  : UINT;
VULINT  : ULINT;

    END_VAR
    (*Test all INT types for literal assignment and behaviors. *)
VBYTE := BYTE#2#1111_1111;
VWORD := WORD#8#77;
VDWORD := DWORD#16#FFFFFFFF;
VLWORD := ULINT#2000;
VSINT := -23;
VINT := -66668;
VDINT := -32000;
VLINT := -80;
VUSINT := 0;
VUINT := 1;
VULINT := 2;
END_FUNCTION_BLOCK
PROGRAM PLC_LD
    VAR
        SR1  : SR;
CTU1  : CTU;
SW1R  : BOOL;
CU  : WORD;
PLS1  : TP;

    END_VAR
    PLS1.IN := SW1;
PLS1.PT := 1000;
PLS1();
%QX0.0 := (PLS1.Q);
CTU1.CU := SW1;
CTU1.PV := 2;
CTU1();
CU := (CTU1.CV);
SW1R := (CTU1.Q);
IF (((CU = 1))) THEN
                            %QX0.1 := 1;
                        END_IF;
IF ((SW1R)) THEN
                            %QX0.1 := 0;
                        END_IF;
CTU1.R := SW1R;
CTU1();
CU := (MUX(K := SW1R OR SW1, IN0 := 1, IN1 := 2));
SW1R := ((SW1R));

END_PROGRAM

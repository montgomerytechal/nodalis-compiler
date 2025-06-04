FUNCTION_BLOCK Timer
VAR_INPUT
  Start : BOOL;
END_VAR
VAR_OUTPUT
  Done : BOOL;
END_VAR
VAR
  Counter : INT;
END_VAR
    Counter := Counter + 1;
END_FUNCTION_BLOCK

PROGRAM PLC_PROG
    VAR
        T1: Timer;
        IN: ULINT;
    END_VAR
    IN := %I0001.0;
    IF T1.Start := TRUE AND NOT T1.Done THEN
        %Q0001.0 := 1;
    ELSIF T1.Done := TRUE THEN
        T1.Start := FALSE;
        %Q0001.0 := 0;
    END_IF;
END_PROGRAM
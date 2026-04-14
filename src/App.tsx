/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Emulator8051, EmulatorState } from '@/lib/emulator';
import { TrafficIntersection } from '@/components/TrafficIntersection';
import { CodeViewer } from '@/components/CodeViewer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Square, RotateCcw, FastForward, Cpu, TrafficCone, Code2, Settings2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

import { Input } from '@/components/ui/input';

const ASSEMBLY_CODE = `; ============================================================
; Smart 4-Lane Traffic Light Controller - 8051 Assembly
; ============================================================
; Crystal:    11.0592 MHz
; P0 = Traffic INPUT  (2 bits per lane)
; P1 = Light  OUTPUT  (2 bits per lane)
; Timer0 Mode1 for 50ms base delay
; ============================================================
;
; P0 INPUT (Traffic Level per lane):
;   P0.1:P0.0 = Lane1  (00=none 01=low 10=med 11=high)
;   P0.3:P0.2 = Lane2
;   P0.5:P0.4 = Lane3
;   P0.7:P0.6 = Lane4
;
; P1 OUTPUT (LED pattern - same as before):
;   P1.0=L1 RED   P1.1=L1 GREEN
;   P1.2=L2 RED   P1.3=L2 GREEN
;   P1.4=L3 RED   P1.5=L3 GREEN
;   P1.6=L4 RED   P1.7=L4 GREEN
;
; LIGHT PATTERNS (hex):
;   ALL RED      = 0101 0101 = 55H
;   Lane1 GREEN  = 0101 0110 = 56H
;   Lane2 GREEN  = 0101 1001 = 59H
;   Lane3 GREEN  = 0110 0101 = 65H
;   Lane4 GREEN  = 1001 0101 = 95H
;
; GREEN duration = 10s = 200 x 50ms (R2=200, fits in 8-bit)
;
; REGISTERS USED:
;   R0 = round-robin lane counter (1-4)
;   R2 = delay loop counter
;   R3 = outer delay loop (not needed here, 200 fits)
;   A  = accumulator for masking/comparing
; ============================================================

        ORG     0000H
        LJMP    MAIN

        ORG     0030H

; ============================================================
; MAIN INIT
; ============================================================
MAIN:
        MOV     SP,   #60H      ; Stack pointer
        MOV     TMOD, #01H      ; Timer0 Mode1
        MOV     P0,   #0FFH     ; P0 as input (all high-Z)
        MOV     P1,   #55H      ; All RED on startup
        MOV     R0,   #1        ; Round-robin starts at Lane1

; ============================================================
; MAIN DECISION LOOP
; Read P0, check if any lane=11, decide mode
; ============================================================
READ_AND_DECIDE:
        MOV     A, P0           ; Read all traffic inputs

        ; --- Check Lane 1: mask bits 1:0, compare with 03H ---
        MOV     A, P0
        ANL     A, #03H         ; Isolate P0.1:P0.0
        CJNE    A, #03H, CHK_L2 ; Not 11? check next lane
        ; Lane 1 is HIGH → give GREEN
        MOV     P1, #56H        ; L1 GREEN, others RED
        MOV     R0, #2          ; Next round-robin starts at L2
        SJMP    DO_GREEN

CHK_L2:
        MOV     A, P0
        ANL     A, #0CH         ; Isolate P0.3:P0.2
        CJNE    A, #0CH, CHK_L3 ; Not 11? check next
        ; Lane 2 is HIGH
        MOV     P1, #59H        ; L2 GREEN, others RED
        MOV     R0, #3          ; Next round-robin at L3
        SJMP    DO_GREEN

CHK_L3:
        MOV     A, P0
        ANL     A, #30H         ; Isolate P0.5:P0.4
        CJNE    A, #30H, CHK_L4 ; Not 11? check next
        ; Lane 3 is HIGH
        MOV     P1, #65H        ; L3 GREEN, others RED
        MOV     R0, #4          ; Next round-robin at L4
        SJMP    DO_GREEN

CHK_L4:
        MOV     A, P0
        ANL     A, #0C0H        ; Isolate P0.7:P0.6
        CJNE    A, #0C0H, NO_HIGH ; Not 11? no high traffic
        ; Lane 4 is HIGH
        MOV     P1, #95H        ; L4 GREEN, others RED
        MOV     R0, #1          ; Next round-robin at L1
        SJMP    DO_GREEN

; ============================================================
; NO HIGH TRAFFIC → Round Robin Mode
; Use R0 to know which lane's turn it is
; ============================================================
NO_HIGH:
        MOV     P1, #55H        ; All RED while deciding
        CJNE    R0, #1, RR_CHK2
        MOV     P1, #56H        ; L1 GREEN
        INC     R0              ; Next = L2
        SJMP    DO_GREEN

RR_CHK2:
        CJNE    R0, #2, RR_CHK3
        MOV     P1, #59H        ; L2 GREEN
        INC     R0              ; Next = L3
        SJMP    DO_GREEN

RR_CHK3:
        CJNE    R0, #3, RR_CHK4
        MOV     P1, #65H        ; L3 GREEN
        INC     R0              ; Next = L4
        SJMP    DO_GREEN

RR_CHK4:
        MOV     P1, #95H        ; L4 GREEN
        MOV     R0, #1          ; Wrap back to L1
        SJMP    DO_GREEN

; ============================================================
; DO_GREEN: Run 10s GREEN for whichever lane P1 is set to
; After 10s → go back to READ_AND_DECIDE
; ============================================================
DO_GREEN:
        MOV     R2, #200        ; 200 x 50ms = 10s
        LCALL   DELAY_LOOP
        SJMP    READ_AND_DECIDE ; Re-read traffic after green

; ============================================================
; SUBROUTINE: DELAY_LOOP
; Loops R2 times calling DELAY_50MS
; ============================================================
DELAY_LOOP:
        LCALL   DELAY_50MS
        DJNZ    R2, DELAY_LOOP
        RET

; ============================================================
; SUBROUTINE: DELAY_50MS
; Timer0 Mode1 @ 11.0592MHz → reload 0x4C00 = 50ms
; ============================================================
DELAY_50MS:
        MOV     TH0, #4CH
        MOV     TL0, #00H
        SETB    TR0
WAIT:
        JNB     TF0, WAIT
        CLR     TR0
        CLR     TF0
        RET

        END`;

export default function App() {
  const [emulator] = useState(() => new Emulator8051(ASSEMBLY_CODE));
  const [state, setState] = useState<EmulatorState>(emulator.state);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(50); // ms per instruction
  const [skipDelays, setSkipDelays] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const step = useCallback(() => {
    emulator.step();
    
    // If skipDelays is on, we skip the wait loops
    if (skipDelays) {
      const currentInst = emulator.state.instructions[emulator.state.pc];
      if (currentInst && currentInst.opcode === 'JNB' && currentInst.args[0] === 'TF0') {
        // Skip the WAIT loop
        emulator.state.registers.TF0 = 1;
      }
      if (currentInst && currentInst.opcode === 'DJNZ' && currentInst.args[0] === 'R2') {
        // Fast forward R2
        emulator.state.registers.R2 = 1;
      }
    }

    setState({ ...emulator.state });
  }, [emulator, skipDelays]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(step, speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, speed, step]);

  const handleReset = () => {
    emulator.reset();
    setState({ ...emulator.state });
    setIsRunning(false);
  };

  const handleP0Change = (lane: number, level: number) => {
    const shift = (lane - 1) * 2;
    const mask = ~(0x03 << shift);
    const newValue = (emulator.state.registers.P0 & mask) | (level << shift);
    emulator.state.registers.P0 = newValue;
    setState({ ...emulator.state });
  };

  const getLaneLevel = (lane: number) => {
    const shift = (lane - 1) * 2;
    return (state.registers.P0 >> shift) & 0x03;
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Header */}
        <div className="lg:col-span-12 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              <Cpu className="w-8 h-8 text-primary" />
              8051 Traffic Controller
            </h1>
            <p className="text-neutral-500">Smart 4-Lane Intersection Simulator</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-neutral-200 shadow-sm">
            <Button 
              variant={isRunning ? "destructive" : "default"} 
              size="sm"
              onClick={() => setIsRunning(!isRunning)}
              className="gap-2"
            >
              {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Stop" : "Run"}
            </Button>
            <Button variant="outline" size="sm" onClick={step} disabled={isRunning}>
              <FastForward className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-8 mx-2" />
            <div className="flex items-center gap-2 px-2">
              <span className="text-xs font-mono text-neutral-500">SPEED</span>
              <Slider 
                value={[100 - speed]} 
                max={100} 
                step={1} 
                onValueChange={(v) => setSpeed(100 - v[0])}
                className="w-24"
              />
            </div>
          </div>
        </div>

        {/* Left Column: Visualization & Controls */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-white border-neutral-200 overflow-hidden shadow-sm">
            <CardHeader className="border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrafficCone className="w-5 h-5 text-amber-500" />
                  Intersection Live View
                </CardTitle>
                <Badge variant="outline" className="font-mono bg-white">
                  P1: 0x{state.registers.P1.toString(16).toUpperCase().padStart(2, '0')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <TrafficIntersection p1Value={state.registers.P1} p0Value={state.registers.P0} />
            </CardContent>
          </Card>

          <Card className="bg-white border-neutral-200 shadow-sm">
            <CardHeader className="border-b border-neutral-200">
              <CardTitle className="text-lg flex items-center gap-2 text-neutral-900">
                <Settings2 className="w-5 h-5 text-blue-500" />
                Input Controls (Port 0)
              </CardTitle>
              <CardDescription className="text-neutral-500">Simulate traffic levels for each lane</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(lane => (
                  <div key={lane} className="space-y-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-500">LANE {lane}</span>
                      <Badge variant="secondary" className="text-[10px] bg-neutral-200 text-neutral-700">
                        {getLaneLevel(lane) === 3 ? "HIGH" : getLaneLevel(lane) === 2 ? "MED" : getLaneLevel(lane) === 1 ? "LOW" : "NONE"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Slider 
                        value={[getLaneLevel(lane)]} 
                        max={3} 
                        step={1} 
                        onValueChange={(v) => handleP0Change(lane, v[0])}
                        className="flex-1"
                      />
                      <Input 
                        type="number" 
                        min={0} 
                        max={3} 
                        value={getLaneLevel(lane)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 3) {
                            handleP0Change(lane, val);
                          }
                        }}
                        className="w-12 h-8 text-xs px-1 text-center bg-white"
                      />
                    </div>

                    <div className="flex justify-between text-[8px] text-neutral-400 font-mono px-1">
                      <span>00</span>
                      <span>01</span>
                      <span>10</span>
                      <span>11</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FastForward className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Skip Delay Subroutines</p>
                    <p className="text-xs text-neutral-500">Automatically bypass 10s wait loops</p>
                  </div>
                </div>
                <Switch checked={skipDelays} onCheckedChange={setSkipDelays} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Code & Registers */}
        <div className="lg:col-span-5 space-y-6">
          <Tabs defaultValue="code" className="w-full">
            <TabsList className="w-full bg-white border border-neutral-200 p-1 h-12 shadow-sm">
              <TabsTrigger value="code" className="flex-1 gap-2 data-[state=active]:bg-neutral-100">
                <Code2 className="w-4 h-4" /> Code
              </TabsTrigger>
              <TabsTrigger value="registers" className="flex-1 gap-2 data-[state=active]:bg-neutral-100">
                <Cpu className="w-4 h-4" /> Registers
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="code" className="mt-4 h-[600px]">
              <Card className="h-full bg-white border-neutral-200 overflow-hidden flex flex-col shadow-sm">
                <CodeViewer code={ASSEMBLY_CODE} currentLine={state.currentLine} />
              </Card>
            </TabsContent>

            <TabsContent value="registers" className="mt-4">
              <Card className="bg-white border-neutral-200 shadow-sm">
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <RegisterBox label="ACC" value={state.registers.A} />
                    <RegisterBox label="PC" value={state.pc} />
                    <RegisterBox label="R0" value={state.registers.R0} />
                    <RegisterBox label="R2" value={state.registers.R2} />
                    <RegisterBox label="SP" value={state.registers.SP} />
                    <RegisterBox label="TMOD" value={state.registers.TMOD} />
                  </div>
                  
                  <Separator className="bg-neutral-200" />
                  
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Ports</p>
                    <div className="grid grid-cols-2 gap-4">
                      <RegisterBox label="P0 (Input)" value={state.registers.P0} binary />
                      <RegisterBox label="P1 (Output)" value={state.registers.P1} binary />
                    </div>
                  </div>

                  <Separator className="bg-neutral-200" />

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Timer 0</p>
                    <div className="grid grid-cols-2 gap-4">
                      <RegisterBox label="TH0" value={state.registers.TH0} />
                      <RegisterBox label="TL0" value={state.registers.TL0} />
                      <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                        <span className="text-xs font-mono text-neutral-500">TR0</span>
                        <Badge variant={state.registers.TR0 ? "default" : "secondary"} className={state.registers.TR0 ? "" : "bg-neutral-200 text-neutral-600"}>
                          {state.registers.TR0 ? "ON" : "OFF"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                        <span className="text-xs font-mono text-neutral-500">TF0</span>
                        <Badge variant={state.registers.TF0 ? "destructive" : "secondary"} className={state.registers.TF0 ? "" : "bg-neutral-200 text-neutral-600"}>
                          {state.registers.TF0 ? "SET" : "CLR"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      </div>
    </div>
  );
}

const RegisterBox = ({ label, value, binary }: { label: string, value: number, binary?: boolean }) => (
  <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 flex flex-col gap-1 shadow-sm">
    <span className="text-[10px] font-mono text-neutral-400 uppercase">{label}</span>
    <div className="flex items-baseline justify-between">
      <span className="text-lg font-mono font-bold text-primary">
        0x{value.toString(16).toUpperCase().padStart(2, '0')}
      </span>
      <span className="text-[10px] text-neutral-400">
        {value}
      </span>
    </div>
    {binary && (
      <div className="mt-1 flex gap-1">
        {value.toString(2).padStart(8, '0').split('').map((bit, i) => (
          <div key={i} className={cn(
            "w-full h-1 rounded-full",
            bit === '1' ? "bg-primary" : "bg-neutral-200"
          )} />
        ))}
      </div>
    )}
  </div>
);

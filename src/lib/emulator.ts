/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RegisterName = 'A' | 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'P0' | 'P1' | 'P2' | 'P3' | 'SP' | 'TMOD' | 'TH0' | 'TL0' | 'TF0' | 'TR0';

export interface EmulatorState {
  registers: Record<string, number>;
  pc: number;
  stack: number[];
  isRunning: boolean;
  currentLine: number;
  labels: Record<string, number>;
  instructions: Instruction[];
}

export interface Instruction {
  line: number;
  originalText: string;
  opcode: string;
  args: string[];
}

export class Emulator8051 {
  state: EmulatorState;
  
  constructor(code: string) {
    const { instructions, labels } = this.parse(code);
    this.state = {
      registers: {
        A: 0,
        R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0,
        P0: 0xFF, P1: 0x55, P2: 0, P3: 0,
        SP: 0x07,
        TMOD: 0,
        TH0: 0, TL0: 0,
        TF0: 0, TR0: 0,
      },
      pc: 0,
      stack: [],
      isRunning: false,
      currentLine: -1,
      labels,
      instructions,
    };
    
    // Find initial PC (usually MAIN or 0000H)
    const startLabel = labels['MAIN'] !== undefined ? labels['MAIN'] : 0;
    this.state.pc = startLabel;
  }

  private parse(code: string) {
    const lines = code.split('\n');
    const instructions: Instruction[] = [];
    const labels: Record<string, number> = {};

    let currentOrg = 0;

    lines.forEach((line, index) => {
      const cleanLine = line.split(';')[0].trim();
      if (!cleanLine) return;

      // Handle Labels
      let remaining = cleanLine;
      if (cleanLine.includes(':')) {
        const [label, ...rest] = cleanLine.split(':');
        labels[label.trim()] = instructions.length;
        remaining = rest.join(':').trim();
      }

      if (!remaining) return;

      // Handle Directives
      if (remaining.startsWith('ORG')) {
        // We don't strictly follow memory addresses in this simple emulator, 
        // but we can use it to set the start point if needed.
        return;
      }
      if (remaining.startsWith('END')) return;

      // Parse Opcode and Args
      const parts = remaining.split(/\s+/);
      const opcode = parts[0].toUpperCase();
      const args = parts.slice(1).join('').split(',').map(s => s.trim());

      instructions.push({
        line: index,
        originalText: line,
        opcode,
        args,
      });
    });

    return { instructions, labels };
  }

  private getValue(arg: string): number {
    if (arg.startsWith('#')) {
      // Immediate value
      let valStr = arg.substring(1);
      if (valStr.endsWith('H')) {
        return parseInt(valStr.slice(0, -1), 16);
      }
      return parseInt(valStr, 10);
    }
    if (this.state.registers[arg.toUpperCase()] !== undefined) {
      return this.state.registers[arg.toUpperCase()];
    }
    // Handle hex values without # if they are addresses (simplified)
    if (arg.endsWith('H')) {
        return parseInt(arg.slice(0, -1), 16);
    }
    return 0;
  }

  private setValue(arg: string, value: number) {
    const reg = arg.toUpperCase();
    if (this.state.registers[reg] !== undefined) {
      this.state.registers[reg] = value & 0xFF; // 8-bit registers
    }
  }

  step() {
    if (this.state.pc >= this.state.instructions.length) {
      this.state.isRunning = false;
      return;
    }

    const inst = this.state.instructions[this.state.pc];
    this.state.currentLine = inst.line;
    let nextPc = this.state.pc + 1;

    switch (inst.opcode) {
      case 'MOV': {
        const val = this.getValue(inst.args[1]);
        this.setValue(inst.args[0], val);
        break;
      }
      case 'ANL': {
        const val = this.getValue(inst.args[1]);
        const current = this.getValue(inst.args[0]);
        this.setValue(inst.args[0], current & val);
        break;
      }
      case 'CJNE': {
        const val1 = this.getValue(inst.args[0]);
        const val2 = this.getValue(inst.args[1]);
        const label = inst.args[2];
        if (val1 !== val2) {
          nextPc = this.state.labels[label];
        }
        break;
      }
      case 'SJMP':
      case 'LJMP': {
        const label = inst.args[0];
        nextPc = this.state.labels[label];
        break;
      }
      case 'INC': {
        const val = this.getValue(inst.args[0]);
        this.setValue(inst.args[0], val + 1);
        break;
      }
      case 'LCALL': {
        const label = inst.args[0];
        this.state.stack.push(this.state.pc + 1);
        nextPc = this.state.labels[label];
        break;
      }
      case 'RET': {
        const returnAddr = this.state.stack.pop();
        if (returnAddr !== undefined) {
          nextPc = returnAddr;
        }
        break;
      }
      case 'DJNZ': {
        const reg = inst.args[0];
        const label = inst.args[1];
        const val = this.getValue(reg) - 1;
        this.setValue(reg, val);
        if (val !== 0) {
          nextPc = this.state.labels[label];
        }
        break;
      }
      case 'SETB': {
        this.setValue(inst.args[0], 1);
        break;
      }
      case 'CLR': {
        this.setValue(inst.args[0], 0);
        break;
      }
      case 'JNB': {
        const bit = this.getValue(inst.args[0]);
        const label = inst.args[1];
        if (bit === 0) {
          nextPc = this.state.labels[label];
        }
        break;
      }
      default:
        console.warn('Unknown opcode:', inst.opcode);
    }

    this.state.pc = nextPc;
  }

  reset() {
    const startLabel = this.state.labels['MAIN'] !== undefined ? this.state.labels['MAIN'] : 0;
    this.state.pc = startLabel;
    this.state.stack = [];
    this.state.registers.P1 = 0x55;
    this.state.registers.R0 = 1;
    this.state.isRunning = false;
  }
}

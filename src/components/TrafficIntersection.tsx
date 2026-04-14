/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface TrafficIntersectionProps {
  p1Value: number;
  p0Value: number;
}

export const TrafficIntersection: React.FC<TrafficIntersectionProps> = ({ p1Value, p0Value }) => {
  // ... (logic remains same)
  const getLightState = (lane: number) => {
    const shift = (lane - 1) * 2;
    const bits = (p1Value >> shift) & 0x03;
    return {
      red: (bits & 0x01) === 1,
      green: (bits & 0x02) === 2,
    };
  };

  const getTrafficLevel = (lane: number) => {
    const shift = (lane - 1) * 2;
    const bits = (p0Value >> shift) & 0x03;
    switch (bits) {
      case 0: return 'None';
      case 1: return 'Low';
      case 2: return 'Med';
      case 3: return 'High';
      default: return 'None';
    }
  };

  const lights = [1, 2, 3, 4].map(lane => ({
    lane,
    state: getLightState(lane),
    traffic: getTrafficLevel(lane),
  }));

  return (
    <div className="relative w-full aspect-square max-w-[500px] bg-neutral-100 rounded-3xl overflow-hidden border-8 border-neutral-200 shadow-xl mx-auto">
      {/* Road Layout */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Vertical Road */}
        <div className="absolute w-1/3 h-full bg-neutral-200 flex flex-col justify-between py-4">
          <div className="w-full flex justify-center space-x-1">
            <div className="w-1 h-8 bg-neutral-400/30 rounded-full" />
            <div className="w-1 h-8 bg-neutral-400/30 rounded-full" />
          </div>
          <div className="w-full flex justify-center space-x-1">
            <div className="w-1 h-8 bg-neutral-400/30 rounded-full" />
            <div className="w-1 h-8 bg-neutral-400/30 rounded-full" />
          </div>
        </div>
        {/* Horizontal Road */}
        <div className="absolute h-1/3 w-full bg-neutral-200 flex justify-between px-4">
          <div className="h-full flex flex-col justify-center space-y-1">
            <div className="h-1 w-8 bg-neutral-400/30 rounded-full" />
            <div className="h-1 w-8 bg-neutral-400/30 rounded-full" />
          </div>
          <div className="h-full flex flex-col justify-center space-y-1">
            <div className="h-1 w-8 bg-neutral-400/30 rounded-full" />
            <div className="h-1 w-8 bg-neutral-400/30 rounded-full" />
          </div>
        </div>
        {/* Intersection Center */}
        <div className="w-1/3 h-1/3 bg-neutral-300 z-10 border-4 border-neutral-400" />
      </div>

      {/* Traffic Lights */}
      {/* Lane 1 (Bottom, going North) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        <LightBox state={lights[0].state} label="L1" />
        <TrafficIndicator level={lights[0].traffic} />
      </div>

      {/* Lane 2 (Left, going East) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center space-x-2">
        <TrafficIndicator level={lights[1].traffic} horizontal />
        <LightBox state={lights[1].state} label="L2" />
      </div>

      {/* Lane 3 (Top, going South) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        <TrafficIndicator level={lights[2].traffic} />
        <LightBox state={lights[2].state} label="L3" />
      </div>

      {/* Lane 4 (Right, going West) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center space-x-2">
        <LightBox state={lights[3].state} label="L4" />
        <TrafficIndicator level={lights[3].traffic} horizontal />
      </div>
    </div>
  );
};

const LightBox = ({ state, label }: { state: { red: boolean; green: boolean }, label: string }) => (
  <div className="bg-neutral-800 p-2 rounded-lg border-2 border-neutral-600 shadow-lg flex flex-col items-center space-y-1">
    <div className="text-[10px] font-mono text-neutral-400 mb-1">{label}</div>
    <div className={cn(
      "w-6 h-6 rounded-full transition-all duration-300",
      state.red ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "bg-red-950"
    )} />
    <div className={cn(
      "w-6 h-6 rounded-full transition-all duration-300",
      state.green ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]" : "bg-green-950"
    )} />
  </div>
);

const TrafficIndicator = ({ level, horizontal }: { level: string, horizontal?: boolean }) => (
  <div className={cn(
    "flex items-center justify-center p-1 rounded bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-sm",
    horizontal ? "flex-col" : "flex-row"
  )}>
    <div className="text-[8px] font-bold text-neutral-800 uppercase tracking-tighter">
      {level}
    </div>
  </div>
);

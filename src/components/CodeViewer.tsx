/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeViewerProps {
  code: string;
  currentLine: number;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ code, currentLine }) => {
  const lines = code.split('\n');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll removed as per user request
  }, [currentLine]);

  return (
    <ScrollArea className="h-full w-full rounded-md border bg-neutral-50 font-mono text-sm">
      <div className="p-4 min-w-max">
        {lines.map((line, index) => {
          const isActive = index === currentLine;
          const isComment = line.trim().startsWith(';') || line.includes(';');
          const isLabel = line.trim().includes(':');
          
          return (
            <div
              key={index}
              ref={isActive ? activeLineRef : null}
              className={cn(
                "flex group transition-colors duration-150",
                isActive ? "bg-primary/10 text-primary" : "hover:bg-black/5"
              )}
            >
              <div className="w-10 text-right pr-4 text-neutral-400 select-none border-r border-neutral-200 mr-4">
                {index + 1}
              </div>
              <div className={cn(
                "whitespace-pre pr-4",
                isComment ? "text-neutral-400 italic" : "text-neutral-700",
                isLabel && !isComment ? "text-amber-600 font-bold" : "",
                isActive ? "text-neutral-900 font-bold" : ""
              )}>
                {line || ' '}
              </div>
              {isActive && (
                <div className="ml-auto pl-4 text-primary text-[10px] flex items-center">
                  <span className="animate-pulse">▶ RUNNING</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

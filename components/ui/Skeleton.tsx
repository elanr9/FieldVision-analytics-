import React from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  tone?: 'neutral' | 'info';
  style?: React.CSSProperties;
}

/** Pulsing placeholder bar. tone: neutral (gray-100) | info (ink-100, inside Callout). */
export function Skeleton({ width = '100%', height = 12, radius = 4, tone = 'neutral', style }: SkeletonProps) {
  return (
    <>
      <style>{'@keyframes ink-pulse{50%{opacity:.5}}'}</style>
      <div style={{ width, height, borderRadius: radius, background: tone === 'info' ? 'var(--ink-100)' : 'var(--gray-100)', animation: 'ink-pulse 2s cubic-bezier(.4,0,.6,1) infinite', ...style }} />
    </>
  );
}

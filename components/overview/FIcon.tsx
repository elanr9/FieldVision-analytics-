export interface FIconProps {
  /** Lucide glyph path data on a 24-unit viewBox */
  path: string;
  size?: number;
  color?: string;
}

/** 16px stroke icon. Paths are inlined Lucide glyphs; no icon package is used. */
export function FIcon({ path, size = 16, color = 'var(--ink-600)' }: FIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={path} /></svg>;
}

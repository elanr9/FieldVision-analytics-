'use client';

import { useEffect, useRef, useState } from 'react';

// Count-up numbers. Motion tokens from tokens/effects.css.
export function useCountUp(target: number, ms = 600): number {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current, to = Number(target) || 0, t0 = performance.now();
    let raf = 0, done = false;
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); prev.current = to; setV(to); };
    if (document.hidden) { finish(); return; }
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); setV(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(tick); else finish(); };
    raf = requestAnimationFrame(tick);
    const fallback = setTimeout(finish, ms + 100); // rAF pauses in hidden tabs/iframes
    document.addEventListener('visibilitychange', finish);
    return () => { cancelAnimationFrame(raf); clearTimeout(fallback); document.removeEventListener('visibilitychange', finish); };
  }, [target]);
  return v;
}

type CountUpProps = { value: string | number; decimals?: number };

/** Renders a number or "$1,240"-style string counting up from its previous value. */
export function CountUp({ value, decimals = 0 }: CountUpProps) {
  const s = String(value);
  const m = s.match(/^([^0-9-]*)(-?[0-9][0-9,]*\.?[0-9]*)(.*)$/);
  // Hook must run unconditionally, so parse first and fall back to 0 when there is no numeric part.
  const n = useCountUp(m ? parseFloat(m[2].replace(/,/g, '')) : 0);
  if (!m) return s;
  return m[1] + n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + m[3];
}

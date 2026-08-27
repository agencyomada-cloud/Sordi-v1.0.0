import { useEffect, useRef, useState } from "react";
import { useSpring, useMotionValueEvent } from "framer-motion";

export interface AnimatedNumberProps {
  /** Raw numeric value to animate toward — the caller still owns formatting
   *  (currency symbol, thousands separator, decimals all vary per page). */
  value: number;
  /** Formats the in-flight interpolated value at every animation frame. */
  format: (value: number) => string;
  className?: string;
}

/**
 * Spring-animated numeric counter — every KPI figure across the app
 * (MetricStrip cells, Index.tsx's tier-2 ribbon, page-local stat cards)
 * renders through this instead of a static string, so a value ticks up/down
 * smoothly on first load and on every period/filter switch instead of
 * snapping. Renders the plain formatted value on the very first paint (no
 * animate-from-zero flash) — only transitions after a value actually
 * changes from what was last shown.
 */
// A spring only asymptotically approaches its target — it never lands on
// the exact value — so the displayed text would otherwise show permanent
// floating-point noise (e.g. "5 504 855,136 DA" instead of "...,00 DA")
// once motion becomes visually imperceptible but never mathematically zero.
// Snapping to the exact target within this fraction of its own magnitude
// (with a small absolute floor for values near zero) keeps every settled
// render exactly equal to what a non-animated format(value) would show.
const SETTLE_EPSILON_RATIO = 0.0005;
const SETTLE_EPSILON_MIN = 0.005;

export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const spring = useSpring(value, { stiffness: 120, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(() => format(value));
  const hasMounted = useRef(false);
  const targetRef = useRef(value);

  useEffect(() => {
    targetRef.current = value;
    if (!hasMounted.current) {
      hasMounted.current = true;
      spring.jump(value);
      setDisplay(format(value));
      return;
    }
    spring.set(value);
  }, [value, spring, format]);

  useMotionValueEvent(spring, "change", (latest) => {
    const target = targetRef.current;
    const epsilon = Math.max(SETTLE_EPSILON_MIN, Math.abs(target) * SETTLE_EPSILON_RATIO);
    setDisplay(format(Math.abs(latest - target) < epsilon ? target : latest));
  });

  return <span className={className}>{display}</span>;
}

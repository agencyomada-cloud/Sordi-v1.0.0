import { useEffect, useRef, useState } from "react";

// Animates from 0 to `target` whenever `target` changes, easing out so the
// motion settles rather than stopping abruptly — used for the numbers sitting
// inside dashboard charts (donut centers, gauge percentages) so they feel
// alive on load and on filter changes, not just static labels.
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return value;
}

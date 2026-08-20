import { useEffect, useState } from "react";

/** 150ms by default — chosen for politeness (skip a query on every
 *  keystroke while typing fast), not to mask latency; the local SQLite
 *  queries this backs are measured at 1-3ms even at 5,000+ rows. */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

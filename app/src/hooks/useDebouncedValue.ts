import { useState, useEffect } from "react";

const DEFAULT_MS = 350;

/**
 * Returns a value that updates after the source has been stable for `delayMs`.
 * Useful for debouncing backend calls (e.g. plate search) while the user types.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = DEFAULT_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Returns a setter and the debounced value. Use when you need to drive
 * both the immediate input and a debounced copy (e.g. for API calls).
 */
export function useDebouncedState<T>(
  initial: T,
  delayMs: number = DEFAULT_MS
): [T, T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const debounced = useDebouncedValue(value, delayMs);
  return [value, debounced, setValue];
}

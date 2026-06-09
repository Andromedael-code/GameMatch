import { useEffect, useState } from "react";

function resolveInitialValue(initialValue) {
  return typeof initialValue === "function" ? initialValue() : initialValue;
}

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    const fallback = resolveInitialValue(initialValue);

    if (typeof window === "undefined") {
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [key, state]);

  return [state, setState];
}

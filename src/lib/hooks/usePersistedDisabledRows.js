import { useState, useEffect, useRef } from "react";

const getInitialRows = (storageKey) => {
  if (typeof window === "undefined" || !storageKey) return new Set();
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

export function usePersistedDisabledRows(userId, tableKey) {
  const storageKey = userId ? `weekly-disabled:${userId}:${tableKey}` : null;
  const prevStorageKeyRef = useRef(storageKey);

  const [disabledRows, setDisabledRows] = useState(() =>
    getInitialRows(storageKey)
  );

  // Re-read from localStorage when the user changes (e.g. re-auth / account switch)
  useEffect(() => {
    if (prevStorageKeyRef.current !== storageKey) {
      prevStorageKeyRef.current = storageKey;
      setDisabledRows(getInitialRows(storageKey));
    }
  }, [storageKey]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...disabledRows]));
    } catch {
      // localStorage unavailable (private browsing, storage quota, etc.)
    }
  }, [disabledRows, storageKey]);

  const toggleRow = (key) => {
    setDisabledRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return { disabledRows, toggleRow };
}

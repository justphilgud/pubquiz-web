"use client";
import { useEffect, useRef, useState } from "react";
/** Serialized polling; a delayed response can never replace a newer revision. */
export function useLivePolling<T extends { id: string; revision: number; startedAt: number }>(url: string, initial: T) {
  const [data, setData] = useState(initial), [connected, setConnected] = useState(true);
  const newest = useRef(initial);
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw Error("CONNECTION");
        const next = await response.json() as T;
        if (!cancelled) {
          if (Number.isSafeInteger(next.revision) && ((next.id === newest.current.id && next.revision >= newest.current.revision) || next.startedAt > newest.current.startedAt)) {
            newest.current = next; setData(next);
          }
          setConnected(true);
        }
      } catch { if (!cancelled) setConnected(false); }
      if (!cancelled) timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [url]);
  return { data, connected };
}

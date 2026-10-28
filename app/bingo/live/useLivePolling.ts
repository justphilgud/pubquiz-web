"use client";
import { useEffect, useRef, useState } from "react";
/** A stalled connection must become visible instead of stopping polling forever. */
export async function fetchLiveView<T>(url: string, signal?: AbortSignal): Promise<T> {
  const request = new AbortController(), stop = () => request.abort();
  const deadline = setTimeout(stop, 8000);
  if (signal?.aborted) stop();
  signal?.addEventListener("abort", stop, { once: true });
  try {
    const response = await fetch(url, { cache: "no-store", signal: request.signal });
    if (!response.ok) throw Error("CONNECTION");
    return await response.json() as T;
  } finally { clearTimeout(deadline); signal?.removeEventListener("abort", stop); }
}
/** Serialized polling; a delayed response can never replace a newer revision. */
export function useLivePolling<T extends { id: string; revision: number; startedAt: number }>(url: string, initial: T) {
  const [data, setData] = useState(initial), [connected, setConnected] = useState(true);
  const newest = useRef(initial);
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      try {
        const next = await fetchLiveView<T>(url, controller.signal);
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

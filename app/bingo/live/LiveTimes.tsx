'use client';
import { useEffect, useState } from 'react';

export function elapsedLabel(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
/** Interpolate the server's active durations only; never advance a paused clock. */
export default function LiveTimes({ sample, running }: {
  sample: { serverAt: number; roundElapsedMs: number; elapsedMs: number }; running: boolean;
}) {
  const [tick, setTick] = useState({ serverAt: sample.serverAt, received: 0, delta: 0 });
  useEffect(() => {
    const received = performance.now();
    const update = () => setTick({ serverAt: sample.serverAt, received, delta: running ? performance.now() - received : 0 });
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [sample.serverAt, running]);
  const delta = running && tick.serverAt === sample.serverAt ? tick.delta : 0;
  return <><div>Aktuelle Runde<strong>{elapsedLabel(sample.roundElapsedMs + delta)}</strong></div><div>Bingo gesamt<strong>{elapsedLabel(sample.elapsedMs + delta)}</strong></div></>;
}

"use client";

import { useEffect, useState } from "react";

function formatDuration(startAt: string | Date | null | undefined) {
  if (!startAt) return null;

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startAt).getTime()) / 1000)
  );

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

export function LiveTimer({
  label,
  startAt,
  emptyText = "Noch nicht gestartet",
}: {
  label: string;
  startAt: string | Date | null | undefined;
  emptyText?: string;
}) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    setValue(formatDuration(startAt));

    const interval = window.setInterval(() => {
      setValue(formatDuration(startAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [startAt]);

  return (
    <div className="rounded-xl bg-zinc-950 p-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-3xl font-black">
        {value ?? (startAt ? "--:--" : emptyText)}
      </div>
    </div>
  );
}
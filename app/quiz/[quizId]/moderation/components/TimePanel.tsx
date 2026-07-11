function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(rest).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function secondsSince(startAt: string | null, now: number) {
  if (!startAt) return null;

  return Math.max(0, Math.floor((now - new Date(startAt).getTime()) / 1000));
}

function LiveTimer({
  label,
  startAt,
  now,
  emptyText = "Noch nicht gestartet",
  stopped = false,
}: {
  label: string;
  startAt: string | null;
  now: number;
  emptyText?: string;
  stopped?: boolean;
}) {
  const seconds = stopped ? null : secondsSince(startAt, now);

  return (
    <div className="rounded-xl bg-zinc-950 p-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-black" suppressHydrationWarning>
        {stopped
          ? "Beendet"
          : seconds === null
            ? emptyText
            : formatSeconds(seconds)}
      </div>
    </div>
  );
}

type Props = {
  slideStartedAt: string | null;
  quizStartedAt: string | null;
  now: number;
  quizBeendet?: boolean;
};

export default function TimePanel({
  slideStartedAt,
  quizStartedAt,
  now,
  quizBeendet = false,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-lg font-semibold">Zeit</h2>

      <div className="grid grid-cols-2 gap-2">
        <LiveTimer label="Aktuelle Folie" startAt={slideStartedAt} now={now} />

        <LiveTimer
          label="Quiz gesamt"
          startAt={quizStartedAt}
          now={now}
          emptyText="Nicht gestartet"
          stopped={quizBeendet}
        />
      </div>
    </div>
  );
}

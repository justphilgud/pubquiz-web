export function Countdown({
  seconds,
  label = "Verbleibende Zeit",
}: {
  seconds: number;
  label?: string;
}) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return (
    <div className="rounded-xl border bg-white p-4 text-center">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-4xl font-bold tabular-nums text-gray-900">
        {minutes}:{String(rest).padStart(2, "0")}
      </div>
    </div>
  );
}

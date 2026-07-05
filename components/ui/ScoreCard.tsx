export function ScoreCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-sm text-gray-500">{hint}</div>}
    </div>
  );
}

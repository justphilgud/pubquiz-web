export function ProgressBar({
  value,
  max = 100,
  label,
}: {
  value: number;
  max?: number;
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs font-medium text-gray-600">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

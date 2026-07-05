export function Divider({ label }: { label?: string }) {
  if (!label) {
    return <hr className="border-gray-200" />;
  }

  return (
    <div className="flex items-center gap-3">
      <hr className="flex-1 border-gray-200" />
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <hr className="flex-1 border-gray-200" />
    </div>
  );
}

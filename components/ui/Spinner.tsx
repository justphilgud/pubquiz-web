export function Spinner({ label = "Lädt..." }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
      <span>{label}</span>
    </div>
  );
}

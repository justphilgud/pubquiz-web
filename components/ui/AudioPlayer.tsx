export function AudioPlayer({
  src,
  title,
}: {
  src: string;
  title?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      {title && <div className="mb-2 text-sm font-medium text-gray-900">{title}</div>}
      <audio controls src={src} className="w-full" />
    </div>
  );
}

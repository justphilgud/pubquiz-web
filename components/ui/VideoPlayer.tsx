export function VideoPlayer({
  src,
  title,
}: {
  src: string;
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-black">
      {title && <div className="bg-white p-3 text-sm font-medium text-gray-900">{title}</div>}
      <video controls src={src} className="aspect-video w-full" />
    </div>
  );
}

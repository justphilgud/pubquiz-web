export function ImageViewer({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-gray-100">
      <img src={src} alt={alt} className="h-auto w-full object-contain" />
    </div>
  );
}

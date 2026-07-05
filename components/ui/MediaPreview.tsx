import { ReactNode } from "react";

export function MediaPreview({
  title,
  type,
  children,
}: {
  title: string;
  type?: "Bild" | "Audio" | "Video" | "Datei";
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex aspect-video items-center justify-center bg-gray-100 text-sm text-gray-500">
        {children ?? "Medienvorschau"}
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <div>
          <div className="text-sm font-medium text-gray-900">{title}</div>
          {type && <div className="text-xs text-gray-500">{type}</div>}
        </div>
      </div>
    </div>
  );
}

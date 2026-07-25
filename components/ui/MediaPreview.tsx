import { ReactNode } from "react";

export function MediaPreview({
  title,
  type,
  children,
  compact = false,
  layout = "visual",
}: {
  title: string;
  type?: string;
  children?: ReactNode;
  compact?: boolean;
  layout?: "visual" | "audio";
}) {
  if (layout === "audio") {
    return (
      <div
        data-media-preview="audio"
        className="min-w-0 overflow-hidden rounded-xl border bg-white p-3"
      >
        {children}
        <div className="mt-2 min-w-0">
          <div
            className="truncate text-sm font-medium text-gray-900"
            title={title}
          >
            {title}
          </div>
          {type && <div className="text-xs text-gray-500">{type}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      data-media-preview="visual"
      className={`overflow-hidden rounded-xl border bg-white ${compact ? "flex items-stretch" : ""}`}
    >
      <div
        className={`flex items-center justify-center bg-gray-100 text-sm text-gray-500 ${
          compact
            ? "h-20 w-20 shrink-0 [&>div]:h-full [&>div]:w-full [&_img]:h-full [&_img]:object-cover"
            : "aspect-video"
        }`}
      >
        {children ?? "Medienvorschau"}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div
            className="truncate text-sm font-medium text-gray-900"
            title={title}
          >
            {title}
          </div>
          {type && <div className="text-xs text-gray-500">{type}</div>}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

export function AudioPlayer({
  src,
  title,
  mimeType,
  embedded = false,
  errorMessage = "Die Audiodatei konnte nicht geladen werden.",
}: {
  src: string;
  title?: string;
  mimeType?: string;
  embedded?: boolean;
  errorMessage?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const content = (
    <>
      {title && (
        <div
          className="mb-2 truncate text-sm font-medium text-gray-900"
          title={title}
        >
          {title}
        </div>
      )}
      <audio
        controls
        preload="metadata"
        className="block w-full max-w-full"
        onClick={(event) => event.stopPropagation()}
        onError={() => setHasError(true)}
      >
        <source src={src} {...(mimeType ? { type: mimeType } : {})} />
      </audio>
      {hasError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      {content}
    </div>
  );
}

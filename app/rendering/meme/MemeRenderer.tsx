"use client";

import type { CSSProperties } from "react";

import { AutoFitText } from "./AutoFitText";

type Props = {
  imageUrl: string;
  topText?: string;
  bottomText?: string;
  alt: string;
  className?: string;
  onCaptionFitChange?: (
    position: "top" | "bottom",
    text: string,
    fits: boolean,
  ) => void;
};

function gridRows(hasTopCaption: boolean, hasBottomCaption: boolean) {
  if (hasTopCaption && hasBottomCaption) {
    return "21% minmax(0, 1fr) 21%";
  }
  if (hasTopCaption) return "21% minmax(0, 1fr)";
  if (hasBottomCaption) return "minmax(0, 1fr) 21%";
  return "minmax(0, 1fr)";
}

export function MemeRenderer({
  imageUrl,
  topText = "",
  bottomText = "",
  alt,
  className = "",
  onCaptionFitChange,
}: Props) {
  const normalizedTopText = topText.trim();
  const normalizedBottomText = bottomText.trim();
  const figureStyle: CSSProperties = {
    containerType: "inline-size",
    gridTemplateRows: gridRows(
      Boolean(normalizedTopText),
      Boolean(normalizedBottomText),
    ),
  };

  return (
    <figure
      data-meme-renderer
      data-has-top-caption={normalizedTopText ? "true" : "false"}
      data-has-bottom-caption={normalizedBottomText ? "true" : "false"}
      style={figureStyle}
      className={`isolate grid aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black ${className}`}
    >
      {normalizedTopText && (
        <AutoFitText
          text={normalizedTopText}
          position="top"
          onFitChange={onCaptionFitChange}
        />
      )}
      <div data-meme-image className="min-h-0 overflow-hidden bg-black">
        {/* Dynamic quiz media has no build-time dimensions and may come from Blob. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} className="h-full w-full object-contain" />
      </div>
      {normalizedBottomText && (
        <AutoFitText
          text={normalizedBottomText}
          position="bottom"
          onFitChange={onCaptionFitChange}
        />
      )}
    </figure>
  );
}

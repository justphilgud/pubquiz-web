"use client";

import type { CSSProperties } from "react";

import { AutoFitText } from "./AutoFitText";
import {
  legacyMemeCaptions,
  resolveMemeCaptionLayout,
  type ResolvedMemeCaptionLayout,
} from "@/app/quiz/memeCaptionZones";
import {
  getExternalMemeCaptionRowHeightCqw,
  getExternalMemeCaptionRowPercent,
} from "@/app/quiz/memeCaptionLayout";

type Props = {
  imageUrl: string;
  topText?: string;
  bottomText?: string;
  captions?: Record<string, string>;
  layout?: ResolvedMemeCaptionLayout;
  alt: string;
  className?: string;
  onCaptionFitChange?: (
    zoneId: string,
    text: string,
    fits: boolean,
  ) => void;
};

function gridRows(topPercent: number, bottomPercent: number) {
  if (topPercent > 0 && bottomPercent > 0) {
    return `${topPercent}% minmax(0, 1fr) ${bottomPercent}%`;
  }
  if (topPercent > 0) return `${topPercent}% minmax(0, 1fr)`;
  if (bottomPercent > 0) return `minmax(0, 1fr) ${bottomPercent}%`;
  return "minmax(0, 1fr)";
}

export function MemeRenderer({
  imageUrl,
  topText = "",
  bottomText = "",
  captions,
  layout = resolveMemeCaptionLayout(null),
  alt,
  className = "",
  onCaptionFitChange,
}: Props) {
  const values = captions ?? legacyMemeCaptions(topText, bottomText);
  const normalizedValues = Object.fromEntries(
    Object.entries(values).map(([zoneId, text]) => [zoneId, text.trim()]),
  );
  const topZone = layout.zones.find((zone) => zone.placement === "EXTERNAL_TOP");
  const bottomZone = layout.zones.find((zone) => zone.placement === "EXTERNAL_BOTTOM");
  const normalizedTopText = topZone ? normalizedValues[topZone.id] ?? "" : "";
  const normalizedBottomText = bottomZone ? normalizedValues[bottomZone.id] ?? "" : "";
  const imageZones = layout.zones.filter(
    (zone) => zone.placement === "IMAGE" && Boolean(normalizedValues[zone.id]),
  );
  const topPercent = getExternalMemeCaptionRowPercent(normalizedTopText, topZone);
  const bottomPercent = getExternalMemeCaptionRowPercent(normalizedBottomText, bottomZone);
  const figureStyle: CSSProperties = {
    containerType: "inline-size",
    gridTemplateRows: gridRows(topPercent, bottomPercent),
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  return (
    <figure
      data-meme-renderer
      data-has-top-caption={normalizedTopText ? "true" : "false"}
      data-has-bottom-caption={normalizedBottomText ? "true" : "false"}
      data-meme-layout={layout.mode}
      style={figureStyle}
      className={`isolate grid aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black ${className}`}
    >
      {normalizedTopText && (
        <AutoFitText
          text={normalizedTopText}
          zone={topZone!}
          externalHeightCqw={getExternalMemeCaptionRowHeightCqw(normalizedTopText, topZone)}
          onFitChange={onCaptionFitChange}
        />
      )}
      <div data-meme-image className="relative min-h-0 overflow-hidden bg-black">
        {/* Dynamic quiz media has no build-time dimensions and may come from Blob. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} className="h-full w-full object-contain" />
        {imageZones.map((zone) => (
          <div
            key={zone.id}
            data-meme-image-zone={zone.id}
            className="absolute overflow-hidden"
            style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
          >
            <AutoFitText
              text={normalizedValues[zone.id]}
              zone={zone}
              overlay
              onFitChange={onCaptionFitChange}
            />
          </div>
        ))}
      </div>
      {normalizedBottomText && (
        <AutoFitText
          text={normalizedBottomText}
          zone={bottomZone!}
          externalHeightCqw={getExternalMemeCaptionRowHeightCqw(normalizedBottomText, bottomZone)}
          onFitChange={onCaptionFitChange}
        />
      )}
    </figure>
  );
}

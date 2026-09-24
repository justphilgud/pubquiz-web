import type { CSSProperties } from "react";

type Props = {
  imageUrl: string;
  topText?: string;
  bottomText?: string;
  alt: string;
  className?: string;
};

const captionStyle: CSSProperties = {
  fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  WebkitTextStroke: "clamp(1px, 0.16em, 4px) #000",
  paintOrder: "stroke fill",
  textShadow: "0 0.08em 0 #000, 0.05em 0.08em 0 #000, -0.05em 0.08em 0 #000",
};

function getCaptionStyle(text: string): CSSProperties {
  const length = text.length;
  const fontSize = length > 64
    ? "clamp(0.8rem, 3.4cqw, 2.75rem)"
    : length > 48
      ? "clamp(0.9rem, 4.2cqw, 3.4rem)"
      : "clamp(1rem, 6cqw, 4.5rem)";
  return { ...captionStyle, fontSize };
}

export function MemeRenderer({
  imageUrl,
  topText = "",
  bottomText = "",
  alt,
  className = "",
}: Props) {
  return (
    <figure
      data-meme-renderer
      className={`relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ containerType: "inline-size" }}
    >
      {/* Dynamic quiz media has no build-time dimensions and may come from Blob. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt} className="h-full w-full object-contain" />
      {topText && (
        <figcaption
          data-meme-caption="top"
          style={getCaptionStyle(topText)}
          className="absolute inset-x-[3%] top-[3%] text-center font-black uppercase leading-[0.95] tracking-tight text-white [overflow-wrap:anywhere]"
        >
          {topText}
        </figcaption>
      )}
      {bottomText && (
        <figcaption
          data-meme-caption="bottom"
          style={getCaptionStyle(bottomText)}
          className="absolute inset-x-[3%] bottom-[3%] text-center font-black uppercase leading-[0.95] tracking-tight text-white [overflow-wrap:anywhere]"
        >
          {bottomText}
        </figcaption>
      )}
    </figure>
  );
}

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
    >
      {/* Dynamic quiz media has no build-time dimensions and may come from Blob. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt} className="h-full w-full object-contain" />
      {topText && (
        <figcaption
          data-meme-caption="top"
          style={captionStyle}
          className="absolute inset-x-[3%] top-[3%] text-center text-[clamp(1.4rem,6cqw,4.5rem)] font-black uppercase leading-[0.95] tracking-tight text-white"
        >
          {topText}
        </figcaption>
      )}
      {bottomText && (
        <figcaption
          data-meme-caption="bottom"
          style={captionStyle}
          className="absolute inset-x-[3%] bottom-[3%] text-center text-[clamp(1.4rem,6cqw,4.5rem)] font-black uppercase leading-[0.95] tracking-tight text-white"
        >
          {bottomText}
        </figcaption>
      )}
    </figure>
  );
}

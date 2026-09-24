"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  analyzeMemeCaptionLayout,
  MEME_CAPTION_MAX_LINES,
  MEME_CAPTION_MIN_FONT_CQW,
} from "@/app/quiz/memeCaptionLayout";

type Props = {
  text: string;
  position: "top" | "bottom";
  onFitChange?: (
    position: "top" | "bottom",
    text: string,
    fits: boolean,
  ) => void;
};

const LINE_HEIGHT = 1.02;
const MAX_FONT_SIZE_PX = 76;

export function AutoFitText({ text, position, onFitChange }: Props) {
  const captionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const fitCallbackRef = useRef(onFitChange);
  const analysis = analyzeMemeCaptionLayout(text);
  const [measuredFontSize, setMeasuredFontSize] = useState<number | null>(null);
  const [fits, setFits] = useState(analysis.fits);

  useLayoutEffect(() => {
    fitCallbackRef.current = onFitChange;
  }, [onFitChange]);

  const measure = useCallback(() => {
    const caption = captionRef.current;
    const content = textRef.current;
    if (!caption || !content || caption.clientWidth === 0) return;
    const textElement = content;

    const minimum = Math.max(
      12,
      caption.clientWidth * (MEME_CAPTION_MIN_FONT_CQW / 100),
    );
    const preferred = Math.min(
      MAX_FONT_SIZE_PX,
      Math.max(minimum, caption.clientWidth * (analysis.fontSizeCqw / 100)),
    );
    const computed = window.getComputedStyle(caption);
    const availableHeight = caption.clientHeight -
      Number.parseFloat(computed.paddingTop) -
      Number.parseFloat(computed.paddingBottom);

    function fitsAt(fontSize: number) {
      textElement.style.fontSize = `${fontSize}px`;
      const lineHeight = fontSize * LINE_HEIGHT;
      const renderedLines = Math.ceil((textElement.scrollHeight - 0.5) / lineHeight);
      return renderedLines <= MEME_CAPTION_MAX_LINES &&
        textElement.scrollHeight <= availableHeight + 1 &&
        textElement.scrollWidth <= textElement.clientWidth + 1;
    }

    const nextFits = fitsAt(minimum);
    let best = minimum;
    if (nextFits) {
      let low = minimum;
      let high = preferred;
      for (let index = 0; index < 8; index += 1) {
        const candidate = (low + high) / 2;
        if (fitsAt(candidate)) {
          best = candidate;
          low = candidate;
        } else {
          high = candidate;
        }
      }
      fitsAt(best);
    }

    setMeasuredFontSize(best);
    setFits(nextFits);
    fitCallbackRef.current?.(position, text, nextFits);
  }, [analysis.fontSizeCqw, position, text]);

  useLayoutEffect(() => {
    const caption = captionRef.current;
    if (!caption) return;

    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(caption);
    scheduleMeasure();
    void document.fonts?.ready.then(scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [measure]);

  return (
    <figcaption
      ref={captionRef}
      data-meme-caption={position}
      data-meme-caption-fit={fits ? "true" : "false"}
      className="flex min-h-0 items-center justify-center overflow-hidden bg-slate-100 px-[3cqw] py-[0.75cqw] text-center font-bold tracking-[-0.02em] text-slate-950"
    >
      <span
        ref={textRef}
        data-auto-fit-text
        data-auto-fit-lines={analysis.lineCount}
        className="block w-full [hyphens:none] [overflow-wrap:anywhere]"
        style={{
          fontSize: measuredFontSize === null
            ? `${analysis.fontSizeCqw}cqw`
            : `${measuredFontSize}px`,
          lineHeight: LINE_HEIGHT,
        }}
      >
        {text}
      </span>
    </figcaption>
  );
}

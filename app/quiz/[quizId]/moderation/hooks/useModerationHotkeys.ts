"use client";

import { useEffect } from "react";

type Props = {
  hatMedien: boolean;
  hatAudio: boolean;
  onWeiter: () => void;
  onZurueck: () => void;
  onBlockFreigeben: () => void;
  onBlockSchliessen: () => void;
  onAuswertungOeffnen: () => void;
  onMediumToggle: () => void;
  onAudioToggle: () => void;
};

export function useModerationHotkeys({
  hatMedien,
  hatAudio,
  onWeiter,
  onZurueck,
  onBlockFreigeben,
  onBlockSchliessen,
  onAuswertungOeffnen,
  onMediumToggle,
  onAudioToggle,
}: Props) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();

      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        onWeiter();
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        onZurueck();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();

        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }

        return;
      }

      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        onBlockFreigeben();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        onBlockSchliessen();
        return;
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        onAuswertungOeffnen();
        return;
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();

        if (hatMedien) {
          onMediumToggle();
        }

        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();

        if (hatAudio) {
          onAudioToggle();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hatMedien,
    hatAudio,
    onWeiter,
    onZurueck,
    onBlockFreigeben,
    onBlockSchliessen,
    onAuswertungOeffnen,
    onMediumToggle,
    onAudioToggle,
  ]);
}

"use client";

import { useEffect, useRef } from "react";

export function isDismissTargetOutside(
  container: Pick<HTMLElement, "contains"> | null,
  target: EventTarget | null,
) {
  return Boolean(container && target && !container.contains(target as Node));
}

export function useDismissiblePopover<T extends HTMLElement = HTMLButtonElement>({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: PointerEvent | FocusEvent) {
      if (isDismissTargetOutside(containerRef.current, event.target)) {
        onClose();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("focusin", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("focusin", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  return { containerRef, triggerRef };
}

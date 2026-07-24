"use client";

import type { ChangeEventHandler } from "react";
import { FileUpload } from "@/components/ui";

type ImageSourceInputsProps = {
  accept: string;
  description: string;
  disabled: boolean;
  compact: boolean;
  galleryLabel: string;
  cameraLabel: string;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
};

export function ImageSourceInputs({
  accept,
  description,
  disabled,
  compact,
  galleryLabel,
  cameraLabel,
  onFileChange,
}: ImageSourceInputsProps) {
  return (
    <div
      data-image-source-inputs
      className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2"
    >
      <FileUpload
        compact={compact}
        label={galleryLabel}
        description={description}
        accept={accept}
        disabled={disabled}
        className="min-w-0"
        onChange={onFileChange}
      />
      <FileUpload
        compact={compact}
        label={cameraLabel}
        description={description}
        accept={accept}
        capture="environment"
        disabled={disabled}
        className="min-w-0"
        onChange={onFileChange}
      />
    </div>
  );
}

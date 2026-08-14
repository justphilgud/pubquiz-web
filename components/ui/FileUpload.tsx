import { InputHTMLAttributes, useId } from "react";

type FileUploadProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  description?: string;
  compact?: boolean;
};

export function FileUpload({
  label = "Datei hochladen",
  description = "Datei auswählen.",
  compact = false,
  className = "",
  ...props
}: FileUploadProps) {
  const descriptionId = useId();
  const generatedInputId = useId();
  const inputId = props.id ?? generatedInputId;

  return (
    <label
      htmlFor={inputId}
      className={[
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white text-center transition hover:bg-gray-50",
        compact ? "min-h-11 px-3 py-2" : "p-6",
        props.disabled ? "cursor-not-allowed opacity-60" : "",
        className,
      ].join(" ")}
    >
      <span className="text-sm font-medium text-gray-900">{label}</span>
      {description && (
        <span id={descriptionId} className="mt-1 text-xs text-gray-500">
          {description}
        </span>
      )}
      <input
        id={inputId}
        type="file"
        className="sr-only"
        aria-describedby={description ? descriptionId : undefined}
        {...props}
      />
    </label>
  );
}

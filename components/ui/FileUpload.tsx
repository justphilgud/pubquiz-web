import { InputHTMLAttributes } from "react";

type FileUploadProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  description?: string;
};

export function FileUpload({
  label = "Datei hochladen",
  description = "Datei auswählen oder hier ablegen.",
  className = "",
  ...props
}: FileUploadProps) {
  return (
    <label
      className={[
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white p-6 text-center transition hover:bg-gray-50",
        className,
      ].join(" ")}
    >
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className="mt-1 text-xs text-gray-500">{description}</span>
      <input type="file" className="sr-only" {...props} />
    </label>
  );
}

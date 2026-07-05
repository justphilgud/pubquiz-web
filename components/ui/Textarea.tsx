import { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={[
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
        "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
        "disabled:cursor-not-allowed disabled:bg-gray-100",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

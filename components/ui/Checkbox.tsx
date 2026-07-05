import { InputHTMLAttributes, ReactNode } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  hint?: ReactNode;
};

export function Checkbox({ label, hint, className = "", ...props }: CheckboxProps) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        className={[
          "mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600",
          "focus:ring-2 focus:ring-blue-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ].join(" ")}
        {...props}
      />
      {(label || hint) && (
        <span>
          {label && <span className="font-medium text-gray-900">{label}</span>}
          {hint && <span className="block text-gray-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

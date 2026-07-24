import { InputHTMLAttributes, ReactNode } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  hint?: ReactNode;
  variant?: "default" | "card";
};

export function Checkbox({
  label,
  hint,
  variant = "default",
  className = "",
  ...props
}: CheckboxProps) {
  return (
    <label
      className={[
        "flex items-start gap-3 text-sm",
        variant === "card"
          ? [
              "min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-2.5",
              "transition hover:border-slate-500",
              "focus-within:ring-2 focus-within:ring-blue-200",
              "has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
            ].join(" ")
          : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className={[
          "mt-0.5 shrink-0 rounded border-gray-300 text-blue-600",
          variant === "card" ? "h-5 w-5" : "h-4 w-4",
          "focus:ring-2 focus:ring-blue-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ].join(" ")}
        {...props}
      />
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="font-medium text-gray-900">{label}</span>}
          {hint && <span className="block text-gray-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

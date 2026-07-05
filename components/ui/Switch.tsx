"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  className = "",
  disabled,
  ...props
}: SwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || hint) && (
        <div className="text-sm">
          {label && <div className="font-medium text-gray-900">{label}</div>}
          {hint && <div className="text-gray-500">{hint}</div>}
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-blue-600" : "bg-gray-300",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        ].join(" ")}
        {...props}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-5" : "translate-x-0.5",
            "mt-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

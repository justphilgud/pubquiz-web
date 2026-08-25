"use client";

import { useState, type InputHTMLAttributes } from "react";
import {
  BeakerIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { Input } from "@/components/ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  onGenerate?: () => void;
  generateLabel?: string;
};

export function passwordInputType(visible: boolean) {
  return visible ? "text" : "password";
}

export function PasswordInput({
  label,
  id,
  className = "",
  onGenerate,
  generateLabel = "Passwort generieren",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? `password-${props.name}`;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Input
          {...props}
          id={inputId}
          type={passwordInputType(visible)}
          className={`min-h-11 ${onGenerate ? "pr-24" : "pr-12"} ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className={`absolute inset-y-0 ${onGenerate ? "right-12" : "right-1"} inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400`}
          aria-label={visible ? `${label} verbergen` : `${label} anzeigen`}
          aria-pressed={visible}
        >
          {visible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            className="absolute inset-y-0 right-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label={generateLabel}
            title={generateLabel}
          >
            <BeakerIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

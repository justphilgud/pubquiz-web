"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

type Props = {
  label: string;
  name: string;
  required?: boolean;
  minLength?: number;
};

export function PasswordInput({ label, name, required, minLength }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>

      <div className="relative">
        <PasswordInput
          label="Aktuelles Passwort"
          name="currentPassword"
          required
        />

        <PasswordInput
          label="Neues Passwort"
          name="newPassword"
          required
          minLength={8}
        />

        <PasswordInput
          label="Neues Passwort wiederholen"
          name="confirmPassword"
          required
          minLength={8}
        />

        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-800"
          aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        >
          {visible ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

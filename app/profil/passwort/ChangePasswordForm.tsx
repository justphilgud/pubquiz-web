"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import { PasswordInput } from "@/app/components/PasswordInput";

const initialState = {
  success: false,
  error: "",
};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Passwort ändern</h1>

      {state?.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Passwort wurde erfolgreich geändert.
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Aktuelles Passwort
          </label>
          <input
            name="currentPassword"
            type="password"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Neues Passwort
          </label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Neues Passwort wiederholen
          </label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Speichern..." : "Passwort speichern"}
        </button>
      </form>
    </main>
  );
}
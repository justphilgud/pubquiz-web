"use client";

import { useActionState, useState } from "react";
import { changePassword } from "./actions";
import { Alert, AuthCard, Button } from "@/components/ui";
import { PasswordInput } from "@/app/components/PasswordInput";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";
import { PASSWORD_MIN_LENGTH } from "@/app/lib/passwordPolicy";

const initialState = { success: false, error: "" };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const hasConfirmation = confirmPassword.length > 0;
  const passwordsMatch = hasConfirmation && newPassword === confirmPassword;

  return (
    <AuthCard title="Passwort ändern">
      {state?.error && <div className="mb-4"><Alert variant="danger" title="Fehler">{state.error}</Alert></div>}
      {state?.success && <div className="mb-4"><Alert variant="success" title="Erfolgreich">Passwort wurde erfolgreich geändert.</Alert></div>}

      <form action={formAction} className="space-y-5">
        <PasswordInput label="Aktuelles Passwort" name="currentPassword" autoComplete="current-password" required />

        <div>
          <PasswordInput
            label="Neues Passwort"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <PasswordRequirements password={newPassword} />
        </div>

        <div>
          <PasswordInput
            label="Neues Passwort wiederholen"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-describedby="password-match-status"
          />
          {hasConfirmation && (
            <p
              id="password-match-status"
              aria-live="polite"
              className={`mt-2 text-xs font-semibold ${passwordsMatch ? "text-emerald-700" : "text-red-700"}`}
            >
              <span aria-hidden="true">{passwordsMatch ? "✓" : "×"}</span>{" "}
              {passwordsMatch ? "Passwörter stimmen überein" : "Passwörter stimmen nicht überein"}
            </p>
          )}
        </div>

        <div className="flex justify-center pt-2">
          <Button type="submit" disabled={pending}>{pending ? "Speichern..." : "Passwort speichern"}</Button>
        </div>
      </form>
    </AuthCard>
  );
}

"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import { Alert, AuthCard, Button, FormField, Input } from "@/components/ui";

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
    <AuthCard title="Passwort ändern">
      {state?.error && (
        <div className="mb-4">
          <Alert variant="danger" title="Fehler">
            {state.error}
          </Alert>
        </div>
      )}

      {state?.success && (
        <div className="mb-4">
          <Alert variant="success" title="Erfolgreich">
            Passwort wurde erfolgreich geändert.
          </Alert>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <FormField label="Aktuelles Passwort">
          <Input name="currentPassword" type="password" required />
        </FormField>

        <FormField label="Neues Passwort">
          <Input name="newPassword" type="password" required minLength={8} />
        </FormField>

        <FormField label="Neues Passwort wiederholen">
          <Input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
          />
        </FormField>

        <div className="flex justify-center pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Speichern..." : "Passwort speichern"}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

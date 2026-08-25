"use client";

import { useActionState, useState } from "react";
import { PasswordInput } from "@/app/components/PasswordInput";
import { setTeamPasswordAction } from "@/app/teams/actions";
import { INITIAL_TEAM_ACTION_RESULT } from "@/app/teams/teamActionResult";
import { generateTeamPassword } from "@/app/teams/teamPassword";

export function TeamPasswordPanel({
  teamId,
  initialPassword,
}: {
  teamId: number;
  initialPassword: string;
}) {
  const [state, formAction, pending] = useActionState(
    setTeamPasswordAction,
    INITIAL_TEAM_ACTION_RESULT,
  );
  const [password, setPassword] = useState(initialPassword);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Team-Passwort</h2>
      <p className="mt-1 text-sm text-slate-600">
        Zeige das bestehende Zugangswort an, bearbeite es oder erzeuge einen neuen Vorschlag.
      </p>
      <form
        action={formAction}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <input type="hidden" name="teamId" value={teamId} />
        <PasswordInput
          label="Team-Passwort"
          name="password"
          required
          maxLength={80}
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onGenerate={() => setPassword(generateTeamPassword())}
          generateLabel="Zufälliges Team-Passwort erzeugen"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Speichert..." : "Speichern"}
        </button>
      </form>
      <p className="mt-3 text-sm text-slate-600">
        <strong>Dieses Team-Passwort gilt in allen Eventreihen.</strong> Ein erzeugter Wert wird erst mit „Speichern“ übernommen.
      </p>
      {state.message && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${state.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          role="alert"
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
    </section>
  );
}

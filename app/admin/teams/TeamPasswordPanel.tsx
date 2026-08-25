"use client";

import { useActionState, useState, useTransition } from "react";
import {
  INITIAL_TEAM_ACTION_RESULT,
  randomizeTeamPasswordAction,
  revealTeamPasswordAction,
  setTeamPasswordAction,
} from "@/app/teams/actions";

export function TeamPasswordPanel({ teamId }: { teamId: number }) {
  const [state, formAction, pending] = useActionState(
    setTeamPasswordAction,
    INITIAL_TEAM_ACTION_RESULT,
  );
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const visiblePassword = state.revealedPassword ?? revealedPassword;

  function run(action: () => Promise<{ message: string; revealedPassword?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.revealedPassword) setRevealedPassword(result.revealedPassword);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Team-Passwort</h2>
      <p className="mt-1 text-sm text-slate-600">
        Das Zugangswort wird nur auf Anforderung sichtbar und nicht in der Übersicht ausgeliefert.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="min-w-32 rounded-xl bg-slate-100 px-4 py-3 text-lg font-bold tracking-wide">
          {visiblePassword ?? "••••••••"}
        </code>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => revealTeamPasswordAction(teamId))}
          className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          Passwort anzeigen
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => randomizeTeamPasswordAction(teamId))}
          className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          Zufälliges Passwort
        </button>
      </div>
      <form action={formAction} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="teamId" value={teamId} />
        <label>
          <span className="mb-1 block text-sm font-semibold">Neues Zugangswort</span>
          <input
            name="password"
            type="text"
            required
            maxLength={80}
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
            placeholder="z. B. Adler"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Passwort ändern
        </button>
      </form>
      {(state.message || message) && (
        <p className="mt-3 text-sm font-medium" aria-live="polite">{state.message || message}</p>
      )}
    </section>
  );
}

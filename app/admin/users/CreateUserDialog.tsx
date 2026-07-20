"use client";

import { createUserAction } from "./actions";
import { generateMemorablePassword } from "@/app/lib/passwordGenerator";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useState, useTransition } from "react";
import type { RoleMessages } from "@/app/i18n/roleMessages";

export default function CreateUserDialog({ messages }: { messages: RoleMessages }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(generateMemorablePassword);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPassword(generateMemorablePassword());
          setOpen(true);
        }}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
      >
        Benutzer anlegen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-xl font-bold">Neuer Benutzer</h2>
              <p className="mt-1 text-sm text-slate-600">
                Lege einen neuen Benutzer mit Rollen und Passwort an.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                <span className="text-red-500">*</span> Pflichtfeld
              </p>
            </div>

            <form
              action={(formData) => {
                startTransition(async () => {
                  await createUserAction(formData);
                  setOpen(false);
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  E-Mail <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Passwort <span className="text-red-500">*</span>
                </label>

                <div className="mt-1 flex gap-2">
                  <input
                    name="password"
                    type="text"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => setPassword(generateMemorablePassword())}
                    title="Neues Passwort erzeugen"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                  </button>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Mindestens 8 Zeichen. Das Startpasswort soll beim ersten Login
                  geändert werden.
                </p>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  {messages.fields.globalRoles}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" name="globalRoles" value="ADMIN" className="h-4 w-4" />
                    {messages.assignmentRoles.ADMIN}
                  </label>
                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" name="globalRoles" value="EDITOR" defaultChecked className="h-4 w-4" />
                    {messages.globalRoles.EDITOR}
                  </label>
                </div>
                <p className="mt-2 text-xs text-slate-500">{messages.summaries.noGlobalRole} ist ebenfalls zulässig.</p>
              </fieldset>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Abbrechen
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isPending ? "Speichert..." : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { updateUserAction } from "./actions";
import { generateMemorablePassword } from "@/app/lib/passwordGenerator";
import { BeakerIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useState, useTransition } from "react";
import type { EventSeriesMembershipOptions } from "@/app/eventreihen/membershipActions";
import { EventSeriesMembershipManager } from "@/app/eventreihen/EventSeriesMembershipManager";
import type { RoleMessages } from "@/app/i18n/roleMessages";

type User = {
  id: number;
  name: string | null;
  email: string;
  role: "ADMIN" | "EDITOR" | "USER";
  is_active: boolean;
};

export default function EditUserDialog({
  user,
  membershipData,
  messages,
}: {
  user: User;
  membershipData: EventSeriesMembershipOptions;
  messages: RoleMessages;
}) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changePassword, setChangePassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generateNewPassword() {
    setNewPassword(generateMemorablePassword());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNewPassword("");
          setChangePassword(false);
          setOpen(true);
        }}
        aria-label={messages.actions.edit}
        title={messages.actions.edit}
        className="min-h-11 min-w-11 rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
      >
        <PencilSquareIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold">Benutzer bearbeiten</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ändere Stammdaten, Rolle, Status oder setze ein neues
                Startpasswort.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                <span className="text-red-500">*</span> Pflichtfeld
              </p>
            </div>

            <form
              action={(formData) => {
                startTransition(async () => {
                  await updateUserAction(formData);
                  setOpen(false);
                });
              }}
              className="space-y-5"
            >
              <input type="hidden" name="id" value={user.id} />

              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Persönliche Daten
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="name"
                      required
                      defaultValue={user.name ?? ""}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                      defaultValue={user.email}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {messages.fields.globalRole}
                    </label>
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="USER">{messages.globalRoles.USER}</option>
                      <option value="EDITOR">{messages.globalRoles.EDITOR}</option>
                      <option value="ADMIN">{messages.globalRoles.ADMIN}</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      {messages.globalRoleDescriptions[user.role]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  {messages.fields.accountStatus}
                </h3>

                <div className="flex gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="is_active"
                      value="true"
                      defaultChecked={user.is_active}
                      className="h-4 w-4 border-slate-300 text-slate-700 focus:ring-slate-500"
                    />
                    Aktiv
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="is_active"
                      value="false"
                      defaultChecked={!user.is_active}
                      className="h-4 w-4 border-slate-300 text-slate-700 focus:ring-slate-500"
                    />
                    Inaktiv
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  Sicherheit
                </h3>

                {!changePassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword("");
                      setChangePassword(true);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Passwort ändern
                  </button>
                ) : (
                  <>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Neues Startpasswort
                    </label>

                    <div className="flex gap-2">
                      <input
                        name="newPassword"
                        type="text"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />

                      <button
                        type="button"
                        onClick={generateNewPassword}
                        title="Passwort generieren"
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <BeakerIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Das neue Passwort wird erst nach dem Speichern übernommen.
                      Der Benutzer muss es beim nächsten Login ändern.
                    </p>
                  </>
                )}
              </div>

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

            <section className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                {messages.fields.eventSeriesAccess}
              </h3>
              <div className="mt-3">
                <EventSeriesMembershipManager
                  data={membershipData}
                  userId={user.id}
                  messages={messages}
                />
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

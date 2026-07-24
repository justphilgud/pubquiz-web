"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveSuggestedCategory,
  createAdminCategory,
  deleteUnusedCategory,
  mergeCategories,
  renameAdminCategory,
  setCategoryArchived,
  type AdminCategoryActionResult,
} from "./actions";

export type AdminCategoryRow = {
  id: number;
  name: string;
  status: "ACTIVE" | "PENDING" | "ARCHIVED";
  questionCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: AdminCategoryRow["status"]) {
  if (status === "ACTIVE") return "Aktiv";
  if (status === "PENDING") return "Zu prüfen";
  return "Archiviert";
}

export function CategoryAdminManager({
  categories,
}: {
  categories: AdminCategoryRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<"ALL" | AdminCategoryRow["status"]>("ALL");
  const [newName, setNewName] = useState("");
  const [mergeTargets, setMergeTargets] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      categories.filter(
        (category) =>
          (status === "ALL" || category.status === status) &&
          category.name.toLocaleLowerCase("de").includes(
            query.trim().toLocaleLowerCase("de"),
          ),
      ),
    [categories, query, status],
  );
  const activeTargets = categories.filter(
    (category) => category.status === "ACTIVE",
  );

  function run(action: () => Promise<AdminCategoryActionResult>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage({
        tone: result.ok ? "success" : "error",
        text: result.message,
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950">Kategorie anlegen</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            maxLength={100}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Kategoriename"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
          />
          <button
            type="button"
            disabled={isPending || !newName.trim()}
            onClick={() =>
              run(async () => {
                const result = await createAdminCategory(newName);
                if (result.ok) setNewName("");
                return result;
              })
            }
            className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            Anlegen
          </button>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="text-sm font-medium text-slate-800">
          Nach Namen suchen
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as
                  | "ALL"
                  | AdminCategoryRow["status"],
              )
            }
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="ALL">Alle</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="PENDING">Zu prüfen</option>
            <option value="ARCHIVED">Archiviert</option>
          </select>
        </label>
      </section>

      <div aria-live="polite">
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={[
              "rounded-xl px-4 py-3 text-sm font-medium",
              message.tone === "error"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800",
            ].join(" ")}
          >
            {message.text}
          </p>
        )}
      </div>

      <div className="grid gap-3">
        {filtered.map((category) => (
          <article
            key={category.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words font-semibold text-slate-950">
                    {category.name}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {statusLabel(category.status)}
                  </span>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="inline font-medium">Fragen: </dt>
                    <dd className="inline">{category.questionCount}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Erstellt von: </dt>
                    <dd className="inline">{category.createdBy}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Erstellt: </dt>
                    <dd className="inline">{category.createdAt}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Geändert: </dt>
                    <dd className="inline">{category.updatedAt}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap gap-2">
                {category.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const name = window.prompt(
                        "Name vor der Bestätigung prüfen:",
                        category.name,
                      );
                      if (name !== null) {
                        run(() =>
                          approveSuggestedCategory(category.id, name),
                        );
                      }
                    }}
                    className="min-h-11 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Bestätigen
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const name = window.prompt(
                      "Neuer Kategoriename:",
                      category.name,
                    );
                    if (name !== null && name.trim() !== category.name) {
                      run(() => renameAdminCategory(category.id, name));
                    }
                  }}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Umbenennen
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const archive = category.status !== "ARCHIVED";
                    if (
                      !archive ||
                      window.confirm(
                        `„${category.name}“ archivieren? ${category.questionCount} bestehende Zuordnungen bleiben erhalten.`,
                      )
                    ) {
                      run(() =>
                        setCategoryArchived(category.id, archive),
                      );
                    }
                  }}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {category.status === "ARCHIVED"
                    ? "Reaktivieren"
                    : "Archivieren"}
                </button>
                {category.questionCount === 0 ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const warning =
                        category.status === "ACTIVE"
                          ? `Die aktive Kategorie „${category.name}“ ist ungenutzt. Wirklich dauerhaft löschen?`
                          : `Die ungenutzte Kategorie „${category.name}“ dauerhaft löschen?`;
                      if (window.confirm(warning)) {
                        run(() => deleteUnusedCategory(category.id));
                      }
                    }}
                    className="min-h-11 rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                  >
                    Löschen
                  </button>
                ) : (
                  <p className="basis-full text-xs text-slate-500">
                    Wird von {category.questionCount} Fragen verwendet und kann
                    nicht gelöscht werden. Bitte archivieren oder
                    zusammenführen.
                  </p>
                )}
              </div>
            </div>

            {category.status !== "ARCHIVED" && (
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                <select
                  aria-label={`Zielkategorie für ${category.name}`}
                  value={mergeTargets[category.id] ?? ""}
                  onChange={(event) =>
                    setMergeTargets((current) => ({
                      ...current,
                      [category.id]: Number(event.target.value),
                    }))
                  }
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">Zielkategorie auswählen</option>
                  {activeTargets
                    .filter((target) => target.id !== category.id)
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={isPending || !mergeTargets[category.id]}
                  onClick={() => {
                    const targetId = mergeTargets[category.id];
                    const target = categories.find(
                      (candidate) => candidate.id === targetId,
                    );
                    if (
                      target &&
                      window.confirm(
                        `${category.questionCount} Fragen von „${category.name}“ nach „${target.name}“ verschieben und die Quelle archivieren?`,
                      )
                    ) {
                      run(() => mergeCategories(category.id, targetId));
                    }
                  }}
                  className="min-h-11 rounded-xl border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60"
                >
                  Zusammenführen
                </button>
              </div>
            )}
          </article>
        ))}

        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Keine passenden Kategorien gefunden.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type {
  FixedSlideActionState,
} from "./fixedSlideActions";
import { Checkbox } from "@/components/ui/Checkbox";

const INITIAL_FIXED_SLIDE_ACTION_STATE: FixedSlideActionState = {
  status: "idle",
  message: "",
};

type EditorItem = {
  id: string;
  title: string;
  description: string;
  status: "configured" | "notice";
  panel: ReactNode;
};

export function FixedSlideEditor({
  eyebrow,
  title,
  description,
  initialItemId,
  items,
  backHref,
}: {
  eyebrow: string;
  title: string;
  description: string;
  initialItemId: string;
  items: EditorItem[];
  backHref: string;
}) {
  const [activeItemId, setActiveItemId] = useState(initialItemId);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-700">
            {eyebrow}
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
            {description}
          </p>
          <a
            href={backHref}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Zurück zur Quizpflege
          </a>
        </header>

        <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <nav
            aria-label={`${eyebrow}-Slides`}
            className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:block lg:space-y-2"
          >
            {items.map((item, index) => {
              const active = item.id === activeItemId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    setActiveItemId(item.id);
                    window.history.replaceState(
                      null,
                      "",
                      `?slide=${encodeURIComponent(item.id)}`,
                    );
                  }}
                  className={`min-w-64 rounded-xl border p-3 text-left transition lg:min-w-0 lg:w-full ${
                    active
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span className="font-bold">{item.title}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {item.description}
                  </div>
                  <div
                    className={`mt-2 text-xs font-bold ${
                      item.status === "configured"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {item.status === "configured"
                      ? "Konfiguriert"
                      : "Hinweis: Standardwerte aktiv"}
                  </div>
                </button>
              );
            })}
          </nav>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            {items.map((item) => (
              <div
                key={item.id}
                hidden={item.id !== activeItemId}
                aria-hidden={item.id !== activeItemId}
              >
                <div className="mb-5">
                  <h2 className="text-2xl font-black">{item.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.description}
                  </p>
                </div>
                {item.panel}
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Wird gespeichert …" : "Slide speichern"}
    </button>
  );
}

export function FixedSlideForm({
  action,
  previewHref,
  children,
}: {
  action: (
    state: FixedSlideActionState,
    formData: FormData,
  ) => Promise<FixedSlideActionState>;
  previewHref: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(
    action,
    INITIAL_FIXED_SLIDE_ACTION_STATE,
  );
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
      className="space-y-5"
    >
      {children}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
        <SaveButton />
        <a
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Gespeicherten Stand ansehen
        </a>
        {dirty && (
          <span className="text-sm font-semibold text-amber-700">
            Ungespeicherte Änderungen
          </span>
        )}
      </div>

      <div aria-live="polite">
        {state.status !== "idle" && (
          <p
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function FixedSlideField({
  label,
  children,
  helpText,
}: {
  label: string;
  children: ReactNode;
  helpText?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      {children}
      {helpText && <span className="text-xs text-slate-500">{helpText}</span>}
    </label>
  );
}

export function FixedSlideEnabledField({ defaultEnabled }: { defaultEnabled: boolean }) {
  return (
    <Checkbox
      name="enabled"
      defaultChecked={defaultEnabled}
      variant="card"
      label="Slide in der Präsentation anzeigen"
      hint="Die Konfiguration bleibt beim Ausblenden vollständig erhalten."
    />
  );
}

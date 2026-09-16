"use client";

import type { QuestionSponsor } from "@/app/rendering/presentation/questionSponsor";

export function QuestionSponsorSection({ value, disabled, onChange }: {
  value?: QuestionSponsor;
  disabled: boolean;
  onChange: (value: QuestionSponsor | undefined) => void;
}) {
  return <details className="rounded-xl border border-slate-200 bg-white p-4" open={value ? true : undefined}>
    <summary className="cursor-pointer font-medium">Präsentation / Sponsor (optional)</summary>
    <fieldset disabled={disabled} className="mt-4 grid gap-3">
      <label className="grid gap-1">Sponsorlogo · Bildadresse
        <input className="rounded border p-2" value={value?.logo ?? ""} placeholder="/branding/sponsors/partner.png" maxLength={2048}
          onChange={event => onChange(event.target.value ? { logo: event.target.value as QuestionSponsor["logo"], line: value?.line ?? "Präsentiert von" } : undefined)} />
      </label>
      <p className="text-sm text-slate-600">Repository-Bild oder vorhandene verwaltete Medienadresse. Anzeige auf LOVD-Fragefolien; Logo unverzerrt mit Freiraum.</p>
      <label className="grid gap-1">Sponsorzeile
        <input className="rounded border p-2" value={value?.line ?? "Präsentiert von"} maxLength={80} disabled={!value || disabled}
          onChange={event => value && onChange({ ...value, line: event.target.value })} />
      </label>
      <p className="text-sm text-slate-600">Eine optionale Vorfolie lässt sich als bestehendes Story-Element mit Text und Logo unmittelbar vor der Frage im Quizablauf platzieren. Sie startet keine Frage.</p>
    </fieldset>
  </details>;
}

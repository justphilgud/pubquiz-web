"use client";

import type { QuestionSponsor } from "@/app/rendering/presentation/questionSponsor";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { MediaUploadSlot, type MediaUploadStatus } from "./MediaUploadSlot";

export function QuestionSponsorSection({ value, disabled, onChange, questionId, templateId, environmentPrefix, onUploadStatusChange }: {
  value?: QuestionSponsor;
  disabled: boolean;
  onChange: (value: QuestionSponsor | undefined) => void;
  questionId: number | null;
  templateId: string | null;
  environmentPrefix: BlobEnvironmentPrefix;
  onUploadStatusChange: (status: MediaUploadStatus) => void;
}) {
  return <section className="rounded-xl border border-slate-200 p-4" aria-label="Sponsor">
    <h3 className="font-semibold">Sponsor (optional)</h3>
    <p className="mt-1 text-sm text-slate-600">Mit Logo erscheint in LOVD vor dieser Frage ein Sponsor-Moment. Die Moderation startet die Frage mit Weiter.</p>
    <MediaUploadSlot
      media={value ? { slotKey: "sponsor_logo", existingMediaId: null, url: value.logo, mediaType: "IMAGE", operation: "UNCHANGED", existingMediaCount: 1 } : null}
      mediaType="IMAGE" slotKey="sponsor_logo"
      uploadTarget={{ target: "QUESTION", questionId, templateId }}
      environmentPrefix={environmentPrefix} label="Sponsorlogo" previewAlt="Sponsorlogo-Vorschau"
      compact disabled={disabled}
      onUploadStatusChange={onUploadStatusChange}
      onChange={(media) => onChange(media?.url && media.operation !== "REMOVE" ? { logo: media.url as QuestionSponsor["logo"], line: value?.line ?? "Präsentiert von" } : undefined)}
    />
    <label className="mt-4 grid gap-1">Sponsorzeile
      <input className="rounded border p-2" value={value?.line ?? "Präsentiert von"} maxLength={80} disabled={!value || disabled}
        onChange={event => value && onChange({ ...value, line: event.target.value })} />
    </label>
  </section>;
}

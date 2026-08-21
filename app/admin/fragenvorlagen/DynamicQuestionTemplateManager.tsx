"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { reviewDynamicQuestionTemplate } from "@/app/fragen/editor/templates/dynamicQuestionTemplateActions";

export type DynamicQuestionTemplateAdminRow = {
  id: number;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PENDING" | "REJECTED" | "ARCHIVED";
  baseCode: string;
  sourceQuestionId: number | null;
  createdBy: string;
  createdAt: string;
  questionTextRole: string;
  mediaRules: string[];
  answerRules: string[];
  feedback: string | null;
};

const statusLabels: Record<DynamicQuestionTemplateAdminRow["status"], string> = {
  ACTIVE: "Aktiv",
  PENDING: "Zu prüfen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

export function DynamicQuestionTemplateManager({
  templates,
}: {
  templates: DynamicQuestionTemplateAdminRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"ALL" | DynamicQuestionTemplateAdminRow["status"]>("ALL");
  const [feedbackByTemplate, setFeedbackByTemplate] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(
    () => templates.filter((template) => status === "ALL" || template.status === status),
    [status, templates],
  );

  function review(id: number, decision: "APPROVE" | "REJECT") {
    const feedback = feedbackByTemplate[id] ?? "";
    setMessage(null);
    startTransition(async () => {
      const result = await reviewDynamicQuestionTemplate({
        templateId: id,
        decision,
        feedback,
      });
      setMessage({ tone: result.ok ? "success" : "error", text: result.message });
      if (result.ok) {
        setFeedbackByTemplate((current) => ({ ...current, [id]: "" }));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block max-w-xs text-sm font-medium text-slate-800">
          Status
          <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1 min-h-11 w-full">
            <option value="ALL">Alle</option>
            <option value="PENDING">Zu prüfen</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="REJECTED">Abgelehnt</option>
            <option value="ARCHIVED">Archiviert</option>
          </Select>
        </label>
      </section>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800" : "rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"}>
          {message.text}
        </p>
      )}
      <div className="grid gap-4">
        {filtered.map((template) => (
          <article key={template.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">{template.name}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{statusLabels[template.status]}</span>
                  </div>
                  {template.description && <p className="mt-1 text-sm text-slate-600">{template.description}</p>}
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div><dt className="inline font-medium">Basis: </dt><dd className="inline">{template.baseCode}</dd></div>
                  <div><dt className="inline font-medium">Erstellt von: </dt><dd className="inline">{template.createdBy}</dd></div>
                  <div><dt className="inline font-medium">Erstellt: </dt><dd className="inline">{template.createdAt}</dd></div>
                  <div><dt className="inline font-medium">Ausgangsfrage: </dt><dd className="inline">{template.sourceQuestionId ?? "nicht mehr vorhanden"}</dd></div>
                </dl>
                <details className="rounded-xl bg-slate-50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-slate-900">Konfiguration prüfen</summary>
                  <div className="mt-3 space-y-2 text-slate-700">
                    <p><strong>Fragentext:</strong> {template.questionTextRole}</p>
                    <p><strong>Medien:</strong> {template.mediaRules.join(", ") || "keine"}</p>
                    <p><strong>Antworten:</strong> {template.answerRules.join(", ") || "keine"}</p>
                  </div>
                </details>
                {template.feedback && <p className="text-sm text-slate-700"><strong>Rückmeldung:</strong> {template.feedback}</p>}
              </div>
              {template.status === "PENDING" && (
                <div className="w-full shrink-0 space-y-2 lg:max-w-sm">
                  <label className="block text-sm font-medium text-slate-800">
                    Rückmeldung (optional)
                    <Textarea
                      value={feedbackByTemplate[template.id] ?? ""}
                      onChange={(event) => setFeedbackByTemplate((current) => ({
                        ...current,
                        [template.id]: event.target.value,
                      }))}
                      maxLength={500}
                      rows={3}
                      disabled={pending}
                      className="mt-1 resize-y"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={pending} onClick={() => review(template.id, "APPROVE")} className="min-h-11 bg-emerald-700 hover:bg-emerald-800">Freigeben</Button>
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => review(template.id, "REJECT")} className="min-h-11 border-red-300 text-red-700 hover:bg-red-50">Ablehnen</Button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
        {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600">Keine passenden Spezialfragenvorlagen.</p>}
      </div>
    </div>
  );
}

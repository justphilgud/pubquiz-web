"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { QuestionEditorDraft } from "../types";
import {
  createDefaultDynamicTemplateRuleSelection,
  dynamicQuestionTemplateRoles,
  getDynamicTemplateAnswerSourceKey,
  resolveDynamicTemplateAnswerRule,
  resolveDynamicTemplateMediaRule,
  type DynamicQuestionTemplateRole,
  type DynamicQuestionTemplateRuleSelection,
} from "../templates/dynamicQuestionTemplate";
import { createDynamicQuestionTemplate } from "../templates/dynamicQuestionTemplateActions";

const roleLabels: Record<DynamicQuestionTemplateRole, string> = {
  FIXED: "Fest übernehmen",
  REQUIRED_NEW: "Erforderlich neu befüllen",
  EXCLUDED: "Nicht Bestandteil",
};

function RoleSelect({
  value,
  onChange,
}: {
  value: DynamicQuestionTemplateRole;
  onChange: (value: DynamicQuestionTemplateRole) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(
        event.target.value as DynamicQuestionTemplateRole,
      )}
      className="mt-1 min-h-11"
    >
      {dynamicQuestionTemplateRoles.map((role) => (
        <option key={role} value={role}>{roleLabels[role]}</option>
      ))}
    </Select>
  );
}

export function CreateDynamicQuestionTemplate({
  questionId,
  draft,
  isAdmin,
  disabled,
}: {
  questionId: number | null;
  draft: QuestionEditorDraft;
  isAdmin: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<DynamicQuestionTemplateRuleSelection>(
    () => createDefaultDynamicTemplateRuleSelection(draft),
  );
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function startCreation() {
    setRules(createDefaultDynamicTemplateRuleSelection(draft));
    setMessage(null);
    setOpen(true);
  }

  function updateMediaRole(sourceMediaId: number, role: DynamicQuestionTemplateRole) {
    setRules((current) => ({
      ...current,
      media: current.media.map((rule) =>
        rule.sourceMediaId === sourceMediaId ? { ...rule, role } : rule),
    }));
  }

  function updateAnswerRole(sourceKey: string, role: DynamicQuestionTemplateRole) {
    setRules((current) => ({
      ...current,
      answers: current.answers.map((rule) =>
        rule.sourceKey === sourceKey ? { ...rule, role } : rule),
    }));
  }

  function submit() {
    if (!questionId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await createDynamicQuestionTemplate({
        questionId,
        name,
        description,
        rules,
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setMessage({
        tone: "success",
        text: result.status === "ACTIVE"
          ? `„${result.name}“ ist jetzt im Vorlagen-Dropdown verfügbar.`
          : `„${result.name}“ wurde der Administration zur Freigabe vorgeschlagen.`,
      });
      setName("");
      setDescription("");
      router.refresh();
    });
  }

  const persistedMedia = draft.questionMedia.filter(
    (medium) => medium.existingMediaId !== null,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-slate-950">Wiederkehrendes Format?</p>
          <p className="mt-1 text-sm text-slate-600">
            Speichere die bestehende Frage als generische Spezialfragenvorlage.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || questionId === null}
          onClick={startCreation}
          className="min-h-11 shrink-0"
        >
          Als Spezialfragenvorlage speichern
        </Button>
      </div>
      {questionId === null && (
        <p className="mt-2 text-xs text-amber-700">
          Speichere die Frage zuerst als Entwurf.
        </p>
      )}

      <Modal
        open={open}
        title={isAdmin ? "Spezialfragenvorlage erstellen" : "Spezialfragenvorlage vorschlagen"}
        onClose={() => !pending && setOpen(false)}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={pending || name.trim().length < 3} onClick={submit}>
              {pending ? "Wird gespeichert …" : isAdmin ? "Erstellen und freigeben" : "Vorschlag senden"}
            </Button>
          </div>
        )}
      >
        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          <label className="block text-sm font-medium text-slate-900">
            Name
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11" />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Beschreibung (optional)
            <Textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-24" />
          </label>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-950">Bestandteile</h3>
            <label className="block rounded-xl border border-slate-200 p-3 text-sm">
              <span className="font-medium">Fragentext</span>
              <span className="mt-1 block line-clamp-2 text-slate-600">{draft.questionText || "Noch leer"}</span>
              <RoleSelect value={rules.questionText} onChange={(questionText) => setRules((current) => ({ ...current, questionText }))} />
            </label>

            {persistedMedia.map((medium) => {
              const rule = resolveDynamicTemplateMediaRule(rules, medium)!;
              return (
                <label key={medium.existingMediaId} className="block rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="font-medium">{medium.mediaType === "IMAGE" ? "Bild" : medium.mediaType === "AUDIO" ? "Audio" : "Video"}</span>
                  <span className="mt-1 block truncate text-slate-600">{medium.fileName ?? medium.url}</span>
                  <RoleSelect value={rule.role} onChange={(role) => updateMediaRole(rule.sourceMediaId, role)} />
                </label>
              );
            })}

            {draft.answers.map((answer, index) => {
              const sourceKey = getDynamicTemplateAnswerSourceKey(answer);
              const rule = resolveDynamicTemplateAnswerRule(rules, answer);
              return (
                <label key={answer.id} className="block rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="font-medium">{answer.fieldLabel || `Antwort ${index + 1}`}{answer.isCorrect ? " · richtig" : ""}</span>
                  <span className="mt-1 block truncate text-slate-600">{answer.text || "Noch leer"}</span>
                  <RoleSelect value={rule.role} onChange={(role) => updateAnswerRole(sourceKey, role)} />
                </label>
              );
            })}
          </div>
          <p className="rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-700">
            Antworttyp und strukturelle Konfiguration werden übernommen. Punkte bleiben Teil des jeweiligen Quiz und werden nicht in der Vorlage gespeichert.
          </p>
          {message && (
            <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm font-medium text-red-700" : "text-sm font-medium text-emerald-700"}>
              {message.text}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}

"use client";

import { useState } from "react";
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

export type DynamicQuestionTemplateSaveOption = {
  requestId: string;
  name: string;
  description: string;
  rules: DynamicQuestionTemplateRuleSelection;
};

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
  draft,
  isAdmin,
  disabled,
  value,
  onChange,
}: {
  draft: QuestionEditorDraft;
  isAdmin: boolean;
  disabled: boolean;
  value: DynamicQuestionTemplateSaveOption | null;
  onChange: (value: DynamicQuestionTemplateSaveOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<DynamicQuestionTemplateRuleSelection>(
    () => createDefaultDynamicTemplateRuleSelection(draft),
  );

  function openConfiguration() {
    setName(value?.name ?? "");
    setDescription(value?.description ?? "");
    setRules(
      value?.rules ?? createDefaultDynamicTemplateRuleSelection(draft),
    );
    setOpen(true);
  }

  function updateMediaRole(slotKey: string, role: DynamicQuestionTemplateRole) {
    setRules((current) => ({
      ...current,
      media: current.media.map((rule) =>
        rule.slotKey === slotKey ? { ...rule, role } : rule),
    }));
  }

  function updateAnswerRole(sourceKey: string, role: DynamicQuestionTemplateRole) {
    setRules((current) => ({
      ...current,
      answers: current.answers.map((rule) =>
        rule.sourceKey === sourceKey ? { ...rule, role } : rule),
    }));
  }

  function applyConfiguration() {
    if (name.trim().length < 3) return;
    onChange({
      requestId: value?.requestId ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      rules,
    });
    setOpen(false);
  }

  const availableMedia = draft.questionMedia.filter(
    (medium) => medium.operation !== "REMOVE" && Boolean(medium.url),
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 cursor-pointer items-start gap-3 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.checked) openConfiguration();
            else onChange(null);
          }}
          className="mt-0.5 size-4 shrink-0 accent-slate-950"
        />
        <span>
          <span className="font-semibold">Zusätzlich als Spezialfragenvorlage speichern</span>
          <span className="mt-0.5 block text-xs text-slate-600">
            {value
              ? `Konfiguriert als „${value.name}“`
              : isAdmin
                ? "Wird nach der Frage erstellt und direkt freigegeben."
                : "Wird nach der Frage als Freigabevorschlag erstellt."}
          </span>
        </span>
      </label>
      {value && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={openConfiguration}
          className="min-h-9 shrink-0 self-end px-3 text-sm sm:self-auto"
        >
          Konfigurieren
        </Button>
      )}

      <Modal
        open={open}
        title={isAdmin ? "Spezialfragenvorlage erstellen" : "Spezialfragenvorlage vorschlagen"}
        onClose={() => setOpen(false)}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={name.trim().length < 3} onClick={applyConfiguration}>
              Übernehmen
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

            {availableMedia.map((medium) => {
              const rule = resolveDynamicTemplateMediaRule(rules, medium)!;
              return (
                <label key={medium.slotKey} className="block rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="font-medium">{medium.mediaType === "IMAGE" ? "Bild" : medium.mediaType === "AUDIO" ? "Audio" : "Video"}</span>
                  <span className="mt-1 block truncate text-slate-600">{medium.fileName ?? medium.url}</span>
                  <RoleSelect value={rule.role} onChange={(role) => updateMediaRole(rule.slotKey, role)} />
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
        </div>
      </Modal>
    </div>
  );
}

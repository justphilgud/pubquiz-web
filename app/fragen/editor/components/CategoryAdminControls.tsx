import { useState } from "react";
import type { QuestionCategory } from "../types";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  type CategoryActionErrorCode,
} from "../categoryActions";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

function useCategoryActionError() {
  const { messages } = useQuestionEditorMessages();
  return (code: CategoryActionErrorCode) => messages.categories.errors[code];
}

export function CategoryCreateControl({ onCreated }: { onCreated: (category: QuestionCategory) => void }) {
  const { messages } = useQuestionEditorMessages();
  const getError = useCategoryActionError();
  const [name, setName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setIsPending(true);
    setError(null);
    const result = await createCategory(name);
    setIsPending(false);
    if (!result.ok) {
      setError(getError(result.code));
      return;
    }
    setName("");
    onCreated(result.category);
  }

  return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <label className="block text-sm font-medium text-slate-900">
      {messages.categories.createLabel}
      <input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={messages.categories.createPlaceholder} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
    </label>
    <button type="button" onClick={() => void handleCreate()} disabled={isPending || !name.trim()} className="mt-2 min-h-11 w-full rounded-xl border border-slate-950 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto">
      {isPending ? messages.categories.creating : messages.categories.create}
    </button>
    {error && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p>}
  </div>;
}

export function CategoryRowActions({ category, onRenamed, onDeleted }: { category: QuestionCategory; onRenamed: (category: QuestionCategory) => void; onDeleted: (categoryId: number) => void }) {
  const { messages } = useQuestionEditorMessages();
  const getError = useCategoryActionError();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename() {
    const name = window.prompt(messages.categories.renamePrompt, category.name);
    if (name === null || name.trim() === category.name) return;
    setIsPending(true);
    setError(null);
    const result = await renameCategory(category.id, name);
    setIsPending(false);
    if (result.ok) onRenamed(result.category);
    else setError(getError(result.code));
  }

  async function handleDelete() {
    if (!window.confirm(messages.categories.deleteConfirm)) return;
    setIsPending(true);
    setError(null);
    const result = await deleteCategory(category.id);
    setIsPending(false);
    if (result.ok) onDeleted(result.categoryId);
    else setError(getError(result.code));
  }

  return <div className="shrink-0">
    <div className="flex gap-1">
      <button type="button" onClick={() => void handleRename()} disabled={isPending} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 disabled:opacity-60">{messages.categories.rename}</button>
      <button type="button" onClick={() => void handleDelete()} disabled={isPending} className="min-h-11 rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-60">{messages.categories.delete}</button>
    </div>
    {error && <p role="alert" className="mt-1 max-w-52 text-xs font-medium text-red-700">{error}</p>}
  </div>;
}

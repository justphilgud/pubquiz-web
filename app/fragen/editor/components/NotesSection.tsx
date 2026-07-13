import { CharacterCount } from "./CharacterCount";

type NotesSectionProps = {
  sourceOrRemark: string;
  moderationNotes: string;
  onSourceOrRemarkChange: (sourceOrRemark: string) => void;
  onModerationNotesChange: (moderationNotes: string) => void;
};

export function NotesSection({
  sourceOrRemark,
  moderationNotes,
  onSourceOrRemarkChange,
  onModerationNotesChange,
}: NotesSectionProps) {
  return (
    <>
      <h2 className="font-semibold text-slate-950">Interne Angaben</h2>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Quelle oder Bemerkung</span>
          <textarea
            value={sourceOrRemark}
            maxLength={1000}
            onChange={(event) => onSourceOrRemarkChange(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          />

          <CharacterCount current={sourceOrRemark.length} maximum={1000} />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Moderationsnotizen</span>
          <textarea
            value={moderationNotes}
            maxLength={1000}
            onChange={(event) => onModerationNotesChange(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          />

          <CharacterCount current={moderationNotes.length} maximum={1000} />
        </label>
      </div>
    </>
  );
}

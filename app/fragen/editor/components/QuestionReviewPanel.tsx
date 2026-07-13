import { Alert } from "@/components/ui/Alert";
import { QuestionStatusBadge } from "../../components/QuestionStatusBadge";
import type { QuestionQualityResult } from "../questionQuality";
import type {
  QuestionEditorContext,
  QuestionEditorRecord,
} from "../types";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "–";
}

export function QuestionReviewPanel({
  record,
  editorContext,
  quality,
}: {
  record: QuestionEditorRecord;
  editorContext: QuestionEditorContext;
  quality: QuestionQualityResult;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Frage #{record.questionId}</p>
            <p className="mt-1 text-sm text-slate-700">
              Erstellt von {record.creatorName} am {formatDate(record.createdAt)}
              {` · zuletzt geändert ${formatDate(record.updatedAt)}`}
              {record.lastModifiedByName
                ? ` von ${record.lastModifiedByName}`
                : ""}
            </p>
          </div>
          <QuestionStatusBadge status={record.reviewStatus} />
        </div>

        {(record.submittedAt || record.reviewedAt || record.templateName) && (
          <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {record.submittedAt && (
              <div>
                <dt className="font-medium text-slate-800">Eingereicht</dt>
                <dd>
                  {formatDate(record.submittedAt)}
                  {record.submittedByName ? ` von ${record.submittedByName}` : ""}
                </dd>
              </div>
            )}
            {record.reviewedAt && (
              <div>
                <dt className="font-medium text-slate-800">Zuletzt geprüft</dt>
                <dd>
                  {formatDate(record.reviewedAt)}
                  {record.reviewedByName ? ` von ${record.reviewedByName}` : ""}
                </dd>
              </div>
            )}
            {record.approvedAt && (
              <div>
                <dt className="font-medium text-slate-800">Freigegeben</dt>
                <dd>
                  {formatDate(record.approvedAt)}
                  {record.approvedByName ? ` von ${record.approvedByName}` : ""}
                </dd>
              </div>
            )}
            {record.templateName && (
              <div>
                <dt className="font-medium text-slate-800">Vorlage</dt>
                <dd>{record.templateName}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {record.reviewFeedback && (
        <Alert variant="warning" title="Rückgabehinweis">
          {record.reviewFeedback}
        </Alert>
      )}

      {editorContext === "readOnly" && (
        <Alert variant="info" title="Frage ist in Prüfung">
          Die Inhalte können während der Prüfung nur angesehen werden.
        </Alert>
      )}

      {editorContext === "review" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Qualitätsprüfung</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                Blockierende Kriterien
              </h3>
              {quality.blockers.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
                  {quality.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-700">
                  Keine Blocker erkannt.
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Warnungen</h3>
              {quality.warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {quality.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-700">
                  Keine Qualitätswarnungen.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

import { Alert } from "@/components/ui/Alert";
import { QuestionStatusBadge } from "../../components/QuestionStatusBadge";
import type { QuestionQualityResult } from "../questionQuality";
import type {
  QuestionEditorContext,
  QuestionEditorRecord,
} from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatEditorDateTime } from "@/app/i18n/formatting";
import { formatMessage } from "@/app/i18n/formatMessage";
import { formatQuestionQualityIssue } from "../questionEditorLocalization";

export function QuestionReviewPanel({
  record,
  editorContext,
  quality,
}: {
  record: QuestionEditorRecord;
  editorContext: QuestionEditorContext;
  quality: QuestionQualityResult;
}) {
  const { locale, messages } = useQuestionEditorMessages();
  const formatDate = (value: string | null) =>
    value ? formatEditorDateTime(locale, value) : messages.common.unknownDate;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{formatMessage(messages.review.questionNumber, { id: record.questionId })}</p>
            <p className="mt-1 text-sm text-slate-700">
              {formatMessage(messages.review.created, { name: record.creatorName || messages.common.unknownUser, date: formatDate(record.createdAt) })}
              {` · ${formatMessage(messages.review.modified, { date: formatDate(record.updatedAt) })}`}
              {record.lastModifiedByName
                ? ` ${formatMessage(messages.review.by, { name: record.lastModifiedByName })}`
                : ""}
            </p>
          </div>
          <QuestionStatusBadge
            status={record.reviewStatus}
            labels={messages.review.statuses}
          />
        </div>

        {(record.submittedAt || record.reviewedAt || record.templateName) && (
          <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {record.submittedAt && (
              <div>
                <dt className="font-medium text-slate-800">{messages.review.submitted}</dt>
                <dd>
                  {formatDate(record.submittedAt)}
                  {record.submittedByName ? ` ${formatMessage(messages.review.by, { name: record.submittedByName })}` : ""}
                </dd>
              </div>
            )}
            {record.reviewedAt && (
              <div>
                <dt className="font-medium text-slate-800">{messages.review.reviewed}</dt>
                <dd>
                  {formatDate(record.reviewedAt)}
                  {record.reviewedByName ? ` ${formatMessage(messages.review.by, { name: record.reviewedByName })}` : ""}
                </dd>
              </div>
            )}
            {record.approvedAt && (
              <div>
                <dt className="font-medium text-slate-800">{messages.review.approved}</dt>
                <dd>
                  {formatDate(record.approvedAt)}
                  {record.approvedByName ? ` ${formatMessage(messages.review.by, { name: record.approvedByName })}` : ""}
                </dd>
              </div>
            )}
            {record.templateName && (
              <div>
                <dt className="font-medium text-slate-800">{messages.review.template}</dt>
                <dd>{record.templateName}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {record.reviewFeedback && (
        <Alert variant="warning" title={messages.review.feedback}>
          {record.reviewFeedback}
        </Alert>
      )}

      {editorContext === "readOnly" && (
        <Alert variant="info" title={messages.review.inReview}>
          {messages.review.inReviewHelp}
        </Alert>
      )}

      {editorContext === "review" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">{messages.review.quality}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                {messages.review.blockers}
              </h3>
              {quality.blockers.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
                  {quality.blockers.map((blocker) => (
                    <li key={`${blocker.code}-${JSON.stringify(blocker.params)}`}>{formatQuestionQualityIssue(blocker, messages)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-700">
                  {messages.review.noBlockers}
                </p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-800">{messages.review.warnings}</h3>
              {quality.warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {quality.warnings.map((warning) => (
                    <li key={`${warning.code}-${JSON.stringify(warning.params)}`}>{formatQuestionQualityIssue(warning, messages)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-700">
                  {messages.review.noWarnings}
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { QuestionStatusBadge } from "@/app/fragen/components/QuestionStatusBadge";
import type { DashboardQuestionItem, DashboardQuizItem } from "@/app/dashboardData";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

function relativeTimestamp(timestamp: Date) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - timestamp.getTime()) / 60_000),
  );

  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;

  const days = Math.round(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;

  return dateTimeFormatter.format(timestamp);
}

function relativeQuizDate(daysUntil: number) {
  if (daysUntil === 0) return "heute";
  if (daysUntil === 1) return "morgen";
  return `in ${daysUntil} Tagen`;
}

function CompactEmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
      {children}
    </p>
  );
}

function questionActionLabel(status: DashboardQuestionItem["status"]) {
  if (status === "CHANGES_REQUESTED") return "Überarbeiten";
  if (status === "DRAFT") return "Bearbeiten";
  if (status === "IN_REVIEW") return "Prüfen";
  return "Ansehen";
}

export function QuestionTaskList({ entries, emptyTitle, showQualityWarnings = false }: {
  entries: DashboardQuestionItem[];
  emptyTitle: string;
  showQualityWarnings?: boolean;
}) {
  if (entries.length === 0) {
    return <CompactEmptyState>{emptyTitle}</CompactEmptyState>;
  }

  return (
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      {entries.map((entry) => (
        <article key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <QuestionStatusBadge status={entry.status} />
              {showQualityWarnings && entry.missingSource && <Badge variant="warning">Quelle fehlt</Badge>}
              {showQualityWarnings && entry.missingCategory && <Badge variant="warning">Keine Kategorie</Badge>}
            </div>
            <h3 className="mt-2 line-clamp-2 font-medium leading-6 text-slate-900">{entry.text.trim() || "Fragetext fehlt"}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {entry.creatorName ? `${entry.creatorName} · ` : ""}
              {entry.timestamp
                ? relativeTimestamp(entry.timestamp)
                : "Zeitpunkt nicht verfügbar"}
            </p>
            {entry.status === "CHANGES_REQUESTED" && entry.reviewFeedback && (
              <p className="mt-2 line-clamp-2 text-sm text-amber-800">{entry.reviewFeedback}</p>
            )}
          </div>
          <Link href={`/fragen/editor/${entry.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            {questionActionLabel(entry.status)}
          </Link>
        </article>
      ))}
    </div>
  );
}

export function QuizList({ entries }: { entries: DashboardQuizItem[] }) {
  if (entries.length === 0) {
    return (
      <CompactEmptyState>
        Aktuell ist kein zukünftiges Quiz eingetragen.
      </CompactEmptyState>
    );
  }

  return (
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      {entries.map((quiz) => (
        <Link key={quiz.id} href={`/quiz/${quiz.id}`} className="flex min-h-16 items-center justify-between gap-4 p-4 transition hover:bg-slate-50">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-slate-900">{quiz.title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {dateFormatter.format(quiz.date)} · {relativeQuizDate(quiz.daysUntil)}
              {" · "}{quiz.questionCount} Fragen · {quiz.teamCount} Teams
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-slate-700">Öffnen</span>
        </Link>
      ))}
    </div>
  );
}

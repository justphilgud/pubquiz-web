import type { QuestionReviewStatus } from "@/app/generated/prisma/enums";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionStatusBadge } from "./QuestionStatusBadge";

export type QuestionWorklistEntry = {
  id: number;
  text: string;
  status: QuestionReviewStatus;
  categories: string[];
  timestamp: Date | null;
  reviewFeedback: string | null;
};

type QuestionWorklistProps = {
  title: string;
  description: string;
  emptyTitle: string;
  entries: QuestionWorklistEntry[];
  timestampLabel: string;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function truncateQuestion(text: string) {
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

export function QuestionWorklist({
  title,
  description,
  emptyTitle,
  entries,
  timestampLabel,
}: QuestionWorklistProps) {
  return (
    <section aria-labelledby={`${title.replaceAll(" ", "-")}-heading`}>
      <div className="mb-3">
        <h2
          id={`${title.replaceAll(" ", "-")}-heading`}
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <QuestionStatusBadge status={entry.status} />
                    <span className="text-xs text-slate-500">
                      {timestampLabel}: {entry.timestamp ? dateFormatter.format(entry.timestamp) : "–"}
                    </span>
                  </div>
                  <h3 className="font-semibold leading-snug text-slate-900">
                    {truncateQuestion(entry.text) || "Fragetext fehlt"}
                  </h3>
                  {entry.reviewFeedback && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {entry.reviewFeedback}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/fragen/editor/${entry.id}`}
                  className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700"
                >
                  {entry.status === "DRAFT"
                    ? "Bearbeiten"
                    : entry.status === "CHANGES_REQUESTED"
                      ? "Überarbeiten"
                      : "Ansehen"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

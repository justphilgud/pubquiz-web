import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ReactNode } from "react";
import Link from "next/link";
import type { ReviewQueueEntry } from "../questionWorklists";
import { QuestionStatusBadge } from "./QuestionStatusBadge";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function QualityWarningBadge({ children }: { children: ReactNode }) {
  return <Badge variant="warning">{children}</Badge>;
}

export function ReviewQueue({ entries }: { entries: ReviewQueueEntry[] }) {
  return (
    <section aria-labelledby="review-queue-heading">
      <div className="mb-3">
        <h2 id="review-queue-heading" className="text-xl font-semibold text-slate-900">
          Zur Freigabe
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Eingereichte Fragen, die auf eine fachliche Prüfung warten.
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Aktuell wartet keine Frage auf Prüfung." />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <QuestionStatusBadge status="IN_REVIEW" />
                    {!entry.source && <QualityWarningBadge>Quelle fehlt</QualityWarningBadge>}
                    {entry.categories.length === 0 && (
                      <QualityWarningBadge>Keine Kategorie</QualityWarningBadge>
                    )}
                  </div>
                  <h3 className="font-semibold leading-snug text-slate-900">
                    {entry.text.length > 180 ? `${entry.text.slice(0, 177)}…` : entry.text}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Erstellt von {entry.creatorName}
                    {entry.submittedAt
                      ? ` · Eingereicht am ${dateFormatter.format(entry.submittedAt)}`
                      : " · Einreichungszeitpunkt fehlt"}
                  </p>
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
                  Prüfen
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

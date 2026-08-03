function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" | "orange" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    blue: "bg-cyan-100 text-cyan-800",
    orange: "bg-amber-100 text-amber-800",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status, archived }: { status: string; archived: boolean }) {
  return <Badge tone={archived ? "slate" : status === "Freigegeben" || status === "Aktiv" ? "green" : "blue"}>{status}</Badge>;
}

export function ScopeBadge({ scope }: { scope: string }) {
  return <Badge>{scope}</Badge>;
}

export function MediaBadge({ count }: { count: number }) {
  return <Badge tone={count > 0 ? "green" : "orange"}>{count > 0 ? `${count} Medien` : "Keine Medien"}</Badge>;
}

export function UsageSummary({ quizCount, linkedQuestionCount }: { quizCount: number; linkedQuestionCount?: number }) {
  const unused = quizCount === 0 && (linkedQuestionCount ?? 0) === 0;
  return <Badge tone={unused ? "blue" : "slate"}>{unused ? "Noch nie verwendet" : `${quizCount} Quiz${linkedQuestionCount === undefined ? "" : ` · ${linkedQuestionCount} Fragen`}`}</Badge>;
}

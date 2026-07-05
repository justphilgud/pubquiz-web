import { ReactNode } from "react";
import { Badge } from "./Badge";

export function QuestionCard({
  title,
  category,
  children,
  status = "Entwurf",
}: {
  title: string;
  category?: string;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {category && <div className="mb-1 text-xs uppercase tracking-wide text-gray-400">{category}</div>}
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <Badge>{status}</Badge>
      </div>
      {children && <div className="text-sm text-gray-600">{children}</div>}
    </article>
  );
}

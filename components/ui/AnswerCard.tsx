import { ReactNode } from "react";

export function AnswerCard({
  label,
  correct = false,
  children,
}: {
  label: string;
  correct?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-xl border p-4",
        correct ? "border-green-300 bg-green-50" : "bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-gray-900">{label}</div>
        {correct && <span className="text-xs font-semibold text-green-700">Richtig</span>}
      </div>
      {children && <div className="mt-2 text-sm text-gray-600">{children}</div>}
    </div>
  );
}

import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-8 text-center">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

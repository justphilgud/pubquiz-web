import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}:{
  title:string;
  subtitle?:string;
  actions?:ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

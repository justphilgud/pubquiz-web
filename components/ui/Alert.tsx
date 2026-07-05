import { ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const variants: Record<AlertVariant, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-green-200 bg-green-50 text-green-900",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  danger: "border-red-200 bg-red-50 text-red-900",
};

export function Alert({
  title,
  children,
  variant = "info",
}: {
  title?: string;
  children: ReactNode;
  variant?: AlertVariant;
}) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${variants[variant]}`}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

import { ReactNode } from "react";

export function Inline({
  children,
  gap = "md",
  className = "",
}: {
  children: ReactNode;
  gap?: "sm" | "md" | "lg";
  className?: string;
}) {
  const gaps = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  };

  return <div className={`flex flex-wrap items-center ${gaps[gap]} ${className}`}>{children}</div>;
}

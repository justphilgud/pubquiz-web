import { ReactNode } from "react";

export function Stack({
  children,
  gap = "md",
  className = "",
}: {
  children: ReactNode;
  gap?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const gaps = {
    sm: "space-y-2",
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  };

  return <div className={`${gaps[gap]} ${className}`}>{children}</div>;
}

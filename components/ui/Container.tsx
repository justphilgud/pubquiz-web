import { ReactNode } from "react";

export function Container({
  children,
  size = "lg",
  className = "",
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}) {
  const sizes = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-none",
  };

  return (
    <div className={`mx-auto w-full ${sizes[size]} ${className}`}>
      {children}
    </div>
  );
}

// components/ui/Card.tsx
import { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

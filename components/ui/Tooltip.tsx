import { ReactNode } from "react";

export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
        {content}
      </span>
    </span>
  );
}

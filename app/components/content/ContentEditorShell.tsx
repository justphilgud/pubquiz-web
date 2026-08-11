import type { ReactNode } from "react";
import ContentEditorHeader from "./ContentEditorHeader";

export default function ContentEditorShell({
  title,
  eyebrow,
  description,
  fallbackHref = "/content",
  maxWidth = "max-w-4xl",
  footerSpace = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  fallbackHref?: string;
  maxWidth?: "max-w-4xl" | "max-w-7xl";
  footerSpace?: boolean;
  children: ReactNode;
}) {
  return <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-4 sm:py-5 md:px-8">
    <div className={`mx-auto flex w-full ${maxWidth} flex-col gap-5 ${footerSpace ? "pb-64 sm:pb-28" : "pb-8"}`}>
      <ContentEditorHeader eyebrow={eyebrow} title={title} description={description} fallbackHref={fallbackHref} />
      {children}
    </div>
  </main>;
}

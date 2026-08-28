import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function MarkdownHelp({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  function flushList() {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={`list-${blocks.length}`} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-6 text-slate-700`}>{list.items.map((item, index) => <li key={index}>{inlineMarkdown(item)}</li>)}</Tag>);
    list = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    if (ordered || unordered) {
      const nextOrdered = Boolean(ordered);
      if (list && list.ordered !== nextOrdered) flushList();
      list ??= { ordered: nextOrdered, items: [] };
      list.items.push((ordered ?? unordered)![1]);
      continue;
    }
    flushList();
    if (!line) continue;
    if (line.startsWith("# ")) blocks.push(<h1 key={blocks.length} className="text-3xl font-bold tracking-tight text-slate-950">{inlineMarkdown(line.slice(2))}</h1>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={blocks.length} className="pt-4 text-xl font-semibold text-slate-950">{inlineMarkdown(line.slice(3))}</h2>);
    else if (line.startsWith("> ")) blocks.push(<aside key={blocks.length} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">{inlineMarkdown(line.slice(2))}</aside>);
    else blocks.push(<p key={blocks.length} className="leading-7 text-slate-700">{inlineMarkdown(line)}</p>);
  }
  flushList();
  return <article className="space-y-4">{blocks}</article>;
}

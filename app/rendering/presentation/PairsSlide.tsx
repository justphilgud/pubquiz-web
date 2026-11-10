import { pairColumns, type PairsData } from "@/app/fragen/editor/templates/pairsTemplate";

export function PairsSlide({ question, data, reveal }: { question: string; data: PairsData; reveal: boolean }) {
  const columns = pairColumns(data);
  const longest = Math.max(...data.pairs.flatMap(({ left, right }) => [left.length, right.length]));
  const dense = longest > 75 || data.pairs.length > 7;
  const fontSize = dense ? "clamp(0.875rem, min(2cqw, 3.5cqh), 1.75rem)" : "clamp(1rem, min(2.5cqw, 5cqh), 2.25rem)";
  return <section data-pairs-slide={reveal ? "solution" : "question"} className="flex h-full min-h-0 flex-col gap-3 p-4 text-[var(--quiz-text)] [container-type:size]">
    <h1 className="text-[clamp(1.25rem,min(4cqw,8cqh),3.5rem)] font-bold">{reveal ? "Auflösung" : question}</h1>
    <div style={{ fontSize }} className="grid min-h-0 flex-1 grid-cols-2 gap-x-8 gap-y-1 overflow-y-auto leading-tight">
      {reveal ? data.pairs.map((pair) => <div key={pair.leftId} className="col-span-2 grid grid-cols-2 items-center gap-8 border-b border-current/20">
        <span className="min-w-0 break-words">{pair.left}</span><span className="min-w-0 break-words">{pair.right}</span>
      </div>) : ([columns.left, columns.right]).map((column, index) =>
        <ul key={index} className="grid min-w-0 auto-rows-fr gap-1">
          {column.map(({ id, text }) => <li key={id} className="flex min-w-0 items-center border-b border-current/20"><span className="min-w-0 break-words">{text}</span></li>)}
        </ul>)}
    </div>
  </section>;
}

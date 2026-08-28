import Link from "next/link";

const items = [
  { href: "/content/questions/new", label: "+ Frage" },
  { href: "/content/story-elements/new", label: "+ Story-Element" },
  { href: "/content/polls/new", label: "+ Umfrage" },
] as const;

export default function ContentCreateActions() {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Content erstellen">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

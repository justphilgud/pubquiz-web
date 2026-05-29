"use client";

type SlideLink = {
  href: string;
  label: string;
};

type Props = {
  previous?: SlideLink;
  next?: SlideLink;
};

export function ConfigSlideNavigation({
  previous,
  next,
}: Props) {
  if (!previous && !next) {
    return null;
  }

  return (
    <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div>
        {previous ? (
          <a
            href={previous.href}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700"
          >
            <span>←</span>
            <span>{previous.label}</span>
          </a>
        ) : (
          <div />
        )}
      </div>

      <div>
        {next ? (
          <a
            href={next.href}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700"
          >
            <span>{next.label}</span>
            <span>→</span>
          </a>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
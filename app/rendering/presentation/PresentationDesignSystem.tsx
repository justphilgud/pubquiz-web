/* eslint-disable @next/next/no-img-element -- Template assets have dynamic repository or managed Blob URLs and render inside a fixed presentation canvas. */
import type { ReactNode } from "react";

import type { TemplateAssetReference } from "@/app/rendering/templateRegistry";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import type { StorybookComposition } from "@/app/rendering/presentationTemplates/storybookComposition";
import { getStorybookTitle } from "@/app/rendering/presentationTemplates/storybook";

type HeaderProps = {
  theme: ResolvedQuizTheme;
  slideLabel: string;
  slideNumber: number;
  slideCount: number;
};

function displayIdentity(theme: ResolvedQuizTheme) {
  if (theme.design.stylePreset === "BIRTHDAY" && theme.design.storybook) {
    return getStorybookTitle(theme.design.storybook);
  }
  if (
    theme.design.stylePreset === "BIRTHDAY" &&
    theme.design.occasion.personName
  ) {
    return `${theme.design.occasion.personName}${
      theme.design.occasion.age ? ` · ${theme.design.occasion.age}` : ""
    }`;
  }
  return theme.design.occasion.eventTitle || theme.identity.displayName;
}

function StorybookPeopleMarks({ composition }: { composition: StorybookComposition | null }) {
  if (!composition || composition.people.length === 0) return <span className="presentation-storybook-mark">ER</span>;
  return (
    <div className="presentation-storybook-people-marks" data-storybook-people-mode={composition.peopleMode}>
      {composition.people.slice(0, 3).map((person) => (
        <span key={person.id} title={person.name}>{person.name.slice(0, 1).toUpperCase()}</span>
      ))}
      {composition.people.length > 3 && <span>+{composition.people.length - 3}</span>}
    </div>
  );
}

export function PresentationDesignHeader({
  theme,
  slideLabel,
  slideNumber,
  slideCount,
  storybookComposition = null,
}: HeaderProps & { storybookComposition?: StorybookComposition | null }) {
  if (theme.design.stylePreset === "CORPORATE") {
    return (
      <header className="presentation-chrome presentation-corporate-header mb-4 grid h-24 shrink-0 grid-cols-[auto_1fr_auto] items-stretch bg-white">
        <div className="presentation-corporate-logo grid min-w-28 place-items-center border-r px-5">
          {theme.identity.logoUrl ? (
            <img src={theme.identity.logoUrl} alt="" className="h-14 max-w-32 object-contain" />
          ) : (
            <span className="text-lg font-black">CQ</span>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-8 px-8">
          <div className="min-w-0">
            <div className="presentation-primary-text text-xs font-bold uppercase tracking-[0.16em]">
              {slideLabel}
            </div>
            <div className="presentation-corporate-title mt-1 truncate text-3xl font-extrabold">
              {displayIdentity(theme)}
            </div>
          </div>
          {theme.design.occasion.subtitle && (
            <div className="max-w-sm border-l pl-6 text-right text-sm font-medium opacity-70">
              {theme.design.occasion.subtitle}
            </div>
          )}
        </div>
        <div className="presentation-corporate-progress flex min-w-36 items-center justify-center px-6 text-xl font-semibold tabular-nums">
          {String(slideNumber).padStart(2, "0")}
          <span className="mx-2 opacity-35">/</span>
          {String(slideCount).padStart(2, "0")}
        </div>
      </header>
    );
  }

  if (theme.design.stylePreset === "BIRTHDAY") {
    return (
      <header className="presentation-chrome presentation-birthday-header relative mb-4 flex h-28 shrink-0 items-center justify-between px-10">
        <span className="presentation-album-tape presentation-album-tape-left" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-5">
          <StorybookPeopleMarks composition={storybookComposition} />
          <div className="min-w-0">
            <div className="presentation-primary-text text-xs font-bold uppercase tracking-[0.22em]">
              {slideLabel} · Storybook
            </div>
            <div className="presentation-birthday-title mt-1 truncate text-4xl font-black">
              {displayIdentity(theme)}
            </div>
          </div>
        </div>
        <div className="presentation-birthday-page rounded-full px-5 py-3 text-base font-bold">
          Seite {slideNumber} von {slideCount}
        </div>
      </header>
    );
  }

  return (
    <header className="presentation-chrome presentation-neon-header mb-3 flex h-28 shrink-0 items-center justify-between rounded-3xl border-2 border-[#38E8FF] bg-black/85 px-8 shadow-[0_0_24px_#38E8FF]">
      <div className="flex items-center gap-6">
        {theme.identity.logoUrl && (
          <img src={theme.identity.logoUrl} alt="" className="h-24 w-24 object-contain" />
        )}
        <div className="presentation-divider h-16 w-px bg-[#38E8FF] shadow-[0_0_10px_#38E8FF]" />
        <div>
          <div className="presentation-primary-text text-sm font-black uppercase tracking-[0.35em] text-[#38E8FF]">
            {slideLabel}
          </div>
          <div className="presentation-accent-text text-3xl font-black text-[#FFD83B] drop-shadow-[0_0_8px_#FFD83B]">
            {displayIdentity(theme)}
          </div>
          {theme.design.occasion.subtitle && (
            <div className="presentation-subtitle text-sm font-semibold opacity-75">
              {theme.design.occasion.subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border-2 border-[#FF3BD4] px-6 py-3 text-2xl font-black text-[#FF3BD4] shadow-[0_0_12px_#FF3BD4]">
          {slideNumber}
        </div>
        <div className="text-3xl font-black text-[#38E8FF]">/</div>
        <div className="rounded-2xl border-2 border-[#FFD83B] px-6 py-3 text-2xl font-black text-[#FFD83B] shadow-[0_0_12px_#FFD83B]">
          {slideCount}
        </div>
      </div>
    </header>
  );
}

export function PresentationDesignBackdrop({
  theme,
  images,
  storybookComposition = null,
}: {
  theme: ResolvedQuizTheme;
  images: readonly TemplateAssetReference[];
  storybookComposition?: StorybookComposition | null;
}) {
  if (theme.design.stylePreset === "CORPORATE") {
    return (
      <div className="presentation-decoration presentation-corporate-decoration pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="presentation-corporate-rule" />
        {theme.design.imagery.heroImage && (
          <img src={theme.design.imagery.heroImage} alt="" className="presentation-corporate-brand-image" />
        )}
      </div>
    );
  }

  if (theme.design.stylePreset === "BIRTHDAY") {
    const storyImages = storybookComposition && ["TEXT_ALBUM", "CHAPTER_INTRO"].includes(storybookComposition.variant)
      ? []
      : storybookComposition?.assets ?? images.map((source, index) => ({
      id: `legacy-${index}`,
      source,
      role: "MEMORY" as const,
      personIds: [],
      alt: "",
      caption: null,
      year: null,
      order: index,
        }));
    return (
      <div className="presentation-decoration presentation-birthday-decoration pointer-events-none absolute inset-0" data-storybook-variant={storybookComposition?.variant ?? "TEXT_ALBUM"}>
        <span className="presentation-album-ring presentation-album-ring-one" />
        <span className="presentation-album-ring presentation-album-ring-two" />
        {storyImages.length > 0 && (
          <div className="presentation-storybook-gallery absolute inset-y-32 right-8 z-10 w-56">
            {storyImages.map((asset, index) => (
              <figure key={asset.id} className="presentation-personal-image absolute m-0 bg-white p-2 pb-8" data-storybook-photo={index + 1}>
                <img src={asset.source} alt={asset.alt} className="h-full w-full object-cover" />
                {(asset.year || asset.caption) && <figcaption>{asset.year || asset.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="presentation-decoration presentation-neon-decoration pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="presentation-neon-orbit presentation-neon-orbit-one" />
      <span className="presentation-neon-orbit presentation-neon-orbit-two" />
      {theme.design.imagery.heroImage && (
        <img src={theme.design.imagery.heroImage} alt="" className="presentation-neon-key-visual" />
      )}
    </div>
  );
}

export function PresentationDesignStage({
  theme,
  children,
  storybookComposition = null,
}: {
  theme: ResolvedQuizTheme;
  children: ReactNode;
  storybookComposition?: StorybookComposition | null;
}) {
  const styleClass = {
    NEON: "presentation-neon-stage rounded-[2rem] border-4 border-cyan-300 bg-black/55 p-4 shadow-[0_0_35px_rgba(0,229,255,0.35)]",
    CORPORATE: "presentation-corporate-stage p-6",
    BIRTHDAY: "presentation-birthday-stage p-5",
  }[theme.design.stylePreset];

  return (
    <section
      className={`presentation-stage relative z-20 min-h-0 flex-1 ${styleClass}`}
      data-storybook-variant={theme.design.stylePreset === "BIRTHDAY" ? storybookComposition?.variant ?? "TEXT_ALBUM" : undefined}
      data-storybook-people-mode={theme.design.stylePreset === "BIRTHDAY" ? storybookComposition?.peopleMode ?? "TITLE_ONLY" : undefined}
      data-storybook-material={theme.design.stylePreset === "BIRTHDAY" ? theme.design.storybook?.material : undefined}
    >
      {theme.design.stylePreset === "BIRTHDAY" && storybookComposition?.chapter && (
        <div className="presentation-storybook-chapter"><span>Kapitel</span><strong>{storybookComposition.chapter.title}</strong>{storybookComposition.chapter.subtitle && <small>{storybookComposition.chapter.subtitle}</small>}</div>
      )}
      <div className="presentation-storybook-content h-full min-h-0">{children}</div>
      {theme.design.stylePreset === "BIRTHDAY" && storybookComposition?.anecdote && (
        <aside className="presentation-storybook-anecdote"><span>{storybookComposition.anecdote.year || "Erinnerung"}</span>{storybookComposition.anecdote.text}</aside>
      )}
    </section>
  );
}

export function PresentationDesignFooter({
  theme,
  storybookComposition = null,
}: {
  theme: ResolvedQuizTheme;
  storybookComposition?: StorybookComposition | null;
}) {
  if (theme.design.stylePreset === "CORPORATE") {
    return (
      <footer className="presentation-corporate-footer relative z-20 mt-3 flex h-9 shrink-0 items-center justify-between border-t px-2 text-xs font-semibold uppercase tracking-[0.12em]">
        <span>{theme.design.occasion.eventTitle || theme.identity.displayName}</span>
        <span>Knowledge · People · Progress</span>
      </footer>
    );
  }
  if (
    theme.design.stylePreset === "BIRTHDAY" &&
    (storybookComposition?.anecdote || theme.design.storybook?.subtitle || theme.design.occasion.extraText)
  ) {
    return (
      <footer className="presentation-personal-footer relative z-30 mx-auto -mt-4 mb-1 rotate-[-1deg] bg-white px-8 py-2 text-sm font-bold shadow-lg">
        {storybookComposition?.anecdote?.text || theme.design.storybook?.subtitle || theme.design.occasion.extraText}
      </footer>
    );
  }
  return null;
}

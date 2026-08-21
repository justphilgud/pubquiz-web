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

function storybookPageKind(composition: StorybookComposition | null) {
  return {
    COVER: "Auftakt",
    CHAPTER: "Kapitel",
    EDITORIAL: "Editorial",
    PORTRAIT: "Porträt",
    SPLIT: "Begegnung",
    SEQUENCE: "Sequenz",
    MEMORY: "Erinnerung",
  }[composition?.variant ?? "EDITORIAL"];
}

export function PresentationDesignHeader({
  theme,
  slideLabel,
  slideNumber,
  slideCount,
  storybookComposition = null,
}: HeaderProps & { storybookComposition?: StorybookComposition | null }) {
  if (theme.design.stylePreset === "EDITORIAL") {
    const progress = `${String(slideNumber).padStart(2, "0")} / ${String(slideCount).padStart(2, "0")}`;
    return (
      <header className="presentation-chrome presentation-editorial-header relative z-20 flex h-28 shrink-0 items-start justify-between px-3 pt-2">
        {theme.identity.logoUrl ? (
          <img data-template-asset-role="LOGO" src={theme.identity.logoUrl} alt="LOVD STELP" className="presentation-editorial-logo" />
        ) : (
          <span className="presentation-editorial-wordmark">LOVD</span>
        )}
        <div className="presentation-editorial-progress" aria-label={`${slideLabel}, Folie ${slideNumber} von ${slideCount}`}>
          {slideLabel.toLocaleUpperCase("de-DE")} {progress}
        </div>
      </header>
    );
  }

  if (theme.design.stylePreset === "CORPORATE") {
    return (
      <header className="presentation-chrome presentation-corporate-header mb-4 grid h-24 shrink-0 grid-cols-[auto_1fr_auto] items-stretch bg-white">
        <div className="presentation-corporate-logo grid min-w-28 place-items-center border-r px-5">
          {theme.identity.logoUrl ? (
            <img data-template-asset-role="LOGO" src={theme.identity.logoUrl} alt="" className="h-14 max-w-32 object-contain" />
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
      <header className="presentation-chrome presentation-birthday-header relative shrink-0">
        <div className="presentation-storybook-running-head flex min-w-0 items-center gap-4">
          {theme.identity.logoUrl && (
            <img data-template-asset-role="LOGO" src={theme.identity.logoUrl} alt="" className="h-14 w-14 shrink-0 object-contain" />
          )}
          <div className="min-w-0">
            <div className="presentation-birthday-title truncate">
              {displayIdentity(theme)}
            </div>
            <div className="presentation-primary-text">
              {slideLabel} <span aria-hidden="true">/</span> {storybookPageKind(storybookComposition)}
            </div>
          </div>
        </div>
        <div className="presentation-birthday-page" aria-label={`Seite ${slideNumber} von ${slideCount}`}>
          <span>{String(slideNumber).padStart(2, "0")}</span>
          <span aria-hidden="true">—</span>
          <span>{String(slideCount).padStart(2, "0")}</span>
        </div>
      </header>
    );
  }

  return (
    <header className="presentation-chrome presentation-neon-header mb-3 flex h-28 shrink-0 items-center justify-between rounded-3xl border-2 border-[#38E8FF] bg-black/85 px-8 shadow-[0_0_24px_#38E8FF]">
      <div className="flex items-center gap-6">
        {theme.identity.logoUrl && (
          <img data-template-asset-role="LOGO" src={theme.identity.logoUrl} alt="" className="h-24 w-24 object-contain" />
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
  const decorativeImages = theme.design.composition.decoration === "NONE"
    ? []
    : theme.assets.decorativeImages.slice(0, 4);
  const decorations = decorativeImages.map((source, index) => (
    <img
      key={`${source}-${index}`}
      data-template-asset-role="DECORATION"
      data-template-decoration-index={index + 1}
      src={source}
      alt=""
      className="presentation-template-decoration-image"
    />
  ));

  if (theme.design.stylePreset === "EDITORIAL") {
    return (
      <div className="presentation-decoration presentation-editorial-decoration pointer-events-none absolute inset-0" aria-hidden="true">
        {theme.identity.logoUrl && (
          <img data-template-asset-role="LOGO" src={theme.identity.logoUrl} alt="" className="presentation-editorial-intro-logo" />
        )}
        <span className="presentation-editorial-intro-title">PUBQUIZ</span>
        <span className="presentation-editorial-intro-collaboration">{theme.design.occasion.extraText || "LOVD × ungegoogelt"}</span>
      </div>
    );
  }

  if (theme.design.stylePreset === "CORPORATE") {
    return (
      <div className="presentation-decoration presentation-corporate-decoration pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="presentation-corporate-rule" />
        {theme.assets.heroImage && (
          <img data-template-asset-role="HERO_IMAGE" src={theme.assets.heroImage} alt="" className="presentation-corporate-brand-image" />
        )}
        {decorations}
      </div>
    );
  }

  if (theme.design.stylePreset === "BIRTHDAY") {
    const fallbackImages = images.length > 0
      ? images
      : theme.assets.heroImage
        ? [theme.assets.heroImage]
        : [];
    const fallbackVariant = fallbackImages.length > 0 ? "PORTRAIT" : "EDITORIAL";
    const variant = storybookComposition?.variant ?? fallbackVariant;
    const compositionAssets = storybookComposition?.assets ?? [];
    const coverAssets = theme.assets.heroImage && variant === "COVER"
      ? [{
          id: "template-hero",
          source: theme.assets.heroImage,
          role: "MEMORY" as const,
          personIds: [],
          alt: "",
          caption: null,
          year: null,
          order: -1,
        }]
      : compositionAssets;
    const storyImages = ["EDITORIAL", "CHAPTER"].includes(variant)
      ? []
      : coverAssets.length > 0
        ? coverAssets
        : fallbackImages.map((source, index) => ({
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
      <div className="presentation-decoration presentation-birthday-decoration pointer-events-none absolute inset-0" data-storybook-variant={variant}>
        {storyImages.length > 0 && (
          <div className="presentation-storybook-gallery">
            {storyImages.map((asset, index) => (
              <figure key={asset.id} className="presentation-personal-image" data-storybook-photo={index + 1}>
                <img data-template-asset-role={asset.source === theme.assets.heroImage ? "HERO_IMAGE" : "IMAGE_POOL"} src={asset.source} alt={asset.alt} />
                {(asset.year || asset.caption) && (
                  <figcaption>{asset.year && <span>{asset.year}</span>}{asset.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
        {decorations}
      </div>
    );
  }

  return (
    <div className="presentation-decoration presentation-neon-decoration pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="presentation-neon-orbit presentation-neon-orbit-one" />
      <span className="presentation-neon-orbit presentation-neon-orbit-two" />
      {theme.assets.heroImage && (
        <img data-template-asset-role="HERO_IMAGE" src={theme.assets.heroImage} alt="" className="presentation-neon-key-visual" />
      )}
      {decorations}
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
    EDITORIAL: "presentation-editorial-stage px-3 pb-10 pt-3",
  }[theme.design.stylePreset];

  return (
    <section
      className={`presentation-stage relative z-20 min-h-0 flex-1 ${styleClass}`}
      data-storybook-variant={theme.design.stylePreset === "BIRTHDAY" ? storybookComposition?.variant ?? "EDITORIAL" : undefined}
      data-storybook-people-mode={theme.design.stylePreset === "BIRTHDAY" ? storybookComposition?.peopleMode ?? "TITLE_ONLY" : undefined}
      data-storybook-material={theme.design.stylePreset === "BIRTHDAY" ? theme.design.storybook?.material : undefined}
    >
      {theme.design.stylePreset === "BIRTHDAY" && storybookComposition?.chapter && (
        <div className="presentation-storybook-chapter"><span>Kapitel</span><strong>{storybookComposition.chapter.title}</strong>{storybookComposition.chapter.subtitle && <small>{storybookComposition.chapter.subtitle}</small>}</div>
      )}
      <div className="presentation-storybook-content h-full min-h-0">{children}</div>
      {theme.design.stylePreset === "BIRTHDAY" && storybookComposition?.anecdote && (
        <aside className="presentation-storybook-anecdote"><span>{storybookComposition.anecdote.year || "Erinnert ihr euch?"}</span><q>{storybookComposition.anecdote.text}</q></aside>
      )}
    </section>
  );
}

export function PresentationDesignFooter({
  theme,
}: {
  theme: ResolvedQuizTheme;
  storybookComposition?: StorybookComposition | null;
}) {
  if (theme.design.stylePreset === "EDITORIAL") {
    return (
      <footer className="presentation-editorial-footer relative z-20 flex shrink-0 items-center justify-end">
        <span>{theme.design.occasion.extraText || "LOVD × ungegoogelt"}</span>
      </footer>
    );
  }
  if (theme.design.stylePreset === "CORPORATE") {
    return (
      <footer className="presentation-corporate-footer relative z-20 mt-3 flex h-9 shrink-0 items-center justify-between border-t px-2 text-xs font-semibold uppercase tracking-[0.12em]">
        <span>{theme.design.occasion.eventTitle || theme.identity.displayName}</span>
        <span>Knowledge · People · Progress</span>
      </footer>
    );
  }
  return null;
}

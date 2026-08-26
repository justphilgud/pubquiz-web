import type { CSSProperties } from "react";

import type {
  AnswerFormTemplate,
  PresentationTemplate,
  PresentationTemplateDesign,
  TemplateSource,
} from "../templateRegistry";
import type { ResolvedTemplate } from "../templateResolver";
import {
  resolvePresentationTemplateRuntimeAssets,
  type PresentationTemplateRuntimeAssets,
} from "../presentationTemplates/presentationTemplateAssets";

export type ResolvedQuizTheme = {
  version: 1;
  identity: {
    displayName: string;
    logoUrl: string | null;
  };
  source: {
    presentationTemplateId: PresentationTemplate["id"];
    answerFormTemplateId: AnswerFormTemplate["id"];
    presentationSource: TemplateSource;
    answerFormSource: TemplateSource;
    presentationUsedFallback: boolean;
    answerFormUsedFallback: boolean;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    textMuted: string;
    border: string;
  };
  semantic: {
    correct: string;
    success: string;
    warning: string;
    danger: string;
    focus: string;
  };
  ui: {
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    primaryText: string;
    focus: string;
    success: string;
    successSurface: string;
    warning: string;
    warningSurface: string;
    danger: string;
    dangerSurface: string;
    disabledText: string;
    disabledSurface: string;
  };
  appearance: {
    mode: "LIGHT" | "DARK";
    typographyPreset: "BRAND_DISPLAY" | "SYSTEM";
    fontFamily: string;
    displayWeight: number;
    bodyWeight: number;
    radiusPreset: "ROUNDED" | "COMPACT";
    densityPreset: "COMFORTABLE" | "COMPACT";
    radii: {
      small: string;
      medium: string;
      large: string;
    };
    spacing: {
      small: string;
      medium: string;
      large: string;
    };
  };
  assets: PresentationTemplateRuntimeAssets;
  design: PresentationTemplateDesign;
  presentation: {
    variant: PresentationTemplate["variant"];
  };
  moderation: {
    variant: "BRANDED" | "QUIET";
  };
  answerForm: {
    variant: AnswerFormTemplate["variant"];
  };
};

export type ResolveQuizThemeInput = {
  displayName: string;
  presentation: ResolvedTemplate<PresentationTemplate>;
  answerForm: ResolvedTemplate<AnswerFormTemplate>;
};

function relativeLuminance(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const channels = match[1].match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) return null;
  return channels
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) =>
        sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

function colorContrast(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return 0;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function accessibleColor(
  candidate: string,
  background: string,
  fallbacks: readonly string[],
  minimumContrast: number,
) {
  return [candidate, ...fallbacks].find(
    (color) => colorContrast(color, background) >= minimumContrast,
  ) ?? fallbacks.at(-1) ?? candidate;
}

export function resolveQuizTheme({
  displayName,
  presentation,
  answerForm,
}: ResolveQuizThemeInput): ResolvedQuizTheme {
  const identityTokens = presentation.template.tokens;
  const uiTokens = answerForm.template.tokens;
  const uiText = accessibleColor(
    uiTokens.colors.text,
    uiTokens.colors.surface,
    ["#0f172a", "#ffffff"],
    4.5,
  );
  const uiTextMuted = accessibleColor(
    uiTokens.colors.textMuted,
    uiTokens.colors.surface,
    ["#475569", uiText],
    4.5,
  );
  const uiBorder = accessibleColor(
    uiTokens.colors.border,
    uiTokens.colors.surface,
    ["#64748b", "#334155"],
    3,
  );
  const uiPrimaryText = accessibleColor(
    "#ffffff",
    uiTokens.colors.primary,
    ["#0f172a"],
    4.5,
  );
  const uiFocus = accessibleColor(
    uiTokens.colors.primary,
    uiTokens.colors.surface,
    ["#1d4ed8", "#0f172a"],
    3,
  );
  const answerFormIsCompact = answerForm.template.variant === "MINIMAL";
  const assets = resolvePresentationTemplateRuntimeAssets(
    presentation.template,
  );

  return {
    version: 1,
    identity: {
      displayName,
      logoUrl: assets.logo,
    },
    source: {
      presentationTemplateId: presentation.template.id,
      answerFormTemplateId: answerForm.template.id,
      presentationSource: presentation.source,
      answerFormSource: answerForm.source,
      presentationUsedFallback: presentation.usedFallback,
      answerFormUsedFallback: answerForm.usedFallback,
    },
    colors: {
      primary: identityTokens.colors.primary,
      secondary: identityTokens.colors.secondary,
      accent: identityTokens.colors.accent,
      background: identityTokens.colors.background,
      surface: identityTokens.colors.surface,
      surfaceStrong: identityTokens.colors.surfaceStrong,
      text: identityTokens.colors.text,
      textMuted: identityTokens.colors.textMuted,
      border: identityTokens.colors.border,
    },
    semantic: {
      correct: identityTokens.colors.correct,
      success: identityTokens.colors.success,
      warning: identityTokens.colors.warning,
      danger: identityTokens.colors.danger,
      focus: identityTokens.colors.primary,
    },
    ui: {
      background: uiTokens.colors.background,
      surface: uiTokens.colors.surface,
      surfaceStrong: uiTokens.colors.surfaceStrong,
      text: uiText,
      textMuted: uiTextMuted,
      border: uiBorder,
      primary: uiTokens.colors.primary,
      primaryText: uiPrimaryText,
      focus: uiFocus,
      success: accessibleColor(uiTokens.colors.success, "#f0fdf4", ["#166534"], 4.5),
      successSurface: "#f0fdf4",
      warning: accessibleColor(uiTokens.colors.warning, "#fffbeb", ["#92400e"], 4.5),
      warningSurface: "#fffbeb",
      danger: accessibleColor(uiTokens.colors.danger, "#fef2f2", ["#b91c1c"], 4.5),
      dangerSurface: "#fef2f2",
      disabledText: "#475569",
      disabledSurface: "#f1f5f9",
    },
    appearance: {
      mode: presentation.template.variant === "DARK" ? "DARK" : "LIGHT",
      typographyPreset:
        identityTokens.typography.family === "system-ui, sans-serif"
          ? "SYSTEM"
          : "BRAND_DISPLAY",
      fontFamily: identityTokens.typography.family,
      displayWeight: identityTokens.typography.displayWeight,
      bodyWeight: identityTokens.typography.bodyWeight,
      radiusPreset:
        presentation.template.variant === "DARK" ? "COMPACT" : "ROUNDED",
      densityPreset: answerFormIsCompact ? "COMPACT" : "COMFORTABLE",
      radii: identityTokens.radii,
      spacing: answerFormIsCompact
        ? answerForm.template.tokens.spacing
        : identityTokens.spacing,
    },
    assets,
    design: structuredClone(presentation.template.design),
    presentation: {
      variant: presentation.template.variant,
    },
    moderation: {
      variant: presentation.template.moderationVariant ?? "BRANDED",
    },
    answerForm: {
      variant: answerForm.template.variant,
    },
  };
}

export type QuizThemeCssProperties = CSSProperties & {
  [key: `--quiz-${string}`]: string | number;
  [key: `--brand-${string}`]: string | number;
};

export function quizThemeStyle(theme: ResolvedQuizTheme): QuizThemeCssProperties {
  const style: QuizThemeCssProperties = {
    "--quiz-primary": theme.colors.primary,
    "--quiz-secondary": theme.colors.secondary,
    "--quiz-accent": theme.colors.accent,
    "--quiz-background": theme.colors.background,
    "--quiz-surface": theme.colors.surface,
    "--quiz-surface-strong": theme.colors.surfaceStrong,
    "--quiz-text": theme.colors.text,
    "--quiz-text-muted": theme.colors.textMuted,
    "--quiz-border": theme.colors.border,
    "--quiz-correct": theme.semantic.correct,
    "--quiz-success": theme.semantic.success,
    "--quiz-warning": theme.semantic.warning,
    "--quiz-danger": theme.semantic.danger,
    "--quiz-focus": theme.semantic.focus,
    "--quiz-ui-background": theme.ui.background,
    "--quiz-ui-surface": theme.ui.surface,
    "--quiz-ui-surface-strong": theme.ui.surfaceStrong,
    "--quiz-ui-text": theme.ui.text,
    "--quiz-ui-text-muted": theme.ui.textMuted,
    "--quiz-ui-border": theme.ui.border,
    "--quiz-ui-primary": theme.ui.primary,
    "--quiz-ui-primary-text": theme.ui.primaryText,
    "--quiz-ui-focus": theme.ui.focus,
    "--quiz-ui-success": theme.ui.success,
    "--quiz-ui-success-surface": theme.ui.successSurface,
    "--quiz-ui-warning": theme.ui.warning,
    "--quiz-ui-warning-surface": theme.ui.warningSurface,
    "--quiz-ui-danger": theme.ui.danger,
    "--quiz-ui-danger-surface": theme.ui.dangerSurface,
    "--quiz-ui-disabled-text": theme.ui.disabledText,
    "--quiz-ui-disabled-surface": theme.ui.disabledSurface,
    "--quiz-radius-small": theme.appearance.radii.small,
    "--quiz-radius-medium": theme.appearance.radii.medium,
    "--quiz-radius-large": theme.appearance.radii.large,
    "--quiz-space-small": theme.appearance.spacing.small,
    "--quiz-space-medium": theme.appearance.spacing.medium,
    "--quiz-space-large": theme.appearance.spacing.large,
    "--quiz-font-family": theme.appearance.fontFamily,
    "--quiz-display-weight": theme.appearance.displayWeight,
    "--quiz-body-weight": theme.appearance.bodyWeight,
    // Compatibility aliases for the existing scoped presentation/answer CSS.
    "--brand-primary": theme.colors.primary,
    "--brand-secondary": theme.colors.secondary,
    "--brand-accent": theme.colors.accent,
    "--brand-background": theme.colors.background,
    "--brand-surface": theme.colors.surface,
    "--brand-surface-strong": theme.colors.surfaceStrong,
    "--brand-text": theme.colors.text,
    "--brand-text-muted": theme.colors.textMuted,
    "--brand-border": theme.colors.border,
    "--brand-correct": theme.semantic.correct,
    "--brand-success": theme.semantic.success,
    "--brand-warning": theme.semantic.warning,
    "--brand-danger": theme.semantic.danger,
    "--brand-radius-small": theme.appearance.radii.small,
    "--brand-radius-medium": theme.appearance.radii.medium,
    "--brand-radius-large": theme.appearance.radii.large,
    "--brand-space-small": theme.appearance.spacing.small,
    "--brand-space-medium": theme.appearance.spacing.medium,
    "--brand-space-large": theme.appearance.spacing.large,
    "--brand-font-family": theme.appearance.fontFamily,
    "--brand-display-weight": theme.appearance.displayWeight,
    "--brand-body-weight": theme.appearance.bodyWeight,
    fontFamily: theme.appearance.fontFamily,
  };

  if (theme.assets.backgroundImage) {
    style.backgroundImage = `linear-gradient(${theme.colors.background}66, ${theme.colors.background}66), url("${theme.assets.backgroundImage}")`;
  } else if (theme.design.stylePreset === "NEON") {
    style.backgroundImage = `radial-gradient(circle at 20% 20%, ${theme.colors.secondary} 0, ${theme.colors.secondary}22 24%, transparent 42%), radial-gradient(circle at 80% 10%, ${theme.colors.primary}66 0, ${theme.colors.primary}22 22%, transparent 38%), linear-gradient(135deg, #1a0033, ${theme.colors.background} 45%, #001a3a)`;
  } else if (theme.design.stylePreset === "CORPORATE") {
    style.backgroundImage = `linear-gradient(120deg, ${theme.colors.background}, ${theme.colors.surfaceStrong})`;
  } else if (theme.design.stylePreset === "EDITORIAL") {
    style.backgroundImage = "none";
  } else {
    style.backgroundImage = `radial-gradient(circle at 12% 15%, ${theme.colors.accent}33 0 7%, transparent 8%), radial-gradient(circle at 88% 10%, ${theme.colors.secondary}22 0 10%, transparent 11%), linear-gradient(145deg, ${theme.colors.background}, ${theme.colors.surfaceStrong})`;
  }

  return style;
}

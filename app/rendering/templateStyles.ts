import type { CSSProperties } from "react";
import {
  UNGEGOOGELT_NEON_COLORS,
  type AnswerFormTemplate,
  type PresentationTemplate,
} from "./templateRegistry";

export type TemplateCssProperties = CSSProperties & {
  [key: `--brand-${string}`]: string | number;
};

function tokenVariables(
  template: PresentationTemplate | AnswerFormTemplate,
): TemplateCssProperties {
  const { colors, radii, spacing, typography } = template.tokens;
  return {
    "--brand-primary": colors.primary,
    "--brand-secondary": colors.secondary,
    "--brand-accent": colors.accent,
    "--brand-background": colors.background,
    "--brand-surface": colors.surface,
    "--brand-surface-strong": colors.surfaceStrong,
    "--brand-text": colors.text,
    "--brand-text-muted": colors.textMuted,
    "--brand-border": colors.border,
    "--brand-correct": colors.correct,
    "--brand-success": colors.success,
    "--brand-warning": colors.warning,
    "--brand-danger": colors.danger,
    "--brand-radius-small": radii.small,
    "--brand-radius-medium": radii.medium,
    "--brand-radius-large": radii.large,
    "--brand-space-small": spacing.small,
    "--brand-space-medium": spacing.medium,
    "--brand-space-large": spacing.large,
    "--brand-font-family": typography.family,
    "--brand-display-weight": typography.displayWeight,
    "--brand-body-weight": typography.bodyWeight,
  };
}

export function presentationTemplateStyle(
  template: PresentationTemplate,
): TemplateCssProperties {
  const variables = tokenVariables(template);
  const { primary, background } = template.tokens.colors;
  return {
    ...variables,
    backgroundImage:
      template.design.stylePreset === "EDITORIAL" || template.design.stylePreset === "KOMM_ONE"
        ? "none"
        : template.variant === "NEON"
        ? `radial-gradient(circle at 14% 8%, ${UNGEGOOGELT_NEON_COLORS.blue}55 0, transparent 30%), radial-gradient(circle at 88% 12%, ${UNGEGOOGELT_NEON_COLORS.pink}44 0, transparent 28%), radial-gradient(circle at 24% 100%, ${UNGEGOOGELT_NEON_COLORS.green}2E 0, transparent 32%), linear-gradient(145deg, #000000, ${background} 52%, #090313)`
        : `radial-gradient(circle at 50% 0%, ${primary}22, transparent 42%), linear-gradient(145deg, ${background}, #000000)`,
    backgroundColor: background,
    color: template.tokens.colors.text,
    fontFamily: template.tokens.typography.family,
  };
}

export function answerFormTemplateStyle(
  template: AnswerFormTemplate,
): TemplateCssProperties {
  return {
    ...tokenVariables(template),
    backgroundColor: template.tokens.colors.background,
    color: template.tokens.colors.text,
    fontFamily: template.tokens.typography.family,
  };
}

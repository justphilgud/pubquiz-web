import type { CSSProperties } from "react";
import type {
  AnswerFormTemplate,
  PresentationTemplate,
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
  const { primary, secondary, background } = template.tokens.colors;
  return {
    ...variables,
    backgroundImage:
      template.variant === "NEON"
        ? `radial-gradient(circle at 20% 20%, ${secondary} 0, ${secondary}22 24%, transparent 42%), radial-gradient(circle at 80% 10%, ${primary}66 0, ${primary}22 22%, transparent 38%), linear-gradient(135deg, #1a0033, ${background} 45%, #001a3a)`
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

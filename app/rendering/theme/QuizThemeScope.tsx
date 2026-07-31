import type { ElementType, ReactNode } from "react";

import { quizThemeStyle, type ResolvedQuizTheme } from "./quizTheme";

type Props<TElement extends ElementType> = {
  as?: TElement;
  theme: ResolvedQuizTheme;
  children: ReactNode;
  className?: string;
};

export function QuizThemeScope<TElement extends ElementType = "div">({
  as,
  theme,
  children,
  className,
}: Props<TElement>) {
  const Component = as ?? "div";

  return (
    <Component
      className={className}
      data-quiz-theme-version={theme.version}
      data-theme-mode={theme.appearance.mode}
      data-presentation-variant={theme.presentation.variant}
      data-moderation-variant={theme.moderation.variant}
      data-answer-form-variant={theme.answerForm.variant}
      data-design-style={theme.design.stylePreset}
      data-header-style={theme.design.composition.headerStyle}
      data-layout-preset={theme.design.composition.layoutPreset}
      data-content-frame={theme.design.composition.contentFrame}
      data-media-treatment={theme.design.composition.mediaTreatment}
      data-answer-treatment={theme.design.composition.answerTreatment}
      data-solution-treatment={theme.design.composition.solutionTreatment}
      data-decoration={theme.design.composition.decoration}
      style={quizThemeStyle(theme)}
    >
      {children}
    </Component>
  );
}

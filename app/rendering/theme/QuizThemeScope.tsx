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
      data-answer-form-variant={theme.answerForm.variant}
      style={quizThemeStyle(theme)}
    >
      {children}
    </Component>
  );
}

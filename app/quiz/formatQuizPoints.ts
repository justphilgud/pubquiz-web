const quizPointsFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 2,
});

export function formatQuizPoints(points: number): string {
  return quizPointsFormatter.format(points);
}

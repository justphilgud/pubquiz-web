export type QuizPurpose = "REGULAR" | "TEST";
export type QuizPurposeFilter = QuizPurpose | "ALL";

export function resolveQuizPurpose(value: unknown): QuizPurpose {
  if (value === undefined) return "REGULAR";
  if (value === "REGULAR" || value === "TEST") return value;
  throw new Error("Ungültiger Quiz-Zweck.");
}

export function resolveQuizPurposeFilter(value: string | null): QuizPurposeFilter {
  return value === "TEST" || value === "ALL" ? value : "REGULAR";
}

export function matchesQuizFilters(quiz: {
  purpose: QuizPurpose; eventreihe_id: number; temporal_status: string;
  titel: string | null; eventreihe_name: string;
}, filters: { purpose: QuizPurposeFilter; eventSeries: string; status: string; query: string }) {
  return (filters.purpose === "ALL" || quiz.purpose === filters.purpose)
    && (!filters.eventSeries || quiz.eventreihe_id === Number(filters.eventSeries))
    && (!filters.status || quiz.temporal_status === filters.status)
    && (!filters.query.trim() || `${quiz.titel ?? ""} ${quiz.eventreihe_name}`.toLocaleLowerCase("de").includes(filters.query.trim().toLocaleLowerCase("de")));
}

export function updateQuizFilterUrl(current: string, key: "purpose" | "eventSeries" | "status" | "q", value: string) {
  const params = new URLSearchParams(current);
  if (value) params.set(key, value); else params.delete(key);
  return params.toString();
}

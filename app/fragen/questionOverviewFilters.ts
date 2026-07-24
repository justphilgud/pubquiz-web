export const questionOverviewStatuses = [
  "MY_DRAFTS",
  "MY_SUBMITTED",
  "REVIEW_QUEUE",
  "CHANGES_REQUESTED",
  "APPROVED",
  "ARCHIVED",
  "OUTDATED",
] as const;

export type QuestionOverviewStatus =
  (typeof questionOverviewStatuses)[number];

export type QuestionSourceState = "with" | "without";
export type QuestionMediaState = "with" | "without";
export type QuestionAnswerModeFilter = "open" | "closed";

export type QuestionOverviewFilters = {
  query: string;
  sourceState: QuestionSourceState | null;
  statuses: QuestionOverviewStatus[];
  templateIds: string[];
  categoryId: number | null;
  mediaState: QuestionMediaState | null;
  answerMode: QuestionAnswerModeFilter | null;
};

const statusSet = new Set<string>(questionOverviewStatuses);

function readList(params: URLSearchParams, key: string) {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseQuestionOverviewFilters(
  params: URLSearchParams,
  allowedTemplateIds: readonly string[],
  allowedCategoryIds: readonly number[],
): QuestionOverviewFilters {
  const templateIds = new Set(allowedTemplateIds);
  const categoryIds = new Set(allowedCategoryIds);
  const parsedCategoryId = Number(params.get("category"));
  const sourceState = params.get("sourceState");
  const requestedMediaState = params.get("mediaState");
  const answerMode = params.get("answerMode");

  return {
    query: (params.get("q") ?? "").slice(0, 300),
    sourceState:
      sourceState === "with" || sourceState === "without"
        ? sourceState
        : null,
    statuses: [
      ...new Set(
        readList(params, "status").filter(
          (status): status is QuestionOverviewStatus =>
            statusSet.has(status),
        ),
      ),
    ],
    templateIds: [
      ...new Set(
        readList(params, "template").filter((templateId) =>
          templateIds.has(templateId),
        ),
      ),
    ],
    categoryId:
      Number.isInteger(parsedCategoryId) && categoryIds.has(parsedCategoryId)
        ? parsedCategoryId
        : null,
    mediaState:
      requestedMediaState === "with" || requestedMediaState === "without"
        ? requestedMediaState
        : params.get("withoutMedia") === "1"
          ? "without"
          : null,
    answerMode:
      answerMode === "open" || answerMode === "closed" ? answerMode : null,
  };
}

export function serializeQuestionOverviewFilters(
  filters: QuestionOverviewFilters,
) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.sourceState) params.set("sourceState", filters.sourceState);
  for (const status of filters.statuses) params.append("status", status);
  for (const templateId of filters.templateIds) {
    params.append("template", templateId);
  }
  if (filters.categoryId) {
    params.set("category", String(filters.categoryId));
  }
  if (filters.mediaState) params.set("mediaState", filters.mediaState);
  if (filters.answerMode) params.set("answerMode", filters.answerMode);
  return params;
}

export function countAdvancedQuestionFilters(
  filters: QuestionOverviewFilters,
) {
  return (
    filters.statuses.length +
    filters.templateIds.length +
    Number(filters.categoryId !== null) +
    Number(filters.sourceState !== null) +
    Number(filters.mediaState !== null) +
    Number(filters.answerMode !== null)
  );
}

export function hasQuestionSource(source: string | null) {
  return Boolean(source?.trim());
}

export function getPendingCategoryBadgeLabel(
  pendingCategoryNames: readonly string[],
) {
  if (pendingCategoryNames.length === 0) return null;
  return pendingCategoryNames.length === 1
    ? "Kategorie ungeprüft"
    : `${pendingCategoryNames.length} Kategorien ungeprüft`;
}

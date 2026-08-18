export const CONTENT_TYPES = ["ALL", "QUESTION", "STORY_ELEMENT"] as const;
export type ContentTypeFilter = (typeof CONTENT_TYPES)[number];
export type ContentType = Exclude<ContentTypeFilter, "ALL">;
export type ContentInitialType = ContentType | undefined;

export type ContentStatusFilter = "ALL" | "DRAFT" | "ACTIVE" | "ARCHIVED";
export type ContentBinaryFilter = "ALL" | "WITH" | "WITHOUT";
export type ContentUsageFilter = "ALL" | "USED" | "UNUSED";
export type ContentQuestionLifecycleFilter =
  | "ALL"
  | "CURRENT"
  | "OUTDATED_SOON"
  | "OUTDATED"
  | "REVIEW_SOON"
  | "REVIEW_DUE";

export type ContentFiltersState = {
  query: string;
  contentType: ContentTypeFilter;
  categoryIds: number[];
  storyType: string;
  status: ContentStatusFilter;
  questionLifecycle: ContentQuestionLifecycleFilter;
  media: ContentBinaryFilter;
  usage: ContentUsageFilter;
  eventSeriesId: number | null;
};

export type ContentFilterOption = { id: number; name: string };

export type ContentQuizUsage = {
  quizId: number;
  title: string;
  date: string | null;
  archived: boolean;
};

export type ContentSearchItem = {
  key: string;
  id: number;
  contentType: ContentType;
  subtype: string;
  title: string;
  status: string;
  lifecycleStatus?: string;
  archived: boolean;
  scope: string;
  mediaCount: number;
  quizUsages: ContentQuizUsage[];
  assignableQuizIds: number[];
  editHref: string;
  canClone: boolean;
  canArchive: boolean;
  questionMetrics?: {
    answerCount: number;
    difficulty: string | null;
    answerMode: string;
    categories: string[];
    source: string | null;
    template: string;
    questionMediaCount: number;
    answerMediaCount: number;
    storyElementCount: number;
  };
  storyMetrics?: {
    linkedQuestionCount: number;
    linkedQuestionTitle: string | null;
    revision: number;
  };
};

export type ContentSearchResult = { items: ContentSearchItem[]; total: number };

export type ContentQuizOption = {
  quizId: number;
  title: string;
  date: string | null;
  eventSeriesId: number;
};

export function parseContentFilters(
  params: URLSearchParams,
  initialType?: ContentType,
): ContentFiltersState {
  const requestedType = params.get("contentType");
  const requestedStatus = params.get("status");
  const requestedMedia = params.get("media");
  const requestedUsage = params.get("usage");
  const requestedQuestionLifecycle = params.get("questionLifecycle");
  return normalizeContentFiltersForType({
    query: (params.get("q") ?? "").slice(0, 300),
    contentType: CONTENT_TYPES.includes(requestedType as ContentTypeFilter)
      ? requestedType as ContentTypeFilter
      : initialType ?? "ALL",
    categoryIds: [...new Set(params.getAll("categoryId")
      .map((value) => parsePositiveId(value))
      .filter((value): value is number => value !== null))],
    storyType: params.get("storyType") ?? "ALL",
    status: ["ALL", "DRAFT", "ACTIVE", "ARCHIVED"].includes(requestedStatus ?? "")
      ? requestedStatus as ContentStatusFilter
      : "ALL",
    questionLifecycle: ["ALL", "CURRENT", "OUTDATED_SOON", "OUTDATED", "REVIEW_SOON", "REVIEW_DUE"].includes(requestedQuestionLifecycle ?? "")
      ? requestedQuestionLifecycle as ContentQuestionLifecycleFilter
      : "ALL",
    media: ["ALL", "WITH", "WITHOUT"].includes(requestedMedia ?? "")
      ? requestedMedia as ContentBinaryFilter
      : "ALL",
    usage: ["ALL", "USED", "UNUSED"].includes(requestedUsage ?? "")
      ? requestedUsage as ContentUsageFilter
      : "ALL",
    eventSeriesId: parsePositiveId(params.get("eventSeriesId")),
  });
}

function parsePositiveId(value: string | null) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function normalizeContentFiltersForType(filters: ContentFiltersState) {
  if (filters.contentType === "QUESTION") return { ...filters, storyType: "ALL" };
  if (filters.contentType === "STORY_ELEMENT") return { ...filters, categoryIds: [], questionLifecycle: "ALL" as const };
  return filters;
}

export type ContentFilterDraft = {
  initialType: ContentInitialType;
  paramsKey: string;
  filters: ContentFiltersState;
};

export function resolveContentFilterDraft(
  draft: ContentFilterDraft,
  initialType: ContentInitialType,
  paramsKey: string,
) {
  return draft.initialType === initialType && draft.paramsKey === paramsKey
    ? draft.filters
    : parseContentFilters(new URLSearchParams(paramsKey), initialType);
}

export function serializeContentFilters(filters: ContentFiltersState) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.contentType !== "ALL") params.set("contentType", filters.contentType);
  if (filters.contentType !== "STORY_ELEMENT") {
    for (const categoryId of filters.categoryIds) params.append("categoryId", String(categoryId));
  }
  if (filters.storyType !== "ALL") params.set("storyType", filters.storyType);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.contentType !== "STORY_ELEMENT" && filters.questionLifecycle !== "ALL") params.set("questionLifecycle", filters.questionLifecycle);
  if (filters.media !== "ALL") params.set("media", filters.media);
  if (filters.usage !== "ALL") params.set("usage", filters.usage);
  if (filters.eventSeriesId !== null) params.set("eventSeriesId", String(filters.eventSeriesId));
  return params;
}

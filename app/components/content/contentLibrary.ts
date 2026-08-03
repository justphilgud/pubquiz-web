export const CONTENT_TYPES = ["ALL", "QUESTION", "STORY_ELEMENT"] as const;
export type ContentTypeFilter = (typeof CONTENT_TYPES)[number];
export type ContentType = Exclude<ContentTypeFilter, "ALL">;
export type ContentInitialType = ContentType | undefined;

export type ContentStatusFilter = "ALL" | "DRAFT" | "ACTIVE" | "ARCHIVED";
export type ContentBinaryFilter = "ALL" | "WITH" | "WITHOUT";
export type ContentUsageFilter = "ALL" | "USED" | "UNUSED";

export type ContentFiltersState = {
  query: string;
  contentType: ContentTypeFilter;
  storyType: string;
  status: ContentStatusFilter;
  media: ContentBinaryFilter;
  usage: ContentUsageFilter;
};

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
  archived: boolean;
  scope: string;
  mediaCount: number;
  quizUsages: ContentQuizUsage[];
  editHref: string;
  canClone: boolean;
  canArchive: boolean;
  questionMetrics?: {
    answerCount: number;
    difficulty: string | null;
    answerMode: string;
  };
  storyMetrics?: {
    linkedQuestionCount: number;
    revision: number;
  };
};

export type ContentQuizOption = {
  quizId: number;
  title: string;
  date: string | null;
};

export function parseContentFilters(
  params: URLSearchParams,
  initialType?: ContentType,
): ContentFiltersState {
  const requestedType = params.get("contentType");
  const requestedStatus = params.get("status");
  const requestedMedia = params.get("media");
  const requestedUsage = params.get("usage");
  return {
    query: (params.get("q") ?? "").slice(0, 300),
    contentType: CONTENT_TYPES.includes(requestedType as ContentTypeFilter)
      ? requestedType as ContentTypeFilter
      : initialType ?? "ALL",
    storyType: params.get("storyType") ?? "ALL",
    status: ["ALL", "DRAFT", "ACTIVE", "ARCHIVED"].includes(requestedStatus ?? "")
      ? requestedStatus as ContentStatusFilter
      : "ALL",
    media: ["ALL", "WITH", "WITHOUT"].includes(requestedMedia ?? "")
      ? requestedMedia as ContentBinaryFilter
      : "ALL",
    usage: ["ALL", "USED", "UNUSED"].includes(requestedUsage ?? "")
      ? requestedUsage as ContentUsageFilter
      : "ALL",
  };
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
  if (filters.storyType !== "ALL") params.set("storyType", filters.storyType);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.media !== "ALL") params.set("media", filters.media);
  if (filters.usage !== "ALL") params.set("usage", filters.usage);
  return params;
}

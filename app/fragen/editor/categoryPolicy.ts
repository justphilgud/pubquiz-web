export const CATEGORY_NAME_MAX_LENGTH = 100;

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCategoryComparisonKey(
  value: string,
  locale: string,
): string {
  return normalizeCategoryName(value).toLocaleLowerCase(locale);
}

export function isValidCategoryName(value: string): boolean {
  const normalized = normalizeCategoryName(value);
  return normalized.length > 0 && normalized.length <= CATEGORY_NAME_MAX_LENGTH;
}

export function isCategoryDuplicate(
  categories: readonly { name: string }[],
  candidate: string,
  locale: string,
): boolean {
  const candidateKey = normalizeCategoryComparisonKey(candidate, locale);
  return categories.some(
    (category) =>
      normalizeCategoryComparisonKey(category.name, locale) === candidateKey,
  );
}

export type CategoryMatchKind =
  | "EXACT"
  | "PREFIX"
  | "CONTAINS"
  | "SIMILAR";

export type RankedCategory<T> = {
  category: T;
  match: CategoryMatchKind;
};

function commonPrefixLength(left: string, right: string) {
  const maximum = Math.min(left.length, right.length);
  let index = 0;
  while (index < maximum && left[index] === right[index]) index += 1;
  return index;
}

export function rankCategoryMatches<T extends { name: string }>(
  categories: readonly T[],
  query: string,
  locale: string,
): RankedCategory<T>[] {
  const queryKey = normalizeCategoryComparisonKey(query, locale);
  if (!queryKey) {
    return [...categories]
      .sort((left, right) => left.name.localeCompare(right.name, locale))
      .map((category) => ({ category, match: "CONTAINS" as const }));
  }

  return categories
    .flatMap<RankedCategory<T>>((category) => {
      const categoryKey = normalizeCategoryComparisonKey(
        category.name,
        locale,
      );
      if (categoryKey === queryKey) {
        return [{ category, match: "EXACT" }];
      }
      if (categoryKey.startsWith(queryKey)) {
        return [{ category, match: "PREFIX" }];
      }
      if (categoryKey.includes(queryKey)) {
        return [{ category, match: "CONTAINS" }];
      }
      if (
        queryKey.includes(categoryKey) ||
        commonPrefixLength(categoryKey, queryKey) >= 3
      ) {
        return [{ category, match: "SIMILAR" }];
      }
      return [];
    })
    .sort((left, right) => {
      const rank = {
        EXACT: 0,
        PREFIX: 1,
        CONTAINS: 2,
        SIMILAR: 3,
      } satisfies Record<CategoryMatchKind, number>;
      return (
        rank[left.match] - rank[right.match] ||
        left.category.name.localeCompare(right.category.name, locale)
      );
    });
}

export const CATEGORY_NAME_MAX_LENGTH = 100;

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidCategoryName(value: string): boolean {
  const normalized = normalizeCategoryName(value);
  return normalized.length > 0 && normalized.length <= CATEGORY_NAME_MAX_LENGTH;
}

export function canDeleteCategoryWithAssignments(assignmentCount: number): boolean {
  return assignmentCount === 0;
}

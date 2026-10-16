import type { ContentType } from "./contentLibrary";

export const CONTENT_PAGE_SIZE = 50;
export type ContentCursor = { version: 1; signature: string; createdAt: string; contentType: ContentType; id: number };
export type ContentPosition = { createdAt: string; contentType: ContentType; id: number };

// Creation time is immutable: approving/editing a row cannot move it across pages.
export function compareContent(left: ContentPosition, right: ContentPosition) {
  return right.createdAt.localeCompare(left.createdAt) || left.contentType.localeCompare(right.contentType) || right.id - left.id;
}

export function readContentCursor(value: string | undefined, signature: string): ContentCursor | null {
  if (!value) return null;
  if (value.length > 4000) throw new Error("Ungültige Suchseite.");
  let cursor: ContentCursor;
  try { cursor = JSON.parse(value) as ContentCursor; } catch { throw new Error("Ungültige Suchseite."); }
  if (!cursor || cursor.version !== 1 || cursor.signature !== signature ||
      !["QUESTION", "STORY_ELEMENT", "POLL"].includes(cursor.contentType) ||
      !Number.isSafeInteger(cursor.id) || cursor.id <= 0 ||
      typeof cursor.createdAt !== "string" || !Number.isFinite(Date.parse(cursor.createdAt)) ||
      new Date(cursor.createdAt).toISOString() !== cursor.createdAt) throw new Error("Suchseite passt nicht zur aktuellen Suche.");
  return cursor;
}

export function contentCreatedBoundary(cursor: ContentCursor | null, type: ContentType, idField: string) {
  if (!cursor) return {};
  const date = new Date(cursor.createdAt);
  const laterType = type.localeCompare(cursor.contentType) > 0;
  const sameType = type === cursor.contentType;
  return { OR: [
    { created_at: { lt: date } },
    ...(laterType || sameType ? [{ created_at: date, ...(sameType ? { [idField]: { lt: cursor.id } } : {}) }] : []),
  ] };
}

/** Bounded batches and bounded retained results, including filters on latest revisions. */
export async function collectContentWindow<T extends { id: number; createdAt: Date }>(
  readBatch: (beforeId: number | null) => Promise<{ items: T[]; nextId: number | null }>,
  type: ContentType,
  cursor: ContentCursor | null,
) {
  let beforeId: number | null = null;
  let total = 0;
  let items: T[] = [];
  for (;;) {
    const { items: batch, nextId } = await readBatch(beforeId);
    total += batch.length;
    items.push(...batch.filter(item => !cursor || compareContent({ ...item, createdAt: item.createdAt.toISOString(), contentType: type }, cursor) > 0));
    items.sort((a, b) => compareContent({ ...a, createdAt: a.createdAt.toISOString(), contentType: type }, { ...b, createdAt: b.createdAt.toISOString(), contentType: type }));
    items = items.slice(0, CONTENT_PAGE_SIZE + 1);
    if (nextId === null) break;
    if (beforeId !== null && nextId >= beforeId) throw new Error("Suchseite konnte nicht fortgesetzt werden.");
    beforeId = nextId;
  }
  return { items, total };
}

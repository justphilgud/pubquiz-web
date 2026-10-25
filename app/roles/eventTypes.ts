/** Stable API/database identifiers. No playable Bingo/Karaoke UI is implied. */
export const EVENT_TYPES = [
  { id: "QUIZ", label: "Quiz", implemented: true },
  { id: "BINGO", label: "Bingo", implemented: false },
  { id: "POWERPOINT_KARAOKE", label: "PowerPoint-Karaoke", implemented: false },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["id"];
export function isEventType(value: unknown): value is EventType {
  return EVENT_TYPES.some(({ id }) => id === value);
}
export type EventTypeRole = "EDITOR" | "EVENT_MANAGER";
export function isEventTypeRole(value: unknown): value is EventTypeRole {
  return value === "EDITOR" || value === "EVENT_MANAGER";
}

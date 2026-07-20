export type EventSeriesAssignmentRole = "EVENT_MANAGER" | "EVENT_EDITOR";

export type EventSeriesCapability =
  | "VIEW"
  | "EDIT"
  | "MANAGE_QUIZZES"
  | "CONTROL_LIVE"
  | "CREATE_QUESTION"
  | "REVIEW_QUESTION"
  | "MANAGE_MEMBERS"
  | "CHANGE_ARCHIVE_STATE";

const EVENT_MANAGER_CAPABILITIES = new Set<EventSeriesCapability>([
  "VIEW",
  "EDIT",
  "MANAGE_QUIZZES",
  "CONTROL_LIVE",
  "CREATE_QUESTION",
  "REVIEW_QUESTION",
]);

const EVENT_EDITOR_CAPABILITIES = new Set<EventSeriesCapability>([
  "VIEW",
  "CREATE_QUESTION",
]);

export function isEventSeriesAssignmentRole(
  value: unknown,
): value is EventSeriesAssignmentRole {
  return value === "EVENT_MANAGER" || value === "EVENT_EDITOR";
}

export function hasEventSeriesCapability(input: {
  globalRole: string | null | undefined;
  assignmentRole: EventSeriesAssignmentRole | null | undefined;
  capability: EventSeriesCapability;
}) {
  if (input.globalRole === "ADMIN") return true;
  if (input.assignmentRole === "EVENT_MANAGER") {
    return EVENT_MANAGER_CAPABILITIES.has(input.capability);
  }
  if (input.assignmentRole === "EVENT_EDITOR") {
    return EVENT_EDITOR_CAPABILITIES.has(input.capability);
  }
  return false;
}

export function removingAssignmentLeavesNoEventManager(
  assignments: readonly { role: EventSeriesAssignmentRole }[],
  removedRole: EventSeriesAssignmentRole,
) {
  if (removedRole !== "EVENT_MANAGER") return false;
  return assignments.filter((assignment) => assignment.role === "EVENT_MANAGER").length <= 1;
}

import { isValidRoleAssignment } from "@/app/roles/roleAssignmentPolicy";

export type GlobalAssignmentRole = "ADMIN" | "EDITOR";

type GlobalAssignmentCandidate = {
  rolle: unknown;
  scope_typ: unknown;
  eventreihe_id: number | null;
};

export function getGlobalAssignmentRoles(
  assignments: readonly GlobalAssignmentCandidate[],
): GlobalAssignmentRole[] {
  return assignments.flatMap((assignment) => {
    const snapshot = {
      role: assignment.rolle,
      scopeType: assignment.scope_typ,
      eventSeriesId: assignment.eventreihe_id,
    };

    return isValidRoleAssignment(snapshot) &&
      snapshot.scopeType === "GLOBAL" &&
      (snapshot.role === "ADMIN" || snapshot.role === "EDITOR")
      ? [snapshot.role]
      : [];
  });
}

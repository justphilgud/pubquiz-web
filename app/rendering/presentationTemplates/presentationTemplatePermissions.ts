import { isAdministrator, type AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";

export type PresentationTemplateCapabilities = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canActivate: boolean;
  canDuplicateSystem: boolean;
  canAssign: boolean;
};

export function getPresentationTemplateCapabilities(
  actor: AuthorizationActor,
): PresentationTemplateCapabilities {
  const admin = isAdministrator(actor);
  return {
    canView: admin,
    canCreate: admin,
    canEdit: admin,
    canArchive: admin,
    canActivate: admin,
    canDuplicateSystem: admin,
    canAssign: admin,
  };
}

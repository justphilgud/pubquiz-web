import type {
  ManagedPresentationTemplate,
  PresentationTemplateStatus,
} from "./presentationTemplate";

export type PresentationTemplatePageMode =
  | "SYSTEM_READ_ONLY"
  | "DRAFT_EDIT"
  | "ACTIVE_READ_ONLY"
  | "ARCHIVED_READ_ONLY";

export function getPresentationTemplatePageMode(input: {
  isSystem: boolean;
  status: PresentationTemplateStatus | "SYSTEM";
}): PresentationTemplatePageMode {
  if (input.isSystem || input.status === "SYSTEM") return "SYSTEM_READ_ONLY";
  if (input.status === "DRAFT") return "DRAFT_EDIT";
  if (input.status === "ACTIVE") return "ACTIVE_READ_ONLY";
  return "ARCHIVED_READ_ONLY";
}

export function canEditPresentationTemplate(input: {
  isSystem: boolean;
  status: PresentationTemplateStatus | "SYSTEM";
}) {
  return getPresentationTemplatePageMode(input) === "DRAFT_EDIT";
}

export function requiresDraftRevision(input: {
  isSystem: boolean;
  status: PresentationTemplateStatus | "SYSTEM";
}) {
  return !input.isSystem && input.status === "ACTIVE";
}

export function canArchivePresentationTemplate(
  input: Pick<ManagedPresentationTemplate, "isSystem" | "status" | "usageCount">,
) {
  return !input.isSystem && input.status !== "ARCHIVED" && input.usageCount === 0;
}

export function canAssignPresentationTemplate(
  status: PresentationTemplateStatus | "SYSTEM",
) {
  return status === "ACTIVE" || status === "SYSTEM";
}

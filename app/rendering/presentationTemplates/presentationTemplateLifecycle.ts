import type {
  ManagedPresentationTemplate,
  PresentationTemplateStatus,
} from "./presentationTemplate";

export function canEditPresentationTemplate(input: {
  isSystem: boolean;
  status: PresentationTemplateStatus | "SYSTEM";
}) {
  return !input.isSystem && input.status === "DRAFT";
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

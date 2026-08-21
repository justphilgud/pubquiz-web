import type { EventSeriesInput } from "./eventSeriesPolicy";

function stringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function eventSeriesInputFromFormData(
  formData: FormData,
): EventSeriesInput {
  return {
    name: stringField(formData, "name"),
    publicName: stringField(formData, "publicName"),
    description: stringField(formData, "description"),
    internalNote: stringField(formData, "internalNote"),
    isPublic: formData.get("isPublic") === "true",
    defaultPresentationTemplateId: stringField(
      formData,
      "defaultPresentationTemplateId",
    ),
  };
}

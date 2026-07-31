import {
  buildBlobPath,
  type BlobEnvironmentPrefix,
} from "@/app/lib/blobPath";
import type {
  PresentationDesignStyle,
  TemplateAssetReference,
} from "@/app/rendering/templateRegistry";

export const presentationTemplateAssetRoles = [
  "LOGO",
  "BACKGROUND",
  "HERO_IMAGE",
  "SOLUTION_IMAGE",
  "IMAGE_POOL",
  "DECORATION",
] as const;

export type PresentationTemplateAssetRole =
  (typeof presentationTemplateAssetRoles)[number];

export type PresentationTemplateAssetRoleDefinition = {
  role: PresentationTemplateAssetRole;
  label: string;
  helpText: string;
  multiple: boolean;
};

export const presentationTemplateAssetRolesByStyle: Record<
  PresentationDesignStyle,
  readonly PresentationTemplateAssetRoleDefinition[]
> = {
  NEON: [
    { role: "LOGO", label: "Logo", helpText: "Marke im Show-Header.", multiple: false },
    { role: "HERO_IMAGE", label: "Key Visual", helpText: "Zentrales Bühnenmotiv oder Medienvisual.", multiple: false },
    { role: "BACKGROUND", label: "Bühnenhintergrund", helpText: "Optionales großflächiges Hintergrundbild.", multiple: false },
    { role: "DECORATION", label: "Show-Dekoration", helpText: "Zusätzliche Motive für die Bühnenwelt.", multiple: true },
  ],
  CORPORATE: [
    { role: "LOGO", label: "Unternehmenslogo", helpText: "Ruhige Markenkennung im Kopfbereich.", multiple: false },
    { role: "HERO_IMAGE", label: "Markenbild", helpText: "Breites Kampagnen- oder Veranstaltungsbild.", multiple: false },
    { role: "BACKGROUND", label: "Hintergrund", helpText: "Optionales zurückhaltendes Hintergrundmotiv.", multiple: false },
    { role: "DECORATION", label: "Grafische Elemente", helpText: "Optionale geometrische Markenbilder.", multiple: true },
  ],
  BIRTHDAY: [
    { role: "LOGO", label: "Anlass-Signet", helpText: "Optionales persönliches Signet oder Monogramm.", multiple: false },
    { role: "HERO_IMAGE", label: "Hauptbild", helpText: "Das prägende Foto der Titelseite.", multiple: false },
    { role: "IMAGE_POOL", label: "Erinnerungsalbum", helpText: "Bilderpool für deterministische Collagen.", multiple: true },
    { role: "SOLUTION_IMAGE", label: "Auflösungsbild", helpText: "Besonderes Erinnerungsfoto für Lösungen.", multiple: false },
    { role: "DECORATION", label: "Album-Dekoration", helpText: "Optionale Papier-, Karten- oder Erinnerungsmotive.", multiple: true },
  ],
};

const localAssetPattern = /^\/(?!\/)[a-zA-Z0-9%() _./-]+\.(?:png|jpe?g|webp|svg)$/i;
const managedBlobPattern = /^https:\/\/[a-zA-Z0-9.-]+\.blob\.vercel-storage\.com\/[a-zA-Z0-9%()_./-]+\.(?:png|jpe?g|webp)$/i;
const uploadExtensions = ["png", "jpg", "jpeg", "webp"] as const;
const uploadMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;

export const presentationTemplateAssetUploadRule = {
  extensions: uploadExtensions,
  mimeTypes: uploadMimeTypes,
  maximumSizeInBytes: 10 * 1024 * 1024,
  accept: uploadMimeTypes.join(","),
  sizeLabel: "10 MB",
} as const;

export function isSafeTemplateAssetReference(
  value: unknown,
): value is TemplateAssetReference {
  return (
    typeof value === "string" &&
    (localAssetPattern.test(value) || managedBlobPattern.test(value))
  );
}

export function buildPresentationTemplateAssetPathname(
  environmentPrefix: BlobEnvironmentPrefix,
  templateId: string,
  role: PresentationTemplateAssetRole,
  fileName: string,
) {
  return buildBlobPath(environmentPrefix, "template-media", [
    templateId,
    role.toLowerCase(),
    fileName,
  ]);
}

export function isAllowedPresentationTemplateAssetPathname(
  pathname: string,
  environmentPrefix: BlobEnvironmentPrefix,
  templateId: string,
  role: PresentationTemplateAssetRole,
) {
  const prefix = `${buildBlobPath(environmentPrefix, "template-media", [templateId, role.toLowerCase()])}/`;
  const extension = pathname.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  return Boolean(
    pathname.startsWith(prefix) &&
      extension &&
      uploadExtensions.includes(extension as (typeof uploadExtensions)[number]),
  );
}

export function isPresentationTemplateAssetRole(
  value: unknown,
): value is PresentationTemplateAssetRole {
  return presentationTemplateAssetRoles.includes(
    value as PresentationTemplateAssetRole,
  );
}

export function validatePresentationTemplateAssetFile(
  file: Pick<File, "name" | "size" | "type">,
) {
  const extension = file.name.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  if (!extension || !uploadExtensions.includes(extension as (typeof uploadExtensions)[number])) {
    return "Erlaubt sind PNG, JPG, JPEG und WebP.";
  }
  if (!uploadMimeTypes.includes(file.type.toLowerCase() as (typeof uploadMimeTypes)[number])) {
    return "Der Dateityp wird nicht unterstützt.";
  }
  if (file.size > presentationTemplateAssetUploadRule.maximumSizeInBytes) {
    return `Das Bild darf höchstens ${presentationTemplateAssetUploadRule.sizeLabel} groß sein.`;
  }
  return null;
}

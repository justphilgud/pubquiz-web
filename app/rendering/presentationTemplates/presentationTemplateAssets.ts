import {
  buildBlobPath,
  isSafeBlobPathSegment,
  type BlobEnvironmentPrefix,
} from "@/app/lib/blobPath";
import type {
  PresentationDesignStyle,
  PresentationTemplate,
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

export type PresentationTemplateRuntimeAssets = {
  logo: TemplateAssetReference | null;
  backgroundImage: TemplateAssetReference | null;
  heroImage: TemplateAssetReference | null;
  solutionImage: TemplateAssetReference | null;
  personalImagePool: TemplateAssetReference[];
  decorativeImages: TemplateAssetReference[];
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
    { role: "IMAGE_POOL", label: "Bildarchiv", helpText: "Kuratierte Bilder für deterministische Storybook-Seiten.", multiple: true },
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

/**
 * Normalizes persisted template media into the single asset contract consumed
 * by both the generator preview and the productive presentation renderer.
 */
export function resolvePresentationTemplateRuntimeAssets(
  template: Pick<PresentationTemplate, "tokens" | "design">,
): PresentationTemplateRuntimeAssets {
  const safeReference = (value: unknown) =>
    isSafeTemplateAssetReference(value) ? value : null;
  const safeReferences = (values: readonly unknown[]) =>
    values.filter(isSafeTemplateAssetReference);

  return {
    logo: safeReference(template.tokens.assets.logo),
    backgroundImage: safeReference(template.tokens.assets.backgroundImage),
    heroImage: safeReference(template.design.imagery.heroImage),
    solutionImage: safeReference(template.design.imagery.solutionImage),
    personalImagePool: safeReferences(template.design.imagery.personalImagePool),
    decorativeImages: safeReferences(template.design.imagery.decorativeImages),
  };
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
  const fileName = pathname.slice(prefix.length);
  const extension = pathname.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  return Boolean(
    pathname.startsWith(prefix) &&
      isSafeBlobPathSegment(fileName) &&
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

export function applyPresentationTemplateAssetUpload(
  current: TemplateAssetReference | TemplateAssetReference[] | null,
  multiple: boolean,
  reference: TemplateAssetReference,
) {
  return multiple && Array.isArray(current)
    ? [...current, reference]
    : reference;
}

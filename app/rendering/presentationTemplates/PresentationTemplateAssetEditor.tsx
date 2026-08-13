"use client";
/* eslint-disable @next/next/no-img-element -- Blob URLs are selected at runtime and previewed before persistence. */

import { uploadPresigned } from "@vercel/blob/client";
import { useState } from "react";

import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import type { PresentationDesignStyle, TemplateAssetReference } from "@/app/rendering/templateRegistry";
import { FileUpload } from "@/components/ui";
import {
  buildPresentationTemplateAssetPathname,
  presentationTemplateAssetRolesByStyle,
  presentationTemplateAssetUploadRule,
  validatePresentationTemplateAssetFile,
  type PresentationTemplateAssetRole,
} from "./presentationTemplateAssets";

export type PresentationTemplateAssetValues = {
  logo: TemplateAssetReference | null;
  backgroundImage: TemplateAssetReference | null;
  heroImage: TemplateAssetReference | null;
  solutionImage: TemplateAssetReference | null;
  personalImagePool: TemplateAssetReference[];
  decorativeImages: TemplateAssetReference[];
};

type Props = {
  style: PresentationDesignStyle;
  values: PresentationTemplateAssetValues;
  templateId: string | null;
  environmentPrefix: BlobEnvironmentPrefix;
  uploadsEnabled: boolean;
  uploadDisabledReason: string;
  onFocusRole: (role: PresentationTemplateAssetRole | null) => void;
  onChange: (role: PresentationTemplateAssetRole, value: TemplateAssetReference | TemplateAssetReference[] | null) => void;
};

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "") || "template-bild";
}

function roleValue(values: PresentationTemplateAssetValues, role: PresentationTemplateAssetRole) {
  if (role === "LOGO") return values.logo;
  if (role === "BACKGROUND") return values.backgroundImage;
  if (role === "HERO_IMAGE") return values.heroImage;
  if (role === "SOLUTION_IMAGE") return values.solutionImage;
  if (role === "IMAGE_POOL") return values.personalImagePool;
  return values.decorativeImages;
}

export function PresentationTemplateAssetEditor({
  style,
  values,
  templateId,
  environmentPrefix,
  uploadsEnabled,
  uploadDisabledReason,
  onFocusRole,
  onChange,
}: Props) {
  const [uploadingRole, setUploadingRole] = useState<PresentationTemplateAssetRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const effectiveUploadEnabled = uploadsEnabled && Boolean(templateId);

  async function upload(role: PresentationTemplateAssetRole, multiple: boolean, file: File) {
    const validationError = validatePresentationTemplateAssetFile(file);
    if (validationError) return setError(validationError);
    if (!templateId || !effectiveUploadEnabled) {
      setError(templateId ? uploadDisabledReason : "Speichere den Entwurf zuerst, bevor du Bilder hochlädst.");
      return;
    }

    setUploadingRole(role);
    setError(null);
    try {
      const pathname = buildPresentationTemplateAssetPathname(
        environmentPrefix,
        templateId,
        role,
        `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`,
      );
      const blob = await uploadPresigned(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/question-media-upload",
        clientPayload: JSON.stringify({ target: "TEMPLATE", templateId, assetRole: role }),
      });
      const reference = blob.url as TemplateAssetReference;
      const current = roleValue(values, role);
      onChange(role, multiple && Array.isArray(current) ? [...current, reference] : reference);
    } catch {
      setError("Das Bild konnte nicht hochgeladen werden. Bitte erneut versuchen.");
    } finally {
      setUploadingRole(null);
    }
  }

  return (
    <div className="space-y-4">
      {presentationTemplateAssetRolesByStyle[style].map((definition) => {
        const value = roleValue(values, definition.role);
        const references = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <section
            key={definition.role}
            data-template-asset-role={definition.role}
            onFocus={() => onFocusRole(definition.role)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) onFocusRole(null);
            }}
            onMouseEnter={() => onFocusRole(definition.role)}
            onMouseLeave={() => onFocusRole(null)}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{definition.label}</h3>
                <p className="text-sm text-slate-600">{definition.helpText}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {definition.multiple ? `${references.length} Bilder` : references.length > 0 ? "Hinterlegt" : "Optional"}
              </span>
            </div>

            {references.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {references.map((reference, index) => (
                  <figure key={`${reference}-${index}`} className="overflow-hidden rounded-xl border bg-slate-50">
                    <img src={reference} alt={`${definition.label} ${index + 1}`} className="aspect-video w-full object-cover" />
                    <figcaption className="flex flex-wrap gap-1 p-2">
                      {definition.multiple && index > 0 && (
                        <button type="button" onClick={() => {
                          const reordered = [...references];
                          [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
                          onChange(definition.role, reordered);
                        }} className="min-h-9 rounded-lg border px-2 text-xs font-semibold" aria-label={`${definition.label} nach vorne`}>
                          ←
                        </button>
                      )}
                      {definition.multiple && index < references.length - 1 && (
                        <button type="button" onClick={() => {
                          const reordered = [...references];
                          [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
                          onChange(definition.role, reordered);
                        }} className="min-h-9 rounded-lg border px-2 text-xs font-semibold" aria-label={`${definition.label} nach hinten`}>
                          →
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onChange(
                          definition.role,
                          definition.multiple ? references.filter((_, itemIndex) => itemIndex !== index) : null,
                        )}
                        className="min-h-9 rounded-lg border border-red-200 px-2 text-xs font-semibold text-red-700"
                      >
                        Entfernen
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onFocusRole(definition.role)}
                className="mt-3 min-h-20 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-600"
              >
                Zielbereich in der Vorschau zeigen
              </button>
            )}

            <FileUpload
              compact
              accept={presentationTemplateAssetUploadRule.accept}
              disabled={!effectiveUploadEnabled || uploadingRole !== null}
              label={uploadingRole === definition.role
                ? "Wird hochgeladen …"
                : definition.multiple
                  ? "Bild hinzufügen"
                  : references.length > 0 ? "Bild ersetzen" : "Bild hochladen"}
              description={`PNG, JPG oder WebP · maximal ${presentationTemplateAssetUploadRule.sizeLabel}`}
              className="mt-3"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(definition.role, definition.multiple, file);
                event.currentTarget.value = "";
              }}
            />
          </section>
        );
      })}

      {!effectiveUploadEnabled && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Upload derzeit nicht verfügbar.</strong>{" "}
          {templateId ? uploadDisabledReason : "Speichere das neue Template einmal als Entwurf, um Bilder hochzuladen."}
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element -- The editor previews user-selected repository or managed Blob asset URLs before persistence. */

import { uploadPresigned } from "@vercel/blob/client";
import { useState } from "react";

import { FileUpload } from "@/components/ui";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import type {
  PresentationDesignStyle,
  TemplateAssetReference,
} from "@/app/rendering/templateRegistry";
import {
  buildPresentationTemplateAssetPathname,
  presentationTemplateAssetRolesByStyle,
  presentationTemplateAssetUploadRule,
  validatePresentationTemplateAssetFile,
  type PresentationTemplateAssetRole,
} from "./presentationTemplateAssets";

export type PresentationTemplateAssetValues = {
  logo: TemplateAssetReference;
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
  onChange: (
    role: PresentationTemplateAssetRole,
    value: TemplateAssetReference | TemplateAssetReference[] | null,
  ) => void;
};

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "") || "template-bild"
  );
}

function roleValue(
  values: PresentationTemplateAssetValues,
  role: PresentationTemplateAssetRole,
) {
  if (role === "LOGO") return values.logo;
  if (role === "BACKGROUND") return values.backgroundImage;
  if (role === "HERO_IMAGE") return values.heroImage;
  if (role === "SOLUTION_IMAGE") return values.solutionImage;
  if (role === "IMAGE_POOL") return values.personalImagePool;
  return values.decorativeImages;
}

function splitReferences(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean) as TemplateAssetReference[];
}

export function PresentationTemplateAssetEditor({
  style,
  values,
  templateId,
  environmentPrefix,
  uploadsEnabled,
  uploadDisabledReason,
  onChange,
}: Props) {
  const [uploadingRole, setUploadingRole] =
    useState<PresentationTemplateAssetRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const effectiveUploadEnabled = uploadsEnabled && Boolean(templateId);

  async function upload(
    role: PresentationTemplateAssetRole,
    multiple: boolean,
    file: File,
  ) {
    const validationError = validatePresentationTemplateAssetFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!templateId || !effectiveUploadEnabled) {
      setError(
        templateId
          ? uploadDisabledReason
          : "Speichere den Entwurf zuerst, bevor du Bilder hochlädst.",
      );
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
        clientPayload: JSON.stringify({
          target: "TEMPLATE",
          templateId,
          assetRole: role,
        }),
      });
      const reference = blob.url as TemplateAssetReference;
      const current = roleValue(values, role);
      onChange(
        role,
        multiple && Array.isArray(current)
          ? [...current, reference]
          : reference,
      );
    } catch {
      setError("Das Bild konnte nicht hochgeladen werden. Bitte erneut versuchen.");
    } finally {
      setUploadingRole(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-bold">Bildwelt für {style === "NEON" ? "ungegoogelt" : style === "CORPORATE" ? "Corporate" : "Storybook"}</h3>
        <p className="mt-1 text-sm text-slate-600">
          Jede Designwelt verwendet Bilder in eigenen Rollen und Kompositionen.
          Repository-Pfade funktionieren sofort; Uploads verwenden ausschließlich
          die bestehende zentrale Medienroute.
        </p>
      </div>

      {presentationTemplateAssetRolesByStyle[style].map((definition) => {
        const value = roleValue(values, definition.role);
        const references = Array.isArray(value)
          ? value
          : value
            ? [value]
            : [];
        return (
          <section
            key={definition.role}
            data-template-asset-role={definition.role}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-bold">{definition.label}</h4>
                <p className="text-sm text-slate-600">{definition.helpText}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {definition.multiple ? "Bilderpool" : "Einzelbild"}
              </span>
            </div>

            {references.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {references.slice(0, 8).map((reference, index) => (
                  <figure key={`${reference}-${index}`} className="overflow-hidden rounded-lg border bg-slate-100">
                    <img src={reference} alt="" className="aspect-video w-full object-cover" />
                  </figure>
                ))}
              </div>
            )}

            {definition.multiple ? (
              <label className="mt-3 block text-sm font-semibold">
                Bildpfade, je Zeile
                <textarea
                  value={(value as TemplateAssetReference[]).join("\n")}
                  onChange={(event) =>
                    onChange(definition.role, splitReferences(event.target.value))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-xl border p-3 font-mono text-xs"
                />
              </label>
            ) : (
              <label className="mt-3 block text-sm font-semibold">
                Bildpfad
                <input
                  value={(value as TemplateAssetReference | null) ?? ""}
                  onChange={(event) =>
                    onChange(
                      definition.role,
                      event.target.value
                        ? (event.target.value as TemplateAssetReference)
                        : null,
                    )
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono text-xs"
                  placeholder="/medien/bilder/..."
                />
              </label>
            )}

            <FileUpload
              compact
              accept={presentationTemplateAssetUploadRule.accept}
              disabled={!effectiveUploadEnabled || uploadingRole !== null}
              label={
                uploadingRole === definition.role
                  ? "Wird hochgeladen …"
                  : definition.multiple
                    ? "Bild zum Pool hinzufügen"
                    : "Eigenes Bild hochladen"
              }
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
          <strong>Echte Uploads sind bewusst deaktiviert.</strong>{" "}
          {templateId
            ? uploadDisabledReason
            : "Neue Templates müssen zuerst als Entwurf gespeichert werden."}{" "}
          Repository-relative Bilder können bereits vollständig gestaltet und
          in allen Vorschauen getestet werden.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

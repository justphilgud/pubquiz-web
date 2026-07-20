import type { RenderingMessages } from "@/app/i18n/renderingMessages";
import type {
  AnswerFormTemplate,
  PresentationTemplate,
} from "./templateRegistry";

export function TemplatePreview({
  template,
  messages,
}: {
  template: PresentationTemplate | AnswerFormTemplate;
  messages: RenderingMessages;
}) {
  const copy = messages.templates[template.labelKey];
  const colors = template.tokens.colors;

  return (
    <div
      className="min-w-0 rounded-2xl border p-4"
      style={{
        color: colors.text,
        background: colors.background,
        borderColor: colors.border,
        borderRadius: template.tokens.radii.medium,
        fontFamily: template.tokens.typography.family,
      }}
      aria-label={`${messages.fields.preview}: ${copy.label}`}
    >
      <div
        className="rounded-xl border p-3"
        style={{ background: colors.surface, borderColor: colors.border }}
      >
        <div className="break-words font-bold">{copy.label}</div>
        <div className="mt-1 break-words text-sm" style={{ color: colors.textMuted }}>
          {copy.description}
        </div>
        <span
          className="mt-3 inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: colors.primary, color: colors.surface }}
        >
          {messages.fields.previewButton}
        </span>
      </div>
    </div>
  );
}

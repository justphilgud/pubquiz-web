import { Badge } from "@/components/ui/Badge";
import type { QuestionReviewStatus } from "@/app/generated/prisma/enums";

const statusPresentation = {
  DRAFT: { label: "Entwurf", variant: "default" },
  IN_REVIEW: { label: "In Prüfung", variant: "warning" },
  CHANGES_REQUESTED: {
    label: "Überarbeitung erforderlich",
    variant: "danger",
  },
  APPROVED: { label: "Freigegeben", variant: "success" },
} as const satisfies Record<
  QuestionReviewStatus,
  { label: string; variant: "default" | "success" | "warning" | "danger" }
>;

export function QuestionStatusBadge({
  status,
}: {
  status: QuestionReviewStatus;
}) {
  const presentation = statusPresentation[status];

  return (
    <Badge variant={presentation.variant}>{presentation.label}</Badge>
  );
}

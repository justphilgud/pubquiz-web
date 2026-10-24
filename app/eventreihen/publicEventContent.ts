/** Shared by editors and the public projection. Never reads internal notes. */
export function publicHttpUrl(value: string | null | undefined) {
  if (!value || /[\r\n]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export type PublicEventContent = {
  reservationUrl?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  descriptionMode?: string | null;
};

export function resolvePublicEventContent(
  series: { reservationUrl?: string | null; logoUrl?: string | null; description?: string | null },
  quiz: PublicEventContent,
) {
  const ownReservation = publicHttpUrl(quiz.reservationUrl?.trim());
  const ownImage = publicHttpUrl(quiz.imageUrl);
  const base = series.description?.trim() || null;
  const own = quiz.description?.trim() || null;
  return {
    reservationUrl: ownReservation ?? publicHttpUrl(series.reservationUrl?.trim()),
    reservationSource: ownReservation ? "QUIZ" as const : "SERIES" as const,
    imageUrl: ownImage ?? publicHttpUrl(series.logoUrl),
    imageSource: ownImage ? "QUIZ" as const : "SERIES" as const,
    description: !own ? base : quiz.descriptionMode === "REPLACE" ? own : [base, own].filter(Boolean).join("\n\n"),
  };
}

export const BOOKING_LIMITS = { headline: 90, subheadline: 140, description: 320, cta: 90, phone: 40, email: 120, instagram: 31, qrUrl: 500, benefits: 240 } as const;
export type BookingContent = Record<keyof typeof BOOKING_LIMITS, string>;
export const DEFAULT_BOOKING: BookingContent = {
  headline: "Euer Anlass. Unser Quiz.",
  subheadline: "Ein Abend, der Menschen zusammenbringt.",
  description: "Ob Firmenfeier, Teamevent oder privater Anlass: Wir gestalten einen Quizabend für euch.",
  cta: "Jetzt euren Quizabend anfragen",
  phone: "", email: "", instagram: "@ungegoogelt",
  qrUrl: "https://www.instagram.com/ungegoogelt/",
  benefits: "Gemeinsam rätseln\nPersönlich moderiert\nPassend zu eurem Anlass",
};
export function validateBooking(input: unknown): { ok: true; value: BookingContent } | { ok: false; message: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, message: "Buchungsinhalte fehlen." };
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => !Object.hasOwn(BOOKING_LIMITS, key))) return { ok: false, message: "Unbekanntes Buchungsfeld." };
  const content = { ...DEFAULT_BOOKING };
  for (const key of Object.keys(BOOKING_LIMITS) as (keyof BookingContent)[]) {
    const value = values[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim().length > BOOKING_LIMITS[key]) return { ok: false, message: `Buchungsfeld ${key} ist ungültig oder zu lang.` };
    content[key] = value.replace(/\r\n?/g, "\n").trim();
  }
  if (content.qrUrl) {
    try {
      const url = new URL(content.qrUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    } catch { return { ok: false, message: "Das QR-Ziel muss eine vollständige HTTPS-Adresse ohne Zugangsdaten sein." }; }
  }
  if (content.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)) return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
  if (content.phone && !/^[+()\d\s./-]+$/.test(content.phone)) return { ok: false, message: "Bitte eine gültige Telefonnummer angeben." };
  if (content.instagram && !/^@?[a-zA-Z0-9._]{1,30}$/.test(content.instagram)) return { ok: false, message: "Instagram als Profilname angeben, beispielsweise @ungegoogelt." };
  if (content.instagram && !content.instagram.startsWith("@")) content.instagram = `@${content.instagram}`;
  if (content.benefits.split("\n").filter(Boolean).length > 3) return { ok: false, message: "Höchstens drei Nutzenhinweise verwenden." };
  return { ok: true, value: content };
}

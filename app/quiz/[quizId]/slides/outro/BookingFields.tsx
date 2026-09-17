import { BOOKING_LIMITS, DEFAULT_BOOKING, type BookingContent } from "@/app/quiz/bookingSlide";

const fields: { key: keyof BookingContent; label: string; multiline?: boolean }[] = [
  { key: "headline", label: "Headline" },
  { key: "subheadline", label: "Subheadline" },
  { key: "description", label: "Beschreibung", multiline: true },
  { key: "cta", label: "CTA / Aufruf" },
  { key: "phone", label: "Telefon (optional)" },
  { key: "email", label: "E-Mail (optional)" },
  { key: "instagram", label: "Instagram" },
  { key: "qrUrl", label: "QR-Ziel (HTTPS)" },
  { key: "benefits", label: "Nutzenhinweise (höchstens drei, einer pro Zeile)", multiline: true },
];
export function BookingFields({ content = DEFAULT_BOOKING }: { content?: BookingContent }) {
  return <div className="grid gap-5 md:grid-cols-2">{fields.map(({ key, label, multiline }) => <label key={key} className={`grid gap-2 text-sm font-semibold ${multiline ? "md:col-span-2" : ""}`}>
    {label}
    {multiline ? <textarea name={`booking_${key}`} defaultValue={content[key]} maxLength={BOOKING_LIMITS[key]} rows={3} className="rounded-xl border border-slate-300 px-4 py-3 font-normal" />
      : <input name={`booking_${key}`} defaultValue={content[key]} maxLength={BOOKING_LIMITS[key]} type={key === "email" ? "email" : key === "qrUrl" ? "url" : "text"} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 font-normal" />}
  </label>)}<p className="text-sm font-normal text-slate-600 md:col-span-2">Leere Felder werden ausgeblendet. Der QR-Code verwendet exakt das gespeicherte Ziel; bei leerem Ziel erscheint kein QR-Code. Die Folie öffnet keine Antwortphase und startet keinen Countdown.</p></div>;
}

import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_BOOKING, validateBooking } from "./bookingSlide";
import { BookingSlide } from "../rendering/presentation/BookingSlide";
import { getQuizFlowAnswerStatus, parseStoredQuizFlowItem, validateQuizFlowConfig } from "./flow/quizFlow";

test("booking defaults include Instagram but no invented phone/email", () => {
  assert.equal(DEFAULT_BOOKING.instagram, "@ungegoogelt");
  assert.equal(DEFAULT_BOOKING.phone, "");
  assert.equal(DEFAULT_BOOKING.email, "");
  assert.deepEqual(validateBooking({}), { ok: true, value: DEFAULT_BOOKING });
});
test("empty booking fields remain empty rather than being replaced by defaults", () => {
  const empty = Object.fromEntries(Object.keys(DEFAULT_BOOKING).map(key => [key, ""]));
  const parsed = validateBooking(empty);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value, empty);
  const markup = renderToStaticMarkup(<BookingSlide content={parsed.value} />);
  assert.doesNotMatch(markup, /<svg|Instagram ·|Telefon ·|E-Mail ·/);
});
test("QR target rejects unsafe URLs and credentials; optional contacts are validated", () => {
  for (const qrUrl of ["javascript:alert(1)", "http://example.com", "//example.com", "https://a:secret@example.com"]) assert.equal(validateBooking({ qrUrl }).ok, false);
  assert.equal(validateBooking({ qrUrl: "https://example.com/booking?event=quiz" }).ok, true);
  for (const data of [{ email: "invalid" }, { phone: "call me" }, { instagram: "https://instagram.com/ungegoogelt" }, { headline: "x".repeat(91) }, { benefits: "a\nb\nc\nd" }, { constructor: "unexpected" }]) assert.equal(validateBooking(data).ok, false);
  const parsed = validateBooking({ instagram: "ungegoogelt" });
  assert.ok(parsed.ok); if (parsed.ok) assert.equal(parsed.value.instagram, "@ungegoogelt");
});
test("booking JSON is preserved through storage reload, independently of other slides", () => {
  const booking = { ...DEFAULT_BOOKING, headline: "Individuelles Teamquiz", phone: "+49 123 456", email: "quiz@example.com", qrUrl: "https://example.com/quiz" };
  const parsed = parseStoredQuizFlowItem({ quiz_ablauf_element_id: 123, typ: "BOOKING_CONTACT", anker_typ: "AFTER_QUIZ", anker_schluessel: "QUIZ", quiz_abschnitt_id: null, sortierung: 60, ist_sichtbar: true, bezeichnung: null, konfiguration: JSON.parse(JSON.stringify({ version: 1, booking })), ist_standard: true });
  assert.deepEqual(parsed?.config.booking, booking);
  assert.equal(parsed?.enabled, true);
  assert.equal(validateQuizFlowConfig("CLOSING", { version: 1, booking }).ok, false);
  assert.equal(getQuizFlowAnswerStatus("BOOKING_CONTACT"), "Das Quiz ist beendet");
});
test("renderer uses dynamic QR content and safely renders optional text", () => {
  const markup = renderToStaticMarkup(<BookingSlide content={{ ...DEFAULT_BOOKING, phone: "+49 123 456", email: "quiz@example.com", headline: "<script>not HTML</script>" }} />);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /Telefon ·/); assert.match(markup, /E-Mail ·/);
  const other = renderToStaticMarkup(<BookingSlide content={{ ...DEFAULT_BOOKING, qrUrl: "https://example.com/another-target" }} />);
  assert.notEqual(markup.match(/<svg[\s\S]*?<\/svg>/)?.[0], other.match(/<svg[\s\S]*?<\/svg>/)?.[0]);
  assert.match(other, /https:\/\/example.com\/another-target/);
});

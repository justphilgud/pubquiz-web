import QRCode from "react-qr-code";
import { DEFAULT_BOOKING, type BookingContent } from "@/app/quiz/bookingSlide";

export function BookingSlide({ content = DEFAULT_BOOKING }: { content?: BookingContent }) {
  return <section className="presentation-flow-slide booking-slide" data-flow-type="BOOKING_CONTACT">
    <div className="booking-copy">
      <p className="presentation-flow-kicker">Quizabend buchen</p>
      {content.headline && <h2>{content.headline}</h2>}
      {content.subheadline && <p className="booking-subheadline">{content.subheadline}</p>}
      {content.description && <p className="booking-description">{content.description}</p>}
      {content.benefits && <ul className="booking-benefits">{content.benefits.split("\n").filter(Boolean).map((text, index) => <li key={index}>{text}</li>)}</ul>}
      <div className="booking-contact">
        {content.phone && <p>Telefon · {content.phone}</p>}
        {content.email && <p>E-Mail · {content.email}</p>}
        {content.instagram && <p>Instagram · {content.instagram}</p>}
      </div>
    </div>
    {(content.qrUrl || content.cta) && <aside className="booking-action">
      {content.qrUrl && <div className="booking-qr"><QRCode value={content.qrUrl} size={400} level="M" title="Kontakt für euren Quizabend" /></div>}
      {content.cta && <p className="booking-cta">{content.cta}</p>}
      {content.qrUrl && <p className="booking-url">{content.qrUrl}</p>}
    </aside>}
  </section>;
}

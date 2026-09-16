/* eslint-disable @next/next/no-img-element -- Sponsor logos use the existing managed asset contract. */
import type { QuestionSponsor } from "./questionSponsor";

export function QuestionSponsorMark({ sponsor }: { sponsor: QuestionSponsor }) {
  return <aside className="presentation-question-sponsor" aria-label="Sponsor dieser Frage">
    {sponsor.line && <span>{sponsor.line}</span>}
    <img src={sponsor.logo} alt="Sponsorlogo" />
  </aside>;
}

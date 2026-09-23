import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { MemePresentationSnapshot } from "@/app/quiz/memeVoting.server";
import { MemePresentationStage } from "./MemePresentationStage";

function snapshot(
  phase: MemePresentationSnapshot["phase"],
  candidateCount: number,
  overviewPage = 0,
): MemePresentationSnapshot {
  return {
    phase,
    presentationId: 7,
    selectionId: 8,
    quizFragenId: 9,
    revision: 3,
    imageUrl: "/medien/meme.webp",
    candidates: Array.from({ length: candidateCount }, (_, index) => ({
      candidateId: 100 + index,
      number: index + 1,
      topText: `Oben ${index + 1}`,
      bottomText: `Unten ${index + 1}`,
    })),
    activeCandidateNumber: phase === "PRESENTING" ? 2 : null,
    overviewPage,
    overviewPageCount: Math.max(1, Math.ceil(candidateCount / 4)),
    votingOpenedAt: phase === "VOTING_OPEN" ? "2026-09-23T20:00:00.000Z" : null,
    votingClosedAt: phase === "VOTING_CLOSED" ? "2026-09-23T20:01:00.000Z" : null,
    progress: null,
    result: null,
    team: null,
  };
}

test("AP3 presentation renders the active stable number anonymously with the shared meme", () => {
  const html = renderToStaticMarkup(
    createElement(MemePresentationStage, { state: snapshot("PRESENTING", 4) }),
  );
  assert.match(html, /Meme 2/);
  assert.match(html, /Oben 2/);
  assert.match(html, /Unten 2/);
  assert.doesNotMatch(html, /Oben 1|Oben 3|Team|Stimmen|Prozent|Ranking/);
});

test("AP3 overview paginates eight and eleven candidates without truncating later pages", () => {
  const secondOfEight = renderToStaticMarkup(
    createElement(MemePresentationStage, { state: snapshot("OVERVIEW", 8, 1) }),
  );
  assert.match(secondOfEight, /Seite 2 \/ 2/);
  for (const number of [5, 6, 7, 8]) assert.match(secondOfEight, new RegExp(`Meme ${number}`));
  assert.doesNotMatch(secondOfEight, /Meme 1(?!\d)|Meme 2(?!\d)|Meme 3(?!\d)|Meme 4(?!\d)/);

  const thirdOfEleven = renderToStaticMarkup(
    createElement(MemePresentationStage, { state: snapshot("OVERVIEW", 11, 2) }),
  );
  assert.match(thirdOfEleven, /Seite 3 \/ 3/);
  for (const number of [9, 10, 11]) assert.match(thirdOfEleven, new RegExp(`Meme ${number}(?!\d)`));
});

test("AP3 open and closed voting never render candidate results", () => {
  for (const phase of ["VOTING_OPEN", "VOTING_CLOSED"] as const) {
    const html = renderToStaticMarkup(
      createElement(MemePresentationStage, { state: snapshot(phase, 4) }),
    );
    assert.match(html, phase === "VOTING_OPEN" ? /Jetzt abstimmen/ : /Voting geschlossen/);
    assert.doesNotMatch(html, /\d+\s+Stimmen|Prozent|Ranking|Gewinner|Teamname/);
  }
});

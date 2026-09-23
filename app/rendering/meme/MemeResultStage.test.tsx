import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { MemeResultSnapshot } from "@/app/quiz/memeResults.server";
import { MemeResultStage } from "./MemeResultStage";

function result(votes: number[]): MemeResultSnapshot {
  const maximum = Math.max(0, ...votes);
  const total = votes.reduce((sum, value) => sum + value, 0);
  return {
    presentationId: 1,
    quizFragenId: 2,
    finalizedAt: "2026-09-23T21:00:00.000Z",
    revision: 1,
    totalVotes: total,
    maximumVotes: maximum,
    pageCount: Math.max(1, Math.ceil(votes.length / 4)),
    entries: votes.map((voteCount, index) => ({
      candidateId: index + 1,
      number: index + 1,
      topText: `Oben ${index + 1}`,
      bottomText: `Unten ${index + 1}`,
      teamName: `Team ${index + 1}`,
      avatarCode: "teekanne",
      photoUrl: null,
      voteCount,
      share: total === 0 ? 0 : (voteCount / total) * 100,
      isWinner: maximum > 0 && voteCount === maximum,
      awardedPoints: maximum > 0 && voteCount === maximum ? 1 : 0,
    })),
  };
}

test("AP4 result identifies every tied winner, team identity and central point", () => {
  const html = renderToStaticMarkup(createElement(MemeResultStage, {
    result: result([3, 3, 1]),
    imageUrl: "/meme.webp",
    revealCount: 1,
  }));
  assert.match(html, /Das Publikum hat entschieden/);
  assert.equal((html.match(/data-winner="true"/g) ?? []).length, 2);
  assert.equal((html.match(/Gewinner · \+1 Punkt/g) ?? []).length, 2);
  assert.match(html, /Team 1/);
  assert.match(html, /3 Stimmen/);
});

test("AP4 no-vote result remains final without inventing a winner", () => {
  const html = renderToStaticMarkup(createElement(MemeResultStage, {
    result: result([0]),
    imageUrl: "/meme.webp",
    revealCount: 1,
  }));
  assert.match(html, /Keine gültigen Stimmen/);
  assert.match(html, /kein Punkt vergeben/);
  assert.doesNotMatch(html, /data-winner="true"|Gewinner ·/);
});

test("AP4 result reveal pages keep stable groups of four", () => {
  const html = renderToStaticMarkup(createElement(MemeResultStage, {
    result: result([8, 7, 6, 5, 4, 3, 2, 1]),
    imageUrl: "/meme.webp",
    revealCount: 2,
  }));
  assert.match(html, /Seite 2 \/ 2/);
  assert.match(html, /Team 5/);
  assert.match(html, /Team 8/);
  assert.doesNotMatch(html, /Team 1<|Team 4</);
});

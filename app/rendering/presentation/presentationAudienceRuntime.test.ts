import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveIntermediateStandingsAudience } from "./presentationRankingPolicy";

const statusActionsSource = readFileSync(
  "app/quiz/[quizId]/praesentation/statusActions.ts",
  "utf8",
);
const playerSource = readFileSync(
  "app/quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx",
  "utf8",
);

test("productive audience standings boundary returns rank and points only", () => {
  const audienceRows = resolveIntermediateStandingsAudience([
    { sessionId: 1, punkte: 19 },
    { sessionId: 2, punkte: 17 },
    { sessionId: 3, punkte: 17 },
    { sessionId: 4, punkte: 16 },
  ]);

  assert.deepEqual(
    audienceRows.map(({ place, punkte }) => [place, punkte]),
    [
      [1, 19],
      [2, 17],
      [2, 17],
      [4, 16],
    ],
  );
  assert.deepEqual(Object.keys(audienceRows[0] ?? {}).sort(), [
    "key",
    "place",
    "punkte",
  ]);

  const audienceAction = statusActionsSource.match(
    /export async function getPraesentationAudienceZwischenstand[\s\S]*?\n}\n/,
  )?.[0];
  assert.ok(audienceAction);
  assert.doesNotMatch(
    audienceAction,
    /teamname|teamId|avatar|foto_url|photoUrl|mapTeamProfile/,
  );
  assert.match(
    playerSource,
    /getPraesentationAudienceZwischenstand\(quizId\)/,
  );
  assert.match(
    playerSource,
    /punktestand: showIntermediateStandings \? \[\] : scores/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  countEligibleMemeVoters,
  createInitialMemePresentationState,
  getMemeOverviewCandidates,
  getMemeOverviewPageCount,
  planMemeVoteWrite,
  teamCanVoteForCandidate,
  transitionMemePresentation,
} from "./memeVoting";

test("AP3 keeps AP2 candidate numbers stable while presenting and reloading", () => {
  const numbers = [1, 2, 4, 7];
  const initial = createInitialMemePresentationState(numbers);
  assert.deepEqual(initial, {
    state: "PRESENTING",
    activeCandidatePosition: 1,
    overviewPage: 0,
  });
  const second = transitionMemePresentation(initial, numbers, "NEXT_CANDIDATE");
  assert.equal(second?.activeCandidatePosition, 2);
  const third = transitionMemePresentation(second!, numbers, "NEXT_CANDIDATE");
  assert.equal(third?.activeCandidatePosition, 4);
  assert.equal(transitionMemePresentation(third!, numbers, "PREVIOUS_CANDIDATE")?.activeCandidatePosition, 2);
});

test("AP3 overview paginates without an artificial candidate limit", () => {
  const candidates = Array.from({ length: 11 }, (_, index) => index + 1);
  assert.equal(getMemeOverviewPageCount(1), 1);
  assert.equal(getMemeOverviewPageCount(2), 1);
  assert.equal(getMemeOverviewPageCount(4), 1);
  assert.equal(getMemeOverviewPageCount(8), 2);
  assert.equal(getMemeOverviewPageCount(11), 3);
  assert.deepEqual(getMemeOverviewCandidates(candidates, 2), [9, 10, 11]);
});

test("AP3 opens voting only after every candidate and overview page were shown", () => {
  const numbers = [1, 2, 3, 4, 5];
  let state = createInitialMemePresentationState(numbers);
  for (let index = 0; index < numbers.length; index += 1) {
    state = transitionMemePresentation(state, numbers, "NEXT_CANDIDATE")!;
  }
  assert.equal(state.state, "OVERVIEW");
  assert.equal(transitionMemePresentation(state, numbers, "OPEN_VOTING"), null);
  state = transitionMemePresentation(state, numbers, "NEXT_OVERVIEW_PAGE")!;
  state = transitionMemePresentation(state, numbers, "OPEN_VOTING")!;
  assert.equal(state.state, "VOTING_OPEN");
  assert.equal(transitionMemePresentation(state, numbers, "CLOSE_VOTING")?.state, "VOTING_CLOSED");
  assert.equal(transitionMemePresentation(state, numbers, "NEXT_CANDIDATE"), null);
});

test("AP3 rejects self-votes but permits teams without an own candidate", () => {
  assert.equal(teamCanVoteForCandidate({ votingOpen: true, voterTeamId: 7, ownerTeamId: 7 }), false);
  assert.equal(teamCanVoteForCandidate({ votingOpen: true, voterTeamId: 7, ownerTeamId: 8 }), true);
  assert.equal(teamCanVoteForCandidate({ votingOpen: false, voterTeamId: 7, ownerTeamId: 8 }), false);
});

test("AP3 eligible voter count handles the single-candidate owner without a fake vote", () => {
  assert.equal(countEligibleMemeVoters([10], [10]), 0);
  assert.equal(countEligibleMemeVoters([10, 11], [10]), 1);
  assert.equal(countEligibleMemeVoters([10, 11, 12], [10, 11]), 3);
});

test("AP3 vote planning creates once, replaces while open and rejects stale or late writes", () => {
  assert.deepEqual(planMemeVoteWrite({
    presentationState: "VOTING_OPEN", voterTeamId: 1, ownerTeamId: 2,
    expectedRevision: null, currentRevision: null,
  }), { ok: true, operation: "CREATE", nextRevision: 1 });
  assert.deepEqual(planMemeVoteWrite({
    presentationState: "VOTING_OPEN", voterTeamId: 1, ownerTeamId: 2,
    expectedRevision: 1, currentRevision: 1,
  }), { ok: true, operation: "UPDATE", nextRevision: 2 });
  const stale = planMemeVoteWrite({
    presentationState: "VOTING_OPEN", voterTeamId: 1, ownerTeamId: 2,
    expectedRevision: null, currentRevision: 1,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.reason, "REVISION_CONFLICT");
  const late = planMemeVoteWrite({
    presentationState: "VOTING_CLOSED", voterTeamId: 1, ownerTeamId: 2,
    expectedRevision: 1, currentRevision: 1,
  });
  assert.equal(late.ok, false);
  if (!late.ok) assert.equal(late.reason, "VOTING_CLOSED");
});

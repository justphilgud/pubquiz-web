import { evaluateCard, requireId, requireNumber, type BingoCard, type CardEvaluation, type Stage } from "./cards";

export type Draw = Readonly<{ id: string; position: number; number: number }>;
export type Decision = Readonly<{ id: string; action: "CONFIRM" | "REJECT" | "REVOKE"; reason: string }>;
export type Claim = Readonly<{
  id: string; cardId: string; roundId: string; stage: Stage; throughPosition: number;
  originalEvaluation: CardEvaluation; decisions: readonly Decision[]; needsReview: boolean;
}>;
export type Correction = Readonly<{ id: string; drawId: string; position: number; before: number; after: number; reason: string }>;
export type BingoRound = Readonly<{
  version: 1; id: string; status: "PREPARED" | "OPEN" | "CLOSED"; plannedDraws: number;
  draws: readonly Draw[]; claims: readonly Claim[]; corrections: readonly Correction[];
}>;
export const DRAW_PRESETS = Object.freeze([20, 30, 40] as const);

export function createRound(id: string, plannedDraws = 30): BingoRound {
  requireId(id);
  requireNumber(plannedDraws);
  return { version: 1, id, status: "PREPARED", plannedDraws, draws: [], claims: [], corrections: [] };
}

export function appendDraw(round: BingoRound, id: string, number: number): BingoRound {
  if (round.status !== "OPEN") throw new Error("ROUND_NOT_OPEN");
  requireId(id);
  requireNumber(number);
  if (round.draws.some(d => d.id === id)) throw new Error("DUPLICATE_DRAW_ID");
  if (round.draws.some(d => d.number === number)) throw new Error("DUPLICATE_DRAW_NUMBER");
  return { ...round, draws: [...round.draws, { id, position: round.draws.length + 1, number }] };
}

export function currentNumber(round: BingoRound): number | null {
  return round.draws.at(-1)?.number ?? null;
}

export function targetReached(round: BingoRound): boolean {
  return round.draws.length >= round.plannedDraws;
}

export function setTarget(round: BingoRound, target: number): BingoRound {
  if (round.status === "CLOSED") throw new Error("ROUND_CLOSED");
  requireNumber(target);
  if (target < round.draws.length) throw new Error("TARGET_BELOW_DRAW_COUNT");
  return { ...round, plannedDraws: target };
}

export function evaluateClaim(round: BingoRound, claim: Claim, card: BingoCard): CardEvaluation {
  if (claim.roundId !== round.id || claim.cardId !== card.id) throw new Error("CLAIM_REFERENCE_MISMATCH");
  if (!Number.isInteger(claim.throughPosition) || claim.throughPosition < 0 || claim.throughPosition > round.draws.length) throw new Error("INVALID_CLAIM_CUTOFF");
  return evaluateCard(card.cells, round.draws.filter(d => d.position <= claim.throughPosition).map(d => d.number));
}

export function recordClaim(round: BingoRound, id: string, card: BingoCard, stage: Stage): BingoRound {
  if (round.status !== "OPEN") throw new Error("ROUND_NOT_OPEN");
  requireId(id);
  requireId(card.id);
  if (!["BINGO", "DOUBLE", "TRIPLE"].includes(stage)) throw new Error("INVALID_STAGE");
  if (round.claims.some(c => c.id === id)) throw new Error("DUPLICATE_CLAIM_ID");
  const claim: Claim = {
    id, cardId: card.id, roundId: round.id, stage, throughPosition: round.draws.length,
    originalEvaluation: evaluateCard(card.cells, round.draws.map(d => d.number)), decisions: [], needsReview: false,
  };
  return { ...round, claims: [...round.claims, claim] };
}

export function isConfirmed(claim: Claim): boolean {
  return claim.decisions.at(-1)?.action === "CONFIRM";
}

/** Geometric decision only. Issuance/participation eligibility must be checked by the later service. */
export function decideClaim(round: BingoRound, claimId: string, card: BingoCard, decision: Decision): BingoRound {
  requireId(decision.id);
  requireId(decision.reason);
  if (!["CONFIRM", "REJECT", "REVOKE"].includes(decision.action)) throw new Error("INVALID_DECISION");
  if (round.claims.some(c => c.decisions.some(d => d.id === decision.id))) throw new Error("DUPLICATE_DECISION_ID");
  const claim = round.claims.find(c => c.id === claimId);
  if (!claim) throw new Error("CLAIM_NOT_FOUND");
  const evaluation = evaluateClaim(round, claim, card);
  if (decision.action === "CONFIRM") {
    if (!evaluation.stages.includes(claim.stage)) throw new Error("CLAIM_NOT_COVERED");
    if (round.claims.some(c => c.id !== claim.id && c.cardId === claim.cardId && c.stage === claim.stage && isConfirmed(c))) throw new Error("ALREADY_CONFIRMED");
  } else if (decision.action === "REVOKE") {
    if (!isConfirmed(claim)) throw new Error("CLAIM_NOT_CONFIRMED");
  } else if (isConfirmed(claim)) throw new Error("REVOKE_REQUIRED");
  return { ...round, claims: round.claims.map(c => c.id === claim.id ? { ...c, decisions: [...c.decisions, { ...decision }], needsReview: false } : c) };
}

/** Correction retains identity/order. Existing confirmations are retained and flagged, never silently revoked. */
export function correctDraw(
  round: BingoRound, drawId: string, number: number, change: Readonly<{ id: string; reason: string }>, cards: readonly BingoCard[],
): Readonly<{ round: BingoRound; change: Correction }> {
  requireNumber(number);
  requireId(change.id);
  requireId(change.reason);
  if (round.corrections.some(c => c.id === change.id)) throw new Error("DUPLICATE_CORRECTION_ID");
  const draw = round.draws.find(d => d.id === drawId);
  if (!draw) throw new Error("DRAW_NOT_FOUND");
  if (draw.number === number) throw new Error("UNCHANGED_DRAW");
  if (round.draws.some(d => d.id !== drawId && d.number === number)) throw new Error("DUPLICATE_DRAW_NUMBER");
  const correction: Correction = { ...change, drawId, position: draw.position, before: draw.number, after: number };
  const next = { ...round, draws: round.draws.map(d => d.id === drawId ? { ...d, number } : d), corrections: [...round.corrections, correction] };
  const claims = next.claims.map(claim => {
    if (!isConfirmed(claim) || draw.position > claim.throughPosition) return claim;
    const matchingCards = cards.filter(c => c.id === claim.cardId);
    if (matchingCards.length !== 1) throw new Error("CLAIM_CARD_REQUIRED");
    const covered = evaluateClaim(next, claim, matchingCards[0]).stages.includes(claim.stage);
    return { ...claim, needsReview: claim.needsReview || !covered };
  });
  return { round: { ...next, claims }, change: correction };
}

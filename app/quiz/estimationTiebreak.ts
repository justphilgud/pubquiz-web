export type TiebreakStanding = { sessionId: number; points: number };
export type TiebreakRound = {
  id: number; teamIds: number[]; questionId: number; question: string; unit: string;
  correctValue: number; state: "OPEN" | "REVEALED";
  answers: Record<string, { value: number; revision: number }>;
};
export type TiebreakState = {
  version: 1; standings: TiebreakStanding[]; groups: number[][][]; rounds: TiebreakRound[];
};

export function createTiebreakState(standings: TiebreakStanding[]): TiebreakState {
  const points = [...new Set(standings.map(team => team.points))].sort((a, b) => b - a);
  return { version: 1, standings, groups: points.map(value => [standings.filter(team => team.points === value).map(team => team.sessionId)]), rounds: [] };
}

export function readTiebreakState(value: unknown): TiebreakState | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültiger Stichentscheid-Zustand.");
  const state = value as TiebreakState;
  if (state.version !== 1 || !Array.isArray(state.standings) || !Array.isArray(state.groups) || !Array.isArray(state.rounds)) throw new Error("Unbekannte Stichentscheid-Version.");
  const ids = state.standings.map(team => team.sessionId);
  if (new Set(ids).size !== ids.length || state.standings.some(team => !Number.isSafeInteger(team.sessionId) || !Number.isFinite(team.points))) throw new Error("Ungültiger Teamstand.");
  const grouped = state.groups.flat(2);
  if (grouped.length !== ids.length || new Set(grouped).size !== ids.length || grouped.some(id => !ids.includes(id))) throw new Error("Ungültige Gleichstandsgruppen.");
  for (const round of state.rounds) {
    if (!Number.isSafeInteger(round.id) || !Number.isSafeInteger(round.questionId) || !Number.isFinite(round.correctValue) || !round.unit?.trim() || typeof round.question !== "string" || !["OPEN", "REVEALED"].includes(round.state)
      || !Array.isArray(round.teamIds) || round.teamIds.some(id => !ids.includes(id)) || new Set(round.teamIds).size !== round.teamIds.length || round.teamIds.length < 2 || !round.answers || typeof round.answers !== "object") throw new Error("Ungültige Stichrunde.");
    for (const [id, answer] of Object.entries(round.answers)) if (!round.teamIds.includes(Number(id)) || !Number.isFinite(answer.value) || !Number.isSafeInteger(answer.revision) || answer.revision < 1) throw new Error("Ungültige Stichantwort.");
  }
  if (new Set(state.rounds.map(round => round.id)).size !== state.rounds.length || state.rounds.filter(round => round.state === "OPEN").length > 1) throw new Error("Mehrdeutige Stichrunde.");
  return state;
}

export function unresolvedTiebreakGroups(state: TiebreakState): number[][] {
  return state.groups.flat().filter(group => group.length > 1);
}

export function startTiebreakRound(state: TiebreakState, question: Pick<TiebreakRound, "questionId" | "question" | "unit" | "correctValue">): TiebreakState {
  if (state.rounds.some(round => round.state === "OPEN")) return state;
  const group = unresolvedTiebreakGroups(state)[0];
  if (!group) return state;
  if (!Number.isFinite(question.correctValue) || !question.unit.trim() || state.rounds.some(round => round.questionId === question.questionId)) throw new Error("Keine geeignete unbenutzte Schätzfrage.");
  return { ...state, rounds: [...state.rounds, { ...question, id: state.rounds.length + 1, teamIds: [...group], state: "OPEN", answers: {} }] };
}

export function saveTiebreakAnswer(state: TiebreakState, input: { roundId: number; sessionId: number; value: number; expectedRevision: number }): TiebreakState {
  const round = state.rounds.find(candidate => candidate.id === input.roundId);
  if (!round || round.state !== "OPEN" || !round.teamIds.includes(input.sessionId)) throw new Error("Stichantwort nicht autorisiert oder Runde geschlossen.");
  if (!Number.isFinite(input.value)) throw new Error("Gültige Zahl erforderlich.");
  const previous = round.answers[String(input.sessionId)];
  if (previous?.value === input.value && previous.revision === input.expectedRevision + 1) return state;
  if ((previous?.revision ?? 0) !== input.expectedRevision) throw new Error("Stichantwort wurde auf einem anderen Gerät geändert. Bitte neu laden.");
  return { ...state, rounds: state.rounds.map(candidate => candidate.id !== round.id ? candidate : { ...round, answers: { ...round.answers, [input.sessionId]: { value: input.value, revision: input.expectedRevision + 1 } } }) };
}

export function revealTiebreakRound(state: TiebreakState, roundId: number): TiebreakState {
  const round = state.rounds.find(candidate => candidate.id === roundId);
  if (!round || round.state === "REVEALED") return state;
  const distance = (id: number) => round.answers[String(id)] ? Math.abs(round.answers[String(id)].value - round.correctValue) : Infinity;
  const distances = [...new Set(round.teamIds.map(distance))].sort((a, b) => a - b);
  const partitions = distances.map(value => round.teamIds.filter(id => distance(id) === value));
  return { ...state, groups: state.groups.map(group => group.flatMap(part => part.length === round.teamIds.length && part.every(id => round.teamIds.includes(id)) ? partitions : [part])), rounds: state.rounds.map(candidate => candidate.id === roundId ? { ...candidate, state: "REVEALED" } : candidate) };
}

export function tiebreakPlaces(state: TiebreakState): Map<number, number> {
  let place = 1;
  const result = new Map<number, number>();
  for (const group of state.groups) for (const part of group) { for (const id of part) result.set(id, place); place += part.length; }
  return result;
}

export function verifiedTiebreakPlaces(value: unknown, standings: TiebreakStanding[]): Map<number, number> {
  const state = readTiebreakState(value);
  if (!state) return new Map();
  const normalize = (rows: TiebreakStanding[]) => [...rows].sort((a, b) => a.sessionId - b.sessionId).map(team => [team.sessionId, team.points]);
  return JSON.stringify(normalize(state.standings)) === JSON.stringify(normalize(standings)) ? tiebreakPlaces(state) : new Map();
}

/** Never expose the source solution, other answers or internal snapshots before reveal. */
export function projectTiebreak(state: TiebreakState, sessionId?: number) {
  const round = state.rounds.at(-1);
  return { unresolved: unresolvedTiebreakGroups(state).length,
    places: [...tiebreakPlaces(state)].map(([id, place]) => ({ sessionId: id, place })),
    round: round ? { id: round.id, question: round.question, unit: round.unit, state: round.state,
      authorized: sessionId !== undefined && round.teamIds.includes(sessionId),
      answered: Object.keys(round.answers).length, total: round.teamIds.length,
      ownAnswer: sessionId === undefined ? null : round.answers[String(sessionId)] ?? null,
      ...(round.state === "REVEALED" ? { correctValue: round.correctValue } : {}) } : null };
}

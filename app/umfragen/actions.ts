"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireActor } from "@/app/lib/permissions";
import { requireQuizEditor } from "@/app/quiz/quizAccess.server";
import { requireQuizLiveController } from "@/app/quiz/quizAccess.server";
import { resolveParticipantSession } from "@/app/quiz/participantSession.server";
import { closeCurrentInteraction } from "@/app/quiz/interaction/interaction.server";
import { canArchiveStoryElement, canCreateStoryElement, canEditStoryElement } from "@/app/story-elemente/storyElementPolicy";
import { validateLivePollInput, type LivePollMutationInput } from "./livePoll";
import { canAttachLivePoll, loadLivePoll, resolveLivePollScope } from "./livePollRepository.server";
import {
  readLivePollRunSnapshot,
  saveLivePollResponse,
  setLivePollResponseVisibility as persistLivePollResponseVisibility,
} from "./livePollRuntime.server";

export type LivePollActionResult =
  | { success: true; pollId: number; updatedAt: string; message: string }
  | { success: false; message: string; conflict?: boolean };

function revalidatePoll(pollId?: number) {
  revalidatePath("/content/polls");
  revalidatePath("/content");
  if (pollId) revalidatePath(`/content/polls/${pollId}`);
  revalidatePath("/quiz/[quizId]", "page");
}

export async function createLivePoll(input: LivePollMutationInput): Promise<LivePollActionResult> {
  const { actor } = await requireActor();
  if (!canCreateStoryElement(actor)) return { success: false, message: "Umfragen dürfen mit dieser Rolle nicht erstellt werden." };
  const validated = validateLivePollInput(input);
  if (!validated.ok) return { success: false, message: validated.message };
  await resolveLivePollScope(actor, validated.value);
  const created = await prisma.live_polls.create({
    data: {
      stable_key: `poll-${randomUUID()}`,
      status: validated.value.status,
      geltungsbereich: validated.value.scope,
      eventreihe_id: validated.value.eventSeriesId,
      quiz_id: validated.value.quizId,
      created_by_user_id: actor.userId,
      revisionen: { create: {
        revisionsnummer: 1,
        typ: validated.value.type,
        prompt: validated.value.prompt,
        publication_mode: validated.value.publicationMode,
        optionen: validated.value.options as Prisma.InputJsonValue,
        moderationsnotiz: validated.value.moderatorNote,
        created_by_user_id: actor.userId,
      } },
    },
    select: { live_poll_id: true, updated_at: true },
  });
  revalidatePoll(created.live_poll_id);
  return { success: true, pollId: created.live_poll_id, updatedAt: created.updated_at.toISOString(), message: "Umfrage wurde gespeichert." };
}

export async function updateLivePoll(input: { pollId: number; expectedUpdatedAt: string; value: LivePollMutationInput }): Promise<LivePollActionResult> {
  const { actor } = await requireActor();
  const poll = await loadLivePoll(actor, input.pollId);
  if (!poll || !canEditStoryElement(actor, poll.access)) return { success: false, message: "Umfrage nicht gefunden oder nicht bearbeitbar." };
  const validated = validateLivePollInput(input.value);
  if (!validated.ok) return { success: false, message: validated.message };
  if (
    poll.usageCount > 0 &&
    (validated.value.scope !== poll.scope ||
      validated.value.eventSeriesId !== poll.eventSeriesId ||
      validated.value.quizId !== poll.quizId)
  ) {
    return { success: false, message: "Der Geltungsbereich einer bereits verwendeten Umfrage bleibt unverändert." };
  }
  await resolveLivePollScope(actor, validated.value);
  const expected = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) return { success: false, message: "Der Bearbeitungsstand ist ungültig." };
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.live_polls.updateMany({
        where: { live_poll_id: input.pollId, updated_at: expected, status: { not: "ARCHIVED" } },
        data: { status: validated.value.status, geltungsbereich: validated.value.scope, eventreihe_id: validated.value.eventSeriesId, quiz_id: validated.value.quizId },
      });
      if (claimed.count !== 1) throw new Error("POLL_CONFLICT");
      const latest = await tx.live_poll_revisions.aggregate({ where: { live_poll_id: input.pollId }, _max: { revisionsnummer: true } });
      await tx.live_poll_revisions.create({ data: {
        live_poll_id: input.pollId,
        revisionsnummer: (latest._max.revisionsnummer ?? 0) + 1,
        typ: validated.value.type,
        prompt: validated.value.prompt,
        publication_mode: validated.value.publicationMode,
        optionen: validated.value.options as Prisma.InputJsonValue,
        moderationsnotiz: validated.value.moderatorNote,
        created_by_user_id: actor.userId,
      } });
      return tx.live_polls.findUniqueOrThrow({ where: { live_poll_id: input.pollId }, select: { updated_at: true } });
    });
    revalidatePoll(input.pollId);
    return { success: true, pollId: input.pollId, updatedAt: updated.updated_at.toISOString(), message: "Neue Umfrage-Revision wurde gespeichert." };
  } catch (error) {
    if (error instanceof Error && error.message === "POLL_CONFLICT") return { success: false, conflict: true, message: "Die Umfrage wurde zwischenzeitlich geändert. Bitte neu laden." };
    throw error;
  }
}

export async function duplicateLivePoll(pollId: number): Promise<LivePollActionResult> {
  const { actor } = await requireActor();
  const source = await loadLivePoll(actor, pollId);
  if (!source || !canCreateStoryElement(actor)) return { success: false, message: "Umfrage kann nicht dupliziert werden." };
  await resolveLivePollScope(actor, {
    scope: source.scope,
    eventSeriesId: source.eventSeriesId,
    quizId: source.quizId,
  });
  const created = await prisma.live_polls.create({
    data: {
      stable_key: `poll-${randomUUID()}`,
      status: "DRAFT",
      geltungsbereich: source.scope,
      eventreihe_id: source.eventSeriesId,
      quiz_id: source.quizId,
      created_by_user_id: actor.userId,
      source_live_poll_id: source.id,
      revisionen: { create: { revisionsnummer: 1, typ: source.type, prompt: `${source.prompt} – Kopie`.slice(0, 300), publication_mode: source.publicationMode, optionen: source.options as Prisma.InputJsonValue, moderationsnotiz: source.moderatorNote, created_by_user_id: actor.userId } },
    }, select: { live_poll_id: true, updated_at: true },
  });
  revalidatePoll(created.live_poll_id);
  return { success: true, pollId: created.live_poll_id, updatedAt: created.updated_at.toISOString(), message: "Umfragekopie wurde als Entwurf angelegt." };
}

export async function setLivePollArchived(pollId: number, archived: boolean): Promise<LivePollActionResult> {
  const { actor } = await requireActor();
  const poll = await loadLivePoll(actor, pollId);
  if (!poll || !canArchiveStoryElement(actor, poll.access)) return { success: false, message: "Umfrage darf nicht archiviert werden." };
  const updated = await prisma.live_polls.update({ where: { live_poll_id: pollId }, data: { status: archived ? "ARCHIVED" : "DRAFT", archived_at: archived ? new Date() : null }, select: { updated_at: true } });
  revalidatePoll(pollId);
  return { success: true, pollId, updatedAt: updated.updated_at.toISOString(), message: archived ? "Umfrage wurde archiviert." : "Umfrage wurde reaktiviert." };
}

export async function deleteUnusedLivePoll(pollId: number): Promise<LivePollActionResult> {
  const { actor } = await requireActor();
  const poll = await loadLivePoll(actor, pollId);
  if (!poll || !canEditStoryElement(actor, poll.access)) return { success: false, message: "Umfrage darf nicht gelöscht werden." };
  if (poll.usageCount > 0) return { success: false, message: "Verwendete Umfragen werden archiviert statt gelöscht." };
  await prisma.live_polls.delete({ where: { live_poll_id: pollId } });
  revalidatePoll();
  return { success: true, pollId, updatedAt: new Date().toISOString(), message: "Unbenutzte Umfrage wurde gelöscht." };
}

export async function attachLivePollToQuiz(input: { pollId: number; quizId: number; sectionId: number | null }) {
  const { actor } = await requireActor();
  await requireQuizEditor(input.quizId);
  const poll = await loadLivePoll(actor, input.pollId);
  const quiz = await prisma.quiz.findUnique({ where: { quiz_id: input.quizId }, select: { quiz_id: true, eventreihe_id: true } });
  const section = input.sectionId === null ? null : await prisma.quiz_abschnitte.findFirst({ where: { quiz_abschnitt_id: input.sectionId, quiz_id: input.quizId, abschnitt_typ: { in: ["fragenblock", "fragenrunde"] } }, select: { quiz_abschnitt_id: true } });
  if (!poll || !quiz || (input.sectionId !== null && !section) || !canAttachLivePoll(actor, poll, { quizId: quiz.quiz_id, eventSeriesId: quiz.eventreihe_id })) return { success: false, message: "Umfrage kann diesem Quiz nicht hinzugefügt werden." };
  const existing = await prisma.quiz_ablauf_elemente.findFirst({
    where: { quiz_id: input.quizId, live_poll_revision: { live_poll_id: input.pollId } },
    select: { quiz_ablauf_element_id: true },
  });
  if (existing) return { success: false, message: "Diese Umfrage ist bereits im Quiz vorhanden." };
  const anchorType = section ? "BLOCK" : "BEFORE_QUIZ";
  const anchorKey = section ? String(section.quiz_abschnitt_id) : "UNASSIGNED";
  const last = await prisma.quiz_ablauf_elemente.findFirst({ where: { quiz_id: input.quizId, anker_typ: anchorType, anker_schluessel: anchorKey }, orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }], select: { sortierung: true } });
  const placement = await prisma.quiz_ablauf_elemente.create({ data: {
    quiz_id: input.quizId,
    typ: "LIVE_POLL",
    anker_typ: anchorType,
    anker_schluessel: anchorKey,
    quiz_abschnitt_id: section?.quiz_abschnitt_id ?? null,
    sortierung: (last?.sortierung ?? 0) + 1_000,
    ist_sichtbar: section !== null,
    bezeichnung: poll.prompt,
    konfiguration: { version: 1 },
    konfigurations_version: 1,
    ist_standard: false,
    live_poll_revision_id: poll.revisionId,
  }, select: { quiz_ablauf_element_id: true } });
  revalidatePath(`/quiz/${input.quizId}`);
  return { success: true, placementId: placement.quiz_ablauf_element_id, message: "Umfrage wurde dem Quizablauf hinzugefügt." };
}

export async function submitLivePollResponse(input: { quizId: number; quizTeamSessionToken: string; selectedOptionId?: string; text?: string }) {
  const session = await resolveParticipantSession(input.quizId, input.quizTeamSessionToken);
  if (!session || session.team.ist_archiviert) return { success: false as const, message: "Teamsitzung ist ungültig." };
  return saveLivePollResponse({ quizId: input.quizId, quizTeamSessionId: session.quiz_team_session_id, selectedOptionId: input.selectedOptionId, text: input.text });
}

export async function moderateLivePollResponse(input: { quizId: number; responseId: number; visible: boolean }) {
  await requireQuizLiveController(input.quizId);
  const { actor } = await requireActor();
  return persistLivePollResponseVisibility({ ...input, moderatorUserId: actor.userId });
}

export async function closeLivePoll(input: { quizId: number; runId: number }) {
  await requireQuizLiveController(input.quizId);
  const current = await prisma.quiz_interaction_runs.findFirst({ where: { quiz_id: input.quizId, interaction_run_id: input.runId, is_current: true }, select: { config_snapshot: true } });
  if (!current || !readLivePollRunSnapshot(current.config_snapshot)) {
    return { success: false as const, message: "Die laufende Umfrage wurde nicht gefunden." };
  }
  const closed = await prisma.$transaction((tx) => closeCurrentInteraction(tx, input.quizId, "MODERATOR_CLOSED_POLL"));
  revalidatePath(`/quiz/${input.quizId}/moderation`);
  revalidatePath(`/quiz/${input.quizId}/praesentation`);
  return closed ? { success: true as const, message: "Umfrage wurde geschlossen.", state: closed.state } : { success: false as const, message: "Die Umfrage konnte nicht geschlossen werden." };
}

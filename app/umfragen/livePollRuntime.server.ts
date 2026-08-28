import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { sanitizePublicLiveText } from "@/app/quiz/liveResults/publicTextSanitizer";
import { mapTeamProfile } from "@/app/teams/teamProfile";
import { aggregateLivePollState, type LivePollResponseProjection } from "./livePollRuntime";
import { readLivePollRuntimeConfig, type LivePollRuntimeConfig } from "./livePoll";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function buildLivePollRunSnapshot(config: LivePollRuntimeConfig) {
  return { contentPoll: config };
}

export function readLivePollRunSnapshot(value: Prisma.JsonValue): LivePollRuntimeConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return readLivePollRuntimeConfig((value as { contentPoll?: unknown }).contentPoll);
}

export async function loadLivePollPlacement(db: DbClient, quizId: number, placementId: number) {
  const placement = await db.quiz_ablauf_elemente.findFirst({
    where: { quiz_ablauf_element_id: placementId, quiz_id: quizId, typ: "LIVE_POLL", ist_sichtbar: true },
    include: {
      live_poll_revision: {
        include: { live_poll: { select: { status: true } } },
      },
    },
  });
  const revision = placement?.live_poll_revision;
  if (!placement || !revision || revision.live_poll.status !== "ACTIVE") return null;
  return {
    placement,
    config: readLivePollRuntimeConfig({
      version: 1,
      pollId: revision.live_poll_id,
      pollRevisionId: revision.live_poll_revision_id,
      type: revision.typ,
      prompt: revision.prompt,
      publicationMode: revision.publication_mode,
      options: revision.optionen,
    }),
  };
}

function normalizeFreeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return normalized && normalized.length <= 500 ? normalized : null;
}

export async function saveLivePollResponse(input: {
  quizId: number;
  quizTeamSessionId: number;
  selectedOptionId?: unknown;
  text?: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ interaction_run_id: number }[]>`
      SELECT "interaction_run_id" FROM "pubquiz"."quiz_interaction_runs"
      WHERE "quiz_id" = ${input.quizId} AND "is_current" = true FOR UPDATE
    `;
    const runId = rows[0]?.interaction_run_id;
    if (!runId) return { success: false as const, message: "Aktuell läuft keine Umfrage." };
    const [run, session] = await Promise.all([
      tx.quiz_interaction_runs.findUnique({ where: { interaction_run_id: runId } }),
      tx.quiz_team_sessions.findFirst({ where: { quiz_team_session_id: input.quizTeamSessionId, quiz_id: input.quizId }, select: { quiz_team_session_id: true } }),
    ]);
    const config = run ? readLivePollRunSnapshot(run.config_snapshot) : null;
    if (!run || !session || !config || run.state !== "OPEN") return { success: false as const, message: "Die Umfrage ist geschlossen." };

    let selectedOptionId: string | null = null;
    let originalText: string | null = null;
    let publicText: string | null = null;
    let isVisible = false;
    if (config.type === "SINGLE_CHOICE") {
      selectedOptionId = typeof input.selectedOptionId === "string" ? input.selectedOptionId : null;
      if (!selectedOptionId || !config.options.some((option) => option.id === selectedOptionId)) return { success: false as const, message: "Die Auswahl ist ungültig." };
    } else {
      originalText = normalizeFreeText(input.text);
      if (!originalText) return { success: false as const, message: "Bitte gib einen kurzen Beitrag ein." };
      const rules = await tx.public_text_replacement_rules.findMany({ where: { is_active: true }, select: { public_text_replacement_rule_id: true, search_term: true, replacement: true } });
      publicText = sanitizePublicLiveText(originalText, rules.map((rule) => ({ id: rule.public_text_replacement_rule_id, searchTerm: rule.search_term, replacement: rule.replacement }))).publicText;
      isVisible = config.publicationMode === "AUTOMATIC";
    }

    const response = await tx.live_poll_responses.upsert({
      where: { interaction_run_id_quiz_team_session_id: { interaction_run_id: run.interaction_run_id, quiz_team_session_id: session.quiz_team_session_id } },
      create: { interaction_run_id: run.interaction_run_id, live_poll_revision_id: config.pollRevisionId, quiz_team_session_id: session.quiz_team_session_id, selected_option_id: selectedOptionId, original_text: originalText, public_text: publicText, is_visible: isVisible },
      update: { selected_option_id: selectedOptionId, original_text: originalText, public_text: publicText, is_visible: isVisible, moderated_by_user_id: null, revision: { increment: 1 } },
      select: { live_poll_response_id: true, revision: true },
    });
    await tx.quiz_interaction_runs.update({ where: { interaction_run_id: run.interaction_run_id }, data: { revision: { increment: 1 } } });
    return { success: true as const, message: config.type === "SINGLE_CHOICE" ? "Auswahl gespeichert." : "Beitrag gespeichert.", responseId: response.live_poll_response_id, revision: response.revision };
  });
}

export async function setLivePollResponseVisibility(input: { quizId: number; responseId: number; visible: boolean; moderatorUserId: number }) {
  const response = await prisma.live_poll_responses.findFirst({ where: { live_poll_response_id: input.responseId, interaction_run: { quiz_id: input.quizId } }, select: { live_poll_response_id: true, interaction_run_id: true } });
  if (!response) return { success: false as const, message: "Beitrag wurde nicht gefunden." };
  await prisma.$transaction([
    prisma.live_poll_responses.update({ where: { live_poll_response_id: response.live_poll_response_id }, data: { is_visible: input.visible, moderated_by_user_id: input.moderatorUserId, revision: { increment: 1 } } }),
    prisma.quiz_interaction_runs.update({ where: { interaction_run_id: response.interaction_run_id }, data: { revision: { increment: 1 } } }),
  ]);
  return { success: true as const, message: input.visible ? "Beitrag ist öffentlich." : "Beitrag wurde ausgeblendet." };
}

export async function getLivePollStateForRun(run: { interaction_run_id: number; revision: number; state: Prisma.quiz_interaction_runsGetPayload<Record<string, never>>["state"]; config_snapshot: Prisma.JsonValue }, includeModeration: boolean) {
  const config = readLivePollRunSnapshot(run.config_snapshot);
  if (!config) return null;
  const rows = await prisma.live_poll_responses.findMany({
    where: { interaction_run_id: run.interaction_run_id },
    include: { quiz_team_session: { select: { teamname: true, team: { select: { team_id: true, avatar_code: true, foto_url: true, foto_upload_gesperrt: true } } } } },
    orderBy: [{ updated_at: "asc" }, { live_poll_response_id: "asc" }],
  });
  const responses: LivePollResponseProjection[] = rows.map((row) => {
    const profile = mapTeamProfile(row.quiz_team_session.team);
    return { id: row.live_poll_response_id, teamId: profile.teamId, teamName: row.quiz_team_session.teamname, avatarCode: profile.avatarCode, photoUrl: profile.photoUrl, selectedOptionId: row.selected_option_id, originalText: row.original_text, publicText: row.public_text, isVisible: row.is_visible, updatedAt: row.updated_at.toISOString() };
  });
  return aggregateLivePollState({ revision: `poll:${run.interaction_run_id}:${run.revision}`, runId: run.interaction_run_id, state: run.state, config, responses, includeModeration });
}

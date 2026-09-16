import "server-only";
import { prisma } from "@/app/lib/prisma";
import { getLogicalEnvironment } from "@/config/environment";
import { isQuizInteractionWritable, type QuizInteractionState } from "@/app/quiz/interaction/interactionStateMachine";
import { BACKUP_EVIDENCE } from "./backupEvidence";
import { createMonitorCache } from "./cache";
import { REFRESH_MS, safeRelease, type Snapshot } from "./model";

type QuizRow = { id: number; name: string | null; slide: number; changed: Date; teams: bigint };
type RunRow = { quiz_id: number; state: QuizInteractionState; deadline_at: Date | null; answers: bigint; draft: Date | null };
let lastDbSuccess: string | null = null;

async function collect(): Promise<Snapshot> {
  const started = performance.now();
  let environment: Snapshot["environment"] = "unknown";
  try { environment = getLogicalEnvironment(); } catch { /* Only the fixed unknown state leaves this module. */ }
  const snapshot: Snapshot = {
    checkedAt: new Date().toISOString(), environment,
    release: safeRelease(process.env.VERCEL_GIT_COMMIT_SHA),
    db: { ok: false, latencyMs: null, lastSuccessAt: lastDbSuccess },
    live: null, truncated: false, backup: BACKUP_EVIDENCE,
    collectionMs: 0, readQueries: 0, simulation: null,
  };
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '1500ms'`;
      const probeStart = performance.now();
      snapshot.readQueries++;
      await tx.$queryRaw`SELECT 1`;
      const latency = Math.round(performance.now() - probeStart);
      snapshot.readQueries++;
      const quizzes = await tx.$queryRaw<QuizRow[]>`
        SELECT s.quiz_id AS id, q.titel AS name, s.slide_index AS slide, s.updated_at AS changed,
          (SELECT count(*) FROM pubquiz.quiz_team_sessions t WHERE t.quiz_id = s.quiz_id) AS teams
        FROM pubquiz.quiz_praesentation_status s JOIN pubquiz.quiz q ON q.quiz_id = s.quiz_id
        WHERE s.quiz_started_at IS NOT NULL AND s.quiz_stopped_at IS NULL AND NOT q.ist_archiviert
        ORDER BY s.quiz_id DESC LIMIT 7`;
      const selected = quizzes.slice(0, 6);
      let runs: RunRow[] = [];
      if (selected.length) {
        snapshot.readQueries++;
        runs = await tx.$queryRaw<RunRow[]>`
          SELECT r.quiz_id, r.state, r.deadline_at, a.answers, a.draft
          FROM pubquiz.quiz_interaction_runs r
          CROSS JOIN LATERAL (SELECT count(*) AS answers, max(draft_updated_at) AS draft
            FROM pubquiz.team_antworten a WHERE a.interaction_run_id = r.interaction_run_id) a
          WHERE r.is_current AND r.quiz_id = ANY(${selected.map(q => q.id)}::int[])`;
      }
      return { latency, quizzes, selected, runs };
    }, { maxWait: 1000, timeout: 4000 });
    lastDbSuccess = new Date().toISOString();
    snapshot.checkedAt = lastDbSuccess;
    snapshot.db = { ok: true, latencyMs: result.latency, lastSuccessAt: lastDbSuccess };
    snapshot.truncated = result.quizzes.length > 6;
    snapshot.live = result.selected.map(q => {
      const run = result.runs.find(r => r.quiz_id === q.id);
      return {
        id: q.id, name: q.name?.slice(0, 160) || `Quiz ${q.id}`, slide: q.slide + 1,
        registeredTeams: Number(q.teams), stateChangedAt: q.changed.toISOString(),
        phase: !run ? "Kein Antwortlauf" : isQuizInteractionWritable(run.state, run.deadline_at, new Date(snapshot.checkedAt)) ? "Offen" : "Geschlossen / gesperrt",
        savedAnswers: run ? Number(run.answers) : null, lastDraftAt: run?.draft?.toISOString() ?? null,
      };
    });
  } catch { /* No DB exception, SQL, URL, parameters or stack trace enters response/logs. */ }
  snapshot.collectionMs = Math.round(performance.now() - started);
  return snapshot;
}

export const getMonitoringSnapshot = createMonitorCache(collect, REFRESH_MS);

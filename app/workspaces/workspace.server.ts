import "server-only";
import { cache } from "react";
import { prisma } from "@/app/lib/prisma";
import { requireActor } from "@/app/lib/permissions";
import { getVisibleEventSeriesIds, isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { getWorkspaceChoices } from "./workspacePolicy";

export const loadWorkspaceNavigation = cache(async () => {
  const { actor } = await requireActor();
  const series = await prisma.eventreihen.findMany({
    where: { ...(isAdministrator(actor) ? {} : { eventreihe_id: { in: getVisibleEventSeriesIds(actor) } }) },
    select: { eventreihe_id: true, name: true, eventarten: { where: { ist_freigeschaltet: true }, select: { eventart: true } } },
    orderBy: [{ name: "asc" }, { eventreihe_id: "asc" }],
  });
  return { actor, choices: getWorkspaceChoices(actor, series.map(row => ({ id: row.eventreihe_id, name: row.name, products: row.eventarten.map(product => product.eventart) }))) };
});

/** Resolve legacy object links from their real ownership, never a stored preference or return URL.
 * Only intersect with the actor's current catalog; this does not grant object access. */
export async function loadLegacyWorkspaceContext(path: string, choices: Awaited<ReturnType<typeof loadWorkspaceNavigation>>["choices"]) {
  let ids: number[] = [];
  let label: string | undefined;
  const quiz = /^\/quiz\/([1-9]\d*)(?:\/|$)/.exec(path);
  const series = /^\/admin\/eventreihen\/([1-9]\d*)$/.exec(path);
  const question = /^\/(?:content\/questions|fragen\/editor)\/([1-9]\d*)$/.exec(path);
  const story = /^\/(?:content\/story-elements|story-elemente)\/([1-9]\d*)$/.exec(path);
  const poll = /^\/content\/polls\/([1-9]\d*)$/.exec(path);
  if (series) ids = [Number(series[1])];
  else if (quiz) {
    const row = await prisma.quiz.findUnique({ where: { quiz_id: Number(quiz[1]) }, select: { eventreihe_id: true } });
    if (row) ids = [row.eventreihe_id];
  } else if (question) {
    const row = await prisma.fragen.findUnique({ where: { fragen_id: Number(question[1]) }, select: { geltungsbereich: true, eventreihen: { select: { eventreihe_id: true } } } });
    if (row?.geltungsbereich === "GLOBAL") label = "Globaler Inhalt · Quiz";
    else if (row) ids = row.eventreihen.map(item => item.eventreihe_id);
  } else if (story || poll) {
    const select = { geltungsbereich: true, eventreihe_id: true, quiz: { select: { eventreihe_id: true } } } as const;
    const row = story
      ? await prisma.story_elemente.findUnique({ where: { story_element_id: Number(story[1]) }, select })
      : await prisma.live_polls.findUnique({ where: { live_poll_id: Number(poll![1]) }, select });
    if (row?.geltungsbereich === "GLOBAL") label = "Globaler Inhalt · Quiz";
    else if (row) ids = [row.eventreihe_id ?? row.quiz?.eventreihe_id ?? 0];
  }
  const visible = ids.filter(id => choices.some(choice => choice.id === id));
  return { seriesId: ids.length === 1 && visible.length === 1 ? visible[0] : undefined, label: label ?? (ids.length > 1 && visible.length ? "Mehrere Eventreihen · Quiz" : undefined), settings: Boolean(series) };
}

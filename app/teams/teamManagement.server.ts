import "server-only";

import { prisma } from "@/app/lib/prisma";
import { requireActor } from "@/app/lib/permissions";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  canAccessTeamManagement,
  getTeamManagementEventSeriesIds,
} from "./teamManagementPolicy";
import { mapTeamProfile } from "./teamProfile";

export class TeamManagementAccessError extends Error {
  constructor(message = "Team nicht gefunden oder Zugriff nicht erlaubt.") {
    super(message);
    this.name = "TeamManagementAccessError";
  }
}

export async function requireTeamManagementActor() {
  const authenticated = await requireActor();
  if (!canAccessTeamManagement(authenticated.actor)) {
    throw new TeamManagementAccessError("Keine Berechtigung für die Teamverwaltung.");
  }
  return authenticated;
}

export function teamScopeWhere(actor: AuthorizationActor) {
  const eventSeriesIds = getTeamManagementEventSeriesIds(actor);
  return eventSeriesIds === null
    ? {}
    : {
        quiz_team_sessions: {
          some: { quiz: { eventreihe_id: { in: eventSeriesIds } } },
        },
      };
}

export async function assertTeamAccess(actor: AuthorizationActor, teamId: number) {
  if (!Number.isInteger(teamId) || teamId <= 0) throw new TeamManagementAccessError();
  const team = await prisma.teams.findFirst({
    where: { team_id: teamId, ...teamScopeWhere(actor) },
    select: { team_id: true, teamname: true, team_passwort: true, ist_archiviert: true },
  });
  if (!team) throw new TeamManagementAccessError();
  return team;
}

function scopedSessionWhere(actor: AuthorizationActor) {
  const eventSeriesIds = getTeamManagementEventSeriesIds(actor);
  return eventSeriesIds === null ? {} : { quiz: { eventreihe_id: { in: eventSeriesIds } } };
}

function mapTeam(team: {
  team_id: number;
  teamname: string;
  ist_archiviert: boolean;
  created_at: Date;
  updated_at: Date;
  quiz_team_sessions: Array<{
    erstellt_am: Date;
    quiz: {
      quiz_id: number;
      titel: string | null;
      quiz_datum: Date | null;
      eventreihe: { eventreihe_id: number; name: string; oeffentlicher_name: string | null };
    };
  }>;
}) {
  const eventSeries = new Map<number, { id: number; name: string }>();
  for (const session of team.quiz_team_sessions) {
    const series = session.quiz.eventreihe;
    eventSeries.set(series.eventreihe_id, {
      id: series.eventreihe_id,
      name: series.oeffentlicher_name ?? series.name,
    });
  }
  const lastSession = team.quiz_team_sessions[0] ?? null;
  return {
    id: team.team_id,
    name: team.teamname,
    isArchived: team.ist_archiviert,
    createdAt: team.created_at.toISOString(),
    updatedAt: team.updated_at.toISOString(),
    participationCount: team.quiz_team_sessions.length,
    lastParticipationAt: lastSession?.quiz.quiz_datum?.toISOString()
      ?? lastSession?.erstellt_am.toISOString()
      ?? null,
    eventSeries: [...eventSeries.values()].sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}

export type TeamListStatus = "ACTIVE" | "ARCHIVED" | "ALL";

export async function loadTeamManagementPage(input: {
  actor: AuthorizationActor;
  query?: string;
  status?: TeamListStatus;
  eventSeriesId?: number | null;
}) {
  const allowedIds = getTeamManagementEventSeriesIds(input.actor);
  if (input.eventSeriesId && allowedIds !== null && !allowedIds.includes(input.eventSeriesId)) {
    throw new TeamManagementAccessError();
  }
  const status = input.status ?? "ACTIVE";
  const sessionWhere = scopedSessionWhere(input.actor);
  const teams = await prisma.teams.findMany({
    where: {
      ...teamScopeWhere(input.actor),
      ...(status === "ALL" ? {} : { ist_archiviert: status === "ARCHIVED" }),
      ...(input.query?.trim()
        ? { teamname: { contains: input.query.trim(), mode: "insensitive" as const } }
        : {}),
      ...(input.eventSeriesId
        ? { quiz_team_sessions: { some: { quiz: { eventreihe_id: input.eventSeriesId } } } }
        : {}),
    },
    orderBy: [{ ist_archiviert: "asc" }, { teamname: "asc" }],
    take: 200,
    select: {
      team_id: true,
      teamname: true,
      ist_archiviert: true,
      created_at: true,
      updated_at: true,
      quiz_team_sessions: {
        where: sessionWhere,
        orderBy: [{ quiz: { quiz_datum: "desc" } }, { erstellt_am: "desc" }],
        select: {
          erstellt_am: true,
          quiz: {
            select: {
              quiz_id: true,
              titel: true,
              quiz_datum: true,
              eventreihe: {
                select: { eventreihe_id: true, name: true, oeffentlicher_name: true },
              },
            },
          },
        },
      },
    },
  });
  const series = await prisma.eventreihen.findMany({
    where: allowedIds === null ? {} : { eventreihe_id: { in: allowedIds } },
    orderBy: [{ ist_archiviert: "asc" }, { name: "asc" }],
    select: { eventreihe_id: true, name: true, oeffentlicher_name: true, ist_archiviert: true },
  });
  return {
    teams: teams.map(mapTeam),
    eventSeries: series.map((entry) => ({
      id: entry.eventreihe_id,
      name: entry.oeffentlicher_name ?? entry.name,
      isArchived: entry.ist_archiviert,
    })),
  };
}

export async function loadTeamDetail(actor: AuthorizationActor, teamId: number) {
  const authorizedTeam = await assertTeamAccess(actor, teamId);
  const team = await prisma.teams.findFirstOrThrow({
    where: { team_id: teamId, ...teamScopeWhere(actor) },
    select: {
      team_id: true,
      teamname: true,
      ist_archiviert: true,
      created_at: true,
      updated_at: true,
      avatar_code: true,
      foto_url: true,
      foto_upload_gesperrt: true,
      _count: { select: { quiz_teams: true } },
      quiz_team_sessions: {
        where: scopedSessionWhere(actor),
        orderBy: [{ quiz: { quiz_datum: "desc" } }, { erstellt_am: "desc" }],
        select: {
          erstellt_am: true,
          quiz: {
            select: {
              quiz_id: true,
              titel: true,
              quiz_datum: true,
              eventreihe: {
                select: { eventreihe_id: true, name: true, oeffentlicher_name: true },
              },
            },
          },
        },
      },
    },
  });
  return {
    ...mapTeam(team),
    password: authorizedTeam.team_passwort ?? "",
    profile: mapTeamProfile(team),
    hasHistory: team.quiz_team_sessions.length > 0 || team._count.quiz_teams > 0,
  };
}

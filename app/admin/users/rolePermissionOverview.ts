import { getPresentationTemplateCapabilities } from "@/app/rendering/presentationTemplates/presentationTemplatePermissions";
import {
  canAccessStoryElementLibrary,
  canCreateStoryElement,
  canUseStoryElementScope,
} from "@/app/story-elemente/storyElementPolicy";
import {
  canControlEventSeriesLive,
  canEditEventSeriesQuestions,
  canEditGlobalQuestions,
  canManageEventSeries,
  canManageEventSeriesQuizzes,
  canManageUsers,
  canReviewEventSeriesQuestions,
  hasAnyEditorialAssignment,
  isAdministrator,
  type AuthorizationActor,
  type RoleAssignmentRoleValue,
  type RoleScopeTypeValue,
} from "@/app/roles/roleAssignmentPolicy";
import { canAccessTeamManagement } from "@/app/teams/teamManagementPolicy";

export const ROLE_PERMISSION_PROFILE_IDS = [
  "ADMIN_GLOBAL",
  "EDITOR_GLOBAL",
  "EDITOR_EVENT_SERIES",
  "EVENT_MANAGER_EVENT_SERIES",
] as const;

export type RolePermissionProfileId = (typeof ROLE_PERMISSION_PROFILE_IDS)[number];

export const ROLE_PERMISSION_IDS = [
  "CONTENT_LIBRARY",
  "GLOBAL_QUESTIONS",
  "EVENT_QUESTIONS",
  "EVENT_REVIEW",
  "STORY_LIBRARY",
  "GLOBAL_STORY",
  "EVENT_SERIES",
  "QUIZZES",
  "LIVE",
  "TEMPLATES",
  "CATEGORIES",
  "USERS",
  "TEAMS",
] as const;

export type RolePermissionId = (typeof ROLE_PERMISSION_IDS)[number];
export type RolePermissionAccess = "GLOBAL" | "ASSIGNED_EVENT_SERIES" | "NONE";

type RolePermissionProfile = {
  id: RolePermissionProfileId;
  role: RoleAssignmentRoleValue;
  scopeType: RoleScopeTypeValue;
  actor: AuthorizationActor;
};

const SAMPLE_USER_ID = 1;
const SAMPLE_EVENT_SERIES_ID = 101;

function createProfile(
  id: RolePermissionProfileId,
  role: RoleAssignmentRoleValue,
  scopeType: RoleScopeTypeValue,
): RolePermissionProfile {
  return {
    id,
    role,
    scopeType,
    actor: {
      userId: SAMPLE_USER_ID,
      assignments: [{
        role,
        scopeType,
        eventSeriesId: scopeType === "EVENT_SERIES" ? SAMPLE_EVENT_SERIES_ID : null,
      }],
    },
  };
}

export const ROLE_PERMISSION_PROFILES: readonly RolePermissionProfile[] = [
  createProfile("ADMIN_GLOBAL", "ADMIN", "GLOBAL"),
  createProfile("EDITOR_GLOBAL", "EDITOR", "GLOBAL"),
  createProfile("EDITOR_EVENT_SERIES", "EDITOR", "EVENT_SERIES"),
  createProfile("EVENT_MANAGER_EVENT_SERIES", "EVENT_MANAGER", "EVENT_SERIES"),
];

const permissionChecks: Record<
  RolePermissionId,
  (actor: AuthorizationActor) => boolean
> = {
  CONTENT_LIBRARY: hasAnyEditorialAssignment,
  GLOBAL_QUESTIONS: canEditGlobalQuestions,
  EVENT_QUESTIONS: (actor) => canEditEventSeriesQuestions(actor, SAMPLE_EVENT_SERIES_ID),
  EVENT_REVIEW: (actor) => canReviewEventSeriesQuestions(actor, SAMPLE_EVENT_SERIES_ID),
  STORY_LIBRARY: canAccessStoryElementLibrary,
  GLOBAL_STORY: (actor) => canCreateStoryElement(actor) && canUseStoryElementScope(actor, {
    scope: "GLOBAL",
    eventSeriesId: null,
    quizEventSeriesId: null,
  }),
  EVENT_SERIES: (actor) => canManageEventSeries(actor, SAMPLE_EVENT_SERIES_ID),
  QUIZZES: (actor) => canManageEventSeriesQuizzes(actor, SAMPLE_EVENT_SERIES_ID),
  LIVE: (actor) => canControlEventSeriesLive(actor, SAMPLE_EVENT_SERIES_ID),
  TEMPLATES: (actor) => getPresentationTemplateCapabilities(actor).canView,
  CATEGORIES: isAdministrator,
  USERS: canManageUsers,
  TEAMS: canAccessTeamManagement,
};

function resolveAccess(profile: RolePermissionProfile, granted: boolean): RolePermissionAccess {
  if (!granted) return "NONE";
  return profile.scopeType === "EVENT_SERIES" ? "ASSIGNED_EVENT_SERIES" : "GLOBAL";
}

export function getRolePermissionMatrix() {
  return ROLE_PERMISSION_IDS.map((permissionId) => ({
    permissionId,
    accessByProfile: Object.fromEntries(
      ROLE_PERMISSION_PROFILES.map((profile) => [
        profile.id,
        resolveAccess(profile, permissionChecks[permissionId](profile.actor)),
      ]),
    ) as Record<RolePermissionProfileId, RolePermissionAccess>,
  }));
}

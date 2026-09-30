export function isQuestionRewriteEnabled(
  value = process.env.MISTRAL_QUESTION_REWRITE_ENABLED,
): boolean {
  return value?.trim().toLocaleLowerCase("en-US") === "true";
}
import {
  getActorEventSeriesIds,
  hasGlobalRole,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";


export function canUseQuestionRewrite(actor: AuthorizationActor): boolean {
  return isAdministrator(actor) ||
    hasGlobalRole(actor, "EDITOR") ||
    getActorEventSeriesIds(actor, "EDITOR").length > 0;
}

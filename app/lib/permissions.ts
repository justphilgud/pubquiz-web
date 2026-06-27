import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export function isAdmin(session: Session | null) {
  return session?.user?.role === "ADMIN";
}

export function isEditor(session: Session | null) {
  return session?.user?.role === "EDITOR";
}

export function canManageEverything(session: Session | null) {
  return isAdmin(session);
}

export function canCreateQuestions(session: Session | null) {
  return isAdmin(session) || isEditor(session);
}

export function canEditQuestions(session: Session | null) {
  return isAdmin(session) || isEditor(session);
}

export function canSearchQuestions(session: Session | null) {
  return isAdmin(session) || isEditor(session);
}

export function canApproveQuestions(session: Session | null) {
  return isAdmin(session);
}

export function canAssignQuestionsToQuiz(session: Session | null) {
  return isAdmin(session);
}

export function canManageQuizzes(session: Session | null) {
  return isAdmin(session);
}

export function canModerateQuiz(session: Session | null) {
  return isAdmin(session);
}

export function canViewEvaluation(session: Session | null) {
  return isAdmin(session);
}

export function canSearchUnapprovedQuestions(session: Session | null) {
  return isAdmin(session);
}

export function canCreateApprovedQuestion(session: Session | null) {
  return isAdmin(session);
}

export async function requireSession() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireSession();

  if (!canManageEverything(session)) {
    redirect("/fragen");
  }

  return session;
}

export async function requireQuestionEditor() {
  const session = await requireSession();

  if (!canCreateQuestions(session)) {
    redirect("/login");
  }

  return session;
}

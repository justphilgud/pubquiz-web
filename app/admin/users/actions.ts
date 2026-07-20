"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { generateMemorablePassword } from "@/app/lib/passwordGenerator";
import { logRoleAudit } from "@/app/roles/roleAudit.server";
import {
  assertCanDeactivateUser,
  assertCanRemoveGlobalAdmin,
  legacyRoleForGlobalRoles,
  isGlobalRole,
  replaceGlobalRoleAssignments,
  replaceEventSeriesRoleAssignments,
  RoleAssignmentValidationError,
  type GlobalRole,
} from "@/app/roles/roleAssignmentWrites.server";
import { withSerializableTransaction } from "@/app/roles/serializableTransaction.server";

import { resolveUserRoleSelection } from "./userRoleFormPolicy";

export type UserFormActionResult = {
  success: boolean;
  message: string;
};

class UserFormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFormValidationError";
  }
}

type UserActionOperation = "create" | "update" | "archive";

function userActionFailure(
  operation: UserActionOperation,
  error: unknown,
): UserFormActionResult {
  if (
    error instanceof UserFormValidationError ||
    error instanceof RoleAssignmentValidationError
  ) {
    return { success: false, message: error.message };
  }
  const errorCode =
    typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  console.error("Benutzeraktion fehlgeschlagen", {
    operation,
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode,
  });
  return {
    success: false,
    message: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
  };
}
function globalRolesFromForm(formData: FormData): GlobalRole[] {
  const values = formData.getAll("globalRoles");
  if (!values.every(isGlobalRole)) {
    logRoleAudit("invalid_role_assignment_rejected", { scope: "GLOBAL" });
    throw new UserFormValidationError("Ungültige Rollenzuweisung.");
  }
  return [...new Set(values)];
}

function eventSeriesIdsFromForm(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => Number(value));
}

function roleSelectionFromForm(formData: FormData) {
  const legacyGlobalRoles = globalRolesFromForm(formData);
  try {
    return resolveUserRoleSelection({
      administrator:
        formData.get("roleAdministrator") === "on" ||
        legacyGlobalRoles.includes("ADMIN"),
      editor:
        formData.get("roleEditor") === "on" ||
        legacyGlobalRoles.includes("EDITOR"),
      editorScope: formData.get("editorScope") ?? "GLOBAL",
      editorEventSeriesIds: eventSeriesIdsFromForm(formData, "editorEventSeriesIds"),
      eventManager: formData.get("roleEventManager") === "on",
      eventManagerEventSeriesIds: eventSeriesIdsFromForm(formData, "eventManagerEventSeriesIds"),
    });
  } catch (error) {
    logRoleAudit("invalid_role_assignment_rejected", { scope: "USER_FORM" });
    throw new UserFormValidationError(
      error instanceof Error ? error.message : "Ungültige Rollenzuweisung.",
    );
  }
}

function actorId(session: { user?: { id?: string } }) {
  const id = Number(session.user?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Ungültige Anmeldung.");
  return id;
}

async function assertEventSeriesExist(
  transaction: Parameters<typeof replaceEventSeriesRoleAssignments>[0],
  eventSeriesIds: readonly number[],
) {
  const uniqueIds = [...new Set(eventSeriesIds)];
  if (uniqueIds.length === 0) return;
  const count = await transaction.eventreihen.count({
    where: { eventreihe_id: { in: uniqueIds } },
  });
  if (count !== uniqueIds.length) {
    throw new UserFormValidationError(
      "Mindestens eine angegebene Eventreihe wurde nicht gefunden.",
    );
  }
}

async function createUser(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const roleSelection = roleSelectionFromForm(formData);
  if (!name || !email || !password) {
    throw new UserFormValidationError("Name, E-Mail und Passwort sind Pflichtfelder.");
  }
  if (password.length < 8) {
    throw new UserFormValidationError("Das Passwort muss mindestens 8 Zeichen lang sein.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const assignedById = actorId(session);
  const user = await withSerializableTransaction(async (transaction) => {
    await assertEventSeriesExist(
      transaction,
      roleSelection.eventSeriesAssignments.map(({ eventSeriesId }) => eventSeriesId),
    );
    const created = await transaction.users.create({
      data: {
        name,
        email,
        password_hash: passwordHash,
        role: legacyRoleForGlobalRoles(roleSelection.globalRoles),
        is_active: true,
        must_change_password: true,
      },
      select: { id: true },
    });
    await replaceGlobalRoleAssignments(transaction, {
      userId: created.id,
      roles: roleSelection.globalRoles,
      assignedById,
    });
    await replaceEventSeriesRoleAssignments(transaction, {
      userId: created.id,
      assignments: roleSelection.eventSeriesAssignments,
      assignedById,
    });
    return created;
  });
  logRoleAudit("role_assignment_added", { userId: user.id, scope: "USER_FORM" });
  revalidatePath("/admin/users");
}

export async function createUserAction(
  formData: FormData,
): Promise<UserFormActionResult> {
  try {
    await createUser(formData);
    return { success: true, message: "Benutzer wurde angelegt." };
  } catch (error) {
    return userActionFailure("create", error);
  }
}

async function updateUser(formData: FormData) {
  const session = await requireAdmin();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const roleSelection = roleSelectionFromForm(formData);
  const isActive = formData.get("is_active") === "true";
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!Number.isInteger(id) || id <= 0 || !name || !email) {
    throw new UserFormValidationError("Ungültige Benutzerdaten.");
  }
  const passwordData = newPassword
    ? { password_hash: await bcrypt.hash(newPassword, 12), must_change_password: true }
    : {};
  const assignedById = actorId(session);
  await withSerializableTransaction(async (transaction) => {
    const existing = await transaction.users.findUnique({
      where: { id },
      select: {
        is_active: true,
        rollenzuweisungen: {
          where: { scope_typ: "GLOBAL", rolle: "ADMIN" },
          select: { rollenzuweisung_id: true },
        },
      },
    });
    if (!existing) throw new UserFormValidationError("Benutzer nicht gefunden.");
    if (existing.is_active && existing.rollenzuweisungen.length > 0 &&
      (!isActive || !roleSelection.globalRoles.includes("ADMIN"))) {
      await assertCanRemoveGlobalAdmin(transaction, id);
    }
    if (existing.is_active && !isActive) await assertCanDeactivateUser(transaction, id);
    await assertEventSeriesExist(
      transaction,
      roleSelection.eventSeriesAssignments.map(({ eventSeriesId }) => eventSeriesId),
    );
    await transaction.users.update({
      where: { id },
      data: { name, email, is_active: isActive, ...passwordData },
    });
    await replaceGlobalRoleAssignments(transaction, {
      userId: id,
      roles: roleSelection.globalRoles,
      assignedById,
      verifyLegacy: true,
    });
    await replaceEventSeriesRoleAssignments(transaction, {
      userId: id,
      assignments: roleSelection.eventSeriesAssignments,
      assignedById,
      verifyLegacy: true,
    });
  });
  logRoleAudit("role_assignment_changed", { userId: id, scope: "USER_FORM" });
  revalidatePath("/admin/users");
}

export async function updateUserAction(
  formData: FormData,
): Promise<UserFormActionResult> {
  try {
    await updateUser(formData);
    return { success: true, message: "Benutzer wurde gespeichert." };
  } catch (error) {
    return userActionFailure("update", error);
  }
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Ungültiger Benutzer.");
  const newPassword = generateMemorablePassword();
  await prisma.users.update({
    where: { id },
    data: {
      password_hash: await bcrypt.hash(newPassword, 12),
      must_change_password: true,
    },
  });
  revalidatePath("/admin/users");
  return newPassword;
}

async function archiveUserAccount(formData: FormData) {
  const session = await requireAdmin();
  const currentUserId = actorId(session);
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new UserFormValidationError("Ungültige Benutzer-ID.");
  }
  if (userId === currentUserId) {
    throw new UserFormValidationError("Du kannst dich nicht selbst archivieren.");
  }
  await withSerializableTransaction(async (transaction) => {
    const user = await transaction.users.findUnique({ where: { id: userId }, select: { is_active: true } });
    if (!user) throw new UserFormValidationError("Benutzer nicht gefunden.");
    if (!user.is_active) return;
    await assertCanDeactivateUser(transaction, userId);
    await transaction.users.update({ where: { id: userId }, data: { is_active: false } });
  });
  revalidatePath("/admin/users");
}

export async function archiveUser(
  formData: FormData,
): Promise<UserFormActionResult> {
  try {
    await archiveUserAccount(formData);
    return { success: true, message: "Benutzer wurde archiviert." };
  } catch (error) {
    return userActionFailure("archive", error);
  }
}

export async function reactivateUser(formData: FormData) {
  await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Ungültige Benutzer-ID.");
  const result = await prisma.users.updateMany({
    where: { id: userId, is_active: false },
    data: { is_active: true },
  });
  if (result.count === 0) {
    const exists = await prisma.users.count({ where: { id: userId } });
    if (exists === 0) throw new Error("Benutzer nicht gefunden.");
  }
  revalidatePath("/admin/users");
}

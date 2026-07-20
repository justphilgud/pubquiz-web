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
  isGlobalRole,
  legacyRoleForGlobalRoles,
  replaceGlobalRoleAssignments,
  type GlobalRole,
} from "@/app/roles/roleAssignmentWrites.server";
import { withSerializableTransaction } from "@/app/roles/serializableTransaction.server";

function globalRolesFromForm(formData: FormData): GlobalRole[] {
  const values = formData.getAll("globalRoles");
  if (!values.every(isGlobalRole)) {
    logRoleAudit("invalid_role_assignment_rejected", { scope: "GLOBAL" });
    throw new Error("Ungültige Rollenzuweisung.");
  }
  return [...new Set(values)];
}

function actorId(session: { user?: { id?: string } }) {
  const id = Number(session.user?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Ungültige Anmeldung.");
  return id;
}

export async function createUserAction(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const globalRoles = globalRolesFromForm(formData);
  if (!name || !email || !password) throw new Error("Name, E-Mail und Passwort sind Pflichtfelder.");
  if (password.length < 8) throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  const passwordHash = await bcrypt.hash(password, 12);
  const assignedById = actorId(session);
  const user = await withSerializableTransaction(async (transaction) => {
    const created = await transaction.users.create({
      data: {
        name,
        email,
        password_hash: passwordHash,
        role: legacyRoleForGlobalRoles(globalRoles),
        is_active: true,
        must_change_password: true,
      },
      select: { id: true },
    });
    await replaceGlobalRoleAssignments(transaction, {
      userId: created.id,
      roles: globalRoles,
      assignedById,
    });
    return created;
  });
  logRoleAudit("role_assignment_added", { userId: user.id, scope: "GLOBAL" });
  revalidatePath("/admin/users");
}

export async function updateUserAction(formData: FormData) {
  const session = await requireAdmin();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const globalRoles = globalRolesFromForm(formData);
  const isActive = formData.get("is_active") === "true";
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!Number.isInteger(id) || id <= 0 || !name || !email) {
    throw new Error("Ungültige Benutzerdaten.");
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
    if (!existing) throw new Error("Benutzer nicht gefunden.");
    if (existing.is_active && existing.rollenzuweisungen.length > 0 &&
      (!isActive || !globalRoles.includes("ADMIN"))) {
      await assertCanRemoveGlobalAdmin(transaction, id);
    }
    if (existing.is_active && !isActive) await assertCanDeactivateUser(transaction, id);
    await transaction.users.update({
      where: { id },
      data: { name, email, is_active: isActive, ...passwordData },
    });
    await replaceGlobalRoleAssignments(transaction, {
      userId: id,
      roles: globalRoles,
      assignedById,
      verifyLegacy: true,
    });
  });
  logRoleAudit("role_assignment_changed", { userId: id, scope: "GLOBAL" });
  revalidatePath("/admin/users");
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

export async function archiveUser(formData: FormData) {
  const session = await requireAdmin();
  const currentUserId = actorId(session);
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Ungültige Benutzer-ID.");
  if (userId === currentUserId) throw new Error("Du kannst dich nicht selbst archivieren.");
  await withSerializableTransaction(async (transaction) => {
    const user = await transaction.users.findUnique({ where: { id: userId }, select: { is_active: true } });
    if (!user) throw new Error("Benutzer nicht gefunden.");
    if (!user.is_active) return;
    await assertCanDeactivateUser(transaction, userId);
    await transaction.users.update({ where: { id: userId }, data: { is_active: false } });
  });
  revalidatePath("/admin/users");
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

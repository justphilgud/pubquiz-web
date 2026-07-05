"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { UserRole } from "@/app/generated/prisma/client";
import { generateMemorablePassword } from "@/app/lib/passwordGenerator";
import { auth } from "@/auth";
import { requireUser } from "@/app/lib/auth-guard";

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "EDITOR") as UserRole;

  if (!name || !email || !password) {
    throw new Error("Name, E-Mail und Passwort sind Pflichtfelder.");
  }

  if (!Object.values(UserRole).includes(role)) {
    throw new Error("Ungültige Rolle.");
  }

  if (password.length < 8) {
    throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  }

  const password_hash = await bcrypt.hash(password, 12);

  await prisma.users.create({
    data: {
      name,
      email,
      password_hash,
      role,
      is_active: true,
      must_change_password: true,
    },
  });

  revalidatePath("/admin/users");
}
export async function updateUserAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const role = String(formData.get("role") ?? "EDITOR") as UserRole;
  const is_active = formData.get("is_active") === "true";
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!id || !name || !email) {
    throw new Error("Ungültige Benutzerdaten.");
  }

  const data = {
    name,
    email,
    role,
    is_active,
    ...(newPassword
      ? {
          password_hash: await bcrypt.hash(newPassword, 12),
          must_change_password: true,
        }
      : {}),
  };

  await prisma.users.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/users");
}
export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));

  if (!id) {
    throw new Error("Ungültiger Benutzer.");
  }

  const newPassword = generateMemorablePassword();
  const password_hash = await bcrypt.hash(newPassword, 12);

  await prisma.users.update({
    where: { id },
    data: {
      password_hash,
      must_change_password: true,
    },
  });

  revalidatePath("/admin/users");

  return newPassword;
}

export async function archiveUser(formData: FormData) {
  const session = await requireUser();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const currentUserId = Number(session.user.id);
  const userId = Number(formData.get("userId"));

  if (!Number.isInteger(userId)) {
    throw new Error("Ungültige Benutzer-ID.");
  }

  if (userId === currentUserId) {
    throw new Error("Du kannst dich nicht selbst archivieren.");
  }

  const userToArchive = await prisma.users.findUnique({
    where: { id: userId },
  });

  if (!userToArchive) {
    throw new Error("Benutzer nicht gefunden.");
  }

  if (!userToArchive.is_active) {
    return;
  }

  if (userToArchive.role === "ADMIN") {
    const activeAdminCount = await prisma.users.count({
      where: {
        role: "ADMIN",
        is_active: true,
      },
    });

    if (activeAdminCount <= 1) {
      throw new Error(
        "Der letzte aktive Administrator kann nicht archiviert werden.",
      );
    }
  }

  await prisma.users.update({
    where: { id: userId },
    data: {
      is_active: false,
    },
  });

  revalidatePath("/admin/users");
}

export async function reactivateUser(formData: FormData) {
  const userId = Number(formData.get("userId"));

  if (!Number.isInteger(userId)) {
    throw new Error("Ungültige Benutzer-ID.");
  }

  const userToReactivate = await prisma.users.findUnique({
    where: { id: userId },
  });

  if (!userToReactivate) {
    throw new Error("Benutzer nicht gefunden.");
  }

  if (userToReactivate.is_active) {
    return;
  }

  await prisma.users.update({
    where: { id: userId },
    data: {
      is_active: true,
    },
  });

  revalidatePath("/admin/users");
}

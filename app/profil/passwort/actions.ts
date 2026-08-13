"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { getPasswordValidationError } from "@/app/lib/passwordPolicy";

export type ChangePasswordState = {
  success?: boolean;
  error?: string;
};

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Du bist nicht angemeldet." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Bitte fülle alle Felder aus." };
  }

  const passwordError = getPasswordValidationError(newPassword);
  if (passwordError) return { error: passwordError };

  if (newPassword !== confirmPassword) {
    return { error: "Die neuen Passwörter stimmen nicht überein." };
  }

  const userId = Number(session.user.id);

  const user = await prisma.users.findUnique({
    where: { id: userId },
  });

  if (!user || !user.is_active) {
    return { error: "Benutzer nicht gefunden." };
  }

  const currentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password_hash,
  );

  if (!currentPasswordValid) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.users.update({
    where: { id: userId },
    data: {
      password_hash: newPasswordHash,
      must_change_password: false,
    },
  });

  redirect("/");
}

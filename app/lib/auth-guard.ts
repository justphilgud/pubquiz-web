import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { redirect } from "next/navigation";

type RequireUserOptions = {
  allowPasswordChange?: boolean;
};

export async function requireUser(
  options: RequireUserOptions = {},
) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.users.findUnique({
    where: {
      id: Number(session.user.id),
    },
    select: {
      is_active: true,
      must_change_password: true,
    },
  });

  if (!user || !user.is_active) {
    redirect("/login");
  }

  if (
    user.must_change_password &&
    !options.allowPasswordChange
  ) {
    redirect("/profil/passwort");
  }

  return session;
}
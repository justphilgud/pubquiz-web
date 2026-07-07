import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { Alert, AuthCard, Button, FormField, Input } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    callbackUrl?: string;
  }>;
}) {
  const params = await searchParams;

  async function loginAction(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      const user = await prisma.users.findUnique({
        where: {
          email: email.toLowerCase().trim(),
        },
        select: {
          must_change_password: true,
        },
      });

      const callbackUrl = params?.callbackUrl ?? "/fragen";

      if (user?.must_change_password) {
        redirect("/profil/passwort");
      }

      redirect(callbackUrl);
    } catch (error) {
      if (error instanceof AuthError && error.type === "CredentialsSignin") {
        redirect("/login?error=CredentialsSignin");
      }

      throw error;
    }
  }

  return (
    <AuthCard title="Quizverwaltung">
      {params?.error && (
        <div className="mb-4">
          <Alert variant="danger" title="Login fehlgeschlagen">
            Bitte prüfe deine Zugangsdaten.
          </Alert>
        </div>
      )}

      <form action={loginAction} className="space-y-5">
        <FormField label="E-Mail">
          <Input name="email" type="email" required autoComplete="email" />
        </FormField>

        <FormField label="Passwort">
          <Input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </FormField>

        <div className="flex justify-center pt-2">
          <Button type="submit">Einloggen</Button>
        </div>
      </form>
    </AuthCard>
  );
}

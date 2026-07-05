import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/app/lib/prisma";

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
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>Login</h1>

      {params?.error && (
        <p style={{ color: "red" }}>
          Login fehlgeschlagen. Bitte Zugangsdaten prüfen.
        </p>
      )}

      <form action={loginAction}>
        <div style={{ marginBottom: 16 }}>
          <label>
            E-Mail
            <input
              name="email"
              type="email"
              required
              style={{
                display: "block",
                width: "100%",
                padding: "10px",
                marginTop: "6px",
                border: "1px solid #999",
                borderRadius: "6px",
                background: "white",
                color: "black",
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              required
              style={{
                display: "block",
                width: "100%",
                padding: "10px",
                marginTop: "6px",
                border: "1px solid #999",
                borderRadius: "6px",
                background: "white",
                color: "black",
              }}
            />
          </label>
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 16px",
            border: "1px solid #333",
            borderRadius: "6px",
            background: "white",
            color: "black",
            cursor: "pointer",
          }}
        >
          Einloggen
        </button>
      </form>
    </main>
  );
}

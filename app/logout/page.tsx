import { signOut } from "@/auth";

export default function LogoutPage() {
  async function logoutAction() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>Logout</h1>

      <form action={logoutAction}>
        <button type="submit">Ausloggen</button>
      </form>
    </main>
  );
}

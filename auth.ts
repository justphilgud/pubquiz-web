import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Login",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const user = await prisma.users.findUnique({
          where: { email },
        });

        if (!user) return null;

        const validPassword = await bcrypt.compare(
          password,
          user.password_hash,
        );

        if (!validPassword) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        } as {
          id: string;
          email: string;
          name: string | null;
          role: string;
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.name = user.name;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId);
        session.user.role = String(token.role);
        session.user.name = String(token.name ?? "");
      }

      return session;
    },
  },
});

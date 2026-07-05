import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      name?: string | null;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    name?: string | null;
    mustChangePassword?: boolean;
  }
}

export {};

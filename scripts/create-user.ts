import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../app/generated/prisma/client";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const name = process.argv[2]?.trim();
  const email = process.argv[3]?.toLowerCase().trim();
  const password = process.argv[4];
  const roleInput = process.argv[5] as UserRole | undefined;

  const validRoles = Object.values(UserRole);

  if (!name || !email || !password || !roleInput) {
    throw new Error(
      `Aufruf: npx tsx scripts/create-user.ts <name> <email> <passwort> <rolle>\nGültige Rollen: ${validRoles.join(", ")}`,
    );
  }

  if (!validRoles.includes(roleInput)) {
    throw new Error(
      `Ungültige Rolle "${roleInput}". Gültige Rollen: ${validRoles.join(", ")}`,
    );
  }

  if (password.length < 8) {
    throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  }

  const password_hash = await bcrypt.hash(password, 12);

  await prisma.users.upsert({
    where: { email },
    update: {
      name,
      password_hash,
      role: roleInput,
      is_active: true,
    },
    create: {
      name,
      email,
      password_hash,
      role: roleInput,
      is_active: true,
    },
  });

  console.log("──────────────────────────────");
  console.log("✓ Benutzer gespeichert");
  console.log("");
  console.log(`Name   : ${name}`);
  console.log(`E-Mail : ${email}`);
  console.log(`Rolle  : ${roleInput}`);
  console.log("──────────────────────────────");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

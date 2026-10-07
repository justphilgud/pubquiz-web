import "server-only";
import { Pool } from "pg";
import { requireAdmin } from "../../lib/permissions";
import { readQuizAnalysis } from "./quizAnalysisReader";

// Whole-inventory access includes unpublished and archived content. Keep it
// admin-only; scoped quiz views must use a separately authorized projection.
export async function getEditorialAnalysisSnapshot() {
  await requireAdmin();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    options: "-c default_transaction_read_only=on", max: 1 });
  try {
    const client = await pool.connect();
    try { return await readQuizAnalysis(client); }
    finally { client.release(); }
  } finally { await pool.end(); }
}

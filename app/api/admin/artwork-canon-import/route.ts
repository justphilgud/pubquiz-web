import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { canManageEverything } from "@/app/lib/permissions";
import { deleteExactLegacyE2eQuestions, getArtworkImportStatus, importNextArtwork, validateImportedCatalogue } from "@/app/admin/artwork-canon-import/service.server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireApiAdmin(request: Request) {
  const session = await auth();
  if (!session?.user) throw new Error("NOT_AUTHENTICATED");
  const actor = await getActorForSession(session);
  if (!canManageEverything(actor)) throw new Error("PERMISSION_DENIED");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("ORIGIN_MISMATCH");
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "ARTWORK_IMPORT_FAILED";
  const status = code === "NOT_AUTHENTICATED" ? 401 : code === "PERMISSION_DENIED" ? 403 : 400;
  console.error("[artwork-canon-import]", code);
  return NextResponse.json({ ok: false, code }, { status });
}

export async function GET(request: Request) {
  try {
    await requireApiAdmin(request);
    return NextResponse.json({ ok: true, status: await getArtworkImportStatus() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiAdmin(request);
    const body: unknown = await request.json();
    const action = body && typeof body === "object" ? Reflect.get(body, "action") : null;
    if (action === "IMPORT_NEXT") return NextResponse.json({ ok: true, result: await importNextArtwork() });
    if (action === "VALIDATE") return NextResponse.json({ ok: true, result: await validateImportedCatalogue() });
    if (action === "DELETE_LEGACY_E2E") {
      const confirmation = Reflect.get(body as object, "confirmation");
      return NextResponse.json({ ok: true, status: await deleteExactLegacyE2eQuestions(typeof confirmation === "string" ? confirmation : "") });
    }
    return NextResponse.json({ ok: false, code: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    return failure(error);
  }
}

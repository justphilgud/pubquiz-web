import { requireQuestionEditor } from "@/app/lib/permissions";
import { writeWorkbook } from "../writeWorkbook";

export async function GET(request: Request) {
  await requireQuestionEditor();
  const example = new URL(request.url).searchParams.get("typ") === "beispiel";
  const name = example ? "pubquiz-fragen-beispiel.xlsx" : "pubquiz-fragen-vorlage.xlsx";
  return new Response(new Uint8Array(writeWorkbook(example)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

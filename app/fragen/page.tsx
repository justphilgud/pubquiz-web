import { prisma } from "@/app/lib/prisma";
import FragenWorkspace from "./FragenWorkspace";
import { getAktiveQuizListe } from "@/app/quiz/actions";
import { Suspense } from "react";
import { requireQuestionEditor } from "@/app/lib/permissions";

export default async function FragenPage() {
  await requireQuestionEditor();

  const kategorien = await prisma.fragenkategorie.findMany({
    orderBy: { kategorie: "asc" },
  });

  const antworttypen = await prisma.antworttyp.findMany({
    orderBy: { antworttyp: "asc" },
  });

  const medientypen = await prisma.medientyp.findMany({
    orderBy: { medientyp: "asc" },
  });

  const quizze = await getAktiveQuizListe();

  return (
    <Suspense fallback={<div className="p-8">Lade Fragen...</div>}>
      <FragenWorkspace
        kategorien={kategorien}
        antworttypen={antworttypen}
        medientypen={medientypen}
        quizze={quizze}
      />
    </Suspense>
  );
}

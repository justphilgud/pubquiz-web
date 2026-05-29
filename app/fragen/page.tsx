import { prisma } from "@/lib/prisma";
import FragenWorkspace from "./FragenWorkspace";
import { getAktiveQuizListe } from "@/app/quiz/actions";

export default async function FragenPage() {
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
    <FragenWorkspace
      kategorien={kategorien}
      antworttypen={antworttypen}
      medientypen={medientypen}
      quizze={quizze}
    />
  );
}
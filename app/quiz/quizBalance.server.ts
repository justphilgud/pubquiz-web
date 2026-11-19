import "server-only";
import { prisma } from "@/app/lib/prisma";
import { resolveQuizQuestionAnswerMode } from "./quizQuestionAnswerMode";
import { isQuestionSection } from "./quizSectionPolicy";
import { getQuizBalance, type BalanceCategory } from "./quizBalance";

/** Only IDs returned by the caller's authorized quiz reader. No runtime writes. */
export async function loadQuizBalances(authorizedIds: readonly number[]) {
  if (!authorizedIds.length) return new Map<number, ReturnType<typeof getQuizBalance>>();
  const [quizzes, activeCategories] = await Promise.all([
    prisma.quiz.findMany({ where: { quiz_id: { in: [...authorizedIds] } }, select: {
      quiz_id: true,
      quiz_abschnitte: { orderBy: [{ sortierung: "asc" }, { quiz_abschnitt_id: "asc" }], select: { quiz_abschnitt_id: true, titel: true, abschnitt_typ: true } },
      quiz_fragen: { select: { quiz_abschnitt_id: true, freie_antwort_erlaubt: true, fragen: { select: {
        vorlage: { select: { code: true } }, antworten: { select: { ist_richtig: true } },
        fragen_kategorien: { select: { fragenkategorie: { select: { fragenkategorie_id: true, kategorie: true, status: true } } } },
      } } } },
    } }),
    prisma.fragenkategorie.findMany({ where: { status: "ACTIVE" }, select: { fragenkategorie_id: true, kategorie: true } }),
  ]);
  return new Map(quizzes.map(quiz => {
    const categories = new Map<number, BalanceCategory>(activeCategories.map(c => [c.fragenkategorie_id, { id: c.fragenkategorie_id, name: c.kategorie }]));
    const questions = quiz.quiz_fragen.map(q => {
      const templateId = q.fragen.vorlage?.code ?? null;
      for (const { fragenkategorie: c } of q.fragen.fragen_kategorien) {
        if (!categories.has(c.fragenkategorie_id)) categories.set(c.fragenkategorie_id, { id: c.fragenkategorie_id, name: c.kategorie, availableForSearch: c.status === "ACTIVE" });
      }
      return { sectionId: q.quiz_abschnitt_id, templateId,
        answerMode: resolveQuizQuestionAnswerMode({ templateId, answers: q.fragen.antworten.map(a => ({ isCorrect: a.ist_richtig })), allowFreeAnswer: q.freie_antwort_erlaubt }).effectiveMode,
        categoryIds: q.fragen.fragen_kategorien.map(c => c.fragenkategorie.fragenkategorie_id),
      };
    });
    return [quiz.quiz_id, getQuizBalance({ questions, sections: quiz.quiz_abschnitte.filter(isQuestionSection).map(s => ({ id: s.quiz_abschnitt_id, title: s.titel })), categories: [...categories.values()] })];
  }));
}

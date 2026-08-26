import {
  matchesEvaluationQuestionScope,
  type EvaluationQuestionScope,
} from "./evaluationAnswerFilter";

export type EvaluationMatrixStatus =
  | "NOT_PLAYED"
  | "PENDING"
  | "UNANSWERED"
  | "WRONG"
  | "PARTIAL"
  | "CORRECT"
  | "REVIEW_REQUIRED";

export type EvaluationMatrixAnswerInput = {
  quizQuestionId: number;
  questionNumber: number;
  questionText: string;
  sectionId: number | null;
  sectionTitle: string;
  isPlayed: boolean;
  maximumPointsLabel: string;
  teamName: string;
  isPoll?: boolean;
  isUnanswered: boolean;
  evaluationStatus: EvaluationMatrixStatus;
  answerText: string | null;
  correctAnswer: string;
  awardedPoints: number;
};

export type EvaluationMatrixRankingInput = {
  teamname: string;
  punkte: number;
};

export type EvaluationMatrixCell = {
  status: EvaluationMatrixStatus;
  answerText: string | null;
  correctAnswer: string;
  awardedPoints: number;
  maximumPointsLabel: string;
};

export type EvaluationMatrixQuestion = {
  id: number;
  number: number;
  text: string;
  sectionId: number | null;
  sectionTitle: string;
  isPlayed: boolean;
  maximumPointsLabel: string;
  answered: number;
  correct: number;
  wrong: number;
  partial: number;
  reviewRequired: number;
  pending: number;
  unanswered: number;
  notPlayed: number;
  successRate: number | null;
  averagePoints: number | null;
};

export type EvaluationMatrixTeam = {
  name: string;
  rank: number | null;
  totalPoints: number;
  cells: Record<number, EvaluationMatrixCell>;
};

export type EvaluationMatrix = {
  questions: EvaluationMatrixQuestion[];
  teams: EvaluationMatrixTeam[];
};

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildEvaluationMatrix(input: {
  answers: readonly EvaluationMatrixAnswerInput[];
  ranking: readonly EvaluationMatrixRankingInput[];
}): EvaluationMatrix {
  const answers = input.answers.filter((answer) => !answer.isPoll);
  const questions = new Map<number, Omit<EvaluationMatrixQuestion,
    | "answered"
    | "correct"
    | "wrong"
    | "partial"
    | "reviewRequired"
    | "pending"
    | "unanswered"
    | "notPlayed"
    | "successRate"
    | "averagePoints"
  >>();

  for (const answer of answers) {
    if (!questions.has(answer.quizQuestionId)) {
      questions.set(answer.quizQuestionId, {
        id: answer.quizQuestionId,
        number: answer.questionNumber,
        text: answer.questionText,
        sectionId: answer.sectionId,
        sectionTitle: answer.sectionTitle,
        isPlayed: answer.isPlayed,
        maximumPointsLabel: answer.maximumPointsLabel,
      });
    }
  }

  const orderedQuestions = [...questions.values()].sort((left, right) =>
    left.number - right.number || left.id - right.id
  );
  const rankingByTeam = new Map(
    input.ranking.map((team, index) => [
      team.teamname,
      { rank: index + 1, totalPoints: team.punkte },
    ]),
  );
  const teamNames = Array.from(new Set([
    ...input.ranking.map((team) => team.teamname),
    ...answers.map((answer) => answer.teamName),
  ])).sort((left, right) => {
    const leftRank = rankingByTeam.get(left)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankingByTeam.get(right)?.rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.localeCompare(right, "de");
  });

  const answersByTeamAndQuestion = new Map(
    answers.map((answer) => [
      `${answer.teamName}\u0000${answer.quizQuestionId}`,
      answer,
    ]),
  );
  const teams = teamNames.map((teamName) => {
    const ranking = rankingByTeam.get(teamName);
    const cells = Object.fromEntries(
      orderedQuestions.map((question) => {
        const answer = answersByTeamAndQuestion.get(
          `${teamName}\u0000${question.id}`,
        );
        const status = !question.isPlayed
          ? "NOT_PLAYED"
          : !answer || answer.isUnanswered
          ? "UNANSWERED"
          : answer.evaluationStatus;
        return [question.id, {
          status,
          answerText: answer?.answerText ?? null,
          correctAnswer: answer?.correctAnswer ?? "-",
          awardedPoints: answer?.awardedPoints ?? 0,
          maximumPointsLabel:
            answer?.maximumPointsLabel ?? question.maximumPointsLabel,
        } satisfies EvaluationMatrixCell];
      }),
    );
    return {
      name: teamName,
      rank: ranking?.rank ?? null,
      totalPoints: ranking?.totalPoints ?? 0,
      cells,
    };
  });

  return {
    teams,
    questions: orderedQuestions.map((question) => {
      const cells = teams.map((team) => team.cells[question.id]);
      const answeredCells = cells.filter(
        (cell) =>
          cell.status !== "UNANSWERED" && cell.status !== "NOT_PLAYED",
      );
      const completedCells = answeredCells.filter(
        (cell) => cell.status !== "PENDING",
      );
      const count = (status: EvaluationMatrixStatus) =>
        cells.filter((cell) => cell.status === status).length;
      return {
        ...question,
        answered: answeredCells.length,
        correct: count("CORRECT"),
        wrong: count("WRONG"),
        partial: count("PARTIAL"),
        reviewRequired: count("REVIEW_REQUIRED"),
        pending: count("PENDING"),
        unanswered: count("UNANSWERED"),
        notPlayed: count("NOT_PLAYED"),
        successRate: completedCells.length === 0
          ? null
          : roundOneDecimal(
              (count("CORRECT") / completedCells.length) * 100,
            ),
        averagePoints: completedCells.length === 0
          ? null
          : completedCells.reduce(
              (sum, cell) => sum + cell.awardedPoints,
              0,
            ) / completedCells.length,
      };
    }),
  };
}

export function filterEvaluationMatrixByScope(
  matrix: EvaluationMatrix,
  scope: EvaluationQuestionScope,
): EvaluationMatrix {
  const questions = matrix.questions.filter((question) =>
    matchesEvaluationQuestionScope(
      {
        abschnittId: question.sectionId,
        istGespielt: question.isPlayed,
      },
      scope,
    ),
  );
  const questionIds = new Set(questions.map((question) => question.id));

  return {
    questions,
    teams: matrix.teams.map((team) => ({
      ...team,
      cells: Object.fromEntries(
        Object.entries(team.cells).filter(([questionId]) =>
          questionIds.has(Number(questionId)),
        ),
      ),
    })),
  };
}

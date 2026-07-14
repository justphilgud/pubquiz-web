import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canCreateQuestions,
  canEditQuestion,
} from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import {
  isAllowedQuestionMediaPathname,
  questionMediaRules,
} from "@/app/fragen/editor/questionMedia";
import type { QuestionMediaType } from "@/app/fragen/editor/types";

type UploadContext = {
  questionId: number | null;
  mediaType: QuestionMediaType;
};

function parseUploadContext(clientPayload: string | null): UploadContext {
  if (!clientPayload) {
    throw new Error("Uploadkontext fehlt.");
  }

  const value: unknown = JSON.parse(clientPayload);

  if (!value || typeof value !== "object") {
    throw new Error("Uploadkontext ist ungültig.");
  }

  const questionId = Reflect.get(value, "questionId");
  const mediaType = Reflect.get(value, "mediaType");

  if (
    (questionId !== null &&
      (!Number.isInteger(questionId) || Number(questionId) <= 0)) ||
    (mediaType !== "IMAGE" && mediaType !== "AUDIO")
  ) {
    throw new Error("Uploadkontext ist ungültig.");
  }

  return {
    questionId: questionId === null ? null : Number(questionId),
    mediaType,
  };
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const user = await prisma.users.findUnique({
    where: { id: Number(session.user.id) },
    select: { is_active: true, must_change_password: true },
  });

  if (!user?.is_active || user.must_change_password) {
    return NextResponse.json(
      { error: "Upload nicht erlaubt." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const context = parseUploadContext(clientPayload);

        if (context.questionId === null) {
          if (!canCreateQuestions(session)) {
            throw new Error("Frage darf nicht erstellt werden.");
          }
        } else {
          const question = await prisma.fragen.findUnique({
            where: { fragen_id: context.questionId },
            select: {
              created_by_user_id: true,
              review_status: true,
              ist_archiviert: true,
            },
          });

          if (
            !question ||
            !canEditQuestion(session, {
              createdByUserId: question.created_by_user_id,
              reviewStatus: question.review_status,
              isArchived: question.ist_archiviert,
            })
          ) {
            throw new Error("Frage darf nicht bearbeitet werden.");
          }
        }

        if (!isAllowedQuestionMediaPathname(pathname, context.mediaType)) {
          throw new Error("Dateipfad oder Dateiendung ist ungültig.");
        }

        const rule = questionMediaRules[context.mediaType];
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: [...rule.mimeTypes],
          maximumSizeInBytes: rule.maximumSizeInBytes,
          validUntil,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: [...rule.mimeTypes],
            maximumSizeInBytes: rule.maximumSizeInBytes,
            addRandomSuffix: true,
            validUntil,
          },
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch {
    return NextResponse.json(
      { error: "Upload konnte nicht autorisiert werden." },
      { status: 400 },
    );
  }
}

import { auth } from "@/auth";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { questionRewriteResponse } from "@/app/fragen/editor/questionRewriteEndpoint";
import { isQuestionRewriteEnabled } from "@/app/fragen/editor/questionRewriteFeature.server";
import { createOpenAIQuestionRewriteProvider } from "@/app/fragen/editor/questionRewriteProvider.server";
import { questionRewriteRateLimit } from "@/app/fragen/editor/questionRewriteRateLimit.server";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  return questionRewriteResponse(request, {
    enabled: isQuestionRewriteEnabled,
    actor: async () => {
      const session = await auth();
      return session?.user ? getActorForSession(session) : null;
    },
    provider: createOpenAIQuestionRewriteProvider,
    rateLimit: questionRewriteRateLimit,
  });
}

export type QuestionRewriteRateLimit = {
  acquire(userId: number): boolean;
};

export class InMemoryQuestionRewriteRateLimit implements QuestionRewriteRateLimit {
  private readonly lastRequestByUser = new Map<number, number>();

  constructor(
    private readonly cooldownMs = 2_000,
    private readonly now: () => number = Date.now,
  ) {}

  acquire(userId: number) {
    const now = this.now();
    const previous = this.lastRequestByUser.get(userId);
    if (previous !== undefined && now - previous < this.cooldownMs) return false;
    this.lastRequestByUser.set(userId, now);
    for (const [candidate, requestedAt] of this.lastRequestByUser) {
      if (now - requestedAt > 60_000) this.lastRequestByUser.delete(candidate);
    }
    return true;
  }
}

export const questionRewriteRateLimit = new InMemoryQuestionRewriteRateLimit();

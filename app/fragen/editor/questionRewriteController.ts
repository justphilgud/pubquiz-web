import {
  createQuestionRewriteSessionState,
  discardQuestionRewriteProposal,
  editQuestionRewriteProposal,
  recordQuestionRewriteResult,
  type QuestionRewriteErrorCode,
  type QuestionRewriteResult,
  type QuestionRewriteSessionState,
} from "./questionRewrite";

export type QuestionRewriteViewState = {
  pending: boolean;
  session: QuestionRewriteSessionState;
  error: QuestionRewriteErrorCode | null;
  notice: "stale" | "accepted" | null;
};

export class QuestionRewriteRequestError extends Error {
  constructor(readonly code: QuestionRewriteErrorCode) { super(code); }
}

type RewriteRequest = (text: string, signal: AbortSignal) => Promise<QuestionRewriteResult>;

/** One editor context. Changing text invalidates tickets even after A → B → A. */
export class QuestionRewriteController {
  private state: QuestionRewriteViewState = { pending: false, session: createQuestionRewriteSessionState(), error: null, notice: null };
  private listeners = new Set<() => void>();
  private text = "";
  private inputRevision = -1;
  private ticket = 0;
  private abort: AbortController | null = null;
  private acceptedText: string | null = null;

  constructor(private readonly requestProvider: RewriteRequest) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(next: QuestionRewriteViewState) {
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  setInput(text: string, revision: number) {
    if (this.text === text && this.inputRevision === revision) return;
    const stale = this.state.pending || this.state.session.active !== null;
    this.text = text;
    this.inputRevision = revision;
    this.ticket++;
    this.abort?.abort();
    this.abort = null;
    const accepted = this.state.notice === "accepted" && text === this.acceptedText;
    this.acceptedText = null;
    this.publish({ ...this.state, pending: false, session: discardQuestionRewriteProposal(this.state.session), error: null, notice: stale ? "stale" : accepted ? "accepted" : null });
  }

  async request(text: string, revision: number, disabled: boolean) {
    this.setInput(text, revision);
    if (disabled || this.state.pending || !text.trim()) return;
    const ticket = ++this.ticket;
    const controller = new AbortController();
    this.abort = controller;
    this.publish({ ...this.state, pending: true, error: null, notice: null });
    try {
      const result = await this.requestProvider(text.trim(), controller.signal);
      if (ticket !== this.ticket) return;
      this.publish({ pending: false, error: null, notice: null, session: recordQuestionRewriteResult(this.state.session, { ...result, original: text, id: String(ticket) }) });
    } catch (error) {
      if (ticket !== this.ticket) return;
      this.publish({ ...this.state, pending: false, error: error instanceof QuestionRewriteRequestError ? error.code : "PROVIDER_UNAVAILABLE" });
    } finally {
      if (ticket === this.ticket) this.abort = null;
    }
  }

  edit(proposal: string) {
    this.publish({ ...this.state, session: editQuestionRewriteProposal(this.state.session, proposal), notice: null });
  }
  discard() {
    this.ticket++;
    this.abort?.abort();
    this.abort = null;
    this.publish({ ...this.state, pending: false, session: discardQuestionRewriteProposal(this.state.session), error: null, notice: null });
  }
  accept(text: string, revision: number, disabled: boolean): string | null {
    this.setInput(text, revision);
    const proposal = this.state.session.active?.proposal.trim();
    if (disabled || this.state.pending || !proposal) return null;
    this.acceptedText = proposal;
    this.publish({ ...this.state, session: discardQuestionRewriteProposal(this.state.session), error: null, notice: "accepted" });
    return proposal;
  }
  dispose() {
    this.ticket++;
    this.abort?.abort();
    this.abort = null;
  }
}

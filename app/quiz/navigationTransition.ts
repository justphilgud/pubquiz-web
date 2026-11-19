/** A synchronous gate: repeated input never queues another live command. */
export class NavigationTransition {
  private pending = false;

  get busy() { return this.pending; }

  async run(action: () => Promise<void>): Promise<boolean> {
    if (this.pending) return false;
    this.pending = true;
    try { await action(); return true; }
    finally { this.pending = false; }
  }
}

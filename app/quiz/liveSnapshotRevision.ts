/** A poll begun before an explicit action must never undo its newer result. */
export function mayApplyLiveSnapshot(requestRevision: number, currentRevision: number, active: boolean, pending: boolean) {
  return active && !pending && requestRevision === currentRevision;
}

export function buildQuizOwnershipContext(eventSeriesId: number) {
  return {
    ownerUserId: null,
    eventSeriesId,
  };
}

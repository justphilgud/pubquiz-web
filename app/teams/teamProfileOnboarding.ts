export function shouldOpenTeamProfileOnboarding(input: {
  teamWasCreated: boolean;
  teamAlreadyJoinedQuiz: boolean;
}) {
  return input.teamWasCreated || !input.teamAlreadyJoinedQuiz;
}

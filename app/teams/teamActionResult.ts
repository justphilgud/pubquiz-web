export type TeamActionResult = {
  success: boolean;
  message: string;
};

export const INITIAL_TEAM_ACTION_RESULT: TeamActionResult = {
  success: false,
  message: "",
};

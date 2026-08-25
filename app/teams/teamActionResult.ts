export type TeamActionResult = {
  success: boolean;
  message: string;
  revealedPassword?: string;
  deleted?: boolean;
};

export const INITIAL_TEAM_ACTION_RESULT: TeamActionResult = {
  success: false,
  message: "",
};

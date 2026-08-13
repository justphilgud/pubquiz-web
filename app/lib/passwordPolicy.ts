export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRequirementResult = {
  id: "minimumLength";
  label: string;
  met: boolean;
};

export function getPasswordRequirementResults(
  password: string,
): PasswordRequirementResult[] {
  return [
    {
      id: "minimumLength",
      label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
  ];
}

export function getPasswordValidationError(password: string): string | null {
  return getPasswordRequirementResults(password).every((requirement) => requirement.met)
    ? null
    : `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`;
}

export function isPasswordValid(password: string) {
  return getPasswordValidationError(password) === null;
}

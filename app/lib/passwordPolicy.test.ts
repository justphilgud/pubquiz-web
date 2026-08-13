import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getPasswordRequirementResults,
  getPasswordValidationError,
  PASSWORD_MIN_LENGTH,
} from "./passwordPolicy";

const passwordForm = readFileSync("app/profil/passwort/ChangePasswordForm.tsx", "utf8");
const passwordInput = readFileSync("app/components/PasswordInput.tsx", "utf8");
const passwordAction = readFileSync("app/profil/passwort/actions.ts", "utf8");
const userActions = readFileSync("app/admin/users/actions.ts", "utf8");

test("password policy exposes only the actually enforced minimum length", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.deepEqual(getPasswordRequirementResults("1234567"), [{
    id: "minimumLength",
    label: "Mindestens 8 Zeichen",
    met: false,
  }]);
  assert.equal(getPasswordValidationError("12345678"), null);
  assert.match(getPasswordValidationError("short") ?? "", /mindestens 8 Zeichen/i);
});

test("client help and both server flows consume the central password policy", () => {
  assert.match(passwordForm, /PasswordRequirements/);
  assert.match(passwordForm, /PASSWORD_MIN_LENGTH/);
  assert.match(passwordAction, /getPasswordValidationError/);
  assert.match(userActions, /getPasswordValidationError/);
});

test("each password field owns an accessible persistent visibility toggle", () => {
  assert.match(passwordForm, /Aktuelles Passwort/);
  assert.match(passwordForm, /Neues Passwort/);
  assert.match(passwordForm, /Neues Passwort wiederholen/);
  assert.match(passwordInput, /useState\(false\)/);
  assert.match(passwordInput, /aria-label/);
  assert.match(passwordInput, /aria-pressed/);
  assert.doesNotMatch(passwordInput, /onBlur/);
});

test("password confirmation gives immediate non-color-only feedback", () => {
  assert.match(passwordForm, /Passwörter stimmen überein/);
  assert.match(passwordForm, /Passwörter stimmen nicht überein/);
  assert.match(passwordForm, /aria-live="polite"/);
  assert.match(passwordForm, /✓/);
});

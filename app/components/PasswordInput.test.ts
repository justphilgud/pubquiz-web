import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { passwordInputType } from "./PasswordInput";

const passwordInput = readFileSync("app/components/PasswordInput.tsx", "utf8");
const login = readFileSync("app/login/page.tsx", "utf8");
const createUser = readFileSync("app/admin/users/CreateUserDialog.tsx", "utf8");
const editUser = readFileSync("app/admin/users/EditUserDialog.tsx", "utf8");
const teamPasswordPanel = readFileSync("app/admin/teams/TeamPasswordPanel.tsx", "utf8");

test("password visibility changes only the input type", () => {
  assert.equal(passwordInputType(false), "password");
  assert.equal(passwordInputType(true), "text");
  assert.match(passwordInput, /type=\{passwordInputType\(visible\)\}/);
  assert.match(passwordInput, /EyeIcon/);
  assert.match(passwordInput, /EyeSlashIcon/);
});

test("login and user management share the password control", () => {
  assert.match(login, /<PasswordInput[\s\S]+autoComplete="current-password"/);
  for (const source of [createUser, editUser]) {
    assert.match(source, /<PasswordInput/);
    assert.match(source, /generateMemorablePassword/);
  }
  assert.match(passwordInput, /BeakerIcon/);
});

test("team password generation changes the draft and saves only through the form", () => {
  assert.match(teamPasswordPanel, /onGenerate=\{\(\) => setPassword\(generateTeamPassword\(\)\)\}/);
  assert.match(teamPasswordPanel, /action=\{formAction\}/);
  assert.match(teamPasswordPanel, /Dieses Team-Passwort gilt in allen Eventreihen\./);
  assert.doesNotMatch(teamPasswordPanel, /revealTeamPasswordAction|randomizeTeamPasswordAction/);
});

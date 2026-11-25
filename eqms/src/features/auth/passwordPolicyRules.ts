import type { PasswordPolicy } from "@/services/api/auth";
import { tr, trFormat, trPlural } from "@/i18n";

export interface PasswordCheck {
  key: string;
  label: string;
  met: boolean;
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd", "p@ssword", "admin", "admin123",
  "administrator", "welcome", "welcome1", "welcome123", "letmein", "qwerty", "qwerty123", "qwertyuiop",
  "abc123", "abcd1234", "iloveyou", "monkey", "dragon", "master", "login", "changeme", "changeme123",
  "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "123123", "654321",
  "trustno1", "sunshine", "football", "baseball", "superman", "internet", "eqms", "eqms123",
]);

const hasRepeatedRun = (password: string, maxRun: number) => {
  let run = 1;
  for (let i = 1; i < password.length; i += 1) {
    run = password[i] === password[i - 1] ? run + 1 : 1;
    if (run > maxRun) return true;
  }
  return false;
};

const isAlnum = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

const hasSequentialRun = (password: string) => {
  const p = password.toLowerCase();
  let up = 1;
  let down = 1;
  for (let i = 1; i < p.length; i += 1) {
    const alnum = isAlnum(p[i]) && isAlnum(p[i - 1]);
    up = alnum && p.charCodeAt(i) === p.charCodeAt(i - 1) + 1 ? up + 1 : 1;
    down = alnum && p.charCodeAt(i) === p.charCodeAt(i - 1) - 1 ? down + 1 : 1;
    if (up >= 3 || down >= 3) return true;
  }
  return false;
};

/**
 * The "not one of your last N passwords" rule as a sentence, or null when the policy does not prevent reuse.
 * Only the server can check it (it holds the hashes), so it is a note beside the checklist and never a tick.
 */
export const passwordReuseNote = (policy: PasswordPolicy): string | null => {
  const count = policy.passwordHistoryCount ?? 0;
  if (!policy.preventPasswordReuse || count <= 0) return null;
  return trPlural(count, "Must be different from your last {count} password. This is checked when you save.", "Must be different from your last {count} passwords. This is checked when you save.");
};

/**
 * Builds the checklist for the admin-configured password policy. Mirrors
 * SystemConfigurationService#validatePasswordPolicy on the server, which stays authoritative.
 * `userTokens` (username, e-mail name, name parts) enables the "no user information" rule when known.
 */
export const evaluatePasswordPolicy = (password: string, policy: PasswordPolicy, userTokens: string[] = []) => {
  const checks: PasswordCheck[] = [
    { key: "minLength", label: trFormat("At least {count} characters", { count: policy.passwordMinLength }), met: password.length >= policy.passwordMinLength },
  ];
  if (policy.requireUppercase) checks.push({ key: "upper", label: tr("One uppercase letter"), met: /[A-Z]/.test(password) });
  if (policy.requireLowercase) checks.push({ key: "lower", label: tr("One lowercase letter"), met: /[a-z]/.test(password) });
  if (policy.requireNumbers) checks.push({ key: "number", label: tr("One number"), met: /\d/.test(password) });
  if (policy.requireSpecialChars) checks.push({ key: "special", label: tr("One special character"), met: /[^a-zA-Z0-9]/.test(password) });
  if (policy.minUniqueChars && policy.minUniqueChars > 0) {
    checks.push({ key: "unique", label: trFormat("At least {count} different characters", { count: policy.minUniqueChars }), met: new Set(password).size >= policy.minUniqueChars });
  }
  if (policy.maxRepeatedChars && policy.maxRepeatedChars > 0) {
    checks.push({ key: "repeat", label: trFormat("No more than {count} repeated characters in a row", { count: policy.maxRepeatedChars }), met: !hasRepeatedRun(password, policy.maxRepeatedChars) });
  }
  if (policy.disallowSequentialChars) {
    checks.push({ key: "sequence", label: tr("No sequences (abc, 123)"), met: !hasSequentialRun(password) });
  }
  if (policy.disallowWhitespace) {
    checks.push({ key: "space", label: tr("No spaces"), met: !/\s/.test(password) });
  }
  if (policy.disallowCommonPasswords) {
    checks.push({ key: "common", label: tr("Not a commonly used password"), met: !COMMON_PASSWORDS.has(password.toLowerCase()) });
  }
  if (policy.disallowUserInfo) {
    const lower = password.toLowerCase();
    const usesInfo = userTokens.some((token) => token.trim().length >= 3 && lower.includes(token.trim().toLowerCase()));
    checks.push({ key: "userInfo", label: tr("Does not contain your username, e-mail or name"), met: !usesInfo });
  }
  const score = checks.filter((check) => check.met).length;
  return { checks, score, maxScore: checks.length, isValid: score === checks.length };
};

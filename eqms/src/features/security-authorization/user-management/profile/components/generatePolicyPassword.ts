import type { PasswordPolicy } from "@/services/api/auth";
import { evaluatePasswordPolicy } from "@/features/auth/passwordPolicyRules";

// Letters and digits that are easy to tell apart when read out or typed (no I, O, l, 0, 1).
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%^&*-_+=?";
const SUGGESTED_LENGTH = 14;
const MAX_ATTEMPTS = 200;

/** A number from 0 to max - 1 from the browser's secure random source, without modulo bias. */
const randomBelow = (max: number): number => {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
};

const pick = (chars: string) => chars[randomBelow(chars.length)];

const shuffle = (chars: string[]): string[] => {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
};

/**
 * A suggested password that follows the rules in Security > Password Rules: at least the minimum length (14 characters or more), one of each kind of
 * character (so every "required" rule holds whatever is switched on), no spaces, and drawn again until the same checker that judges what is typed accepts it
 * (sequences, repeated characters, different characters, the person's own name). The server checks it again, and has the last word.
 */
export function generatePolicyPassword(policy: PasswordPolicy, userTokens: string[] = []): string {
  const length = Math.min(128, Math.max(policy.passwordMinLength || 8, SUGGESTED_LENGTH, policy.minUniqueChars ?? 0));
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  let candidate = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
    while (chars.length < length) chars.push(pick(all));
    candidate = shuffle(chars).join("");
    if (evaluatePasswordPolicy(candidate, policy, userTokens).isValid) return candidate;
  }
  return candidate;
}

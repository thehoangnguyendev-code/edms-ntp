import { afterEach, describe, expect, it } from "vitest";
import { setCatalogLanguage } from "@/i18n/catalog";
import { formatRelativeTime } from "../format";
import { evaluatePasswordPolicy } from "@/features/auth/passwordPolicyRules";
import type { PasswordPolicy } from "@/services/api/auth";

const ago = (ms: number) => new Date(Date.now() - ms);
const POLICY = { passwordMinLength: 12, requireUppercase: true, minUniqueChars: 5, maxRepeatedChars: 2 } as PasswordPolicy;

describe("words that carry a count are translated, not built with an English plural", () => {
  afterEach(() => setCatalogLanguage("en"));

  it("says the age in English with a plural", () => {
    expect(formatRelativeTime(ago(60_000))).toBe("1 minute ago");
    expect(formatRelativeTime(ago(5 * 60_000))).toBe("5 minutes ago");
    expect(formatRelativeTime(ago(3 * 24 * 3_600_000))).toBe("3 days ago");
  });

  it("says the age in Vietnamese with no English word or 's'", () => {
    setCatalogLanguage("vi");
    expect(formatRelativeTime(ago(5 * 60_000))).toBe("5 phút trước");
    expect(formatRelativeTime(ago(2 * 3_600_000))).toBe("2 giờ trước");
    expect(formatRelativeTime(ago(3 * 24 * 3_600_000))).toBe("3 ngày trước");
    expect(formatRelativeTime(ago(1000))).toBe("vừa xong");
  });

  it("writes the checklist of the password policy in Vietnamese", () => {
    setCatalogLanguage("vi");
    const labels = evaluatePasswordPolicy("x", POLICY).checks.map((c) => c.label);
    expect(labels).toEqual(["Ít nhất 12 ký tự", "Một chữ in hoa", "Ít nhất 5 ký tự khác nhau", "Không quá 2 ký tự lặp liên tiếp"]);
  });
});

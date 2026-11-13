import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptData, encryptData, secureStorage } from "../security";

const KEY = "EQMS_SECRET_KEY_2026";
/** The scheme that was used before: it worked on characters, so it could not hold a character beyond Latin-1. */
const legacyEncrypt = (data: string) => btoa(Array.from(data).map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length))).join(""));

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the value kept in the browser storage", () => {
  it.each(["", "abc", "Nguyễn Thế Hoàng", "Trưởng phòng Kiểm nghiệm", '{"fullName":"Đoàn Thu Hà","department":"Phòng Đảm bảo chất lượng"}', "😀 emoji and 日本語"])(
    "comes back as it was written: %s",
    (text) => {
      expect(decryptData(encryptData(text))).toBe(text);
    },
  );

  it("is not the plain text, even for a name with accents", () => {
    expect(encryptData("Nguyễn Thế Hoàng")).not.toContain("Nguyễn");
    expect(encryptData("abc")).not.toBe("abc");
  });

  it("does not write an error to the console for a name with accents", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    secureStorage.setItem("user", '{"fullName":"Nguyễn Thế Hoàng"}');
    expect(secureStorage.getItem("user")).toBe('{"fullName":"Nguyễn Thế Hoàng"}');
    expect(error).not.toHaveBeenCalled();
  });

  it("still reads a value written by the older scheme, and a text that the older scheme stored as it was", () => {
    expect(decryptData(legacyEncrypt("token-123"))).toBe("token-123");
    expect(decryptData("Nguyễn Thế Hoàng")).toBe("Nguyễn Thế Hoàng");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(decryptData("plain text, not Base64")).toBe("plain text, not Base64");
    expect(error).not.toHaveBeenCalled();
  });

  it("a damaged value of the present scheme is returned, not thrown", () => {
    expect(() => decryptData("u8:!!!not base64!!!")).not.toThrow();
  });

  it("is kept and read through the storage helper, and a missing key is null", () => {
    expect(secureStorage.getItem("nothing")).toBeNull();
    secureStorage.setItem("k", "Đoàn Thu Hà");
    expect(localStorage.getItem("k")).not.toContain("Đoàn");
    expect(secureStorage.getItem("k")).toBe("Đoàn Thu Hà");
  });
});

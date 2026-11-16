import { describe, expect, it } from "vitest";
import { getInitials } from "../format";

describe("getInitials", () => {
  it("takes the first letters of the first two words of a name", () => {
    expect(getInitials("Nguyen The Hoang")).toBe("NT");
    expect(getInitials("Approver Test 1")).toBe("AT");
    expect(getInitials("Mai")).toBe("M");
    expect(getInitials("nguyễn văn tâm")).toBe("NV");
  });

  it("ignores a part in brackets, which is not a word of the name", () => {
    expect(getInitials("System (Automated)")).toBe("S");
    expect(getInitials("Do Thi Lan (UAT)")).toBe("DT");
    expect(getInitials("Training Manager (Test) 2")).toBe("TM");
  });

  it("gives no initial for a word that does not start with a letter or a digit", () => {
    expect(getInitials("- Admin")).toBe("A");
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { scanFileName } from "../scanFileName";

describe("scanFileName", () => {
  it("is the Training Number, the employee code and the name, with the extension of the uploaded file", () => {
    expect(scanFileName("TRN/QA/26-1976", { employeeCode: "UAT31-011", fullName: "Bùi Thị Hoa (UAT)" }, "test-uat31.s2.qa.absent.PDF")).toBe("TRN-QA-26-1976_UAT31-011_Bùi Thị Hoa (UAT).pdf");
  });

  it("leaves out the code of a person from outside the company", () => {
    expect(scanFileName("TRN/QA/26-1976a", { employeeCode: null, fullName: "Guest Trainer" }, "scan.pdf")).toBe("TRN-QA-26-1976a_Guest Trainer.pdf");
  });

  it("numbers the scans when a person has more than one", () => {
    expect(scanFileName("TRN/QA/26-1", { employeeCode: "E1", fullName: "A B" }, "x.pdf", 1, 2)).toBe("TRN-QA-26-1_E1_A B_2.pdf");
    expect(scanFileName("TRN/QA/26-1", { employeeCode: "E1", fullName: "A B" }, "x.pdf", 0, 1)).toBe("TRN-QA-26-1_E1_A B.pdf");
  });

  it("removes the characters a file name cannot hold", () => {
    expect(scanFileName("TRN/QA/26-1", { employeeCode: "E:1", fullName: "A*B?" }, "noextension")).toBe("TRN-QA-26-1_E-1_A-B-");
  });
});

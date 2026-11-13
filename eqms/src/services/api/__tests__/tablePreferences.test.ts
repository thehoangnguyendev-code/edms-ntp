import { describe, expect, it } from "vitest";
import { serverTableKey } from "../tablePreferences";

const SERVER_KEY = /^[a-z0-9._-]{1,120}$/;

describe("the table key sent to the server", () => {
  it("is always one the server accepts", () => {
    for (const key of ["reportDefinitions", "reportRunPreview", "docTypes", "publishingTemplates", "reportTemplateAccessScope", "documents.list", "training.record.exports", "access-profiles.list", "users.list"]) {
      expect(serverTableKey(key)).toMatch(SERVER_KEY);
    }
  });
  it("turns a camel case name into lower case with hyphens, and leaves an accepted key alone", () => {
    expect(serverTableKey("reportDefinitions")).toBe("report-definitions");
    expect(serverTableKey("reportRunPreview")).toBe("report-run-preview");
    expect(serverTableKey("documents.list")).toBe("documents.list");
    expect(serverTableKey("access-profiles.list")).toBe("access-profiles.list");
  });
  it("gives two different screens two different keys", () => {
    expect(serverTableKey("reportRuns")).not.toBe(serverTableKey("reportRunArtifacts"));
  });
});

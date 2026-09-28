import { describe, expect, it } from "vitest";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import {
  buildCrumbs,
  cardsToFolders,
  folderColor,
  navKey,
  parentOf,
  parseDateValue,
  pluralize,
  sortDocuments,
  sortFolders,
  typeAbbreviation,
  typeColor,
  type ExplorerNav,
} from "../explorerModel";

const doc = (id: string, name: string, extra: Partial<KnowledgePortalDocument> & { effectiveDate?: string } = {}): KnowledgePortalDocument => ({
  document: { id, documentNumber: `NO.${id}`, documentName: name, effectiveDate: extra.effectiveDate },
  views: extra.views ?? 0,
  helpfulVotes: extra.helpfulVotes ?? 0,
  featured: false,
  myFeedback: null,
});

describe("typeAbbreviation", () => {
  it("keeps short single words and shortens long ones", () => {
    expect(typeAbbreviation("SOP")).toBe("SOP");
    expect(typeAbbreviation("Policy")).toBe("POL");
    expect(typeAbbreviation("Annex")).toBe("ANN");
  });
  it("uses initials for multi-word types", () => {
    expect(typeAbbreviation("Work Instruction")).toBe("WI");
    expect(typeAbbreviation("Standard Operating Procedure")).toBe("SOP");
    expect(typeAbbreviation("a b c d e")).toBe("ABC");
  });
  it("falls back for empty values", () => {
    expect(typeAbbreviation(null)).toBe("DOC");
    expect(typeAbbreviation("   ")).toBe("DOC");
  });
});

describe("colours", () => {
  it("are stable and case-insensitive", () => {
    expect(typeColor("SOP")).toBe(typeColor("sop"));
    expect(typeColor("SOP")).toBe(typeColor("SOP"));
    expect(folderColor("Production")).toBe(folderColor(" production "));
    expect(typeColor("SOP")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("parseDateValue", () => {
  it("reads display and ISO dates and ignores garbage", () => {
    expect(parseDateValue("03/09/2026")).toBe(new Date(2026, 8, 3).getTime());
    expect(parseDateValue("03/09/2026 10:30:15")).toBe(new Date(2026, 8, 3, 10, 30, 15).getTime());
    expect(parseDateValue("2026-09-03T00:00:00Z")).toBe(Date.parse("2026-09-03T00:00:00Z"));
    expect(parseDateValue("nonsense")).toBe(0);
    expect(parseDateValue(null)).toBe(0);
  });
});

describe("sorting", () => {
  const docs = [
    doc("1", "Beta", { views: 5, helpfulVotes: 9, effectiveDate: "01/01/2026" }),
    doc("2", "alpha", { views: 20, helpfulVotes: 1, effectiveDate: "01/06/2026" }),
    doc("3", "Gamma 10", { views: 20, helpfulVotes: 5, effectiveDate: "01/03/2026" }),
    doc("4", "Gamma 2", { views: 1, helpfulVotes: 5 }),
  ];
  const names = (list: KnowledgePortalDocument[]) => list.map((d) => d.document.documentName);

  it("sorts by name ignoring case and comparing numbers naturally", () => {
    expect(names(sortDocuments(docs, "name"))).toEqual(["alpha", "Beta", "Gamma 2", "Gamma 10"]);
  });
  it("sorts by views with the name as tie-breaker", () => {
    expect(names(sortDocuments(docs, "views"))).toEqual(["alpha", "Gamma 10", "Beta", "Gamma 2"]);
  });
  it("sorts by helpful votes", () => {
    expect(names(sortDocuments(docs, "helpful"))).toEqual(["Beta", "Gamma 2", "Gamma 10", "alpha"]);
  });
  it("sorts by newest effective date, documents without a date last", () => {
    expect(names(sortDocuments(docs, "newest"))).toEqual(["alpha", "Gamma 10", "Beta", "Gamma 2"]);
  });
  it("does not mutate its input", () => {
    const before = names(docs);
    sortDocuments(docs, "views");
    expect(names(docs)).toEqual(before);
  });
  it("sorts folders by name, or by size when asked for popularity", () => {
    const folders = cardsToFolders([
      { key: "a", label: "Zeta", documentCount: 9, subscribed: false },
      { key: "b", label: "Alpha", documentCount: 2, subscribed: true },
    ]);
    expect(sortFolders(folders, "name").map((f) => f.label)).toEqual(["Alpha", "Zeta"]);
    expect(sortFolders(folders, "views").map((f) => f.label)).toEqual(["Zeta", "Alpha"]);
    expect(folders.every((f) => f.isKnowledgeBase)).toBe(true);
    expect(folders[1].subscribed).toBe(true);
  });
});

describe("navigation helpers", () => {
  const kb = { key: "qa", label: "Quality" };
  it("builds unique keys", () => {
    expect(navKey({ kind: "home" })).toBe("home");
    expect(navKey({ kind: "smart", key: "viewed" })).toBe("smart:viewed");
    expect(navKey({ kind: "kb", kb, path: ["a", "b"] })).toBe("kb:qa:a/b");
    expect(navKey({ kind: "kb", kb, path: [] })).not.toBe(navKey({ kind: "kb", kb, path: ["a"] }));
  });

  it("goes up one level at a time and stops at home", () => {
    const deep: ExplorerNav = { kind: "kb", kb, path: ["a", "b"] };
    expect(parentOf(deep)).toEqual({ kind: "kb", kb, path: ["a"] });
    expect(parentOf({ kind: "kb", kb, path: ["a"] })).toEqual({ kind: "kb", kb, path: [] });
    expect(parentOf({ kind: "kb", kb, path: [] })).toEqual({ kind: "home" });
    expect(parentOf({ kind: "smart", key: "featured" })).toEqual({ kind: "home" });
    expect(parentOf({ kind: "home" })).toBeNull();
  });

  it("builds breadcrumbs whose links go back to the matching folder", () => {
    const crumbs = buildCrumbs({ kind: "kb", kb, path: ["prod", "sop"] }, [{ label: "Quality" }, { label: "Production" }, { label: "SOP" }]);
    expect(crumbs.map((c) => c.label)).toEqual(["Knowledge Base", "Quality", "Production", "SOP"]);
    expect(crumbs[0].nav).toEqual({ kind: "home" });
    expect(crumbs[1].nav).toEqual({ kind: "kb", kb, path: [] });
    expect(crumbs[2].nav).toEqual({ kind: "kb", kb, path: ["prod"] });
    expect(crumbs[3].nav).toBeNull();
  });

  it("falls back to the knowledge base label while the folder is still loading", () => {
    expect(buildCrumbs({ kind: "kb", kb, path: [] }, undefined).map((c) => c.label)).toEqual(["Knowledge Base", "Quality"]);
  });

  it("shows the search term and the smart list names", () => {
    expect(buildCrumbs({ kind: "home" }, undefined, "capa").map((c) => c.label)).toEqual(["Knowledge Base", "Search: capa"]);
    expect(buildCrumbs({ kind: "smart", key: "useful" }, undefined).map((c) => c.label)).toEqual(["Knowledge Base", "Most helpful"]);
    expect(buildCrumbs({ kind: "home" }, undefined)).toHaveLength(1);
  });
});

describe("pluralize", () => {
  it("handles one and many", () => {
    expect(pluralize(1, "document")).toBe("1 document");
    expect(pluralize(0, "document")).toBe("0 documents");
    expect(pluralize(2, "vote")).toBe("2 votes");
  });
});

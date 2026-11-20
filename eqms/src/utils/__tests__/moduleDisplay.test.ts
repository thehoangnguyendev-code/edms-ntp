import { describe, expect, it } from "vitest";
import { canonicalModuleKey, knownModuleName, moduleDisplayName, moduleOrderFromMenu, moduleSelectOptions, sortModulesLikeMenu } from "../moduleDisplay";

describe("a module is shown by the name of its menu", () => {
  it.each([
    ["documents", "Document Control"],
    ["DOCUMENT_CONTROL", "Document Control"],
    ["document-control", "Document Control"],
    ["training", "Training Management"],
    ["TRAINING", "Training Management"],
    ["report", "Reports"],
    ["REPORTS", "Reports"],
    ["audit-trail", "Audit Trail"],
    ["AUDIT_TRAIL", "Audit Trail"],
    ["backup", "Backup & Restore"],
    ["BACKUP_RESTORE", "Backup & Restore"],
    ["Backup & Restore", "Backup & Restore"],
    ["security", "Security & Authorization"],
    ["security-authorization", "Security & Authorization"],
    ["app-settings", "Application Settings"],
    ["settings", "Application Settings"],
    ["system-admin", "System Administration"],
    ["self_service", "Self-Service"],
    ["CONTROLLED_COPIES", "Controlled Copies"],
    ["ACCESS_REVIEW", "Access Review"],
    ["SECURITY_REVIEW", "Access Review & Audit Trail Review"],
  ])("%s -> %s", (key, name) => expect(moduleDisplayName(key)).toBe(name));

  it("a key that is not named yet is made readable, and nothing is shown as Other", () => {
    expect(moduleDisplayName("some_new-module")).toBe("Some New Module");
    expect(moduleDisplayName("System")).toBe("System");
    expect(moduleDisplayName("")).toBe("Other");
    expect(moduleDisplayName(null)).toBe("Other");
  });

  it("knownModuleName answers only for the keys the system knows", () => {
    expect(knownModuleName("TRAINING")).toBe("Training Management");
    expect(knownModuleName("Users")).toBeNull();
  });

  it("the spellings of one module are one option, found by one key", () => {
    expect(canonicalModuleKey("report")).toBe("reports");
    expect(canonicalModuleKey("REPORTS")).toBe("reports");
    expect(canonicalModuleKey("app-settings")).toBe("settings");
    const options = moduleSelectOptions(["report", "reports", "settings", "app-settings", "documents", "DOCUMENT_CONTROL", "training"]);
    expect(options).toEqual([
      { label: "Application Settings", value: "settings" },
      { label: "Document Control", value: "documents" },
      { label: "Reports", value: "reports" },
      { label: "Training Management", value: "training" },
    ]);
  });
});

describe("module order like the sidebar", () => {
  it("reads the order of the top-level items of the menu, with Dashboard after Self-Service", () => {
    const menu = [{ id: "notifications" }, { id: "self-service" }, { id: "doc-control" }, { id: "report" }, { id: "unknown-item" }, { id: "settings" }];
    expect(moduleOrderFromMenu(menu)).toEqual(["Notifications", "Self-Service", "Dashboard", "Document Control", "Reports", "Application Settings"]);
  });

  it("sorts the chips in menu order and puts a module the menu does not know last", () => {
    const names = ["Reports", "Backup & Restore", "Something New", "Document Control", "Notifications"];
    expect(sortModulesLikeMenu(names, (n) => n)).toEqual(["Notifications", "Document Control", "Reports", "Backup & Restore", "Something New"]);
  });
});

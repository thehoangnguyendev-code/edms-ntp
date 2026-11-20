import type { DocumentControlVisibility } from "@/services/api/settings";

/**
 * Document Control visibility (DC-VISIBILITY-TIERS-2026-11-07, VISIBILITY-TIERS-2026-11-20). A person with a name in a flow sees exactly that; a
 * profile that grants the department permission lets its people also see every Document and Revision of their own Department; a profile that
 * grants the three view-all permissions together lets its people see everything (drafts included). The server computes the label of a profile
 * from its permissions; this file only holds the codes, the display text and the rule that turns a choice into permissions.
 */
export const DOCUMENT_CONTROL_VIEW_ALL_CODES = [
  "documents.document.view_all",
  "documents.controlled_copy.view_all",
  "documents.uncontrolled_copy.view_all",
] as const;

/** The middle level: the Documents and Revisions of the person's own Department (the Department written on the Document). */
export const DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE = "documents.document.view_department";

/** The permissions that open the Document Control pages; a level of visibility is useless without them, so choosing one ticks them. */
export const DOCUMENT_CONTROL_BASE_VIEW_CODES = ["documents.module.view", "documents.document.view"] as const;

/** The three levels an administrator chooses between. The machine values are the ones the server returns for a profile. */
export type DocumentControlVisibilityChoice = "NAMED_IN_FLOW" | "DEPARTMENT" | "VIEW_EVERYTHING";

/** Lowest first. A level that comes from a shared Permission Set cannot be lowered here; the set has to be taken off. */
export const DOCUMENT_CONTROL_VISIBILITY_ORDER: readonly DocumentControlVisibilityChoice[] = ["NAMED_IN_FLOW", "DEPARTMENT", "VIEW_EVERYTHING"];

const normalise = (codes: Iterable<string>): Set<string> => new Set([...codes].map((code) => code.trim().toLowerCase()));

/** The visibility a set of permissions grants. Mirrors the server (DocumentControlVisibility.classify); the server value is the one shown in lists. */
export const classifyVisibility = (granted: Iterable<string>): DocumentControlVisibility => {
  const held = normalise(granted);
  const viewAll = DOCUMENT_CONTROL_VIEW_ALL_CODES.filter((code) => held.has(code)).length;
  if (viewAll === DOCUMENT_CONTROL_VIEW_ALL_CODES.length) return "VIEW_EVERYTHING";
  if (viewAll > 0) return "INCOMPLETE";
  return held.has(DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE) ? "DEPARTMENT" : "NAMED_IN_FLOW";
};

/** Every permission that decides a level (the three view-all codes and the department one). */
const LEVEL_CODES: readonly string[] = [...DOCUMENT_CONTROL_VIEW_ALL_CODES, DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE];

/**
 * The direct permissions of a profile after the administrator chose a level: the level codes of the other levels are taken off, the codes of the
 * chosen level and the pages' base view permissions are added. Codes that come from a shared Permission Set (locked) are never touched here.
 */
export const applyVisibilityChoice = (
  direct: ReadonlySet<string>,
  locked: ReadonlySet<string>,
  choice: DocumentControlVisibilityChoice,
): Set<string> => {
  const next = new Set(direct);
  for (const code of LEVEL_CODES) if (!locked.has(code)) next.delete(code);
  const add = (code: string) => { if (!locked.has(code)) next.add(code); };
  if (choice === "DEPARTMENT") {
    add(DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE);
  } else if (choice === "VIEW_EVERYTHING") {
    DOCUMENT_CONTROL_VIEW_ALL_CODES.forEach(add);
  }
  if (choice !== "NAMED_IN_FLOW") DOCUMENT_CONTROL_BASE_VIEW_CODES.forEach(add);
  return next;
};

/** Whoever signs in must reach the Knowledge Base: the server refuses it without this permission. */
export const KNOWLEDGE_VIEW_CODE = "self_service.knowledge.view";

export const DOCUMENT_CONTROL_VISIBILITY_LABEL: Record<DocumentControlVisibility, string> = {
  VIEW_EVERYTHING: "View everything",
  DEPARTMENT: "My department",
  INCOMPLETE: "Incomplete",
  NAMED_IN_FLOW: "Named in flow",
};

export const DOCUMENT_CONTROL_VISIBILITY_COLOR: Record<DocumentControlVisibility, "emerald" | "blue" | "amber" | "slate"> = {
  VIEW_EVERYTHING: "emerald",
  DEPARTMENT: "blue",
  INCOMPLETE: "amber",
  NAMED_IN_FLOW: "slate",
};

/** The view-all permissions a profile lacks while it holds some of them; empty when it holds none or all. */
export const missingViewAllCodes = (granted: Iterable<string>): string[] => {
  const held = new Set([...granted].map((code) => code.trim().toLowerCase()));
  const missing = DOCUMENT_CONTROL_VIEW_ALL_CODES.filter((code) => !held.has(code));
  return missing.length === DOCUMENT_CONTROL_VIEW_ALL_CODES.length ? [] : [...missing];
};

/**
 * The permission codes to create a profile with: what the administrator picked plus, unless switched off, the Knowledge permission,
 * which is not repeated when a picked Permission Set already grants it.
 */
export const withKnowledgePermission = (
  picked: Iterable<string>,
  pickedSetCodes: Iterable<string>,
  includeKnowledge: boolean,
): string[] => {
  const codes = new Set(picked);
  if (includeKnowledge && !new Set(pickedSetCodes).has(KNOWLEDGE_VIEW_CODE)) {
    codes.add(KNOWLEDGE_VIEW_CODE);
  }
  return [...codes];
};

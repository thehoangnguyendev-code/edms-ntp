import type { DocumentControlVisibility } from "@/services/api/settings";

/**
 * Document Control visibility (DC-VISIBILITY-TIERS-2026-11-07). A person with a name in a flow sees exactly that; a profile that grants the
 * three view-all permissions together lets its people see everything (drafts included). The server computes the label of a profile from its
 * permissions; this file only holds the codes and the display text.
 */
export const DOCUMENT_CONTROL_VIEW_ALL_CODES = [
  "documents.document.view_all",
  "documents.controlled_copy.view_all",
  "documents.uncontrolled_copy.view_all",
] as const;

/** Whoever signs in must reach the Knowledge Base: the server refuses it without this permission. */
export const KNOWLEDGE_VIEW_CODE = "self_service.knowledge.view";

export const DOCUMENT_CONTROL_VISIBILITY_LABEL: Record<DocumentControlVisibility, string> = {
  VIEW_EVERYTHING: "View everything",
  INCOMPLETE: "Incomplete",
  NAMED_IN_FLOW: "Named in flow",
};

export const DOCUMENT_CONTROL_VISIBILITY_COLOR: Record<DocumentControlVisibility, "emerald" | "amber" | "slate"> = {
  VIEW_EVERYTHING: "emerald",
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

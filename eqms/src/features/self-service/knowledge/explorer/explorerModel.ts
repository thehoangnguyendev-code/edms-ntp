import type { BadgeColor } from "@/components/ui/badge";
import type { KnowledgeBaseCard, KnowledgePortalDocument } from "@/services/api/knowledge";

export type SmartKey = "featured" | "viewed" | "useful" | "subscribed";

export type ExplorerNav =
  | { kind: "home" }
  | { kind: "smart"; key: SmartKey }
  | { kind: "kb"; kb: { key: string; label: string }; path: string[] };

export type SortKey = "name" | "views" | "helpful" | "newest";
export type ViewMode = "grid" | "list";

export interface FolderEntry {
  key: string;
  label: string;
  documentCount: number;
  /** Only top-level Knowledge Bases can be subscribed to. */
  subscribed?: boolean;
  isKnowledgeBase: boolean;
}

export type Selection = { type: "doc"; id: string } | { type: "folder"; key: string } | null;

export const SMART_LABELS: Record<SmartKey, string> = {
  featured: "Featured",
  viewed: "Most viewed",
  useful: "Most helpful",
  subscribed: "Subscribed",
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "views", label: "Most viewed" },
  { value: "helpful", label: "Most helpful" },
  { value: "newest", label: "Newest" },
];

// Each document type gets one hue, used for the file icon (hex) and the badge (design-system colour).
const TYPE_PALETTE: { hex: string; badge: BadgeColor }[] = [
  { hex: "#2563eb", badge: "blue" },
  { hex: "#d97706", badge: "amber" },
  { hex: "#7c3aed", badge: "purple" },
  { hex: "#0d9488", badge: "teal" },
  { hex: "#64748b", badge: "slate" },
  { hex: "#e11d48", badge: "rose" },
  { hex: "#0284c7", badge: "sky" },
  { hex: "#4f46e5", badge: "indigo" },
  { hex: "#ea580c", badge: "orange" },
  { hex: "#0891b2", badge: "cyan" },
];
const FOLDER_PALETTE = ["#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];

const hash = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
};

/** Stable colour for a document type, so the same type always looks the same. */
const typeSlot = (type?: string | null) => TYPE_PALETTE[hash((type ?? "").trim().toLowerCase()) % TYPE_PALETTE.length];
export const typeColor = (type?: string | null): string => typeSlot(type).hex;
export const typeBadgeColor = (type?: string | null): BadgeColor => typeSlot(type).badge;

/** Colour for a folder, derived from its label so it stays the same across reloads. */
export const folderColor = (label: string): string => FOLDER_PALETTE[hash(label.trim().toLowerCase()) % FOLDER_PALETTE.length];

/** Short badge for a document type: "SOP", "WI" for "Work Instruction", "POL" for "Policy". */
export const typeAbbreviation = (type?: string | null): string => {
  const words = (type ?? "").trim().split(/[\s_\-/]+/).filter(Boolean);
  if (words.length === 0) return "DOC";
  if (words.length === 1) {
    const word = words[0];
    return (word.length <= 4 ? word : word.slice(0, 3)).toUpperCase();
  }
  return words.map((w) => w[0]).slice(0, 3).join("").toUpperCase();
};

/** Accepts ISO strings and the dd/MM/yyyy[ HH:mm[:ss]] format the API uses for display dates. */
export const parseDateValue = (value?: string | null): number => {
  if (!value) return 0;
  const dmy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const [, d, m, y, hh, mm, ss] = dmy;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0)).getTime();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortDocuments = (docs: KnowledgePortalDocument[], sort: SortKey): KnowledgePortalDocument[] => {
  const byName = (a: KnowledgePortalDocument, b: KnowledgePortalDocument) =>
    a.document.documentName.localeCompare(b.document.documentName, undefined, { sensitivity: "base", numeric: true });
  const copy = [...docs];
  switch (sort) {
    case "views":
      return copy.sort((a, b) => b.views - a.views || byName(a, b));
    case "helpful":
      return copy.sort((a, b) => b.helpfulVotes - a.helpfulVotes || byName(a, b));
    case "newest":
      return copy.sort((a, b) => parseDateValue(b.document.effectiveDate ?? b.document.created) - parseDateValue(a.document.effectiveDate ?? a.document.created) || byName(a, b));
    default:
      return copy.sort(byName);
  }
};

export const sortFolders = (folders: FolderEntry[], sort: SortKey): FolderEntry[] => {
  const byName = (a: FolderEntry, b: FolderEntry) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true });
  const copy = [...folders];
  // Folders have no views or votes; the document count is the closest "popularity" they have.
  if (sort === "views" || sort === "helpful") return copy.sort((a, b) => b.documentCount - a.documentCount || byName(a, b));
  return copy.sort(byName);
};

export const cardsToFolders = (cards: KnowledgeBaseCard[]): FolderEntry[] =>
  cards.map((card) => ({ key: card.key, label: card.label, documentCount: card.documentCount, subscribed: card.subscribed, isKnowledgeBase: true }));

export const navKey = (nav: ExplorerNav): string => {
  if (nav.kind === "home") return "home";
  if (nav.kind === "smart") return `smart:${nav.key}`;
  return `kb:${nav.kb.key}:${nav.path.join("/")}`;
};

/** The location one level above, or null when already at the top. */
export const parentOf = (nav: ExplorerNav): ExplorerNav | null => {
  if (nav.kind === "home") return null;
  if (nav.kind === "smart") return { kind: "home" };
  if (nav.path.length === 0) return { kind: "home" };
  return { kind: "kb", kb: nav.kb, path: nav.path.slice(0, -1) };
};

export interface Crumb {
  label: string;
  nav: ExplorerNav | null;
}

/** `browsePath` is the API breadcrumb: element i is the folder reached with `nav.path.slice(0, i)`. */
export const buildCrumbs = (nav: ExplorerNav, browsePath: { label: string }[] | undefined, searchTerm?: string): Crumb[] => {
  const root: Crumb = { label: "Knowledge Base", nav: { kind: "home" } };
  if (searchTerm) return [root, { label: `Search: ${searchTerm}`, nav: null }];
  if (nav.kind === "home") return [{ ...root, nav: null }];
  if (nav.kind === "smart") return [root, { label: SMART_LABELS[nav.key], nav: null }];
  const labels = browsePath && browsePath.length > 0 ? browsePath.map((p) => p.label) : [nav.kb.label];
  return [
    root,
    ...labels.map((label, i) => ({
      label,
      nav: i === labels.length - 1 ? null : ({ kind: "kb", kb: nav.kb, path: nav.path.slice(0, i) } as ExplorerNav),
    })),
  ];
};

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string => `${count} ${count === 1 ? singular : plural}`;

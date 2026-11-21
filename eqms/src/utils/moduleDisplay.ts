/**
 * The name of a module as a person knows it: the name of the menu it is under, not the key the server stores ("documents", "DOCUMENT_CONTROL", "audit-trail", "app-settings").
 * Display only: a filter, a form or a URL keeps sending the key; only the label that is shown goes through here. The spellings of a key vary between the tables of the system
 * (documents / DOCUMENT_CONTROL / document-control are all Document Control), so the key is compared without case, spaces, dots, dashes and underscores.
 */
const MENU_NAME_BY_KEY: Record<string, string> = {
  // Document Control
  documents: "Document Control",
  document: "Document Control",
  documentcontrol: "Document Control",
  doccontrol: "Document Control",
  controlledcopies: "Controlled Copies",
  uncontrolledcopies: "Uncontrolled Copies",
  // Training Management
  training: "Training Management",
  trainingmanagement: "Training Management",
  // Reports
  report: "Reports",
  reports: "Reports",
  // Audit Trail
  audittrail: "Audit Trail",
  // Backup & Restore
  backup: "Backup & Restore",
  backuprestore: "Backup & Restore",
  "backup&restore": "Backup & Restore",
  // Security & Authorization
  security: "Security & Authorization",
  securityauthorization: "Security & Authorization",
  accessreview: "Access Review",
  securityreview: "Access Review & Audit Trail Review",
  // Application Settings and System Administration
  settings: "Application Settings",
  appsettings: "Application Settings",
  applicationsettings: "Application Settings",
  systemadmin: "System Administration",
  systemadministration: "System Administration",
  // the rest of the menu
  notifications: "Notifications",
  preferences: "Preferences",
  selfservice: "Self-Service",
  dashboard: "Dashboard",
  knowledge: "Knowledge Base",
  knowledgebase: "Knowledge Base",
  workmanagement: "Work Management",
  systeminformation: "System Information",
};

const compact = (key: string) => key.toLowerCase().replace(/[\s._-]+/g, "");

/** "some_new-module" is shown as "Some New Module" until it is named above. */
const prettify = (key: string) => {
  const text = key.trim();
  // a key written in capitals (ACCESS, SOME_NEW_MODULE) is a machine value: made into words, not shown in capitals
  const words = /^[A-Z][A-Z0-9_ -]*$/.test(text) ? text.toLowerCase() : text;
  return words.replace(/[\s._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const moduleDisplayName = (key?: string | null): string => {
  const value = (key ?? "").trim();
  if (!value) return "Other";
  return MENU_NAME_BY_KEY[compact(value)] ?? prettify(value);
};

/** The name of the menu for a key the system knows, null for any other (the caller then formats it its own way). */
export const knownModuleName = (key?: string | null): string | null => {
  const value = (key ?? "").trim();
  return value ? (MENU_NAME_BY_KEY[compact(value)] ?? null) : null;
};

/** The one key the server uses to find a module whatever its spelling (the same list as com.eqms.util.ModuleKeys). */
const CANONICAL_KEY_BY_NAME: Record<string, string> = {
  "Document Control": "documents",
  "Training Management": "training",
  Reports: "reports",
  "Audit Trail": "audit-trail",
  "Backup & Restore": "backup",
  "Controlled Copies": "controlled-copies",
  "Access Review": "access-review",
  "Security & Authorization": "security",
  "Application Settings": "settings",
  "System Administration": "system-admin",
  "Self-Service": "self_service",
};

export const canonicalModuleKey = (key?: string | null): string => {
  const value = (key ?? "").trim();
  if (!value) return "";
  return CANONICAL_KEY_BY_NAME[moduleDisplayName(value)] ?? value;
};

/**
 * The options of a select of modules: each module once, the label is the menu name and the value is the one key the server finds every spelling by
 * ("report" and "reports" are one option, "Reports"); sorted by the label.
 */
export const moduleSelectOptions = (keys: readonly string[]): { label: string; value: string }[] => {
  const byValue = new Map<string, string>();
  keys.filter(Boolean).forEach((key) => byValue.set(canonicalModuleKey(key), moduleDisplayName(key)));
  return [...byValue.entries()].map(([value, label]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
};

/** The menu of the sidebar by the id of its top-level item (services/api/navigation.ts returns it from the server) and the name of the module it opens. */
const MODULE_NAME_BY_MENU_ID: Record<string, string> = {
  notifications: "Notifications",
  "self-service": "Self-Service",
  "doc-control": "Document Control",
  "training-management": "Training Management",
  report: "Reports",
  "audit-trail": "Audit Trail",
  "backup-restore": "Backup & Restore",
  "security-authorization": "Security & Authorization",
  settings: "Application Settings",
  "system-administration": "System Administration",
  preferences: "Preferences",
  "system-information": "System Information",
};

/** The order of the menu as the server builds it (NavigationService); used until the menu answers, or when it cannot. "Dashboard" sits under Self-Service in the menu. */
export const MENU_MODULE_ORDER: readonly string[] = [
  "Notifications", "Self-Service", "Dashboard", "Document Control", "Training Management", "Reports", "Audit Trail", "Backup & Restore",
  "Security & Authorization", "Application Settings", "System Administration", "Preferences", "System Information",
];

/** The modules in the order of the sidebar, read from the top-level items of the menu the server sent (an item that opens no known module is skipped). */
export const moduleOrderFromMenu = (menu: readonly { id: string }[]): string[] => {
  const order: string[] = [];
  for (const item of menu) {
    const name = MODULE_NAME_BY_MENU_ID[item.id];
    if (!name || order.includes(name)) continue;
    order.push(name);
    if (name === "Self-Service") order.push("Dashboard");
  }
  return order;
};

/** Sorts module names like the sidebar: the menu order first, any module the menu does not know after them, by name. */
export const sortModulesLikeMenu = <T,>(items: readonly T[], nameOf: (item: T) => string, order: readonly string[] = MENU_MODULE_ORDER): T[] => {
  const rank = (name: string) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  return [...items].sort((a, b) => rank(nameOf(a)) - rank(nameOf(b)) || nameOf(a).localeCompare(nameOf(b)));
};

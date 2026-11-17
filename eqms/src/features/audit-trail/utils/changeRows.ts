/**
 * What the Audit Trail Detail shows under "What changed" (AUDIT-DETAIL-2026-11-17).
 * - A field that only an investigator needs (checksum, storage keys, file paths) is kept out of the list and shown under "Technical details".
 * - A value that is a JSON object or a list is split into one row per setting that really changed, not one long line.
 * - Every row says what happened to the value: Set (was empty), Changed, Cleared (is empty now).
 */

export interface RawChange {
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export type ChangeKind = "set" | "changed" | "cleared";

export interface ChangeRow {
  /** The words shown for the field, with the path inside a setting after " › ". */
  field: string;
  /** The name that decides how the value is formatted (Yes/No, date, size): the last part of the path. */
  valueField: string;
  oldValue: string | null;
  newValue: string | null;
  kind: ChangeKind;
}

/** A value that says nothing: empty, "-", "null", "Not specified". */
export const isBlank = (value?: string | null): boolean => /^(|-|—|null|undefined|n\/a|not specified)$/i.test((value ?? "").trim());

export const formatAuditField = (field?: string | null): string => {
  const raw = String(field || "").trim();
  if (!raw) return "Field";
  const normalized = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const specialLabels: Record<string, string> = {
    "is active": "Active",
    "has expiry date": "Has Expiry Date",
    "email notifications enabled": "Email Notifications Enabled",
    "two factor enabled": "Two-Factor Authentication Enabled",
    "mfa enabled": "Multi-Factor Authentication Enabled",
    "mfa required by admin": "Multi-Factor Authentication Required by Administrator",
    "file size bytes": "File Size",
    "file size": "File Size",
    "pdf preview": "PDF Preview",
    "training period days": "Training Period (Days)",
  };
  const key = normalized.toLowerCase();
  return specialLabels[key] || normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

/** Fields that identify storage, validation or file internals. Matched on the name without spaces or case. */
const TECHNICAL_FIELD = /checksum|contenttype|ooxml|malware|filepath$|previewfilepath|objectkey|storage(provider|syncstatus|editurl|weburl|siteid|itemid|driveid)|sharepoint(editlink|workingfile)|onlyofficesession|validationreasoncode|fetchedat/;

export const isTechnicalField = (field?: string | null): boolean =>
  TECHNICAL_FIELD.test(String(field || "").replace(/[^a-z0-9]/gi, "").toLowerCase());

const kindOf = (oldValue: string | null, newValue: string | null): ChangeKind | null => {
  const noOld = isBlank(oldValue);
  const noNew = isBlank(newValue);
  if (noOld && noNew) return null;
  if (noOld) return "set";
  if (noNew) return "cleared";
  return "changed";
};

const parseStructured = (value?: string | null): unknown | undefined => {
  const raw = (value ?? "").trim();
  if (!((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]")))) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** Every value of a setting with the path to it, e.g. "Pdf Preview › Default Zoom". */
const leaves = (value: unknown, path: string[], out: Map<string, { value: string; key: string }>) => {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path.join(" › "), { value: "None", key: path[path.length - 1] ?? "" });
    value.forEach((item, index) => leaves(item, [...path, `#${index + 1}`], out));
    return;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) out.set(path.join(" › "), { value: "None", key: path[path.length - 1] ?? "" });
    entries.forEach(([key, item]) => leaves(item, [...path, formatAuditField(key)], out));
    return;
  }
  out.set(path.join(" › "), { value: value === null || value === undefined ? "" : String(value), key: path[path.length - 1] ?? "" });
};

const bracketList = (value?: string | null): string[] | undefined => {
  const raw = (value ?? "").trim();
  if (!raw.startsWith("[") || !raw.endsWith("]") || parseStructured(raw) !== undefined) return undefined;
  return raw.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
};

/** One change of the record as the rows to show; a change that did nothing gives none. */
export const expandChange = (change: RawChange): ChangeRow[] => {
  const field = formatAuditField(change.field);
  const oldValue = change.oldValue ?? null;
  const newValue = change.newValue ?? null;

  const oldTree = parseStructured(oldValue);
  const newTree = parseStructured(newValue);
  if ((oldTree !== undefined || newTree !== undefined) && (oldTree !== undefined || isBlank(oldValue)) && (newTree !== undefined || isBlank(newValue))) {
    const before = new Map<string, { value: string; key: string }>();
    const after = new Map<string, { value: string; key: string }>();
    if (oldTree !== undefined) leaves(oldTree, [], before);
    if (newTree !== undefined) leaves(newTree, [], after);
    const rows: ChangeRow[] = [];
    for (const path of new Set([...before.keys(), ...after.keys()])) {
      const o = before.get(path);
      const n = after.get(path);
      if ((o?.value ?? "") === (n?.value ?? "")) continue;
      const kind = kindOf(o?.value ?? null, n?.value ?? null);
      if (!kind) continue;
      rows.push({ field: path ? `${field} › ${path}` : field, valueField: (n ?? o)?.key ?? "", oldValue: o?.value ?? null, newValue: n?.value ?? null, kind });
    }
    return rows;
  }

  const oldList = bracketList(oldValue);
  const newList = bracketList(newValue);
  if ((oldList || isBlank(oldValue)) && (newList || isBlank(newValue)) && (oldList || newList)) {
    const before = new Set(oldList ?? []);
    const after = new Set(newList ?? []);
    const added = [...after].filter((item) => !before.has(item));
    const removed = [...before].filter((item) => !after.has(item));
    return [
      ...(added.length ? [{ field: `${field} › Added`, valueField: "", oldValue: null, newValue: added.join(", "), kind: "set" as const }] : []),
      ...(removed.length ? [{ field: `${field} › Removed`, valueField: "", oldValue: removed.join(", "), newValue: null, kind: "cleared" as const }] : []),
    ];
  }

  // A value saved as it was is not a change.
  if (!isBlank(oldValue) && (oldValue ?? "").trim() === (newValue ?? "").trim()) return [];
  const kind = kindOf(oldValue, newValue);
  return kind ? [{ field, valueField: change.field ?? "", oldValue, newValue, kind }] : [];
};

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = { set: "Set", changed: "Changed", cleared: "Cleared" };

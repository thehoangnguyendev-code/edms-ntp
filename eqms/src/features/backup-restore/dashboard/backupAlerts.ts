import type { BackupOverview } from "@/services/api/backupRestore";
import { statusLabel } from "../types";

export interface Alert {
  id: string;
  severity: "error" | "warning";
  /** Machine code of the problem; alerts with the same code and severity are the same kind of problem. */
  code: string;
  title: string;
  description: string;
  ref?: string | null;
  at?: string;
}

/** The same problem happening again is one line with a count, not a new line each time. */
export interface AlertGroup {
  key: string;
  severity: Alert["severity"];
  title: string;
  items: Alert[];
}

const ALERT_TITLE: Record<string, string> = {
  BACKUP_DUMP_FAILED: "A backup failed while reading the database",
  BACKUP_TARGET_UNAVAILABLE: "A backup failed because the target cannot be written",
  BACKUP_INSUFFICIENT_SPACE: "A backup was stopped: not enough free space",
  BACKUP_ENCRYPTION_KEY_MISSING: "A backup was stopped: the encryption key is missing",
  BACKUP_SOURCE_UNAVAILABLE: "A backup failed: the database could not be reached",
  BACKUP_VERIFY_FAILED: "A backup did not pass its integrity check",
  LEDGER_CHAIN_BROKEN: "The backup ledger has been changed",
  AGENT_RESTARTED: "The agent stopped while a backup was running",
  NOT_VERIFIED: "Backups without a passing integrity check",
};

export const toAlerts = (overview: BackupOverview): Alert[] => {
  const alerts: Alert[] = overview.openAlerts.map((alert) => ({
    id: alert.id,
    code: alert.code,
    severity: alert.severity === "CRITICAL" || alert.severity === "HIGH" ? "error" : "warning",
    title: ALERT_TITLE[alert.code] ?? statusLabel(alert.code),
    description: alert.detail ?? "No detail recorded.",
    ref: alert.ref,
    at: alert.at,
  }));
  if (!overview.ledger.ok) {
    alerts.unshift({
      id: "ledger",
      code: "LEDGER_CHAIN_BROKEN",
      severity: "error",
      title: ALERT_TITLE.LEDGER_CHAIN_BROKEN,
      description: overview.ledger.reason ?? "The history of backups no longer matches itself. Treat every backup made since as unproven and tell QA.",
    });
  }
  if (overview.notVerified > 0) {
    alerts.push({
      id: "not-verified",
      code: "NOT_VERIFIED",
      severity: "warning",
      title: `${overview.notVerified} backup${overview.notVerified === 1 ? " has" : "s have"} no passing integrity check`,
      description: "A backup that has not passed its check cannot be relied on for a restore.",
    });
  }
  return alerts;
};

/** Groups by kind of problem, errors before warnings, and inside a group the newest first. */
export const groupAlerts = (alerts: Alert[]): AlertGroup[] => {
  const groups = new Map<string, AlertGroup>();
  for (const alert of alerts) {
    const key = `${alert.severity}:${alert.code}`;
    const group = groups.get(key) ?? { key, severity: alert.severity, title: alert.title, items: [] };
    group.items.push(alert);
    groups.set(key, group);
  }
  const newest = (group: AlertGroup) => group.items.reduce((max, item) => Math.max(max, item.at ? Date.parse(item.at) : 0), 0);
  // A tampered ledger is more serious than any failed backup: it casts doubt on every backup made since.
  const rank = (group: AlertGroup) => (group.key === "error:LEDGER_CHAIN_BROKEN" ? 0 : 1);
  return [...groups.values()]
    .map((group) => ({ ...group, items: [...group.items].sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? "") || 0) }))
    .sort((a, b) => (a.severity === b.severity ? rank(a) - rank(b) || newest(b) - newest(a) : a.severity === "error" ? -1 : 1));
};

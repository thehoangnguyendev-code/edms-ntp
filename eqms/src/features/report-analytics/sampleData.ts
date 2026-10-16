/** Sample data for the Reports & Analytics design preview. None of it is a record of the system. */

export interface SampleTodo {
  id: string;
  title: string;
  detail: string;
  tone: "red" | "amber" | "emerald" | "blue";
}
export const SAMPLE_TODOS: SampleTodo[] = [
  { id: "t1", title: "1 run failed", detail: "Audit Trail Extract RUN-000412: the output could not be written. Retry it or contact the report administrator.", tone: "red" },
  { id: "t2", title: "2 files expire within 14 days", detail: "Download them or place a legal hold before the retention date.", tone: "amber" },
  { id: "t3", title: "1 schedule suspended", detail: "Weekly Document Status: the owner's access changed, so the schedule was paused.", tone: "amber" },
  { id: "t4", title: "3 runs ready to download", detail: "Finished since you last looked.", tone: "emerald" },
];

export interface SampleKpi {
  title: string;
  value: number;
  foot: number;
  footLabel: string;
  accent: string;
}
export const SAMPLE_DC_KPIS: SampleKpi[] = [
  { title: "Effective documents", value: 412, foot: 37, footLabel: "revised in the last 90 days", accent: "#10b981" },
  { title: "Revisions in progress", value: 29, foot: 6, footLabel: "waiting over 14 days", accent: "#3b82f6" },
  { title: "Periodic reviews due", value: 18, foot: 4, footLabel: "overdue", accent: "#f59e0b" },
  { title: "Controlled copies out", value: 96, foot: 5, footLabel: "recall pending", accent: "#8b5cf6" },
];

export const SAMPLE_REVISIONS_BY_STAGE = [
  { label: "Draft", value: 8 }, { label: "Review", value: 9 }, { label: "Approval", value: 7 }, { label: "Training", value: 5 },
];

export interface SampleByType {
  type: string;
  effective: number;
  inRevision: number;
  reviewDue: number;
}
export const SAMPLE_BY_TYPE: SampleByType[] = [
  { type: "SOP", effective: 168, inRevision: 12, reviewDue: 7 },
  { type: "Work Instruction", effective: 121, inRevision: 9, reviewDue: 6 },
  { type: "Specification", effective: 74, inRevision: 5, reviewDue: 3 },
  { type: "Form", effective: 49, inRevision: 3, reviewDue: 2 },
];

export interface SampleAccessRow {
  role: string;
  library: string;
  runOwn: boolean;
  viewAll: boolean;
  download: boolean;
  schedule: boolean;
  scope: string;
}
export const SAMPLE_ACCESS: SampleAccessRow[] = [
  { role: "Quality Admin", library: "All reports", runOwn: true, viewAll: true, download: true, schedule: true, scope: "System" },
  { role: "QA Reviewer", library: "Official and Informational", runOwn: true, viewAll: true, download: true, schedule: false, scope: "Business unit" },
  { role: "Document Controller", library: "Document Control", runOwn: true, viewAll: false, download: true, schedule: true, scope: "Department" },
  { role: "Standard User", library: "Informational", runOwn: true, viewAll: false, download: false, schedule: false, scope: "Personal" },
];

export interface SampleHold {
  runId: string;
  report: string;
  appliedBy: string;
  appliedAt: string;
  reason: string;
}
export const SAMPLE_HOLDS: SampleHold[] = [
  { runId: "RUN-000377", report: "Audit Trail Extract", appliedBy: "Quality Admin", appliedAt: "2026-09-18 09:20", reason: "Inspection request: keep the original output." },
];

export interface SampleDelivery {
  id: string;
  schedule: string;
  at: string;
  recipients: number;
  status: "SENT" | "FAILED";
  detail: string;
}
export const SAMPLE_DELIVERIES: SampleDelivery[] = [
  { id: "d1", schedule: "Weekly Document Status", at: "2026-10-05 06:00", recipients: 4, status: "SENT", detail: "Delivered to 4 recipients" },
  { id: "d2", schedule: "Weekly Document Status", at: "2026-09-28 06:00", recipients: 4, status: "FAILED", detail: "The mail server refused the message (timeout)" },
];

export interface SampleRun {
  id: string;
  report: string;
  classification: "Official" | "Informational";
  format: "PDF" | "XLSX" | "CSV";
  status: "READY" | "RUNNING" | "FAILED" | "EXPIRED";
  ranAt: string;
  ranBy: string;
}
export const SAMPLE_RUNS: SampleRun[] = [
  { id: "RUN-000415", report: "Document Status", classification: "Official", format: "PDF", status: "READY", ranAt: "2026-10-08 08:12", ranBy: "Quality Admin" },
  { id: "RUN-000414", report: "Revision Lifecycle", classification: "Official", format: "XLSX", status: "RUNNING", ranAt: "2026-10-08 08:05", ranBy: "Quality Admin" },
  { id: "RUN-000412", report: "Audit Trail Extract", classification: "Official", format: "CSV", status: "FAILED", ranAt: "2026-10-07 16:40", ranBy: "Quality Admin" },
  { id: "RUN-000377", report: "Audit Trail Extract", classification: "Official", format: "PDF", status: "READY", ranAt: "2026-09-18 09:10", ranBy: "Quality Admin" },
];

export interface SampleSchedule { id: string; report: string; cadence: string; nextRun: string; recipients: number; suspended?: string }
export const SAMPLE_SCHEDULES: SampleSchedule[] = [
  { id: "s1", report: "Weekly Document Status", cadence: "Every Monday 06:00", nextRun: "2026-10-12 06:00", recipients: 4, suspended: "The owner's access changed" },
  { id: "s2", report: "Monthly Revision Lifecycle", cadence: "1st of month 06:00", nextRun: "2026-11-01 06:00", recipients: 6 },
];

export const SAMPLE_PINNED = ["Document Status", "Revision Lifecycle", "Audit Trail Extract"];

export const SAMPLE_RUNS_PER_WEEK = [
  { label: "W36", value: 9 }, { label: "W37", value: 14 }, { label: "W38", value: 11 }, { label: "W39", value: 17 },
  { label: "W40", value: 12 }, { label: "W41", value: 19 },
];

export interface SampleRunDetail {
  id: string; report: string; definitionVersion: string; layoutVersion: string; classification: string;
  ranBy: string; ranAt: string; dataAsOf: string; reason: string;
  parameters: { label: string; value: string }[];
  events: { at: string; text: string }[];
  file: { name: string; size: string; sha256: string; expires: string; hold: boolean };
}
export const SAMPLE_RUN_DETAIL: SampleRunDetail = {
  id: "RUN-000415", report: "Document Status", definitionVersion: "v3", layoutVersion: "L2", classification: "Official",
  ranBy: "Quality Admin", ranAt: "2026-10-08 08:12", dataAsOf: "2026-10-08 08:12:03", reason: "Monthly management review pack",
  parameters: [
    { label: "Document type", value: "SOP, Work Instruction" },
    { label: "Status", value: "Effective" },
    { label: "Department", value: "Quality Assurance" },
    { label: "Columns", value: "Code, Title, Version, Effective date, Owner" },
  ],
  events: [
    { at: "08:12:01", text: "Run queued by Quality Admin" },
    { at: "08:12:03", text: "Data snapshot taken (412 rows)" },
    { at: "08:12:07", text: "File written and checksum recorded" },
    { at: "08:12:08", text: "Run completed" },
  ],
  file: { name: "document-status-RUN-000415.pdf", size: "184 KB", sha256: "9f2c1d7a4be0a3c58e61f0d9b7a24c3e1d85f6a0b94e7c2d3a18f5b60c7e4d21", expires: "Not set", hold: false },
};

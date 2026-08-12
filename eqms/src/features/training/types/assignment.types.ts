/**
 * Training Assignment Types
 *
 * Covers both Manual Assignment (from Training Matrix) and
 * Auto-Assignment (rule-based engine with 6 triggers).
 *
 * EU-GMP References:
 * - Chapter 2.8 / 2.9 — Personnel training obligations
 * - Annex 11 / 21 CFR Part 11 — Electronic signatures
 * - ICH Q10 §3.2 — Retraining on revised procedures
 * - ICH Q10 §3.4 / Annex 20 — CAPA-linked training evidence
 */

// ─── Enums & Union Types ──────────────────────────────────────────────────────

export type AssignmentPriority = "Critical" | "High" | "Medium" | "Low";

export type AssignmentScope =
  | "individual"
  | "department"
  | "business_unit";

export type AssignmentTrigger =
  | "manual"
  | "new_employee"
  | "role_change"
  | "doc_revision"
  | "expiry_retraining"
  | "recurrence"
  | "capa_linked"
  | "audit_finding"
  | "process_change"
  | "regulatory_update";

export type AssignmentStatus =
  | "Draft"
  | "Active"
  | "Completed"
  | "PartiallyCompleted"
  | "Cancelled"
  | "Expired";

export type AssigneeStatus =
  | "Assigned"
  | "InProgress"
  | "Completed"
  | "Failed"
  | "Overdue"
  | "Waived";

export type RuleTrigger = AssignmentTrigger;

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface TrainingAssignment {
  assignmentId: string;         // "ASN-2026-001"
  courseId: string;
  courseName: string;
  courseVersion: string;
  courseCategory: string;
  trainingMethod: string;

  // Who is being assigned
  targetScope: AssignmentScope;
  targetIds: string[];          // employee IDs, dept names, job titles, group IDs
  targetSummary: string;        // human-readable e.g. "Quality Assurance (16 employees)"

  // Who assigned
  assignedBy: string;           // userId
  assignedByName: string;
  assignedByRole: string;
  assignedAt: string;           // ISO date

  // Schedule
  deadline: string;             // ISO date
  priority: AssignmentPriority;

  // Behavior flags
  trainingBeforeAuthorized: boolean;  // EU-GMP 2.8 gate
  requiresESign: boolean;             // Annex 11
  isCrossTraining: boolean;           // not part of mandatory curriculum

  // Notifications
  reminders: number[];          // days before deadline [3, 7, 14]

  // Trigger info
  trigger: AssignmentTrigger;
  reasonForAssignment: string;  // required free-text, audit evidence

  // Optional links
  linkedDocumentId?: string;
  linkedDocumentTitle?: string;
  linkedCapaId?: string;
  linkedDeviationId?: string;

  // Status
  status: AssignmentStatus;
  totalAssignees: number;
  completedCount: number;
  overdueCount: number;

  // Notes
  notes?: string;

  // E-Sign authorization (on assignment creation)
  eSignAuthorization?: ESignRecord;
}

/** Per-employee progress record */
export interface AssignmentProgress {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  employeeDepartment: string;
  employeePosition: string;

  status: AssigneeStatus;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  deadline: string;

  score?: number;
  attempts: number;
  isPassed?: boolean;

  // Sign-offs
  traineeESign?: ESignRecord;   // trainee completion sign-off
  trainerESign?: ESignRecord;   // trainer/OJT sign-off (EU-GMP 2.12)

  // Waiver
  isWaived?: boolean;
  waiverReason?: string;
  waivedBy?: string;
  waivedAt?: string;
}

/** Electronic signature record (Annex 11 / 21 CFR Part 11) */
export interface ESignRecord {
  signedBy: string;
  signedByName: string;
  signedAt: string;
  meaning: string;
  ipAddress?: string;
}

// ─── Auto-Assignment Rules ────────────────────────────────────────────────────

export interface TriggerConditions {
  departments?: string[];
  positions?: string[];
  courseCategories?: string[];
  minPriorityLevel?: AssignmentPriority;
}

export interface AutoAssignmentRule {
  ruleId: string;           // "ARU-001"
  name: string;
  description: string;
  trigger: RuleTrigger;
  triggerConditions: TriggerConditions;

  // What to assign
  courseFilter: {
    categories?: string[];
    mandatory?: boolean;
    specificCourseIds?: string[];
  };

  // Assignment configuration
  targetScope: AssignmentScope;
  priority: AssignmentPriority;
  deadlineDays: number;         // days from trigger date
  requiresESign: boolean;
  trainingBeforeAuthorized: boolean;
  notifyManager: boolean;
  reminderDays: number[];

  // Rule lifecycle
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;          // QA must approve before rule goes active
  approvedAt?: string;
  lastTriggeredAt?: string;
  triggerCount: number;
  notes?: string;
}

// ─── Deadline Suggestions by Priority (EU-GMP aligned) ───────────────────────
export const PRIORITY_DEADLINE_DAYS: Record<AssignmentPriority, number> = {
  Critical: 7,
  High: 14,
  Medium: 30,
  Low: 60,
};

export const PRIORITY_COLORS: Record<AssignmentPriority, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-slate-50 text-slate-600 border-slate-200",
};

export const TRIGGER_LABELS: Record<AssignmentTrigger, string> = {
  manual: "Manual",
  new_employee: "New Employee",
  role_change: "Role Change",
  doc_revision: "Document Revision",
  expiry_retraining: "Expiry Retraining",
  recurrence: "Scheduled Recurrence",
  capa_linked: "CAPA / Deviation",
  audit_finding: "Audit Finding",
  process_change: "Process Change",
  regulatory_update: "Regulatory Update",
};

export const STATUS_COLORS: Record<AssignmentStatus, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Active: "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PartiallyCompleted: "bg-amber-50 text-amber-700 border-amber-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
  Expired: "bg-orange-50 text-orange-700 border-orange-200",
};

export const ASSIGNEE_STATUS_COLORS: Record<AssigneeStatus, string> = {
  Assigned: "bg-blue-50 text-blue-700 border-blue-200",
  InProgress: "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-red-50 text-red-700 border-red-200",
  Overdue: "bg-red-100 text-red-800 border-red-300",
  Waived: "bg-purple-50 text-purple-700 border-purple-200",
};

import { IconInfoCircle, IconUserShield } from "@tabler/icons-react";
/**
 * Navigation Configuration
 * Defines the application navigation structure
 *
 * @module navigation
 * @description Modular navigation config organized by functional domains
 */

import React from "react";
import {
  Bell,
  CalendarDays,
  Package,
  Scale,
  ShieldCheck,
  BookText,
  GraduationCap,
  Globe2,
  UserStar,
  SquareChartGantt,
  PenTool,
  UserRound,
  UsersRound,
  type LucideProps,
  ScanSearch,
  BrickWallShield,
  University,
  Shield,
  UserLock,
  DatabaseBackup,
} from "lucide-react";

const PenToolRotated = (props: LucideProps) =>
  React.createElement(PenTool, {
    ...props,
    className: [props.className, "-rotate-[90deg]"].filter(Boolean).join(" "),
  });

import {
  IconAlertTriangle,
  IconBrandAsana,
  IconBuildingStore,
  IconClipboardCheck,
  IconDeviceDesktopCog,
  IconDeviceLaptop,
  IconFileDescription,
  IconFileText,
  IconFilter2Search,
  IconMessageReport,
  IconReplace,
  IconSettings2,
  IconLayoutGrid,
  IconShieldExclamation,
  IconUsers,
  IconAdjustmentsHorizontal,
  IconAlertSquareRounded,
  IconMailForward,
  IconSpeakerphone,
  IconChartBar,
  IconKey,
  IconArrowsShuffle,
  IconDatabase,
  IconScale,
  IconLock,
  IconUserKey,
  IconJumpRope,
  IconSwitch2,
  IconActivity,
  IconReport,
  IconServerCog,
  IconViewfinder,
  IconTableOptions,
} from "@tabler/icons-react";
import { NavItem } from "@/types";
import { ROUTES } from "./routes.constants";

export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Bell,
  CalendarDays,
  Package,
  Scale,
  ShieldCheck,
  BookText,
  GraduationCap,
  Globe2,
  UserStar,
  SquareChartGantt,
  DatabaseBackup,
  PenTool: PenToolRotated,
  IconAlertTriangle,
  IconBrandAsana,
  IconBuildingStore,
  IconClipboardCheck,
  IconDeviceDesktopCog,
  IconDeviceLaptop,
  IconFileDescription,
  IconFilter2Search,
  IconMessageReport,
  IconReplace,
  IconSettings2,
  IconLayoutGrid,
  IconShieldExclamation,
  IconUsers,
  IconAdjustmentsHorizontal,
  IconAlertSquareRounded,
  IconMailForward,
  IconSpeakerphone,
  IconChartBar,
  IconKey,
  IconArrowsShuffle,
  IconDatabase,
  IconScale,
  IconLock,
  IconActivity,
};

// ============================================================================
// QUALITY CORE NAVIGATION (Notifications and Self-Service)
// ============================================================================
// Notifications is a baseline workspace surface — available to every authenticated user
// without a permission gate (same policy as Work Management).
const CORE_NAV: NavItem[] = [
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    path: ROUTES.NOTIFICATIONS,
    allowedPermissions: ["notifications.module.view"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    path: ROUTES.CALENDAR,
  },
  {
    id: "self-service",
    label: "Self-Service",
    icon: IconLayoutGrid,
    // Shown if the user has either child's permission -- mirrors the server's
    // NavigationService#getNavigation self-service block, which is the real authority.
    allowedPermissions: [
      "dashboard.module.view",
      "self_service.knowledge.view",
    ],
    showDividerAfter: true,
    children: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: ROUTES.DASHBOARD,
        allowedPermissions: ["dashboard.module.view"],
      },
      {
        id: "knowledge-base",
        label: "Knowledge",
        path: ROUTES.SELF_SERVICE.KNOWLEDGE,
        allowedPermissions: ["self_service.knowledge.view"],
      },
    ],
  },
];

// ============================================================================
// DOCUMENT & TRAINING (Foundation)
// ============================================================================
const FOUNDATION_MODULES: NavItem[] = [
  {
    id: "doc-control",
    label: "Document Control",
    icon: IconFileDescription,
    allowedPermissions: ["documents.module.view"],
    children: [
      {
        id: "doc-owned-me",
        label: "Documents Owned By Me",
        path: ROUTES.DOCUMENTS.OWNED,
      },
      { id: "doc-all", label: "All Documents", path: ROUTES.DOCUMENTS.ALL },
      {
        id: "doc-revisions",
        label: "Document Revisions",
        children: [
          {
            id: "rev-owned-me",
            label: "Revisions Owned By Me",
            path: ROUTES.DOCUMENTS.REVISIONS.OWNED,
          },
          {
            id: "rev-all",
            label: "All Revisions",
            path: ROUTES.DOCUMENTS.REVISIONS.ALL,
          },
          {
            id: "pending-review",
            label: "Pending My Review",
            path: ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW,
          },
          {
            id: "pending-approval",
            label: "Pending My Approval",
            path: ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL,
          },
        ],
      },
      {
        id: "controlled-copies",
        label: "Controlled Copies",
        children: [
          {
            id: "cc-all",
            label: "All Controlled Copies",
            path: ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL,
          },
          {
            id: "cc-ready",
            label: "Ready for Distribution",
            path: ROUTES.DOCUMENTS.CONTROLLED_COPIES.READY,
          },
          {
            id: "cc-distributed",
            label: "Distributed Copies",
            path: ROUTES.DOCUMENTS.CONTROLLED_COPIES.DISTRIBUTED,
          },
        ],
      },
      {
        id: "uncontrolled-copies",
        label: "Uncontrolled Copies",
        allowedPermissions: [
          "documents.uncontrolled_copy.view",
          "documents.uncontrolled_copy.request",
        ],
        children: [
          {
            id: "uc-all",
            label: "All Uncontrolled Copies",
            path: ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.ALL,
          },
          {
            id: "uc-pending-approval",
            label: "Pending Approval",
            path: ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.PENDING_APPROVAL,
          },
          {
            id: "uc-distributed",
            label: "Distributed Copies",
            path: ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.DISTRIBUTED,
          },
        ],
      },
      {
        id: "records",
        label: "Records",
        path: ROUTES.DOCUMENTS.RECORDS,
        allowedPermissions: ["documents.form.view_executed_records"],
      },
    ],
  },
  {
    id: "training-management",
    label: "Training Management",
    icon: GraduationCap,
    allowedPermissions: ["training.module.view"],
    children: [
      {
        id: "my-training",
        label: "My Training",
        path: ROUTES.TRAINING.MY_TRAINING,
        allowedPermissions: ["training.self.view"],
      },
      {
        id: "training-planning",
        label: "Training Programme",
        allowedPermissions: ["training.requirement.view", "training.activity.view", "training.matrix.view"],
        children: [
          { id: "training-requirements", label: "Training Requirements", path: ROUTES.TRAINING.REQUIREMENTS, allowedPermissions: ["training.requirement.view"] },
          { id: "training-activities", label: "Training Activities", path: ROUTES.TRAINING.ACTIVITIES, allowedPermissions: ["training.activity.view"] },
          { id: "training-matrices", label: "Training Matrices", path: ROUTES.TRAINING.MATRICES, allowedPermissions: ["training.matrix.view"] },
        ],
      },
      {
        id: "training-people",
        label: "Personnel Qualification",
        allowedPermissions: ["training.job_assignment.view", "training.signature.view", "training.signature.manage", "training.signature.confirm", "training.self.view"],
        children: [
          { id: "training-job-assignments", label: "Job Assignments", path: ROUTES.TRAINING.JOB_ASSIGNMENTS, allowedPermissions: ["training.job_assignment.view"] },
          { id: "training-personnel-reviews", label: "Training Reviews", path: ROUTES.TRAINING.PERSONNEL_REVIEWS, allowedPermissions: ["training.job_assignment.view"] },
          {
            id: "training-specimen-signatures",
            label: "Specimen Signatures",
            path: ROUTES.TRAINING.SPECIMEN_SIGNATURES,
            allowedPermissions: ["training.signature.view", "training.signature.manage", "training.signature.confirm", "training.self.view"],
          },
        ],
      },
      {
        id: "training-records-compliance",
        label: "Training Records & Compliance",
        allowedPermissions: ["training.record.view", "training.compliance.view", "training.record.export", "training.activity.view"],
        children: [
          { id: "training-records", label: "Training Records", path: ROUTES.TRAINING.RECORDS, allowedPermissions: ["training.record.view"] },
          { id: "training-compliance", label: "Training Compliance", path: ROUTES.TRAINING.COMPLIANCE, allowedPermissions: ["training.compliance.view"] },
          { id: "training-number-log", label: "Training Number Register", path: ROUTES.TRAINING.NUMBER_LOG, allowedPermissions: ["training.compliance.view"] },
          { id: "training-record-exports", label: "Training Record Exports", path: ROUTES.TRAINING.RECORD_EXPORTS, allowedPermissions: ["training.record.export"] },
          { id: "training-legacy-evidence", label: "Legacy Training Evidence", path: ROUTES.TRAINING.LEGACY_EVIDENCE, allowedPermissions: ["training.activity.view"] },
        ],
      },
    ],
  },
];

// ============================================================================
// SYSTEM (Reports, Audit, Security, Settings)
// ============================================================================
const SYSTEM_MODULES: NavItem[] = [
  {
    id: "report",
    label: "Reports & Analytics",
    icon: IconChartBar,
    allowedPermissions: ["report.module.view"],
    children: [
      {
        id: "report-overview",
        label: "Reports Overview",
        path: ROUTES.REPORT.OVERVIEW,
      },
      {
        id: "report-analytics",
        label: "Quality Analytics",
        path: ROUTES.REPORT.ANALYTICS,
      },
      {
        id: "report-templates",
        label: "Report Library",
        path: ROUTES.REPORT.TEMPLATES,
      },
      {
        id: "report-history",
        label: "Report Run History",
        path: ROUTES.REPORT.HISTORY,
      },
      {
        id: "report-scheduled",
        label: "Scheduled Reports",
        path: ROUTES.REPORT.SCHEDULED,
      },
    ],
  },
  {
    id: "audit-trail",
    label: "Audit Trail",
    icon: IconFilter2Search,
    allowedPermissions: ["audittrail.module.view", "audit.review.view"],
    children: [
      {
        id: "audit-trail-all",
        label: "All Records",
        path: ROUTES.AUDIT_TRAIL,
        allowedPermissions: ["audittrail.module.view"],
      },
      {
        id: "audit-trail-review",
        label: "Periodic Review",
        path: ROUTES.AUDIT_TRAIL_REVIEW,
        allowedPermissions: ["audit.review.view"],
      },
    ],
  },
  {
    id: "backup-restore",
    label: "Backup & Restore",
    icon: DatabaseBackup,
    allowedPermissions: ["backup.module.view"],
    showDividerAfter: true,
    children: [
      {
        id: "backup-overview",
        label: "Backup Status Overview",
        path: ROUTES.BACKUP_RESTORE.OVERVIEW,
      },
      {
        id: "backup-group",
        label: "Backup",
        children: [
          { id: "backup-backups", label: "Backup History", path: ROUTES.BACKUP_RESTORE.BACKUPS },
          { id: "backup-verifications", label: "Backup Verification Results", path: ROUTES.BACKUP_RESTORE.BACKUP_VERIFICATIONS },
          { id: "backup-schedules", label: "Backup Schedules", path: ROUTES.BACKUP_RESTORE.BACKUP_SCHEDULES },
          { id: "backup-exports", label: "Export Requests", path: ROUTES.BACKUP_RESTORE.EXPORTS },
          { id: "backup-alerts", label: "Backup Alerts & Recipients", path: ROUTES.BACKUP_RESTORE.ALERTS, allowedPermissions: ["backup.admin.alerts.view"] },
        ],
      },
      {
        id: "restore-group",
        label: "Restore",
        children: [
          { id: "backup-restores", label: "Restore Requests", path: ROUTES.BACKUP_RESTORE.RESTORES },
          { id: "restore-verifications", label: "Restore Verification Reports", path: ROUTES.BACKUP_RESTORE.RESTORE_VERIFICATIONS },
          { id: "restore-history", label: "Restore History & Evidence", path: ROUTES.BACKUP_RESTORE.RESTORE_HISTORY },
          { id: "backup-inspections", label: "Backup Inspections", path: ROUTES.BACKUP_RESTORE.INSPECTIONS },
          { id: "restore-rules", label: "Restore Approval & Execution Rules", path: ROUTES.BACKUP_RESTORE.RESTORE_RULES, allowedPermissions: ["backup.admin.restore_controls.view"] },
          { id: "backup-dr-drills", label: "Disaster Recovery Drills", path: ROUTES.BACKUP_RESTORE.DR_DRILLS, allowedPermissions: ["backup.admin.disaster_recovery.view"] },
        ],
      },
    ],
  },

  // ── Security & Authorization ──────────────────────────────────────────────
  {
    id: "security-authorization",
    label: "Security & Authorization",
    icon: IconUserShield,
    allowedPermissions: [
      "settings.user.view",
      "security.access_profiles.view",
      "security.permission_sets.view",
      "security.workflow_authorization.view",
      "security.object_rules.view",
      "security.sod.view",
      "security.access_review.view",
    ],
    children: [
      {
        // "User Administration" nested group -- server (NavigationService.java) is the real
        // authority for the whole nav tree; this local copy is only the fallback used before
        // that response has loaded.
        id: "sec-user-administration",
        label: "User Administration",
        icon: IconUsers,
        allowedPermissions: ["settings.user.view"],
        children: [
          {
            id: "sec-user-management",
            label: "User Management",
            path: ROUTES.SECURITY.USERS,
            allowedPermissions: ["settings.user.view"],
          },
          {
            id: "sec-time-limited-roles",
            label: "Time-Limited User",
            path: ROUTES.SECURITY.TIME_LIMITED_USERS,
            allowedPermissions: ["settings.user.view"],
          },
          {
            id: "sec-logged-in-users",
            label: "Logged in Users",
            path: ROUTES.SECURITY.LOGGED_IN_USERS,
            allowedPermissions: ["settings.user.view"],
          },
        ],
      },
      {
        id: "sec-access-profiles",
        label: "Access Profiles",
        icon: IconUserKey,
        path: ROUTES.SECURITY.ACCESS_PROFILES,
        allowedPermissions: ["security.access_profiles.view"],
      },
      {
        id: "sec-workflow-authorization",
        label: "Workflow Authorization",
        icon: IconSwitch2,
        path: ROUTES.SECURITY.WORKFLOW_AUTHORIZATION,
        allowedPermissions: ["security.workflow_authorization.view"],
      },
      {
        id: "sec-access-review",
        label: "Access Review",
        icon: ScanSearch,
        path: ROUTES.SECURITY.ACCESS_REVIEW,
        allowedPermissions: ["security.access_review.view"],
      },
      {
        id: "sec-sod-violation-review",
        label: "SoD Violation Review",
        icon: IconViewfinder,
        path: ROUTES.SECURITY.SOD_VIOLATION_REVIEW,
        allowedPermissions: ["security.sod.view"],
      },
      // One-time / expert configuration — grouped so the everyday items above stay scannable.
      {
        id: "sec-advanced",
        label: "Advanced",
        icon: BrickWallShield,
        allowedPermissions: [
          "security.permission_sets.view",
          "security.workflow_authorization.view",
          "security.object_rules.view",
          "security.sod.view",
          "security.access_profiles.update",
        ],
        children: [
          {
            id: "sec-permission-sets",
            label: "Shared Permission Sets",
            path: ROUTES.SECURITY.PERMISSION_SETS,
            allowedPermissions: ["security.permission_sets.view"],
          },
          {
            id: "sec-workflow-role-catalog",
            label: "Workflow Role Catalog",
            path: ROUTES.SECURITY.WORKFLOW_ROLE_CATALOG,
            allowedPermissions: ["security.workflow_authorization.view"],
          },
          {
            id: "sec-sod",
            label: "Segregation of Duties",
            path: ROUTES.SECURITY.SOD,
            allowedPermissions: ["security.sod.view"],
          },
          {
            id: "sec-authorization-diagnostics",
            label: "Engine Diagnostics",
            path: ROUTES.SECURITY.AUTHORIZATION_DIAGNOSTICS,
            allowedPermissions: ["security.workflow_authorization.view"],
          },
          {
            id: "sec-object-rules",
            label: "Object Access Rules",
            path: ROUTES.SECURITY.OBJECT_RULES,
            allowedPermissions: ["security.object_rules.view"],
          },
        ],
      },
    ],
  },

  // ── Application Settings ──────────────────────────────────────────────────
  {
    id: "settings",
    label: "Application Settings",
    icon: IconSettings2,
    allowedPermissions: ["settings.configuration.view"],
    children: [
      {
        // "Dictionaries" nested group -- server (NavigationService.java) is the real authority
        // for the whole nav tree; this local copy is only the fallback used before that response
        // has loaded. Each child used to be a tab on one page; now each is its own page/menu
        // entry, in the same left-to-right order the tabs used to have.
        id: "dictionaries",
        label: "Dictionaries",
        icon: BookText,
        allowedPermissions: [
          "settings.business_unit.view",
          "settings.business_unit.manage",
          "settings.department.view",
          "settings.department.manage",
          "settings.position.view",
          "settings.position.manage",
          "settings.storage_location.view",
          "settings.storage_location.manage",
          "settings.retention_policy.view",
          "settings.retention_policy.manage",
        ],
        children: [
          {
            id: "dict-business-units",
            label: "Business Units",
            path: ROUTES.SETTINGS.DICTIONARIES_BUSINESS_UNITS,
            allowedPermissions: [
              "settings.business_unit.view",
              "settings.business_unit.manage",
            ],
          },
          {
            id: "dict-departments",
            label: "Departments",
            path: ROUTES.SETTINGS.DICTIONARIES_DEPARTMENTS,
            allowedPermissions: [
              "settings.department.view",
              "settings.department.manage",
            ],
          },
          {
            id: "dict-positions",
            label: "Positions",
            path: ROUTES.SETTINGS.DICTIONARIES_POSITIONS,
            allowedPermissions: [
              "settings.position.view",
              "settings.position.manage",
            ],
          },
          {
            id: "dict-storage-locations",
            label: "Storage Locations",
            path: ROUTES.SETTINGS.DICTIONARIES_STORAGE_LOCATIONS,
            allowedPermissions: [
              "settings.storage_location.view",
              "settings.storage_location.manage",
            ],
          },
          {
            id: "dict-retention-policies",
            label: "Retention Policies",
            path: ROUTES.SETTINGS.DICTIONARIES_RETENTION_POLICIES,
            allowedPermissions: [
              "settings.retention_policy.view",
              "settings.retention_policy.manage",
            ],
          },
        ],
      },
      {
        id: "education",
        label: "Education",
        icon: University,
        allowedPermissions: [
          "settings.education.degree_level.view",
          "settings.education.degree_level.manage",
          "settings.education.school.view",
          "settings.education.school.manage",
        ],
        children: [
          {
            id: "education-degree-levels",
            label: "Degree Levels",
            path: ROUTES.SETTINGS.EDUCATION_DEGREE_LEVELS,
            allowedPermissions: [
              "settings.education.degree_level.view",
              "settings.education.degree_level.manage",
            ],
          },
          {
            id: "education-schools",
            label: "Schools",
            path: ROUTES.SETTINGS.EDUCATION_SCHOOLS,
            allowedPermissions: [
              "settings.education.school.view",
              "settings.education.school.manage",
            ],
          },
        ],
      },
      {
        id: "email-templates",
        label: "Email Templates",
        icon: IconMailForward,
        path: ROUTES.SETTINGS.EMAIL_TEMPLATES,
        allowedPermissions: [
          "settings.email_template.view",
          "settings.email_template.manage",
          "settings.configuration.view",
        ],
      },
      {
        id: "system-announcements",
        label: "System Announcements",
        icon: IconSpeakerphone,
        path: ROUTES.SETTINGS.ANNOUNCEMENTS,
        allowedPermissions: [
          "settings.announcement.view",
          "settings.announcement.manage",
        ],
      },
      {
        id: "notification-policy",
        label: "Notification In-app",
        icon: Bell,
        path: ROUTES.SETTINGS.NOTIFICATION_POLICY,
        allowedPermissions: ["settings.configuration.view"],
      },
    ],
  },

  // ── System Administration ─────────────────────────────────────────────────
  {
    id: "system-administration",
    label: "System Administration",
    icon: IconDeviceDesktopCog,
    allowedPermissions: [
      "settings.configuration.view",
      "documents.admin.view",
      "documents.admin.properties.view",
      "documents.admin.properties.manage",
      "documents.admin.name_formats.view",
      "documents.admin.name_formats.manage",
      "documents.admin.document_types.view",
      "documents.admin.document_types.manage",
      "documents.admin.knowledge_categories.view",
      "documents.admin.knowledge_categories.manage",
      "documents.admin.publishing_templates.view",
      "documents.admin.publishing_templates.manage",
      "documents.admin.controlled_copies_policy.view",
      "documents.admin.controlled_copies_policy.manage",
      "documents.admin.uncontrolled_copies_policy.view",
      "documents.admin.uncontrolled_copies_policy.manage",
      "training.admin.view",
    ],
    children: [
      {
        id: "config",
        label: "Configuration",
        path: ROUTES.SETTINGS.CONFIGURATION,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        id: "electronic-signature-policies",
        label: "E-Sign Config",
        path: ROUTES.SECURITY.ESIGN_POLICIES,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        // Moved here from Document Control -- see NavigationService.java for the server-side
        // authority (the local tree below is only the fallback used before that response loads).
        id: "doc-administration",
        label: "Document Administration",
        allowedPermissions: [
          "documents.admin.properties.view",
          "documents.admin.properties.manage",
          "documents.admin.name_formats.view",
          "documents.admin.name_formats.manage",
          "documents.admin.document_types.view",
          "documents.admin.document_types.manage",
          "documents.admin.knowledge_categories.view",
          "documents.admin.knowledge_categories.manage",
          "documents.admin.publishing_templates.view",
          "documents.admin.publishing_templates.manage",
          "documents.admin.controlled_copies_policy.view",
          "documents.admin.controlled_copies_policy.manage",
          "documents.admin.uncontrolled_copies_policy.view",
          "documents.admin.uncontrolled_copies_policy.manage",
        ],
        children: [
          {
            id: "doc-admin-properties",
            label: "Document Properties",
            path: ROUTES.DOCUMENTS.ADMIN.PROPERTIES,
            allowedPermissions: [
              "documents.admin.properties.view",
              "documents.admin.properties.manage",
            ],
          },
          {
            id: "doc-admin-name-formats",
            label: "Document Name Formats",
            path: ROUTES.DOCUMENTS.ADMIN.NAME_FORMATS,
            allowedPermissions: [
              "documents.admin.name_formats.view",
              "documents.admin.name_formats.manage",
            ],
          },
          {
            id: "doc-admin-document-components",
            label: "Document Components",
            path: ROUTES.DOCUMENTS.ADMIN.DOCUMENT_COMPONENTS,
            allowedPermissions: [
              "documents.admin.name_formats.view",
              "documents.admin.name_formats.manage",
            ],
          },
          {
            id: "doc-admin-document-types",
            label: "Document Types",
            path: ROUTES.DOCUMENTS.ADMIN.DOCUMENT_TYPES,
            allowedPermissions: [
              "documents.admin.document_types.view",
              "documents.admin.document_types.manage",
            ],
          },
          {
            id: "doc-admin-document-sub-types",
            label: "Document Sub-Types",
            path: ROUTES.DOCUMENTS.ADMIN.DOCUMENT_SUB_TYPES,
            allowedPermissions: [
              "documents.admin.document_types.view",
              "documents.admin.document_types.manage",
            ],
          },
          {
            id: "doc-admin-knowledge-categories",
            label: "Knowledge Categories Hierarchies",
            path: ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_CATEGORIES,
            allowedPermissions: [
              "documents.admin.knowledge_categories.view",
              "documents.admin.knowledge_categories.manage",
            ],
          },
          {
            id: "doc-admin-knowledge-components",
            label: "Knowledge Category Components",
            path: ROUTES.DOCUMENTS.ADMIN.KNOWLEDGE_COMPONENTS,
            allowedPermissions: [
              "documents.admin.knowledge_categories.view",
              "documents.admin.knowledge_categories.manage",
            ],
          },
          {
            id: "publishing-templates",
            label: "Publishing Templates",
            path: ROUTES.DOCUMENTS.ADMIN.PUBLISHING_TEMPLATES,
            allowedPermissions: [
              "documents.admin.publishing_templates.view",
              "documents.admin.publishing_templates.manage",
            ],
          },
          {
            id: "controlled-copy-policy",
            label: "Controlled Copies Policy",
            path: ROUTES.DOCUMENTS.ADMIN.CONTROLLED_COPIES_POLICY,
            allowedPermissions: [
              "documents.admin.controlled_copies_policy.view",
              "documents.admin.controlled_copies_policy.manage",
            ],
          },
          {
            id: "uncontrolled-copy-policy",
            label: "Uncontrolled Copies Policy",
            path: ROUTES.DOCUMENTS.ADMIN.UNCONTROLLED_COPIES_POLICY,
            allowedPermissions: [
              "documents.admin.uncontrolled_copies_policy.view",
              "documents.admin.uncontrolled_copies_policy.manage",
            ],
          },
        ],
      },
      {
        // Coming soon sub-screens -- no real functionality behind them yet, each just a
        // placeholder page with its own permission (mirrors doc-administration's per-screen split).
        id: "training-administration",
        label: "Training Administration",
        allowedPermissions: [
          "training.admin.properties.view",
          "training.settings.view",
          "training.admin.manage",
        ],
        children: [
          {
            id: "training-admin-properties",
            label: "Training Properties",
            path: ROUTES.SETTINGS.TRAINING_ADMINISTRATION.PROPERTIES,
            allowedPermissions: ["training.admin.properties.view", "training.settings.view"],
          },
          {
            id: "training-admin-topics",
            label: "Training Topics",
            path: ROUTES.SETTINGS.TRAINING_ADMINISTRATION.TOPICS,
            allowedPermissions: ["training.admin.manage"],
          },
          {
            id: "training-admin-person-positions",
            label: "Person Positions",
            path: ROUTES.SETTINGS.TRAINING_ADMINISTRATION.PERSON_POSITIONS,
            allowedPermissions: ["training.admin.manage"],
          },
        ],
      },
      {
        id: "report-administration",
        label: "Report Administration",
        allowedPermissions: [
          "reports.definition.view",
          "settings.configuration.view",
        ],
        children: [
          {
            id: "report-admin-definitions",
            label: "Report Definitions",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.DEFINITIONS,
            allowedPermissions: [
              "reports.definition.view",
              "settings.configuration.view",
            ],
          },
          {
            id: "report-admin-properties",
            label: "Report Properties",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.PROPERTIES,
            allowedPermissions: ["reports.properties.view", "reports.properties.manage"],
          },
          {
            id: "report-admin-types",
            label: "Report Types",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.TYPES,
            allowedPermissions: ["reports.types.view", "reports.types.manage"],
          },
          {
            id: "report-admin-name-formats",
            label: "Report Name Formats",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.NAME_FORMATS,
            allowedPermissions: [
              "reports.definition.view",
              "reports.name_format.manage",
              "settings.configuration.view",
            ],
          },
          {
            id: "report-admin-access",
            label: "Report Access & Data Scope",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.ACCESS,
            allowedPermissions: [
              "reports.definition.view",
              "settings.configuration.view",
            ],
          },
          {
            id: "report-admin-retention",
            label: "Report Retention & Legal Hold",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.RETENTION,
            allowedPermissions: [
              "reports.definition.view",
              "settings.configuration.view",
            ],
          },
          {
            id: "report-admin-delivery",
            label: "Scheduled Report Delivery",
            path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.DELIVERY,
            allowedPermissions: [
              "reports.definition.view",
              "settings.configuration.view",
            ],
          },
        ],
      },
      {
        id: "backup-restore-administration",
        label: "Backup & Restore Administration",
        allowedPermissions: [
          "backup.admin.policy.view",
          "backup.admin.retention.view",
          "backup.admin.storage.view",
          "backup.admin.verification.view",
          "backup.admin.restore_controls.view",
          "backup.admin.alerts.view",
          "backup.admin.disaster_recovery.view",
        ],
        children: [
          {
            id: "backup-admin-policy",
            label: "Backup Policy",
            path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY,
            allowedPermissions: ["backup.admin.policy.view"],
          },
          {
            id: "backup-admin-storage",
            label: "Backup Storage & Encryption",
            path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.STORAGE,
            allowedPermissions: ["backup.admin.storage.view"],
          },
          {
            id: "backup-admin-controls",
            label: "Backup Controls",
            path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.CONTROLS,
            allowedPermissions: [
              "backup.admin.restore_controls.view",
              "backup.admin.verification.view",
              "backup.admin.retention.view",
            ],
          },
          {
            id: "backup-admin-alerts",
            label: "Backup Alerts & Recipients",
            path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.ALERTS,
            allowedPermissions: ["backup.admin.alerts.view"],
          },
          {
            id: "backup-admin-disaster-recovery",
            label: "Disaster Recovery Plan",
            path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.DISASTER_RECOVERY,
            allowedPermissions: ["backup.admin.disaster_recovery.view"],
          },
        ],
      },
    ],
  },

  // ── Help & Support / Preferences ─────────────────────────────────────────
  {
    id: "preferences",
    label: "Preferences",
    icon: IconAdjustmentsHorizontal,
    path: ROUTES.PREFERENCES,
    allowedPermissions: ["preferences.module.view"],
  },
  {
    id: "system-information",
    label: "System Information",
    icon: IconInfoCircle,
    path: ROUTES.SETTINGS.SYSTEM_INFO,
    allowedPermissions: ["settings.configuration.view"],
  },
];

// ============================================================================
// MAIN CONFIGURATION
// ============================================================================
export const QUALITY_NAV_CONFIG: NavItem[] = [
  ...CORE_NAV,
  ...FOUNDATION_MODULES,
  ...SYSTEM_MODULES,
];

// The aggregate config is retained for shared route lookup and navigation.
export const NAV_CONFIG: NavItem[] = [...QUALITY_NAV_CONFIG];

export interface NavigationLabelOption {
  id: string;
  defaultLabel: string;
  hierarchy: string;
}

/** Stable menu identifiers available for presentation-only label overrides. */
export const NAVIGATION_LABEL_OPTIONS: NavigationLabelOption[] = (() => {
  const options: NavigationLabelOption[] = [];
  const visit = (items: NavItem[], ancestors: string[] = []) =>
    items.forEach((item) => {
      const hierarchy = [...ancestors, item.label].join(" › ");
      options.push({ id: item.id, defaultLabel: item.label, hierarchy });
      if (item.children) visit(item.children, [...ancestors, item.label]);
    });
  visit(NAV_CONFIG);
  return options;
})();

/** Resolve a server-configured label for navigation, breadcrumbs, or page titles. */
export const resolveConfiguredNavigationLabel = (
  label: string,
  overrides?: Record<string, string>,
): string => {
  if (!label?.trim() || !overrides) return label;
  const direct = overrides[label];
  if (direct?.trim()) return direct.trim();
  const option = NAVIGATION_LABEL_OPTIONS.find(
    (item) => item.defaultLabel === label,
  );
  const configured = option ? overrides[option.id] : undefined;
  return configured?.trim() || label;
};

// Helper to find a node and build breadcrumbs
export const findNodeAndBreadcrumbs = (
  items: NavItem[],
  targetId: string,
  currentPath: { label: string; id: string }[] = [],
): { label: string; id: string }[] | null => {
  for (const item of items) {
    const newPath = [...currentPath, { label: item.label, id: item.id }];
    if (item.id === targetId) {
      return newPath;
    }
    if (item.children) {
      const result = findNodeAndBreadcrumbs(item.children, targetId, newPath);
      if (result) return result;
    }
  }
  return null;
};

// Helper to find nav item by path
export const findNodeByPath = (
  items: NavItem[],
  targetPath: string,
): NavItem | null => {
  let closestParent: NavItem | null = null;
  for (const item of items) {
    if (item.path === targetPath) {
      return item;
    }
    if (
      item.path &&
      targetPath.startsWith(`${item.path.replace(/\/$/, "")}/`) &&
      (!closestParent || item.path.length > closestParent.path!.length)
    ) {
      closestParent = item;
    }
    if (item.children) {
      const result = findNodeByPath(item.children, targetPath);
      if (result) return result;
    }
  }
  return closestParent;
};

// Helper to get all paths (useful for route generation)
export const getAllPaths = (items: NavItem[]): string[] => {
  const paths: string[] = [];
  const traverse = (nodes: NavItem[]) => {
    nodes.forEach((node) => {
      if (node.path) paths.push(node.path);
      if (node.children) traverse(node.children);
    });
  };
  traverse(items);
  return paths;
};

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
  Package,
  Scale,
  ShieldCheck,
  BookText,
  GraduationCap,
  UserStar,
  SquareChartGantt,
  PenTool,
  UserRound,
  UsersRound,
  type LucideProps,
  ScanSearch,
  BrickWallShield,
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
} from "@tabler/icons-react";
import { NavItem } from "@/types";
import { ROUTES } from "./routes.constants";

export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Bell,
  Package,
  Scale,
  ShieldCheck,
  BookText,
  GraduationCap,
  UserStar,
  SquareChartGantt,
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
  IconChartBar,
  IconKey,
  IconArrowsShuffle,
  IconDatabase,
  IconScale,
  IconLock,
  IconActivity,
};

// ============================================================================
// QUALITY CORE NAVIGATION (Dashboard and Notifications)
// ============================================================================
// Dashboard and Notifications are baseline workspace surfaces — available to every
// authenticated user without a permission gate (same policy as Work Management).
const CORE_NAV: NavItem[] = [
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    path: ROUTES.NOTIFICATIONS,
    allowedPermissions: ["notifications.module.view"],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: IconLayoutGrid,
    path: ROUTES.DASHBOARD,
    allowedPermissions: ["dashboard.module.view"],
    showDividerAfter: true,
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
        id: "knowledge-base",
        label: "Knowledge Base",
        path: ROUTES.DOCUMENTS.KNOWLEDGE,
      },
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
      },
      {
        id: "training-materials",
        label: "Training Materials",
        path: ROUTES.TRAINING.MATERIALS,
      },
      {
        id: "course-inventory",
        label: "Course Inventory",
        children: [
          {
            id: "courses-list",
            label: "Courses List",
            path: ROUTES.TRAINING.COURSES_LIST,
          },
          {
            id: "training-pending-review",
            label: "Pending Review",
            path: ROUTES.TRAINING.PENDING_REVIEW,
          },
          {
            id: "training-pending-approval",
            label: "Pending Approval",
            path: ROUTES.TRAINING.PENDING_APPROVAL,
          },
        ],
      },
      {
        id: "compliance-tracking",
        label: "Compliance Tracking",
        children: [
          {
            id: "auto-assignment-rules",
            label: "Auto-Assignment Rules",
            path: ROUTES.TRAINING.ASSIGNMENT_RULES,
          },
          {
            id: "training-matrix",
            label: "Training Matrix",
            path: ROUTES.TRAINING.TRAINING_MATRIX,
          },
          {
            id: "course-status",
            label: "Course Status",
            path: ROUTES.TRAINING.COURSE_STATUS,
          },
        ],
      },
      {
        id: "records-archive",
        label: "Records & Archive",
        children: [
          {
            id: "employee-training-files",
            label: "Employee Training Files",
            path: ROUTES.TRAINING.EMPLOYEE_TRAINING_FILES,
          },
          {
            id: "export-records",
            label: "Export Records",
            path: ROUTES.TRAINING.EXPORT_RECORDS,
          },
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
        id: "report-templates",
        label: "Report Templates",
        path: ROUTES.REPORT.TEMPLATES,
      },
      {
        id: "report-history",
        label: "Report History",
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
    showDividerAfter: true,
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

  // ── Security & Authorization ──────────────────────────────────────────────
  {
    id: "security-authorization",
    label: "Security & Authorization",
    icon: ShieldCheck,
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
        id: "sec-user-management",
        label: "User Management",
        icon: IconUsers,
        path: ROUTES.SECURITY.USERS,
        allowedPermissions: ["settings.user.view"],
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
        id: "sec-authorization-diagnostics",
        label: "Engine Diagnostics",
        icon: IconActivity,
        path: ROUTES.SECURITY.AUTHORIZATION_DIAGNOSTICS,
        allowedPermissions: ["security.workflow_authorization.view"],
      },
      {
        id: "sec-access-review",
        label: "Access Review",
        icon: ScanSearch,
        path: ROUTES.SECURITY.ACCESS_REVIEW,
        allowedPermissions: ["security.access_review.view"],
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
            id: "sec-object-rules",
            label: "Object Access Rules",
            path: ROUTES.SECURITY.OBJECT_RULES,
            allowedPermissions: ["security.object_rules.view"],
          },
          {
            id: "sec-sod",
            label: "Segregation of Duties",
            path: ROUTES.SECURITY.SOD,
            allowedPermissions: ["security.sod.view"],
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
    allowedPermissions: ["settings.configuration.view", "settings.publishing_template.view"],
    children: [
      {
        id: "dictionaries",
        label: "Dictionaries",
        icon: BookText,
        path: ROUTES.SETTINGS.DICTIONARIES,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        id: "email-templates",
        label: "Email Templates",
        icon: IconMailForward,
        path: ROUTES.SETTINGS.EMAIL_TEMPLATES,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        id: "notification-policy",
        label: "Notification In-app",
        icon: Bell,
        path: ROUTES.SETTINGS.NOTIFICATION_POLICY,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        id: "report-configuration",
        label: "Report Configuration",
        icon: IconReport,
        path: ROUTES.SETTINGS.REPORT_CONFIGURATION,
        allowedPermissions: ["reports.definition.view", "settings.configuration.view"],
      },
      {
        id: "settings-document-control",
        label: "Document Control",
        icon: IconFileDescription,
        allowedPermissions: [
          "settings.configuration.view",
          "settings.controlled_copy_policy.view",
          "settings.publishing_template.view",
        ],
        children: [
          {
            id: "publishing-templates",
            label: "Publishing Templates",
            path: ROUTES.SETTINGS.PUBLISHING_TEMPLATES,
            allowedPermissions: ["settings.publishing_template.view", "settings.configuration.view"],
          },
          {
            id: "controlled-copy-policy",
            label: "Controlled Copies Policy",
            path: ROUTES.SETTINGS.CONTROLLED_COPY_POLICY,
            allowedPermissions: ["settings.controlled_copy_policy.view"],
          },
        ],
      },
    ],
  },

  // ── System Administration ─────────────────────────────────────────────────
  {
    id: "system-administration",
    label: "System Administration",
    icon: UserStar,
    allowedPermissions: ["settings.configuration.view", "documents.admin.view"],
    children: [
      {
        id: "config",
        label: "Configuration",
        icon: IconDeviceDesktopCog,
        path: ROUTES.SETTINGS.CONFIGURATION,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        id: "electronic-signature-policies",
        label: "E-Sign Config",
        icon: PenToolRotated,
        path: ROUTES.SECURITY.ESIGN_POLICIES,
        allowedPermissions: ["settings.configuration.view"],
      },
      {
        id: "info-sys",
        label: "System Information",
        icon: IconAlertSquareRounded,
        path: ROUTES.SETTINGS.SYSTEM_INFO,
        allowedPermissions: ["settings.configuration.view"],
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
export const NAV_CONFIG: NavItem[] = [
  ...QUALITY_NAV_CONFIG,
];

export interface NavigationLabelOption {
  id: string;
  defaultLabel: string;
  hierarchy: string;
}

/** Stable menu identifiers available for presentation-only label overrides. */
export const NAVIGATION_LABEL_OPTIONS: NavigationLabelOption[] = (() => {
  const options: NavigationLabelOption[] = [];
  const visit = (items: NavItem[], ancestors: string[] = []) => items.forEach((item) => {
    const hierarchy = [...ancestors, item.label].join(' › ');
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
  const option = NAVIGATION_LABEL_OPTIONS.find((item) => item.defaultLabel === label);
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
  for (const item of items) {
    if (item.path === targetPath) {
      return item;
    }
    if (item.children) {
      const result = findNodeByPath(item.children, targetPath);
      if (result) return result;
    }
  }
  return null;
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

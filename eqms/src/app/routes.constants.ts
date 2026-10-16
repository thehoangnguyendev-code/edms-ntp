/**
 * Application Route Constants
 * Centralized route definitions for type-safe navigation
 */

export const ROUTES = {
  // Auth
  LOGIN: '/login',
  TWO_FACTOR: '/login/2fa',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  FORCE_PASSWORD_CHANGE: '/login/force-password-change',
  MFA_SETUP: '/login/mfa-setup',
  MAINTENANCE: '/maintenance',
  // Public, token-secured link used in distribution emails — opens a PDF preview only,
  // does not require an EQMS login (see ControlledCopyPreviewView).
  PUBLIC_CONTROLLED_COPY_PREVIEW: (id: string, token: string) => `/controlled-copy-preview/${id}#token=${encodeURIComponent(token)}`,

  // Dashboard
  DASHBOARD: '/dashboard',

  // Notifications
  NOTIFICATIONS: '/notifications',
  CALENDAR: '/calendar',

  // Self-Service
  SELF_SERVICE: {
    KNOWLEDGE: '/self-service/knowledge',
  },

  // Documents
  DOCUMENTS: {
    OWNED: '/documents/owned',
    ALL: '/documents/all',
    NEW: '/documents/all/new',
    LEGACY_IMPORT: '/documents/all/legacy-import',
    EDIT: (id: string) => `/documents/all/edit/${id}`,
    DETAIL: (id: string) => `/documents/${id}`,
    // The Knowledge landing page itself moved to SELF_SERVICE.KNOWLEDGE -- these two remain here,
    // they're separate standalone views (new-tab Explorer, and a single-document preview link),
    // not the Self-Service Knowledge page.
    KNOWLEDGE_EXPLORER: '/documents/knowledge/explorer',
    KNOWLEDGE_PREVIEW: (id: string) => `/documents/knowledge/preview/${id}`,
    SNAPSHOT_HISTORY_PREVIEW: (revisionId: string, historyId: string) =>
      `/documents/revisions/${revisionId}/snapshot-history/${historyId}/preview`,

    // Templates
    TEMPLATES: '/documents/templates',
    TEMPLATES_NEW: '/documents/templates/new',
    TEMPLATE_DETAIL: (id: string) => `/documents/templates/${id}`,

    // Revisions
    REVISIONS: {
      ALL: '/documents/revisions/all',
      OWNED: '/documents/revisions/owned',
      PENDING_REVIEW: '/documents/revisions/pending-review',
      PENDING_APPROVAL: '/documents/revisions/pending-approval',
      NEW: '/documents/revisions/new',
      STANDALONE: '/documents/revisions/standalone',
      CREATE: '/documents/revisions/create',
      EDIT: (id: string) => `/documents/revisions/edit/${id}`,
      DETAIL: (id: string) => `/documents/revisions/${id}`,
      PUBLISHING: (id: string) => `/documents/revisions/${id}/publishing`,
      REVIEW: (id: string) => `/documents/revisions/review/${id}`,
      APPROVAL: (id: string) => `/documents/revisions/approval/${id}`,
      TRAINING: (id: string) => `/documents/revisions/training/${id}`,
    },

    // Controlled Copies
    CONTROLLED_COPIES: {
      ALL: '/documents/controlled-copies/all',
      READY: '/documents/controlled-copies/ready',
      DISTRIBUTED: '/documents/controlled-copies/distributed',
      DETAIL: (id: string) => `/documents/controlled-copies/${id}`,
      DISCREPANCIES: '/documents/controlled-copies/discrepancies',
      RECALL_SCAN: '/documents/controlled-copies/recall-scan',
      DESTROY: (id: string) => `/documents/controlled-copies/${id}/destroy`,
      REQUEST: '/documents/controlled-copy/request',
      /** The "download" link inside the DCO's batch-ZIP email; requires login (the "Receive Controlled
       *  Copies as DCO" permission), never a public/token link. */
      DCO_BATCH_ZIP: (batchId: string) => `/documents/controlled-copies/batches/${batchId}/dco-zip`,
    },

    // Uncontrolled Copies -- separate feature/table/API from Controlled Copies (never recalled/tracked after issue)
    UNCONTROLLED_COPIES: {
      ALL: '/documents/uncontrolled-copies/all',
      PENDING_APPROVAL: '/documents/uncontrolled-copies/pending-approval',
      DISTRIBUTED: '/documents/uncontrolled-copies/distributed',
      DETAIL: (id: string) => `/documents/uncontrolled-copies/${id}`,
      /** The "download" link inside the distribution e-mail; login-required, never a public/token link. */
      DOWNLOAD: (id: string) => `/documents/uncontrolled-copies/${id}/download`,
    },
    RECORDS: '/documents/records',

    // Document Administration (admin-only, now under System Administration -- URLs unchanged
    // since documents/administration/* is also the backend @RequestMapping base path)
    ADMIN: {
      PROPERTIES: '/documents/administration/properties',
      NAME_FORMATS: '/documents/administration/name-formats',
      NAME_FORMATS_NEW: '/documents/administration/name-formats/new',
      NAME_FORMATS_EDIT: (id: string) => `/documents/administration/name-formats/edit/${id}`,
      DOCUMENT_COMPONENTS: '/documents/administration/document-components',
      DOCUMENT_COMPONENTS_NEW: '/documents/administration/document-components/new',
      DOCUMENT_COMPONENTS_EDIT: (id: string) => `/documents/administration/document-components/edit/${id}`,
      DOCUMENT_TYPES: '/documents/administration/document-types',
      DOCUMENT_SUB_TYPES: '/documents/administration/document-sub-types',
      KNOWLEDGE_CATEGORIES: '/documents/administration/knowledge-categories',
      KNOWLEDGE_CATEGORIES_NEW: '/documents/administration/knowledge-categories/new',
      KNOWLEDGE_COMPONENTS: '/documents/administration/knowledge-components',
      KNOWLEDGE_COMPONENTS_NEW: '/documents/administration/knowledge-components/new',
      KNOWLEDGE_COMPONENTS_EDIT: (id: string) => `/documents/administration/knowledge-components/edit/${id}`,
      KNOWLEDGE_CATEGORIES_EDIT: (id: string) => `/documents/administration/knowledge-categories/edit/${id}`,
      PUBLISHING_TEMPLATES: '/documents/administration/publishing-templates',
      PUBLISHING_TEMPLATES_NEW: '/documents/administration/publishing-templates/new',
      PUBLISHING_TEMPLATES_EDIT: (id: string) => `/documents/administration/publishing-templates/edit/${id}`,
      CONTROLLED_COPIES_POLICY: '/documents/administration/controlled-copies-policy',
      UNCONTROLLED_COPIES_POLICY: '/documents/administration/uncontrolled-copies-policy',
    },
  },

  // Training
  TRAINING: {
    BASE: '/training-management',
    ACTIVITIES: '/training-management/activities',
    ACTIVITY_DETAIL: (activityId: string) => `/training-management/activities/${activityId}`,
    MATRICES: '/training-management/matrices',
    RECORDS: '/training-management/records',
    NUMBER_LOG: '/training-management/number-log',
    COMPLIANCE: '/training-management/compliance',
    LEGACY_EVIDENCE: '/training-management/legacy-evidence',
    REQUIREMENTS: '/training-management/requirements',
    RECORD_EXPORTS: '/training-management/record-exports',
    SPECIMEN_SIGNATURES: '/training-management/specimen-signatures',
    JOB_ASSIGNMENTS: '/training-management/job-assignments',
    MY_TRAINING: '/training-management/my-training',
  },

  // Report
  REPORT: {
    BASE: '/report',
    OVERVIEW: '/report/overview',
    ANALYTICS: '/report/analytics',
    TEMPLATES: '/report/templates',
    HISTORY: '/report/history',
    RUN_PREVIEW: '/report/runs/preview',
    SCHEDULED: '/report/scheduled',
  },

  // Audit Trail
  AUDIT_TRAIL: '/audit-trail',
  AUDIT_TRAIL_REVIEW: '/audit-trail/reviews',

  // Backup & Restore
  BACKUP_RESTORE: {
    BASE: '/backup-restore',
    OVERVIEW: '/backup-restore/overview',
    BACKUPS: '/backup-restore/backups',
    BACKUP_DETAIL: (backupNumber: string) => `/backup-restore/backups/${encodeURIComponent(backupNumber)}`,
    BACKUP_SCHEDULES: '/backup-restore/backups/schedules',
    EXPORTS: '/backup-restore/backups/exports',
    BACKUP_VERIFICATIONS: '/backup-restore/backups/verifications',
    RESTORES: '/backup-restore/restores',
    RESTORE_NEW: '/backup-restore/restores/new',
    RESTORE_DETAIL: (restoreNumber: string) => `/backup-restore/restores/${encodeURIComponent(restoreNumber)}`,
    RESTORE_EXECUTION: (restoreNumber: string) => `/backup-restore/restores/${encodeURIComponent(restoreNumber)}/execution`,
    RESTORE_VERIFICATIONS: '/backup-restore/restores/verification-reports',
    RESTORE_HISTORY: '/backup-restore/restores/history',
    INSPECTIONS: '/backup-restore/restores/inspections',
    ALERTS: '/backup-restore/alerts',
    RESTORE_RULES: '/backup-restore/restore-rules',
    DR_DRILLS: '/backup-restore/dr-drills',
  },

  // Settings
  SETTINGS: {
    USERS: '/settings/users',
    USERS_ADD: '/settings/users/add',
    USERS_EDIT: (userId: string) => `/settings/users/edit/${userId}`,
    USERS_PROFILE: (userId: string) => `/settings/users/profile/${userId}`,
    DICTIONARIES: '/settings/dictionaries',
    DICTIONARIES_BUSINESS_UNITS: '/settings/dictionaries/business-units',
    DICTIONARIES_DEPARTMENTS: '/settings/dictionaries/departments',
    DICTIONARIES_POSITIONS: '/settings/dictionaries/positions',
    DICTIONARIES_STORAGE_LOCATIONS: '/settings/dictionaries/storage-locations',
    DICTIONARIES_RETENTION_POLICIES: '/settings/dictionaries/retention-policies',
    EDUCATION_DEGREE_LEVELS: '/settings/education/degree-levels',
    EDUCATION_SCHOOLS: '/settings/education/schools',
    EDUCATION_SCHOOLS_NEW: '/settings/education/schools/new',
    EDUCATION_SCHOOLS_EDIT: (id: string) => `/settings/education/schools/${id}/edit`,
    CONFIGURATION: '/settings/configuration',
    EMAIL_TEMPLATES: '/settings/email-templates',
    EMAIL_TEMPLATES_NEW: '/settings/email-templates/new',
    EMAIL_TEMPLATES_EDIT: (id: string) => `/settings/email-templates/edit/${id}`,
    ANNOUNCEMENTS: '/settings/announcements',
    ANNOUNCEMENTS_NEW: '/settings/announcements/new',
    ANNOUNCEMENTS_EDIT: (id: string) => `/settings/announcements/edit/${id}`,
    ELECTRONIC_SIGNATURE: '/settings/electronic-signature',
    NOTIFICATION_POLICY: '/settings/notification-policy',
    SYSTEM_INFO: '/settings/system-info',
    REPORT_CONFIGURATION: '/settings/report-configuration',
    REPORT_ADMINISTRATION: {
      DEFINITIONS: '/settings/report-configuration',
      ACCESS: '/settings/administration/report/access',
      RETENTION: '/settings/administration/report/retention',
      DELIVERY: '/settings/administration/report/delivery',
      NAME_FORMATS: '/settings/report-name-formats',
      TYPES: '/settings/report-types',
      PROPERTIES: '/settings/report-properties',
    },
    BACKUP_ADMINISTRATION: {
      POLICY: '/settings/administration/backup/policy',
      POLICY_NEW: '/settings/administration/backup/policy/new',
      POLICY_DETAIL: (version: number | string) => `/settings/administration/backup/policy/${version}`,
      STORAGE: '/settings/administration/backup/storage',
      MEDIUM_DETAIL: (id: string) => `/settings/administration/backup/storage/media/${id}`,
      /** Restore rules, verification & drills, and retention & legal hold, one tab each (?tab=restore-rules | verification | retention). */
      CONTROLS: '/settings/administration/backup/controls',
      ALERTS: '/settings/administration/backup/alerts',
      DISASTER_RECOVERY: '/settings/administration/backup/disaster-recovery',
    },
    TRAINING_ADMINISTRATION: {
      PROPERTIES: '/settings/administration/training/properties',
      TOPICS: '/settings/administration/training/topics',
      PERSON_POSITIONS: '/settings/administration/training/person-positions',
    },
  },

  // Security & Authorization
  SECURITY: {
    // Existing pages (URLs unchanged, just reorganised in nav)
    USERS: '/settings/users',
    TIME_LIMITED_USERS: '/settings/users/time-limited',
    TIME_LIMITED_USERS_NEW: '/settings/users/time-limited/new',
    TIME_LIMITED_USERS_DETAIL: (id: string) => `/settings/users/time-limited/${id}`,
    TIME_LIMITED_USERS_EDIT: (id: string) => `/settings/users/time-limited/${id}/edit`,
    LOGGED_IN_USERS: '/settings/users/logged-in',
    ACCESS_PROFILES: '/security/access-profiles',
    ESIGN_POLICIES: '/settings/electronic-signature',
    // New pages
    PERMISSION_SETS: '/security/permission-sets',
    WORKFLOW_ROLE_CATALOG: '/security/advanced/workflow-roles',
    WORKFLOW_AUTHORIZATION: '/security/lifecycle-policies',
    LIFECYCLE_POLICIES_TRANSITIONS: '/security/lifecycle-policies/transitions',
    LIFECYCLE_POLICIES_CAPABILITIES: '/security/lifecycle-policies/capabilities',
    POLICY_RESOLVER: '/security/lifecycle-policies/policy-resolver',
    AUTHORIZATION_DIAGNOSTICS: '/security/authorization-diagnostics',
    OBJECT_RULES: '/security/object-rules',
    SOD: '/security/sod',
    SOD_VIOLATION_REVIEW: '/security/sod-violation-review',
    ACCESS_REVIEW: '/security/access-review',
  },

  // Preferences
  PREFERENCES: '/preferences',

  // Profile
  PROFILE: '/profile',
  PROFILE_DATA_PRIVACY: '/profile/data-privacy',
} as const;

/**
 * Helper to get route with parameters
 * @example getRoute(ROUTES.DOCUMENTS.DETAIL, '123') // '/documents/123'
 */
export const getRoute = (
  routeFn: string | ((param: string) => string),
  param?: string
): string => {
  if (typeof routeFn === 'function' && param) {
    return routeFn(param);
  }
  return routeFn as string;
};

/**
 * Path prefixes that indicate a "transactional" screen (create, edit, review,
 * approval, new, add, upload, workspace, destroy, etc.). When the user navigates
 * away from such a screen via the sidebar, a leave-confirmation modal is shown.
 *
 * RULE: Only include paths that are SPECIFIC enough to never match a list/index
 * page. Prefer explicit subpaths (e.g. `/create`, `/edit`, `/destroy`) over
 * broad category prefixes that would also match list pages.
 *
 * Two matching strategies are supported (see isTransactionalRoute):
 *   prefix: []  → path.startsWith(prefix)   (e.g. fixed action paths)
 *   suffix: []  → path.endsWith(suffix)     (e.g. /:id/edit, /:id/destroy)
 */

/** Paths matched by startsWith — must never be the beginning of a list URL */
export const TRANSACTIONAL_PREFIXES: readonly string[] = [
  // ── Documents ──────────────────────────────────────────────────────────────
  '/documents/all/new',
  '/documents/revisions/new',
  '/documents/revisions/create',
  '/documents/revisions/review/',      // /revisions/review/:id
  '/documents/revisions/approval/',    // /revisions/approval/:id
  '/documents/revisions/training/',    // /revisions/training/:id
  '/documents/controlled-copy/request',

  // ── Training – Course Inventory ────────────────────────────────────────────
  '/training-management/courses/create',

  // ── Training – Approval ────────────────────────────────────────────────────
  // NOTE: APPROVAL_DETAIL = /pending-review/:id  (no extra subpath)
  //       → matched by suffix '/pending-review/' below is unsafe (would match list)
  //       → handled via TRANSACTIONAL_SEGMENTS instead

  // ── Training – Assignment ──────────────────────────────────────────────────
  '/training-management/assignments/new',

  // ── Training – Materials ───────────────────────────────────────────────────
  '/training-management/materials/create',
  '/training-management/materials/review/',        // /materials/review/:id
  '/training-management/materials/approval/',      // /materials/approval/:id
  '/training-management/materials/new-revision/',  // /materials/new-revision/:id

  // ── Settings – Users ───────────────────────────────────────────────────────
  '/settings/users/add',
  '/settings/users/edit/',     // /users/edit/:id
  '/settings/users/profile/',  // /users/profile/:id

  // ── Settings – Roles ───────────────────────────────────────────────────────

  // ── Settings – Email Templates ─────────────────────────────────────────────
  '/settings/email-templates/new',
  '/settings/email-templates/edit/',  // /email-templates/edit/:id

  // ── Settings – System Announcements ────────────────────────────────────────
  '/settings/announcements/new',
  '/settings/announcements/edit/',  // /announcements/edit/:id
] as const;

/**
 * Path suffixes matched by endsWith — catches /:id/edit, /:id/destroy, etc.
 * These patterns are safe because the list page never ends in these strings.
 */
export const TRANSACTIONAL_SUFFIXES: readonly string[] = [
  '/edit',           // /documents/:id/edit, /courses/:id/edit, /materials/:id/edit, /roles/:id/edit
  '/destroy',        // /controlled-copies/:id/destroy
  '/impact-assessment',
  '/result-entry',   // /courses/:id/result-entry
  '/progress',       // /courses/:id/progress  (may have data entry)
] as const;

/**
 * Exact route segments whose presence in the path (between slashes) identifies
 * approval/review detail screens where the ID comes right after the segment.
 * e.g. /training-management/pending-review/123  →  segment "pending-review"
 *      /training-management/pending-approval/456 →  segment "pending-approval"
 */
export const TRANSACTIONAL_SEGMENTS: readonly string[] = [
  'pending-review',
  'pending-approval',
] as const;

// Keep this for backward compat — union of all three strategies
export const TRANSACTIONAL_PATH_PREFIXES: readonly string[] = [
  ...TRANSACTIONAL_PREFIXES,
] as const;

/**
 * Returns true if the given path is a transactional screen (create/edit/review/approval/etc.).
 * Used by Sidebar to show leave confirmation when navigating away.
 *
 * Uses three strategies:
 *  1. startsWith – for known fixed-prefix screens (create, new, upload, etc.)
 *  2. endsWith   – for /:id/edit, /:id/destroy, /:id/result-entry, etc.
 *  3. segments   – for /:section/:id patterns (pending-review/:id)
 */
export function isTransactionalRoute(pathname: string): boolean {
  // Normalise: strip query string and trailing slash
  const path = pathname.replace(/\?.*$/, '').replace(/\/$/, '') || '/';

  // 1. Prefix match
  if (TRANSACTIONAL_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }

  // 2. Suffix match
  if (TRANSACTIONAL_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
    return true;
  }

  // 3. Segment match: /section/:id  where section is in TRANSACTIONAL_SEGMENTS
  //    The path must have at least one more segment after the known segment (the :id)
  const parts = path.split('/').filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    if (TRANSACTIONAL_SEGMENTS.includes(parts[i])) {
      return true; // parts[i+1] is the :id
    }
  }

  return false;
}

/** The Dashboard itself (a trailing slash is the same page). Its top bar shows the system header title instead of breadcrumbs. */
export function isDashboardPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === ROUTES.DASHBOARD;
}

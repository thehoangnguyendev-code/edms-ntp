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

  // Documents
  DOCUMENTS: {
    OWNED: '/documents/owned',
    ALL: '/documents/all',
    NEW: '/documents/all/new',
    EDIT: (id: string) => `/documents/all/edit/${id}`,
    DETAIL: (id: string) => `/documents/${id}`,
    KNOWLEDGE: '/documents/knowledge',
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
      PREVIEW: (id: string, token: string) => `/documents/controlled-copies/preview/${id}#token=${encodeURIComponent(token)}`,
      DESTROY: (id: string) => `/documents/controlled-copies/${id}/destroy`,
      REQUEST: '/documents/controlled-copy/request',
    },
  },

  // Training
  TRAINING: {
    BASE: '/training-management',
    // Course Inventory
    COURSES_LIST: '/training-management/courses-list',
    COURSES_CREATE: '/training-management/courses/create',
    COURSE_DETAIL: (courseId: string) => `/training-management/courses/${courseId}`,
    COURSE_EDIT: (courseId: string) => `/training-management/courses/${courseId}/edit`,
    COURSE_IMPACT_ASSESSMENT: (courseId: string) => `/training-management/courses/${courseId}/impact-assessment`,
    COURSE_PROGRESS: (courseId: string) => `/training-management/courses/${courseId}/progress`,
    COURSE_RESULT_ENTRY: (courseId: string) => `/training-management/courses/${courseId}/result-entry`,
    MY_TRAINING: "/training-management/my-training",
    // Approval
    PENDING_REVIEW: '/training-management/pending-review',
    PENDING_APPROVAL: '/training-management/pending-approval',
    APPROVAL_DETAIL: (id: string) => `/training-management/pending-review/${id}`,
    APPROVE_DETAIL: (id: string) => `/training-management/pending-approval/${id}`,
    // Compliance Tracking
    TRAINING_MATRIX: '/training-management/training-matrix',
    COURSE_STATUS: '/training-management/course-status',
    // Assignment
    ASSIGNMENTS: '/training-management/assignments',
    ASSIGNMENT_NEW: '/training-management/assignments/new',
    ASSIGNMENT_RULES: '/training-management/assignment-rules',
    // Records & Archive
    EMPLOYEE_TRAINING_FILES: '/training-management/employee-training-files',
    EMPLOYEE_DOSSIER: (id: string) => `/training-management/employee-training-files/${id}`,
    EXPORT_RECORDS: '/training-management/export-records',
    // Materials
    MATERIALS: '/training-management/materials',
    MATERIAL_DETAIL: (materialId: string) => `/training-management/materials/${materialId}`,
    MATERIAL_EDIT: (materialId: string) => `/training-management/materials/${materialId}/edit`,
    MATERIAL_REVIEW: (materialId: string) => `/training-management/materials/review/${materialId}`,
    MATERIAL_APPROVAL: (materialId: string) => `/training-management/materials/approval/${materialId}`,
    MATERIAL_NEW_REVISION: (materialId: string) => `/training-management/materials/new-revision/${materialId}`,
    MATERIAL_USAGE_REPORT: (materialId: string) => `/training-management/materials/usage-report/${materialId}`,
    UPLOAD_MATERIAL: '/training-management/materials/create',
  },

  // Report
  REPORT: {
    BASE: '/report',
    TEMPLATES: '/report/templates',
    HISTORY: '/report/history',
    SCHEDULED: '/report/scheduled',
  },

  // Audit Trail
  AUDIT_TRAIL: '/audit-trail',
  AUDIT_TRAIL_REVIEW: '/audit-trail/reviews',

  // Settings
  SETTINGS: {
    USERS: '/settings/users',
    USERS_ADD: '/settings/users/add',
    USERS_EDIT: (userId: string) => `/settings/users/edit/${userId}`,
    USERS_PROFILE: (userId: string) => `/settings/users/profile/${userId}`,
    DOCUMENT_ADMINISTRATION: '/settings/document-administration',
    DICTIONARIES: '/settings/dictionaries',
    CONFIGURATION: '/settings/configuration',
    EMAIL_TEMPLATES: '/settings/email-templates',
    EMAIL_TEMPLATES_NEW: '/settings/email-templates/new',
    EMAIL_TEMPLATES_EDIT: (id: string) => `/settings/email-templates/edit/${id}`,
    PUBLISHING_TEMPLATES: '/settings/publishing-templates',
    PUBLISHING_TEMPLATES_NEW: '/settings/publishing-templates/new',
    PUBLISHING_TEMPLATES_EDIT: (id: string) => `/settings/publishing-templates/edit/${id}`,
    ELECTRONIC_SIGNATURE: '/settings/electronic-signature',
    CONTROLLED_COPY_POLICY: '/settings/controlled-copy-policy',
    NOTIFICATION_POLICY: '/settings/notification-policy',
    SYSTEM_INFO: '/settings/system-info',
    REPORT_CONFIGURATION: '/settings/report-configuration',
  },

  // Security & Authorization
  SECURITY: {
    // Existing pages (URLs unchanged, just reorganised in nav)
    USERS: '/settings/users',
    ACCESS_PROFILES: '/security/access-profiles',
    ESIGN_POLICIES: '/settings/electronic-signature',
    // New pages
    PERMISSION_SETS: '/security/permission-sets',
    WORKFLOW_ROLE_CATALOG: '/security/advanced/workflow-roles',
    WORKFLOW_AUTHORIZATION: '/security/lifecycle-policies',
    LIFECYCLE_POLICIES_TRANSITIONS: '/security/lifecycle-policies/transitions',
    LIFECYCLE_POLICIES_CAPABILITIES: '/security/lifecycle-policies/capabilities',
    AUTHORIZATION_DIAGNOSTICS: '/security/authorization-diagnostics',
    OBJECT_RULES: '/security/object-rules',
    SOD: '/security/sod',
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

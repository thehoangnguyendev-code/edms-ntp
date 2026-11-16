import apiClient, { uploadFile } from "./client";
import type { ReportDefinition, ReportFormat } from "./reports";
import type { WorkflowProgress } from "@/types/document";

export type MetadataScope =
  "PERSONAL" | "DEPARTMENT" | "BUSINESS_UNIT" | "SYSTEM";
export interface RoleScope {
  roleId: string;
  roleName?: string;
  scope: MetadataScope;
}
export interface TemplateFilter {
  code: string;
  name: string;
  type: "TEXT" | "LOOKUP" | "DATE" | "NUMBER";
  /** "true" when the report cannot be made without this filter (the server sends strings). */
  required?: string;
}
export interface ReportMark {
  color: string;
  opacity: number;
  fontSize: number;
  rotation: number;
  x: number;
  y: number;
  width: number;
  pages: "ALL" | "FIRST";
  font: ReportFontFamily;
  layer: "ABOVE" | "BEHIND";
}
export type ReportPlace = "LEFT" | "CENTER" | "RIGHT";
/**
 * The logo has a place in the header, not a position on the page: it takes its own room and the table starts below it. width is its size as a percentage of the
 * page. x and y are only what the logo had before it had a place (the server puts such a logo in the place its centre was nearest to).
 */
export interface ReportLogo {
  enabled: boolean;
  data: string;
  x: number;
  y: number;
  width: number;
  pages: "ALL" | "FIRST";
  slot?: ReportPlace;
}
/** The text of one place of the header or footer: up to five lines with automatic fields; size in points (6 to 16, not set: 9 in the header, 7 in the footer). */
/** How a text of the report is set: every value is optional, and a text with none is set as the report always was. */
export interface ReportTextStyle {
  font?: ReportFontFamily | null;
  size?: number | null;
  color?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  align?: "LEFT" | "CENTER" | "RIGHT" | null;
  /** Printed in upper case, lower case or with a capital letter on each word; as written when none. */
  transform?: "UPPERCASE" | "LOWERCASE" | "CAPITALIZE" | null;
}
export interface ReportSlot {
  text: string;
  size?: number | null;
  style?: ReportTextStyle | null;
  /** A place of the header or the footer can be switched off; its text is kept. Not set: on when it has text. */
  enabled?: boolean | null;
}
export interface ReportApprovalColumn {
  label: string;
  enabled?: boolean | null;
  /** Where the name of the column sits in its cell. */
  align?: "LEFT" | "CENTER" | "RIGHT" | null;
}
export const defaultApprovalColumns = (): ReportApprovalColumn[] => ["Name", "Designation", "Sign", "Date"].map((label) => ({ label }));
export interface ReportInfoItem {
  label: string;
  value: string;
}
/**
 * The frame of a page: header and footer in three places, the information above the table, the approval block and the notes after it.
 * Without a frame the layout is as it was: the header text, the footer text and the page number.
 */
export interface ReportFrame {
  companyName: string;
  headerLeft: ReportSlot;
  headerCenter: ReportSlot;
  headerRight: ReportSlot;
  footerLeft: ReportSlot;
  footerCenter: ReportSlot;
  footerRight: ReportSlot;
  info: ReportInfoItem[];
  infoColumns: 1 | 2;
  approval: boolean;
  approvalRoles?: string[] | null;
  /** The columns of the approval table after the roles: named, and switched on or off. Not set: Name, Designation, Sign, Date. */
  approvalColumns?: ReportApprovalColumn[] | null;
  notes: boolean;
  notesHeight: number;
  infoLabelStyle?: ReportTextStyle | null;
  infoValueStyle?: ReportTextStyle | null;
  approvalStyle?: ReportTextStyle | null;
  notesStyle?: ReportTextStyle | null;
}
/**
 * The kinds of chart a template can have, all drawn on the server with Chart.js (REPORT-CHARTJS-2026-11-15). LINE and AREA are trends by month and need a date field;
 * the others group the records by the value of a field.
 */
export const REPORT_CHART_TYPES = [
  { value: "BAR", label: "Column" },
  { value: "HORIZONTAL_BAR", label: "Horizontal bar" },
  { value: "PIE", label: "Pie" },
  { value: "DOUGHNUT", label: "Doughnut" },
  { value: "POLAR_AREA", label: "Polar area" },
  { value: "RADAR", label: "Radar" },
  { value: "LINE", label: "Monthly trend (line)" },
  { value: "AREA", label: "Monthly trend (area)" },
] as const;
export type ReportChartType = (typeof REPORT_CHART_TYPES)[number]["value"];
/** A chart of the trend by month: its groups are the months of a date field. */
export const isTrendChart = (type: ReportChartType) => type === "LINE" || type === "AREA";

export interface ReportChart {
  title: string;
  type: ReportChartType;
  field: string;
  metric: "COUNT" | "PERCENT";
  /** The most groups a column or pie chart shows (5 to 20); the others are added together as "Other". */
  maxGroups?: number;
}
/** The fonts a report can use; TIMES_NEW_ROMAN is printed in Tinos, which has the same letter widths. */
export type ReportFontFamily = "NOTO_SANS" | "NOTO_SERIF" | "ROBOTO_MONO" | "OSWALD" | "TIMES_NEW_ROMAN";
export interface ReportLayout {
  /** The font of the running text of the report (cover, header, footer, table, charts); Noto Sans when none is set. */
  fontFamily?: ReportFontFamily;
  wordComponents?: Partial<
    Record<
      "cover" | "header" | "footer",
      { id: string; sha256: string; fileName: string; placeholders: string[] }
    >
  >;
  orientation?: "PORTRAIT" | "LANDSCAPE";
  cover: boolean;
  coverTitle: string;
  subtitle: string;
  coverTitleStyle?: ReportTextStyle | null;
  coverSubtitleStyle?: ReportTextStyle | null;
  showExecutor: boolean;
  showGeneratedAt: boolean;
  header: string;
  footer: string;
  pageNumbers: boolean;
  watermarkEnabled: boolean;
  watermark: string;
  stampEnabled: boolean;
  stamp: string;
  watermarkStyle?: ReportMark;
  stampStyle?: ReportStamp;
  logo?: ReportLogo;
  charts?: ReportChart[];
  frame?: ReportFrame | null;
}
/** The frame that the header text, the footer text and the page number of a layout without a frame make (as the server does): the logo on the left sends the header text to the right. */
export const effectiveReportFrame = (layout: ReportLayout): ReportFrame => {
  if (layout.frame) return layout.frame;
  const none: ReportSlot = { text: "" };
  const header: ReportSlot = { text: layout.header ?? "" };
  const textToRight = !!layout.logo?.enabled && (layout.logo.slot ?? (layout.logo.x + layout.logo.width / 2 < 100 / 3 ? "LEFT" : "")) === "LEFT";
  return {
    companyName: "",
    headerLeft: textToRight ? none : header,
    headerCenter: none,
    headerRight: textToRight ? header : none,
    footerLeft: { text: layout.footer ?? "" },
    footerCenter: none,
    footerRight: none,
    info: [],
    infoColumns: 2,
    approval: false,
    notes: false,
    notesHeight: 120,
  };
};
export const defaultReportMark = (): ReportMark => ({
  color: "#64748b",
  opacity: 12,
  fontSize: 36,
  rotation: 25,
  x: 20,
  y: 55,
  width: 70,
  pages: "ALL",
  font: "NOTO_SANS",
  layer: "ABOVE",
});
/**
 * The stamp, as the stamp of a Controlled Copy: a framed box with the text in it. x and y are its left and top edge and width its width, as a percentage
 * of the page; none of them set means it has not been placed by hand and sits in the top right corner at its natural size.
 */
export interface ReportStamp {
  color: string;
  opacity: number;
  x?: number;
  y?: number;
  width?: number;
  pages: "ALL" | "FIRST";
  font: ReportFontFamily;
}
export const defaultReportStamp = (): ReportStamp => ({ color: "#059669", opacity: 90, pages: "ALL", font: "NOTO_SANS" });
export const defaultReportLayout = (): ReportLayout => ({
  cover: false,
  coverTitle: "{{report.title}}",
  subtitle: "",
  showExecutor: true,
  showGeneratedAt: true,
  header: "{{report.title}}",
  footer: "{{report.code}} · Rev {{template.version}}",
  pageNumbers: true,
  watermarkEnabled: false,
  watermark: "FOR PREVIEW ONLY",
  stampEnabled: false,
  stamp: "TEST",
});
export interface ReportTemplate extends ReportDefinition {
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  /** For GMP decisions (REPORT-GMP-USE-APPROVAL-2026-10-14). */
  gmpUse?: boolean;
  /** Approval of the current version (REPORT-TEMPLATE-APPROVAL-2026-10-14): only an APPROVED current version runs. */
  approvalStatus?: ReportApprovalStatus;
  /** The key of this template in the Audit Trail (not shown); the Audit Trail tab reads the entries of this template only. */
  auditEntityId?: string;
  /** A run of this template is signed electronically, with a reason (the Audit Trail report). */
  runNeedsSignature?: boolean;
  /** What the person may do with this template; the list carries it so the row menu opens with its items decided (the detail page asks again). */
  capabilities?: ReportTemplateCapabilities;
  /** Draft, Pending approval, Active or Inactive; computed by the server from the approval state and the enabled flag. */
  lifecycleStatus?: ReportLifecycleStatus;
  approvedVersion?: number | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  submittedVersion?: number | null;
  submittedByUserId?: string | null;
  submittedAt?: string | null;
  approvalComment?: string | null;
  /** The name rule the display name comes from, and the values typed for its input parts (keyed by part order). */
  nameFormatId?: string | null;
  nameValues?: Record<string, string> | null;
  sourceCode: string;
  /** Revisions (REPORT-TEMPLATE-REVISION-2026-10-14): the effective one runs; the open one is being written and needs approval. */
  revision?: number | null;
  effectiveRevision?: number | null;
  openRevision?: number | null;
  openRevisionStatus?: "DRAFT" | "PENDING_APPROVAL" | null;
  /** APPROVED: a person approved the revision in force. NOT_REQUIRED: only a revision that came into force when it was saved, under the rule that ended on 2026-11-15. */
  approvalBasis?: "APPROVED" | "NOT_REQUIRED" | null;
  /** When the revision in force came into force. */
  inUseSince?: string | null;
  /** The lifecycle stepper of the revision that matters on the screens (the one being written, else the effective one), worked out on the server. */
  workflow?: WorkflowProgress;
  roleScopes?: RoleScope[];
  filterFields?: TemplateFilter[];
  layout?: ReportLayout;
}
/** The decision of the server for one action on a template (shared capability contract, resource type REPORT_TEMPLATE). */
export interface ReportTemplateActionCapability {
  allowed: boolean;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  requiredPermissionCode?: string | null;
  requiresESignature?: boolean;
}
export interface ReportTemplateCapabilities {
  resourceType: string;
  resourceId: string;
  state: string;
  actions: Record<string, ReportTemplateActionCapability>;
}
export type ReportRevisionStatus = "DRAFT" | "PENDING_APPROVAL" | "EFFECTIVE" | "OBSOLETE" | "DISCARDED";
export interface ReportRevisionRow {
  revision: number;
  status: ReportRevisionStatus;
  changeReason?: string | null;
  definitionVersion?: number | null;
  createdAt?: string;
  createdByName?: string | null;
  lastChangedAt?: string;
  approvedAt?: string | null;
  approvedByName?: string | null;
  /** NOT_REQUIRED: the template is not used for GMP decisions, so no one approved this revision; it came into force when it was saved. */
  approvalBasis?: "APPROVED" | "NOT_REQUIRED" | null;
  effectiveAt?: string | null;
  obsoletedAt?: string | null;
  obsoletedByRevision?: number | null;
  discardedAt?: string | null;
  discardReason?: string | null;
}
/** A row of the list of the revisions of every template (REPORT-TEMPLATE-REVISIONS-LIST-2026-11-15). */
export interface ReportRevisionListRow {
  definitionCode: string;
  displayName: string;
  sourceCode: string;
  revision: number;
  status: ReportRevisionStatus;
  /** Whether the template was used for GMP decisions in this revision. */
  gmpUse: boolean;
  approvalBasis?: "APPROVED" | "NOT_REQUIRED" | null;
  changeReason?: string | null;
  createdAt?: string;
  createdByName?: string | null;
  lastChangedAt?: string;
  lastChangedByName?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  effectiveAt?: string | null;
  /** What this person may do to the template of the revision, decided by the server; the row menu is built from it and the status of the revision. */
  capabilities?: ReportTemplateCapabilities;
}
export interface ReportRevisionListPage {
  data: ReportRevisionListRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface ReportRevisionPage {
  data: ReportRevisionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface ReportRevisionDetail extends ReportRevisionRow {
  /** The lifecycle stepper of this revision, worked out on the server. */
  workflow?: WorkflowProgress;
  definitionCode: string;
  lastChangedByName?: string | null;
  submittedAt?: string | null;
  submittedByName?: string | null;
  approvalComment?: string | null;
  content: {
    displayName?: string;
    description?: string | null;
    sourceCode?: string;
    active?: boolean;
    gmpUse?: boolean;
    allowedFormats?: string[];
    layout?: ReportLayout | null;
    fields?: ReportTemplate["fields"];
    roleScopes?: RoleScope[];
  };
}
export interface ReportRevisionChange {
  section: string;
  item: string;
  kind: "ADDED" | "REMOVED" | "CHANGED";
  from?: string | null;
  to?: string | null;
}
export interface ReportRevisionComparison {
  revision: number;
  comparedWith: number | null;
  changes: ReportRevisionChange[];
}

export interface ReportSource {
  code: string;
  name: string;
  fields: Record<string, string>;
  requiredFields: string[];
  dateFields?: string[];
  /** The group of each field, the fields that describe a person, and the most columns one report may carry (REPORT-FIELD-CATALOG-2026-11-15). */
  fieldGroups?: Record<string, string>;
  sensitiveFields?: string[];
  maxColumns?: number;
  category?: string;
  description?: string;
  /** The data scopes a template of this type may give to an Access Profile. */
  allowedScopes?: MetadataScope[];
}
export type RoleGrant = RoleScope;
/** One Access Profile in the Access & Scope tab, with the scope set so far (null when it has none). */
export interface ReportRoleRow {
  id: string;
  name: string;
  code: string;
  scope?: MetadataScope | null;
}
export interface ReportRolePage {
  data: ReportRoleRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  /** Profiles that were given a scope and are not active any more: the scope has to be removed before the template is saved. */
  inactive?: Array<{ id: string; name: string; scope: MetadataScope }>;
}
export interface ReportRoleSearch {
  search?: string;
  assignment?: string;
  scope?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
  assignments: Array<{ roleId: string; scope: string }>;
}
export interface ReportRole {
  id: string;
  name: string;
  code: string;
}
export interface TemplateCriteria {
  version: number;
  fields: string[];
  filters: Record<string, string>;
  sortBy: string;
  direction: "asc" | "desc";
}
export interface TemplateWrite {
  version?: number;
  sourceCode: string;
  displayName: string;
  description: string;
  active: boolean;
  formats: ReportFormat[];
  fields: Array<{
    code: string;
    allowed: boolean;
    defaultSelected: boolean;
    required: boolean;
  }>;
  roleScopes: RoleScope[];
  reason: string;
  layout?: ReportLayout;
  /** Electronic signature for a change that alters report results or access (REPORT-DEFINITION-SIGNATURE-2026-10-14). */
  signatureToken?: string;
  /** The template is for GMP decisions (REPORT-GMP-USE-APPROVAL-2026-10-14). */
  gmpUse?: boolean;
  /** Name rule to build the display name from; displayName is ignored when set. */
  nameFormatId?: string | null;
  nameValues?: Record<string, string>;
}
export type ReportApprovalStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED";
export type ReportLifecycleStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "INACTIVE";
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface TemplatePage {
  data: ReportTemplate[];
  pagination: Pagination;
  sources?: Array<{ value: string; label: string }>;
}
export interface TemplatePreview {
  rows: string[][];
  asOfAt: string;
  pagination: Pagination;
  /** Most rows of a report file, and of a file run with Full (Report Properties). */
  maxRows?: number;
  maxRowsFull?: number;
}
export const reportTemplatesApi = {
  /** The lifecycle stepper of a template that is being created and has no record yet. */
  newWorkflow: async () => (await apiClient.get<WorkflowProgress>("/reports/templates/workflow/new")).data,
  uploadComponent: async (type: "cover" | "header" | "footer", file: File) => {
    return (
      await uploadFile(`/reports/templates/layout/components/${type}`, file)
    ).data as NonNullable<ReportLayout["wordComponents"]>[typeof type];
  },
  previewLayout: async (
    title: string,
    layout: ReportLayout,
    signal?: AbortSignal,
  ) =>
    (
      await apiClient.post<Blob>(
        "/reports/templates/layout/preview",
        { title, layout },
        { responseType: "blob", signal },
      )
    ).data,
  /** A sample of one chart of a template, drawn by the server (Chart.js) from made-up groups, as a PNG. */
  chartPreview: async (chart: ReportChart, fieldName: string, font?: string | null, signal?: AbortSignal) =>
    (
      await apiClient.post<Blob>(
        "/reports/templates/layout/chart-preview",
        { chart, fieldName, font: font ?? null },
        { responseType: "blob", signal },
      )
    ).data,
  previewPdf: async (
    code: string,
    criteria: TemplateCriteria,
    title: string,
    signal?: AbortSignal,
  ) =>
    (
      await apiClient.post<Blob>(
        `/reports/templates/${encodeURIComponent(code)}/preview-pdf`,
        { criteria, title },
        { responseType: "blob", signal },
      )
    ).data,
  /** Makes the CSV or XLSX file as the report will be made, to look at in the viewer before the report is requested (a working copy, removed when the report is complete). */
  previewFile: async (code: string, criteria: TemplateCriteria, title: string, format: "CSV" | "XLSX", full = false) =>
    (
      await apiClient.post<{ id: string; fileName: string; byteSize: number; keepHours: number }>(
        `/reports/templates/${encodeURIComponent(code)}/preview-file`,
        { criteria, title, format, full },
      )
    ).data,
  previewFileViewConfig: async (id: string) =>
    (await apiClient.get<Record<string, unknown>>(`/reports/templates/preview-files/${id}/view-config`)).data,
  list: async (
    params: {
      search: string;
      page: number;
      sortBy: string;
      direction: string;
      status?: string;
      sourceCode?: string;
      format?: string;
      orientation?: string;
      /** YES: used for GMP decisions. NO: not. */
      gmp?: string;
      /** "Last Updated" range, yyyy-MM-dd, both days included. */
      updatedFrom?: string;
      updatedTo?: string;
      /** Records per page, chosen by the user (10, 20, 50 or 100); the server applies it. */
      limit?: number;
    },
    admin = false,
  ) =>
    (
      await apiClient.get<TemplatePage>(
        `/reports/templates${admin ? "/configuration" : ""}`,
        { params },
      )
    ).data,
  detail: async (code: string) =>
    (
      await apiClient.get<ReportTemplate>(
        `/reports/templates/${encodeURIComponent(code)}/configuration`,
      )
    ).data,
  /** Draft -> Pending approval. Only a Draft version can be submitted. */
  submitForApproval: async (code: string, version: number, note: string) =>
    (
      await apiClient.post<ReportTemplate>(`/reports/templates/${encodeURIComponent(code)}/submit`, {
        version,
        note,
      })
    ).data,
  /** Pending approval -> Approved, with an electronic signature. The approver must not be the author or the submitter. */
  approveTemplate: async (code: string, version: number, reason: string, signatureToken: string) =>
    (
      await apiClient.post<ReportTemplate>(`/reports/templates/${encodeURIComponent(code)}/approve`, {
        version,
        reason,
        signatureToken,
      })
    ).data,
  /** Pending approval -> Draft, with the reason kept. Signed electronically. */
  rejectTemplate: async (code: string, version: number, reason: string, signatureToken: string) =>
    (
      await apiClient.post<ReportTemplate>(`/reports/templates/${encodeURIComponent(code)}/reject`, {
        version,
        reason,
        signatureToken,
      })
    ).data,
  delete: async (code: string, version: number, reason: string) =>
    apiClient.delete(`/reports/templates/${encodeURIComponent(code)}`, {
      data: { version, reason },
    }),
  /** Revisions of a template, searched, filtered, sorted and paged on the server. */
  revisions: async (code: string, params: { status?: string; search?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number } = {}) =>
    (await apiClient.get<ReportRevisionPage>(`/reports/templates/${encodeURIComponent(code)}/revisions`, { params })).data,
  /** The revisions of every template, searched, filtered, sorted and paged on the server. scope "pending-approval": the ones this person may decide now. */
  allRevisions: async (params: { scope?: "all" | "pending-approval"; status?: string; gmp?: string; sourceCode?: string; search?: string; updatedFrom?: string; updatedTo?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number } = {}) =>
    (await apiClient.get<ReportRevisionListPage>("/reports/templates/revisions", { params })).data,
  /** What the current user may do to a template now; decided by the server from permissions, state and actor. */
  capabilities: async (code: string) =>
    (await apiClient.get<ReportTemplateCapabilities>(`/authorization/resources/REPORT_TEMPLATE/${encodeURIComponent(code)}/capabilities`)).data,
  /** Disable or enable a template: takes effect at once, audited (no signature). */
  setEnabled: async (code: string, enabled: boolean, reason: string) =>
    (await apiClient.post<ReportTemplate>(`/reports/templates/${encodeURIComponent(code)}/${enabled ? "enable" : "disable"}`, { reason })).data,
  /** Discard the Draft revision that was started by Upgrade. */
  discardRevision: async (code: string, version: number, reason: string) =>
    (await apiClient.post<ReportTemplate>(`/reports/templates/${encodeURIComponent(code)}/discard-revision`, { version, reason })).data,
  /** Upgrade: starts the next revision from the effective one. */
  upgrade: async (code: string, version: number, reason: string) =>
    (await apiClient.post<ReportTemplate>(`/reports/templates/${encodeURIComponent(code)}/upgrade`, { version, reason })).data,
  revision: async (code: string, revision: number) =>
    (await apiClient.get<ReportRevisionDetail>(`/reports/templates/${encodeURIComponent(code)}/revisions/${revision}`)).data,
  compareRevision: async (code: string, revision: number, withRevision = "previous") =>
    (await apiClient.get<ReportRevisionComparison>(`/reports/templates/${encodeURIComponent(code)}/revisions/${revision}/compare`, { params: { with: withRevision } })).data,
  sources: async () =>
    (await apiClient.get<ReportSource[]>("/reports/templates/sources")).data,
  /** The Access Profiles of the Access & Scope tab, searched, filtered, sorted and paged on the server. */
  searchRoles: async (request: ReportRoleSearch) => (await apiClient.post<ReportRolePage>("/reports/templates/roles/search", request)).data,
  roles: async () =>
    (await apiClient.get<ReportRole[]>("/reports/templates/roles")).data,
  /** A new template is numbered by the server; a template number is never sent by the client when creating. */
  save: async (code: string, value: TemplateWrite, create = false) =>
    (
      await apiClient.request<ReportTemplate>({
        method: create ? "POST" : "PUT",
        url: create ? "/reports/templates" : `/reports/templates/${encodeURIComponent(code)}`,
        data: value,
      })
    ).data,
  options: async (code: string, field: string, search: string) =>
    (
      await apiClient.get<Array<{ value: string; label: string }>>(
        `/reports/templates/${encodeURIComponent(code)}/options/${encodeURIComponent(field)}`,
        { params: { search } },
      )
    ).data,
  preview: async (code: string, criteria: TemplateCriteria, page = 1) =>
    (
      await apiClient.post<TemplatePreview>(
        `/reports/templates/${encodeURIComponent(code)}/preview`,
        criteria,
        { params: { page } },
      )
    ).data,
};
export function reportError(error: unknown): string {
  const response = (
    error as {
      response?: { status?: number; data?: { error?: { message?: string; code?: string } } };
    }
  )?.response;
  const wordMessage = response?.data?.error?.message ?? "";
  if (response?.status === 403 && response?.data?.error?.code === "REPORT_GMP_APPROVER_REQUIRED")
    return "This template is for GMP decisions. Only a person who may approve a report for GMP use can approve or return it.";
  if (response?.status === 400 && wordMessage.startsWith("REPORT_WORD_")) {
    if (wordMessage.startsWith("REPORT_WORD_TOKEN"))
      return "The Word template contains an unsupported or incomplete placeholder. Use the Report Placeholders catalog; page numbering is configured separately.";
    if (wordMessage.includes("ONE_PAGE"))
      return "Each cover, header or footer Word template must fit on one page.";
    if (wordMessage.includes("SIZE") || wordMessage.includes("EXPANSION"))
      return "Use a DOCX file up to 2 MB with a standard page size and bounded embedded images.";
    if (
      wordMessage.includes("ACTIVE_CONTENT") ||
      wordMessage.includes("EXTERNAL_RESOURCE")
    )
      return "Remove macros, embedded objects, active fields and external links from the Word template.";
    return "The Word template is invalid or unavailable. Upload a valid DOCX template again.";
  }
  if (response?.status === 403)
    return "Access denied. Your report permissions or metadata scope may have changed.";
  if (response?.status === 409)
    return "This template has changed. Reload it before continuing; your changes have not been saved.";
  if (response?.status === 400) {
    // The server names what it refused with a stable code; say that in words instead of a general message.
    const known: Record<string, string> = {
      REPORT_IMAGE_INVALID: "The logo image was refused. Use a PNG or JPEG up to 1 MB and up to 4 megapixels (for example 2000 x 2000); a larger image is reduced when it is uploaded.",
      REPORT_LOGO_REQUIRED: "The logo is switched on but has no image. Upload a PNG or JPEG, or switch the logo off.",
      REPORT_LOGO_INVALID: "The logo size or place is not allowed. Choose Left, Centre or Right, and a size of at least 5% of the page.",
      REPORT_LAYOUT_INVALID: "The layout has a value that is not allowed. Check the texts, marks and page settings.",
      REPORT_CHART_INVALID: "A chart in the layout is incomplete. Give it a title, a type, a field and a metric.",
      REPORT_AUDIT_RANGE_REQUIRED: "Choose the dates the report covers: both From date and To date are required for this report type.",
      REPORT_AUDIT_RANGE_TOO_WIDE: "A report of this type may cover only a limited number of days (set in Report Properties). Choose a shorter range.",
      REPORT_SCOPE_NOT_ALLOWED_FOR_TYPE: "This report type cannot be given that data scope. Choose a scope the type allows.",
      REPORT_TYPE_DISABLED: "This report type is disabled. Ask the person who manages Report Types to enable it.",
      REPORT_TYPE_UNCHANGED: "The report type already has that status.",
      REPORT_TYPE_VERSION_CHANGED: "Someone else changed this report type. Reload the list and try again.",
      REPORT_SOURCE_UNKNOWN: "This report type is not known to the system.",
      REPORT_CHART_GROUP_LIMIT: "A monthly trend can show at most 20 months. Choose a shorter period or another chart type.",
      REPORT_CHART_DATE_REQUIRED: "A monthly trend needs a date field, and every record must have a valid date in it.",
      REPORT_CHART_FIELD_NOT_SELECTED: "A chart uses a field that is not in the report. Select the field or change the chart.",
      REPORT_FONT_INVALID: "The report font is not one of the fonts offered.",
      REPORT_TEXT_STYLE_INVALID: "A font, size, colour, alignment or text transform is not one of the values offered.",
      REPORT_APPEARANCE_NAME_INVALID: "Give the appearance a name of 1 to 120 characters on one line.",
      REPORT_APPEARANCE_NAME_TAKEN: "Another appearance already has that name. Choose a different name.",
      REPORT_APPEARANCE_NOT_FOUND: "This appearance no longer exists. Reload the list.",
      REPORT_APPEARANCE_ALREADY_ACTIVE: "This appearance is already the Active one.",
      REPORT_APPEARANCE_ACTIVE_CANNOT_BE_DELETED: "The Active appearance cannot be deleted. Activate another one first.",
      REPORT_PROPERTIES_VERSION_CHANGED: "Someone else changed this. Reload and try again.",
      REPORT_PROPERTIES_UNCHANGED: "Nothing was changed.",
      REPORT_PREVIEW_PAGE_INVALID: "That page does not exist in the preview.",
      REPORT_DESCRIPTION_REQUIRED: "The description is required.",
      REPORT_FILTER_REQUIRED: "Choose at least one filter, or choose Full to run the report without one.",
      REPORT_ROW_LIMIT_EXCEEDED: "The result has more rows than a report file may hold. Add a filter to narrow it, or choose Full if the Full limit is enough.",
      REPORT_FORMAT_ROW_LIMIT_EXCEEDED: "The result is too large for a PDF or Word file. Choose CSV or XLSX, or add a filter.",
      REPORT_REVIEW_DAYS_INVALID: "Review due within must be a whole number of days from 0 to 3,650.",
      REPORT_RUN_REASON_REQUIRED: "Give the reason for this report: it is signed with the request.",
      REPORT_REVISION_OBSOLETE: "The template revision this report was requested with is no longer effective. Start a new report request.",
      REPORT_SIGNED_TYPE_NOT_SCHEDULABLE: "A report of this type is signed each time it is run, so it cannot be scheduled.",
      REPORT_FORMAT_NOT_ALLOWED: "This output format is not allowed for this report template.",
      REPORT_ARTIFACT_LIMIT_EXCEEDED: "The file would be larger than 50 MB. Add a filter or choose a shorter period.",
      REPORT_VERIFY_FILE_EMPTY: "The file you chose is empty. Choose the report file you want to check.",
      REPORT_VERIFY_FILE_UNREADABLE: "The file could not be read. Choose it again.",
      REPORT_PREVIEW_FILE_GONE: "The preview file is no longer kept. Make it again.",
      REPORT_MAX_RANGE_DAYS_INVALID: "The most days a report may cover must be between 1 and 3,660.",
      REPORT_MAX_ROWS_FULL_INVALID: "The Full limit must be between 10,000 and 100,000 rows and not lower than the ordinary limit.",
    };
    if (wordMessage in known) return known[wordMessage];
    return "The server rejected this request. Check required columns, criteria and active role assignments.";
  }
  return "The report service is unavailable. Please try again.";
}

import apiClient, { uploadFile } from "./client";
import type { ReportDefinition, ReportFormat } from "./reports";

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
  type: "TEXT" | "LOOKUP" | "DATE";
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
  font: "NOTO_SANS" | "NOTO_SERIF" | "ROBOTO_MONO" | "OSWALD";
  layer: "ABOVE" | "BEHIND";
}
export interface ReportLogo {
  enabled: boolean;
  data: string;
  x: number;
  y: number;
  width: number;
  pages: "ALL" | "FIRST";
}
export interface ReportChart {
  title: string;
  type: "BAR" | "PIE" | "LINE";
  field: string;
  metric: "COUNT" | "PERCENT";
}
export interface ReportLayout {
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
  stampStyle?: ReportMark;
  logo?: ReportLogo;
  charts?: ReportChart[];
}
export const defaultReportMark = (stamp = false): ReportMark => ({
  color: stamp ? "#059669" : "#64748b",
  opacity: stamp ? 90 : 12,
  fontSize: stamp ? 10 : 36,
  rotation: stamp ? 0 : 25,
  x: stamp ? 70 : 20,
  y: stamp ? 94 : 55,
  width: stamp ? 26 : 70,
  pages: "ALL",
  font: "NOTO_SANS",
  layer: "ABOVE",
});
export const defaultReportLayout = (): ReportLayout => ({
  cover: false,
  coverTitle: "{{report.title}}",
  subtitle: "",
  showExecutor: true,
  showGeneratedAt: true,
  header: "{{report.title}}",
  footer: "{{report.code}} · v{{template.version}}",
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
  sourceCode: string;
  roleScopes?: RoleScope[];
  filterFields?: TemplateFilter[];
  layout?: ReportLayout;
}
export interface ReportSource {
  code: string;
  name: string;
  fields: Record<string, string>;
  requiredFields: string[];
  dateFields?: string[];
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
}
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
}
export const reportTemplatesApi = {
  uploadComponent: async (type: "cover" | "header" | "footer", file: File) => {
    return (
      await uploadFile(`/reports/templates/layout/components/${type}`, file)
    ).data as NonNullable<ReportLayout["wordComponents"]>[typeof type];
  },
  previewPage: async (
    title: string,
    layout: ReportLayout,
    page: number,
    signal?: AbortSignal,
  ) =>
    (
      await apiClient.post<Blob>(
        "/reports/templates/layout/preview-page",
        { title, layout, page },
        { responseType: "blob", signal },
      )
    ).data,
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
  delete: async (code: string, version: number, reason: string) =>
    apiClient.delete(`/reports/templates/${encodeURIComponent(code)}`, {
      data: { version, reason },
    }),
  sources: async () =>
    (await apiClient.get<ReportSource[]>("/reports/templates/sources")).data,
  roles: async () =>
    (await apiClient.get<ReportRole[]>("/reports/templates/roles")).data,
  save: async (code: string, value: TemplateWrite, create = false) =>
    (
      await apiClient.request<ReportTemplate>({
        method: create ? "POST" : "PUT",
        url: `/reports/templates/${encodeURIComponent(code)}`,
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
      response?: { status?: number; data?: { error?: { message?: string } } };
    }
  )?.response;
  const wordMessage = response?.data?.error?.message ?? "";
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
  if (response?.status === 400)
    return "The server rejected this request. Check required columns, criteria and active role assignments.";
  return "The report service is unavailable. Please try again.";
}

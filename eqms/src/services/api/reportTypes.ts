import apiClient from "./client";

/** A source of report data (REPORT-PLATFORM-2026-10-15). It is written in code; administration enables or disables it. The server does all searching, sorting and paging. */
export interface ReportTypeListItem {
  code: string;
  name: string;
  category: string;
  description: string;
  columnCount: number;
  templateCount: number;
  enabled: boolean;
  version: number;
  updatedAt?: string;
}

export interface ReportTypeColumn {
  code: string;
  label: string;
  required: boolean;
  type: "TEXT" | "DATE";
  sortable: boolean;
}

export interface ReportTypeFilter {
  code: string;
  label: string;
  type: string;
}

export interface ReportTypeDetail extends ReportTypeListItem {
  columns: ReportTypeColumn[];
  filters: ReportTypeFilter[];
  /** Permissions of which a person needs one to use the type, besides the scope of the template; empty when the type applies the scopes of the template. */
  usePermissions: string[];
  /** Permissions a person needs all of. */
  requiredPermissions: string[];
}

export interface ReportTypePage {
  data: ReportTypeListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  categories: string[];
}

export const reportTypesApi = {
  list: async (params: { status?: "ALL" | "ENABLED" | "DISABLED"; category?: string; search?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number } = {}) =>
    (await apiClient.get<ReportTypePage>("/reports/types", { params })).data,
  detail: async (code: string) => (await apiClient.get<ReportTypeDetail>(`/reports/types/${encodeURIComponent(code)}`)).data,
  setEnabled: async (code: string, version: number, enabled: boolean, reason: string) =>
    (await apiClient.post<ReportTypeDetail>(`/reports/types/${encodeURIComponent(code)}/enabled`, { version, enabled, reason })).data,
};

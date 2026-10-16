import apiClient from "./client";

/** A rule for report template names (REPORT-NAME-FORMAT-2026-10-14). Changing a rule does not rename existing templates. */
export type ReportNamePartType = "FIXED" | "INPUT";
export type ReportNameInputRule = "TEXT" | "UPPER_CODE" | "DIGITS";

export interface ReportNamePart {
  order: number;
  type: ReportNamePartType;
  fixedText?: string | null;
  inputLabel?: string | null;
  inputRule?: ReportNameInputRule | null;
  maxLength?: number | null;
}

export interface ReportNameFormat {
  id: string;
  code: string;
  name: string;
  separator: string;
  description?: string | null;
  active: boolean;
  version: number;
  parts: ReportNamePart[];
}

export interface ReportNameFormatListItem {
  id: string;
  code: string;
  name: string;
  separator: string;
  description?: string | null;
  active: boolean;
  version: number;
  partCount: number;
  example: string;
  updatedAt?: string;
  /** The parts, in order, so a row can be expanded without another request. */
  parts?: Array<{ type: ReportNamePartType; fixedText?: string | null; inputLabel?: string | null; inputRule?: ReportNameInputRule | null; maxLength?: number | null }>;
}

export interface ReportNameFormatWrite {
  code: string;
  name: string;
  separator: string;
  description: string;
  parts: Array<Omit<ReportNamePart, "order">>;
  reason: string;
  version?: number;
}

/** The separators an administrator may choose. Must match ReportNameFormatService.SEPARATORS. */
export const REPORT_NAME_SEPARATORS = [" - ", " / ", " | ", " _ "] as const;

export interface ReportNameFormatPage {
  data: ReportNameFormatListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const reportNameFormatsApi = {
  /** Searched, filtered by status, sorted and paged on the server. */
  list: async (params: { status?: "ALL" | "ENABLED" | "DISABLED"; search?: string; sortBy?: string; sortDirection?: "asc" | "desc"; page?: number; limit?: number; modifiedFrom?: string; modifiedTo?: string } = {}) =>
    (await apiClient.get<ReportNameFormatPage>("/reports/name-formats", { params })).data,
  detail: async (id: string) =>
    (await apiClient.get<ReportNameFormat>(`/reports/name-formats/${id}`)).data,
  create: async (payload: ReportNameFormatWrite) =>
    (await apiClient.post<ReportNameFormat>("/reports/name-formats", payload)).data,
  update: async (id: string, payload: ReportNameFormatWrite) =>
    (await apiClient.put<ReportNameFormat>(`/reports/name-formats/${id}`, payload)).data,
  setActive: async (id: string, version: number, active: boolean, reason: string) =>
    (
      await apiClient.post<ReportNameFormat>(`/reports/name-formats/${id}/active`, {
        version,
        active,
        reason,
      })
    ).data,
};

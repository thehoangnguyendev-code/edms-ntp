import apiClient from "./client";
import type { Pagination, ReportLayout } from "./reportTemplates";

/** One appearance in the list: of the many, one is Active; every new report is drawn with it (REPORT-APPEARANCE-LIST-2026-11-15). */
export interface ReportAppearanceRow {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedByName?: string | null;
  activatedAt?: string | null;
  /** What the list shows and can be narrowed by: the paper, the font, whether the cover page and the logo are on. */
  orientation?: "PORTRAIT" | "LANDSCAPE";
  fontFamily?: string;
  cover?: boolean;
  logo?: boolean;
}
/** One appearance with its layout. */
export interface ReportAppearance extends ReportAppearanceRow {
  appearance: ReportLayout;
}
export interface ReportAppearanceQuery {
  search?: string;
  status?: string;
  orientation?: string;
  font?: string;
  /** "ON" or "OFF". */
  cover?: string;
  logo?: string;
  changedFrom?: string;
  changedTo?: string;
  activatedFrom?: string;
  activatedTo?: string;
  sort?: "name" | "status" | "updatedAt" | "activatedAt";
  direction?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** An automatic field a text of a report can hold: its code, its name, what the server fills in, and the text to paste ({{code}}). */
export interface ReportPlaceholder {
  code: string;
  name: string;
  example: string;
  placeholder: string;
}
export interface ReportPlaceholderQuery {
  search?: string;
  sort?: "name" | "code" | "example";
  direction?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export const reportAppearanceApi = {
  /** One page (10 at most) of the automatic fields: search, sort and paging are done on the server. */
  placeholders: async (query: ReportPlaceholderQuery, signal?: AbortSignal) =>
    (await apiClient.get<{ data: ReportPlaceholder[]; pagination: Pagination }>("/reports/appearance/placeholders", { params: query, signal })).data,
  /** Search, filter, sort and paging are done on the server. */
  list: async (query: ReportAppearanceQuery) => (await apiClient.get<{ data: ReportAppearanceRow[]; pagination: Pagination }>("/reports/appearance", { params: query })).data,
  get: async (id: string) => (await apiClient.get<ReportAppearance>(`/reports/appearance/${id}`)).data,
  /** A new appearance, Inactive, with the layout that was set on the screen. */
  create: async (name: string, appearance: ReportLayout, copyFromId?: string) => (await apiClient.post<ReportAppearance>("/reports/appearance", { name, copyFromId, appearance })).data,
  update: async (id: string, value: Pick<ReportAppearance, "version" | "name" | "appearance">) => (await apiClient.put<ReportAppearance>(`/reports/appearance/${id}`, value)).data,
  /** Makes this one the Active appearance and the present one Inactive. */
  activate: async (id: string) => (await apiClient.post<ReportAppearance>(`/reports/appearance/${id}/activate`)).data,
  remove: async (id: string) => apiClient.delete(`/reports/appearance/${id}`),
  /** A PDF of every page of the appearance, drawn with made-up values and rows. */
  preview: async (id: string) => (await apiClient.post(`/reports/appearance/${id}/preview`, undefined, { responseType: "blob" })).data as Blob,
};

import { api } from "./client";
import type { EducationDegreeLevelItem, EducationDegreeLevelPayload, EducationListParams, SchoolItem, SchoolListParams, SchoolPayload } from "@/features/settings/education/types";

type PageResponse<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
const mapSchool = (item: SchoolItem): SchoolItem => ({ ...item, ownership: item.ownership ?? null, abbreviation: item.abbreviation ?? null });

/** Education owns its API contract; lookup endpoints remain available to ordinary user forms. */
export const educationApi = {
  degreeLevels: {
    list: async (): Promise<EducationDegreeLevelItem[]> => (await api.get<EducationDegreeLevelItem[]>("/settings/education/degree-levels")).data,
    lookup: async (): Promise<EducationDegreeLevelItem[]> => (await api.get<EducationDegreeLevelItem[]>("/settings/education/degree-levels/lookup")).data,
    page: async (params: EducationListParams): Promise<PageResponse<EducationDegreeLevelItem>> => (await api.get<PageResponse<EducationDegreeLevelItem>>("/settings/education/degree-levels/page", { params })).data,
    create: async (payload: EducationDegreeLevelPayload) => (await api.post<EducationDegreeLevelItem>("/settings/education/degree-levels", payload)).data,
    update: async (id: string, payload: EducationDegreeLevelPayload) => (await api.put<EducationDegreeLevelItem>(`/settings/education/degree-levels/${id}`, payload)).data,
    remove: async (id: string): Promise<void> => { await api.delete(`/settings/education/degree-levels/${id}`); },
  },
  schools: {
    list: async (): Promise<SchoolItem[]> => (await api.get<SchoolItem[]>("/settings/education/schools")).data.map(mapSchool),
    lookup: async (): Promise<SchoolItem[]> => (await api.get<SchoolItem[]>("/settings/education/schools/lookup")).data.map(mapSchool),
    get: async (id: string): Promise<SchoolItem> => mapSchool((await api.get<SchoolItem>(`/settings/education/schools/${id}`)).data),
    page: async (params: SchoolListParams): Promise<PageResponse<SchoolItem>> => {
      const response = await api.get<PageResponse<SchoolItem>>("/settings/education/schools/page", { params });
      return { data: response.data.data.map(mapSchool), pagination: response.data.pagination };
    },
    filterOptions: async (): Promise<{ governingBodies: string[]; origins: string[] }> => (await api.get<{ governingBodies: string[]; origins: string[] }>("/settings/education/schools/filter-options")).data,
    create: async (payload: SchoolPayload) => mapSchool((await api.post<SchoolItem>("/settings/education/schools", payload)).data),
    update: async (id: string, payload: SchoolPayload) => mapSchool((await api.put<SchoolItem>(`/settings/education/schools/${id}`, payload)).data),
    remove: async (id: string): Promise<void> => { await api.delete(`/settings/education/schools/${id}`); },
  },
};

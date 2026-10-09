import { api } from "./client";
import type {
  ActiveAnnouncement,
  Announcement,
  AnnouncementListParams,
  AnnouncementPage,
  AnnouncementPayload,
} from "@/features/settings/announcements/types";

const ADMIN = "/settings/announcements";

export const announcementApi = {
  /** The announcements to show the signed-in user right now. */
  getActive: async (): Promise<ActiveAnnouncement[]> => {
    const response = await api.get<ActiveAnnouncement[]>("/announcements/active");
    return response.data;
  },

  list: async (params?: AnnouncementListParams): Promise<AnnouncementPage> => {
    const response = await api.get<AnnouncementPage>(ADMIN, { params });
    return response.data;
  },

  get: async (id: string): Promise<Announcement> => {
    const response = await api.get<Announcement>(`${ADMIN}/${id}`);
    return response.data;
  },

  create: async (payload: AnnouncementPayload): Promise<Announcement> => {
    const response = await api.post<Announcement>(ADMIN, payload);
    return response.data;
  },

  update: async (id: string, payload: AnnouncementPayload): Promise<Announcement> => {
    const response = await api.put<Announcement>(`${ADMIN}/${id}`, payload);
    return response.data;
  },

  setEnabled: async (id: string, enabled: boolean, version: number): Promise<Announcement> => {
    const response = await api.post<Announcement>(`${ADMIN}/${id}/enabled`, { enabled, version });
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`${ADMIN}/${id}`);
  },
};

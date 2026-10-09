import type { AnnouncementSeverity } from "@/components/ui/announcement-modal";

export type AnnouncementState = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED";

/** An announcement in the administration screens. Times are ISO instants (UTC) from the server. */
export interface Announcement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  state: AnnouncementState;
  version: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** What a signed-in user is shown. */
export interface ActiveAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  startsAt: string;
  endsAt: string;
}

export interface AnnouncementPayload {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  /** The version the form was loaded with; absent on create. */
  version?: number;
}

/** The list request. Every part is applied by the server: search, filters, sort and paging. Times are ISO instants. */
export interface AnnouncementListParams {
  search?: string;
  state?: "ALL" | AnnouncementState;
  severity?: "ALL" | AnnouncementSeverity;
  startsFrom?: string;
  startsTo?: string;
  endsFrom?: string;
  endsTo?: string;
  page?: number;
  limit?: number;
  sortBy?: "title" | "severity" | "state" | "startsAt" | "endsAt" | "updatedAt" | "updatedBy" | "createdBy";
  sortDirection?: "asc" | "desc";
}

export interface AnnouncementPage {
  data: Announcement[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const TITLE_MAX = 150;
export const MESSAGE_MAX = 2000;

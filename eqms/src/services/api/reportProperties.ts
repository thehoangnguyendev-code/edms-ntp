import apiClient from "./client";

/** The settings of the Reports module (REPORT-PROPERTIES-2026-10-15). The server checks every limit again and records what changed in the Audit Trail. */
export interface ReportProperties {
  templateNumberPrefix: string;
  templateNumberDigits: number;
  templateNumberSeparator: string;
  lastTemplateSerial: number;
  nextTemplateNumber: string;
  maxRows: number;
  /** Most rows of a file run with Full, and the most the server accepts for it. */
  maxRowsFull: number;
  maxRowsFullLimit: number;
  maxScheduleRecipients: number;
  scheduleRetryMinutes: number;
  /** Most days a run of a report type that must name a date range may cover (Audit Trail, Authentication Events, ...). */
  maxRangeDays: number;
  maxRangeDaysLimit: number;
  version: number;
  updatedAt?: string;
}

export type ReportPropertiesWrite = Pick<
  ReportProperties,
  "version" | "templateNumberPrefix" | "templateNumberDigits" | "maxRows" | "maxRowsFull" | "maxScheduleRecipients" | "scheduleRetryMinutes" | "maxRangeDays"
>;

export const reportPropertiesApi = {
  get: async () => (await apiClient.get<ReportProperties>("/reports/properties")).data,
  update: async (value: ReportPropertiesWrite) => (await apiClient.put<ReportProperties>("/reports/properties", value)).data,
};

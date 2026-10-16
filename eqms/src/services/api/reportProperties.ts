import apiClient from "./client";
import type { ReportLayout } from "./reportTemplates";

/** The settings of the Reports module (REPORT-PROPERTIES-2026-10-15). The server checks every limit again and records what changed in the Audit Trail. */
export interface ReportProperties {
  templateNumberPrefix: string;
  templateNumberDigits: number;
  templateNumberSeparator: string;
  lastTemplateSerial: number;
  nextTemplateNumber: string;
  maxRows: number;
  maxScheduleRecipients: number;
  scheduleRetryMinutes: number;
  /** The one look every report has: cover, header, footer, page numbers, font, stamp, watermark, logo, paper layout and Word page templates. */
  appearance: ReportLayout;
  version: number;
  updatedAt?: string;
}

export type ReportPropertiesWrite = Pick<
  ReportProperties,
  "version" | "templateNumberPrefix" | "templateNumberDigits" | "maxRows" | "maxScheduleRecipients" | "scheduleRetryMinutes" | "appearance"
>;

export const reportPropertiesApi = {
  get: async () => (await apiClient.get<ReportProperties>("/reports/properties")).data,
  update: async (value: ReportPropertiesWrite) => (await apiClient.put<ReportProperties>("/reports/properties", value)).data,
};

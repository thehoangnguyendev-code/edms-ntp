import type { ReportFormat } from "@/services/api/reports";

export function parseReportFormats(value: unknown): ReportFormat[] {
  if (Array.isArray(value)) return value as ReportFormat[];
  if (typeof value !== "string") return ["CSV"];
  try {
    return JSON.parse(value) as ReportFormat[];
  } catch {
    return ["CSV"];
  }
}

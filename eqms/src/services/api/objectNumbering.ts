import apiClient from "./client";

/** The format of the numbers given to records (AUDIT-OBJECT-REGISTRY-2026-11-17). A number already given never changes. */
export interface ObjectNumberFormat {
  kind: string;
  module: string;
  label: string;
  prefix: string;
  separator: string;
  includeYear: boolean;
  digits: number;
  version: number;
  /** The first number the format makes in the current year, as an example. */
  example: string;
  /** The last counter value given (0 when none was given yet). */
  lastValue: number;
}

export interface ObjectNumberFormatWrite {
  prefix: string;
  separator: string;
  includeYear: boolean;
  digits: number;
  version?: number;
  reason?: string;
}

export const objectNumberingApi = {
  async list(): Promise<ObjectNumberFormat[]> {
    const response = await apiClient.get<ObjectNumberFormat[]>("/object-numbering");
    return response.data;
  },
  async preview(kind: string, value: ObjectNumberFormatWrite): Promise<{ example: string; next: string }> {
    const response = await apiClient.post<{ example: string; next: string }>(`/object-numbering/${encodeURIComponent(kind)}/preview`, value);
    return response.data;
  },
  async update(kind: string, value: ObjectNumberFormatWrite): Promise<ObjectNumberFormat> {
    const response = await apiClient.put<ObjectNumberFormat>(`/object-numbering/${encodeURIComponent(kind)}`, value);
    return response.data;
  },
};

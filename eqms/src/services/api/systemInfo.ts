import api from './client';

export interface SystemServerInfo {
  applicationName: string;
  version: string;
  activeProfiles: string[];
  javaVersion: string;
  javaVendor: string;
  jvmName: string;
  osName: string;
  osArch: string;
  availableProcessors: number;
  timeZone: string;
  startedAt: string;
  uptimeMillis: number;
  heapUsedBytes: number;
  heapMaxBytes: number;
}

export interface SystemDatabaseInfo {
  product: string;
  productVersion: string;
  driverName: string;
  driverVersion: string;
  schemaMigrationVersion: string;
  appliedMigrations: number;
  poolMax: number | null;
  poolActive: number | null;
  poolIdle: number | null;
}

export interface SystemTechComponent {
  id: string;
  name: string;
  category: string;
  version: string;
}

export interface SystemInfoResponse {
  server: SystemServerInfo;
  database: SystemDatabaseInfo;
  techStack: SystemTechComponent[];
}

export const systemInfoApi = {
  /** GET /settings/system/info — runtime server, database and backend stack facts. */
  get: async (): Promise<SystemInfoResponse> => {
    const response = await api.get<SystemInfoResponse>('/settings/system/info');
    return response.data;
  },
};

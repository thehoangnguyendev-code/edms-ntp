import { api } from './client';

/** Placeholder status until the Backup & Restore feature is built; `available` stays false until then. */
export interface BackupRestoreStatus {
  available: boolean;
  status: string;
  message: string;
}

export const backupRestoreApi = {
  getStatus: async (): Promise<BackupRestoreStatus> => {
    const response = await api.get<BackupRestoreStatus>('/backup-restore/status');
    return response.data;
  },
};

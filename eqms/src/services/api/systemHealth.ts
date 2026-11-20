import api from './client';

/** One service the application leans on (virus scanner, document storage, Office server, chart renderer) and whether it answers now. */
export interface DependencyStatus {
  code: string;
  name: string;
  status: 'UP' | 'DOWN';
  /** What stops working while it is down. */
  impact: string;
  checkedAt: string;
}

export const systemHealthApi = {
  /** GET /system/dependencies -- open to every signed-in person; names and effects only. */
  getDependencies: async (): Promise<DependencyStatus[]> => {
    const response = await api.get<DependencyStatus[]>('/system/dependencies');
    return response.data;
  },
};

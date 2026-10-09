import { api } from './client';

/** Machine values. The label shown to people is derived from these, never sent back. */
export type DeploymentEnvironment = 'DEV' | 'TEST' | 'PROD';

export const systemEnvironmentApi = {
  get: async (): Promise<DeploymentEnvironment> => {
    const { data } = await api.get<{ environment: DeploymentEnvironment }>('/system/environment');
    return data.environment;
  },
};

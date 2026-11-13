import { api } from './client';

export type ToastPlace = 'center' | 'top-center' | 'bottom-center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

/** The one look every toast (system message) of the application shares: colour, shadow, place and display time. */
export interface InAppDesign {
  toastPosition: ToastPlace;
  /** How long a toast stays on screen, in seconds (2 to 60). */
  toastDurationSeconds: number;
  /** The colour of its border and time bar, a six-digit hex colour. */
  toastColor: string;
  /** The strength of its shadow, 0 (none) to 100. */
  toastShadow: number;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export type InAppDesignInput = Pick<InAppDesign, 'toastPosition' | 'toastDurationSeconds' | 'toastColor' | 'toastShadow'>;

const ENDPOINT = '/settings/in-app-design';

export const inAppDesignApi = {
  get: async () => (await api.get<InAppDesign>(ENDPOINT)).data,
  /** {expectedVersion}: the version of the design as it was when this person opened it; a change saved by someone else since refuses this one. */
  update: async (design: InAppDesignInput, expectedVersion?: number) => (await api.put<InAppDesign>(ENDPOINT, { ...design, expectedVersion })).data,
};

import { api } from './client';

/** The one look every email of the system shares (logo, colour, font, footer). */
export interface EmailDesign {
  /** An uploaded logo picture; it takes the place of the text. */
  logoUrl: string | null;
  /** The words in the header when there is no picture. */
  logoText: string | null;
  /** The colour of the header band only. */
  brandColor: string;
  /** The colour of the action button and of the links. */
  buttonColor: string;
  /** Background of the body (the white card) and of the footer. */
  bodyColor: string;
  footerColor: string;
  logoAlign: EmailAlign;
  footerAlign: EmailAlign;
  /** The colour of the text in the header (when there is no logo), in the body and in the footer. */
  headerTextColor: string;
  /** The font of the words in the header; empty means the font of the body. */
  headerFontFamily: string | null;
  bodyTextColor: string;
  footerTextColor: string;
  fontFamily: string;
  footerText: string | null;
  supportEmail: string | null;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  fonts: string[];
  /** What the header says when there is no logo: the Header Title (Dashboard) of the general configuration, or the system name when none is set. */
  headerTitle: string;
}

export type EmailAlign = 'LEFT' | 'CENTER' | 'RIGHT';

export type EmailDesignInput = Pick<EmailDesign, 'logoUrl' | 'logoText' | 'brandColor' | 'buttonColor' | 'bodyColor' | 'footerColor' | 'logoAlign' | 'footerAlign' | 'headerTextColor' | 'headerFontFamily' | 'bodyTextColor' | 'footerTextColor' | 'fontFamily' | 'footerText' | 'supportEmail'>;

const ENDPOINT = '/settings/email-design';

export const emailDesignApi = {
  get: async () => (await api.get<EmailDesign>(ENDPOINT)).data,
  /** {expectedVersion}: the version of the design as it was when this person opened it; a change saved by someone else since refuses this one. */
  update: async (design: EmailDesignInput, expectedVersion?: number) => (await api.put<EmailDesign>(ENDPOINT, { ...design, expectedVersion })).data,
  /** A sample mail in the design being edited, not yet saved. */
  preview: async (design: EmailDesignInput) => (await api.post<{ html: string }>(`${ENDPOINT}/preview`, design)).data.html,
};

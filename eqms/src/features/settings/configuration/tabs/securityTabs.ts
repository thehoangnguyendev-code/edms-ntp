/** The tabs of the Security page, in order. The id is what the address carries (?tab=...). Kept apart from SecurityTab so the page can read the address without loading the tab. */
export const SECURITY_TAB_IDS = ['password-rules', 'sessions-accounts', 'network-access', 'history'] as const;
export type SecurityTabId = (typeof SECURITY_TAB_IDS)[number];

export const securityTabFromParam = (value: string | null | undefined): SecurityTabId =>
  (SECURITY_TAB_IDS as readonly string[]).includes(value ?? '') ? (value as SecurityTabId) : SECURITY_TAB_IDS[0];

/**
 * Keys under which the browser keeps a copy of two system settings, so a page can use them before the server answers.
 * The settings themselves (password policy, session timeout, rate limits, ...) are owned and enforced by the server.
 */
export const SECURITY_CONFIG_STORAGE_KEY = 'eqms.settings.system-config';
export const BROWSER_TAB_TITLE_STORAGE_KEY = 'eqms.settings.browser-tab-title';

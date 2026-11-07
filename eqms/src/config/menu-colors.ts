/** The colour of dropdown menu text and icons when the administrator chose none (Tailwind slate-500). */
export const DEFAULT_MENU_COLOR = '#64748B';

export const isMenuColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

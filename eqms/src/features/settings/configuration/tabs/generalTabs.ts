import { LayoutGrid, LogIn, Palette, PanelLeft, SlidersHorizontal } from 'lucide-react';
import type { TabItem } from '@/components/ui/tabs';
import type { GeneralConfig } from '../types';
import { HISTORY_TAB } from './ConfigTabs';
import { IconBlocks, IconLogin2 } from '@tabler/icons-react';

/** The tabs of the General page, in order. The id is what the address carries (?tab=...). */
export const GENERAL_TAB_IDS = ['branding', 'sign-in', 'appearance', 'module-display', 'system', 'history'] as const;
export type GeneralTabId = (typeof GENERAL_TAB_IDS)[number];
export const DEFAULT_GENERAL_TAB: GeneralTabId = 'branding';

export const GENERAL_TABS: ReadonlyArray<TabItem & { id: GeneralTabId }> = [
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'sign-in', label: 'Sign-in Screen', icon: IconLogin2 },
  { id: 'appearance', label: 'Appearance', icon: PanelLeft },
  { id: 'module-display', label: 'Module Display', icon: IconBlocks },
  { id: 'system', label: 'System', icon: SlidersHorizontal },
  HISTORY_TAB,
];

export const generalTabFromParam = (value: string | null | undefined): GeneralTabId =>
  (GENERAL_TAB_IDS as readonly string[]).includes(value ?? '') ? (value as GeneralTabId) : DEFAULT_GENERAL_TAB;

interface TabFields {
  /** Fields of the configuration itself. */
  top: ReadonlyArray<string>;
  /** Fields of its "appearance" part. */
  appearance: ReadonlyArray<string>;
}

const FIELDS: Record<GeneralTabId, TabFields> = {
  branding: {
    top: ['systemName', 'systemDisplayName', 'systemHeaderTitle', 'systemFooterLeft', 'systemFooterRight', 'footerShowOnDesktop', 'footerShowOnMobile', 'systemLogo', 'systemFavicon', 'systemSidebarCollapsedLogo', 'appIcon', 'appIconBackground', 'appShortName'],
    appearance: ['systemSidebarCollapsedLogo'],
  },
  'sign-in': { top: [], appearance: ['loginLayout', 'loginCarousel', 'authBackground'] },
  appearance: {
    top: [],
    appearance: ['showSidebarUserProfile', 'compactDesktopFilters', 'alternatingRecordColors', 'alternatingRecordColor', 'tableColumnDividers', 'menuTextColor', 'menuIconColor', 'mainBackground', 'knowledgeBackground'],
  },
  'module-display': {
    top: [],
    appearance: ['trainingMaterialsLayout', 'knowledgeFolderNames', 'knowledgeSidebarFolderNames', 'knowledgeOpenInNewTab', 'notificationInboxLayout', 'auditTabView', 'auditTabTimelineStyle'],
  },
  system: { top: ['adminEmail', 'locale', 'maintenanceMode'], appearance: [] },
  history: { top: [], appearance: [] },
};

/** Editing any appearance field also writes these two with their default, so "not set" and the default are the same thing. */
const APPEARANCE_DEFAULTS: Record<string, unknown> = { showSidebarUserProfile: false, compactDesktopFilters: false };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The tabs that hold a change that is not saved yet, found by comparing the draft with what was last saved. */
export function changedGeneralTabs(draft: GeneralConfig | undefined, saved: GeneralConfig | undefined | null): Set<GeneralTabId> {
  const changed = new Set<GeneralTabId>();
  if (!draft || !saved) return changed;
  const d = draft as unknown as Record<string, unknown>;
  const s = saved as unknown as Record<string, unknown>;
  const da = (draft.appearance ?? {}) as unknown as Record<string, unknown>;
  const sa = (saved.appearance ?? {}) as unknown as Record<string, unknown>;
  for (const id of GENERAL_TAB_IDS) {
    const { top, appearance } = FIELDS[id];
    if (top.some((key) => !same(d[key], s[key])) || appearance.some((key) => !same(da[key] ?? APPEARANCE_DEFAULTS[key], sa[key] ?? APPEARANCE_DEFAULTS[key]))) {
      changed.add(id);
    }
  }
  return changed;
}

/** The draft with the fields of one tab put back to what was last saved, the other tabs untouched. */
export function revertGeneralTab(draft: GeneralConfig, saved: GeneralConfig | null | undefined, id: GeneralTabId): GeneralConfig {
  if (!saved) return draft;
  const { top, appearance } = FIELDS[id];
  const d = { ...(draft as unknown as Record<string, unknown>) };
  const s = saved as unknown as Record<string, unknown>;
  top.forEach((key) => {
    if (key in s) d[key] = JSON.parse(JSON.stringify(s[key]));
    else delete d[key];
  });
  const da = { ...((draft.appearance ?? {}) as unknown as Record<string, unknown>) };
  const sa = (saved.appearance ?? {}) as unknown as Record<string, unknown>;
  appearance.forEach((key) => {
    if (key in sa) da[key] = JSON.parse(JSON.stringify(sa[key]));
    else delete da[key];
  });
  d.appearance = da;
  return d as unknown as GeneralConfig;
}

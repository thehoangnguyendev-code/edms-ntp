import React, { useEffect, useState, type ComponentType } from 'react';
import { fetchLibrary } from './remoteIcons';

/**
 * The icon of a notification can be any icon of the Lucide or the Tabler library, chosen in Edit Notification and stored as {@code lucide:BellRing}
 * or {@code tabler:IconBell}. The two libraries are large, so they are loaded only when a notification has a chosen icon (or when the picker is
 * open), once, in a chunk of their own; until then (and for a name that no longer exists) the icon of the kind of notification is drawn.
 */
export type IconComponent = ComponentType<{ className?: string; style?: React.CSSProperties }>;
export type IconLibrary = 'lucide' | 'tabler';
export type IconLibraries = Record<IconLibrary, Record<string, IconComponent>>;

/** `hex` is the colour of the tone as a six-digit colour (the one of its `text` class), for the colour picker. */
export const NOTIFICATION_TONES: { key: string; label: string; bg: string; text: string; swatch: string; hex: string }[] = [
  { key: 'emerald', label: 'Green', bg: 'bg-emerald-50', text: 'text-emerald-600', swatch: 'bg-emerald-500', hex: '#059669' },
  { key: 'blue', label: 'Blue', bg: 'bg-blue-50', text: 'text-blue-600', swatch: 'bg-blue-500', hex: '#2563EB' },
  { key: 'cyan', label: 'Cyan', bg: 'bg-cyan-50', text: 'text-cyan-600', swatch: 'bg-cyan-500', hex: '#0891B2' },
  { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', swatch: 'bg-indigo-500', hex: '#4F46E5' },
  { key: 'purple', label: 'Purple', bg: 'bg-purple-50', text: 'text-purple-600', swatch: 'bg-purple-500', hex: '#9333EA' },
  { key: 'amber', label: 'Amber', bg: 'bg-amber-50', text: 'text-amber-600', swatch: 'bg-amber-500', hex: '#D97706' },
  { key: 'red', label: 'Red', bg: 'bg-red-50', text: 'text-red-600', swatch: 'bg-red-500', hex: '#DC2626' },
  { key: 'slate', label: 'Grey', bg: 'bg-slate-100', text: 'text-slate-600', swatch: 'bg-slate-500', hex: '#475569' },
];

export const findNotificationTone = (key?: string | null) => NOTIFICATION_TONES.find((tone) => tone.key === key);

const KEY = /^(lucide|tabler):([A-Za-z][A-Za-z0-9]*)$/;

export const parseIconKey = (key?: string | null): { library: IconLibrary; name: string } | null => {
  const match = key ? KEY.exec(key) : null;
  return match ? { library: match[1] as IconLibrary, name: match[2] } : null;
};

export const iconKey = (library: IconLibrary, name: string) => `${library}:${name}`;

let loaded: IconLibraries | null = null;
let loading: Promise<IconLibraries> | null = null;

const isComponent = (value: unknown): value is IconComponent => typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value);

/** The icons built into the application (the two packages): loaded once, at once, and the start of the lists until the newest are read. */
export const loadIconLibraries = (): Promise<IconLibraries> => {
  loading ??= Promise.all([import('lucide-react'), import('@tabler/icons-react')]).then(([lucide, tabler]) => {
    const pick = (module: Record<string, unknown>, accept: (name: string) => boolean) =>
      Object.fromEntries(Object.entries(module).filter(([name, value]) => accept(name) && isComponent(value))) as Record<string, IconComponent>;
    const lucideIcons = (lucide as unknown as { icons?: Record<string, IconComponent> }).icons ?? {};
    builtIn = {
      lucide: lucideIcons,
      tabler: pick(tabler as unknown as Record<string, unknown>, (name) => /^Icon[A-Z0-9]/.test(name)),
    };
    loaded = merge(builtIn, newest);
    return loaded;
  });
  // whatever the lists are now: the newest icons may have been added since the packages were read
  return loading.then(() => loaded as IconLibraries);
};

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
// The newest icons. The two sets are kept up to date while the application runs (owner decision 2026-11-13): the newest drawings of both libraries are read from their
// public package files (data only, see remoteIcons.tsx) when the picker opens, every half hour while it stays open, and when a notification names an icon the built-in
// packages do not have yet. An icon the application has keeps its drawing; the new ones are added. When the source cannot be reached the built-in icons are used.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

export interface IconSetStatus {
  state: 'idle' | 'checking' | 'current' | 'unavailable';
  /** When the newest icons were last read successfully. */
  checkedAt: Date | null;
  /** How many icons each library has that the application was built without. */
  added: Record<IconLibrary, number>;
  /** How many icons each library has in all. */
  total: Record<IconLibrary, number>;
}

const EMPTY: IconLibraries = { lucide: {}, tabler: {} };
let builtIn: IconLibraries | null = null;
let newest: IconLibraries = EMPTY;
let status: IconSetStatus = { state: 'idle', checkedAt: null, added: { lucide: 0, tabler: 0 }, total: { lucide: 0, tabler: 0 } };
let refreshing: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** The built-in icons, with the ones of the newest release the application was built without added. */
const merge = (base: IconLibraries, extra: IconLibraries): IconLibraries => ({
  lucide: { ...extra.lucide, ...base.lucide },
  tabler: { ...extra.tabler, ...base.tabler },
});

/** How long the newest icons are trusted before they are read again. */
export const ICON_REFRESH_MS = 30 * 60 * 1000;

/** Reads the newest icons of both libraries; with {force} even when they were read recently. Never throws: a failure is the status "unavailable". */
export const refreshIconLibraries = (force = false): Promise<void> => {
  if (refreshing) return refreshing;
  if (!force && status.state === 'current' && status.checkedAt && Date.now() - status.checkedAt.getTime() < ICON_REFRESH_MS) return Promise.resolve();
  status = { ...status, state: 'checking' };
  notify();
  refreshing = (async () => {
    const base = builtIn ?? (await loadIconLibraries().then(() => builtIn!));
    try {
      const [lucide, tabler] = await Promise.all([fetchLibrary('lucide'), fetchLibrary('tabler')]);
      newest = { lucide, tabler };
      loaded = merge(base, newest);
      status = {
        state: 'current',
        checkedAt: new Date(),
        added: { lucide: Object.keys(lucide).filter((name) => !(name in base.lucide)).length, tabler: Object.keys(tabler).filter((name) => !(name in base.tabler)).length },
        total: { lucide: Object.keys(loaded.lucide).length, tabler: Object.keys(loaded.tabler).length },
      };
    } catch {
      status = { ...status, state: 'unavailable', total: { lucide: Object.keys(base.lucide).length, tabler: Object.keys(base.tabler).length } };
    } finally {
      refreshing = null;
      notify();
    }
  })();
  return refreshing;
};

/** Forgets what was read (for the tests). */
export const resetIconLibraries = () => {
  builtIn = null;
  loaded = null;
  loading = null;
  newest = EMPTY;
  refreshing = null;
  status = { state: 'idle', checkedAt: null, added: { lucide: 0, tabler: 0 }, total: { lucide: 0, tabler: 0 } };
  notify();
};

export const useIconLibraries = (): IconLibraries | null => {
  const [libraries, setLibraries] = useState<IconLibraries | null>(loaded);
  useEffect(() => {
    let live = true;
    const sync = () => live && setLibraries(loaded);
    listeners.add(sync);
    if (loaded) setLibraries(loaded);
    else void loadIconLibraries().then(sync).catch(() => undefined);
    return () => {
      live = false;
      listeners.delete(sync);
    };
  }, []);
  return libraries;
};

/** The state of the newest icons, and a way to read them again; while the component is mounted they are read now and every half hour. */
export const useIconSetStatus = (keepCurrent = false): IconSetStatus & { refresh: () => void } => {
  const [current, setCurrent] = useState(status);
  useEffect(() => {
    const sync = () => setCurrent(status);
    listeners.add(sync);
    sync();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (keepCurrent) {
      void refreshIconLibraries();
      timer = setInterval(() => void refreshIconLibraries(true), ICON_REFRESH_MS);
    }
    return () => {
      listeners.delete(sync);
      if (timer) clearInterval(timer);
    };
  }, [keepCurrent]);
  return { ...current, refresh: () => void refreshIconLibraries(true) };
};

export const resolveIcon = (libraries: IconLibraries | null, key?: string | null): IconComponent | null => {
  const parsed = parseIconKey(key);
  return libraries && parsed ? libraries[parsed.library][parsed.name] ?? null : null;
};

/** The chosen icon, or the fallback while the libraries load and when the name does not exist (any more); an icon the built-in packages do not have yet is looked for in the newest. */
export const ChosenIcon: React.FC<{ icon?: string | null; fallback: IconComponent; className?: string; style?: React.CSSProperties }> = ({ icon, fallback: Fallback, className, style }) => {
  const libraries = useIconLibraries();
  const found = icon ? resolveIcon(libraries, icon) : null;
  const missing = Boolean(icon) && Boolean(libraries) && !found && parseIconKey(icon) !== null;
  useEffect(() => {
    if (missing) void refreshIconLibraries();
  }, [missing]);
  const Drawn = found ?? Fallback;
  return <Drawn className={className} style={style} />;
};

const made = new Map<string, IconComponent>();

/** A component that draws the chosen icon where an icon component is expected (the bell and the Notifications page take a component). */
export const withChosenIcon = (icon: string, fallback: IconComponent): IconComponent => {
  const id = `${icon}|${(fallback as { displayName?: string; name?: string }).displayName ?? (fallback as { name?: string }).name ?? ''}`;
  let component = made.get(id);
  if (!component) {
    const Chosen: IconComponent = ({ className }) => <ChosenIcon icon={icon} fallback={fallback} className={className} />;
    made.set(id, Chosen);
    component = Chosen;
  }
  return component;
};

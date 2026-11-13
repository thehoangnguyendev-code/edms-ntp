import React from 'react';
import type { IconComponent, IconLibrary } from './notificationIcons';

/**
 * The newest icons of the two libraries, read while the application runs (owner decision 2026-11-13: the two sets are always up to date, without a new build).
 *
 * What is fetched is DATA, never code: the drawing of each icon (the list of its shapes) from the public package files of the libraries on a CDN. Each shape is checked
 * here (only the shapes and the attributes that icons use, with values that are numbers, a path or a colour keyword) and drawn by this module as an SVG, so nothing from
 * outside is run or put into the page as it came. When the CDN cannot be reached, the icons built into the application are used and the screen says so.
 */

type Node = [string, Record<string, string>];

export const ICON_SOURCES: Record<IconLibrary, string> = {
  lucide: 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icon-nodes.json',
  tabler: 'https://cdn.jsdelivr.net/npm/@tabler/icons@latest/tabler-nodes-outline.json',
};

const TAGS = new Set(['path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);
const NUMBER = /^-?\d*\.?\d+(e-?\d+)?$/i;
const NUMBERS = /^[-\d.\s,e]+$/i;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz\d\s.,+-eE]*$/;
const COLOUR = /^(none|currentColor)$/;
/** The attributes of a shape and the form their value must have. */
const ATTRIBUTES: Record<string, RegExp> = {
  d: PATH, cx: NUMBER, cy: NUMBER, r: NUMBER, rx: NUMBER, ry: NUMBER, x: NUMBER, y: NUMBER, x1: NUMBER, x2: NUMBER, y1: NUMBER, y2: NUMBER,
  width: NUMBER, height: NUMBER, points: NUMBERS, opacity: NUMBER, fill: COLOUR, stroke: COLOUR,
};

/** "shield-alert" as "ShieldAlert", the way the libraries name their components (and the way an icon is stored: lucide:ShieldAlert, tabler:IconBell). */
export const pascalName = (kebab: string): string =>
  kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/** The shapes of an icon that pass the check; a shape that does not is left out, the rest is kept. */
export const cleanNodes = (value: unknown): Node[] => {
  if (!Array.isArray(value)) return [];
  const clean: Node[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || typeof item[0] !== 'string' || !TAGS.has(item[0]) || typeof item[1] !== 'object' || item[1] === null) continue;
    const attributes: Record<string, string> = {};
    let ok = true;
    for (const [name, raw] of Object.entries(item[1] as Record<string, unknown>)) {
      const rule = ATTRIBUTES[name];
      const text = typeof raw === 'number' ? String(raw) : raw;
      if (!rule || typeof text !== 'string' || text.length > 4000 || !rule.test(text)) {
        ok = false;
        break;
      }
      attributes[name] = text;
    }
    if (ok) clean.push([item[0], attributes]);
  }
  return clean;
};

/** A component that draws the shapes as a 24 x 24 outline icon, the look both libraries share. */
export const iconFromNodes = (nodes: Node[]): IconComponent => {
  const Icon: IconComponent = ({ className, style }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {nodes.map(([tag, attributes], index) => React.createElement(tag, { ...attributes, key: index }))}
    </svg>
  );
  return Icon;
};

/** The icons of a file of a library by their component names; a file that is not what it should be gives none. */
export const iconsOfFile = (library: IconLibrary, data: unknown): Record<string, IconComponent> => {
  const icons: Record<string, IconComponent> = {};
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return icons;
  for (const [kebab, nodes] of Object.entries(data as Record<string, unknown>)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(kebab)) continue;
    const clean = cleanNodes(nodes);
    if (clean.length === 0) continue;
    const name = library === 'tabler' ? `Icon${pascalName(kebab)}` : pascalName(kebab);
    icons[name] = iconFromNodes(clean);
  }
  return icons;
};

const TIMEOUT_MS = 20_000;

/** Reads one library from its source; fails (throws) when the source cannot be reached or is not what it should be. */
export const fetchLibrary = async (library: IconLibrary, signal?: AbortSignal): Promise<Record<string, IconComponent>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const response = await fetch(ICON_SOURCES[library], { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const icons = iconsOfFile(library, await response.json());
    // a file with hardly any icon is a wrong file (an error page, a changed format), not a library
    if (Object.keys(icons).length < 100) throw new Error('The file has no icons');
    return icons;
  } finally {
    clearTimeout(timer);
  }
};

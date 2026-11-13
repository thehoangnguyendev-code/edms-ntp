import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanNodes, fetchLibrary, iconsOfFile, pascalName } from '../remoteIcons';
import { ChosenIcon, loadIconLibraries, refreshIconLibraries, resetIconLibraries, useIconSetStatus } from '../notificationIcons';

const lucideFile = () => {
  const file: Record<string, unknown> = { 'brand-new-thing': [['path', { d: 'M1 1l5 5' }], ['circle', { cx: '12', cy: '12', r: '3' }]], 'shield-alert': [['path', { d: 'M2 2h2' }]] };
  for (let i = 0; i < 120; i += 1) file[`filler-${i}`] = [['path', { d: 'M0 0h1' }]];
  return file;
};
const tablerFile = () => {
  const file: Record<string, unknown> = { 'new-gadget-2': [['path', { d: 'M3 3h3' }]], bell: [['path', { d: 'M3 3h3' }]] };
  for (let i = 0; i < 120; i += 1) file[`filler-${i}`] = [['path', { d: 'M0 0h1' }]];
  return file;
};

const stubFetch = (lucide: unknown, tabler: unknown, ok = true) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
    const url = String(input);
    return { ok, status: ok ? 200 : 503, json: async () => (url.includes('lucide-static') ? lucide : tabler) } as Response;
  }) as typeof fetch);

describe('the newest icons are data, checked, never code', () => {
  it('names an icon the way the libraries name their components', () => {
    expect(pascalName('shield-alert')).toBe('ShieldAlert');
    expect(pascalName('a-b-2')).toBe('AB2');
    expect(pascalName('number-0')).toBe('Number0');
  });

  it('keeps the shapes an icon is made of and drops anything else', () => {
    const nodes = cleanNodes([
      ['path', { d: 'M1 1l5 5z' }],
      ['script', { d: 'alert(1)' }],
      ['path', { d: 'M1 1', onclick: 'alert(1)' }],
      ['path', { d: 'javascript:alert(1)' }],
      ['circle', { cx: '12', cy: '12', r: '3', fill: 'none' }],
      ['circle', { cx: '12', cy: '12', r: '3', fill: 'url(#x)' }],
      ['rect', { x: '1', y: '1', width: '4', height: '4', rx: '1' }],
    ]);
    expect(nodes.map((n) => n[0])).toEqual(['path', 'circle', 'rect']);
    expect(cleanNodes('nope')).toEqual([]);
    expect(cleanNodes([['path', { d: 'M' + '1'.repeat(5000) }]])).toEqual([]);
  });

  it('turns a file of a library into components named like the library names them, Tabler ones with Icon in front', () => {
    expect(Object.keys(iconsOfFile('lucide', { 'shield-alert': [['path', { d: 'M1 1' }]] }))).toEqual(['ShieldAlert']);
    expect(Object.keys(iconsOfFile('tabler', { bell: [['path', { d: 'M1 1' }]], 'a-b-2': [['path', { d: 'M1 1' }]] }))).toEqual(['IconBell', 'IconAB2']);
    expect(iconsOfFile('lucide', null)).toEqual({});
    expect(iconsOfFile('lucide', { 'Bad Name': [['path', { d: 'M1 1' }]], 'x-y': [['script', {}]] })).toEqual({});
  });

  it('refuses a file that is not a library (an error page, a file with hardly any icon, a failed request)', async () => {
    stubFetch({ error: 'x' }, {});
    await expect(fetchLibrary('lucide')).rejects.toThrow();
    stubFetch(lucideFile(), tablerFile(), false);
    await expect(fetchLibrary('lucide')).rejects.toThrow('HTTP 503');
    vi.restoreAllMocks();
  });
});

describe('the two sets are kept up to date while the application runs', () => {
  beforeEach(() => resetIconLibraries());
  afterEach(() => vi.restoreAllMocks());

  it('adds the icons the application was built without, and keeps the drawing of the ones it has', async () => {
    const spy = stubFetch(lucideFile(), tablerFile());
    const built = await loadIconLibraries();
    const drawing = built.lucide.ShieldAlert;
    await refreshIconLibraries(true);
    const { result } = renderHook(() => useIconSetStatus());
    expect(result.current.state).toBe('current');
    expect(result.current.added.lucide).toBeGreaterThan(100);
    const merged = await loadIconLibraries();
    expect(merged.lucide.BrandNewThing).toBeTruthy();
    expect(merged.tabler.IconNewGadget2).toBeTruthy();
    expect(merged.lucide.ShieldAlert).toBe(drawing);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.every(([, init]) => (init as RequestInit).credentials === 'omit')).toBe(true);
  });

  it('says so and keeps the built-in icons when the newest cannot be read', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const built = await loadIconLibraries();
    await refreshIconLibraries(true);
    const { result } = renderHook(() => useIconSetStatus());
    expect(result.current.state).toBe('unavailable');
    expect(result.current.total.lucide).toBe(Object.keys(built.lucide).length);
  });

  it('does not read them again within half an hour, unless asked', async () => {
    const spy = stubFetch(lucideFile(), tablerFile());
    await loadIconLibraries();
    await refreshIconLibraries();
    await refreshIconLibraries();
    expect(spy).toHaveBeenCalledTimes(2);
    await refreshIconLibraries(true);
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('draws an icon the built-in packages do not have as soon as the newest are read', async () => {
    stubFetch(lucideFile(), tablerFile());
    const Fallback = () => <span data-testid="fallback" />;
    render(<ChosenIcon icon="lucide:BrandNewThing" fallback={Fallback} className="h-4 w-4" />);
    expect(await screen.findByTestId('fallback')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('svg')).not.toBeNull());
    expect(screen.queryByTestId('fallback')).toBeNull();
    const svg = document.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.querySelectorAll('path,circle')).toHaveLength(2);
    await act(async () => undefined);
  });
});

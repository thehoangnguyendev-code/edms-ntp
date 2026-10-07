import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Compact filter spacing scope', () => {
  it('only removes extra padding when a compact toolbar is rendered', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div class="compact-filter-section"><input /></div>';
    const section = container.firstElementChild!;
    expect(section.matches('.compact-filter-section:has([data-advanced-search-icon])')).toBe(false);
    section.innerHTML = '<div><svg data-advanced-search-icon></svg><input /></div>';
    expect(section.matches('.compact-filter-section:has([data-advanced-search-icon])')).toBe(true);
  });

  it('removes only the table margin, not the banner margin in spaced stacks', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div class="compact-filter-stack"><div id="banner"></div><div id="toolbar"><svg data-advanced-search-icon></svg></div><div id="table"></div></div>';
    const matches = container.querySelectorAll('.compact-filter-stack:has([data-advanced-search-icon]) > div:has([data-advanced-search-icon]) + div:not([hidden])');
    expect([...matches].map(element => element.id)).toEqual(['table']);
  });

  it('keeps the reference 16px gap owned by DesktopFilterPanel and scopes overrides to desktop', () => {
    const utilities = readFileSync(resolve(process.cwd(), 'src/styles/utilities.css'), 'utf8');
    const panel = readFileSync(resolve(process.cwd(), 'src/components/ui/filter/DesktopFilterPanel.tsx'), 'utf8');
    expect(utilities).toContain('@media (min-width: 768px)');
    expect(utilities).toContain('.compact-filter-section:has([data-advanced-search-icon])');
    expect(utilities).toContain('.compact-filter-stack:has([data-advanced-search-icon])');
    expect(panel).toContain('className="hidden md:block pb-4"');
  });
});

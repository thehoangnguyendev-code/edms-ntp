import { describe, expect, it } from 'vitest';
import { NAV_CONFIG } from '@/app/navigation';
import type { NavItem } from '@/types';
import { menuIconById } from '../menuIcon';

describe('The icon of a page in the search box', () => {
  it('is its own, or that of the nearest entry above it, for every entry of the menu', () => {
    const check = (items: NavItem[], above?: NavItem['icon']) => {
      for (const item of items) {
        const expected = item.icon ?? above;
        expect(menuIconById(item.id), item.id).toBe(expected);
        if (item.children) check(item.children, expected);
      }
    };
    check(NAV_CONFIG);
    expect(menuIconById('not-a-menu')).toBeUndefined();
  });
});

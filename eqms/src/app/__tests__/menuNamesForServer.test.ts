/// <reference types="node" />
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV_CONFIG } from '@/app/navigation';
import { translateLabel } from '@/i18n';
import type { NavItem } from '@/types';

/**
 * The server searches the pages of the menu, and only this application knows their Vietnamese names. They are kept for the server in one file of its
 * resources; this test fails when a menu name or its translation changes without that file. To write it again: set UPDATE_MENU_NAMES=1 and run this test.
 */
const FILE = resolve(__dirname, '../../../../eqms-backend/src/main/resources/navigation/menu-names.json');

const names = (items: NavItem[], into: Record<string, string[]> = {}): Record<string, string[]> => {
  for (const item of items) {
    into[item.id] = [...new Set([item.label, translateLabel('vi', item.label)])];
    if (item.children) names(item.children, into);
  }
  return into;
};

describe('The menu names the server searches', () => {
  it('are the names and translations of this menu', () => {
    const expected = names(NAV_CONFIG);
    if (process.env.UPDATE_MENU_NAMES) {
      mkdirSync(dirname(FILE), { recursive: true });
      writeFileSync(FILE, `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
    }
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(expected);
  });
});

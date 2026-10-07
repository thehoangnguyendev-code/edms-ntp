import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { SmartDropdown, DropdownItem } from './SmartDropdown';

const position = { left: 950, top: 100, maxHeight: 300, openUpward: false };
vi.mock('@/hooks', () => ({ useDropdownPosition: () => ({ position }) }));

beforeEach(() => {
  position.left = 950;
  vi.stubGlobal('innerWidth', 1024);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openMenu(onClose = vi.fn(), minWidth = 240) {
  return render(<SmartDropdown isOpen onClose={onClose} triggerRef={createRef<HTMLElement>()} minWidth={minWidth}>
    <DropdownItem>Edit Report Template</DropdownItem>
  </SmartDropdown>);
}

it('uses the actual menu width to prevent overflow at the right edge', () => {
  openMenu();
  expect(screen.getByRole('menu')).toHaveStyle({ left: '776px', maxWidth: 'calc(100vw - 16px)' });
  expect(screen.getByRole('menu').parentElement).toBe(document.body);
});

it('keeps left-edge menus within the viewport', () => {
  position.left = -20;
  openMenu();
  expect(screen.getByRole('menu')).toHaveStyle({ left: '8px' });
});

it('repositions on viewport resize and bounds the minimum width on small screens', () => {
  openMenu(vi.fn(), 500);
  vi.stubGlobal('innerWidth', 375);
  fireEvent(window, new Event('resize'));
  expect(screen.getByRole('menu')).toHaveStyle({ left: '127px', minWidth: 'min(500px, calc(100vw - 16px))' });
});

it('keeps Escape dismissal and item actions working', () => {
  const onClose = vi.fn();
  const onClick = vi.fn();
  render(<SmartDropdown isOpen onClose={onClose} triggerRef={createRef<HTMLElement>()}>
    <DropdownItem onClick={onClick}>View Detail</DropdownItem>
  </SmartDropdown>);
  fireEvent.click(screen.getByRole('menuitem'));
  expect(onClick).toHaveBeenCalledOnce();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});

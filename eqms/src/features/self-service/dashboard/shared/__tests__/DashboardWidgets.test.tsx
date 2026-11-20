import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardWidgets } from '../DashboardWidgets';
import { applyDashboardDrop, moveDashboardWidget } from '../dashboardLayout';
import type { DragEndEvent } from '@dnd-kit/react';

const preferences = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('@/services/api/userUiPreferences', () => ({ DASHBOARD_LAYOUT_PREFERENCE: 'dashboard-layout', userUiPreferencesApi: preferences }));
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn().mockResolvedValue({ data: {} }), delete: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => toast }));
vi.mock('@/components/ui/drawer/Drawer', () => ({ Drawer: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div role="dialog">{children}{footer}</div> }));
const widgets = [
  { id: 'my-documents', label: 'My documents', width: 'half' as const, content: <p>Allowed content</p> },
  { id: 'pending-work', label: 'Pending work', width: 'half' as const, content: <p>Pending content</p> },
];
const edit = async () => {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Customize Dashboard' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Customize Dashboard' }));
};
const order = () => Array.from(document.querySelectorAll<HTMLElement>('[data-dashboard-widget]')).map(item => item.dataset.dashboardWidget);
beforeEach(() => { Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [] }); Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] }); vi.clearAllMocks(); preferences.get.mockResolvedValue({ widgets: [] }); preferences.save.mockResolvedValue(undefined); });

it('previews width on the card, keeps the library about presence only and saves only authorized preferences', async () => {
  preferences.get.mockResolvedValue({ widgets: [{ id: 'admin-kpis', visible: true, width: 'full' }] });
  render(<DashboardWidgets widgets={widgets} />);
  await edit();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Widget Library' }));
  expect(within(screen.getByRole('dialog')).queryByRole('tablist', { name: /Width of/ })).toBeNull(); // a card's size is chosen on the card
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  fireEvent.click(within(screen.getByRole('tablist', { name: 'Width of My documents' })).getByRole('tab', { name: 'Full' }));
  expect(document.querySelector('[data-dashboard-widget="my-documents"]')).toHaveAttribute('data-widget-width', 'full');
  fireEvent.click(screen.getByRole('button', { name: 'Widget Library' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Document Control/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove My documents' }));
  expect(document.querySelector('[data-dashboard-widget="my-documents"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }));
  await waitFor(() => expect(preferences.save).toHaveBeenCalledWith('dashboard-layout', expect.objectContaining({ widgets: expect.arrayContaining([{ id: 'my-documents', visible: false, width: 'full' }]) })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Customize Dashboard' })).toBeInTheDocument());
  expect(screen.queryByText('Administrative content')).toBeNull();
});

it('cancels live visibility, width and keyboard reorder changes without writing to the server', async () => {
  render(<DashboardWidgets widgets={widgets} />); await edit();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Move Pending work' }), { key: 'ArrowUp' });
  expect(order()).toEqual(['pending-work', 'my-documents']);
  fireEvent.click(within(screen.getByRole('tablist', { name: 'Width of My documents' })).getByRole('tab', { name: 'Full' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(order()).toEqual(['my-documents', 'pending-work']);
  expect(document.querySelector('[data-dashboard-widget="my-documents"]')).toHaveAttribute('data-widget-width', 'half');
  expect(preferences.save).not.toHaveBeenCalled();
});

it('retains edit mode and the draft when a save fails', async () => {
  preferences.save.mockRejectedValue(new Error('network'));
  render(<DashboardWidgets widgets={widgets} />); await edit();
  fireEvent.click(within(screen.getByRole('tablist', { name: 'Width of My documents' })).getByRole('tab', { name: 'Full' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }));
  await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Unable to save dashboard' })));
  expect(screen.getByRole('button', { name: 'Save Layout' })).toBeEnabled();
  expect(document.querySelector('[data-dashboard-widget="my-documents"]')).toHaveAttribute('data-widget-width', 'full');
});

it('commits the dnd-kit optimistic order, retains hidden settings and ignores cancellation', () => {
  const a = { id: 'my-documents', visible: true, width: 'full' as const };
  const hidden = { id: 'audit-activity', visible: false, width: 'half' as const };
  const b = { id: 'pending-work', visible: true, width: 'half' as const };
  const items = [a, hidden, b];
  // With optimistic sorting source and target are the same; source.index holds its final slot.
  const event = { canceled: false, operation: { source: { id: a.id, initialIndex: 0, index: 1 }, target: { id: a.id } } } as unknown as DragEndEvent;
  expect(applyDashboardDrop(items, event)).toEqual([b, hidden, a]);
  expect(applyDashboardDrop(items, { ...event, canceled: true })).toBe(items);
  expect(applyDashboardDrop(items, { ...event, operation: { ...event.operation, target: null } } as DragEndEvent)).toBe(items);
  expect(applyDashboardDrop(items, { ...event, operation: { ...event.operation, source: { id: 'unavailable', initialIndex: 0, index: 1 } } } as unknown as DragEndEvent)).toBe(items);
});

it('ignores unknown drag targets and keeps hidden settings when moving cards', () => {
  const items = [{ id: 'a', visible: true }, { id: 'hidden', visible: false }, { id: 'b', visible: true }];
  expect(moveDashboardWidget(items, 'unknown', 'b')).toBe(items);
  expect(moveDashboardWidget(items, 'a', 'a')).toBe(items);
  expect(moveDashboardWidget(items, 'b', 'a')).toEqual([items[2], items[0], items[1]]);
});

it('keeps touch scrolling available on card content while the grip owns dragging', async () => {
  render(<DashboardWidgets widgets={widgets} />); await edit();
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 40, clientY: 40 });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'touch' } });
  act(() => screen.getByText('Allowed content').dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(screen.getByRole('button', { name: 'Save Layout' })).toBeEnabled();
});

const withLibrary = [
  ...widgets,
  { id: 'backup-ledger', label: 'Backup ledger', width: 'half' as const, defaultVisible: false, content: <p>Ledger content</p> },
];

it('keeps a library card off the dashboard until it is added, then puts it last and saves it as shown', async () => {
  render(<DashboardWidgets widgets={withLibrary} />); await edit();
  expect(order()).toEqual(['my-documents', 'pending-work']);
  fireEvent.click(screen.getByRole('button', { name: 'Widget Library' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Backup & Restore/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add Backup ledger' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(order()).toEqual(['my-documents', 'pending-work', 'backup-ledger']);
  fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }));
  await waitFor(() => expect(preferences.save).toHaveBeenCalledWith('dashboard-layout', { widgets: expect.arrayContaining([{ id: 'backup-ledger', visible: true, width: 'half' }]) }));
});

it('does not bring a library card back for a person whose saved layout predates it', async () => {
  preferences.get.mockResolvedValue({ widgets: [{ id: 'my-documents', visible: true, width: 'half' }, { id: 'pending-work', visible: true, width: 'half' }] });
  render(<DashboardWidgets widgets={withLibrary} />);
  await waitFor(() => expect(order()).toEqual(['my-documents', 'pending-work']));
  expect(screen.queryByText('Ledger content')).toBeNull();
});

it('lists the cards under their module, closed until the module is opened, and a search opens the modules it finds', async () => {
  render(<DashboardWidgets widgets={withLibrary} />); await edit();
  fireEvent.click(screen.getByRole('button', { name: 'Widget Library' }));
  const dialog = within(screen.getByRole('dialog'));
  const documents = dialog.getByRole('button', { name: /Document Control/ });
  const backup = dialog.getByRole('button', { name: /Backup & Restore/ });
  expect(documents).toHaveTextContent('2 of 2 added'); // my-documents and pending-work are on the dashboard
  expect(backup).toHaveTextContent('0 of 1 added');
  expect(backup).toHaveAttribute('aria-expanded', 'false');
  expect(dialog.queryByText('Backup ledger')).toBeNull();
  fireEvent.click(backup);
  expect(backup).toHaveAttribute('aria-expanded', 'true');
  expect(await dialog.findByText('Backup ledger')).toBeInTheDocument();
  fireEvent.click(backup);
  await waitFor(() => expect(dialog.queryByText('Backup ledger')).toBeNull());
  fireEvent.change(dialog.getByLabelText('Search cards'), { target: { value: 'ledger' } });
  expect(await dialog.findByText('Backup ledger')).toBeInTheDocument(); // opened by the search
  expect(dialog.queryByRole('button', { name: /Document Control/ })).toBeNull(); // a module with no match is not listed
  fireEvent.change(dialog.getByLabelText('Search cards'), { target: { value: 'zzz' } });
  expect(dialog.getByText('No card matches.')).toBeInTheDocument();
});

it('opens the library straight from the page, in edit mode', async () => {
  render(<DashboardWidgets widgets={withLibrary} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Widgets' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Add Widgets' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Layout' })).toBeInTheDocument();
});

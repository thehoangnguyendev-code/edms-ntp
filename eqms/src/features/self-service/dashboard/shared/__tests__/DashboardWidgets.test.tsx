import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardWidgets } from '../DashboardWidgets';

const preferences = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/services/api/userUiPreferences', () => ({ DASHBOARD_LAYOUT_PREFERENCE: 'dashboard-layout', userUiPreferencesApi: preferences }));
vi.mock('@/services/api/client', () => ({ api: { delete: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/components/ui/drawer/Drawer', () => ({ Drawer: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div role="dialog">{children}{footer}</div> }));
vi.mock('@/components/ui/draggable-reorder-list/DraggableReorderList', () => ({ DraggableReorderList: ({ items, renderRow }: { items: {id: string}[]; renderRow: (item: any) => ReactNode }) => <div>{items.map(item => <div key={item.id}>{renderRow(item)}</div>)}</div> }));

it('saves widget visibility and width without rendering unavailable widget IDs', async () => {
  preferences.get.mockResolvedValue({ widgets: [{ id: 'admin-kpis', visible: true, width: 'full' }] });
  preferences.save.mockResolvedValue(undefined);
  render(<DashboardWidgets widgets={[{ id: 'my-documents', label: 'My documents', width: 'half', content: <p>Allowed content</p> }]} />);
  expect(screen.queryByText('Administrative content')).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Customize Dashboard' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Customize Dashboard' }));
  fireEvent.click(screen.getByLabelText('Show'));
  fireEvent.click(screen.getByRole('button', { name: 'Change width of My documents' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(preferences.save).toHaveBeenCalledWith('dashboard-layout', expect.objectContaining({ widgets: expect.arrayContaining([{ id: 'my-documents', visible: false, width: 'full' }]) })));
  await waitFor(() => expect(screen.queryByText('Allowed content')).toBeNull());
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardRoleDefaults } from '../DashboardRoleDefaults';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/services/api/client', () => ({ api }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/components/ui/draggable-reorder-list/DraggableReorderList', () => ({ DraggableReorderList: ({ items, renderRow }: { items: { id: string }[]; renderRow: (item: any) => ReactNode }) => <div>{items.map(item => <div key={item.id}>{renderRow(item)}</div>)}</div> }));

it('saves a role layout with an administrator-selected priority', async () => {
  api.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/options') ? [{ id: 'role-a', name: 'Quality' }] : [] }));
  api.put.mockResolvedValue({});
  render(<DashboardRoleDefaults />);
  fireEvent.click(await screen.findByRole('combobox', { name: 'Access profile' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Quality' }));
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Dashboard Defaults' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/dashboard/layout/roles/role-a', expect.objectContaining({ priority: 7, layout: expect.objectContaining({ widgets: expect.any(Array) }) })));
});

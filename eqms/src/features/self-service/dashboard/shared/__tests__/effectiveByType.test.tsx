import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardDocumentTypeCount } from '@/services/api/dashboard';

const api = vi.hoisted(() => ({ getEffectiveDocumentsByType: vi.fn() }));
vi.mock('@/services/api/dashboard', () => ({ dashboardApi: api }));

import { EffectiveByTypePanel } from '../EffectiveByTypePanel';

const type = (shortCode: string, name: string, documents: number): DashboardDocumentTypeCount => ({ typeId: `id-${shortCode}`, shortCode, name, documents });

beforeEach(() => api.getEffectiveDocumentsByType.mockReset());

describe('EffectiveByTypePanel', () => {
  it('shows the real total and every type in the column view', async () => {
    api.getEffectiveDocumentsByType.mockResolvedValue([type('SOP', 'Standard Operating Procedure', 12), type('WI', 'Work Instruction', 5)]);
    render(<EffectiveByTypePanel />);

    expect(await screen.findByText('17 effective documents across 2 types')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Donut/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Bar/ }));
    expect(await screen.findByRole('img', { name: 'Bar chart of effective documents by type: Standard Operating Procedure 12, Work Instruction 5' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bar/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('always shows every type name, code, count and share with its own colour, without hovering', async () => {
    api.getEffectiveDocumentsByType.mockResolvedValue([type('WI', 'Work Instruction', 6), type('SOP', 'Standard Operating Procedure', 12)]);
    render(<EffectiveByTypePanel />);
    await screen.findByText('18 effective documents across 2 types');

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Standard Operating ProcedureSOP1267%',
      'Work InstructionWI633%',
    ]); // largest first, whatever order the API used
    const swatches = items.map((item) => (item.querySelector('span[style]') as HTMLElement).style.backgroundColor);
    expect(new Set(swatches).size).toBe(2);
  });

  it('keeps the card the same height in both views and in every state', async () => {
    api.getEffectiveDocumentsByType.mockResolvedValue([type('SOP', 'Standard Operating Procedure', 12), type('WI', 'Work Instruction', 6)]);
    render(<EffectiveByTypePanel />);
    expect(screen.getByRole('tabpanel').className).toContain('h-[280px]'); // while loading
    await screen.findByText('18 effective documents across 2 types');
    expect(screen.getByRole('tabpanel').className).toContain('h-[280px]');
    fireEvent.click(screen.getByRole('tab', { name: /Donut/ }));
    expect(screen.getByRole('tabpanel').className).toContain('h-[280px]');
    fireEvent.click(screen.getByRole('tab', { name: /Bar/ }));
    expect(screen.getByRole('tabpanel').className).toContain('h-[280px]');
  });

  it('switches to the donut with a legend of counts and shares', async () => {
    api.getEffectiveDocumentsByType.mockResolvedValue([type('SOP', 'Standard Operating Procedure', 12), type('WI', 'Work Instruction', 6)]);
    render(<EffectiveByTypePanel />);
    await screen.findByText('18 effective documents across 2 types');

    fireEvent.click(screen.getByRole('tab', { name: /Bar/ }));
    await screen.findByRole('img', { name: /^Bar chart of effective documents by type/ });
    fireEvent.click(screen.getByRole('tab', { name: /Donut/ }));

    expect(screen.getByRole('tab', { name: /Donut/ })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    // the bars leave first, then the ring arrives
    expect(await within(panel).findByRole('img', { name: /^Donut chart of effective documents by type/ })).toBeInTheDocument();
    const sop = within(panel).getByText('Standard Operating Procedure').closest('li') as HTMLElement;
    expect(within(sop).getByText('12')).toBeInTheDocument();
    expect(within(sop).getByText('67%')).toBeInTheDocument(); // 12 of 18
    expect(within(panel).getByText('Effective')).toBeInTheDocument();
    // The ring has a tooltip, and it sits above the figure written in the middle of the ring (which is drawn after the chart).
    const tooltip = panel.querySelector<HTMLElement>('.recharts-tooltip-wrapper');
    expect(tooltip).not.toBeNull();
    expect(Number(tooltip?.style.zIndex)).toBeGreaterThanOrEqual(50);
  });

  it('moves between the views in both directions and shows only one of them at a time', async () => {
    api.getEffectiveDocumentsByType.mockResolvedValue([type('SOP', 'Standard Operating Procedure', 12), type('WI', 'Work Instruction', 6)]);
    render(<EffectiveByTypePanel />);
    await screen.findByText('18 effective documents across 2 types');
    const chart = (kind: 'Bar' | 'Donut') => screen.queryByRole('img', { name: new RegExp(`^${kind} chart of effective documents by type`) });
    expect(chart('Donut')).toBeInTheDocument();
    expect(chart('Bar')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Bar/ }));
    await vi.waitFor(() => expect(chart('Bar')).toBeInTheDocument());
    expect(chart('Donut')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Donut/ }));
    await vi.waitFor(() => expect(chart('Donut')).toBeInTheDocument());
    expect(chart('Bar')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Bar/ }));
    await vi.waitFor(() => expect(chart('Bar')).toBeInTheDocument());
    expect(chart('Donut')).toBeNull();
    expect(screen.getByRole('tabpanel').id).toBe('effective-type-panel-bar');
  });

  it('folds the smallest types into Other in the donut but not in the bars', async () => {
    const many = Array.from({ length: 10 }, (_, i) => type(`T${i}`, `Type ${i}`, 10 - i));
    api.getEffectiveDocumentsByType.mockResolvedValue(many);
    render(<EffectiveByTypePanel />);
    await screen.findByText('55 effective documents across 10 types');
    fireEvent.click(screen.getByRole('tab', { name: /Bar/ }));
    expect((await screen.findByRole('img', { name: /^Bar chart of effective documents by type/ })).getAttribute('aria-label')).toContain('Type 9 1');

    fireEvent.click(screen.getByRole('tab', { name: /Donut/ }));
    const panel = screen.getByRole('tabpanel');
    const other = (await within(panel).findByText('Other (3 types)')).closest('li') as HTMLElement;
    expect(within(other).getByText('6')).toBeInTheDocument(); // 3 + 2 + 1
    expect(within(panel).queryByText('Type 9')).toBeNull();
  });

  it('says so when nothing is effective and offers a retry when the request fails', async () => {
    api.getEffectiveDocumentsByType.mockResolvedValueOnce([]);
    const { unmount } = render(<EffectiveByTypePanel />);
    expect(await screen.findByText('No document is effective yet')).toBeInTheDocument();
    unmount();

    api.getEffectiveDocumentsByType.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([type('SOP', 'Standard Operating Procedure', 3)]);
    render(<EffectiveByTypePanel />);
    expect(await screen.findByText('Effective documents by type could not be loaded.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('3 effective documents across 1 type')).toBeInTheDocument();
  });
});

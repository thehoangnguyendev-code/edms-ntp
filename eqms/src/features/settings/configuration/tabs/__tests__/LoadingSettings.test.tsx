import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingSettings } from '../LoadingSettings';
import { changedGeneralTabs, revertGeneralTab } from '../generalTabs';
import type { GeneralConfig } from '../../types';
import { Loading } from '@/components/ui/loading';

vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => ({ loadingStyle: 'system', loadingColor: '#059669' }) }));
afterEach(cleanup);

describe('Branding loading controls', () => {
  it('previews the selected draft without changing the shared runtime indicator', async () => {
    const onStyle = vi.fn();
    const onColor = vi.fn();
    const { container, rerender } = render(<><Loading text="Shared runtime" /><LoadingSettings onStyleChange={onStyle} onColorChange={onColor} /></>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Loading Style' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ring' }));
    expect(onStyle).toHaveBeenCalledWith('ring');
    rerender(<><Loading text="Shared runtime" /><LoadingSettings variant="ring" color="#112233" onStyleChange={onStyle} onColorChange={onColor} /></>);
    expect(screen.getByRole('img', { name: 'Loading Preview' }).querySelector('[data-loading-style="ring"]')).toHaveStyle({ color: '#112233' });
    expect(screen.getByRole('status', { name: 'Shared runtime' }).querySelector('[data-loading-style="system"]')).toBeInTheDocument();
    expect(container.querySelector('section > div')).toHaveClass('grid-cols-1', 'md:grid-cols-2');
    fireEvent.click(screen.getByText('#112233').closest('button')!);
    fireEvent.click(await screen.findByTitle('#000000'));
    expect(onColor).toHaveBeenCalledWith('#000000');
    expect(within(screen.getByRole('img', { name: 'Loading Preview' })).getByText('Ring')).toBeInTheDocument();
  });

  it('marks and resets Branding only, preserving unrelated draft fields', () => {
    const saved = { systemDisplayName: 'EQMS', appearance: { loadingStyle: 'system', loadingColor: '#059669', compactDesktopFilters: false } } as unknown as GeneralConfig;
    const draft = { ...saved, appearance: { ...saved.appearance, loadingStyle: 'bars' as const, loadingColor: '#123456', compactDesktopFilters: true } };
    expect(changedGeneralTabs(draft, saved)).toEqual(new Set(['branding', 'appearance']));
    const reset = revertGeneralTab(draft, saved, 'branding');
    expect(reset.appearance.loadingStyle).toBe('system');
    expect(reset.appearance.loadingColor).toBe('#059669');
    expect(reset.appearance.compactDesktopFilters).toBe(true);
  });
});

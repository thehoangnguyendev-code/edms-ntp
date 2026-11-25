import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/services/api/settings', () => ({ settingsApi: {} }));
import { GeneralTab } from '../GeneralTab';
import { changedGeneralTabs, revertGeneralTab } from '../generalTabs';
import type { GeneralConfig } from '../../types';

afterEach(cleanup);

it('patches only the loading fields of a legacy configuration and can discard the entire draft', async () => {
  const saved = { systemName: 'EQMS', systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '', appearance: {}, locale: { language: 'en' }, backupSettings: {} } as unknown as GeneralConfig;
  const onChange = vi.fn();
  const { rerender } = render(<GeneralTab config={saved} savedConfig={saved} onChange={onChange} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Loading Style' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Ring' }));
  const styleDraft = onChange.mock.calls.at(-1)![0] as GeneralConfig;
  expect(styleDraft).toEqual({ ...saved, appearance: { loadingStyle: 'ring' } });
  rerender(<GeneralTab config={styleDraft} savedConfig={saved} onChange={onChange} />);
  fireEvent.click(screen.getByText('#059669').closest('button')!);
  fireEvent.click(await screen.findByTitle('#000000'));
  const draft = onChange.mock.calls.at(-1)![0] as GeneralConfig;
  expect(draft.appearance).toEqual({ loadingStyle: 'ring', loadingColor: '#000000' });
  expect(changedGeneralTabs(draft, saved)).toEqual(new Set(['branding']));
  expect(revertGeneralTab(draft, saved, 'branding')).toEqual(saved);
});

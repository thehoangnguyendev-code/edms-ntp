import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider, RedrawOnLanguage, useLanguage } from '../LanguageProvider';
import { getCatalogLanguage, setCatalogLanguage, tr } from '../catalog';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'language-test-user' } }),
}));

vi.mock('@/services/api/localization', () => ({
  localizationApi: {
    getMine: vi.fn().mockResolvedValue({ language: 'en' }),
    updateMine: vi.fn(async (value: unknown) => value),
  },
}));

/** Copy that reads `tr` directly and never consumes the language context. */
const Copy = () => <span data-testid="copy">{tr('Training Matrix')}</span>;

const SwitchLanguage = () => {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => void setLanguage('vi')}>switch</button>;
};

describe('LanguageProvider', () => {
  afterEach(() => {
    setCatalogLanguage('en');
    window.localStorage.clear();
  });

  it('draws the copy again without mounting the screen again: what was typed and chosen stays', async () => {
    const mounted = vi.fn();
    const Screen = () => {
      const [text, setText] = React.useState('');
      const [ticked, setTicked] = React.useState(false);
      const heading = React.useMemo(() => tr('Training Matrix'), [getCatalogLanguage()]);
      React.useEffect(() => { mounted(); }, []);
      return (
        <>
          <Copy />
          <h1>{heading}</h1>
          <input aria-label="note" value={text} onChange={(e) => setText(e.target.value)} />
          <input aria-label="tick" type="checkbox" checked={ticked} onChange={() => setTicked(!ticked)} />
        </>
      );
    };
    // As in the application: the screen sits under elements that do not change, which would stop a plain re-render.
    const Between = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    render(
      <LanguageProvider>
        <Between>
          <RedrawOnLanguage render={() => <Screen />} />
          <SwitchLanguage />
        </Between>
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText('note'), { target: { value: 'half written' } });
    fireEvent.click(screen.getByLabelText('tick'));
    expect(screen.getByTestId('copy').textContent).toBe('Training Matrix');
    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    await waitFor(() => expect(screen.getByTestId('copy').textContent).toBe('Ma trận Đào tạo'));
    expect(screen.getByRole('heading').textContent).toBe('Ma trận Đào tạo');
    expect((screen.getByLabelText('note') as HTMLInputElement).value).toBe('half written');
    expect((screen.getByLabelText('tick') as HTMLInputElement).checked).toBe(true);
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});

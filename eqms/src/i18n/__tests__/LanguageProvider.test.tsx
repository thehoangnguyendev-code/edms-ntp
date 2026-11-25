import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../LanguageProvider';
import { setCatalogLanguage, tr } from '../catalog';

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

  it('re-renders every child that uses tr, not only the context consumers', async () => {
    render(
      <LanguageProvider>
        <span />
        <Copy />
        <SwitchLanguage />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('copy').textContent).toBe('Training Matrix');
    fireEvent.click(screen.getByRole('button', { name: 'switch' }));
    await waitFor(() => expect(screen.getByTestId('copy').textContent).toBe('Ma trận Đào tạo'));
  });
});

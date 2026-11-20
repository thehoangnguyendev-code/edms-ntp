import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SecurityConfig } from '../../types';
import { SecurityTab } from '../SecurityTab';
import { securityTabFromParam } from '../securityTabs';
import { changedTabs } from '../ConfigTabs';

vi.mock('../PasswordPolicyTester', () => ({ PasswordPolicyTester: () => <p>Test a Password</p> }));

const config = {
  passwordMinLength: 12, requireUppercase: true, requireLowercase: true, requireSpecialChars: true, requireNumbers: true,
  enablePasswordExpiry: true, passwordExpiryDays: 90, preventPasswordReuse: true, passwordHistoryCount: 5,
  sessionTimeoutMinutes: 30, enable2FA: false, enableAccountLockout: true, maxLoginAttempts: 5,
} as SecurityConfig;

afterEach(() => cleanup());
const open = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('Security tabs', () => {
  it('opens Password Rules first and shows only the groups of the open tab', () => {
    render(<SecurityTab config={config} onChange={vi.fn()} />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Password Rules', 'Sessions & Accounts', 'History']);
    expect(screen.getByText('Required Characters')).toBeTruthy();
    expect(screen.getByText('Test a Password')).toBeTruthy();
    expect(screen.getByText('Password Expiration')).toBeTruthy();
    expect(screen.queryByText('Account Lockout')).toBeNull();
  });

  it('orders the groups from what a password must look like to when it expires, and ends with the tester', () => {
    render(<SecurityTab config={config} onChange={vi.fn()} />);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Length', 'Required Characters', 'Not Allowed', 'Complexity Limits', 'Password Expiration', 'Password History', 'First Sign-In']);
    expect(screen.getByText('Test a Password')).toBeTruthy();
  });

  it('puts every setting on one tab and keeps its behaviour', () => {
    const onChange = vi.fn();
    render(<SecurityTab config={config} onChange={onChange} />);

    expect(screen.getByText('Password Expiration')).toBeTruthy();
    expect(screen.getByText('Password History')).toBeTruthy();
    expect(screen.getByLabelText('Require Password Change on First Sign-In')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Enable Password Expiration'));
    expect(onChange).toHaveBeenCalledWith({ ...config, enablePasswordExpiry: false });

    open('Sessions & Accounts');
    expect(screen.getByLabelText('Enable Session Timeout')).toBeTruthy();
    expect(screen.getByLabelText('Enforce Two-Factor Authentication (2FA)')).toBeTruthy();
    expect(screen.getByLabelText('Enable Account Lockout')).toBeTruthy();
  });

  it('adds the Network Access tab only when the page gives the panel, and draws it there', () => {
    render(<SecurityTab config={config} onChange={vi.fn()} networkPanel={<p>Network panel</p>} />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toContain('Network Access');
    expect(screen.queryByText('Network panel')).toBeNull();
    open('Network Access');
    expect(screen.getByText('Network panel')).toBeTruthy();
  });

  it('falls back to the first tab when the requested one is not available', () => {
    render(<SecurityTab config={config} onChange={vi.fn()} activeTab="network-access" />);

    expect(screen.getByRole('tab', { name: 'Password Rules' }).getAttribute('aria-selected')).toBe('true');
  });

  it('marks the tabs with a change that is not saved yet, including the network policy', () => {
    const draft = { ...config, maxLoginAttempts: 7, passwordMinLength: 14 } as SecurityConfig;
    render(<SecurityTab config={draft} savedConfig={config} onChange={vi.fn()} networkPanel={<p>x</p>} networkChanged />);

    const marked = screen.getAllByRole('tab').filter((t) => t.querySelector('[aria-label="Not saved yet"]')).map((t) => t.textContent);
    expect(marked).toEqual(['Password Rules', 'Sessions & Accounts', 'Network Access']);
  });

  it('has a limit for wrong passwords when signing, apart from the limit at sign-in, and marks the tab when only it changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SecurityTab config={config} onChange={onChange} activeTab="sessions-accounts" />);
    expect(screen.getByText('Maximum Login Attempts')).toBeTruthy();
    expect(screen.getByText('Maximum Signature Attempts')).toBeTruthy();
    const loginLimit = screen.getByText('Maximum Login Attempts').parentElement!.querySelector('input') as HTMLInputElement;
    const signatureLimit = screen.getByText('Maximum Signature Attempts').parentElement!.querySelector('input') as HTMLInputElement;
    expect(loginLimit.value).toBe('5');
    expect(signatureLimit.value).toBe('5'); // an older configuration without the setting shows the default

    fireEvent.change(signatureLimit, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxSignatureAttempts: 4, maxLoginAttempts: 5 }));

    const draft = { ...config, maxSignatureAttempts: 4 } as SecurityConfig;
    rerender(<SecurityTab config={draft} savedConfig={config} onChange={vi.fn()} activeTab="sessions-accounts" />);
    const marked = screen.getAllByRole('tab').filter((tab) => tab.querySelector('[aria-label="Not saved yet"]')).map((tab) => tab.textContent);
    expect(marked).toEqual(['Sessions & Accounts']);
  });
});

describe('tab helpers', () => {
  it('reads the tab from the address and finds the changed tabs', () => {
    expect(securityTabFromParam('sessions-accounts')).toBe('sessions-accounts');
    expect(securityTabFromParam('nope')).toBe('password-rules');
    expect(securityTabFromParam(null)).toBe('password-rules');
    expect([...changedTabs({ a: 2, b: 1 }, { a: 1, b: 1 }, { one: ['a'], two: ['b'] })]).toEqual(['one']);
    expect(changedTabs({ a: 1 }, null, { one: ['a'] }).size).toBe(0);
  });
});

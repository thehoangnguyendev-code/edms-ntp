import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordPolicyTester } from '../PasswordPolicyTester';
import type { SecurityConfig } from '../../types';

const config = { passwordMinLength: 10, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: false } as SecurityConfig;

afterEach(cleanup);

const type = (value: string) => fireEvent.change(screen.getByLabelText('Password to Check'), { target: { value } });

describe('PasswordPolicyTester', () => {
  it('shows nothing until a password is typed', () => {
    render(<PasswordPolicyTester config={config} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lists the rules of the screen and says how many are not met', () => {
    render(<PasswordPolicyTester config={config} />);
    type('abc');
    expect(screen.getByText('At least 10 characters')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/does not meet 3 of 4 rules/);
  });

  it('accepts a password that meets every rule, using the unsaved values', () => {
    render(<PasswordPolicyTester config={config} />);
    type('Abcdefg1xy');
    expect(screen.getByRole('status').textContent).toBe('This password meets all the rules.');
  });

  it('asks for the user information only when that rule is on, and rejects a password that contains it', () => {
    const { rerender } = render(<PasswordPolicyTester config={config} />);
    expect(screen.queryByLabelText('Username, E-mail or Name')).toBeNull();
    rerender(<PasswordPolicyTester config={{ ...config, disallowUserInfo: true }} />);
    fireEvent.change(screen.getByLabelText('Username, E-mail or Name'), { target: { value: 'nguyen@company.com' } });
    type('Nguyen12345');
    expect(screen.getByRole('status').textContent).toMatch(/does not meet 1 of 5 rules/);
  });
});

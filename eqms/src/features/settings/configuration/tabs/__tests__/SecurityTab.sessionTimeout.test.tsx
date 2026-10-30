import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { SecurityConfig } from '../../types';
import { SecurityTab } from '../SecurityTab';

vi.mock('../PasswordPolicyTester', () => ({ PasswordPolicyTester: () => null }));

it('defaults existing configurations to enabled and retains minutes when toggled', () => {
  function Example() {
    const [config, setConfig] = useState({ sessionTimeoutMinutes: 45 } as SecurityConfig);
    return <SecurityTab config={config} onChange={setConfig} />;
  }
  render(<Example />);
  const toggle = screen.getByLabelText('Enable Session Timeout') as HTMLInputElement;
  expect(toggle.checked).toBe(true);
  fireEvent.click(toggle);
  expect(screen.queryByText('Session Timeout (Minutes)')).toBeNull();
  fireEvent.click(toggle);
  expect((screen.getByDisplayValue('45') as HTMLInputElement).value).toBe('45');
});

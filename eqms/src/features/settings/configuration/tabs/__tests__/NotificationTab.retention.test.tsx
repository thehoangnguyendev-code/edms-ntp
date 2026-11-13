import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { NotificationConfig } from '../../types';
import { NotificationTab } from '../NotificationTab';
import { ToastProvider } from '@/components/ui/toast/Toast';

vi.mock('../DeliveryFailuresTable', () => ({ DeliveryFailuresTable: () => null }));

function Example({ onValue }: { onValue: (c: NotificationConfig) => void }) {
  const [config, setConfig] = useState({
    enableEmailNotifications: true,
    enableInAppNotifications: true,
    emailConfig: { smtpHost: '', smtpPort: 25, smtpUsername: '', smtpPassword: '', senderEmail: '', senderName: '', useSSL: false },
  } as unknown as NotificationConfig);
  return (
    <ToastProvider>
      <NotificationTab config={config} onChange={(c) => { setConfig(c); onValue(c); }} />
    </ToastProvider>
  );
}

it('edits the days read notifications are kept, digits only, empty means default', () => {
  let last: NotificationConfig | undefined;
  render(<Example onValue={(c) => { last = c; }} />);
  const input = document.getElementById('inAppRetentionDays') as HTMLInputElement;
  expect(input.value).toBe('');
  expect(input.placeholder).toBe('180');
  fireEvent.change(input, { target: { value: '9a0' } });
  expect(last?.inAppRetentionDays).toBe(90);
  fireEvent.change(input, { target: { value: '' } });
  expect(last?.inAppRetentionDays).toBeUndefined();
  expect(screen.getByText(/never read are never deleted/i)).toBeTruthy();
});

it('no longer has the settings of the toast: they are in the In-App Notification Design of the Notifications Administration', () => {
  render(<Example onValue={() => {}} />);
  for (const label of ['Toast Colour', 'Toast Position', 'Toast Display Time (Seconds)', 'Test Toast']) expect(screen.queryByText(label)).toBeNull();
});

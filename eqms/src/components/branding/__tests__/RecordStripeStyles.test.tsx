import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

const branding = vi.hoisted(() => ({ alternatingRecordColors: false, alternatingRecordColor: '#F8FAFC' }));
vi.mock('../BrandLogo', () => ({ useBranding: () => branding }));
import { RecordStripeStyles } from '../RecordStripeStyles';

it('applies saved settings, falls back on invalid colors and cleans up', () => {
  branding.alternatingRecordColors = false;
  const view = render(<RecordStripeStyles />);
  expect(document.documentElement.dataset.alternatingRecords).toBe('false');
  branding.alternatingRecordColors = true;
  branding.alternatingRecordColor = '#E5F1F2';
  view.rerender(<RecordStripeStyles />);
  expect(document.documentElement.dataset.alternatingRecords).toBe('true');
  expect(document.documentElement.style.getPropertyValue('--record-stripe-color')).toBe('#E5F1F2');
  branding.alternatingRecordColor = 'red;display:none';
  view.rerender(<RecordStripeStyles />);
  expect(document.documentElement.style.getPropertyValue('--record-stripe-color')).toBe('#F8FAFC');
  view.unmount();
  expect(document.documentElement.dataset.alternatingRecords).toBeUndefined();
});

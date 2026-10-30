import { useLayoutEffect } from 'react';
import { useBranding } from './BrandLogo';
import { DEFAULT_ALTERNATING_RECORD_COLOR } from '@/config/record-stripes';
import './record-stripes.css';

export function RecordStripeStyles() {
  const { alternatingRecordColors, alternatingRecordColor } = useBranding();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.alternatingRecords = alternatingRecordColors ? 'true' : 'false';
    root.style.setProperty('--record-stripe-color', /^#[0-9a-f]{6}$/i.test(alternatingRecordColor ?? '') ? alternatingRecordColor! : DEFAULT_ALTERNATING_RECORD_COLOR);
    return () => { delete root.dataset.alternatingRecords; root.style.removeProperty('--record-stripe-color'); };
  }, [alternatingRecordColors, alternatingRecordColor]);
  return null;
}

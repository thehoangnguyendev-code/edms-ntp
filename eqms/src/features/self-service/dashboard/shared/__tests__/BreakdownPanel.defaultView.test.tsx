import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BreakdownPanel } from '../BreakdownPanel';
import type { DashboardResource } from '../useDashboardResource';
import type { RankedCount } from '../dashboardMetrics';

const resource: DashboardResource<RankedCount[]> = {
  data: [{ key: 'A', name: 'Alpha', shortCode: 'A', value: 3 }, { key: 'B', name: 'Beta', shortCode: 'B', value: 1 }],
  loading: false,
  error: false,
  reload: () => undefined,
};

const panel = (defaultView?: 'bar' | 'donut') => (
  <BreakdownPanel
    title="Things"
    idleSubtitle="Things"
    subtitle={(total) => `${total} things`}
    resource={resource}
    valueLabel="Things"
    centerCaption="Things"
    chartLabel="things"
    emptyLabel="None"
    errorMessage="Failed"
    idPrefix="things"
    defaultView={defaultView}
  />
);

describe('BreakdownPanel defaultView', () => {
  it('opens on the bars unless told otherwise', () => {
    render(panel());
    expect(screen.getByRole('tab', { name: /Bar/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on the donut when that is the default for this card', () => {
    render(panel('donut'));
    expect(screen.getByRole('tab', { name: /Donut/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel').id).toBe('things-panel-donut');
  });
});

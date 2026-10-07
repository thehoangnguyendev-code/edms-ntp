import { describe, expect, it } from 'vitest';
import type { DashboardPendingWorkflowAction } from '@/services/api/dashboard';
import { ageInDays, describeMyWork, fillActivityPeriods, fillAuditDays, formatAge, share, statusSlices } from '../dashboardMetrics';

const NOW = new Date(Date.UTC(2026, 9, 6, 15, 0, 0));

const task = (taskType: 'REVIEW' | 'APPROVAL', id: string): DashboardPendingWorkflowAction => ({
  revisionId: id, documentId: id, documentNumber: id, documentName: id, revisionNumber: '1', status: 'X', taskType, createdAt: '2026-10-01T00:00:00Z',
});

describe('share', () => {
  it('rounds and never divides by zero', () => {
    expect(share(1, 3)).toBe(33);
    expect(share(2, 3)).toBe(67);
    expect(share(5, 0)).toBe(0);
  });
});

describe('fillAuditDays', () => {
  it('puts days without events on the axis as zero and keeps the total', () => {
    const filled = fillAuditDays([{ label: '01 Oct', value: 4 }, { label: '06 Oct', value: 7 }], NOW);
    expect(filled).toHaveLength(31);
    expect(filled[0].label).toBe('06 Sep');
    expect(filled[30].label).toBe('06 Oct');
    expect(filled.find((point) => point.label === '03 Oct')?.value).toBe(0);
    expect(filled.reduce((sum, point) => sum + point.value, 0)).toBe(11);
  });

  it('returns the series untouched when a label cannot be placed', () => {
    const odd = [{ label: '2026-10-01', value: 4 }];
    expect(fillAuditDays(odd, NOW)).toBe(odd);
  });
});

describe('fillActivityPeriods', () => {
  it('fills months, quarters and years in order', () => {
    const months = fillActivityPeriods([{ label: 'Jan 2026', value: 2 }], 'month', NOW);
    expect(months[0].label).toBe('Oct 2025');
    expect(months.at(-1)?.label).toBe('Oct 2026');
    expect(months.find((point) => point.label === 'Jan 2026')?.value).toBe(2);

    const quarters = fillActivityPeriods([{ label: '3 2026', value: 5 }], 'quarter', NOW);
    expect(quarters.at(-1)?.label).toBe('4 2026');
    expect(quarters.find((point) => point.label === '3 2026')?.value).toBe(5);

    const years = fillActivityPeriods([{ label: '2024', value: 9 }], 'year', NOW);
    expect(years.map((point) => point.label)).toEqual(['2021', '2022', '2023', '2024', '2025', '2026']);
    expect(years[3].value).toBe(9);
  });
});

describe('describeMyWork', () => {
  it('trusts the summary total and only splits when every task is loaded', () => {
    const capped = describeMyWork(35, Array.from({ length: 20 }, (_, i) => task('REVIEW', String(i))));
    expect(capped).toMatchObject({ total: 35, shown: 20, complete: false, review: null, approval: null });

    const complete = describeMyWork(3, [task('REVIEW', 'a'), task('APPROVAL', 'b'), task('APPROVAL', 'c')]);
    expect(complete).toMatchObject({ total: 3, complete: true, review: 1, approval: 2 });
  });

  it('never reports fewer than the tasks already loaded', () => {
    expect(describeMyWork(undefined, [task('REVIEW', 'a')]).total).toBe(1);
  });
});

describe('statusSlices', () => {
  it('adds an OTHER slice only when the total exceeds the listed statuses', () => {
    expect(statusSlices(10, { A: 4, B: 3 }, ['A', 'B', 'C'])).toEqual([
      { key: 'A', value: 4 }, { key: 'B', value: 3 }, { key: 'C', value: 0 }, { key: 'OTHER', value: 3 },
    ]);
    expect(statusSlices(7, { A: 4, B: 3 }, ['A', 'B'])).toHaveLength(2);
  });
});

describe('age', () => {
  it('counts whole days and formats them', () => {
    expect(ageInDays('2026-10-04T00:00:00Z', NOW)).toBe(2);
    expect(ageInDays('2030-01-01T00:00:00Z', NOW)).toBe(0);
    expect(ageInDays('nope', NOW)).toBeNull();
    expect([formatAge(0), formatAge(1), formatAge(5), formatAge(null)]).toEqual(['today', '1 day ago', '5 days ago', '-']);
  });
});

describe('period labels', () => {
  it('expands for tooltips and shortens for axes', async () => {
    const { longPeriodLabel, shortPeriodLabel } = await import('../dashboardMetrics');
    expect(longPeriodLabel('Oct 2025')).toBe('October, 2025');
    expect(longPeriodLabel('3 2026')).toBe('Q3, 2026');
    expect(longPeriodLabel('06 Sep')).toBe('06 Sep');
    expect(shortPeriodLabel('Oct 2025')).toBe('Oct');
    expect(shortPeriodLabel('3 2026')).toBe('Q3');
    expect(shortPeriodLabel('2024')).toBe('2024');
  });
});

describe('groupTail', () => {
  const row = (key: string, value: number) => ({ key, name: `Type ${key}`, shortCode: key, value });

  it('keeps short lists as they are', async () => {
    const { groupTail } = await import('../dashboardMetrics');
    const rows = [row('A', 3), row('B', 2)];
    expect(groupTail(rows, 3)).toBe(rows);
  });

  it('folds the smallest rows into one Other row without changing the total', async () => {
    const { groupTail } = await import('../dashboardMetrics');
    const rows = [row('A', 10), row('B', 7), row('C', 5), row('D', 2), row('E', 1)];
    const grouped = groupTail(rows, 3);
    expect(grouped.map((r) => [r.key, r.value])).toEqual([['A', 10], ['B', 7], ['OTHER', 8]]);
    expect(grouped[2].name).toBe('Other (3 types)');
    expect(grouped.reduce((sum, r) => sum + r.value, 0)).toBe(rows.reduce((sum, r) => sum + r.value, 0));
  });
});

describe('formatUptime and formatBytes', () => {
  it('shows the two largest units of an uptime', async () => {
    const { formatUptime } = await import('../dashboardMetrics');
    const minute = 60_000;
    expect([0, 30_000, 42 * minute, 5 * 60 * minute + 12 * minute, (3 * 24 * 60 + 4 * 60 + 9) * minute, -5].map(formatUptime))
      .toEqual(['<1m', '<1m', '42m', '5h 12m', '3d 4h', '<1m']);
  });

  it('uses binary units and drops a useless decimal', async () => {
    const { formatBytes } = await import('../dashboardMetrics');
    expect([0, 1023, 1024, 1536, 512 * 1024 * 1024, 1024 ** 3, 1.5 * 1024 ** 3].map(formatBytes))
      .toEqual(['0 B', '1023 B', '1 KB', '1.5 KB', '512 MB', '1 GB', '1.5 GB']);
  });
});

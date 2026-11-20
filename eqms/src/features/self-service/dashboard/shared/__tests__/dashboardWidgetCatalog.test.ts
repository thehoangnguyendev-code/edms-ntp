import { expect, it } from 'vitest';
import { DASHBOARD_WIDGET_INFO, DASHBOARD_WIDGETS, WIDGET_MODULES, expandDashboardWidgets } from '../dashboardWidgetCatalog';

it('expands old groups in place while preserving hidden state and explicit child preferences', () => {
  const child = { id: 'active-sessions', visible: true, width: 'full' as const };
  const old = { id: 'system-monitoring', visible: false, width: 'full' as const };
  const result = expandDashboardWidgets([old, child]);
  expect(result).toHaveLength(9);
  expect(result.at(-1)).toEqual(child);
  expect(result.slice(0, -1).every(item => !item.visible && item.width === 'half')).toBe(true);
  expect(result.some(item => item.id === 'system-monitoring')).toBe(false);
  expect(new Set(result.map(item => item.id)).size).toBe(result.length);
});

it('has an independent catalogue that fits the server layout limit and retains unknown preferences', () => {
  expect(DASHBOARD_WIDGETS).toHaveLength(54);
  expect(new Set(DASHBOARD_WIDGETS.map(([id]) => id)).size).toBe(54);
  const unknown = { id: 'future-module', visible: false, width: 'half' as const };
  expect(expandDashboardWidgets([unknown])).toEqual([unknown]);
});

it('describes every card of the catalogue for the widget library, in a known module', () => {
  for (const [id] of DASHBOARD_WIDGETS) {
    expect(DASHBOARD_WIDGET_INFO[id], id).toBeDefined();
    expect(WIDGET_MODULES).toContain(DASHBOARD_WIDGET_INFO[id].module);
  }
  expect(Object.keys(DASHBOARD_WIDGET_INFO).sort()).toEqual(DASHBOARD_WIDGETS.map(([id]) => id).sort());
});

/**
 * Breadcrumb configurations — re-exported from modular files.
 *
 * Modules:
 *   breadcrumbs/core.ts      — system-wide (audit, report, deviations, tasks…)
 *   breadcrumbs/documents.ts — Document Control module
 *   breadcrumbs/training.ts  — Training Management module
 *   breadcrumbs/settings.ts  — Settings / System Administration module
 */
export * from './breadcrumbs/index';

// Legacy default export kept for backward compatibility
import * as all from './breadcrumbs/index';
export default all;

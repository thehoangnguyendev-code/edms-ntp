import React, { lazy, Suspense } from 'react';
import { SectionLoading } from '@/components/ui/loading/Loading';
import { CONFIGURATION_AUDIT_ENTITY_ID, type ConfigurationHistoryPage, CONFIGURATION_HISTORY_TYPE } from './pageTabs';

const AuditTrailTab = lazy(() =>
  import('@/features/documents/shared/components/AuditTrailTab').then((m) => ({ default: m.AuditTrailTab })),
);

/**
 * The History tab of a page of Configuration: who saved which settings of the page, when, and what each setting was before and after. It is the Audit Trail
 * of that page (each save writes one record for each page it changed), read with the same rule as every other Audit Trail tab: whoever may open Configuration may read it.
 */
export const ConfigHistory: React.FC<{ page: ConfigurationHistoryPage }> = ({ page }) => (
  <div className="space-y-3">
    <div>
      <h3 className="text-sm font-semibold text-slate-900">History</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Every save that changed a setting of this page, with the old and the new value of each setting. Open a record for its full list.
      </p>
    </div>
    <Suspense fallback={<SectionLoading />}>
      <AuditTrailTab entityId={CONFIGURATION_AUDIT_ENTITY_ID} entityType={CONFIGURATION_HISTORY_TYPE[page]} emptyMessage="No setting of this page has been changed and saved yet." />
    </Suspense>
  </div>
);

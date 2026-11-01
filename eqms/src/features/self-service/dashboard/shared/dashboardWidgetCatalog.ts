/** Shared personal/role layout catalogue. IDs never grant access to widget data. */
export const DASHBOARD_WIDGETS: Array<[string, string, 'half' | 'full']> = [
  ['admin-total-users', 'Total users', 'half'],
  ['admin-total-documents', 'Total documents', 'half'],
  ['admin-revisions-in-flight', 'Revisions in flight', 'half'],
  ['admin-audit-events', 'Audit events (30 days)', 'half'],
  ['user-pending-actions', 'My pending actions', 'half'],
  ['user-pending-review', 'Pending review', 'half'],
  ['user-pending-approval', 'Pending approval', 'half'],
  ['user-effective-documents', 'Effective documents', 'half'],
  ['user-pending-training', 'Pending training', 'half'],
  ['system-uptime', 'Server uptime', 'half'],
  ['database-connections', 'Database connections', 'half'],
  ['active-sessions', 'Active sessions', 'half'],
  ['failed-logins', 'Failed logins (24 h)', 'half'],
  ['users-by-status', 'Users by status', 'half'],
  ['compliance-queues', 'Compliance queues', 'half'],
  ['system-runtime', 'System runtime', 'half'],
  ['locked-accounts', 'Locked accounts', 'half'],
  ['electronic-signatures', 'E-signatures (30 days)', 'half'],
  ['document-activity', 'Document activity', 'half'],
  ['workflow-pipeline', 'Workflow pipeline', 'half'],
  ['my-documents', 'My documents', 'half'],
  ['effective-by-type', 'Effective documents by type', 'half'],
  ['audit-activity', 'Audit activity', 'half'],
  ['revision-pipeline', 'Revision pipeline', 'half'],
  ['documents-by-status', 'Documents by status', 'half'],
  ['pending-work', 'Pending work', 'half'],
];

const legacyGroups: Record<string, readonly string[]> = {
  'admin-kpis': ['admin-total-users', 'admin-total-documents', 'admin-revisions-in-flight', 'admin-audit-events'],
  'user-kpis': ['user-pending-actions', 'user-pending-review', 'user-pending-approval', 'user-effective-documents', 'user-pending-training'],
  'system-monitoring': ['system-uptime', 'database-connections', 'active-sessions', 'failed-logins', 'users-by-status', 'compliance-queues', 'system-runtime', 'locked-accounts', 'electronic-signatures'],
};

/** Expand legacy groups without overwriting a user's explicit child settings. No DB data is discarded. */
export function expandDashboardWidgets(items: Array<{ id: string; visible: boolean; width: 'half' | 'full' }>) {
  const explicit = new Set(items.map(item => item.id));
  return items.flatMap(item => legacyGroups[item.id]
    ? legacyGroups[item.id].filter(id => !explicit.has(id)).map(id => ({ ...item, id, width: 'half' as const }))
    : [item]);
}

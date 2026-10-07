import { usePermissions } from '@/hooks/usePermissions';
import { AdminDashboardView } from './admin/AdminDashboardView';
import { UserDashboard } from './user/UserDashboard';

export function DashboardView() {
  const { hasPermission } = usePermissions();
  return hasPermission('dashboard.admin.view') ? <AdminDashboardView /> : <UserDashboard />;
}

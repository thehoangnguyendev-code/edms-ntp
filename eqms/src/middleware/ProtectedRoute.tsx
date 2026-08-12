import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';
import { useAuth } from '@/contexts/AuthContext';
import { FullPageLoading } from '@/components/ui/loading/Loading';
import { canBypassMaintenance } from '@/utils/maintenance';
import { resolvePermissionAliasCodes } from '@/features/settings/permissionCatalog';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children, 
  requiredPermissions,
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return <FullPageLoading text="Authenticating..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Global MFA enforcement is completed immediately after the password check.
  // Do not let an enrolled session reach business routes until setup is verified.
  if (user?.mfaSetupRequired) {
    return <Navigate to={ROUTES.MFA_SETUP} replace />;
  }

  if (user?.maintenanceMode && !canBypassMaintenance(user.permissions)) {
    return <Navigate to={ROUTES.MAINTENANCE} replace />;
  }

  const normalizedPermissions = new Set((user?.permissions ?? []).map((value) => value.trim().toUpperCase()));
  const hasRequiredPermission =
    !requiredPermissions?.length ||
    requiredPermissions.some((permissionCode) =>
      resolvePermissionAliasCodes(permissionCode).some((code) => normalizedPermissions.has(code.trim().toUpperCase()))
    );

  if (user && !hasRequiredPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-600 mt-2">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

import React, { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route } from 'react-router-dom';
import { LoadingFallback } from './LoadingFallback';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

const PermissionSetsView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.PermissionSetsView })));
const PermissionSetDetailView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.PermissionSetDetailView })));
const PermissionSetFormView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.PermissionSetFormView })));
const AccessProfileListView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.AccessProfileListView })));
const AccessProfileDetailView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.AccessProfileDetailView })));
const RoleSetupWizardView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.RoleSetupWizardView })));
const LifecyclePoliciesView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.LifecyclePoliciesView })));
const AuthorizationDiagnosticsView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.AuthorizationDiagnosticsView })));
const LifecyclePolicyFormView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.LifecyclePolicyFormView })));
const WorkflowPolicyDuplicateView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.WorkflowPolicyDuplicateView })));
const WorkflowRolesView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.WorkflowRolesView })));
const ObjectAccessRulesView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.ObjectAccessRulesView })));
const ObjectAccessRuleFormView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.ObjectAccessRuleFormView })));
const SegregationOfDutiesView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.SegregationOfDutiesView })));
const SodConstraintFormView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.SodConstraintFormView })));
const AccessReviewView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.AccessReviewView })));
const AccessReviewCampaignDetailView = lazy(() => import('@/features/security-authorization').then(m => ({ default: m.AccessReviewCampaignDetailView })));

const SecurityGuard: React.FC<React.PropsWithChildren<{ permission: string }>> = ({ permission, children }) => (
  <ProtectedRoute requiredPermissions={[permission]}>{children}</ProtectedRoute>
);

export function securityRoutes() {
  return (
    <Route
      path="security"
      element={
        <ProtectedRoute
          requiredPermissions={[
            "settings.user.view",
            "security.access_profiles.view",
            "security.permission_sets.view",
            "security.workflow_authorization.view",
            "security.object_rules.view",
            "security.sod.view",
            "security.access_review.view",
          ]}
        >
          <Outlet />
        </ProtectedRoute>
      }
    >
      <Route path="permission-sets">
        <Route index element={<SecurityGuard permission="security.permission_sets.view"><Suspense fallback={<LoadingFallback />}><PermissionSetsView /></Suspense></SecurityGuard>} />
        <Route path="new" element={<SecurityGuard permission="security.permission_sets.update"><Suspense fallback={<LoadingFallback />}><PermissionSetFormView /></Suspense></SecurityGuard>} />
        <Route path=":id/edit" element={<SecurityGuard permission="security.permission_sets.update"><Suspense fallback={<LoadingFallback />}><PermissionSetFormView /></Suspense></SecurityGuard>} />
        <Route path=":id" element={<SecurityGuard permission="security.permission_sets.view"><Suspense fallback={<LoadingFallback />}><PermissionSetDetailView /></Suspense></SecurityGuard>} />
      </Route>
      <Route path="access-profiles">
        <Route index element={<SecurityGuard permission="security.access_profiles.view"><Suspense fallback={<LoadingFallback />}><AccessProfileListView /></Suspense></SecurityGuard>} />
        <Route path="new" element={<SecurityGuard permission="security.access_profiles.update"><Suspense fallback={<LoadingFallback />}><AccessProfileDetailView /></Suspense></SecurityGuard>} />
        <Route path="wizard" element={<SecurityGuard permission="security.access_profiles.update"><SecurityGuard permission="security.access_profiles.assign"><Suspense fallback={<LoadingFallback />}><RoleSetupWizardView /></Suspense></SecurityGuard></SecurityGuard>} />
        <Route path=":id/edit" element={<SecurityGuard permission="security.access_profiles.update"><Suspense fallback={<LoadingFallback />}><AccessProfileDetailView /></Suspense></SecurityGuard>} />
        <Route path=":id" element={<SecurityGuard permission="security.access_profiles.view"><Suspense fallback={<LoadingFallback />}><AccessProfileDetailView /></Suspense></SecurityGuard>} />
      </Route>
      <Route path="lifecycle-policies">
        <Route index element={<SecurityGuard permission="security.workflow_authorization.view"><Suspense fallback={<LoadingFallback />}><LifecyclePoliciesView /></Suspense></SecurityGuard>} />
        <Route path="transitions" element={<Navigate to="/security/lifecycle-policies?tab=transitions" replace />} />
        <Route path="capabilities" element={<Navigate to="/security/lifecycle-policies?tab=capabilities" replace />} />
        <Route path="roles" element={<Navigate to="/security/advanced/workflow-roles" replace />} />
        <Route path="state-policies">
          <Route index element={<Navigate to="/security/lifecycle-policies?tab=capabilities" replace />} />
          <Route path="new" element={<SecurityGuard permission="security.workflow_authorization.manage"><Suspense fallback={<LoadingFallback />}><LifecyclePolicyFormView /></Suspense></SecurityGuard>} />
          <Route path=":id/edit" element={<SecurityGuard permission="security.workflow_authorization.manage"><Suspense fallback={<LoadingFallback />}><LifecyclePolicyFormView /></Suspense></SecurityGuard>} />
        </Route>
        <Route path="new" element={<SecurityGuard permission="security.workflow_authorization.manage"><Suspense fallback={<LoadingFallback />}><LifecyclePolicyFormView /></Suspense></SecurityGuard>} />
        <Route path=":id/edit" element={<SecurityGuard permission="security.workflow_authorization.manage"><Suspense fallback={<LoadingFallback />}><LifecyclePolicyFormView /></Suspense></SecurityGuard>} />
        <Route path=":id/duplicate" element={<SecurityGuard permission="security.workflow_authorization.manage"><Suspense fallback={<LoadingFallback />}><WorkflowPolicyDuplicateView /></Suspense></SecurityGuard>} />
        <Route path=":id" element={<Navigate to="/security/lifecycle-policies?tab=transitions" replace />} />
      </Route>
      {/* Backward-compat redirect: old bookmarks/shared links to the pre-merge path */}
      <Route path="workflow-authorization/*" element={<Navigate to="/security/lifecycle-policies?tab=transitions" replace />} />
      <Route path="authorization-diagnostics" element={<SecurityGuard permission="security.workflow_authorization.view"><Suspense fallback={<LoadingFallback />}><AuthorizationDiagnosticsView /></Suspense></SecurityGuard>} />
      <Route path="advanced/workflow-roles" element={<SecurityGuard permission="security.workflow_authorization.view"><Suspense fallback={<LoadingFallback />}><WorkflowRolesView /></Suspense></SecurityGuard>} />
      <Route path="object-rules">
        <Route index element={<SecurityGuard permission="security.object_rules.view"><Suspense fallback={<LoadingFallback />}><ObjectAccessRulesView /></Suspense></SecurityGuard>} />
        <Route path="new" element={<SecurityGuard permission="security.object_rules.manage"><Suspense fallback={<LoadingFallback />}><ObjectAccessRuleFormView /></Suspense></SecurityGuard>} />
        <Route path=":id/edit" element={<SecurityGuard permission="security.object_rules.manage"><Suspense fallback={<LoadingFallback />}><ObjectAccessRuleFormView /></Suspense></SecurityGuard>} />
      </Route>
      <Route path="sod">
        <Route index element={<SecurityGuard permission="security.sod.view"><Suspense fallback={<LoadingFallback />}><SegregationOfDutiesView /></Suspense></SecurityGuard>} />
        <Route path="new" element={<SecurityGuard permission="security.sod.manage"><Suspense fallback={<LoadingFallback />}><SodConstraintFormView /></Suspense></SecurityGuard>} />
        <Route path=":id/edit" element={<SecurityGuard permission="security.sod.manage"><Suspense fallback={<LoadingFallback />}><SodConstraintFormView /></Suspense></SecurityGuard>} />
      </Route>
      <Route path="access-review">
        <Route index element={<SecurityGuard permission="security.access_review.view"><Suspense fallback={<LoadingFallback />}><AccessReviewView /></Suspense></SecurityGuard>} />
        <Route path="new" element={<Navigate to="/security/access-review" replace />} />
        <Route path=":id" element={<SecurityGuard permission="security.access_review.view"><Suspense fallback={<LoadingFallback />}><AccessReviewCampaignDetailView /></Suspense></SecurityGuard>} />
      </Route>
    </Route>
  );
}

import React, { Suspense, lazy } from 'react';
import { Route, Outlet, useLocation } from 'react-router-dom';
import { NavigateFunction } from 'react-router-dom';
import { ROUTES } from '../routes.constants';
import { LoadingFallback } from './LoadingFallback';
import { navigateBack } from '../navigation/backNavigation';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const ProfileView = lazy(() => import('@/features/settings').then(m => ({ default: m.ProfileView })));
const DataPrivacyNoticeView = lazy(() => import('@/features/settings').then(m => ({ default: m.DataPrivacyNoticeView })));
const UserManagementView = lazy(() => import('@/features/settings').then(m => ({ default: m.UserManagementView })));
const AddUserView = lazy(() => import('@/features/settings').then(m => ({ default: m.AddUserView })));
const UserProfileView = lazy(() => import('@/features/settings').then(m => ({ default: m.UserProfileView })));
const DictionariesView = lazy(() => import('@/features/settings').then(m => ({ default: m.DictionariesView })));
const ConfigurationView = lazy(() => import('@/features/settings').then(m => ({ default: m.ConfigurationView })));
const EmailTemplatesView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplatesView })));
const EmailTemplateCreateView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplateCreateView })));
const EmailTemplateEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplateEditView })));
const EmailTemplatePreviewView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplatePreviewView })));
const PublishingTemplatesView = lazy(() => import('@/features/settings').then(m => ({ default: m.PublishingTemplatesView })));
const PublishingTemplateEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.PublishingTemplateEditorView })));
const ElectronicSignatureSettingsView = lazy(() => import('@/features/settings').then(m => ({ default: m.ElectronicSignatureSettingsView })));
const ControlledCopiesPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.ControlledCopiesPolicyView })));
const NotificationPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationPolicyView })));
const NotificationPolicyDetailView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationPolicyDetailView })));
const NotificationPolicyCreateView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationPolicyCreateView })));
const SystemInformationView = lazy(() => import('@/features/settings').then(m => ({ default: m.SystemInformationView })));
const ReportConfigurationView = lazy(() => import('@/features/settings').then(m => ({ default: m.ReportConfigurationView })));
const ReportDefinitionEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.ReportDefinitionEditView })));
const PreferencesView = lazy(() => import('@/features/preferences').then(m => ({ default: m.PreferencesView })));

const ProfileViewWrapper = ({ navigate }: { navigate: NavigateFunction }) => {
  const location = useLocation();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProfileView onBack={() => navigateBack(navigate, location.state, ROUTES.DASHBOARD)} />
    </Suspense>
  );
};

// ==================== SETTINGS ROUTES ====================
export function settingsRoutes(navigate: NavigateFunction) {
  return (
    <>
      {/* ===== SETTINGS ===== */}
      <Route
        path="settings"
        element={
          <ProtectedRoute
            requiredPermissions={[
              "settings.user.view",
              "settings.configuration.view",
              "settings.controlled_copy_policy.view",
              "settings.publishing_template.view",
              "documents.admin.view",
              "reports.definition.view",
            ]}
          >
            <Outlet />
          </ProtectedRoute>
        }
        >
        <Route path="users">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><UserManagementView /></Suspense></ProtectedRoute>} />
          <Route path="add" element={<ProtectedRoute requiredPermissions={["settings.user.create"]}><Suspense fallback={<LoadingFallback />}><AddUserView /></Suspense></ProtectedRoute>} />
          <Route path="profile/:userId" element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><UserProfileView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="system-info" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><SystemInformationView /></Suspense></ProtectedRoute>} />
        <Route path="dictionaries" element={<ProtectedRoute requiredPermissions={["settings.dictionary.view"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
        <Route path="configuration" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
        <Route path="report-configuration" element={<ProtectedRoute requiredPermissions={["reports.definition.view", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ReportConfigurationView /></Suspense></ProtectedRoute>} />
        <Route path="report-configuration/:code" element={<ProtectedRoute requiredPermissions={["reports.definition.view", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ReportDefinitionEditView /></Suspense></ProtectedRoute>} />
        <Route path="electronic-signature" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ElectronicSignatureSettingsView /></Suspense></ProtectedRoute>} />
        <Route path="email-templates">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><EmailTemplatesView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.configuration.edit"]}><Suspense fallback={<LoadingFallback />}><EmailTemplateCreateView /></Suspense></ProtectedRoute>} />
          <Route path="edit/:id" element={<ProtectedRoute requiredPermissions={["settings.configuration.edit"]}><Suspense fallback={<LoadingFallback />}><EmailTemplateEditView /></Suspense></ProtectedRoute>} />
          <Route path="preview" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><EmailTemplatePreviewView /></Suspense></ProtectedRoute>} />
          <Route path="preview/:id" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><EmailTemplatePreviewView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="publishing-templates">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.publishing_template.view", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><PublishingTemplatesView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.publishing_template.manage", "settings.configuration.edit"]}><Suspense fallback={<LoadingFallback />}><PublishingTemplateEditorView /></Suspense></ProtectedRoute>} />
          <Route path="edit/:id" element={<ProtectedRoute requiredPermissions={["settings.publishing_template.manage", "settings.configuration.edit"]}><Suspense fallback={<LoadingFallback />}><PublishingTemplateEditorView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="controlled-copy-policy" element={<ProtectedRoute requiredPermissions={["settings.controlled_copy_policy.view"]}><Suspense fallback={<LoadingFallback />}><ControlledCopiesPolicyView /></Suspense></ProtectedRoute>} />
        <Route path="notification-policy">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyCreateView /></Suspense></ProtectedRoute>} />
          <Route path=":eventCode" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyDetailView mode="view" /></Suspense></ProtectedRoute>} />
          <Route path=":eventCode/edit" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyDetailView mode="edit" /></Suspense></ProtectedRoute>} />
        </Route>
      </Route>

      {/* ===== PREFERENCES ===== */}
      <Route path="preferences" element={<ProtectedRoute requiredPermissions={["preferences.module.view"]}><Suspense fallback={<LoadingFallback />}><PreferencesView /></Suspense></ProtectedRoute>} />

      {/* ===== PROFILE ===== */}
      <Route path="profile" element={<ProfileViewWrapper navigate={navigate} />} />
      <Route path="profile/data-privacy" element={<Suspense fallback={<LoadingFallback />}><DataPrivacyNoticeView /></Suspense>} />
    </>
  );
}

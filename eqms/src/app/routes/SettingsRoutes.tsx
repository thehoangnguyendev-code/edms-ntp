import React, { Suspense, lazy } from 'react';
import { Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { NavigateFunction } from 'react-router-dom';
import { ROUTES } from '../routes.constants';
import { LoadingFallback } from './LoadingFallback';
import { navigateBack } from '../navigation/backNavigation';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';
import { LegacyReportTemplateRedirect } from './ReportTemplateRedirects';
import { ConfigurationIndexRedirect } from '@/features/settings/configuration/ConfigurationIndexRedirect';

// ==================== LAZY LOADED ====================
const ProfileView = lazy(() => import('@/features/settings').then(m => ({ default: m.ProfileView })));
const DataPrivacyNoticeView = lazy(() => import('@/features/settings').then(m => ({ default: m.DataPrivacyNoticeView })));
const UserManagementView = lazy(() => import('@/features/settings').then(m => ({ default: m.UserManagementView })));
const AddUserView = lazy(() => import('@/features/settings').then(m => ({ default: m.AddUserView })));
const UserProfileView = lazy(() => import('@/features/settings').then(m => ({ default: m.UserProfileView })));
const LoggedInUsersView = lazy(() => import('@/features/settings').then(m => ({ default: m.LoggedInUsersView })));
const AccessExplorerView = lazy(() => import('@/features/settings').then(m => ({ default: m.AccessExplorerView })));
const TimeLimitedUserListView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserListView })));
const TimeLimitedUserCreateView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserCreateView })));
const TimeLimitedUserDetailView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserDetailView })));
const TimeLimitedUserEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserEditView })));
const DictionariesView = lazy(() => import('@/features/settings').then(m => ({ default: m.DictionariesView })));
const EducationDegreeLevelsView = lazy(() => import('@/features/settings').then(m => ({ default: m.EducationDegreeLevelsView })));
const EducationSchoolsView = lazy(() => import('@/features/settings').then(m => ({ default: m.EducationSchoolsView })));
const EducationSchoolEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.EducationSchoolEditorView })));
const NotificationsView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationsView })));
const NotificationEventView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationEventView })));
const EmailMessageEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailMessageEditView })));
const EmailDesignView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailDesignView })));
const InAppDesignView = lazy(() => import('@/features/settings').then(m => ({ default: m.InAppDesignView })));
const ConfigurationView = lazy(() => import('@/features/settings/configuration/ConfigurationView').then(m => ({ default: m.ConfigurationView })));
const ObjectNumberingView = lazy(() => import('@/features/settings/object-numbering/ObjectNumberingView'));
const ElectronicSignatureSettingsView = lazy(() => import('@/features/settings').then(m => ({ default: m.ElectronicSignatureSettingsView })));
const SystemInformationView = lazy(() => import('@/features/settings').then(m => ({ default: m.SystemInformationView })));
const ReportTypesView = lazy(() => import('@/features/report/types/ReportTypesView').then(m => ({ default: m.ReportTypesView })));
const ReportTypeDetailView = lazy(() => import('@/features/report/types/ReportTypeDetailView').then(m => ({ default: m.ReportTypeDetailView })));
const ReportNameFormatsView = lazy(() => import('@/features/report/name-formats/ReportNameFormatsView').then(m => ({ default: m.ReportNameFormatsView })));
const ReportAppearanceListView = lazy(() => import('@/features/report/appearance/ReportAppearanceListView').then(m => ({ default: m.ReportAppearanceListView })));
const ReportAppearanceView = lazy(() => import('@/features/report/appearance/ReportAppearanceView').then(m => ({ default: m.ReportAppearanceView })));
const ReportPropertiesView = lazy(() => import('@/features/report/properties/ReportPropertiesView').then(m => ({ default: m.ReportPropertiesView })));
const ReportNameFormatEditView = lazy(() => import('@/features/report/name-formats/ReportNameFormatEditView').then(m => ({ default: m.ReportNameFormatEditView })));
const PreferencesView = lazy(() => import('@/features/preferences').then(m => ({ default: m.PreferencesView })));

// Document Administration (moved here from Document Control -- now under System Administration;
// screens live in the settings feature folder, URLs are unchanged)
const DocumentPropertiesView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentPropertiesView })));
const DocumentNameFormatsView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentNameFormatsView })));
const DocumentNameFormatEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentNameFormatEditorView })));
const DocumentComponentsView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentComponentsView })));
const DocumentComponentEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentComponentEditorView })));
const DocumentTypesAdminView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentTypesView })));
const DocumentSubTypesAdminView = lazy(() => import('@/features/settings').then(m => ({ default: m.DocumentSubTypesView })));
const KnowledgeCategoriesView = lazy(() => import('@/features/settings').then(m => ({ default: m.KnowledgeCategoriesView })));
const KnowledgeCategoryEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.KnowledgeCategoryEditorView })));
const KnowledgeComponentsView = lazy(() => import('@/features/settings').then(m => ({ default: m.KnowledgeComponentsView })));
const KnowledgeComponentEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.KnowledgeComponentEditorView })));
const PublishingTemplatesView = lazy(() => import('@/features/settings').then(m => ({ default: m.PublishingTemplatesView })));
const PublishingTemplateEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.PublishingTemplateEditorView })));
const ControlledCopiesPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.ControlledCopiesPolicyView })));
const UncontrolledCopyPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.UncontrolledCopyPolicyView })));

// Training Administration -- coming soon placeholders, one per sub-screen
// Backup & Restore Administration -- one screen per sub-menu (UI preview)
const BackupPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.BackupPolicyView })));
const BackupPolicyDetailView = lazy(() => import('@/features/settings').then(m => ({ default: m.BackupPolicyDetailView })));
const NewBackupPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.NewBackupPolicyView })));
const BackupStorageView = lazy(() => import('@/features/settings').then(m => ({ default: m.BackupStorageView })));
const DisasterRecoveryPlanView = lazy(() => import('@/features/settings').then(m => ({ default: m.DisasterRecoveryPlanView })));
const AnnouncementsView = lazy(() => import('@/features/settings').then(m => ({ default: m.AnnouncementsView })));
const AnnouncementEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.AnnouncementEditorView })));
const BackupAlertsView = lazy(() => import('@/features/settings').then(m => ({ default: m.BackupAlertsView })));
const TrainingNotificationsView = lazy(() => import('@/features/settings/training-administration/notifications/TrainingNotificationsView').then(m => ({ default: m.TrainingNotificationsView })));
const TrainingAnnexView = lazy(() => import('@/features/settings/training-administration/annex/TrainingAnnexView').then(m => ({ default: m.TrainingAnnexView })));
const TrainingAnnexDetailView = lazy(() => import('@/features/settings/training-administration/annex/TrainingAnnexDetailView').then(m => ({ default: m.TrainingAnnexDetailView })));
const TrainingVendorsView = lazy(() => import('@/features/settings/training-administration/vendors/TrainingVendorsView').then(m => ({ default: m.TrainingVendorsView })));
const TrainingCodeRulesView = lazy(() => import('@/features/settings/training-administration/code-rules/TrainingCodeRulesView').then(m => ({ default: m.TrainingCodeRulesView })));
const TrainingJobRolesView = lazy(() => import('@/features/settings/training-administration/job-roles/TrainingJobRolesView').then(m => ({ default: m.TrainingJobRolesView })));
const TrainingPropertiesView = lazy(() => import('@/features/settings').then(m => ({ default: m.TrainingPropertiesView })));

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
              "settings.config_general.view",
              "settings.config_navigation_labels.view",
              "settings.config_security.view",
              "settings.config_notifications.view",
              "settings.config_integrations.view",
              "settings.config_preview_file.view",
              "settings.config_image_watermark.view",
              "settings.config_features.view",
              "settings.electronic_signature.view",
              "settings.system_info.view",
              "settings.business_unit.view",
              "settings.department.view",
              "settings.position.view",
              "settings.storage_location.view",
              "settings.retention_policy.view",
              "settings.education.degree_level.view",
              "settings.education.school.view",
              "settings.email_template.view",
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
          <Route path="access-explorer" element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><AccessExplorerView /></Suspense></ProtectedRoute>} />
          <Route path="logged-in" element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><LoggedInUsersView /></Suspense></ProtectedRoute>} />
          <Route path="time-limited">
            <Route index element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserListView /></Suspense></ProtectedRoute>} />
            <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.user.edit"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserCreateView /></Suspense></ProtectedRoute>} />
            <Route path=":id" element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserDetailView /></Suspense></ProtectedRoute>} />
            <Route path=":id/edit" element={<ProtectedRoute requiredPermissions={["settings.user.edit"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserEditView /></Suspense></ProtectedRoute>} />
          </Route>
        </Route>
        <Route path="system-info" element={<ProtectedRoute requiredPermissions={["settings.system_info.view"]}><Suspense fallback={<LoadingFallback />}><SystemInformationView /></Suspense></ProtectedRoute>} />
        <Route path="dictionaries">
          <Route index element={<Navigate to="business-units" replace />} />
          <Route path="business-units" element={<ProtectedRoute requiredPermissions={["settings.business_unit.view", "settings.business_unit.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="departments" element={<ProtectedRoute requiredPermissions={["settings.department.view", "settings.department.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="positions" element={<ProtectedRoute requiredPermissions={["settings.position.view", "settings.position.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="storage-locations" element={<ProtectedRoute requiredPermissions={["settings.storage_location.view", "settings.storage_location.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="retention-policies" element={<ProtectedRoute requiredPermissions={["settings.retention_policy.view", "settings.retention_policy.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="education">
          <Route index element={<Navigate to="degree-levels" replace />} />
          <Route path="degree-levels" element={<ProtectedRoute requiredPermissions={["settings.education.degree_level.view", "settings.education.degree_level.manage"]}><Suspense fallback={<LoadingFallback />}><EducationDegreeLevelsView /></Suspense></ProtectedRoute>} />
          <Route path="schools">
            <Route index element={<ProtectedRoute requiredPermissions={["settings.education.school.view", "settings.education.school.manage"]}><Suspense fallback={<LoadingFallback />}><EducationSchoolsView /></Suspense></ProtectedRoute>} />
            <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.education.school.manage"]}><Suspense fallback={<LoadingFallback />}><EducationSchoolEditorView /></Suspense></ProtectedRoute>} />
            <Route path=":id/edit" element={<ProtectedRoute requiredPermissions={["settings.education.school.manage"]}><Suspense fallback={<LoadingFallback />}><EducationSchoolEditorView /></Suspense></ProtectedRoute>} />
          </Route>
        </Route>
        {/* Configuration is a group: each page is its own address (it used to be one screen with tabs, ?tab=...). The bare address and an old ?tab= link lead to the page they meant. */}
        <Route path="configuration">
          <Route index element={<ConfigurationIndexRedirect />} />
          <Route path="general" element={<ProtectedRoute requiredPermissions={["settings.config_general.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="navigation-labels" element={<ProtectedRoute requiredPermissions={["settings.config_navigation_labels.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="security" element={<ProtectedRoute requiredPermissions={["settings.config_security.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="notifications" element={<ProtectedRoute requiredPermissions={["settings.config_notifications.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="integrations" element={<ProtectedRoute requiredPermissions={["settings.config_integrations.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="preview-file" element={<ProtectedRoute requiredPermissions={["settings.config_preview_file.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="image-watermark" element={<ProtectedRoute requiredPermissions={["settings.config_image_watermark.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
          <Route path="features" element={<ProtectedRoute requiredPermissions={["settings.config_features.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
        </Route>
        {/* Report templates are made and approved in Reports; the old addresses lead there. */}
        <Route path="report-configuration" element={<LegacyReportTemplateRedirect page="list" />} />
        <Route path="report-name-formats" element={<ProtectedRoute requiredPermissions={["reports.definition.view", "reports.name_format.manage"]}><Suspense fallback={<LoadingFallback />}><ReportNameFormatsView /></Suspense></ProtectedRoute>} />
        <Route path="report-types" element={<ProtectedRoute requiredPermissions={["reports.types.view", "reports.types.manage"]}><Suspense fallback={<LoadingFallback />}><ReportTypesView /></Suspense></ProtectedRoute>} />
        <Route path="report-types/:code" element={<ProtectedRoute requiredPermissions={["reports.types.view", "reports.types.manage"]}><Suspense fallback={<LoadingFallback />}><ReportTypeDetailView /></Suspense></ProtectedRoute>} />
        <Route path="report-appearance" element={<ProtectedRoute requiredPermissions={["reports.appearance.view", "reports.appearance.manage"]}><Suspense fallback={<LoadingFallback />}><ReportAppearanceListView /></Suspense></ProtectedRoute>} />
        <Route path="report-appearance/new" element={<ProtectedRoute requiredPermissions={["reports.appearance.manage"]}><Suspense fallback={<LoadingFallback />}><ReportAppearanceView /></Suspense></ProtectedRoute>} />
        <Route path="report-appearance/:id" element={<ProtectedRoute requiredPermissions={["reports.appearance.view", "reports.appearance.manage"]}><Suspense fallback={<LoadingFallback />}><ReportAppearanceView /></Suspense></ProtectedRoute>} />
        <Route path="report-properties" element={<ProtectedRoute requiredPermissions={["reports.properties.view", "reports.properties.manage"]}><Suspense fallback={<LoadingFallback />}><ReportPropertiesView /></Suspense></ProtectedRoute>} />
        <Route path="report-name-formats/new" element={<ProtectedRoute requiredPermissions={["reports.name_format.manage"]}><Suspense fallback={<LoadingFallback />}><ReportNameFormatEditView /></Suspense></ProtectedRoute>} />
        <Route path="report-name-formats/:id" element={<ProtectedRoute requiredPermissions={["reports.definition.view", "reports.name_format.manage"]}><Suspense fallback={<LoadingFallback />}><ReportNameFormatEditView /></Suspense></ProtectedRoute>} />
        <Route path="report-configuration/:code/revisions/:revision" element={<LegacyReportTemplateRedirect page="revision" />} />
        <Route path="report-configuration/:code/details" element={<LegacyReportTemplateRedirect page="details" />} />
        <Route path="report-configuration/:code" element={<LegacyReportTemplateRedirect page="edit" />} />
        <Route path="object-numbering" element={<ProtectedRoute requiredPermissions={["settings.object_numbering.view", "settings.object_numbering.manage"]}><Suspense fallback={<LoadingFallback />}><ObjectNumberingView /></Suspense></ProtectedRoute>} />
        <Route path="electronic-signature" element={<ProtectedRoute requiredPermissions={["settings.electronic_signature.view"]}><Suspense fallback={<LoadingFallback />}><ElectronicSignatureSettingsView /></Suspense></ProtectedRoute>} />
        <Route path="notifications">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view", "settings.notification_policy.manage", "settings.email_template.view", "settings.email_template.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationsView /></Suspense></ProtectedRoute>} />
          <Route path="events/:eventCode" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view", "settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationEventView channel="IN_APP" /></Suspense></ProtectedRoute>} />
          <Route path="events/:eventCode/email" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view", "settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationEventView channel="EMAIL" /></Suspense></ProtectedRoute>} />
          <Route path="emails/:id" element={<ProtectedRoute requiredPermissions={["settings.email_template.view", "settings.email_template.manage"]}><Suspense fallback={<LoadingFallback />}><EmailMessageEditView /></Suspense></ProtectedRoute>} />
          <Route path="in-app-design" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view", "settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><InAppDesignView /></Suspense></ProtectedRoute>} />
          <Route path="email-design" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view", "settings.notification_policy.manage", "settings.email_template.view", "settings.email_template.manage"]}><Suspense fallback={<LoadingFallback />}><EmailDesignView /></Suspense></ProtectedRoute>} />
        </Route>
        {/* the old addresses keep working: a bookmark or a link in a mail opens the new screen */}
        <Route path="email-templates/*" element={<Navigate to="/settings/notifications?tab=email" replace />} />
        <Route path="notification-policy/*" element={<Navigate to="/settings/notifications" replace />} />
        <Route path="announcements">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.announcement.view", "settings.announcement.manage"]}><Suspense fallback={<LoadingFallback />}><AnnouncementsView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.announcement.manage"]}><Suspense fallback={<LoadingFallback />}><AnnouncementEditorView /></Suspense></ProtectedRoute>} />
          <Route path="edit/:id" element={<ProtectedRoute requiredPermissions={["settings.announcement.manage"]}><Suspense fallback={<LoadingFallback />}><AnnouncementEditorView /></Suspense></ProtectedRoute>} />
        </Route>
      </Route>

      {/* ===== DOCUMENT ADMINISTRATION (under System Administration) =====
          URLs unchanged -- documents/administration/* is also the backend @RequestMapping base
          path on several controllers, so the literal path stays as-is; only the sidebar location
          and route-registration file moved. Each screen is self-gated by its own
          documents.admin.<screen>.* permission pair. */}
      <Route path="documents/administration">
        <Route index element={<Navigate to={ROUTES.DOCUMENTS.ADMIN.PROPERTIES} replace />} />
        <Route path="properties" element={<ProtectedRoute requiredPermissions={["documents.admin.properties.view", "documents.admin.properties.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentPropertiesView /></Suspense></ProtectedRoute>} />
        <Route path="name-formats" element={<ProtectedRoute requiredPermissions={["documents.admin.name_formats.view", "documents.admin.name_formats.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentNameFormatsView /></Suspense></ProtectedRoute>} />
        <Route path="name-formats/new" element={<ProtectedRoute requiredPermissions={["documents.admin.name_formats.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentNameFormatEditorView /></Suspense></ProtectedRoute>} />
        <Route path="name-formats/edit/:id" element={<ProtectedRoute requiredPermissions={["documents.admin.name_formats.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentNameFormatEditorView /></Suspense></ProtectedRoute>} />
        <Route path="document-components" element={<ProtectedRoute requiredPermissions={["documents.admin.name_formats.view", "documents.admin.name_formats.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentComponentsView /></Suspense></ProtectedRoute>} />
        <Route path="document-components/new" element={<ProtectedRoute requiredPermissions={["documents.admin.name_formats.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentComponentEditorView /></Suspense></ProtectedRoute>} />
        <Route path="document-components/edit/:id" element={<ProtectedRoute requiredPermissions={["documents.admin.name_formats.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentComponentEditorView /></Suspense></ProtectedRoute>} />
        <Route path="document-types" element={<ProtectedRoute requiredPermissions={["documents.admin.document_types.view", "documents.admin.document_types.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentTypesAdminView /></Suspense></ProtectedRoute>} />
        <Route path="document-sub-types" element={<ProtectedRoute requiredPermissions={["documents.admin.document_types.view", "documents.admin.document_types.manage"]}><Suspense fallback={<LoadingFallback />}><DocumentSubTypesAdminView /></Suspense></ProtectedRoute>} />
        <Route path="knowledge-categories" element={<ProtectedRoute requiredPermissions={["documents.admin.knowledge_categories.view", "documents.admin.knowledge_categories.manage"]}><Suspense fallback={<LoadingFallback />}><KnowledgeCategoriesView /></Suspense></ProtectedRoute>} />
        <Route path="knowledge-categories/new" element={<ProtectedRoute requiredPermissions={["documents.admin.knowledge_categories.manage"]}><Suspense fallback={<LoadingFallback />}><KnowledgeCategoryEditorView /></Suspense></ProtectedRoute>} />
        <Route path="knowledge-categories/edit/:id" element={<ProtectedRoute requiredPermissions={["documents.admin.knowledge_categories.view", "documents.admin.knowledge_categories.manage"]}><Suspense fallback={<LoadingFallback />}><KnowledgeCategoryEditorView /></Suspense></ProtectedRoute>} />
        <Route path="knowledge-components" element={<ProtectedRoute requiredPermissions={["documents.admin.knowledge_categories.view", "documents.admin.knowledge_categories.manage"]}><Suspense fallback={<LoadingFallback />}><KnowledgeComponentsView /></Suspense></ProtectedRoute>} />
        <Route path="knowledge-components/new" element={<ProtectedRoute requiredPermissions={["documents.admin.knowledge_categories.manage"]}><Suspense fallback={<LoadingFallback />}><KnowledgeComponentEditorView /></Suspense></ProtectedRoute>} />
        <Route path="knowledge-components/edit/:id" element={<ProtectedRoute requiredPermissions={["documents.admin.knowledge_categories.view", "documents.admin.knowledge_categories.manage"]}><Suspense fallback={<LoadingFallback />}><KnowledgeComponentEditorView /></Suspense></ProtectedRoute>} />
        <Route path="publishing-templates">
          <Route index element={<ProtectedRoute requiredPermissions={["documents.admin.publishing_templates.view", "documents.admin.publishing_templates.manage"]}><Suspense fallback={<LoadingFallback />}><PublishingTemplatesView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["documents.admin.publishing_templates.manage"]}><Suspense fallback={<LoadingFallback />}><PublishingTemplateEditorView /></Suspense></ProtectedRoute>} />
          <Route path="edit/:id" element={<ProtectedRoute requiredPermissions={["documents.admin.publishing_templates.manage"]}><Suspense fallback={<LoadingFallback />}><PublishingTemplateEditorView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="controlled-copies-policy" element={<ProtectedRoute requiredPermissions={["documents.admin.controlled_copies_policy.view", "documents.admin.controlled_copies_policy.manage"]}><Suspense fallback={<LoadingFallback />}><ControlledCopiesPolicyView /></Suspense></ProtectedRoute>} />
        <Route path="uncontrolled-copies-policy" element={<ProtectedRoute requiredPermissions={["documents.admin.uncontrolled_copies_policy.view", "documents.admin.uncontrolled_copies_policy.manage"]}><Suspense fallback={<LoadingFallback />}><UncontrolledCopyPolicyView /></Suspense></ProtectedRoute>} />
      </Route>

      {/* ===== REPORT ADMINISTRATION (UI preview, one screen per sub-menu) ===== */}
      <Route path="settings/administration/report">
        <Route path="retention" element={<Navigate to="/report/history/legal-holds" replace />} />
        <Route path="delivery" element={<Navigate to="/report/scheduled/delivery-log" replace />} />
      </Route>

      {/* ===== BACKUP & RESTORE ADMINISTRATION (UI preview, one screen per sub-menu) ===== */}
      <Route path="settings/administration/backup">
        <Route index element={<Navigate to={ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY} replace />} />
        <Route path="policy" element={<ProtectedRoute requiredPermissions={["backup.admin.policy.view"]}><Suspense fallback={<LoadingFallback />}><BackupPolicyView /></Suspense></ProtectedRoute>} />
        <Route path="policy/new" element={<ProtectedRoute requiredPermissions={["backup.admin.policy.propose"]}><Suspense fallback={<LoadingFallback />}><NewBackupPolicyView /></Suspense></ProtectedRoute>} />
        <Route path="policy/:version" element={<ProtectedRoute requiredPermissions={["backup.admin.policy.view"]}><Suspense fallback={<LoadingFallback />}><BackupPolicyDetailView /></Suspense></ProtectedRoute>} />
        <Route path="controls" element={<Navigate to={ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY} replace />} />
        <Route path="retention" element={<Navigate to={ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY} replace />} />
        <Route path="verification" element={<Navigate to={ROUTES.SETTINGS.BACKUP_ADMINISTRATION.POLICY} replace />} />
        <Route path="storage" element={<ProtectedRoute requiredPermissions={["backup.admin.storage.view"]}><Suspense fallback={<LoadingFallback />}><BackupStorageView /></Suspense></ProtectedRoute>} />
        <Route path="alerts" element={<ProtectedRoute requiredPermissions={["backup.admin.alerts.view"]}><Suspense fallback={<LoadingFallback />}><BackupAlertsView /></Suspense></ProtectedRoute>} />
        <Route path="disaster-recovery" element={<ProtectedRoute requiredPermissions={["backup.admin.disaster_recovery.view"]}><Suspense fallback={<LoadingFallback />}><DisasterRecoveryPlanView /></Suspense></ProtectedRoute>} />
      </Route>

      {/* ===== TRAINING ADMINISTRATION (coming soon sub-screens) ===== */}
      <Route path="settings/administration/training">
        <Route index element={<Navigate to={ROUTES.SETTINGS.TRAINING_ADMINISTRATION.PROPERTIES} replace />} />
        <Route path="properties" element={<ProtectedRoute requiredPermissions={["training.admin.properties.view", "training.settings.view"]}><Suspense fallback={<LoadingFallback />}><TrainingPropertiesView /></Suspense></ProtectedRoute>} />
        <Route path="code-rules" element={<ProtectedRoute requiredPermissions={["training.admin.properties.view", "training.settings.view"]}><Suspense fallback={<LoadingFallback />}><TrainingCodeRulesView /></Suspense></ProtectedRoute>} />
        <Route path="vendors" element={<ProtectedRoute requiredPermissions={["training.admin.manage"]}><Suspense fallback={<LoadingFallback />}><TrainingVendorsView /></Suspense></ProtectedRoute>} />
        <Route path="job-roles" element={<ProtectedRoute requiredPermissions={["training.admin.manage"]}><Suspense fallback={<LoadingFallback />}><TrainingJobRolesView /></Suspense></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute requiredPermissions={["training.admin.manage"]}><Suspense fallback={<LoadingFallback />}><TrainingNotificationsView /></Suspense></ProtectedRoute>} />
        <Route path="annex" element={<ProtectedRoute requiredPermissions={["training.annex.view"]}><Suspense fallback={<LoadingFallback />}><TrainingAnnexView /></Suspense></ProtectedRoute>} />
        <Route path="annex/:code" element={<ProtectedRoute requiredPermissions={["training.annex.view"]}><Suspense fallback={<LoadingFallback />}><TrainingAnnexDetailView mode="view" /></Suspense></ProtectedRoute>} />
        <Route path="annex/:code/edit" element={<ProtectedRoute requiredPermissions={["training.annex.manage"]}><Suspense fallback={<LoadingFallback />}><TrainingAnnexDetailView mode="edit" /></Suspense></ProtectedRoute>} />
      </Route>

      {/* ===== PREFERENCES ===== */}
      <Route path="preferences" element={<ProtectedRoute requiredPermissions={["preferences.module.view"]}><Suspense fallback={<LoadingFallback />}><PreferencesView /></Suspense></ProtectedRoute>} />

      {/* ===== PROFILE ===== */}
      <Route path="profile" element={<ProfileViewWrapper navigate={navigate} />} />
      <Route path="profile/data-privacy" element={<Suspense fallback={<LoadingFallback />}><DataPrivacyNoticeView /></Suspense>} />
    </>
  );
}

import React, { Suspense, lazy } from 'react';
import { Route, Outlet, useLocation, Navigate } from 'react-router-dom';
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
const LoggedInUsersView = lazy(() => import('@/features/settings').then(m => ({ default: m.LoggedInUsersView })));
const TimeLimitedUserListView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserListView })));
const TimeLimitedUserCreateView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserCreateView })));
const TimeLimitedUserDetailView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserDetailView })));
const TimeLimitedUserEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.TimeLimitedUserEditView })));
const DictionariesView = lazy(() => import('@/features/settings').then(m => ({ default: m.DictionariesView })));
const CountriesView = lazy(() => import('@/features/settings').then(m => ({ default: m.CountriesView })));
const EducationDegreeLevelsView = lazy(() => import('@/features/settings').then(m => ({ default: m.EducationDegreeLevelsView })));
const EducationSchoolsView = lazy(() => import('@/features/settings').then(m => ({ default: m.EducationSchoolsView })));
const EducationSchoolEditorView = lazy(() => import('@/features/settings').then(m => ({ default: m.EducationSchoolEditorView })));
const ConfigurationView = lazy(() => import('@/features/settings').then(m => ({ default: m.ConfigurationView })));
const EmailTemplatesView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplatesView })));
const EmailTemplateCreateView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplateCreateView })));
const EmailTemplateEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplateEditView })));
const EmailTemplatePreviewView = lazy(() => import('@/features/settings').then(m => ({ default: m.EmailTemplatePreviewView })));
const ElectronicSignatureSettingsView = lazy(() => import('@/features/settings').then(m => ({ default: m.ElectronicSignatureSettingsView })));
const NotificationPolicyView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationPolicyView })));
const NotificationPolicyDetailView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationPolicyDetailView })));
const NotificationPolicyCreateView = lazy(() => import('@/features/settings').then(m => ({ default: m.NotificationPolicyCreateView })));
const SystemInformationView = lazy(() => import('@/features/settings').then(m => ({ default: m.SystemInformationView })));
const ReportConfigurationView = lazy(() => import('@/features/settings').then(m => ({ default: m.ReportConfigurationView })));
const ReportDefinitionEditView = lazy(() => import('@/features/settings').then(m => ({ default: m.ReportDefinitionEditView })));
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
const TrainingPropertiesView = lazy(() => import('@/features/settings').then(m => ({ default: m.TrainingPropertiesView })));
const RequirementTemplatesView = lazy(() => import('@/features/settings').then(m => ({ default: m.RequirementTemplatesView })));
const CreateQuizView = lazy(() => import('@/features/settings').then(m => ({ default: m.CreateQuizView })));
const CurriculumsView = lazy(() => import('@/features/settings').then(m => ({ default: m.CurriculumsView })));

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
              "settings.business_unit.view",
              "settings.department.view",
              "settings.position.view",
              "settings.storage_location.view",
              "settings.retention_policy.view",
              "settings.country.view",
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
          <Route path="logged-in" element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><LoggedInUsersView /></Suspense></ProtectedRoute>} />
          <Route path="time-limited">
            <Route index element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserListView /></Suspense></ProtectedRoute>} />
            <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.user.edit"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserCreateView /></Suspense></ProtectedRoute>} />
            <Route path=":id" element={<ProtectedRoute requiredPermissions={["settings.user.view"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserDetailView /></Suspense></ProtectedRoute>} />
            <Route path=":id/edit" element={<ProtectedRoute requiredPermissions={["settings.user.edit"]}><Suspense fallback={<LoadingFallback />}><TimeLimitedUserEditView /></Suspense></ProtectedRoute>} />
          </Route>
        </Route>
        <Route path="system-info" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><SystemInformationView /></Suspense></ProtectedRoute>} />
        <Route path="dictionaries">
          <Route index element={<Navigate to="business-units" replace />} />
          <Route path="business-units" element={<ProtectedRoute requiredPermissions={["settings.business_unit.view", "settings.business_unit.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="departments" element={<ProtectedRoute requiredPermissions={["settings.department.view", "settings.department.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="positions" element={<ProtectedRoute requiredPermissions={["settings.position.view", "settings.position.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="storage-locations" element={<ProtectedRoute requiredPermissions={["settings.storage_location.view", "settings.storage_location.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
          <Route path="retention-policies" element={<ProtectedRoute requiredPermissions={["settings.retention_policy.view", "settings.retention_policy.manage"]}><Suspense fallback={<LoadingFallback />}><DictionariesView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="countries" element={<ProtectedRoute requiredPermissions={["settings.country.view", "settings.country.manage"]}><Suspense fallback={<LoadingFallback />}><CountriesView /></Suspense></ProtectedRoute>} />
        <Route path="education">
          <Route index element={<Navigate to="degree-levels" replace />} />
          <Route path="degree-levels" element={<ProtectedRoute requiredPermissions={["settings.education.degree_level.view", "settings.education.degree_level.manage"]}><Suspense fallback={<LoadingFallback />}><EducationDegreeLevelsView /></Suspense></ProtectedRoute>} />
          <Route path="schools">
            <Route index element={<ProtectedRoute requiredPermissions={["settings.education.school.view", "settings.education.school.manage"]}><Suspense fallback={<LoadingFallback />}><EducationSchoolsView /></Suspense></ProtectedRoute>} />
            <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.education.school.manage"]}><Suspense fallback={<LoadingFallback />}><EducationSchoolEditorView /></Suspense></ProtectedRoute>} />
            <Route path=":id/edit" element={<ProtectedRoute requiredPermissions={["settings.education.school.manage"]}><Suspense fallback={<LoadingFallback />}><EducationSchoolEditorView /></Suspense></ProtectedRoute>} />
          </Route>
        </Route>
        <Route path="configuration" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ConfigurationView /></Suspense></ProtectedRoute>} />
        <Route path="report-configuration" element={<ProtectedRoute requiredPermissions={["reports.definition.view", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ReportConfigurationView /></Suspense></ProtectedRoute>} />
        <Route path="report-configuration/:code" element={<ProtectedRoute requiredPermissions={["reports.definition.view", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ReportDefinitionEditView /></Suspense></ProtectedRoute>} />
        <Route path="electronic-signature" element={<ProtectedRoute requiredPermissions={["settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><ElectronicSignatureSettingsView /></Suspense></ProtectedRoute>} />
        <Route path="email-templates">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.email_template.view", "settings.email_template.manage", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><EmailTemplatesView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.email_template.manage", "settings.configuration.manage"]}><Suspense fallback={<LoadingFallback />}><EmailTemplateCreateView /></Suspense></ProtectedRoute>} />
          <Route path="edit/:id" element={<ProtectedRoute requiredPermissions={["settings.email_template.manage", "settings.configuration.manage"]}><Suspense fallback={<LoadingFallback />}><EmailTemplateEditView /></Suspense></ProtectedRoute>} />
          <Route path="preview" element={<ProtectedRoute requiredPermissions={["settings.email_template.view", "settings.email_template.manage", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><EmailTemplatePreviewView /></Suspense></ProtectedRoute>} />
          <Route path="preview/:id" element={<ProtectedRoute requiredPermissions={["settings.email_template.view", "settings.email_template.manage", "settings.configuration.view"]}><Suspense fallback={<LoadingFallback />}><EmailTemplatePreviewView /></Suspense></ProtectedRoute>} />
        </Route>
        <Route path="notification-policy">
          <Route index element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyView /></Suspense></ProtectedRoute>} />
          <Route path="new" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyCreateView /></Suspense></ProtectedRoute>} />
          <Route path=":eventCode" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.view"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyDetailView mode="view" /></Suspense></ProtectedRoute>} />
          <Route path=":eventCode/edit" element={<ProtectedRoute requiredPermissions={["settings.notification_policy.manage"]}><Suspense fallback={<LoadingFallback />}><NotificationPolicyDetailView mode="edit" /></Suspense></ProtectedRoute>} />
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

      {/* ===== TRAINING ADMINISTRATION (coming soon sub-screens) ===== */}
      <Route path="settings/administration/training">
        <Route index element={<Navigate to={ROUTES.SETTINGS.TRAINING_ADMINISTRATION.PROPERTIES} replace />} />
        <Route path="properties" element={<ProtectedRoute requiredPermissions={["training.admin.properties.view"]}><Suspense fallback={<LoadingFallback />}><TrainingPropertiesView /></Suspense></ProtectedRoute>} />
        <Route path="requirement-templates" element={<ProtectedRoute requiredPermissions={["training.admin.requirement_templates.view"]}><Suspense fallback={<LoadingFallback />}><RequirementTemplatesView /></Suspense></ProtectedRoute>} />
        <Route path="create-quiz" element={<ProtectedRoute requiredPermissions={["training.admin.quiz.view"]}><Suspense fallback={<LoadingFallback />}><CreateQuizView /></Suspense></ProtectedRoute>} />
        <Route path="curriculums" element={<ProtectedRoute requiredPermissions={["training.admin.curriculums.view"]}><Suspense fallback={<LoadingFallback />}><CurriculumsView /></Suspense></ProtectedRoute>} />
      </Route>

      {/* ===== PREFERENCES ===== */}
      <Route path="preferences" element={<ProtectedRoute requiredPermissions={["preferences.module.view"]}><Suspense fallback={<LoadingFallback />}><PreferencesView /></Suspense></ProtectedRoute>} />

      {/* ===== PROFILE ===== */}
      <Route path="profile" element={<ProfileViewWrapper navigate={navigate} />} />
      <Route path="profile/data-privacy" element={<Suspense fallback={<LoadingFallback />}><DataPrivacyNoticeView /></Suspense>} />
    </>
  );
}

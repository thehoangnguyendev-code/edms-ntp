# Responsive Audit - eqms/src

Generated from pattern scan across `eqms/src`. Focus is on files with fixed widths, min-widths, sticky headers, and custom overflow handling.

## Highest-priority shared components

- eqms/src/components/layout/main-layout/MainLayout.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/layout/header/Header.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/layout/sidebar/Sidebar.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/table/ResponsiveTable.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/page/PageHeader.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/tabs/TabNav.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/workflow-stepper/WorkflowStepper.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/form/FormSection.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/modal/AlertModal.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/modal/FormModal.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/modal/NavigationGuardModal.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/esign-modal/ESignatureModal.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/datetime-picker/DateRangePicker.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/datetime-picker/DateTimePicker.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/datetime-picker/TimePicker.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/select/MultiSelect.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.
- eqms/src/components/ui/select/Select.tsx - normalize widths, wrap behavior, and mobile stacking through shared tokens instead of per-screen classes.

## Feature screens with most responsive risk
- eqms/src\features\training\compliance-tracking\views\result-entry\ResultEntryView.tsx - 8 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\compliance-tracking\views\assignment\components\Step1CourseSelect.tsx - 8 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\records-archive\components\PendingSignaturesModal.tsx - 8 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\regulatory\RegulatoryView.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\course-inventory\courses\views\CourseListView.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\shared\components\AuditTrailTab.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\components\layout\sidebar\Sidebar.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\compliance-tracking\views\course-status\CourseStatusView.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\materials\views\MaterialsView.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\audit-trail\AuditTrailView.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\records-archive\views\EmployeeTrainingFilesView.tsx - 7 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\report\components\ReportHistory.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\report\components\ReportPreviewModal.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\complaints\ComplaintsView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\supplier\SupplierView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\equipment\EquipmentView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\document-detail\tabs\GeneralInformationTab.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\components\layout\header\Header.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\change-control\ChangeControlView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\document-list\DocumentsView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\deviations\DeviationsView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\knowledge\FolderDocumentsList.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\report\components\ScheduledReports.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\risk-management\RiskManagementView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\product\ProductView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\capa\CapaView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\document-revisions\views\RequestControlledCopyView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\report\components\NewScheduleModal.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\user-management\tabs\QualificationsTab.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\my-training\MyTrainingView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\role-permission\views\RoleListView.tsx - 6 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\shared\components\ExpandedDocumentRow.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\email-templates\EmailTemplatesView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\dictionaries\tabs\DepartmentsTab.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\user-management\views\UserManagementView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\document-revisions\workspace-tabs\GeneralInformationTab.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\compliance-tracking\views\course-progress\CourseProgressView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\notifications\NotificationsView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\audit-trail\AuditTrailDetailView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\components\ui\workflow-stepper\WorkflowStepper.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\report\components\ComplianceReports.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\document-revisions\workspace-tabs\GeneralTab.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\dictionaries\tabs\BusinessUnitsTab.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\report\components\ReportTemplates.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\training\compliance-tracking\components\matrix\MatrixTable.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\components\ui\select\MultiSelect.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\controlled-copies\ControlledCopiesView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\settings\dictionaries\tabs\RetentionPoliciesTab.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\features\documents\shared\components\RevisionTableView.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.
- eqms/src\components\ui\datetime-picker\DateRangePicker.tsx - 5 risky layout patterns; review table widths, sticky columns, and mobile fallback.

## Feature groups that need follow-up
- **features/documents** (49 files) - sample: eqms/src\features\documents\controlled-copies\components\ExpandControlledCopiesRow.tsx; eqms/src\features\documents\controlled-copies\ControlledCopiesView.tsx; eqms/src\features\documents\controlled-copies\ControlledCopyPreviewView.tsx; eqms/src\features\documents\controlled-copies\DestroyControlledCopyView.tsx
- **features/training** (46 files) - sample: eqms/src\features\training\compliance-tracking\components\matrix\CellDetailDrawer.tsx; eqms/src\features\training\compliance-tracking\components\matrix\FilterBar.tsx; eqms/src\features\training\compliance-tracking\components\matrix\HeaderActionDrawer.tsx; eqms/src\features\training\compliance-tracking\components\matrix\MatrixTable.tsx
- **features/settings** (35 files) - sample: eqms/src\features\settings\configuration\ConfigurationView.tsx; eqms/src\features\settings\configuration\tabs\DocumentTab.tsx; eqms/src\features\settings\configuration\tabs\FeaturesTab.tsx; eqms/src\features\settings\configuration\tabs\GeneralTab.tsx
- **components/ui** (24 files) - sample: eqms/src\components\ui\badge\Badge.tsx; eqms/src\components\ui\breadcrumb\Breadcrumb.tsx; eqms/src\components\ui\datetime-picker\DateRangePicker.tsx; eqms/src\components\ui\datetime-picker\DateTimePicker.tsx
- **features/auth** (7 files) - sample: eqms/src\features\auth\auth-ui.ts; eqms/src\features\auth\components\AuthBackLink.tsx; eqms/src\features\auth\components\SessionTimeoutModal.tsx; eqms/src\features\auth\ForcePasswordChangeView.tsx
- **features/report** (7 files) - sample: eqms/src\features\report\components\ComplianceReports.tsx; eqms/src\features\report\components\NewScheduleModal.tsx; eqms/src\features\report\components\ReportHistory.tsx; eqms/src\features\report\components\ReportPreviewModal.tsx
- **components/layout** (7 files) - sample: eqms/src\components\layout\footer\Footer.tsx; eqms/src\components\layout\header\Header.tsx; eqms/src\components\layout\header\NotificationsDropdown.tsx; eqms/src\components\layout\header\SearchDropdown.tsx
- **features/my-tasks** (4 files) - sample: eqms/src\features\my-tasks\components\TaskBoard.tsx; eqms/src\features\my-tasks\components\TaskDetailDrawer.tsx; eqms/src\features\my-tasks\components\TaskTable.tsx; eqms/src\features\my-tasks\MyTasksView.tsx
- **features/preferences** (3 files) - sample: eqms/src\features\preferences\components\NotificationSettingsTab.tsx; eqms/src\features\preferences\components\SecuritySettingsTab.tsx; eqms/src\features\preferences\PreferencesView.tsx

## What to change

1. Replace hard widths (`w-[...]`, `min-w-[...]`, `max-w-[...]`) with responsive tokens or fluid layouts where possible.
2. Standardize tables with one shared responsive table wrapper, sticky header, and mobile card fallback for dense datasets.
3. Ensure headers, breadcrumbs, tab bars, and action bars wrap on mobile instead of forcing single-line overflow.
4. Use shared modal sizing rules so dialogs become full-width on small screens and capped on desktop.
5. Keep workflow steppers scrollable on narrow screens and avoid hard min widths that exceed viewport.
6. For feature views with many columns (documents, controlled copies, audit trail, dictionaries, training matrix), prefer horizontal scroll + sticky action column on tablet/desktop and card mode on mobile.
7. Standardize form screens so create/detail/review/approval/training follow the same layout rule: mobile 1 column, tablet 2 columns, desktop 2 or 3 columns depending on section, and readonly/disabled fields keep the same height/appearance while only changing the visual token color.

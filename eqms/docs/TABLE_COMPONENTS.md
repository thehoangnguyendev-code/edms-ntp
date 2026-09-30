# Shared table components

## Contract

Use `DataTable<T>` for a flat register: declare typed columns and pass server-owned rows, sorting callbacks, pagination, loading, selection and Action content. It owns the default register layout and uses the same primitives as specialized tables.

Use `TableMarkup` for matrices, editable tables, expandable rows and tables inside tabs/modals. The API is `Root`, `Head`, `Body`, `Foot`, `Row`, `HeaderCell`, `Cell`, `Caption`, `ColumnGroup`, `Column`. Each component renders exactly its native element and forwards native props/ref. It adds no DOM wrapper or inferred behavior.

`TABLE_STYLES` centralizes repeated presentation variants. Existing variants preserve each screen's layout. Their role-prefixed identifiers are migration compatibility variants; use the DataTable default layout for new flat registers. Specialized classes may remain explicit where matrix, sticky offsets, responsive columns or editing require them.

`ResponsiveTable` remains a compatibility API and delegates rendering to these primitives. All native table elements are implemented only in `src/components/ui/table/TablePrimitives.tsx`.

Data fetching, URL filters, server pagination/sorting, permission checks, lifecycle, audit/e-signature and async generation belong to the feature/server. The shared table never grants permissions or fetches records.

## Flat-list example

```tsx
import { DataTable, type DataTableColumn, TablePagination } from "@/components/ui/table";

const columns: DataTableColumn<RecordItem>[] = [
  { id: "number", header: "Document Number", cell: record => record.number },
  { id: "status", header: "Status", cell: record => record.status },
];

<DataTable
  rows={records}
  columns={columns}
  getRowKey={record => record.id}
  action={{ cell: record => <RecordActions record={record} /> }}
  pagination={<TablePagination {...paginationProps} />}
/>
```

## Specialized-table example

```tsx
import { TableMarkup } from "@/components/ui/table";

<TableMarkup.Root className="w-full">
  <TableMarkup.Head>
    <TableMarkup.Row>
      <TableMarkup.HeaderCell scope="col">Result</TableMarkup.HeaderCell>
    </TableMarkup.Row>
  </TableMarkup.Head>
  <TableMarkup.Body>
    <TableMarkup.Row>
      <TableMarkup.Cell colSpan={columnCount}>{expandedContent}</TableMarkup.Cell>
    </TableMarkup.Row>
  </TableMarkup.Body>
</TableMarkup.Root>
```

## Verification

- Source scan: native table markup appears only in TablePrimitives (excluding tests).
- AST comparison: 443 pre-existing TSX source files compared after normalizing the migration; zero semantic differences. The migrated subset baseline contains 103 files.
- Reproduce the migrated-subset comparison from the frontend folder: `node scripts/verify-table-migration.cjs docs/validation/table-migration-baseline.json`. Intentional future feature changes require review; they are not migration regressions.
- Tests: `node node_modules/vitest/vitest.mjs run src/components/ui/table/__tests__` covers refs, native structure, colspan/rowspan, editable input callbacks, row actions, action event isolation, empty colspan and the source boundary.
- Production build passed. Whole-suite failures and pre-existing PDF type errors are documented in the change record.

## Inventory

106 files now use the shared table system (includes renderer/compatibility implementations and child row/cell components).

| File (relative to frontend) | API |
| --- | --- |
| `src/components/ui/esign-modal/ESignatureModal.tsx` | TableMarkup |
| `src/components/ui/table/DataTable.tsx` | TableMarkup |
| `src/components/ui/table/ResponsiveTable.tsx` | TableMarkup |
| `src/features/audit-trail/AuditTrailDetailView.tsx` | TableMarkup |
| `src/features/audit-trail/AuditTrailView.tsx` | TableMarkup |
| `src/features/audit-trail/review/AuditTrailReviewCampaignDetailView.tsx` | TableMarkup |
| `src/features/audit-trail/review/AuditTrailReviewView.tsx` | TableMarkup |
| `src/features/documents/controlled-copies/components/ExpandControlledCopiesRow.tsx` | TableMarkup |
| `src/features/documents/controlled-copies/ControlledCopiesView.tsx` | TableMarkup |
| `src/features/documents/controlled-copies/ControlledCopyBatchStatusDiscrepanciesView.tsx` | DataTable |
| `src/features/documents/controlled-copies/detail/tabs/DistributionInformationTab.tsx` | TableMarkup |
| `src/features/documents/document-detail/components/ReadOnlyApproversTable.tsx` | TableMarkup |
| `src/features/documents/document-detail/components/ReadOnlyReviewersTable.tsx` | TableMarkup |
| `src/features/documents/document-detail/DetailDocumentView.tsx` | TableMarkup |
| `src/features/documents/document-detail/tabs/subtabs/ApproversTab.tsx` | TableMarkup |
| `src/features/documents/document-detail/tabs/subtabs/components/RelationDocumentsTable.tsx` | TableMarkup |
| `src/features/documents/document-detail/tabs/subtabs/components/SortableTh.tsx` | TableMarkup |
| `src/features/documents/document-detail/tabs/subtabs/ControlledCopiesTab.tsx` | TableMarkup |
| `src/features/documents/document-detail/tabs/subtabs/DocumentRevisionsTab.tsx` | TableMarkup |
| `src/features/documents/document-detail/tabs/subtabs/ReviewersTab.tsx` | TableMarkup |
| `src/features/documents/document-list/document-creation/new-tabs/subtabs/CorrelatedDocumentsTab.tsx` | TableMarkup |
| `src/features/documents/document-list/document-creation/new-tabs/subtabs/DocumentRevisionsTab.tsx` | TableMarkup |
| `src/features/documents/document-list/document-creation/new-tabs/subtabs/RelatedDocumentsTab.tsx` | TableMarkup |
| `src/features/documents/document-list/document-creation/NewDocumentView.tsx` | TableMarkup |
| `src/features/documents/document-list/DocumentsView.tsx` | TableMarkup |
| `src/features/documents/document-revisions/views/RequestControlledCopyView.tsx` | TableMarkup |
| `src/features/documents/document-revisions/workspace-tabs/OriginalDocumentTab.tsx` | TableMarkup |
| `src/features/documents/publishing/PublishingWorkspaceView.tsx` | TableMarkup |
| `src/features/documents/shared/components/AuditTrailTab.tsx` | TableMarkup |
| `src/features/documents/shared/components/ExpandedDocumentRow.tsx` | TableMarkup |
| `src/features/documents/shared/components/ParticipantRosterTab.tsx` | TableMarkup |
| `src/features/documents/shared/components/RevisionTableView.tsx` | TableMarkup |
| `src/features/documents/uncontrolled-copies/UncontrolledCopiesView.tsx` | DataTable |
| `src/features/notifications/NotificationsView.tsx` | TableMarkup |
| `src/features/report/history/ReportHistoryView.tsx` | TableMarkup |
| `src/features/report/scheduled/ScheduledReportsView.tsx` | TableMarkup |
| `src/features/report/templates/ReportTemplatesView.tsx` | TableMarkup |
| `src/features/security-authorization/access-profiles/views/AccessProfileListView.tsx` | TableMarkup |
| `src/features/security-authorization/access-review/AccessReviewCampaignDetailView.tsx` | TableMarkup |
| `src/features/security-authorization/access-review/AccessReviewView.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/components/ActionStatusMatrix.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/views/ActorPickerModal.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/views/EngineHealthTab.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/views/RelationDefinitionsTab.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/views/StateCapabilitiesView.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/views/WorkflowRolesView.tsx` | TableMarkup |
| `src/features/security-authorization/lifecycle-policies/views/WorkflowTransitionsView.tsx` | TableMarkup |
| `src/features/security-authorization/object-rules/ObjectAccessRulesView.tsx` | TableMarkup |
| `src/features/security-authorization/permission-sets/PermissionCatalogTab.tsx` | TableMarkup |
| `src/features/security-authorization/permission-sets/PermissionSetDetailView.tsx` | TableMarkup |
| `src/features/security-authorization/permission-sets/PermissionSetsView.tsx` | TableMarkup |
| `src/features/security-authorization/sod/SegregationOfDutiesView.tsx` | TableMarkup |
| `src/features/security-authorization/sod/SodViolationReviewView.tsx` | TableMarkup |
| `src/features/security-authorization/user-management/profile/components/ExpandUserAccessProfilesRow.tsx` | TableMarkup |
| `src/features/security-authorization/user-management/profile/tabs/QualificationsTab.tsx` | TableMarkup |
| `src/features/security-authorization/user-management/profile/tabs/SecurityAuthorizationTab.tsx` | TableMarkup |
| `src/features/security-authorization/user-management/profile/views/UserManagementView.tsx` | TableMarkup |
| `src/features/security-authorization/user-management/time-limited/views/LoggedInUsersView.tsx` | TableMarkup |
| `src/features/security-authorization/user-management/time-limited/views/TimeLimitedUserListView.tsx` | TableMarkup |
| `src/features/self-service/knowledge/explorer/ExplorerItems.tsx` | TableMarkup |
| `src/features/self-service/knowledge/FolderDocumentsList.tsx` | TableMarkup |
| `src/features/settings/configuration/tabs/NotificationTab.tsx` | TableMarkup |
| `src/features/settings/countries/CountriesView.tsx` | DataTable |
| `src/features/settings/dictionaries/tabs/BusinessUnitsTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/ConfidentialityLevelsTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/DepartmentsTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/DocumentTypesTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/PositionsTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/RetentionPoliciesTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/StorageLocationsTab.tsx` | TableMarkup |
| `src/features/settings/dictionaries/tabs/SubTypesTab.tsx` | TableMarkup |
| `src/features/settings/document-administration/controlled-copies-policy/ControlledCopiesPolicyView.tsx` | TableMarkup |
| `src/features/settings/document-administration/DocumentComponentsTab.tsx` | TableMarkup |
| `src/features/settings/document-administration/DocumentNameFormatsTab.tsx` | TableMarkup |
| `src/features/settings/document-administration/ExpandedDocumentNameFormatRow.tsx` | TableMarkup |
| `src/features/settings/document-administration/KnowledgeCategoriesView.tsx` | TableMarkup |
| `src/features/settings/document-administration/KnowledgeComponentsView.tsx` | TableMarkup |
| `src/features/settings/document-administration/publishing-templates/PublishingTemplatesView.tsx` | TableMarkup |
| `src/features/settings/document-administration/uncontrolled-copy-policy/UncontrolledCopyPolicyView.tsx` | TableMarkup |
| `src/features/settings/education/EducationDegreeLevelsView.tsx` | TableMarkup |
| `src/features/settings/education/EducationSchoolsView.tsx` | TableMarkup |
| `src/features/settings/electronic-signature/ElectronicSignatureSettingsView.tsx` | TableMarkup |
| `src/features/settings/email-templates/EmailTemplatesView.tsx` | TableMarkup |
| `src/features/settings/notification-policy/NotificationPolicyView.tsx` | TableMarkup |
| `src/features/settings/report-configuration/ReportConfigurationView.tsx` | TableMarkup |
| `src/features/settings/report-configuration/ReportDefinitionEditView.tsx` | TableMarkup |
| `src/features/training/compliance-tracking/components/matrix/MatrixTable.tsx` | TableMarkup |
| `src/features/training/compliance-tracking/views/assignment/components/Step1CourseSelect.tsx` | TableMarkup |
| `src/features/training/compliance-tracking/views/assignment/components/Step2Assignees.tsx` | TableMarkup |
| `src/features/training/compliance-tracking/views/course-progress/CourseProgressView.tsx` | TableMarkup |
| `src/features/training/compliance-tracking/views/course-status/CourseStatusView.tsx` | TableMarkup |
| `src/features/training/compliance-tracking/views/result-entry/ResultEntryView.tsx` | TableMarkup |
| `src/features/training/course-inventory/courses/components/ExpandedCourseRow.tsx` | TableMarkup |
| `src/features/training/course-inventory/courses/views/CourseListView.tsx` | TableMarkup |
| `src/features/training/course-inventory/shared/CourseApproversTab.tsx` | TableMarkup |
| `src/features/training/course-inventory/shared/CourseAuditTrailTab.tsx` | TableMarkup |
| `src/features/training/course-inventory/shared/CourseReviewersTab.tsx` | TableMarkup |
| `src/features/training/materials/components/ImpactAssessmentModal.tsx` | TableMarkup |
| `src/features/training/materials/components/MaterialApproversTab.tsx` | TableMarkup |
| `src/features/training/materials/components/MaterialAuditTrailTab.tsx` | TableMarkup |
| `src/features/training/materials/components/MaterialReviewersTab.tsx` | TableMarkup |
| `src/features/training/materials/views/MaterialsView.tsx` | TableMarkup |
| `src/features/training/materials/views/UsageReportView.tsx` | TableMarkup |
| `src/features/training/my-training/MyTrainingView.tsx` | TableMarkup |
| `src/features/training/records-archive/components/PendingSignaturesModal.tsx` | TableMarkup |
| `src/features/training/records-archive/views/EmployeeTrainingFilesView.tsx` | TableMarkup |


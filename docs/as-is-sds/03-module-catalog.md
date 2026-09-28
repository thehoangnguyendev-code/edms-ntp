# 03 — Module Catalog (AS-IS)

Evidence: `eqms-backend/src/main/java/com/eqms` directory listing (controller/service/entity package contents), current as of this pass.

## Document Control core
| Module | Key controller(s) | Key service(s) | Key entities |
|---|---|---|---|
| Document | `DocumentController` | `DocumentService`, `DocumentAuthorizationService`, `DocumentMasterActionCapabilityService`, `DocumentMasterWorkflowAuthorizationService`, `DocumentParticipantEligibilityService`, `DocumentResourceAdapter` | `DocumentRecord`, `DocumentStatusDefinition`, `DocumentType`, `DocumentSubType`, `DocumentRelation`, `DocumentWorkflowParticipant`, `DocumentWorkflowPoolMember`, `DocumentWorkflowSetting` |
| Document Revision | `RevisionController` | `RevisionService`, `RevisionWorkflowAuthorizationService`, `RevisionActionCapabilityService`, `RevisionResourceAdapter`, `RevisionUploadFileValidator`, `RevisionUploadSecurityAuditService`, `RevisionSnapshotAsyncService`, `RevisionSharePointSyncWorker`, `RevisionUpgradeSessionService`, `RevisionWorkspaceBatchService`, `RevisionWorkspaceSnapshotService` | `DocumentRevisionRecord`, `RevisionStatusDefinition`, `RevisionWorkflowParticipant`, `RevisionWorkflowHistory`, `RevisionWorkingNote`, `RevisionSnapshotHistory`, `RevisionUpgradeSession`, `RevisionWorkspaceItem`, `RevisionWorkspaceSnapshot`, `RevisionOfficeWorkspaceAccess`, `RevisionPublishingMetadata`, `DocumentRevisionTemplateLineage` |
| Controlled Copy | `ControlledCopyController`, `ControlledCopyExpiryLimitController`, `ControlledCopyPlaceholderFieldController`, `ControlledCopyPolicyController` | `ControlledCopyService`, `ControlledCopyAuthorizationService`, `ControlledCopyBatchStatusService`, `ControlledCopyDistributionJobService`, `ControlledCopyBatchDistributionAsyncService`, `ControlledCopyBatchCancelAsyncService`, `ControlledCopyBatchRecallAsyncService`, `ControlledCopyBatchDiscrepancyScanner`, `ControlledCopyExpiryScheduler`, `ControlledCopyExpiryLimitService`, `ControlledCopyPlaceholderFieldService`, `ControlledCopyPreviewGrantService`, `ControlledCopyResourceAdapter` | `ControlledCopyRecord`, `ControlledCopyStatusDefinition`, `ControlledCopyDistributionBatch`, `ControlledCopyDistributionJob`, `ControlledCopyDistributionJobItem`, `ControlledCopyEvidenceFile`, `ControlledCopyExpiryLimit`, `ControlledCopyPlaceholderField`, `ControlledCopyPolicySetting`, `ControlledCopyBatchStatusDiscrepancy` |
| Publishing | `PublishingWorkspaceController`, `PublishingTemplateController` | `PublishingWorkspaceService`, `PublishingWorkspaceJobProcessorService`, `PublishingPdfComposerService` — confirmed live async open-workspace path + confirmed synchronous preview-compose path (see `08-state-machines.md` §8.4d, `13-async-scheduler-events.md`); remaining endpoint/template surface not behaviorally traced | `RevisionPublishingMetadata`, `DocumentRevisionTemplateLineage`, `PublishingTemplate` |

## Workflow engine / authorization framework
`service/workflow/` (`WorkflowDefinition`, `WorkflowDefinitionProvider`, `DocumentsWorkflowDefinitionProvider`, `WorkflowRegistryService`) plus a large authorization surface: `AuthorizationController`, `AuthorizationParticipantReconciliationController`, `AuthorizationShadowEvaluationController`, `AuthorizationWorkflowPolicyController`, `SecurityAccessProfileController`, `SecurityEligibleUsersController`, `SecurityPermissionCatalogController`, `SecurityPermissionSetController`, `ObjectAccessRuleController`, `EffectiveAccessDiagnosisController`, `SodConstraintController`, `UserAuthorizationSummaryController`, `WorkflowActionPolicyController`, `WorkflowRoleController`, `CapabilityController`, `ResourceCapabilityController`, `LifecycleStatePolicyController`, plus services `AccessEffectiveService`, `WorkflowActionPolicyService`, `WorkflowActionDefaultPolicyRegistry`, `WorkflowParticipantEligibilityService`, `WorkflowRoleCatalogService`, `WorkflowRoleService`, `LifecycleStatePolicyEvaluator`, `LifecycleStatePolicyService`.
Detailed trace: **Done** — `06-role-authorization-model.md`.

## Audit
`AuditTrailController`, `AuditTrailReviewController`. Detail: **Done** — `15-audit-trail.md`.

## Notifications
`NotificationController`, `NotificationPolicyController`, `EmailTemplateController`, bootstrap classes `NotificationBootstrap`, `NotificationEventCatalogBootstrap`, `EmailTemplateBootstrap`, event `AsyncEmailRequestedEvent` (confirmed dead code — see `13-async-scheduler-events.md`). Detail: **Done** — `14-notifications.md`.

## E-signature
`ElectronicSignatureSettingsController`, `SharedSignatureController`. Detail: **Done** — `16-electronic-signature.md`.

## Settings/Admin
`SettingsUserController`, `SettingsDictionaryController`, `ConfigurationController`, `PublicBrandingController`, `PublicLocalizationController`.

## Dashboards/Reports
`DashboardController`, `ReportConfigurationController`, `ReportPlatformController`.

## Misc
`HealthController`, `NavigationController`, `MetadataController`, `PromptSpecificationController`, `AuthController` (login/session; the `MfaOtpEmailRequestedEvent` type exists but is confirmed dead code — see `13-async-scheduler-events.md` — MFA OTP is actually sent via a direct synchronous-after-commit call, and `MFA_DISABLED=true` is hardcoded, see `16-electronic-signature.md`).

## Coverage status
This catalog is structural (from directory listing). Behavior has since been verified module-by-module for Document/Revision/Controlled Copy, the workflow/authorization framework, audit, notifications, e-signature, file storage, external integrations, error/retry, and the UI/API layer — see `AS-IS-SDS.md` for the current, authoritative status table. Dashboards/Reports and Settings/Admin controllers remain structural-only (not behaviorally traced) — see `21-known-unknowns-conflicts.md`.

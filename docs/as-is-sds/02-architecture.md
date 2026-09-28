# 02 — Architecture (AS-IS)

Source evidence only. Package root: `eqms-backend/src/main/java/com/eqms`.

## 2.1 Backend stack
- Spring Boot application, entry point `EqmsBackendApplication.java`.
- Layering observed on disk: `controller/` (46 classes) → `service/` (121 classes) → `entity/` (99 JPA entities) + `repository/`.
- Cross-cutting packages: `auth/` (AuthTokenFilter, RateLimitFilter), `config/` (SecurityConfig, AsyncConfig, CacheConfig, WorkflowPoolMapping, WorkflowPoolTypes, MicrosoftGraphStorageProperties, StrictSecretConfigurationValidator, AuditRequestTimingFilter), `bootstrap/` (data/seed bootstrap classes run at startup), `event/` (Spring application events), `enums/`, `dto/`, `util/`, `exception/`.

## 2.2 Frontend
- React app at `eqms/src` with `app/`, `components/`, `features/`, `services/`, `contexts/`, `middleware/`, `hooks/`, `lib/`, `types/`.
- Central HTTP client `eqms/src/services/api/client.ts` — confirmed to implement a short-lived GET cache (1.5s), mutation deduplication, and an `Idempotency-Key` header for lifecycle-mutating routes; per-action capability hooks (e.g. `useRevisionActionCapabilities`) drive UI action gating rather than the frontend re-implementing backend state-transition rules. Full detail: `20-ui-api-service-mapping.md`.
- UNKNOWN (still not traced): exact routing map and build tooling beyond the API/service layer.

## 2.3 Module surface (by controller count)
46 controllers. Notable clusters:
- **Document Control core**: DocumentController, RevisionController, ControlledCopyController, ControlledCopyExpiryLimitController, ControlledCopyPlaceholderFieldController, ControlledCopyPolicyController, PublishingWorkspaceController, PublishingTemplateController, MetadataController.
- **Authorization/Security**: AuthorizationController, AuthorizationParticipantReconciliationController, AuthorizationShadowEvaluationController, AuthorizationWorkflowPolicyController, SecurityAccessProfileController, SecurityEligibleUsersController, SecurityPermissionCatalogController, SecurityPermissionSetController, ObjectAccessRuleController, EffectiveAccessDiagnosisController, SodConstraintController, UserAuthorizationSummaryController, WorkflowActionPolicyController, WorkflowRoleController, CapabilityController, ResourceCapabilityController, LifecycleStatePolicyController.
- **Auth/session**: AuthController.
- **Audit**: AuditTrailController, AuditTrailReviewController.
- **Notifications**: NotificationController, NotificationPolicyController, EmailTemplateController.
- **Settings/Admin**: SettingsUserController, SettingsDictionaryController, ConfigurationController, ElectronicSignatureSettingsController, PublicBrandingController, PublicLocalizationController.
- **Dashboards/Reports**: DashboardController, ReportConfigurationController, ReportPlatformController.
- **Misc**: HealthController, NavigationController, PromptSpecificationController, SharedSignatureController.

This is **confirmed**: the codebase implements a configurable authorization/workflow-policy subsystem (permission codes + policy engine), not a fixed role table — see `06-role-authorization-model.md` §6.0 for the full evidence, rather than the hardcoded 7-role model in the QF reference.

## 2.4 Workflow engine
- `service/workflow/`: `WorkflowDefinition.java`, `WorkflowDefinitionProvider.java`, `DocumentsWorkflowDefinitionProvider.java`, `WorkflowRegistryService.java` — a pluggable/definition-driven registry surface. **Confirmed** (see `08-state-machines.md` §8.0): despite this registry existing, the actual legal state-transition graph for Document/Revision/Controlled Copy is hardcoded imperatively inside `DocumentService`/`RevisionService`/`ControlledCopyService` methods, not data-driven through this registry — the registry and `LifecycleStatePolicy`/`WorkflowActionPolicy` tables govern WHO can act, not WHAT the next state is.
- `enums/RevisionWorkflowAction.java`, `enums/ControlledCopyWorkflowAction.java` define the discrete workflow actions per lifecycle — full transition tables confirmed in `07-workflows.md`/`08-state-machines.md`.

## 2.5 Async / eventing
- `event/AsyncEmailRequestedEvent.java`, `MfaOtpEmailRequestedEvent.java` are **confirmed dead code** — constructed nowhere in the codebase, alongside a third dead event (`RevisionSnapshotEvent`). `PublishingWorkspaceOpenedEvent.java` is confirmed genuinely live (published by `PublishingWorkspaceService.openWorkspace`, consumed by `PublishingWorkspaceJobProcessorService`). Full detail: `13-async-scheduler-events.md`.
- `config/AsyncConfig.java` — four dedicated thread pools (`mfaEmailExecutor`, `fileProcessingExecutor`, `controlledCopyBatchExecutor`, `integrationExecutor`), no custom rejection/uncaught-exception handling. Full detail: `13-async-scheduler-events.md`.
- Controlled Copy batch operations run as async services: `ControlledCopyBatchDistributionAsyncService`, `ControlledCopyBatchCancelAsyncService`, `ControlledCopyBatchRecallAsyncService`, plus scheduler `ControlledCopyExpiryScheduler` and reconciliation scanner `ControlledCopyBatchDiscrepancyScanner` (deliberately read-only/non-self-healing). Full trace: `08-state-machines.md` §8.4, `12-transaction-concurrency.md`, `13-async-scheduler-events.md`.

## 2.6 Storage / external integration
- `config/MicrosoftGraphStorageProperties.java` and entities `RevisionOfficeWorkspaceAccess`, `RevisionSharePointSyncWorker` confirm real Microsoft Graph/SharePoint/Office Online integration for in-place document editing (with a confirmed concurrency gap: no version check against the Graph item's own etag before write-back). Storage backend is confirmed **PostgreSQL-adjacent object storage via MinIO** (real, WORM/Object-Lock-enforced) plus a real NAS/SMB path; several other "provider" options (AWS S3, Azure, GCP, Google Drive, OneDrive, generic SharePoint, Dropbox) are **confirmed simulated only** (no real SDK client exists). Full detail: `17-file-storage.md`, `18-external-integrations.md`.

## Confirmed (previously UNKNOWN)
- **Database engine / migration tool**: **PostgreSQL** (`org.postgresql:postgresql` driver, `jdbc:postgresql://...` in `application.properties`) with **Flyway** (`flyway-database-postgresql` dependency; migrations `V6` through `V380`+ under `src/main/resources/db/migration`), connection pooling via HikariCP (`spring.datasource.hikari.*`).

## Still UNKNOWN
- Exact Spring Security filter chain order (`SecurityConfig` detail).
- Frontend build/deploy topology beyond the API/service layer already traced (Docker bakes source; dev servers on :3000 — per prior session memory, not re-verified this pass).

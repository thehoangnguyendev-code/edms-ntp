---
name: eqms
description: "Skill for the Eqms area of eqms-backend. 387 symbols across 76 files."
---

# Eqms

387 symbols | 76 files | Cohesion: 62%

## When to Use

- Working with code in `src/`
- Understanding how WorkflowParticipant, SodConstraint, RevisionWorkflowParticipant work
- Modifying eqms-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/test/java/com/eqms/SecureFileAccessServiceTest.java` | notSuperAdmin, superAdmin, grantPermission, denyPermission, draftRevisionCtx (+35) |
| `src/test/java/com/eqms/WorkflowActionPolicyControllerSecurityTest.java` | setupViewUser, createDocumentTypeOverride_withoutManagePermission_throws403, createDocumentTypeOverride_withManagePermission_reachesService, duplicatePolicy_withoutManagePermission_throws403, duplicatePolicy_withManagePermission_reachesService (+29) |
| `src/test/java/com/eqms/RevisionWorkflowAuthorizationServiceTest.java` | revision, notSuperAdmin, superAdmin, setupNormalUser, check_nullUser_returnsAuthRequired (+27) |
| `src/test/java/com/eqms/ControlledCopyAuthorizationServiceTest.java` | requestCopy_revisionEffective_userHasPermission_allowed, requestCopy_accessProfileWithoutExplicitCode_denied, requestCopy_revisionDraft_denied_REVISION_NOT_EFFECTIVE, requestCopy_documentInactive_denied_DOCUMENT_NOT_ACTIVE, downloadFile_downloadDisabled_denied_DOWNLOAD_NOT_ALLOWED_BY_POLICY (+20) |
| `src/test/java/com/eqms/AccessProfileServiceSecurityTest.java` | allowManage, allowManageAndAssign, assignUser_updatePermissionAlone_isDenied, addPermissionSet_deniedForSystemSuperAdminProfile_doesNotMutate, setPermissionSets_deniedWhenActorAddsCriticalSetToOwnProfile_doesNotMutate (+13) |
| `src/test/java/com/eqms/WorkflowActionPolicyServiceTest.java` | createPolicy_valid_global_succeeds, createPolicy_valid_documentTypeOverride_succeeds, createPolicy_duplicateActiveSamePriority_throwsConflict, createDocumentTypeOverride_copiesSourcePolicy_succeeds, createDocumentTypeOverride_duplicate_throwsConflict (+12) |
| `src/test/java/com/eqms/RevisionWorkflowAuthorizationPolicyRuntimeTest.java` | superAdmin, rt06_superAdmin_invalidState_denied, rt09_dbPolicy_assignedReviewerActor_pendingReviewer_allowed, rt10_dbPolicy_completeAuthoring_stateInvariant_enforced, rt15_superAdmin_publish_invalidState_denied (+11) |
| `src/test/java/com/eqms/DocumentAuthorizationServiceTest.java` | revisionWithStatus, canViewRevision_false_forUnrelatedUserOnDraft, canUploadRevisionSource_false_forCoAuthor, canEditDraftRevision_false_whenNotDraft, canEditDraftRevision_true_forCoAuthor (+11) |
| `src/test/java/com/eqms/StrictParticipantVisibilityTest.java` | fileAccessService, snapshotContext, strictOn_snapshotPreview_deniedForNonParticipant, strictOn_snapshotPreview_allowedForAssignedParticipant, strictOn_snapshotPreview_allowedForAuthor (+8) |
| `src/test/java/com/eqms/LifecycleStatePolicyEvaluatorTest.java` | setup, view_effective_allowedForViewPermissionHolder, view_effective_deniedWithoutViewPermission, view_draft_deniedForNonParticipantEvenWithViewPermission, view_anyStatus_allowedForAuthor (+7) |

## Entry Points

Start here when exploring this area:

- **`WorkflowParticipant`** (Class) — `src/main/java/com/eqms/entity/WorkflowParticipant.java:27`
- **`SodConstraint`** (Class) — `src/main/java/com/eqms/entity/SodConstraint.java:6`
- **`RevisionWorkflowParticipant`** (Class) — `src/main/java/com/eqms/entity/RevisionWorkflowParticipant.java:17`
- **`DocumentsWorkflowDefinitionProvider`** (Class) — `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java:11`
- **`StoragePathBuilder`** (Class) — `src/main/java/com/eqms/service/StoragePathBuilder.java:9`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `WorkflowParticipant` | Class | `src/main/java/com/eqms/entity/WorkflowParticipant.java` | 27 |
| `SodConstraint` | Class | `src/main/java/com/eqms/entity/SodConstraint.java` | 6 |
| `RevisionWorkflowParticipant` | Class | `src/main/java/com/eqms/entity/RevisionWorkflowParticipant.java` | 17 |
| `DocumentsWorkflowDefinitionProvider` | Class | `src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java` | 11 |
| `StoragePathBuilder` | Class | `src/main/java/com/eqms/service/StoragePathBuilder.java` | 9 |
| `StoragePathBuilderTest` | Class | `src/test/java/com/eqms/StoragePathBuilderTest.java` | 8 |
| `WorkflowDefinitionProvider` | Interface | `src/main/java/com/eqms/service/workflow/WorkflowDefinitionProvider.java` | 9 |
| `empty` | Method | `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java` | 20 |
| `of` | Method | `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java` | 26 |
| `allowed` | Method | `src/main/java/com/eqms/dto/security/WorkflowAuthorizationDecision.java` | 17 |
| `denied` | Method | `src/main/java/com/eqms/dto/security/WorkflowAuthorizationDecision.java` | 29 |
| `getEditingStatus` | Method | `src/main/java/com/eqms/entity/DocumentRevisionRecord.java` | 653 |
| `setActionStatus` | Method | `src/main/java/com/eqms/entity/WorkflowParticipant.java` | 123 |
| `getReasonCode` | Method | `src/main/java/com/eqms/exception/WorkflowAuthorizationDeniedException.java` | 38 |
| `getAction` | Method | `src/main/java/com/eqms/exception/WorkflowAuthorizationDeniedException.java` | 40 |
| `findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id` | Method | `src/main/java/com/eqms/repository/WorkflowParticipantRepository.java` | 15 |
| `recordRevisionMismatch` | Method | `src/main/java/com/eqms/service/AuthorizationShadowEvaluationService.java` | 19 |
| `same` | Method | `src/main/java/com/eqms/service/AuthorizationShadowEvaluationService.java` | 37 |
| `evaluateWorkflowAction` | Method | `src/main/java/com/eqms/service/RevisionActionCapabilityService.java` | 95 |
| `resolveRequiredPermissionCode` | Method | `src/main/java/com/eqms/service/RevisionActionCapabilityService.java` | 336 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ProcessItem → Normalize` | cross_community | 10 |
| `ProcessItem → GetPermissionCodes` | cross_community | 10 |
| `CancelDocumentCompat → GetId` | cross_community | 10 |
| `CancelDocumentCompat → Normalize` | cross_community | 10 |
| `CancelDocumentCompat → GetPermissionCodes` | cross_community | 10 |
| `ObsoleteDocument → GetId` | cross_community | 9 |
| `CreateRevisionFromDocument → GetId` | cross_community | 9 |
| `UpgradeRevision → GetId` | cross_community | 9 |
| `SubmitForReview → GetId` | cross_community | 9 |
| `RestoreArchivedDocument → GetId` | cross_community | 9 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 259 calls |
| Entity | 120 calls |
| Controller | 4 calls |
| Security | 1 calls |

## How to Explore

1. `context({name: "WorkflowParticipant"})` — see callers and callees
2. `query({search_query: "eqms"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

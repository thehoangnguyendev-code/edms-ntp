---
name: service
description: "Skill for the Service area of eqms-backend. 2244 symbols across 242 files."
---

# Service

2244 symbols | 242 files | Cohesion: 66%

## When to Use

- Working with code in `src/`
- Understanding how DocumentRecord, DocumentRelation, DocumentRevisionRecord work
- Modifying service-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/service/RevisionService.java` | RevisionService, getRevision, getRevisionForSnapshot, getRevisionSignatures, listWorkingNotes (+132) |
| `src/main/java/com/eqms/service/PublishingOpenXmlTemplateRenderService.java` | replaceDocumentText, replaceTableText, replaceParagraphText, snapshotRuns, applyTextSizingRules (+83) |
| `src/main/java/com/eqms/service/UserManagementService.java` | getRoles, getRoles, getRole, createRole, updateRole (+82) |
| `src/main/java/com/eqms/service/DocumentService.java` | listDocuments, listSelectableTemplates, exportDocuments, getDocumentDetail, getDocumentSignatures (+78) |
| `src/main/java/com/eqms/service/AccessProfileService.java` | listProfiles, listProfiles, listProfiles, listAllProfiles, getProfile (+56) |
| `src/main/java/com/eqms/entity/UserAccount.java` | getId, getUsername, getEmail, getEmployeeCode, getFullName (+56) |
| `src/main/java/com/eqms/service/AuditTrailService.java` | logAs, buildEntitySnapshot, fallbackEntitySnapshot, buildRevisionObjectCode, humanizeField (+54) |
| `src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java` | requireRequestControlledCopy, matchesWorkflowRole, require, diagnoseCopyAction, requirePreviewAccess (+51) |
| `src/main/java/com/eqms/service/FileStorageService.java` | readFile, storeFile, storeFile, storePreviewFile, storePreviewFile (+45) |
| `src/main/java/com/eqms/service/StoragePathBuilder.java` | revisionSource, revisionReviewPdf, revisionPublishedPdf, revisionPublishingWorkingFile, revisionPublishingWorkingFile (+42) |

## Entry Points

Start here when exploring this area:

- **`DocumentRecord`** (Class) — `src/main/java/com/eqms/entity/DocumentRecord.java:18`
- **`DocumentRelation`** (Class) — `src/main/java/com/eqms/entity/DocumentRelation.java:17`
- **`DocumentRevisionRecord`** (Class) — `src/main/java/com/eqms/entity/DocumentRevisionRecord.java:16`
- **`DocumentStatusDefinition`** (Class) — `src/main/java/com/eqms/entity/DocumentStatusDefinition.java:11`
- **`RevisionStatusDefinition`** (Class) — `src/main/java/com/eqms/entity/RevisionStatusDefinition.java:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DocumentRecord` | Class | `src/main/java/com/eqms/entity/DocumentRecord.java` | 18 |
| `DocumentRelation` | Class | `src/main/java/com/eqms/entity/DocumentRelation.java` | 17 |
| `DocumentRevisionRecord` | Class | `src/main/java/com/eqms/entity/DocumentRevisionRecord.java` | 16 |
| `DocumentStatusDefinition` | Class | `src/main/java/com/eqms/entity/DocumentStatusDefinition.java` | 11 |
| `RevisionStatusDefinition` | Class | `src/main/java/com/eqms/entity/RevisionStatusDefinition.java` | 11 |
| `RevisionService` | Class | `src/main/java/com/eqms/service/RevisionService.java` | 123 |
| `AccessProfilePermissionSet` | Class | `src/main/java/com/eqms/entity/AccessProfilePermissionSet.java` | 6 |
| `AccessProfileWorkflowRole` | Class | `src/main/java/com/eqms/entity/AccessProfileWorkflowRole.java` | 8 |
| `RoleDefinition` | Class | `src/main/java/com/eqms/entity/RoleDefinition.java` | 14 |
| `UserAccessProfile` | Class | `src/main/java/com/eqms/entity/UserAccessProfile.java` | 8 |
| `PermissionSet` | Class | `src/main/java/com/eqms/entity/PermissionSet.java` | 8 |
| `PermissionSetItem` | Class | `src/main/java/com/eqms/entity/PermissionSetItem.java` | 5 |
| `StorageLocation` | Class | `src/main/java/com/eqms/entity/StorageLocation.java` | 14 |
| `RetentionPolicy` | Class | `src/main/java/com/eqms/entity/RetentionPolicy.java` | 14 |
| `WorkflowActionDefaultPolicyRegistry` | Class | `src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java` | 12 |
| `DocumentService` | Class | `src/main/java/com/eqms/service/DocumentService.java` | 106 |
| `requireCurrentUser` | Method | `src/main/java/com/eqms/auth/CurrentUserService.java` | 30 |
| `parseSignatureToken` | Method | `src/main/java/com/eqms/auth/TokenService.java` | 84 |
| `getRequestContext` | Method | `src/main/java/com/eqms/controller/ControlledCopyController.java` | 193 |
| `listDocuments` | Method | `src/main/java/com/eqms/controller/DocumentController.java` | 64 |

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
| Entity | 698 calls |
| Eqms | 140 calls |
| Repository | 14 calls |
| Util | 13 calls |
| Controller | 6 calls |
| Config | 4 calls |
| Workmanagement | 1 calls |
| Auth | 1 calls |

## How to Explore

1. `context({name: "DocumentRecord"})` — see callers and callees
2. `query({search_query: "service"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

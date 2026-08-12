---
name: entity
description: "Skill for the Entity area of eqms-backend. 2414 symbols across 225 files."
---

# Entity

2414 symbols | 225 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how DocumentSubType, Position, KnowledgeBaseFolderBuilder work
- Modifying entity-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/entity/ControlledCopyRecord.java` | getId, getDocument, getRevision, getDistributionBatch, getControlledCopyNumber (+110) |
| `src/main/java/com/eqms/entity/DocumentRevisionRecord.java` | getValidUntil, getTitleLocalLanguage, getDocumentType, getBusinessUnit, getDepartment (+103) |
| `src/main/java/com/eqms/service/ControlledCopyService.java` | list, export, getById, getControlledCopyDetail, getControlledCopyResolvedDetail (+96) |
| `src/main/java/com/eqms/entity/PublishingTemplateVersion.java` | PublishingTemplateVersion, setTemplate, setVersionNumber, setTemplateName, setDocumentType (+73) |
| `src/main/java/com/eqms/entity/PublishingTemplate.java` | PublishingTemplate, getTemplateName, setTemplateName, getDocumentType, setDocumentType (+70) |
| `src/main/java/com/eqms/service/DictionaryManagementService.java` | listBusinessUnits, createBusinessUnit, updateBusinessUnit, deleteBusinessUnit, listDepartments (+61) |
| `src/main/java/com/eqms/entity/DocumentRecord.java` | getTitleLocalLanguage, getVersion, getDocumentType, getBusinessUnit, getDepartment (+49) |
| `src/main/java/com/eqms/entity/ElectronicSignature.java` | getId, setDocument, setRevision, setEntityType, setEntityId (+46) |
| `src/main/java/com/eqms/entity/ControlledCopyDistributionBatch.java` | getId, getBatchNumber, getDocument, getRevision, getDocumentNumber (+44) |
| `src/main/java/com/eqms/entity/AuditLog.java` | AuditLog, setEntityType, setEntityId, setEntityName, setEventTime (+37) |

## Entry Points

Start here when exploring this area:

- **`DocumentSubType`** (Class) — `src/main/java/com/eqms/entity/DocumentSubType.java:17`
- **`Position`** (Class) — `src/main/java/com/eqms/entity/Position.java:17`
- **`KnowledgeBaseFolderBuilder`** (Class) — `src/main/java/com/eqms/service/DocumentService.java:2436`
- **`PublishingTemplate`** (Class) — `src/main/java/com/eqms/entity/PublishingTemplate.java:14`
- **`RevisionPublishingMetadata`** (Class) — `src/main/java/com/eqms/entity/RevisionPublishingMetadata.java:17`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DocumentSubType` | Class | `src/main/java/com/eqms/entity/DocumentSubType.java` | 17 |
| `Position` | Class | `src/main/java/com/eqms/entity/Position.java` | 17 |
| `KnowledgeBaseFolderBuilder` | Class | `src/main/java/com/eqms/service/DocumentService.java` | 2436 |
| `PublishingTemplate` | Class | `src/main/java/com/eqms/entity/PublishingTemplate.java` | 14 |
| `RevisionPublishingMetadata` | Class | `src/main/java/com/eqms/entity/RevisionPublishingMetadata.java` | 17 |
| `EmailTemplateVersion` | Class | `src/main/java/com/eqms/entity/EmailTemplateVersion.java` | 20 |
| `WorkflowActionPolicy` | Class | `src/main/java/com/eqms/entity/WorkflowActionPolicy.java` | 8 |
| `WorkflowActionPolicyActor` | Class | `src/main/java/com/eqms/entity/WorkflowActionPolicyActor.java` | 7 |
| `UserAccount` | Class | `src/main/java/com/eqms/entity/UserAccount.java` | 18 |
| `AuthSession` | Class | `src/main/java/com/eqms/entity/AuthSession.java` | 18 |
| `PublishingTemplateVersion` | Class | `src/main/java/com/eqms/entity/PublishingTemplateVersion.java` | 16 |
| `AuditLog` | Class | `src/main/java/com/eqms/entity/AuditLog.java` | 20 |
| `DocumentWorkflowSetting` | Class | `src/main/java/com/eqms/entity/DocumentWorkflowSetting.java` | 14 |
| `NotificationEventDefinition` | Class | `src/main/java/com/eqms/entity/NotificationEventDefinition.java` | 18 |
| `NotificationPolicy` | Class | `src/main/java/com/eqms/entity/NotificationPolicy.java` | 22 |
| `RevisionWorkspaceItem` | Class | `src/main/java/com/eqms/entity/RevisionWorkspaceItem.java` | 15 |
| `EmailTemplate` | Class | `src/main/java/com/eqms/entity/EmailTemplate.java` | 18 |
| `ElectronicSignature` | Class | `src/main/java/com/eqms/entity/ElectronicSignature.java` | 16 |
| `NotificationTemplateVersion` | Class | `src/main/java/com/eqms/entity/NotificationTemplateVersion.java` | 20 |
| `PublishingTemplatePlaceholderStyle` | Class | `src/main/java/com/eqms/entity/PublishingTemplatePlaceholderStyle.java` | 18 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DestroyWithEvidence → UnauthorizedException` | cross_community | 7 |
| `CreateDocumentDraft → UnauthorizedException` | cross_community | 7 |
| `ReplaceLostDamaged → ControlledCopyPolicySetting` | cross_community | 6 |
| `CreatePosition → UnauthorizedException` | cross_community | 6 |
| `RequirePreviewAccess → SetEventTime` | cross_community | 6 |
| `RequirePreviewAccess → SetCreatedAt` | cross_community | 6 |
| `RequirePreviewAccess → SetUpdatedAt` | cross_community | 6 |
| `UpdateTemplateComponent → SanitizeLeafSegment` | cross_community | 6 |
| `UploadComponent → Text` | cross_community | 6 |
| `UploadComponent → SanitizeSegment` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 1102 calls |
| Eqms | 80 calls |
| Repository | 20 calls |
| Auth | 11 calls |
| Controller | 4 calls |
| Workmanagement | 2 calls |
| Util | 1 calls |

## How to Explore

1. `context({name: "DocumentSubType"})` — see callers and callees
2. `query({search_query: "entity"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

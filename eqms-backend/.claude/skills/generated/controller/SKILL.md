---
name: controller
description: "Skill for the Controller area of eqms-backend. 99 symbols across 35 files."
---

# Controller

99 symbols | 35 files | Cohesion: 63%

## When to Use

- Working with code in `src/`
- Understanding how savePlaceholderStyles, deletePlaceholderStyle, createTemplate work
- Modifying controller-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/controller/PublishingTemplateController.java` | savePlaceholderStyles, deletePlaceholderStyle, createTemplate, updateTemplate, duplicateTemplate (+12) |
| `src/main/java/com/eqms/controller/EmailTemplateController.java` | getTemplateById, getVersionHistory, previewTemplate, previewDraftTemplate, requireViewPermission (+8) |
| `src/main/java/com/eqms/controller/SettingsUserController.java` | getPermissionCatalog, updateSystemConfiguration, testStorageConnection, testSmtpConnection, browseSharePointFolders (+3) |
| `src/main/java/com/eqms/controller/PublishingWorkspaceController.java` | getWorkspace, getPreview, generatePreview, openWorkspace, publish (+1) |
| `src/main/java/com/eqms/controller/AuthController.java` | login, reauthenticate, refresh, verifyMfa, setTokenCookies (+1) |
| `src/main/java/com/eqms/controller/NotificationPolicyController.java` | createEvent, deleteEvent, updatePolicy, updateTemplate, restoreVersion (+1) |
| `src/main/java/com/eqms/entity/Permission.java` | getCategory, getDescription, getDisplayOrder |
| `src/main/java/com/eqms/controller/NavigationController.java` | getNavigation, searchNavigation, resolvePermissions |
| `src/main/java/com/eqms/service/PublishingTemplateService.java` | deleteTemplate, getVersionHistory |
| `src/main/java/com/eqms/service/PublishingPlaceholderCatalogService.java` | getAvailablePlaceholders, item |

## Entry Points

Start here when exploring this area:

- **`savePlaceholderStyles`** (Method) — `src/main/java/com/eqms/controller/PublishingTemplateController.java:100`
- **`deletePlaceholderStyle`** (Method) — `src/main/java/com/eqms/controller/PublishingTemplateController.java:109`
- **`createTemplate`** (Method) — `src/main/java/com/eqms/controller/PublishingTemplateController.java:121`
- **`updateTemplate`** (Method) — `src/main/java/com/eqms/controller/PublishingTemplateController.java:127`
- **`duplicateTemplate`** (Method) — `src/main/java/com/eqms/controller/PublishingTemplateController.java:133`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `savePlaceholderStyles` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 100 |
| `deletePlaceholderStyle` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 109 |
| `createTemplate` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 121 |
| `updateTemplate` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 127 |
| `duplicateTemplate` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 133 |
| `toggleStatus` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 139 |
| `deleteTemplate` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 145 |
| `uploadComponent` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 152 |
| `deleteComponent` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 163 |
| `publishTemplate` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 207 |
| `requireEditPermission` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 223 |
| `deleteTemplate` | Method | `src/main/java/com/eqms/service/PublishingTemplateService.java` | 224 |
| `getTemplate` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 72 |
| `getVersions` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 78 |
| `getAvailablePlaceholders` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 84 |
| `listPlaceholderStyles` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 90 |
| `inspectComponent` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 196 |
| `requireViewPermission` | Method | `src/main/java/com/eqms/controller/PublishingTemplateController.java` | 216 |
| `findByTemplate_IdOrderByVersionNumberDesc` | Method | `src/main/java/com/eqms/repository/PublishingTemplateVersionRepository.java` | 10 |
| `getAvailablePlaceholders` | Method | `src/main/java/com/eqms/service/PublishingPlaceholderCatalogService.java` | 12 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateEvent → GetId` | cross_community | 7 |
| `CreateEvent → Denied` | cross_community | 6 |
| `CreateEvent → GetStatus` | cross_community | 6 |
| `CreateEvent → Allowed` | cross_community | 6 |
| `ListPlaceholderStyles → GetId` | cross_community | 6 |
| `UploadComponent → Text` | cross_community | 6 |
| `UploadComponent → SanitizeSegment` | cross_community | 6 |
| `TestStorageConnection → IsLoopbackEndpoint` | cross_community | 6 |
| `Publish → SetStatus` | cross_community | 5 |
| `Publish → SetMessage` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 48 calls |
| Entity | 43 calls |
| Eqms | 11 calls |
| Repository | 2 calls |

## How to Explore

1. `context({name: "savePlaceholderStyles"})` — see callers and callees
2. `query({search_query: "controller"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

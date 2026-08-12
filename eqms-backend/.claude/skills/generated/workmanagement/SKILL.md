---
name: workmanagement
description: "Skill for the Workmanagement area of eqms-backend. 51 symbols across 4 files."
---

# Workmanagement

51 symbols | 4 files | Cohesion: 62%

## When to Use

- Working with code in `src/`
- Understanding how UserAccountProxy, requirePermission, isWorkAdmin work
- Modifying workmanagement-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | addMember, updateSidebarProjectOrder, listProjectIssues, listMyIssues, getIssue (+25) |
| `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | addMember, updateSidebarOrder, projectIssues, myIssues, issue (+7) |
| `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java` | requirePermission, isWorkAdmin, requireProjectRole, getProjectRole, hasPermission |
| `src/main/java/com/eqms/workmanagement/WorkManagementCapabilityService.java` | getProjectCapabilities, decision, canContribute, canAdminister |

## Entry Points

Start here when exploring this area:

- **`UserAccountProxy`** (Class) — `src/main/java/com/eqms/workmanagement/WorkManagementService.java:246`
- **`requirePermission`** (Method) — `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java:22`
- **`isWorkAdmin`** (Method) — `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java:32`
- **`requireProjectRole`** (Method) — `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java:38`
- **`getProjectRole`** (Method) — `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java:49`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `UserAccountProxy` | Class | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 246 |
| `requirePermission` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java` | 22 |
| `isWorkAdmin` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java` | 32 |
| `requireProjectRole` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java` | 38 |
| `getProjectRole` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementAuthorizationService.java` | 49 |
| `addMember` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | 23 |
| `updateSidebarOrder` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | 24 |
| `projectIssues` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | 27 |
| `myIssues` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | 29 |
| `issue` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | 30 |
| `history` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementController.java` | 32 |
| `addMember` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 71 |
| `updateSidebarProjectOrder` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 81 |
| `listProjectIssues` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 123 |
| `listMyIssues` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 130 |
| `getIssue` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 167 |
| `history` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 189 |
| `requireProjectId` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 199 |
| `issueSql` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 209 |
| `issue` | Method | `src/main/java/com/eqms/workmanagement/WorkManagementService.java` | 224 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateProject → GetId` | cross_community | 7 |
| `CreateIssue → GetId` | cross_community | 7 |
| `Projects → GetId` | cross_community | 7 |
| `ProjectIssues → GetId` | cross_community | 7 |
| `MyIssues → GetId` | cross_community | 7 |
| `Issue → GetId` | cross_community | 7 |
| `UpdateSidebarOrder → GetId` | cross_community | 7 |
| `Transition → GetId` | cross_community | 7 |
| `CreateProject → Normalize` | cross_community | 6 |
| `CreateIssue → Normalize` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 25 calls |
| Eqms | 1 calls |

## How to Explore

1. `context({name: "UserAccountProxy"})` — see callers and callees
2. `query({search_query: "workmanagement"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

---
name: repository
description: "Skill for the Repository area of eqms-backend. 44 symbols across 26 files."
---

# Repository

44 symbols | 26 files | Cohesion: 60%

## When to Use

- Working with code in `src/`
- Understanding how toWorkflowRoleCode, findAllByDocument_IdOrderBySequenceOrderAsc, findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc work
- Modifying repository-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/service/DocumentService.java` | requirePoolMembership, permanentlyDeleteDocument, resolveBusinessUnit, resolveDepartment |
| `src/main/java/com/eqms/repository/DocumentRecordRepository.java` | countByStatus_Code, countDocumentsGroupedByMonth, countDocumentsGroupedByQuarter, countDocumentsGroupedByYear |
| `src/main/java/com/eqms/service/ControlledCopyService.java` | resolveBusinessUnit, nextDocumentControlledCopySequence, extractControlledCopySequence, resolveDepartment |
| `src/main/java/com/eqms/repository/ControlledCopyRepository.java` | findAllByRevision_IdOrderByCopyNumberAsc, findAllByRevision_Document_IdOrderByCreatedAtDesc, countByCreatedAtIsNotNull |
| `src/main/java/com/eqms/repository/DocumentWorkflowParticipantRepository.java` | findAllByDocument_IdOrderBySequenceOrderAsc, deleteAllByDocument_Id |
| `src/main/java/com/eqms/controller/DashboardController.java` | getAdminStats, getDocumentActivity |
| `src/main/java/com/eqms/repository/AuditLogRepository.java` | countEventsLast30Days, countAuditEventsGroupedByDay |
| `src/main/java/com/eqms/service/DashboardService.java` | getAdminStats, getDocumentActivity |
| `src/main/java/com/eqms/service/WorkflowRoleService.java` | listAll, requireView |
| `src/main/java/com/eqms/repository/BusinessUnitRepository.java` | findByNameIgnoreCase, findByCodeIgnoreCase |

## Entry Points

Start here when exploring this area:

- **`toWorkflowRoleCode`** (Method) — `src/main/java/com/eqms/config/WorkflowPoolMapping.java:13`
- **`findAllByDocument_IdOrderBySequenceOrderAsc`** (Method) — `src/main/java/com/eqms/repository/DocumentWorkflowParticipantRepository.java:11`
- **`findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc`** (Method) — `src/main/java/com/eqms/repository/DocumentWorkflowPoolMemberRepository.java:10`
- **`countByRevision_Document_IdAndUser_Id`** (Method) — `src/main/java/com/eqms/repository/RevisionWorkflowParticipantRepository.java:14`
- **`findUserIdsByWorkflowRole`** (Method) — `src/main/java/com/eqms/repository/UserAccessProfileRepository.java:38`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `toWorkflowRoleCode` | Method | `src/main/java/com/eqms/config/WorkflowPoolMapping.java` | 13 |
| `findAllByDocument_IdOrderBySequenceOrderAsc` | Method | `src/main/java/com/eqms/repository/DocumentWorkflowParticipantRepository.java` | 11 |
| `findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc` | Method | `src/main/java/com/eqms/repository/DocumentWorkflowPoolMemberRepository.java` | 10 |
| `countByRevision_Document_IdAndUser_Id` | Method | `src/main/java/com/eqms/repository/RevisionWorkflowParticipantRepository.java` | 14 |
| `findUserIdsByWorkflowRole` | Method | `src/main/java/com/eqms/repository/UserAccessProfileRepository.java` | 38 |
| `matchesDocumentWorkflowPool` | Method | `src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java` | 840 |
| `requirePoolMembership` | Method | `src/main/java/com/eqms/service/DocumentService.java` | 2171 |
| `canViewRevision` | Method | `src/main/java/com/eqms/service/ObjectAccessEvaluationService.java` | 66 |
| `getAdminStats` | Method | `src/main/java/com/eqms/controller/DashboardController.java` | 53 |
| `countEventsLast30Days` | Method | `src/main/java/com/eqms/repository/AuditLogRepository.java` | 38 |
| `countAuditEventsGroupedByDay` | Method | `src/main/java/com/eqms/repository/AuditLogRepository.java` | 44 |
| `countByStatus_Code` | Method | `src/main/java/com/eqms/repository/DocumentRecordRepository.java` | 18 |
| `countByStatus_Code` | Method | `src/main/java/com/eqms/repository/DocumentRevisionRepository.java` | 23 |
| `countByStatus` | Method | `src/main/java/com/eqms/repository/UserAccountRepository.java` | 17 |
| `getAdminStats` | Method | `src/main/java/com/eqms/service/DashboardService.java` | 81 |
| `getDocumentActivity` | Method | `src/main/java/com/eqms/controller/DashboardController.java` | 35 |
| `countDocumentsGroupedByMonth` | Method | `src/main/java/com/eqms/repository/DocumentRecordRepository.java` | 20 |
| `countDocumentsGroupedByQuarter` | Method | `src/main/java/com/eqms/repository/DocumentRecordRepository.java` | 30 |
| `countDocumentsGroupedByYear` | Method | `src/main/java/com/eqms/repository/DocumentRecordRepository.java` | 40 |
| `getDocumentActivity` | Method | `src/main/java/com/eqms/service/DashboardService.java` | 58 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 23 calls |
| Entity | 9 calls |
| Eqms | 3 calls |

## How to Explore

1. `context({name: "toWorkflowRoleCode"})` — see callers and callees
2. `query({search_query: "repository"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

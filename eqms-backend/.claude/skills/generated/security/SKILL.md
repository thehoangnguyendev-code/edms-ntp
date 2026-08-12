---
name: security
description: "Skill for the Security area of eqms-backend. 4 symbols across 2 files."
---

# Security

4 symbols | 2 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how getBool, getString, validateWorkflowState work
- Modifying security-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java` | getBool, getString |
| `src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java` | validateWorkflowState, stateError |

## Entry Points

Start here when exploring this area:

- **`getBool`** (Method) — `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java:48`
- **`getString`** (Method) — `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java:54`
- **`validateWorkflowState`** (Method) — `src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java:282`
- **`stateError`** (Method) — `src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java:379`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getBool` | Method | `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java` | 48 |
| `getString` | Method | `src/main/java/com/eqms/dto/security/RevisionWorkflowAuthorizationContext.java` | 54 |
| `validateWorkflowState` | Method | `src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java` | 282 |
| `stateError` | Method | `src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java` | 379 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Eqms | 2 calls |

## How to Explore

1. `context({name: "getBool"})` — see callers and callees
2. `query({search_query: "security"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

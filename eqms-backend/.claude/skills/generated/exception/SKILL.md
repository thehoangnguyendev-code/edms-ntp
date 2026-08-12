---
name: exception
description: "Skill for the Exception area of eqms-backend. 6 symbols across 3 files."
---

# Exception

6 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how handleRevisionWorkspaceBatchValidation, getIssues, handleRelatedDocumentsNotEffective work
- Modifying exception-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/exception/GlobalExceptionHandler.java` | handleRevisionWorkspaceBatchValidation, handleRelatedDocumentsNotEffective, handleDataIntegrity, resolveDataIntegrityMessage |
| `src/main/java/com/eqms/exception/RevisionWorkspaceBatchValidationException.java` | getIssues |
| `src/main/java/com/eqms/exception/RelatedDocumentsNotEffectiveException.java` | getDetails |

## Entry Points

Start here when exploring this area:

- **`handleRevisionWorkspaceBatchValidation`** (Method) — `src/main/java/com/eqms/exception/GlobalExceptionHandler.java:108`
- **`getIssues`** (Method) — `src/main/java/com/eqms/exception/RevisionWorkspaceBatchValidationException.java:13`
- **`handleRelatedDocumentsNotEffective`** (Method) — `src/main/java/com/eqms/exception/GlobalExceptionHandler.java:124`
- **`getDetails`** (Method) — `src/main/java/com/eqms/exception/RelatedDocumentsNotEffectiveException.java:12`
- **`handleDataIntegrity`** (Method) — `src/main/java/com/eqms/exception/GlobalExceptionHandler.java:136`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `handleRevisionWorkspaceBatchValidation` | Method | `src/main/java/com/eqms/exception/GlobalExceptionHandler.java` | 108 |
| `getIssues` | Method | `src/main/java/com/eqms/exception/RevisionWorkspaceBatchValidationException.java` | 13 |
| `handleRelatedDocumentsNotEffective` | Method | `src/main/java/com/eqms/exception/GlobalExceptionHandler.java` | 124 |
| `getDetails` | Method | `src/main/java/com/eqms/exception/RelatedDocumentsNotEffectiveException.java` | 12 |
| `handleDataIntegrity` | Method | `src/main/java/com/eqms/exception/GlobalExceptionHandler.java` | 136 |
| `resolveDataIntegrityMessage` | Method | `src/main/java/com/eqms/exception/GlobalExceptionHandler.java` | 201 |

## How to Explore

1. `context({name: "handleRevisionWorkspaceBatchValidation"})` — see callers and callees
2. `query({search_query: "exception"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

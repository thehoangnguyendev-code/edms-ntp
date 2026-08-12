---
name: config
description: "Skill for the Config area of eqms-backend. 6 symbols across 2 files."
---

# Config

6 symbols | 2 files | Cohesion: 59%

## When to Use

- Working with code in `src/`
- Understanding how getTenantId, getClientId, getClientSecret work
- Modifying config-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java` | getTenantId, getClientId, getClientSecret |
| `src/main/java/com/eqms/service/MicrosoftGraphStorageService.java` | isConfigured, hasConfiguredValue, generatePdfPreview |

## Entry Points

Start here when exploring this area:

- **`getTenantId`** (Method) — `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java:26`
- **`getClientId`** (Method) — `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java:34`
- **`getClientSecret`** (Method) — `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java:42`
- **`isConfigured`** (Method) — `src/main/java/com/eqms/service/MicrosoftGraphStorageService.java:48`
- **`hasConfiguredValue`** (Method) — `src/main/java/com/eqms/service/MicrosoftGraphStorageService.java:55`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getTenantId` | Method | `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java` | 26 |
| `getClientId` | Method | `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java` | 34 |
| `getClientSecret` | Method | `src/main/java/com/eqms/config/MicrosoftGraphStorageProperties.java` | 42 |
| `isConfigured` | Method | `src/main/java/com/eqms/service/MicrosoftGraphStorageService.java` | 48 |
| `hasConfiguredValue` | Method | `src/main/java/com/eqms/service/MicrosoftGraphStorageService.java` | 55 |
| `generatePdfPreview` | Method | `src/main/java/com/eqms/service/MicrosoftGraphStorageService.java` | 256 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 2 calls |
| Entity | 1 calls |

## How to Explore

1. `context({name: "getTenantId"})` — see callers and callees
2. `query({search_query: "config"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

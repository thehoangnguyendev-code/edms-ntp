---
name: bootstrap
description: "Skill for the Bootstrap area of eqms-backend. 8 symbols across 2 files."
---

# Bootstrap

8 symbols | 2 files | Cohesion: 58%

## When to Use

- Working with code in `src/`
- Understanding how run, seedSampleTemplates, templateSeeds work
- Modifying bootstrap-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java` | run, seedSampleTemplates, templateSeeds, vars |
| `src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java` | run, seedUsers, seedEducationAndCertifications, userSeeds |

## Entry Points

Start here when exploring this area:

- **`run`** (Method) — `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java:33`
- **`seedSampleTemplates`** (Method) — `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java:40`
- **`templateSeeds`** (Method) — `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java:103`
- **`vars`** (Method) — `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java:426`
- **`run`** (Method) — `src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java:76`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `run` | Method | `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java` | 33 |
| `seedSampleTemplates` | Method | `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java` | 40 |
| `templateSeeds` | Method | `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java` | 103 |
| `vars` | Method | `src/main/java/com/eqms/bootstrap/EmailTemplateBootstrap.java` | 426 |
| `run` | Method | `src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java` | 76 |
| `seedUsers` | Method | `src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java` | 164 |
| `seedEducationAndCertifications` | Method | `src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java` | 218 |
| `userSeeds` | Method | `src/main/java/com/eqms/bootstrap/SettingsSeedBootstrap.java` | 371 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Entity | 7 calls |
| Service | 2 calls |

## How to Explore

1. `context({name: "run"})` — see callers and callees
2. `query({search_query: "bootstrap"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

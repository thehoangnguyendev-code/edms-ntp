---
name: util
description: "Skill for the Util area of eqms-backend. 22 symbols across 9 files."
---

# Util

22 symbols | 9 files | Cohesion: 65%

## When to Use

- Working with code in `src/`
- Understanding how listPaged, listPaged, listPaged work
- Modifying util-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | defaultPreferences, normalizePreferences, parsePreferences, serializePreferences, normalizeKey (+5) |
| `src/main/java/com/eqms/util/DateRangeFilter.java` | matches, startOfDay, startOfNextDay, parse |
| `src/main/java/com/eqms/service/LifecycleStatePolicyService.java` | listPaged, StringHelperHasText |
| `src/main/java/com/eqms/controller/AccessReviewController.java` | listPaged |
| `src/main/java/com/eqms/controller/LifecycleStatePolicyController.java` | listPaged |
| `src/main/java/com/eqms/controller/SodConstraintController.java` | listPaged |
| `src/main/java/com/eqms/service/AccessReviewService.java` | listPaged |
| `src/main/java/com/eqms/service/SodConstraintService.java` | listPaged |
| `src/main/java/com/eqms/util/PagedList.java` | paginate |

## Entry Points

Start here when exploring this area:

- **`listPaged`** (Method) — `src/main/java/com/eqms/controller/AccessReviewController.java:26`
- **`listPaged`** (Method) — `src/main/java/com/eqms/controller/LifecycleStatePolicyController.java:22`
- **`listPaged`** (Method) — `src/main/java/com/eqms/controller/SodConstraintController.java:22`
- **`listPaged`** (Method) — `src/main/java/com/eqms/service/AccessReviewService.java:80`
- **`listPaged`** (Method) — `src/main/java/com/eqms/service/LifecycleStatePolicyService.java:74`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `listPaged` | Method | `src/main/java/com/eqms/controller/AccessReviewController.java` | 26 |
| `listPaged` | Method | `src/main/java/com/eqms/controller/LifecycleStatePolicyController.java` | 22 |
| `listPaged` | Method | `src/main/java/com/eqms/controller/SodConstraintController.java` | 22 |
| `listPaged` | Method | `src/main/java/com/eqms/service/AccessReviewService.java` | 80 |
| `listPaged` | Method | `src/main/java/com/eqms/service/LifecycleStatePolicyService.java` | 74 |
| `StringHelperHasText` | Method | `src/main/java/com/eqms/service/LifecycleStatePolicyService.java` | 115 |
| `listPaged` | Method | `src/main/java/com/eqms/service/SodConstraintService.java` | 55 |
| `matches` | Method | `src/main/java/com/eqms/util/DateRangeFilter.java` | 13 |
| `startOfDay` | Method | `src/main/java/com/eqms/util/DateRangeFilter.java` | 22 |
| `startOfNextDay` | Method | `src/main/java/com/eqms/util/DateRangeFilter.java` | 27 |
| `parse` | Method | `src/main/java/com/eqms/util/DateRangeFilter.java` | 32 |
| `paginate` | Method | `src/main/java/com/eqms/util/PagedList.java` | 12 |
| `defaultPreferences` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 46 |
| `normalizePreferences` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 53 |
| `parsePreferences` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 84 |
| `serializePreferences` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 96 |
| `normalizeKey` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 159 |
| `canReceiveInAppNotification` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 104 |
| `canReceiveEmailNotification` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 108 |
| `isChannelEnabled` | Method | `src/main/java/com/eqms/util/NotificationPreferenceUtils.java` | 112 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 7 calls |
| Eqms | 1 calls |

## How to Explore

1. `context({name: "listPaged"})` — see callers and callees
2. `query({search_query: "util"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

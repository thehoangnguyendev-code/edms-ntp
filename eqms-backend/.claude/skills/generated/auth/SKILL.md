---
name: auth
description: "Skill for the Auth area of eqms-backend. 41 symbols across 11 files."
---

# Auth

41 symbols | 11 files | Cohesion: 60%

## When to Use

- Working with code in `src/`
- Understanding how MfaFactor, doFilterInternal, writeSessionLockedResponse work
- Modifying auth-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/main/java/com/eqms/auth/AuthTokenFilter.java` | doFilterInternal, writeSessionLockedResponse, writePasswordExpiredResponse, isMaintenanceBlocked, isAuthEndpoint (+2) |
| `src/main/java/com/eqms/auth/TotpService.java` | generateSecret, createOtpAuthUri, base32Encode, urlEncode, verify (+2) |
| `src/main/java/com/eqms/entity/MfaFactor.java` | MfaFactor, setUser, setMethod, setSecretEncrypted, getSecretEncrypted (+1) |
| `src/main/java/com/eqms/entity/AuthSession.java` | isActive, getCreatedAt, getLastActivityAt, getExpiresAt, setLockedAt |
| `src/main/java/com/eqms/auth/TokenService.java` | parseAccessToken, parseToken, toAuthorities |
| `src/main/java/com/eqms/service/AuthService.java` | setupMfa, enableMfa, toMfaMethod |
| `src/main/java/com/eqms/auth/CurrentUserService.java` | findUserById, findUserByUsername, findUserByFullName |
| `src/main/java/com/eqms/controller/AuthController.java` | setupMfa, enableMfa |
| `src/main/java/com/eqms/service/ControlledCopyService.java` | resolveUserReference, resolveOptionalUserReference |
| `src/test/java/com/eqms/auth/RateLimitFilterTest.java` | returns429OnTheSixthLoginAttempt, filterLogin |

## Entry Points

Start here when exploring this area:

- **`MfaFactor`** (Class) — `src/main/java/com/eqms/entity/MfaFactor.java:19`
- **`doFilterInternal`** (Method) — `src/main/java/com/eqms/auth/AuthTokenFilter.java:54`
- **`writeSessionLockedResponse`** (Method) — `src/main/java/com/eqms/auth/AuthTokenFilter.java:171`
- **`writePasswordExpiredResponse`** (Method) — `src/main/java/com/eqms/auth/AuthTokenFilter.java:188`
- **`isMaintenanceBlocked`** (Method) — `src/main/java/com/eqms/auth/AuthTokenFilter.java:222`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `MfaFactor` | Class | `src/main/java/com/eqms/entity/MfaFactor.java` | 19 |
| `doFilterInternal` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 54 |
| `writeSessionLockedResponse` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 171 |
| `writePasswordExpiredResponse` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 188 |
| `isMaintenanceBlocked` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 222 |
| `isAuthEndpoint` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 232 |
| `isMaintenanceExemptRole` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 240 |
| `writeMaintenanceModeResponse` | Method | `src/main/java/com/eqms/auth/AuthTokenFilter.java` | 244 |
| `parseAccessToken` | Method | `src/main/java/com/eqms/auth/TokenService.java` | 80 |
| `parseToken` | Method | `src/main/java/com/eqms/auth/TokenService.java` | 88 |
| `toAuthorities` | Method | `src/main/java/com/eqms/auth/TokenService.java` | 140 |
| `isActive` | Method | `src/main/java/com/eqms/entity/AuthSession.java` | 88 |
| `getCreatedAt` | Method | `src/main/java/com/eqms/entity/AuthSession.java` | 156 |
| `getLastActivityAt` | Method | `src/main/java/com/eqms/entity/AuthSession.java` | 164 |
| `getExpiresAt` | Method | `src/main/java/com/eqms/entity/AuthSession.java` | 172 |
| `setLockedAt` | Method | `src/main/java/com/eqms/entity/AuthSession.java` | 192 |
| `generateSecret` | Method | `src/main/java/com/eqms/auth/TotpService.java` | 17 |
| `createOtpAuthUri` | Method | `src/main/java/com/eqms/auth/TotpService.java` | 23 |
| `base32Encode` | Method | `src/main/java/com/eqms/auth/TotpService.java` | 59 |
| `urlEncode` | Method | `src/main/java/com/eqms/auth/TotpService.java` | 94 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Duplicate → ParseToken` | cross_community | 5 |
| `CreateProfileFull → ParseToken` | cross_community | 4 |
| `CreateProfile → ParseToken` | cross_community | 4 |
| `UpdateProfileConfiguration → ParseToken` | cross_community | 4 |
| `UpdateProfile → ParseToken` | cross_community | 4 |
| `Create → ParseToken` | cross_community | 4 |
| `Update → ParseToken` | cross_community | 4 |
| `Create → ParseToken` | cross_community | 4 |
| `SetupMfa → UnauthorizedException` | cross_community | 4 |
| `Update → ParseToken` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Service | 17 calls |
| Entity | 17 calls |

## How to Explore

1. `context({name: "MfaFactor"})` — see callers and callees
2. `query({search_query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`

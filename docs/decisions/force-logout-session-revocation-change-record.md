# Change Record — Immediate Force Logout Client Enforcement

Status: **IMPLEMENTED** · Scope: Authentication/session revocation and Logged-in Users UI

## Problem

`UserManagementService.forceLogout` revokes every active `AuthSession` and writes both audit
records. `AuthTokenFilter` previously allowed a request whose session was already revoked to
continue without a security context. The resulting anonymous authorization failure could surface
in the current SPA as a generic data-load error. When an administrator force-logged out their own
account, the Logged-in Users screen also reloaded its table before clearing local credentials.

## Invariant

- The initiating actor must still pass `settings.user.force_logout`; the target user id is the
  only session-revocation scope.
- `forceLogout` continues to revoke all target sessions and persist its audit/audit-trail entries
  in the existing transaction; it neither creates nor consumes an electronic signature.
- A revoked session can never receive a `SecurityContext`. Its next authenticated request returns
  stable code `SESSION_REVOKED`, so the client clears credentials and routes to Login.
- If actor and target are the same user, the SPA clears its local session immediately after the
  successful force-logout response and does not issue the table reload that caused the misleading
  dictionary error.

## Impact and risk

GitNexus MCP was unavailable in this session. Source-based impact review found:

- `AuthTokenFilter.doFilterInternal`: gateway for every bearer-token request — **HIGH**. The
  changed branch is limited to `AuthSession.revokedAt != null`; active, locked, expired, account
  status, permission, audit, and maintenance branches are unchanged.
- `LoggedInUsersView.confirmForceLogout`: one administrator action — **MEDIUM**. Non-self target
  behaviour remains: reload list then success toast.

## Evidence

- Source: `UserManagementService.forceLogout` revokes sessions and writes audit/audit-trail
  records; `SettingsUserController` continues to gate the endpoint with
  `requireUserForceLogout()`.
- Negative regression: `AuthTokenFilterTest.revokedSession_isDenied401WithStableCode_andNeverGrantedSecurityContext`.
- Verification: targeted backend test and frontend production build recorded with this change.

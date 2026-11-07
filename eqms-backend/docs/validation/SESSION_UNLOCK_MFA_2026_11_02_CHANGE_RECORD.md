# Unlocking a locked session needs the second factor — 2026-11-02

## Authorization and invariants

Requested by the owner after finding a conflict with EU-GMP: signing in needs the second factor (MFA), but a session locked by inactivity (Settings > Configuration > Security > Session Timeout) was unlocked with the password alone. Decisions of the owner (`DECISION_LOG.md`, SESSION-UNLOCK-MFA-2026-11-02): after the right password the second factor is mandatory; a wrong password uses exactly the mechanism of signing in (Enable Account Lockout, Maximum Login Attempts); every wrong entry is recorded in the Audit Trail.

Invariants: the unlock never skips the second factor while the account uses one (the same test as sign-in: authenticator app enabled, or email code enabled); a trusted device ("remember this device") never skips it; a challenge made to unlock a session is bound to that one session (`login_challenges.session_id`) and cannot sign anybody in, and a sign-in challenge cannot unlock a session; one failure counter (`failedLoginCount`) is shared by the password and the code, at sign-in and at unlock; the wrong entry that locks the account also ends the session; the counter is cleared only by a complete success.

## Implementation and impact

- Backend `AuthService`: `reauthenticate` (password; returns a session-bound challenge, HTTP 202, when the account uses a factor), new `verifyReauthenticationMfa` (`POST /auth/reauthenticate/mfa`), shared `registerFailedAttempt` (lockout, account_locked entries, message) used by the password and by the code; `verifyMfa` (sign-in) now also counts and records a wrong code (before: counted on the challenge only, rolled back, not audited) and refuses a session-bound challenge. `@Transactional(noRollbackFor = UnauthorizedException)` on the three so the counters and records persist.
- Audit Trail / auth audit entries: `session_reauth_failed` (factor password or verification_code, method, attempt), `session_reauth_password_verified`, `session_reauth_challenge_created`, `session_reauth_success`, `mfa_verification_failed` (sign-in), `login_failed`, `account_locked`, `session_revoked_after_lockout`; trail actions `SESSION_REAUTH_FAILED`, `SESSION_REAUTH_PASSWORD_VERIFIED`, `SESSION_REAUTH_SUCCESS`, `SESSION_REVOKED`, `LOGIN`, `ACCOUNT_LOCKED`.
- Database: `V726__login_challenge_session_binding.sql` adds `login_challenges.session_id` (nullable). Forward-only, idempotent.
- `RateLimitFilter`: the new path has its own bucket (`reauthenticate-mfa`).
- Frontend: `SessionTimeoutModal` has a second step (choose app or email when both, six-digit code, send again after 60 s, back to password, goes to sign-in when the account was locked); `authApi.reauthenticate` can return a challenge, new `authApi.reauthenticateMfa`; Security tab text.
- Behaviour that changes: at sign-in a wrong verification code now counts toward Account Lockout (before it did not), so a person can be locked out by wrong codes after the right password.
- GitNexus: not available in this session; no `impact` / `detect_changes` run. Callers found by search: `reauthenticate` has one caller (`AuthController`); `handleFailedLogin` is called only by `login`.

## Verification and limitations

Unit tests only: `AuthServiceReauthenticationTest` (12), `SessionTimeoutModal.mfa.test.tsx` (6); `tsc`.

**Not verified:** nothing was run against the running backend and database end to end (real password, real authenticator code, real email code); V726 applied by the backend start-up only; the `rememberDevice` cookie behaviour; the lock-out path in a browser. An account with no second factor still unlocks with the password alone, as at sign-in. The e-signature dialog (`/auth/verify-signature`) was not reviewed in this change.

Rollback: revert the code; `session_id` can stay (unused). A session locked while the new code runs is unlocked by the old code with the password alone.

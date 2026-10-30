# Session timeout toggle — change record

## User decision and scope

The user requested that administrators can enable or disable Session Timeout for all users through the Security configuration. Existing configurations default to enabled, and the configured timeout minutes remain stored when disabled. The change affects idle locking only; existing locked sessions still require reauthentication. Session expiration, revocation, account status, passwords, MFA and permissions are not disabled by this setting.

## Authorization, audit and consistency

The existing configuration manage permission, server-side configuration validation and audit trail remain in force. The authenticated operational security endpoint exposes the enabled flag and timeout to ordinary users without exposing other configuration. The server disables only its idle check; existing explicit session locks are still enforced. Security changes publish the existing after-commit notification; main-layout and standalone screens refresh on that event, on visibility and at a bounded interval while visible. Their user-interaction heartbeat remains active.

## Impact and evidence

GitNexus identified the authentication filter as CRITICAL (2 direct dependencies, 51 affected flows). The configuration service timeout methods were reported LOW with up to 2 direct dependents; the layout and standalone guard indices include ambiguous CRITICAL candidates, while their exact component candidates show LOW. Existing authentication filter implementation remains unchanged.

Targeted backend tests cover missing/default configuration, enabled and disabled timeout, an idle session when disabled, an already locked session, and existing authorization/maintenance cases. Targeted frontend tests cover disabling and re-enabling the standalone guard and layout regression. Full multi-user and reconnect behavior in a running deployment remains to be verified; no production validation or GMP compliance conclusion is asserted.

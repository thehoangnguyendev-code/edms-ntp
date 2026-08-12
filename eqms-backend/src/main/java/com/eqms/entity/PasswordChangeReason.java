package com.eqms.entity;

/**
 * Explains why a user must replace their current password. Keeping the reason
 * separate from the boolean enforcement flag lets the application distinguish
 * first-time onboarding from an administrator reset or a security event.
 */
public enum PasswordChangeReason {
    FIRST_LOGIN,
    ADMIN_RESET,
    PASSWORD_EXPIRED,
    SECURITY_INCIDENT,
    LEGACY_REQUIRED
}

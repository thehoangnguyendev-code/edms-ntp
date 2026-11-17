package com.eqms.service;

import java.util.Set;

/**
 * The account e-mails that carry a secret or that the person cannot do without: the code to sign in, the link to set a new password, the temporary password of an
 * unlocked account, and the notice that the administrator no longer requires multi-factor authentication (owner decision 2026-11-17, Decision Log
 * NOTIFICATION-ACCOUNT-EMAILS-2026-11-17).
 *
 * <p>They are registry events like the others, so an administrator edits their wording and who gets them, but they are:
 * <ul>
 *   <li><b>e-mail only</b> - the secret must never be kept as an in-app notification (it would sit in the database and show in the bell);</li>
 *   <li><b>always sent</b> - the event cannot be switched off, its e-mail cannot be turned off, and it is never held back by a digest or by quiet hours (a code that
 *       arrives the next morning is of no use, and a held message would be kept unencrypted in the dispatch queue).</li>
 * </ul>
 */
public final class NotificationMandatoryEvents {

    public static final String MFA_LOGIN_CODE = "security.mfa_login_code";
    public static final String PASSWORD_RESET_LINK = "security.password_reset_link";
    public static final String ACCOUNT_UNLOCKED = "security.account_unlocked";
    public static final String ACCOUNT_PASSWORD_RESET = "security.account_password_reset";
    public static final String MFA_REQUIREMENT_REMOVED = "security.mfa_requirement_removed";

    private static final Set<String> CODES = Set.of(MFA_LOGIN_CODE, PASSWORD_RESET_LINK, ACCOUNT_UNLOCKED, ACCOUNT_PASSWORD_RESET, MFA_REQUIREMENT_REMOVED);

    private NotificationMandatoryEvents() {
    }

    public static boolean isMandatory(String eventCode) {
        return eventCode != null && CODES.contains(eventCode);
    }

    public static Set<String> all() {
        return CODES;
    }
}

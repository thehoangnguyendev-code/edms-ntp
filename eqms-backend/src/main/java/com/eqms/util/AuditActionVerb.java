package com.eqms.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The Action of an audit record in one short word (REPORT-AUDIT-DISPLAY-2026-11-17): "Create", "Update", "Approve", "Send", "Login Failed"...
 * The stored action code (TRAINING_ACTIVITY_CREATED, REPORT_ARTIFACT_VERIFY_MISMATCH) is a machine value and stays as it is; what happened in detail is on the
 * detail screen of the record, so the list can be read and filtered by a small fixed vocabulary instead of by hundreds of codes.
 *
 * One rule table decides it, for the screen (Java) and for a report (the same table as an SQL expression, {@link #sqlCase}), so they cannot differ.
 * A rule is a verb and the words of the code that name it. The order is fixed by how a code is built: the verb usually ends the code (…_CREATED), sometimes
 * starts it (ISSUE_TRUSTED_DEVICE), and only then is looked for anywhere, so a code with two verbs (REVIEW_PDF_GENERATED) is the last one, Create.
 * A code none of the words names keeps its own words in Title Case, never a guess; AuditActionVerbTest lists the codes of the DEV log that fall there.
 */
public final class AuditActionVerb {
    private AuditActionVerb() {
    }

    /** Verb, then the words that name it (upper case, the parts of a code separated by an underscore). The most specific verbs come first. */
    private static final String[][] RULES = {
            {"Login Failed", "FAILED_LOGIN", "LOGIN_FAILED", "LOGIN_FAILURE"},
            {"Verify Failed", "VERIFY_MISMATCH"},
            {"Send Failed", "SEND_EMAIL_FAILED", "SEND_FAILED", "DELIVERY_FAILED", "EMAIL_FAILED"},
            {"Login", "LOGIN", "SIGN_IN"},
            {"Logout", "LOGOUT", "SIGN_OUT"},
            {"Re-authenticate", "REAUTH"},
            {"Re-authenticate Failed", "REAUTH_FAILED"},
            {"Access Denied", "DENIED"},
            {"Fail", "FAILED", "FAILURE", "ERROR"},
            {"Create", "CREATED", "CREATE", "ADDED", "ADD", "GENERATED", "GENERATE", "REGISTERED", "REGISTER", "ISSUED", "ISSUE", "DUPLICATED", "COPIED", "RECORDED", "RAISED", "PROPOSED", "FILED", "RECEIVED", "ENTERED", "STORED", "REGENERATED", "SETUP", "NEW_VERSION"},
            {"Update", "UPDATED", "UPDATE", "CHANGED", "CHANGE", "EDITED", "EDIT", "SAVED", "SAVE", "SET", "REPLACED", "REPLACE", "MODIFIED", "RENAMED", "REORDERED", "TOGGLED", "CORRECTED", "MOVED", "POSTPONED", "UPGRADED", "UPGRADE", "RECONCILED", "FEATURED", "UNFEATURED", "CHOSEN", "MERGED", "EXCUSED", "EXEMPTION", "RESET", "REOPEN", "REOPENED", "REFRESH", "COMMIT", "APPLY", "DAMAGED", "UNAVAILABLE"},
            {"Delete", "DELETED", "DELETE", "REMOVED", "REMOVE", "DESTROYED", "DESTROY", "DISCARDED", "DISCARD", "CLEARED"},
            {"Submit", "SUBMITTED", "SUBMIT", "RESUBMITTED", "RESUBMIT", "REQUESTED", "REQUEST", "QUEUED", "QUEUE"},
            {"Review", "REVIEWED", "REVIEW"},
            {"Approve", "APPROVED", "APPROVE"},
            {"Confirm", "CONFIRMED", "CONFIRM", "ACKNOWLEDGED", "ACKNOWLEDGE", "ACCEPTED", "ATTESTED"},
            {"Reject", "REJECTED", "REJECT", "RETURNED", "RETURN", "REFUSED"},
            {"Cancel", "CANCELLED", "CANCELED", "CANCEL", "WITHDRAWN", "WITHDRAW", "VOIDED", "VOID", "LOST"},
            {"Obsolete", "OBSOLETE", "OBSOLETED", "RETIRED", "ARCHIVED", "ARCHIVE", "SUPERSEDED"},
            {"Publish", "PUBLISHED", "PUBLISH", "RELEASED", "RELEASE"},
            {"Enable", "ENABLED", "ENABLE", "ACTIVATED", "ACTIVATE", "RESUMED", "RESUME", "UNLOCKED", "UNLOCK", "REINSTATED"},
            {"Disable", "DISABLED", "DISABLE", "DEACTIVATED", "DEACTIVATE", "SUSPENDED", "SUSPEND", "PAUSED", "PAUSE", "LOCKED", "LOCK", "TERMINATED"},
            {"Restore", "RESTORED", "RESTORE", "ROLLBACK"},
            {"Verify", "VERIFIED", "VERIFY", "CHECKED", "CHECK", "INSPECTED", "INSPECTION", "SCRUB", "TESTED"},
            {"Export", "EXPORTED", "EXPORT", "PRINTED", "PRINT"},
            {"Download", "DOWNLOADED", "DOWNLOAD"},
            {"Upload", "UPLOADED", "UPLOAD", "IMPORTED", "IMPORT", "SYNCED", "REUPLOADED", "SCAN"},
            {"Send", "SENT", "SEND", "NOTIFIED", "NOTIFY", "DELIVERED", "DISTRIBUTED", "DISTRIBUTE"},
            {"Assign", "ASSIGNED", "ASSIGN", "UNASSIGNED", "UNASSIGN", "DESIGNATED", "DESIGNATE", "REASSIGNED", "JOINED", "LINKED", "LINK"},
            {"Sign", "SIGNED", "SIGN"},
            {"Start", "STARTED", "START"},
            {"Revoke", "REVOKED", "REVOKE"},
            {"Recall", "RECALLED", "RECALL"},
            {"Retry", "RETRY", "RETRIED"},
            {"Run", "RUN"},
            {"Expire", "EXPIRE", "EXPIRED"},
            {"Detect", "DETECTED"},
            {"Complete", "COMPLETED", "COMPLETE", "FINISHED", "HELD", "CLOSED", "CLOSE", "DONE"},
            {"View", "VIEWED", "VIEW", "OPENED", "OPEN", "PREVIEWED", "PREVIEW", "READ", "SEARCHED", "SEARCH", "LISTED"},
    };

    /** The verbs, in the order of the rules. */
    public static List<String> verbs() {
        List<String> verbs = new ArrayList<>();
        for (String[] rule : RULES) verbs.add(rule[0]);
        return verbs;
    }

    private record Compiled(String verb, Pattern pattern, String regex) {
    }

    /** Pass 1: the verb ends the code. Pass 2: it starts the code. Pass 3: it is anywhere in it. The tokens are whole parts of the code, never part of a word. */
    private static final List<Compiled> ORDERED = new ArrayList<>();
    static {
        String[] shapes = {"(^|_)(%s)$", "^(%s)(_|$)", "(^|_)(%s)(_|$)"};
        for (String shape : shapes) {
            for (String[] rule : RULES) {
                // a word of more than one part (FAILED_LOGIN) is matched whole at its own place; the single-part verbs follow the shape of the pass
                String words = String.join("|", java.util.Arrays.copyOfRange(rule, 1, rule.length));
                String regex = String.format(shape, words);
                ORDERED.add(new Compiled(rule[0], Pattern.compile(regex), regex));
            }
        }
    }

    private static String normalize(String actionType) {
        // what comes after FOR or TO is the object of the verb, not the verb (SUBMIT_FOR_REVIEW, PUBLISH_TO_EFFECTIVE)
        return actionType == null ? "" : actionType.trim().toUpperCase(Locale.ROOT).replaceAll("[ -]+", "_").replaceAll("_(FOR|TO)_.*$", "");
    }

    /** The verb of an action code; a code no rule names is written in its own words (Title Case, underscores as spaces). */
    public static String of(String actionType) {
        String code = normalize(actionType);
        if (code.isEmpty()) return "Update";
        for (Compiled rule : ORDERED) {
            if (rule.pattern().matcher(code).find()) return rule.verb();
        }
        return words(code);
    }

    /** Whether some rule names the code (false: it is shown in its own words). */
    public static boolean isNamed(String actionType) {
        String code = normalize(actionType);
        for (Compiled rule : ORDERED) if (rule.pattern().matcher(code).find()) return true;
        return false;
    }

    static String words(String code) {
        StringBuilder out = new StringBuilder();
        for (String part : code.toLowerCase(Locale.ROOT).split("_+")) {
            if (part.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return out.toString();
    }

    /** The same decision as an SQL expression over a column that holds the action code. The words and the verbs are fixed text of this class, never input. */
    public static String sqlCase(String actionTypeColumn) {
        String code = "regexp_replace(upper(regexp_replace(" + actionTypeColumn + ",'[ -]+','_','g')),'_(FOR|TO)_.*$','')";
        StringBuilder sql = new StringBuilder("(case");
        Map<String, Boolean> seen = new LinkedHashMap<>();
        for (Compiled rule : ORDERED) {
            sql.append(" when ").append(code).append(" ~ '").append(rule.regex()).append("' then '").append(rule.verb()).append("'");
            seen.put(rule.verb(), true);
        }
        sql.append(" else initcap(btrim(regexp_replace(lower(").append(actionTypeColumn).append("),'[_[:space:]-]+',' ','g'))) end)");
        return sql.toString();
    }

    /** The action codes (from a list of the codes in use) that a verb stands for: what a filter by this verb selects. */
    public static List<String> codesOf(String verb, Iterable<String> codesInUse) {
        List<String> codes = new ArrayList<>();
        for (String code : codesInUse) if (of(code).equalsIgnoreCase(verb)) codes.add(code);
        return codes;
    }
}

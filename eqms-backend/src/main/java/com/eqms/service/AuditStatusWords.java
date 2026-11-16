package com.eqms.service;

import java.util.Locale;

/**
 * The words of a status as the Audit Trail SHOWS them (STATUS-CONSISTENCY-2026-11-14). The rows of the Audit Trail are never rewritten (the table refuses it), so the rows
 * that an Uncontrolled Copy wrote before it had three statuses (Requested, Approved, Generated, Rejected, Cancelled, Expired) are shown with the status the copy has in the
 * system today: Ready for Distribution, Distributed or Closed - Cancelled. The stored value is untouched and is what a search of the raw record reads.
 */
public final class AuditStatusWords {
    private AuditStatusWords() {}

    /** The status word to show for a stored one; a word that is not an old word of an Uncontrolled Copy is returned as it was written. */
    public static String display(String entityType, String status) {
        if (status == null || entityType == null) return status;
        String type = entityType.replace("_", " ").trim().toLowerCase(Locale.ROOT);
        if (!type.equals("uncontrolled copy") && !type.equals("uncontrolledcopyrecord")) return status;
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "REQUESTED", "APPROVED", "GENERATED" -> "Ready for Distribution";
            case "REJECTED", "CANCELLED", "EXPIRED" -> "Closed - Cancelled";
            default -> status;
        };
    }
}

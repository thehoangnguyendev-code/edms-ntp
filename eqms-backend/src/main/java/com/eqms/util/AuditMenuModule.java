package com.eqms.util;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The module an audit record is shown under: the name of the level-1 menu of the application sidebar that the
 * audited object belongs to ("Document Control", "Training Management", ...). It is a label for people reading
 * the Audit Trail; it is never stored and never used for filtering or authorization (the stored entity type is
 * the machine value). All the entity types written so far are listed in AuditMenuModuleTest.
 *
 * Decision Log: the grouping below follows the area an object belongs to, not the screen that administers it
 * (a training vendor is "Training Management" although it is configured under System Administration).
 */
public final class AuditMenuModule {
    public static final String DOCUMENT_CONTROL = "Document Control";
    public static final String TRAINING = "Training Management";
    public static final String REPORTS = "Reports & Analytics";
    public static final String AUDIT_TRAIL = "Audit Trail";
    public static final String BACKUP_RESTORE = "Backup & Restore";
    public static final String SECURITY = "Security & Authorization";
    public static final String APPLICATION_SETTINGS = "Application Settings";
    public static final String SYSTEM_ADMINISTRATION = "System Administration";
    public static final String NOTIFICATIONS = "Notifications";
    public static final String SELF_SERVICE = "Self-Service";
    /** An entity type nobody has placed yet: shown as such instead of being guessed. */
    public static final String OTHER = "Other";

    /** Keys are the entity type upper-cased without spaces and underscores, so every spelling written in the past maps alike. */
    private static final Map<String, String> EXACT = Map.ofEntries(
            Map.entry("DOCUMENT", DOCUMENT_CONTROL),
            Map.entry("DOCUMENTS", DOCUMENT_CONTROL),
            Map.entry("DOCUMENTRECORD", DOCUMENT_CONTROL),
            Map.entry("REVISION", DOCUMENT_CONTROL),
            Map.entry("DOCUMENTREVISION", DOCUMENT_CONTROL),
            Map.entry("DOCUMENTREVISIONRECORD", DOCUMENT_CONTROL),
            Map.entry("PUBLISHEDPDF", DOCUMENT_CONTROL),
            Map.entry("PUBLISHINGTEMPLATE", DOCUMENT_CONTROL),
            Map.entry("EXECUTEDRECORD", DOCUMENT_CONTROL),
            Map.entry("EFORMEDITSESSION", DOCUMENT_CONTROL),
            Map.entry("FORMSETTINGS", DOCUMENT_CONTROL),
            Map.entry("OFFLINEMEDIA", DOCUMENT_CONTROL),
            Map.entry("USER", SECURITY),
            Map.entry("USERACCOUNT", SECURITY),
            Map.entry("ROLE", SECURITY),
            Map.entry("ACCESSPROFILE", SECURITY),
            Map.entry("ACCESSREVIEW", SECURITY),
            Map.entry("PERMISSIONSET", SECURITY),
            Map.entry("OBJECTACCESSRULE", SECURITY),
            Map.entry("SODCONSTRAINT", SECURITY),
            Map.entry("WORKFLOWACTIONPOLICY", SECURITY),
            Map.entry("SESSION", SECURITY),
            Map.entry("AUTH", SECURITY),
            Map.entry("AUTHENTICATION", SECURITY),
            Map.entry("EMAILTEMPLATE", APPLICATION_SETTINGS),
            Map.entry("SYSTEMANNOUNCEMENT", APPLICATION_SETTINGS),
            Map.entry("SETTINGS", SYSTEM_ADMINISTRATION),
            Map.entry("SYSTEM", SYSTEM_ADMINISTRATION),
            Map.entry("SYSTEMCONFIGURATION", SYSTEM_ADMINISTRATION),
            Map.entry("ELECTRONICSIGNATURESETTINGS", SYSTEM_ADMINISTRATION),
            Map.entry("STORAGEOBJECT", SYSTEM_ADMINISTRATION)
    );

    /** Checked in order after the exact keys: a family of entity types that share a prefix. */
    private static final List<Map.Entry<String, String>> PREFIXES = List.of(
            Map.entry("CONTROLLEDCOPY", DOCUMENT_CONTROL),
            Map.entry("UNCONTROLLEDCOPY", DOCUMENT_CONTROL),
            Map.entry("TRAINING", TRAINING),
            Map.entry("REPORT", REPORTS),
            Map.entry("AUDITTRAIL", AUDIT_TRAIL),
            Map.entry("BACKUP", BACKUP_RESTORE),
            Map.entry("RESTORE", BACKUP_RESTORE),
            Map.entry("NOTIFICATION", NOTIFICATIONS),
            Map.entry("KNOWLEDGE", SELF_SERVICE)
    );

    private AuditMenuModule() {
    }

    public static String forEntityType(String entityType) {
        if (entityType == null || entityType.isBlank()) {
            return OTHER;
        }
        String key = entityType.trim().toUpperCase(Locale.ROOT).replace(" ", "").replace("_", "");
        String exact = EXACT.get(key);
        if (exact != null) {
            return exact;
        }
        for (Map.Entry<String, String> prefix : PREFIXES) {
            if (key.startsWith(prefix.getKey())) {
                return prefix.getValue();
            }
        }
        return OTHER;
    }
}

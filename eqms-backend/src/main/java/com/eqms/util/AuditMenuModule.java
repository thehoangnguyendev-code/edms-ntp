package com.eqms.util;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The module an audit record is shown under: the name of the level-1 menu of the application sidebar that the
 * audited object belongs to ("Document Control", "Training Management", ...). It is a label for people reading
 * the Audit Trail; it is never stored and never used for filtering or authorization (the stored entity type is
 * the machine value). All the entity types written so far are listed in AuditMenuModuleTest, and
 * AuditedEntityTypesHaveAModuleTest fails when the code starts to write one that is not placed here.
 *
 * Decision Log REPORT-MODULE-FIXED-2026-11-17 (owner): the module is the TOP (level-1) menu of the screen where the
 * object is shown or administered. A training vendor is configured under System Administration > Training
 * Administration, so it is "System Administration"; a training activity has its screen under Training Management.
 * The names are fixed by the system and do not follow the labels an administrator may give the menus.
 */
public final class AuditMenuModule {
    public static final String DOCUMENT_CONTROL = "Document Control";
    public static final String TRAINING = "Training Management";
    public static final String REPORTS = "Reports";
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
            Map.entry("WORKFLOWROLE", SECURITY),
            Map.entry("LIFECYCLESTATEPOLICY", SECURITY),
            Map.entry("SYSTEMANNOUNCEMENT", APPLICATION_SETTINGS),
            // Screens of System Administration, by the administration menu they sit in (the exact keys are tried before the prefixes below).
            // Notifications Administration:
            Map.entry("EMAILTEMPLATE", SYSTEM_ADMINISTRATION),
            Map.entry("EMAILDESIGN", SYSTEM_ADMINISTRATION),
            Map.entry("INAPPDESIGN", SYSTEM_ADMINISTRATION),
            Map.entry("NOTIFICATIONPOLICY", SYSTEM_ADMINISTRATION),
            // Document Administration:
            Map.entry("PUBLISHINGTEMPLATE", SYSTEM_ADMINISTRATION),
            Map.entry("CONTROLLEDCOPYPOLICY", SYSTEM_ADMINISTRATION),
            Map.entry("CONTROLLEDCOPYEXPIRYLIMIT", SYSTEM_ADMINISTRATION),
            Map.entry("CONTROLLEDCOPYPLACEHOLDERFIELD", SYSTEM_ADMINISTRATION),
            Map.entry("UNCONTROLLEDCOPYPOLICY", SYSTEM_ADMINISTRATION),
            Map.entry("UNCONTROLLEDCOPYELIGIBILITYRULE", SYSTEM_ADMINISTRATION),
            Map.entry("KNOWLEDGEHIERARCHY", SYSTEM_ADMINISTRATION),
            Map.entry("KNOWLEDGECOMPONENT", SYSTEM_ADMINISTRATION),
            // Training Administration:
            Map.entry("TRAININGSETTINGS", SYSTEM_ADMINISTRATION),
            Map.entry("TRAININGCODERULE", SYSTEM_ADMINISTRATION),
            Map.entry("TRAININGVENDOR", SYSTEM_ADMINISTRATION),
            Map.entry("TRAININGPROVIDER", SYSTEM_ADMINISTRATION),
            Map.entry("TRAININGJOBROLE", SYSTEM_ADMINISTRATION),
            Map.entry("TRAININGNOTIFICATIONS", SYSTEM_ADMINISTRATION),
            // Report Administration:
            Map.entry("REPORTPROPERTIES", SYSTEM_ADMINISTRATION),
            Map.entry("REPORTAPPEARANCE", SYSTEM_ADMINISTRATION),
            Map.entry("REPORTTYPE", SYSTEM_ADMINISTRATION),
            Map.entry("REPORTNAMEFORMAT", SYSTEM_ADMINISTRATION),
            Map.entry("REPORTTEMPLATENUMBERRULE", SYSTEM_ADMINISTRATION),
            // Backup & Restore Administration:
            Map.entry("BACKUPPOLICY", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPTARGET", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPALERT", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPALERTRULE", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPALERTRECIPIENT", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPMANUALCOPY", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPDRSETTING", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPDRSCENARIO", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPDRKIT", SYSTEM_ADMINISTRATION),
            Map.entry("BACKUPDRDECLARATION", SYSTEM_ADMINISTRATION),
            // Configuration:
            Map.entry("DASHBOARDROLELAYOUT", SYSTEM_ADMINISTRATION),
            Map.entry("ADMINISTRATIVENETWORKPOLICY", SYSTEM_ADMINISTRATION),
            Map.entry("STORAGEUSAGEPOLICY", SYSTEM_ADMINISTRATION),
            Map.entry("SETTINGS", SYSTEM_ADMINISTRATION),
            Map.entry("SYSTEM", SYSTEM_ADMINISTRATION),
            Map.entry("SYSTEMCONFIGURATION", SYSTEM_ADMINISTRATION),
            Map.entry("OBJECTNUMBERFORMAT", SYSTEM_ADMINISTRATION),
            Map.entry("BUSINESSUNIT", APPLICATION_SETTINGS),
            Map.entry("DEPARTMENT", APPLICATION_SETTINGS),
            Map.entry("POSITION", APPLICATION_SETTINGS),
            Map.entry("STORAGELOCATION", APPLICATION_SETTINGS),
            Map.entry("RETENTIONPOLICY", APPLICATION_SETTINGS),
            Map.entry("DEGREELEVEL", APPLICATION_SETTINGS),
            Map.entry("SCHOOL", APPLICATION_SETTINGS),
            Map.entry("DOCUMENTCOMPONENT", SYSTEM_ADMINISTRATION),
            Map.entry("DOCUMENTNAMEFORMAT", SYSTEM_ADMINISTRATION),
            Map.entry("DOCUMENTTYPE", SYSTEM_ADMINISTRATION),
            Map.entry("DOCUMENTSUBTYPE", SYSTEM_ADMINISTRATION),
            Map.entry("REVIEWSNAPSHOT", DOCUMENT_CONTROL),
            Map.entry("SOURCEDOCX", DOCUMENT_CONTROL),
            Map.entry("CONTROLLEDCOPYEVIDENCE", DOCUMENT_CONTROL),
            Map.entry("PUBLISHINGPREVIEW", SYSTEM_ADMINISTRATION),
            Map.entry("TRAININGMATERIAL", TRAINING),
            Map.entry("AUDITEXPORT", AUDIT_TRAIL),
            Map.entry("REPORTEXPORT", REPORTS),
            Map.entry("FILE", DOCUMENT_CONTROL),
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

    /**
     * The same mapping as {@link #forEntityType} as an SQL expression over a column that holds the entity type, so a query (a report of the Audit Trail) shows and
     * filters by the menu module in the database, from this one list (REPORT-MODULE-NAMES-2026-11-16). The names and keys are fixed text in this class, never input.
     */
    public static String sqlCase(String entityTypeColumn) {
        String key = "upper(replace(replace(" + entityTypeColumn + ",' ',''),'_',''))";
        java.util.Map<String, java.util.List<String>> byModule = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, String> entry : new java.util.TreeMap<>(EXACT).entrySet()) {
            byModule.computeIfAbsent(entry.getValue(), name -> new java.util.ArrayList<>()).add("'" + entry.getKey() + "'");
        }
        StringBuilder sql = new StringBuilder("(case");
        byModule.forEach((module, keys) -> sql.append(" when ").append(key).append(" in (").append(String.join(",", keys)).append(") then '").append(module).append("'"));
        for (Map.Entry<String, String> prefix : PREFIXES) {
            sql.append(" when ").append(key).append(" like '").append(prefix.getKey()).append("%' then '").append(prefix.getValue()).append("'");
        }
        return sql.append(" else '").append(OTHER).append("' end)").toString();
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

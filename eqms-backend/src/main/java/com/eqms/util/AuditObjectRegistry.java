package com.eqms.util;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * The register of every kind of object the audit log is about (AUDIT-OBJECT-REGISTRY-2026-11-17, owner decisions). A kind is a canonical key (the entity type in
 * upper case, without spaces and underscores, so every spelling written in the past reads alike) and has:
 *
 *  - the Object Type: the DEFAULT name of the function menu where the object is shown or administered. It is fixed by the system and does not follow the labels
 *    an administrator gives the menus. A part of an object (a batch of copies, a file of a run) has the menu of its parent and nothing more: it is found by its
 *    own code in Object Code;
 *  - its class: A = a business record with a number, B = a configuration object known by its real, unique name, C = a part of another object or an event of the
 *    system (identified by the code of its parent, or by who did it and what).
 *
 * The menu names are those of the sidebar (eqms/src/app/navigation.ts); AuditObjectRegistryTest keeps them so, and fails when the code writes a kind that is not here.
 * The list is generated from the table the owner approved (AUDIT_ACTION_TABLE_V2_2026_11_17.xlsx).
 */
public final class AuditObjectRegistry {
    private AuditObjectRegistry() {
    }

    /** A kind of object: its Object Type (menu name) and its class. */
    public record Kind(String menuName, char objectClass) {
    }

    private static final Map<String, Kind> KINDS = new HashMap<>();

    private static void entry(String menuName, char objectClass, String... keys) {
        for (String key : keys) KINDS.put(key, new Kind(menuName, objectClass));
    }

    static {
        entry("Access Profiles", 'B', "ACCESSPROFILE", "ROLE");
        entry("Access Review", 'A', "ACCESSREVIEW");
        entry("All Documents", 'A', "DOCUMENT", "DOCUMENTRECORD", "DOCUMENTS");
        entry("All Records", 'C', "AUDITEXPORT", "AUDITTRAIL");
        entry("Backup Alerts & Recipients", 'A', "BACKUPALERT");
        entry("Backup Alerts & Recipients", 'B', "BACKUPALERTRECIPIENT", "BACKUPALERTRULE");
        entry("Backup History", 'A', "BACKUP", "BACKUPEXPORT", "BACKUPINSPECTION");
        entry("Backup Policy", 'B', "BACKUPPOLICY");
        // The Backup Status Overview menu was replaced by the dashboard widgets; the store check is shown with the store it checks (AUTHZ-COMPLETION-2026-11-21).
        entry("Backup Storage & Encryption", 'C', "BACKUPSTORESCRUB");
        entry("Backup Storage & Encryption", 'B', "BACKUPTARGET");
        entry("Backup Storage & Encryption", 'C', "BACKUPMANUALCOPY");
        entry("Business Units", 'B', "BUSINESSUNIT");
        // Configuration is a menu group; each of its pages is a function menu (CONFIGURATION-PAGES-SPLIT-2026-11-17). A save is written under the page of the settings it changed.
        // The records written before the split (SYSTEMCONFIGURATION, all pages together) keep the name of the group.
        entry("Configuration", 'B', "SYSTEMCONFIGURATION");
        entry("General", 'B', "SYSTEMCONFIGURATIONGENERAL", "DASHBOARDROLELAYOUT");
        entry("Navigation Labels", 'B', "SYSTEMCONFIGURATIONNAVIGATIONLABELS");
        entry("Security", 'B', "SYSTEMCONFIGURATIONSECURITY", "ADMINISTRATIVENETWORKPOLICY");
        entry("Notifications", 'B', "SYSTEMCONFIGURATIONNOTIFICATIONS");
        entry("Integrations", 'B', "SYSTEMCONFIGURATIONINTEGRATIONS", "STORAGEUSAGEPOLICY");
        entry("Preview File", 'B', "SYSTEMCONFIGURATIONPREVIEWFILE");
        entry("Image Watermark", 'B', "SYSTEMCONFIGURATIONIMAGEWATERMARK");
        entry("Features", 'B', "SYSTEMCONFIGURATIONFEATURES");
        entry("Controlled Copies", 'A', "CONTROLLEDCOPY", "CONTROLLEDCOPYDISTRIBUTIONBATCH", "CONTROLLEDCOPYRECALLBATCH", "CONTROLLEDCOPYRECORD");
        entry("Controlled Copies", 'C', "CONTROLLEDCOPYDISTRIBUTIONJOB", "CONTROLLEDCOPYEVIDENCE");
        entry("Controlled Copies Policy", 'B', "CONTROLLEDCOPYEXPIRYLIMIT", "CONTROLLEDCOPYPLACEHOLDERFIELD", "CONTROLLEDCOPYPOLICY");
        entry("Degree Levels", 'B', "DEGREELEVEL");
        entry("Departments", 'B', "DEPARTMENT");
        entry("Disaster Recovery Plan", 'B', "BACKUPDRDECLARATION", "BACKUPDRKIT", "BACKUPDRSCENARIO", "BACKUPDRSETTING");
        entry("Document Components", 'B', "DOCUMENTCOMPONENT");
        entry("Document Impact Assessment", 'A', "TRAININGIMPACTASSESSMENT");
        entry("Document Name Formats", 'B', "DOCUMENTNAMEFORMAT");
        entry("Document Revisions", 'A', "DOCUMENTREVISION", "DOCUMENTREVISIONRECORD", "REVISION");
        entry("Document Revisions", 'C', "FILE", "PUBLISHEDPDF", "REVIEWSNAPSHOT", "SOURCEDOCX");
        entry("Document Sub-Types", 'B', "DOCUMENTSUBTYPE");
        entry("Document Types", 'B', "DOCUMENTTYPE");
        entry("E-Sign Config", 'B', "ELECTRONICSIGNATURESETTINGS");
        entry("Form Settings (retired)", 'C', "FORMSETTINGS");
        entry("Job Assignments", 'A', "TRAININGJOBASSIGNMENT");
        entry("Knowledge Base", 'B', "KNOWLEDGESHAREDELEGATE", "KNOWLEDGESHARELINK");
        entry("Knowledge Categories Hierarchies", 'B', "KNOWLEDGEHIERARCHY");
        entry("Knowledge Category Components", 'B', "KNOWLEDGECOMPONENT");
        entry("Legacy Training Evidence", 'A', "TRAININGLEGACYEVIDENCE");
        entry("Logged in Users", 'C', "AUTH", "AUTHENTICATION", "SESSION", "USERSESSION", "SESSIONREVOKEDCONCURRENTLIMIT");
        entry("Notifications", 'C', "NOTIFICATION", "NOTIFICATIONINBOX");
        entry("Notifications Administration", 'B', "EMAILDESIGN", "EMAILTEMPLATE", "INAPPDESIGN", "NOTIFICATIONPOLICY");
        // The Object Access Rules screen was removed (visibility is a permission of the profile now); nothing writes this kind any more, the records already written keep a readable name.
        entry("Object Access Rules (retired)", 'A', "OBJECTACCESSRULE");
        entry("Object Numbering", 'B', "OBJECTNUMBERFORMAT");
        entry("Offline Media (retired)", 'C', "OFFLINEMEDIA");
        entry("Periodic Review", 'A', "AUDITTRAILREVIEW");
        entry("Positions", 'B', "POSITION");
        entry("Prompt Generation (retired)", 'C', "PROMPTGENERATIONRUN");
        entry("Prompt Specification (retired)", 'C', "PROMPTSPECIFICATION");
        entry("Publishing Templates", 'B', "PUBLISHINGTEMPLATE");
        entry("Publishing Templates", 'C', "PUBLISHINGPREVIEW", "STORAGEOBJECT");
        entry("Records", 'A', "EXECUTEDRECORD");
        entry("Records", 'C', "EFORMEDITSESSION");
        entry("Report Appearance", 'B', "REPORTAPPEARANCE");
        entry("Report Name Formats", 'B', "REPORTNAMEFORMAT");
        entry("Report Properties", 'B', "REPORTPROPERTIES");
        entry("Report Run History", 'A', "REPORTRUN");
        entry("Report Run History", 'C', "REPORTARTIFACT", "REPORTEXPORT");
        entry("Report Templates", 'A', "REPORTDEFINITION", "REPORTTEMPLATE");
        entry("Report Types", 'B', "REPORTTYPE");
        entry("Restore Backup", 'A', "BACKUPRESTORE");
        entry("Retention Policies", 'B', "RETENTIONPOLICY");
        entry("Scheduled Reports", 'A', "REPORTSCHEDULE");
        entry("Schools", 'B', "SCHOOL");
        entry("Segregation of Duties", 'B', "SODCONSTRAINT");
        entry("Settings (before the split)", 'B', "SETTINGS");
        entry("Shared Permission Sets", 'B', "PERMISSIONSET");
        entry("Specimen Signatures", 'A', "TRAININGSPECIMEN", "TRAININGSPECIMENSIGNATURE");
        entry("Storage Locations", 'B', "STORAGELOCATION");
        entry("System Announcements", 'A', "SYSTEMANNOUNCEMENT");
        entry("Table Export (before the screen was recorded)", 'C', "TABLEEXPORT");
        entry("Training Activities", 'A', "TRAININGACTIVITY");
        entry("Training Activities", 'B', "TRAININGINITIALPART", "TRAININGTOPIC");
        entry("Training Activities", 'C', "TRAININGEXAMATTEMPT", "TRAININGMATERIAL", "TRAININGROLLCALL", "TRAININGTRAINEREXCEPTION", "TRAININGTRANSCRIPTION", "TRAININGWORKSUSPENSION");
        entry("Training Assessments", 'A', "TRAININGASSESSMENT", "TRAININGFORMTEMPLATE");
        entry("Training Calendar (retired)", 'C', "TRAININGCALENDAR");
        entry("Training Code Rules", 'B', "TRAININGCODERULE");
        entry("Training Compliance", 'C', "TRAININGCOMPLIANCE");
        entry("Training Matrix", 'A', "TRAININGMATRIX", "TRAININGMATRIXVERSION");
        entry("Training Notifications", 'B', "TRAININGNOTIFICATIONS");
        entry("Training Properties", 'B', "TRAININGSETTINGS");
        entry("Training Record Exports", 'A', "TRAININGRECORDEXPORT", "TRAININGRECORDEXPORTBATCH");
        entry("Training Records", 'A', "TRAININGCOMPLETION");
        entry("Training Requirements", 'A', "TRAININGREQUIREMENT");
        entry("Training Reviews", 'A', "TRAININGPERSONNELREVIEW");
        entry("Training Vendors", 'B', "TRAININGPROVIDER", "TRAININGVENDOR");
        entry("Uncontrolled Copies", 'A', "UNCONTROLLEDCOPY", "UNCONTROLLEDCOPYRECORD");
        entry("Uncontrolled Copies Policy", 'B', "UNCONTROLLEDCOPYELIGIBILITYRULE", "UNCONTROLLEDCOPYPOLICY");
        entry("User Management", 'A', "USER", "USERACCOUNT");
        entry("Work Positions", 'B', "TRAININGJOBROLE");
        entry("Work Positions", 'C', "TRAININGPERSONPOSITION");
        entry("Workflow Authorization", 'B', "LIFECYCLESTATEPOLICY", "WORKFLOWACTIONPOLICY");
        // Workflow roles are administered on the Workflow Authorization page (there is no menu called Workflow Role Catalog).
        entry("Workflow Authorization", 'B', "WORKFLOWROLE");
    }

    /** The kind of an entity type as it was written (any spelling), when it is registered. */
    public static Optional<Kind> of(String entityType) {
        return Optional.ofNullable(KINDS.get(AuditObjectCatalog.key(entityType)));
    }

    /** The Object Type to show: the menu name of the kind; null when the kind is not registered (the caller then writes the type in words). */
    public static String menuName(String entityType) {
        return of(entityType).map(Kind::menuName).orElse(null);
    }

    public static boolean isRegistered(String entityType) {
        return of(entityType).isPresent();
    }

    /** Every registered menu name (for the filter of the Object Type). */
    public static java.util.SortedSet<String> menuNames() {
        java.util.SortedSet<String> names = new java.util.TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        for (Kind kind : KINDS.values()) names.add(kind.menuName());
        return names;
    }

    /**
     * The same Object Type as an SQL expression over the entity type column (and the action type column, for the records written before the catch-all type SETTINGS was
     * split), so a report names the Object Type exactly as the screen does. The names are fixed text of this class, never input.
     */
    public static String sqlCase(String entityTypeColumn, String actionTypeColumn) {
        String key = "upper(replace(replace(coalesce(" + entityTypeColumn + ",''),' ',''),'_',''))";
        StringBuilder sql = new StringBuilder("(case");
        String action = "upper(regexp_replace(coalesce(" + actionTypeColumn + ",''),'[ -]+','_','g'))";
        for (String[] rule : AuditObjectCatalog.LEGACY_SETTINGS) {
            sql.append(" when ").append(key).append("='SETTINGS' and ").append(action).append(" like '").append(rule[0]).append("%' then '")
                    .append(menuName(rule[1]).replace("'", "''")).append("'");
        }
        java.util.Map<String, java.util.List<String>> byMenu = new java.util.TreeMap<>();
        for (java.util.Map.Entry<String, Kind> e : KINDS.entrySet()) byMenu.computeIfAbsent(e.getValue().menuName(), k -> new java.util.ArrayList<>()).add(e.getKey());
        for (java.util.Map.Entry<String, java.util.List<String>> e : byMenu.entrySet()) {
            java.util.Collections.sort(e.getValue());
            StringBuilder in = new StringBuilder();
            for (String k : e.getValue()) in.append(in.length() == 0 ? "" : ",").append("'").append(k).append("'");
            sql.append(" when ").append(key).append(" in (").append(in).append(") then '").append(e.getKey().replace("'", "''")).append("'");
        }
        // a kind that is not registered (the build fails for a new one) is written in words
        sql.append(" else initcap(btrim(regexp_replace(lower(coalesce(").append(entityTypeColumn).append(",'')),'[_[:space:]]+',' ','g'))) end)");
        return sql.toString();
    }

    /** The registered canonical keys (for the tests). */
    static java.util.Set<String> keys() {
        return java.util.Collections.unmodifiableSet(KINDS.keySet());
    }

    static String upper(String value) {
        return value.toUpperCase(Locale.ROOT);
    }
}

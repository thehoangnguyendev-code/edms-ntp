package com.eqms.util;

import java.util.Locale;

/**
 * The page of System Administration > Configuration that a saved setting belongs to (CONFIGURATION-PAGES-SPLIT-2026-11-17). Each page is its own function menu, and the Object Type
 * of an audit record is the default name of the menu where the object is administered (AUDIT-OBJECT-REGISTRY), so a save is written under the page of the settings it changed:
 * one audit record for each page that had a change, each with its own change list. The names are those of navigation.ts and of {@code configurationPages.ts}.
 * Records written before the split keep the entity type SYSTEM_CONFIGURATION (all pages together), which the register still names "Configuration".
 */
public enum ConfigurationAuditPage {
    GENERAL(Types.GENERAL),
    NAVIGATION_LABELS(Types.NAVIGATION_LABELS),
    SECURITY(Types.SECURITY),
    NOTIFICATIONS(Types.NOTIFICATIONS),
    INTEGRATIONS(Types.INTEGRATIONS),
    PREVIEW_FILE(Types.PREVIEW_FILE),
    IMAGE_WATERMARK(Types.IMAGE_WATERMARK),
    FEATURES(Types.FEATURES);

    /** The entity types, as constants so the audit tests read them from the sources like any other kind of object. */
    public static final class Types {
        public static final String AUDIT_ENTITY_CONFIGURATION_GENERAL = "SYSTEM_CONFIGURATION_GENERAL";
        public static final String AUDIT_ENTITY_CONFIGURATION_NAVIGATION_LABELS = "SYSTEM_CONFIGURATION_NAVIGATION_LABELS";
        public static final String AUDIT_ENTITY_CONFIGURATION_SECURITY = "SYSTEM_CONFIGURATION_SECURITY";
        public static final String AUDIT_ENTITY_CONFIGURATION_NOTIFICATIONS = "SYSTEM_CONFIGURATION_NOTIFICATIONS";
        public static final String AUDIT_ENTITY_CONFIGURATION_INTEGRATIONS = "SYSTEM_CONFIGURATION_INTEGRATIONS";
        public static final String AUDIT_ENTITY_CONFIGURATION_PREVIEW_FILE = "SYSTEM_CONFIGURATION_PREVIEW_FILE";
        public static final String AUDIT_ENTITY_CONFIGURATION_IMAGE_WATERMARK = "SYSTEM_CONFIGURATION_IMAGE_WATERMARK";
        public static final String AUDIT_ENTITY_CONFIGURATION_FEATURES = "SYSTEM_CONFIGURATION_FEATURES";

        private static final String GENERAL = AUDIT_ENTITY_CONFIGURATION_GENERAL;
        private static final String NAVIGATION_LABELS = AUDIT_ENTITY_CONFIGURATION_NAVIGATION_LABELS;
        private static final String SECURITY = AUDIT_ENTITY_CONFIGURATION_SECURITY;
        private static final String NOTIFICATIONS = AUDIT_ENTITY_CONFIGURATION_NOTIFICATIONS;
        private static final String INTEGRATIONS = AUDIT_ENTITY_CONFIGURATION_INTEGRATIONS;
        private static final String PREVIEW_FILE = AUDIT_ENTITY_CONFIGURATION_PREVIEW_FILE;
        private static final String IMAGE_WATERMARK = AUDIT_ENTITY_CONFIGURATION_IMAGE_WATERMARK;
        private static final String FEATURES = AUDIT_ENTITY_CONFIGURATION_FEATURES;

        private Types() {
        }
    }

    private final String entityType;

    ConfigurationAuditPage(String entityType) {
        this.entityType = entityType;
    }

    /** The entity type that an audit record of this page is written under. */
    public String entityType() {
        return entityType;
    }

    /** The permission to open this page of Configuration and read its history, e.g. {@code settings.config_security.view} (V806). */
    public String viewPermission() {
        return "settings.config_" + name().toLowerCase(Locale.ROOT) + ".view";
    }

    /** The permission to change this page of Configuration, e.g. {@code settings.config_security.manage} (V806). */
    public String managePermission() {
        return "settings.config_" + name().toLowerCase(Locale.ROOT) + ".manage";
    }

    /** The View permissions of all the pages (whoever holds one of them may open the Configuration menu). */
    public static String[] allViewPermissions() {
        return java.util.Arrays.stream(values()).map(ConfigurationAuditPage::viewPermission).toArray(String[]::new);
    }

    /** The Manage permissions of all the pages. */
    public static String[] allManagePermissions() {
        return java.util.Arrays.stream(values()).map(ConfigurationAuditPage::managePermission).toArray(String[]::new);
    }

    /**
     * The page of a setting, from its section of the saved configuration and its path inside it (the camel-case path of the stored JSON, e.g. "navigationLabelOverrides.doc-all").
     * Security, Notifications, Integrations and Features are sections of their own; Documents is the section of Preview File; and the General section is shared by four pages:
     * the menu labels, the image watermark, the OnlyOffice connection (Integrations) with its viewer (Preview File), and everything else (General).
     */
    public static ConfigurationAuditPage of(String section, String path) {
        String s = section == null ? "" : section.toLowerCase(Locale.ROOT);
        String p = path == null ? "" : path;
        switch (s) {
            case "security": return SECURITY;
            case "documents": return PREVIEW_FILE;
            case "notifications": return NOTIFICATIONS;
            case "integrations": return INTEGRATIONS;
            case "features": return FEATURES;
            default: break;
        }
        if (p.equals("navigationLabelOverrides") || p.startsWith("navigationLabelOverrides.") || p.startsWith("navigationLabelOverrides[")) return NAVIGATION_LABELS;
        if (p.equals("imageWatermark") || p.startsWith("imageWatermark.")) return IMAGE_WATERMARK;
        if (p.startsWith("backupSettings.onlyOffice")) {
            return p.startsWith("backupSettings.onlyOffice.viewer") ? PREVIEW_FILE : INTEGRATIONS;
        }
        return GENERAL;
    }
}

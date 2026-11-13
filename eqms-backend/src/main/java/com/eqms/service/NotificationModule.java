package com.eqms.service;

import java.util.Arrays;
import java.util.Locale;

/**
 * The modules a notification belongs to: one fixed list. The stored value is the {@link #key()} ({@code DOCUMENT_CONTROL}); the screens show the
 * {@link #label()}. A value written another way ("Document Control", "document-control") is read as the same module by {@link #of}.
 */
public enum NotificationModule {
    DOCUMENT_CONTROL("Document Control"),
    CONTROLLED_COPIES("Controlled Copies"),
    TRAINING("Training Management"),
    REPORTS("Reports & Analytics"),
    AUDIT_TRAIL("Audit Trail"),
    BACKUP_RESTORE("Backup & Restore"),
    SECURITY("Security & Authorization"),
    ACCESS_REVIEW("Access Review"),
    KNOWLEDGE("Knowledge Base"),
    SYSTEM("System");

    private final String label;

    NotificationModule(String label) {
        this.label = label;
    }

    public String key() {
        return name();
    }

    public String label() {
        return label;
    }

    /** The module a stored or written value stands for, or null when it is none of them. */
    public static NotificationModule of(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
        return Arrays.stream(values()).filter(m -> m.name().equals(normalized)).findFirst().orElse(null);
    }
}

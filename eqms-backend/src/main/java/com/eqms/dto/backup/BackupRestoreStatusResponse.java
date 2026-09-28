package com.eqms.dto.backup;

/**
 * Placeholder status of the Backup & Restore module. {@code available} is false until the feature is built; the
 * frontend shows the "coming soon" page from this instead of assuming.
 */
public record BackupRestoreStatusResponse(boolean available, String status, String message) {

    public static BackupRestoreStatusResponse notImplemented() {
        return new BackupRestoreStatusResponse(false, "NOT_IMPLEMENTED",
                "Backup & Restore is planned and not available yet.");
    }
}

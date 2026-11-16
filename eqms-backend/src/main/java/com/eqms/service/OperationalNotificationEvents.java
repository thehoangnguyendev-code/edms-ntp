package com.eqms.service;

import java.util.List;

/**
 * The notices of the modules that compose their own title and text and hand them to the registry as they are (the placeholders title, message and
 * actionUrl): Reports, Backup &amp; Restore and the system alerts. Training Management has its own list ({@code TrainingNotificationEvents}). Seeded by
 * {@code NotificationEventCatalogBootstrap}; the Notifications Administration then controls them like any other event.
 */
public final class OperationalNotificationEvents {

    /** @param channels the channels the registry offers; an event whose e-mail cannot go through the outbox is in-app only */
    public record Event(String code, String name, String description, String module, String priority, String channels) {
    }

    public static final String REPORT_READY = "report.ready";
    public static final String REPORT_SCHEDULE_SUSPENDED = "report.schedule_suspended";
    public static final String BACKUP_ALERT = "backup.alert";
    public static final String BACKUP_MAINTENANCE_DRAINED = "backup.maintenance_drained";
    public static final String STORAGE_USAGE_WARNING = "system.storage_usage_warning";
    public static final String RECALL_OVERDUE = "controlled_copy.recall_overdue";
    public static final String REPORT_RUN_FAILED = "report.run_failed";
    public static final String MAINTENANCE_SCHEDULED = "system.maintenance_scheduled";

    private static final List<Event> ALL = List.of(
            new Event(REPORT_READY, "Report Ready", "A report is ready. The e-mail of a report you asked for yourself carries the file when it is small enough, and every notice has a link that downloads it after sign-in; the e-mail of a scheduled report is a link only.", "REPORTS", "MEDIUM", "IN_APP,EMAIL"),
            new Event(REPORT_SCHEDULE_SUSPENDED, "Scheduled Report Suspended", "A report schedule stopped running and will not run until it is resumed.", "REPORTS", "HIGH", "IN_APP,EMAIL"),
            new Event(BACKUP_ALERT, "Backup Alert", "The backup system raised an alert for the people named in its alert rules.", "BACKUP_RESTORE", "HIGH", "IN_APP,EMAIL"),
            new Event(BACKUP_MAINTENANCE_DRAINED, "Maintenance Window Started", "The maintenance window drained and users were signed out. The e-mail to the administrator address is sent directly, because the outbox does not run during maintenance.", "BACKUP_RESTORE", "HIGH", "IN_APP"),
            new Event(STORAGE_USAGE_WARNING, "Storage Near Its Limit", "The object storage reached the warning level of the budget set in Configuration.", "SYSTEM", "HIGH", "IN_APP"),
            new Event(RECALL_OVERDUE, "Recalled Controlled Copy Not Returned", "A printed controlled copy was recalled more than seven days ago and its destruction is not recorded. The holder and Document Control are reminded every seven days.", "CONTROLLED_COPIES", "HIGH", "IN_APP"),
            new Event(REPORT_RUN_FAILED, "Report Run Failed", "A report that a person asked for could not be produced. The person who asked is told.", "REPORTS", "HIGH", "IN_APP"));

    private OperationalNotificationEvents() {
    }

    public static List<Event> all() {
        return ALL;
    }

    /** REPORT_READY (the code the delivery log keeps) is report.ready in the registry. */
    public static String reportRegistryCode(String reportEvent) {
        String rest = reportEvent == null ? "" : reportEvent.trim().toLowerCase(java.util.Locale.ROOT);
        return "report." + (rest.startsWith("report_") ? rest.substring("report_".length()) : rest);
    }
}

package com.eqms.maintenance;

import com.eqms.service.SystemAnnouncementService;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * The notice to everyone through the existing System Announcements (SDS 11.5.2 M1, M8). Each maintenance request has a marker in its
 * title, so the announcements of one request can be found and switched off when the system is open again.
 */
@Component
public class MaintenanceAnnouncements {

    private final SystemAnnouncementService announcements;

    public MaintenanceAnnouncements(SystemAnnouncementService announcements) {
        this.announcements = announcements;
    }

    static String marker(String requestId) {
        return "[" + requestId + "]";
    }

    /** The notice that the system will be locked: critical, until the window is over. */
    public void noticeStarted(String requestId, int minutes, Instant lockAt, String by) {
        String title = "System maintenance " + marker(requestId);
        String message = "The system will be locked for maintenance in " + minutes + " minute" + (minutes == 1 ? "" : "s")
                + ". Save your work and sign out now. You will be signed out automatically when the time runs out, and you cannot sign in again until the work is finished.";
        announcements.createForSystem(title, message, "CRITICAL", Instant.now(), lockAt.plus(Duration.ofHours(12)), by);
    }

    /** The system is open again: the notices of this request are switched off, and a short information notice says so. */
    public void reopened(String requestId, String by) {
        announcements.disableForRequest(marker(requestId), by);
        announcements.createForSystem("System open again " + marker(requestId),
                "The maintenance window is over and the system is open again. Thank you for your patience.",
                "INFO", Instant.now(), Instant.now().plus(Duration.ofHours(1)), by);
    }

    /** The notice was withdrawn before anything was locked. */
    public void cancelled(String requestId, String by) {
        announcements.disableForRequest(marker(requestId), by);
    }
}

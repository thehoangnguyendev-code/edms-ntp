package com.eqms.maintenance;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.EmailService;
import com.eqms.service.NotificationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tells the administrators when the window has drained and the users have been signed out (SDS 11.5.2 M3): an in-application
 * notification to every active account that holds the maintenance bypass permission, and an email to the administrator address in
 * the general configuration when mail is configured. A failed email is logged; it does not undo the window.
 */
@Component
public class MaintenanceAdminAlerts {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceAdminAlerts.class);
    static final String BYPASS_PERMISSION = "security.maintenance.bypass";

    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final NotificationService notifications;
    private final EmailService email;
    private final SystemConfigurationService configuration;

    public MaintenanceAdminAlerts(UserAccountRepository users, PermissionEvaluationService permissions, NotificationService notifications,
                                  EmailService email, SystemConfigurationService configuration) {
        this.users = users;
        this.permissions = permissions;
        this.notifications = notifications;
        this.email = email;
        this.configuration = configuration;
    }

    /** @return how many administrators were told in the application (email is reported in the log only). */
    public int drained(String requestId, int sessionsSignedOut) {
        String title = "System maintenance started: users signed out";
        String message = "The maintenance window " + requestId + " has drained. " + sessionsSignedOut
                + " open session(s) were signed out. The system stays locked until the restore work is finished and the window is reopened.";
        List<UserAccount> admins = users.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.Active)
                .filter(u -> permissions.hasPermission(u, BYPASS_PERMISSION))
                .toList();
        for (UserAccount admin : admins) {
            notifications.recordNotification(admin, null, "personal", "backup", "BACKUP_MAINTENANCE_DRAINED", title, message,
                    "/backup-restore", null, null, requestId, null, "high", null);
        }
        sendEmail(requestId, title, message);
        return admins.size();
    }

    private void sendEmail(String requestId, String title, String message) {
        String to = adminAddress();
        if (to == null) {
            log.info("No administrator address is configured; the email for {} was not sent", requestId);
            return;
        }
        try {
            String body = "<p>" + escape(message) + "</p><p>Request: " + escape(requestId) + "</p>";
            if (!email.sendRenderedEmail(to, title, body)) {
                log.warn("The administrator email for {} was not sent (mail is not configured or disabled)", requestId);
            }
        } catch (Exception e) {
            log.warn("The administrator email for {} could not be sent", requestId, e);
        }
    }

    private String adminAddress() {
        try {
            return configuration.getAdminEmail();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}

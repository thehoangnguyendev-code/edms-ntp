package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tells the people who may execute a restore that a request is approved and ready (SDS 11.3, step R3 to R4). The notice is an
 * in-application notification, sent after the approval is committed. A failed notice is logged; the approval stands.
 */
@Component
public class RestoreApprovalNotifier {

    private static final Logger log = LoggerFactory.getLogger(RestoreApprovalNotifier.class);
    static final String EXECUTE_PERMISSION = "backup.restore.execute";

    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final NotificationService notifications;

    public RestoreApprovalNotifier(UserAccountRepository users, PermissionEvaluationService permissions, NotificationService notifications) {
        this.users = users;
        this.permissions = permissions;
        this.notifications = notifications;
    }

    /** @return how many people were told. */
    public int approved(String requestId, String backupId, String approver) {
        try {
            List<UserAccount> executors = users.findAll().stream()
                    .filter(u -> u.getStatus() == UserStatus.Active)
                    .filter(u -> permissions.hasPermission(u, EXECUTE_PERMISSION))
                    .toList();
            String title = "Restore approved: " + requestId;
            String message = "Restore " + requestId + " of backup " + backupId + " was approved by " + approver
                    + ". It can now be executed in a maintenance window.";
            for (UserAccount executor : executors) {
                notifications.recordNotification(executor, null, "personal", "backup", "BACKUP_RESTORE_APPROVED", title, message,
                        "/backup-restore/restores/" + requestId, null, null, requestId, null, "high", null);
            }
            return executors.size();
        } catch (RuntimeException e) {
            log.warn("The approval notice for {} could not be recorded", requestId, e);
            return 0;
        }
    }
}

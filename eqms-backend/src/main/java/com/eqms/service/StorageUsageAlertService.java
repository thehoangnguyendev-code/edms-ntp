package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.util.List;

/**
 * Tells the administrators, in the application, that the measured storage reached the warning threshold of the budget (the user decided on in-app warnings only).
 * It is called after a successful measurement is saved: once each time the threshold is reached, and armed again when the usage is back under it.
 */
@Service
public class StorageUsageAlertService {
    static final String CONFIGURATION_PERMISSION = "settings.config_integrations.manage";
    private static final Logger log = LoggerFactory.getLogger(StorageUsageAlertService.class);

    private final JdbcTemplate jdbc;
    private final StorageUsagePolicyService policies;
    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final NotificationDispatcher dispatcher;

    public StorageUsageAlertService(JdbcTemplate jdbc, StorageUsagePolicyService policies, UserAccountRepository users,
                                    PermissionEvaluationService permissions, NotificationDispatcher dispatcher) {
        this.jdbc = jdbc;
        this.policies = policies;
        this.users = users;
        this.permissions = permissions;
        this.dispatcher = dispatcher;
    }

    /** Overflow-safe: usage / budget >= percent / 100, without dividing. */
    public static boolean reached(long usedBytes, Long budgetBytes, int warningPercent) {
        if (budgetBytes == null || budgetBytes <= 0) return false;
        return BigInteger.valueOf(usedBytes).multiply(BigInteger.valueOf(100))
                .compareTo(BigInteger.valueOf(budgetBytes).multiply(BigInteger.valueOf(warningPercent))) >= 0;
    }

    /** @return how many administrators were told (0 when nothing was due). A failure is logged and never undoes the measurement. */
    public int afterSuccessfulScan(long usedBytes) {
        try {
            var policy = policies.get();
            boolean reached = reached(usedBytes, policy.budgetBytes(), policy.warningPercent());
            Boolean notified = jdbc.queryForObject("SELECT warning_notified FROM storage_usage_scan_state WHERE id=true", Boolean.class);
            if (!reached) {
                if (Boolean.TRUE.equals(notified)) jdbc.update("UPDATE storage_usage_scan_state SET warning_notified=false WHERE id=true");
                return 0;
            }
            if (Boolean.TRUE.equals(notified)) return 0;
            List<UserAccount> administrators = users.findAll().stream()
                    .filter(u -> u.getStatus() == UserStatus.Active)
                    .filter(u -> permissions.hasPermission(u, CONFIGURATION_PERMISSION))
                    .toList();
            long percent = BigInteger.valueOf(usedBytes).multiply(BigInteger.valueOf(100)).divide(BigInteger.valueOf(policy.budgetBytes())).longValue();
            String title = "Storage is near its limit";
            String message = "The object storage uses " + percent + "% of the budget set in Configuration > Integrations (the warning is at " + policy.warningPercent()
                    + "%). Review the usage by module and file type, or raise the budget.";
            for (UserAccount administrator : administrators) {
                dispatcher.dispatchIndependently(OperationalNotificationEvents.STORAGE_USAGE_WARNING, List.of(administrator),
                        NotificationDispatcher.noticeVariables(title, message, "/settings/configuration/integrations"));
            }
            jdbc.update("UPDATE storage_usage_scan_state SET warning_notified=true WHERE id=true");
            return administrators.size();
        } catch (RuntimeException ex) {
            log.warn("The storage usage warning could not be recorded");
            return 0;
        }
    }
}

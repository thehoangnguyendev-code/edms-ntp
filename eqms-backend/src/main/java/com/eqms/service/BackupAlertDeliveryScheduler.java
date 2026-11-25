package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Tells the people chosen as recipients about the alerts the Backup Agent has raised. The agent cannot send a message itself: once a minute
 * this asks it for the alerts still to be told (it has applied the alert rules: which channels, and nobody-to-tell), tells each recipient in
 * the application and by e-mail as the rule allows, and then says they are done. If the backend stops between telling and saying so, the
 * alert is told again; a repeat is accepted, a lost alert is not. An alert is always in the list of alerts whether or not it was told.
 */
@Service
public class BackupAlertDeliveryScheduler {

    private static final Logger log = LoggerFactory.getLogger(BackupAlertDeliveryScheduler.class);
    static final String ACTION_URL = "/settings/administration/backup/alerts";
    static final String MODULE = "Backup & Restore";

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ObjectNumberService numbers;
    private final BackupAgentClient agent;
    private final UserAccountRepository users;
    private final NotificationDispatcher dispatcher;
    private final DistributedSchedulerLockService lockService;

    public BackupAlertDeliveryScheduler(BackupAgentClient agent, UserAccountRepository users, NotificationDispatcher dispatcher,
                                        DistributedSchedulerLockService lockService) {
        this.agent = agent;
        this.users = users;
        this.dispatcher = dispatcher;
        this.lockService = lockService;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 45_000)
    public void deliver() {
        try (var lease = lockService.tryAcquire("backup-alert-delivery", Duration.ofMinutes(2))) {
            if (!lease.acquired()) return;
            run();
        } catch (Exception e) {
            // the agent may be stopped; the alerts wait for it
            log.debug("Backup alerts were not delivered this time: {}", e.getMessage());
        }
    }

    /** One pass; returns how many alerts were told. */
    public int run() {
        BackupAgentClient.Reply pending = agent.exchange(org.springframework.http.HttpMethod.GET, "/internal/alerts/pending-delivery?limit=50", null);
        if (!pending.ok() || pending.body() == null) return 0;
        JsonNode alerts = pending.body().path("alerts");
        if (!alerts.isArray() || alerts.isEmpty()) return 0;
        List<UserAccount> recipients = new ArrayList<>();
        for (JsonNode name : pending.body().path("recipients")) {
            Optional<UserAccount> person = users.findByUsernameIgnoreCase(name.asText());
            person.filter(p -> p.getStatus() == UserStatus.Active).ifPresent(recipients::add);
        }
        List<String> done = new ArrayList<>();
        for (JsonNode alert : alerts) {
            String code = alert.path("code").asText();
            String severity = alert.path("severity").asText("HIGH");
            String detail = alert.path("detail").asText("");
            String ref = alert.path("ref").asText("");
            String number = numbers == null ? null : numbers.backupAlertNumber(alert.path("id").asText(), ObjectNumberService.currentYear());
            String title = "Backup alert" + (number == null ? "" : " " + number) + ": " + com.eqms.util.DisplayLabels.value(code);
            boolean failed = false;
            for (UserAccount person : recipients) {
                try {
                    // the alert rules of the backup system say which channels an alert uses; the registry policy of backup.alert then decides which are on
                    java.util.Set<String> channels = new java.util.HashSet<>();
                    if (alert.path("inApp").asBoolean(true)) channels.add("IN_APP");
                    if (alert.path("email").asBoolean(false)) channels.add("EMAIL");
                    if (!channels.isEmpty()) {
                        String text = com.eqms.util.DisplayLabels.prose(detail) + " (Severity: " + com.eqms.util.DisplayLabels.value(severity) + (ref.isEmpty() ? "" : ", reference: " + ref) + ")";
                        dispatcher.dispatchIndependently(OperationalNotificationEvents.BACKUP_ALERT, List.of(person),
                                NotificationDispatcher.noticeVariables(title, text, ACTION_URL), channels);
                    }
                } catch (RuntimeException e) {
                    failed = true;
                    log.warn("The backup alert {} could not be told to {}: {}", code, person.getUsername(), e.getMessage());
                }
            }
            if (!failed) done.add(alert.path("id").asText());
        }
        if (!done.isEmpty()) {
            agent.exchange(org.springframework.http.HttpMethod.POST, "/internal/alerts/delivered", Map.of("ids", done));
        }
        return done.size();
    }
}

package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.EmailNotificationService;
import com.eqms.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.util.Map;
import java.util.UUID;

/**
 * Notices of Training Management: an in-app notice and an e-mail to the person who has something to do (a step to sign, a training to attend, an assignment to
 * accept). A notice is sent after the business change is committed, in a transaction of its own, so a failure to notify never undoes or blocks the work; every notice
 * (sent, failed or skipped) is written to {@code training_notification_log}. A reminder carries a key so that it is sent once for each person and day.
 */
@Component
public class TrainingNotifier {
    private static final Logger log = LoggerFactory.getLogger(TrainingNotifier.class);
    public static final String MODULE = "Training";

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;
    private final EmailNotificationService email;
    private final TransactionTemplate separate;

    public TrainingNotifier(JdbcTemplate jdbc, NotificationService notifications, EmailNotificationService email, PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.email = email;
        this.separate = new TransactionTemplate(transactions);
        this.separate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Where the person goes to do the work. */
    public static String path(String objectType, UUID id) {
        return switch (objectType == null ? "" : objectType) {
            case "TRAINING_ACTIVITY" -> "/training-management/activities/" + id;
            case "TRAINING_MATRIX_VERSION" -> "/training-management/matrix/" + id;
            case "TRAINING_JOB_ASSIGNMENT" -> "/training-management/job-assignments/" + id;
            case "TRAINING_SPECIMEN_SIGNATURE" -> "/training-management/specimen-signatures";
            case "TRAINING_RECORD_EXPORT" -> "/training-management/record-exports";
            case "TRAINING_REQUIREMENT" -> "/training-management/requirements/" + id;
            case "TRAINING_LEGACY_EVIDENCE" -> "/training-management/legacy-evidence";
            case "TRAINING_PERSONNEL_REVIEW" -> "/training-management/personnel-reviews/" + id;
            case "TRAINING_COMPLIANCE_SUSPENSIONS" -> "/training-management/compliance?tab=suspensions";
            case "TRAINING_REQUIREMENT_LIST" -> "/training-management/requirements";
            case "TRAINING_DOCUMENT_TRAININGS" -> "/training-management/document-trainings";
            default -> "/training-management/my-training";
        };
    }

    /** The step that waits for the person, said in words. */
    public static String stepText(String stepCode) {
        return switch (stepCode == null ? "" : stepCode) {
            case "CONTENT_REVIEW" -> "review the training content and test";
            case "CONTENT_APPROVE" -> "approve the training content and test";
            case "ACTIVITY_COMPLETE" -> "confirm that the training is completed";
            case "MATRIX_APPROVE" -> "approve a training matrix";
            case "JOB_ASSIGN_EXCEPTION" -> "approve an exception to a job assignment";
            case "SPECIMEN_CONFIRM" -> "confirm a specimen signature";
            case "RECORD_EXPORT_APPROVE" -> "approve an export of a training record";
            case "LEGACY_EVIDENCE_VERIFY" -> "verify the evidence of the training of an imported document";
            case "TRAINER_EXCEPTION" -> "approve an exception for a trainer who is not yet qualified";
            case "REQUIREMENT_REVIEW" -> "review a training requirement";
            case "REQUIREMENT_APPROVE" -> "approve a training requirement";
            case "REVIEW_CLOSE" -> "close a training review";
            default -> "handle a training step";
        };
    }

    /** Sends the notice when the surrounding transaction has committed (at once when there is none). Never throws. */
    public void send(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey) {
        send(event, recipient, sender, title, message, objectType, objectId, dedupeKey, null, null);
    }

    /** The same notice, whose e-mail carries a file (the in-app notice has none). */
    public void send(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey, String attachmentName, byte[] attachment) {
        if (recipient == null || recipient.getId() == null) return;
        Runnable work = () -> {
            try {
                separate.executeWithoutResult(status -> deliver(event, recipient, sender, title, message, objectType, objectId, dedupeKey, attachmentName, attachment));
            } catch (Exception failure) {
                log.warn("Training notice {} to {} was not delivered: {}", event, recipient.getId(), failure.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { work.run(); }
            });
        } else {
            work.run();
        }
    }

    private void deliver(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey, String attachmentName, byte[] attachment) {
        String path = path(objectType, objectId);
        UUID inApp = claim(event, recipient, "IN_APP", title, objectType, objectId, dedupeKey);
        if (inApp != null) {
            try {
                var created = notifications.recordNotification(recipient, sender, "personal", MODULE, event.toLowerCase().replace('_', '-'), title, message, path, objectType, objectId, null, title, "medium", null);
                finish(inApp, created == null ? "SKIPPED" : "SENT", created == null ? "PREFERENCE_OFF" : null);
            } catch (Exception failure) {
                finish(inApp, "FAILED", failure.getClass().getSimpleName());
            }
        }
        UUID mail = claim(event, recipient, "EMAIL", title, objectType, objectId, dedupeKey);
        if (mail != null) {
            if (!StringUtils.hasText(recipient.getEmail())) {
                finish(mail, "SKIPPED", "NO_EMAIL_ADDRESS");
                return;
            }
            try {
                String link = email.resolvePublicAppBaseUrl() + path;
                String body = "<p>" + HtmlUtils.htmlEscape(com.eqms.util.DateTimeFormatUtils.normalizeText(message)) + "</p><p><a href=\"" + HtmlUtils.htmlEscape(link) + "\">Open in EQMS</a></p>";
                boolean sent = email.sendRenderedEmailWithTracking(recipient.getEmail(), "EQMS: " + com.eqms.util.DateTimeFormatUtils.normalizeText(title), body, event, "TRAINING",
                        Map.of("fullName", StringUtils.hasText(recipient.getFullName()) ? recipient.getFullName() : recipient.getUsername()), attachmentName, attachment);
                finish(mail, sent ? "SENT" : "FAILED", sent ? null : "EMAIL_NOT_SENT");
            } catch (Exception failure) {
                finish(mail, "FAILED", failure.getClass().getSimpleName());
            }
        }
    }

    /** Takes the place of the notice in the log; null when the same keyed notice was already sent to this person on this channel. */
    private UUID claim(String event, UserAccount recipient, String channel, String title, String objectType, UUID objectId, String dedupeKey) {
        UUID id = UUID.randomUUID();
        int inserted = jdbc.update("""
            insert into training_notification_log(id, event_code, recipient_user_id, channel, status, object_type, object_id, title, dedupe_key)
            values (?,?,?,?, 'SKIPPED', ?,?,?,?) on conflict do nothing
            """, id, event, recipient.getId(), channel, objectType, objectId, title == null ? null : title.substring(0, Math.min(title.length(), 255)), dedupeKey);
        return inserted > 0 ? id : null;
    }

    private void finish(UUID id, String status, String reason) {
        jdbc.update("update training_notification_log set status=?, reason_code=? where id=?", status, reason, id);
    }
}

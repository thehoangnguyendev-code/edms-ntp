package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.NotificationDispatcher;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Notices of Training Management: an in-app notice and an e-mail to the person who has something to do (a step to sign, a training to attend, an assignment to
 * accept). A notice goes through the notification registry ({@link TrainingNotificationEvents}), so the policy of the event (on or off, channels, wording, icon)
 * and the shared e-mail design apply. A notice is sent after the business change is committed, in a transaction of its own, so a failure to notify never undoes
 * or blocks the work; every notice (sent, failed or skipped) is written to {@code training_notification_log}. A reminder carries a key so that it is sent once
 * for each person and day. The e-mail is "sent" when it is queued in the outbox, whose own record tells whether it was delivered. A notice whose e-mail carries a
 * file (the attendance list and the results sent to QA) goes the same way: the outbox seals the file with the wording and sends it with the e-mail.
 */
@Component
public class TrainingNotifier {
    private static final Logger log = LoggerFactory.getLogger(TrainingNotifier.class);

    private final JdbcTemplate jdbc;
    private final NotificationDispatcher dispatcher;
    private final TransactionTemplate separate;

    public TrainingNotifier(JdbcTemplate jdbc, NotificationDispatcher dispatcher, PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.dispatcher = dispatcher;
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
            // the earlier key of the same screen stays for the notifications that were already sent with it
            case "TRAINING_DOCUMENT_IMPACT_ASSESSMENT", "TRAINING_DOCUMENT_TRAININGS" -> "/training-management/document-impact-assessment";
            default -> "/training-management/my-training/tasks";
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
        boolean withFile = attachment != null;
        UUID inApp = claim(event, recipient, "IN_APP", title, objectType, objectId, dedupeKey);
        UUID mail = claim(event, recipient, "EMAIL", title, objectType, objectId, dedupeKey);
        if (inApp == null && mail == null) return; // the same keyed notice was already sent
        Map<String, String> variables = NotificationDispatcher.noticeVariables(title, message, path(objectType, objectId));
        addContext(variables, sender, objectType, objectId);
        variables.put("recipientName", StringUtils.hasText(recipient.getFullName()) ? recipient.getFullName() : String.valueOf(recipient.getUsername()));
        NotificationDispatcher.Outcome outcome;
        try {
            // a transaction of its own: a failure of the dispatch must not roll back the log of the notice
            outcome = withFile
                    ? dispatcher.dispatchIndependently(TrainingNotificationEvents.registryCode(event), List.of(recipient), variables, new NotificationDispatcher.MailFile(attachmentName, attachment))
                    : dispatcher.dispatchIndependently(TrainingNotificationEvents.registryCode(event), List.of(recipient), variables);
        } catch (Exception failure) {
            if (inApp != null) finish(inApp, "FAILED", failure.getClass().getSimpleName());
            if (mail != null) finish(mail, "FAILED", failure.getClass().getSimpleName());
            return;
        }
        if (outcome == null) outcome = new NotificationDispatcher.Outcome("NOT_REGISTERED", false, false, false, false);
        if (inApp != null) {
            finish(inApp, outcome.inAppSent() ? "SENT" : "SKIPPED", outcome.inAppReason());
        }
        if (mail != null) {
            finish(mail, outcome.emailSent() ? "SENT" : "SKIPPED", outcome.emailReason(StringUtils.hasText(recipient.getEmail())));
        }
    }

    /**
     * The placeholders an administrator can write into the wording of a Training notice, found from the record the notice is about (the training, the requirement)
     * and from the person who acted. A value that cannot be found is left out, so the placeholder shows empty and the notice is still sent.
     */
    private void addContext(Map<String, String> variables, UserAccount sender, String objectType, UUID objectId) {
        if (sender != null && StringUtils.hasText(sender.getFullName())) variables.put("actorName", sender.getFullName());
        if (objectId == null) return;
        try {
            if ("TRAINING_ACTIVITY".equals(objectType)) {
                jdbc.queryForList("select training_number, document_number, due_date from training_activities where id = ?", objectId).stream().findFirst().ifPresent(row -> {
                    putIfPresent(variables, "trainingNumber", row.get("training_number"));
                    putIfPresent(variables, "documentNumber", row.get("document_number"));
                    putIfPresent(variables, "trainingDueDate", row.get("due_date") == null ? null : com.eqms.util.DateTimeFormatUtils.formatDate(row.get("due_date")));
                });
            } else if ("TRAINING_REQUIREMENT".equals(objectType)) {
                jdbc.queryForList("select request_no from training_requirements where id = ?", objectId).stream().findFirst()
                        .ifPresent(row -> putIfPresent(variables, "requestNumber", row.get("request_no")));
            }
        } catch (RuntimeException failure) {
            log.debug("The context of the Training notice {} could not be read: {}", objectId, failure.getMessage());
        }
    }

    private static void putIfPresent(Map<String, String> variables, String name, Object value) {
        if (value != null && StringUtils.hasText(String.valueOf(value))) variables.put(name, String.valueOf(value));
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

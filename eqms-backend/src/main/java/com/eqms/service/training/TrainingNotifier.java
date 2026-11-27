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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

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
    /** One thread for every batch of notices: a large list is worked through one person at a time, in the order sent, and never holds the request or crowds the mail outbox. */
    private static final ExecutorService BATCH = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>(), runnable -> {
        Thread thread = new Thread(runnable, "training-notice-batch");
        thread.setDaemon(true);
        return thread;
    });

    /** One person of a batch; the key makes the notice idempotent (the same key is never sent twice to the same person and channel). */
    public record Notice(UserAccount recipient, String title, String message, String dedupeKey, Map<String, String> extra) {
        public Notice(UserAccount recipient, String title, String message, String dedupeKey) {
            this(recipient, title, message, dedupeKey, null);
        }
    }

    /** Where a person who is on a list of a training opens the notice: their own screen of tasks (the screens of the activity need the permission to view activities). */
    public static final String MY_TRAINING = "/training-management/my-training/tasks";

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
            case "DOCUMENT_REVISION_TRAINING" -> "/documents/revisions/training/" + id;
            case "TRAINING_MATRIX_VERSION" -> "/training-management/matrix/" + id;
            case "TRAINING_JOB_ASSIGNMENT" -> "/training-management/job-assignments/" + id;
            case "TRAINING_SPECIMEN_SIGNATURE" -> "/training-management/specimen-signatures";
            case "TRAINING_RECORD_EXPORT" -> "/training-management/record-exports";
            case "TRAINING_REQUIREMENT" -> "/training-management/requirements/" + id;
            case "TRAINING_LEGACY_EVIDENCE" -> "/training-management/legacy-evidence";
            case "TRAINING_PERSONNEL_REVIEW" -> "/training-management/personnel-reviews/" + id;
            case "TRAINING_PERSONNEL_EVENTS" -> "/training-management/personnel-reviews";
            case "TRAINING_MATRIX_LIST" -> "/training-management/matrix";
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
            case "CONTENT_APPROVE_FIRST" -> "approve the training content and test (first approval)";
            case "CONTENT_APPROVE" -> "approve the training content and test (second approval)";
            case "ACTIVITY_COMPLETE" -> "confirm that the training is completed";
            case "MATRIX_REVIEW" -> "review a training matrix";
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

    /**
     * Many notices of one kind (the invitation of every participant of a training). They are handed to a single background thread once the surrounding transaction has committed, so the
     * person who pressed the button does not wait for them; each goes through the same path as {@link #send}, with its own transaction, log row and key. Never throws.
     */
    public void sendBatch(String event, UserAccount sender, String objectType, UUID objectId, List<Notice> notices) {
        if (notices == null || notices.isEmpty()) return;
        List<Notice> work = List.copyOf(notices);
        Runnable submit = () -> BATCH.execute(() -> {
            for (Notice notice : work) {
                if (notice.recipient() == null || notice.recipient().getId() == null) continue;
                try {
                    separate.executeWithoutResult(status -> deliver(event, notice.recipient(), sender, notice.title(), notice.message(), objectType, objectId, notice.dedupeKey(), null, null, notice.extra()));
                } catch (Exception failure) {
                    log.warn("Training notice {} to {} was not delivered: {}", event, notice.recipient().getId(), failure.getMessage());
                }
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { submit.run(); }
            });
        } else {
            submit.run();
        }
    }

    /**
     * Runs slow work (a list made into a PDF by the document converter, to be attached to a notice) on the background thread of the notices, once the surrounding transaction has committed, so the
     * person who signed does not wait for it and the request does not hold the lock of the record (the converter may be starting and take tens of seconds). At once, on the caller's thread, when
     * there is no transaction. Never throws.
     */
    public void afterCommitInBackground(Runnable work) {
        Runnable guarded = () -> {
            try {
                work.run();
            } catch (Exception failure) {
                log.warn("Background training notice work failed: {}", failure.getMessage(), failure);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { BATCH.execute(guarded); }
            });
        } else {
            guarded.run();
        }
    }

    /** Sends the notice when the surrounding transaction has committed (at once when there is none). Never throws. */
    public void send(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey) {
        send(event, recipient, sender, title, message, objectType, objectId, dedupeKey, null, null);
    }

    /** The same notice, whose e-mail carries a file (the in-app notice has none). */
    public void send(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey, String attachmentName, byte[] attachment) {
        send(event, recipient, sender, title, message, objectType, objectId, dedupeKey, attachmentName, attachment, null);
    }

    /** The same notice with more placeholders for the wording an administrator edits (the session, the old and the new day, the trainer ...). */
    public void sendWith(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, Map<String, String> extra) {
        send(event, recipient, sender, title, message, objectType, objectId, null, null, null, extra);
    }

    private void send(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey, String attachmentName, byte[] attachment, Map<String, String> extra) {
        if (recipient == null || recipient.getId() == null) return;
        Runnable work = () -> {
            try {
                separate.executeWithoutResult(status -> deliver(event, recipient, sender, title, message, objectType, objectId, dedupeKey, attachmentName, attachment, extra));
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

    private void deliver(String event, UserAccount recipient, UserAccount sender, String title, String message, String objectType, UUID objectId, String dedupeKey, String attachmentName, byte[] attachment, Map<String, String> extra) {
        boolean withFile = attachment != null;
        UUID inApp = claim(event, recipient, "IN_APP", title, objectType, objectId, dedupeKey);
        UUID mail = claim(event, recipient, "EMAIL", title, objectType, objectId, dedupeKey);
        if (inApp == null && mail == null) return; // the same keyed notice was already sent
        Map<String, String> variables = NotificationDispatcher.noticeVariables(title, message, path(objectType, objectId));
        addContext(variables, sender, objectType, objectId);
        if (extra != null) extra.forEach((k, v) -> { if (v != null) variables.put(k, v); });
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

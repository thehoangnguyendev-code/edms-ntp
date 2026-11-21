package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sends the expiry notifications for one document (owner decision DOCUMENT-EXPIRY-2026-10-16):
 * every Active user gets the in-app notification and the email; the holders of the copies that were
 * voided are told as well, and that their paper copy will be recalled by the DCO.
 */
@Service
public class DocumentExpiryNotifier {

    public static final String EVENT_ALL_ACTIVE_USERS = "document.expired";
    public static final String EVENT_COPY_HOLDER = "document.expired_copy_holder";

    private final NotificationDispatcher notificationDispatcher;
    private final UserAccountRepository userAccountRepository;
    private final DocumentExpiryProcessingService processingService;
    private final TransactionTemplate readOnlyTransactionTemplate;

    public DocumentExpiryNotifier(
            NotificationDispatcher notificationDispatcher,
            UserAccountRepository userAccountRepository,
            DocumentExpiryProcessingService processingService,
            PlatformTransactionManager transactionManager
    ) {
        this.notificationDispatcher = notificationDispatcher;
        this.userAccountRepository = userAccountRepository;
        this.processingService = processingService;
        this.readOnlyTransactionTemplate = new TransactionTemplate(transactionManager);
        this.readOnlyTransactionTemplate.setReadOnly(true);
    }

    /**
     * Loads recipients in a read-only transaction (the avatar column is a CLOB and needs one, see
     * DocumentObsoleteNotificationService), then dispatches outside it. Marks the document notified only
     * when both dispatches return without throwing; otherwise the scheduler retries it.
     */
    public void notifyExpired(UUID documentId, String documentNumber, String documentName, Instant now) {
        Recipients recipients = readOnlyTransactionTemplate.execute(status -> new Recipients(
                userAccountRepository.findAllByStatus(UserStatus.Active).stream()
                        .filter(user -> user != null)
                        .toList(),
                processingService.copyHolders(documentId)));
        if (recipients == null) {
            return;
        }

        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("documentNumber", documentNumber == null ? "" : documentNumber);
        variables.put("documentTitle", documentName == null ? "" : documentName);
        variables.put("revisionNumber", "");
        variables.put("actionUrl", "/documents/" + documentId);
        variables.put("systemName", "EQMS");

        // A copy holder is also an Active user; they get only the copy-holder message, which says more.
        java.util.Set<UUID> holderIds = recipients.copyHolders().stream().map(UserAccount::getId).collect(java.util.stream.Collectors.toSet());
        List<UserAccount> everyoneElse = recipients.allActive().stream()
                .filter(user -> !holderIds.contains(user.getId()))
                .toList();
        boolean delivered = true;
        if (!everyoneElse.isEmpty()) {
            delivered &= wasHandled(EVENT_ALL_ACTIVE_USERS, notificationDispatcher.dispatch(EVENT_ALL_ACTIVE_USERS, everyoneElse, variables), documentNumber);
        }
        if (!recipients.copyHolders().isEmpty()) {
            delivered &= wasHandled(EVENT_COPY_HOLDER, notificationDispatcher.dispatch(EVENT_COPY_HOLDER, recipients.copyHolders(), variables), documentNumber);
        }
        // Marked only when the notices were really handled: 86 documents were marked "notified" while the
        // dispatcher found no recipient (the policy had no recipient rule) and nobody was told (API review 2026-11-21).
        if (delivered) {
            processingService.markNotified(documentId, now);
        }
    }

    /**
     * A notice is handled when it was sent, or when the administrator switched the event off on purpose
     * (nothing to retry). A refusal for any other reason (no recipient, event not registered) is a failure:
     * the document stays un-notified so that the scheduler tries again, and the log says why.
     */
    private static boolean wasHandled(String eventCode, NotificationDispatcher.Outcome outcome, String documentNumber) {
        if (outcome == null || outcome.blocked() == null || "POLICY_OFF".equals(outcome.blocked())) {
            return true;
        }
        org.slf4j.LoggerFactory.getLogger(DocumentExpiryNotifier.class)
                .error("Expiry notice {} for document {} was not sent: {}", eventCode, documentNumber, outcome.blocked());
        return false;
    }

    private record Recipients(List<UserAccount> allActive, List<UserAccount> copyHolders) {
    }
}

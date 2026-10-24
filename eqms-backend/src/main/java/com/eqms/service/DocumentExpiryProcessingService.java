package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UncontrolledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UncontrolledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Processes one Document whose Valid Until day has started (owner decision DOCUMENT-EXPIRY-2026-10-16):
 * voids its electronic controlled copies, expires its uncontrolled copies, and records the outcome in
 * document_expiry_processing so the document is processed exactly once. Notifications are sent by
 * {@link DocumentExpiryNotifier} after this transaction commits.
 */
@Service
public class DocumentExpiryProcessingService {

    static final String OUTCOME_PROCESSED = "PROCESSED";
    static final String REASON_EXPIRED = "EXPIRED";
    static final String CONTROLLED_DISTRIBUTED = "DISTRIBUTED";
    static final String CONTROLLED_OBSOLETED = "OBSOLETED";
    static final String UNCONTROLLED_EXPIRED = "EXPIRED";
    private static final Set<String> UNCONTROLLED_VOIDABLE = Set.of("REQUESTED", "APPROVED", "GENERATED", "DISTRIBUTED");
    private static final ZoneId SYSTEM_ZONE = DateTimeFormatUtils.ZONE;

    private final JdbcTemplate jdbcTemplate;
    private final DocumentRecordRepository documentRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final UncontrolledCopyRepository uncontrolledCopyRepository;
    private final ControlledCopyExpiryProcessingService controlledCopyExpiryProcessingService;
    private final AuditTrailService auditTrailService;
    private final SystemActorProvider systemActorProvider;
    private final UserAccountRepository userAccountRepository;

    public DocumentExpiryProcessingService(
            JdbcTemplate jdbcTemplate,
            DocumentRecordRepository documentRepository,
            ControlledCopyRepository controlledCopyRepository,
            UncontrolledCopyRepository uncontrolledCopyRepository,
            ControlledCopyExpiryProcessingService controlledCopyExpiryProcessingService,
            AuditTrailService auditTrailService,
            SystemActorProvider systemActorProvider,
            UserAccountRepository userAccountRepository
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.documentRepository = documentRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.uncontrolledCopyRepository = uncontrolledCopyRepository;
        this.controlledCopyExpiryProcessingService = controlledCopyExpiryProcessingService;
        this.auditTrailService = auditTrailService;
        this.systemActorProvider = systemActorProvider;
        this.userAccountRepository = userAccountRepository;
    }

    /** Result of processing one document, used to build the notifications. */
    public record ExpiryOutcome(UUID documentId, String documentNumber, String documentName,
                                int electronicCopiesVoided, int uncontrolledCopiesExpired) {
    }

    /** Active, non-template documents whose Valid Until day has started and that have not been processed yet. */
    @Transactional(readOnly = true)
    public List<UUID> findDueDocumentIds(LocalDate today) {
        return jdbcTemplate.queryForList(
                "SELECT d.id FROM documents d "
                        + "WHERE d.status_code = 'ACTIVE' AND d.is_template = FALSE "
                        + "AND d.valid_until IS NOT NULL AND d.valid_until <= ? "
                        + "AND NOT EXISTS (SELECT 1 FROM document_expiry_processing p WHERE p.document_id = d.id) "
                        + "ORDER BY d.valid_until LIMIT 200",
                UUID.class, java.sql.Date.valueOf(today));
    }

    /** Documents processed but whose notifications have not been sent yet (for example after a failure). */
    @Transactional(readOnly = true)
    public List<UUID> findPendingNotificationDocumentIds() {
        return jdbcTemplate.queryForList(
                "SELECT document_id FROM document_expiry_processing "
                        + "WHERE outcome = 'PROCESSED' AND notified_at IS NULL ORDER BY processed_at LIMIT 200",
                UUID.class);
    }

    /**
     * Voids the electronic copies of one expired document in the caller's transaction. Returns empty when
     * the document was already processed by an earlier run, or is no longer Active.
     */
    @Transactional
    public Optional<ExpiryOutcome> processDocument(UUID documentId, Instant now) {
        int inserted = jdbcTemplate.update(
                "INSERT INTO document_expiry_processing (document_id, outcome, processed_at) "
                        + "VALUES (?, ?, ?) ON CONFLICT (document_id) DO NOTHING",
                documentId, OUTCOME_PROCESSED, java.sql.Timestamp.from(now));
        if (inserted == 0) {
            return Optional.empty();
        }
        DocumentRecord document = documentRepository.findById(documentId).orElse(null);
        if (document == null || document.isTemplate()
                || document.getStatus() == null || !"ACTIVE".equalsIgnoreCase(document.getStatus().getCode())) {
            // Changed by someone else before this run (e.g. obsoleted by hand): nothing left to expire,
            // and no expiry notification is due for it.
            jdbcTemplate.update("UPDATE document_expiry_processing SET notified_at = ? WHERE document_id = ?",
                    java.sql.Timestamp.from(now), documentId);
            return Optional.empty();
        }

        UserAccount systemActor = systemActorProvider.get();
        int controlledVoided = 0;
        for (ControlledCopyRecord copy : controlledCopyRepository.findAllByRevision_Document_IdOrderByCreatedAtDesc(documentId)) {
            // Only copies that reached a recipient are voided here. A copy still Ready for Distribution never
            // left the system, and the distribution step already refuses a copy whose expiry has passed.
            if (CONTROLLED_DISTRIBUTED.equalsIgnoreCase(copy.getStatusCode()) && copy.getExpiryDate() != null) {
                controlledCopyExpiryProcessingService.obsoleteExpiredCopy(copy.getId());
                controlledVoided++;
            }
        }

        int uncontrolledExpired = 0;
        for (UncontrolledCopyRecord copy : uncontrolledCopyRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId)) {
            String fromStatus = copy.getStatusCode();
            if (fromStatus == null || !UNCONTROLLED_VOIDABLE.contains(fromStatus.trim().toUpperCase(java.util.Locale.ROOT))) {
                continue;
            }
            copy.setStatusCode(UNCONTROLLED_EXPIRED);
            copy.setStatus("Expired");
            uncontrolledCopyRepository.save(copy);
            auditTrailService.logAs(systemActor, "Uncontrolled Copy",
                    copy.getUncontrolledCopyNumber() == null ? copy.getId().toString() : copy.getUncontrolledCopyNumber(),
                    copy.getId(), "EXPIRE", fromStatus, UNCONTROLLED_EXPIRED,
                    "Uncontrolled copy expired: the document's Valid Until date has passed (Reason: " + REASON_EXPIRED + ").",
                    List.of(), null);
            uncontrolledExpired++;
        }

        jdbcTemplate.update(
                "UPDATE document_expiry_processing SET electronic_copies_voided = ?, uncontrolled_copies_expired = ? "
                        + "WHERE document_id = ?",
                controlledVoided, uncontrolledExpired, documentId);
        return Optional.of(new ExpiryOutcome(documentId, document.getDocumentNumber(), document.getDocumentName(),
                controlledVoided, uncontrolledExpired));
    }

    /**
     * Recipients of the copies that expiry voided for this document: holders of distributed controlled
     * copies and of uncontrolled copies. Used both right after processing and when a notification is retried.
     */
    @Transactional(readOnly = true)
    public List<UserAccount> copyHolders(UUID documentId) {
        List<UserAccount> holders = new ArrayList<>();
        for (ControlledCopyRecord copy : controlledCopyRepository.findAllByRevision_Document_IdOrderByCreatedAtDesc(documentId)) {
            if (CONTROLLED_OBSOLETED.equalsIgnoreCase(copy.getStatusCode())
                    && REASON_EXPIRED.equalsIgnoreCase(copy.getObsoleteReason())
                    && copy.getRecipientUser() != null) {
                holders.add(copy.getRecipientUser());
            }
        }
        List<UUID> uncontrolledRecipientIds = new ArrayList<>();
        for (UncontrolledCopyRecord copy : uncontrolledCopyRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId)) {
            if (UNCONTROLLED_EXPIRED.equalsIgnoreCase(copy.getStatusCode()) && copy.getRecipientUserId() != null) {
                uncontrolledRecipientIds.add(copy.getRecipientUserId());
            }
        }
        if (!uncontrolledRecipientIds.isEmpty()) {
            userAccountRepository.findAllById(uncontrolledRecipientIds).forEach(holders::add);
        }
        return holders.stream().filter(java.util.Objects::nonNull).distinct().toList();
    }

    @Transactional
    public void markNotified(UUID documentId, Instant now) {
        jdbcTemplate.update("UPDATE document_expiry_processing SET notified_at = ? WHERE document_id = ?",
                java.sql.Timestamp.from(now), documentId);
    }

    static LocalDate today() {
        return LocalDate.now(SYSTEM_ZONE);
    }
}

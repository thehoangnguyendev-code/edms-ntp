package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.dto.executedrecord.RecordExecutionRequest;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.ControlledCopyRecallItem;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ExecutedRecordRepository;
import com.eqms.repository.UserAccountRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Scanned paper Form records. Historical electronic records remain readable. */
@Service
public class ExecutedRecordService {

    private static final ZoneId SYSTEM_ZONE = DateTimeFormatUtils.ZONE;
    private static final String ENTITY_TYPE = "EXECUTED_RECORD";
    private static final int MAX_LIST_PAGE_SIZE = 200;

    public static final String CAPTURE_PAPER = "PAPER_SCAN";

    private static final String STATUS_EXECUTED = "EXECUTED";
    private static final String STATUS_REJECTED = "REJECTED";

    // Historical SoD code retained for legacy pending-record approval/rejection. No fill API exists.
    public static final String P_RECORD_PAPER = "documents.form.record_physical_copy";
    public static final String P_VIEW = "documents.form.view_executed_records";
    public static final String P_DOWNLOAD = "documents.form.download_executed_record";

    private static final String CC_STATUS_READY_FOR_DISTRIBUTION = "READY_FOR_DISTRIBUTION";
    private static final String CC_STATUS_DISTRIBUTED = "DISTRIBUTED";

    private final ExecutedRecordRepository executedRecordRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final AuditTrailService auditTrailService;
    private final ElectronicSignatureService electronicSignatureService;
    private final FileStorageService fileStorageService;

    @org.springframework.beans.factory.annotation.Autowired
    private ControlledCopyService controlledCopyService;

    @org.springframework.beans.factory.annotation.Autowired
    private ControlledCopyPolicyService controlledCopyPolicyService;

    @org.springframework.beans.factory.annotation.Autowired
    private ControlledCopyPdfMarkingService pdfMarkingService;

    public ExecutedRecordService(
            ExecutedRecordRepository executedRecordRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            ControlledCopyRepository controlledCopyRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            ElectronicSignatureService electronicSignatureService,
            FileStorageService fileStorageService
    ) {
        this.executedRecordRepository = executedRecordRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.auditTrailService = auditTrailService;
        this.electronicSignatureService = electronicSignatureService;
        this.fileStorageService = fileStorageService;
    }

    // ---- Paper path -------------------------------------------------------------------------

    /** Creates the Executed Record for one returned paper copy. Only reachable through
     *  {@link #recordPhysicalCopyAndClose}, whose transaction covers it. */
    private ExecutedRecordResponse recordPhysicalCopy(UUID formDocumentId, RecordExecutionRequest request,
                                                       String originalFileName, InputStream fileStream) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_RECORD_PAPER, "Not permitted to record a physical copy");
        DocumentRecord document = requireDocument(formDocumentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        if (document.getDocumentType() == null || !"FORM".equalsIgnoreCase(document.getDocumentType().getShortCode())) {
            throw new IllegalArgumentException("Only Form documents accept scanned physical copies");
        }
        DocumentRevisionRecord effective = requireEffectiveRevision(document);

        UUID controlledCopyId = parseUuid(request.sourceControlledCopyId(), "A Controlled Copy must be selected");
        ControlledCopyRecord controlledCopy = controlledCopyRepository.findById(controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled Copy not found"));
        if (!document.getId().equals(controlledCopy.getDocument().getId())) {
            throw new IllegalArgumentException("The selected Controlled Copy does not belong to this Form");
        }
        requireNotReadAndComply(controlledCopy);
        // Conflict check with the Controlled Copy lifecycle: only a copy still out in the field
        // (not yet recalled/expired/obsoleted) can be logged back in as an Executed Record.
        String ccStatus = controlledCopy.getStatusCode();
        if (!CC_STATUS_READY_FOR_DISTRIBUTION.equals(ccStatus) && !CC_STATUS_DISTRIBUTED.equals(ccStatus)) {
            throw new IllegalStateException("Controlled Copy " + controlledCopy.getControlledCopyNumber()
                    + " is " + controlledCopy.getStatus() + " and can no longer be recorded as an Executed Record.");
        }
        if (executedRecordRepository.existsBySourceControlledCopy_IdAndStatusNot(controlledCopyId, STATUS_REJECTED)) {
            throw new IllegalStateException("This Controlled Copy has already been recorded as an Executed Record.");
        }

        UUID filledByUserId = parseUuid(request.filledByUserId(), "The person who filled this form is required");
        UserAccount filledBy = userAccountRepository.findById(filledByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Filled-by user not found"));

        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber(nextRecordNumber(document));
        record.setFormDocument(document);
        record.setFormRevision(effective);
        record.setCaptureMethod(CAPTURE_PAPER);
        record.setFilledBy(filledBy);
        record.setFilledAt(parseInstantOrNow(request.filledAt()));
        record.setSourceControlledCopy(controlledCopy);

        store(record, document.getId(), originalFileName, fileStream);

        return finalizeSubmission(record, currentUser, request.signatureToken(), request.reason(), "RECORD_LOGGED");
    }

    /**
     * Paper path, launched from the Controlled Copy's own Recall action (not the Form's Executed
     * Records tab) -- "this copy came back filled in" and "this copy is now closed" as one
     * operator action, one e-signature. Reuses {@link #recordPhysicalCopy} unchanged for the
     * record-creation half (same validation, same single RECORD_LOGGED signature), then closes the
     * Controlled Copy register via {@link ControlledCopyService#closeAfterExecutedRecord} -- a
     * system-driven consequence of the record now existing, not a second attested act, so no
     * second signature token is consumed. The plain Recall action (lost/damaged/superseded/etc.,
     * no executed record) is entirely untouched by this.
     */
    @Transactional
    public ExecutedRecordResponse recordPhysicalCopyAndClose(UUID controlledCopyId, RecordExecutionRequest request,
                                                               String originalFileName, InputStream fileStream) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord controlledCopy = controlledCopyRepository.findById(controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled Copy not found"));
        UUID formDocumentId = controlledCopy.getDocument().getId();
        // Forces the path's controlledCopyId regardless of what the request body carries -- this
        // endpoint is launched FROM that one copy's own Recall action, never a free choice.
        // filledByUserId defaults to the copy's own recipient (who it was actually issued to) when
        // not explicitly overridden.
        String filledByUserId = StringUtils.hasText(request.filledByUserId())
                ? request.filledByUserId()
                : (controlledCopy.getRecipientUser() == null ? null : controlledCopy.getRecipientUser().getId().toString());
        RecordExecutionRequest scoped = new RecordExecutionRequest(
                controlledCopyId.toString(), filledByUserId, request.filledAt(), request.reason(), request.signatureToken());
        ExecutedRecordResponse response = recordPhysicalCopy(formDocumentId, scoped, originalFileName, fileStream);
        controlledCopyService.closeAfterExecutedRecord(controlledCopyId, currentUser, "Form completed and returned");
        return response;
    }

    private ExecutedRecordResponse finalizeSubmission(ExecutedRecord record,
                                                        UserAccount currentUser, String signatureToken, String reason, String meaning) {
        // New records complete at submission; legacy PENDING_APPROVAL records keep their existing workflow.
        record.setStatus(STATUS_EXECUTED);

        var signature = electronicSignatureService.createEntitySignature(
                ENTITY_TYPE, record.getId(), record.getRecordNumber(), currentUser,
                signatureToken, meaning, reason, null, null, record.getStatus());
        record.setSubmitSignatureId(signature.getId());

        ExecutedRecord saved = executedRecordRepository.save(record);
        auditTrailService.logAs(currentUser, ENTITY_TYPE, saved.getRecordNumber(), saved.getId(),
                "SUBMIT", null, saved.getStatus(), "Captured via " + saved.getCaptureMethod(), List.of(), signature.getId());
        return toResponse(saved, currentUser);
    }

    // ---- Recall by scan -----------------------------------------------------------------------

    /**
     * Registers the scan of one returned paper copy as a record, for ANY document type. Called inside the recall-by-scan
     * commit transaction: the batch's one electronic signature ({@code signatureId}) is this record's submit signature,
     * so no second signature token is consumed. The scan file was already stored (and virus scanned) when it was
     * uploaded; the record points at that stored file rather than copying it.
     */
    @Transactional
    public ExecutedRecord recordRecalledCopyScan(ControlledCopyRecord copy, ControlledCopyRecallItem item, UserAccount actor,
                                                 Instant receivedAt, UUID recallBatchId, String recallBatchNumber, UUID signatureId) {
        requireNotReadAndComply(copy);
        DocumentRecord document = copy.getDocument();
        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber(nextRecordNumber(document));
        record.setFormDocument(document);
        record.setFormRevision(copy.getRevision());
        record.setCaptureMethod(CAPTURE_PAPER);
        record.setStatus(STATUS_EXECUTED);
        record.setFilledBy(copy.getRecipientUser() != null ? copy.getRecipientUser() : actor);
        record.setFilledAt(receivedAt);
        record.setSourceControlledCopy(copy);
        record.setStorageProvider(item.getStorageProvider());
        record.setStorageBucket(item.getStorageBucket());
        record.setStorageObjectKey(item.getStoredPath());
        record.setStorageVersionId(item.getStorageVersionId());
        record.setChecksum(item.getSha256());
        record.setFileName(item.getFileName());
        record.setContentType(item.getContentType());
        record.setFileSize(item.getFileSize());
        record.setRecallBatchId(recallBatchId);
        record.setSubmitSignatureId(signatureId);
        ExecutedRecord saved = executedRecordRepository.save(record);
        auditTrailService.logAs(actor, ENTITY_TYPE, saved.getRecordNumber(), saved.getId(), "SUBMIT", null, saved.getStatus(),
                "Scan of returned controlled copy " + copy.getControlledCopyNumber() + " (recall batch " + recallBatchNumber + ")",
                List.of(), signatureId);
        return saved;
    }

    /** A copy issued for reading carries nothing worth keeping, so it never becomes a Record (CC-PURPOSE-2026-10-07). */
    private static void requireNotReadAndComply(ControlledCopyRecord copy) {
        if (copy != null && ControlledCopyService.USAGE_READ_AND_COMPLY.equals(copy.getUsagePurpose())) {
            throw new IllegalStateException("Controlled Copy " + copy.getControlledCopyNumber()
                    + " is for reading only (Read and comply): nothing is written on it, so no Record is made from it.");
        }
    }

    // ---- Read / list --------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ExecutedRecordResponse getDetail(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_VIEW, "Not permitted to view Executed Records");
        ExecutedRecord record = requireRecord(id);
        requireCanViewRecord(currentUser, record);
        return toResponse(record, currentUser);
    }

    /** A scan record follows the visibility of the controlled copy it came from: blanket copy viewers see every record,
     *  everyone else only the records of copies on which they are the named recipient. */
    private boolean canViewRecord(UserAccount user, ExecutedRecord record) {
        ControlledCopyRecord origin = record.getSourceControlledCopy();
        if (origin != null && ControlledCopyService.USAGE_READ_AND_COMPLY.equals(origin.getUsagePurpose())) {
            return false; // the Records screens show only what was written: never a record of a copy for reading
        }
        if (documentAuthorizationService.canViewAllControlledCopies(user)) {
            return true;
        }
        ControlledCopyRecord source = record.getSourceControlledCopy();
        return source != null && source.getRecipientUser() != null && user.getId().equals(source.getRecipientUser().getId());
    }

    private void requireCanViewRecord(UserAccount user, ExecutedRecord record) {
        if (!canViewRecord(user, record)) {
            throw new AccessDeniedException("Executed Record access denied");
        }
    }

    /** The stored scan, for in-browser preview. */
    public record RecordFile(byte[] bytes, String contentType, String fileName) {
    }

    /**
     * The scan of a returned paper copy as it is VIEWED or downloaded: the administrator's "Obsoleted" stamp and watermark (a
     * recalled copy is an Obsoleted copy) are drawn on a copy of the bytes, so a recalled paper cannot be mistaken for a valid
     * one. The stored file and its SHA-256 never change. Fails closed: if the marking cannot be drawn, the scan is not served
     * unmarked. Other records (older executed forms) are served as stored.
     */
    private RecordFile markedScan(ExecutedRecord record, byte[] bytes, String contentType, String fileName) {
        ControlledCopyRecord copy = record.getSourceControlledCopy();
        if (copy == null || !CAPTURE_PAPER.equals(record.getCaptureMethod())) {
            return new RecordFile(bytes, contentType, fileName);
        }
        try {
            if (!"application/pdf".equals(contentType)) {
                throw new IllegalStateException("A recalled scan is filed as a PDF; this file is not one.");
            }
            var config = controlledCopyPolicyService.statusMarkingFor(controlledCopyPolicyService.loadOrDefault(),
                    com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking.OBSOLETED);
            // The same lines the obsoleted copy itself shows: its title and the date it was withdrawn (the date the paper came back).
            java.time.Instant ended = copy.getRecalledAt() != null ? copy.getRecalledAt()
                    : copy.getObsoletedAt() != null ? copy.getObsoletedAt() : record.getFilledAt();
            String date = ended == null ? null
                    : "Withdrawn " + com.eqms.util.DateTimeFormatUtils.formatDate(ended.atZone(SYSTEM_ZONE).toLocalDate());
            var lines = pdfMarkingService.statusLines(config,
                    ControlledCopyWithdrawalNoticeService.reasonLabel(copy.getObsoleteReason()), date);
            byte[] marked = pdfMarkingService.applyStatusMarking(bytes, config, lines.watermark(), lines.stamp(), List.of());
            String base = StringUtils.hasText(fileName) ? fileName.replaceFirst("(?i)\\.pdf$", "") : record.getRecordNumber();
            return new RecordFile(marked, "application/pdf", base + ".pdf");
        } catch (RuntimeException ex) {
            throw new IllegalStateException("The scan could not be prepared for viewing", ex);
        }
    }

    /** Streams the scan for the preview modal: needs only the view permission (not download) and the record's visibility. */
    @Transactional(readOnly = true)
    public RecordFile previewFile(UUID id) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_VIEW, "Not permitted to view Executed Records");
        ExecutedRecord record = requireRecord(id);
        requireCanViewRecord(currentUser, record);
        if (!StringUtils.hasText(record.getStorageObjectKey())) {
            throw new IllegalStateException("No file stored for this Executed Record");
        }
        byte[] bytes = fileStorageService.readFile(record.getStorageObjectKey());
        // Never trust the stored/claimed type for what the browser will render: sniff the bytes.
        String sniffed = ControlledCopyScanCodeService.sniffContentType(bytes);
        String contentType = sniffed != null ? sniffed : "application/octet-stream";
        return markedScan(record, bytes, contentType, StringUtils.hasText(record.getFileName()) ? record.getFileName() : record.getRecordNumber());
    }

    @Transactional(readOnly = true)
    public PageResponse<ExecutedRecordResponse> list(
            Integer page, Integer limit, String search,
            String formDocumentId, String controlledCopyId, String filledFrom, String filledTo, String sortBy, String sortDirection
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_VIEW, "Not permitted to view Executed Records");
        int safePage = page == null || page < 1 ? 1 : page;
        int safeLimit = limit == null || limit < 1 ? 20 : Math.min(limit, MAX_LIST_PAGE_SIZE);

        boolean seesAll = documentAuthorizationService.canViewAllControlledCopies(currentUser);
        Specification<ExecutedRecord> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // A record of a copy issued for reading is never listed (a record without a source copy, and records of copies issued before the
            // purpose existed, stay as they are). LEFT join: the filter must not drop records that have no copy.
            var originJoin = root.join("sourceControlledCopy", jakarta.persistence.criteria.JoinType.LEFT);
            predicates.add(cb.or(
                    cb.isNull(originJoin.get("usagePurpose")),
                    cb.notEqual(originJoin.<String>get("usagePurpose"), ControlledCopyService.USAGE_READ_AND_COMPLY)));
            if (!seesAll) {
                // Everyone else sees only the records of copies they hold as the named recipient (account id).
                predicates.add(cb.equal(root.get("sourceControlledCopy").get("recipientUser").get("id"), currentUser.getId()));
            }
            UUID formDocumentUuid = parseUuidOrNull(formDocumentId);
            if (formDocumentUuid != null) {
                predicates.add(cb.equal(root.get("formDocument").get("id"), formDocumentUuid));
            }
            UUID controlledCopyUuid = parseUuidOrNull(controlledCopyId);
            if (controlledCopyUuid != null) {
                predicates.add(cb.equal(root.get("sourceControlledCopy").get("id"), controlledCopyUuid));
            }
            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                // LEFT join: a record without a source copy must still be found by its own or its document's number.
                var copyJoin = root.join("sourceControlledCopy", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("recordNumber")), pattern),
                        cb.like(cb.lower(root.get("formDocument").<String>get("documentNumber")), pattern),
                        cb.like(cb.lower(copyJoin.<String>get("controlledCopyNumber")), pattern)
                ));
            }
            java.time.LocalDate from = parseDate(filledFrom);
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("filledAt"), from.atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            java.time.LocalDate to = parseDate(filledTo);
            if (to != null) {
                predicates.add(cb.lessThan(root.<Instant>get("filledAt"), to.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        Page<ExecutedRecord> result = executedRecordRepository.findAll(
                specification, PageRequest.of(safePage - 1, safeLimit, resolveSort(sortBy, sortDirection)));
        List<ExecutedRecordResponse> data = result.getContent().stream().map(r -> toResponse(r, currentUser)).toList();
        return new PageResponse<>(data, new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public byte[] downloadFile(UUID id) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_DOWNLOAD, "Not permitted to download Executed Record files");
        ExecutedRecord record = requireRecord(id);
        requireCanViewRecord(currentUser, record);
        if (!StringUtils.hasText(record.getStorageObjectKey()) && !StringUtils.hasText(record.getStorageProvider())) {
            throw new IllegalStateException("No file stored for this Executed Record");
        }
        byte[] bytes = fileStorageService.readFile(record.getStorageObjectKey());
        String sniffed = ControlledCopyScanCodeService.sniffContentType(bytes);
        return markedScan(record, bytes, sniffed != null ? sniffed : "application/octet-stream", record.getFileName()).bytes();
    }

    // ---- Helpers ------------------------------------------------------------------------------

    private DocumentRevisionRecord requireEffectiveRevision(DocumentRecord document) {
        return documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")
                .orElseThrow(() -> new IllegalStateException(
                        "This Form has no Effective revision -- Executed Records can only be captured while a revision is Effective."));
    }

    private void store(ExecutedRecord record, UUID formDocumentId, String originalFileName, InputStream fileStream) throws IOException {
        if (fileStream == null || !StringUtils.hasText(originalFileName)) {
            throw new IllegalArgumentException("A file is required");
        }
        var stored = fileStorageService.storeExecutedRecordFile(formDocumentId, record.getId(), originalFileName, fileStream);
        record.setStorageProvider(stored.provider());
        record.setStorageBucket(stored.bucket());
        // storedPath is the canonical reference FileStorageService.readFile/openStoredFile expects
        // (a minio:// URI for MinIO, an absolute path otherwise) -- objectKey alone is not enough.
        record.setStorageObjectKey(stored.storedPath());
        record.setStorageVersionId(stored.versionId());
        record.setChecksum(stored.checksum());
    }

    private String nextRecordNumber(DocumentRecord document) {
        String base = "EXEC-" + firstNonBlank(document.getDocumentNumber(), "DOC").replaceAll("\\s+", "");
        long sequence = executedRecordRepository.countByFormDocument_Id(document.getId()) + 1;
        String candidate = base + "-" + String.format("%03d", sequence);
        while (executedRecordRepository.existsByRecordNumber(candidate)) {
            sequence++;
            candidate = base + "-" + String.format("%03d", sequence);
        }
        return candidate;
    }


    private void requirePermission(UserAccount user, String permission, String message) {
        if (!permissionEvaluationService.hasPermission(user, permission)) {
            throw new AccessDeniedException(message);
        }
    }

    private DocumentRecord requireDocument(UUID documentId) {
        if (documentId == null) {
            throw new IllegalArgumentException("Document not found");
        }
        return documentRecordRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    private ExecutedRecord requireRecord(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Executed Record not found");
        }
        return executedRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Executed Record not found"));
    }

    private UUID parseUuid(String value, String errorMessage) {
        UUID parsed = parseUuidOrNull(value);
        if (parsed == null) {
            throw new IllegalArgumentException(errorMessage);
        }
        return parsed;
    }

    private UUID parseUuidOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private Instant parseInstantOrNow(String value) {
        if (!StringUtils.hasText(value)) {
            return Instant.now();
        }
        try {
            return java.time.LocalDate.parse(value.trim()).atStartOfDay(SYSTEM_ZONE).toInstant();
        } catch (Exception ex) {
            return Instant.now();
        }
    }

    private java.time.LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(value.trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (StringUtils.hasText(v)) {
                return v;
            }
        }
        return "";
    }

    /** One key per column of the Records tables; an unknown key keeps the default (newest record first). Empty values go last. */
    private Sort resolveSort(String sortBy, String sortDirection) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        boolean known = true;
        String property = switch (sortBy == null ? "" : sortBy.trim().toLowerCase(Locale.ROOT)) {
            case "number" -> "recordNumber";
            case "document" -> "formDocument.documentNumber";
            case "copy" -> "sourceControlledCopy.controlledCopyNumber";
            case "recipient" -> "filledBy.fullName";
            case "filled" -> "filledAt";
            case "scan" -> "fileName";
            case "created" -> "createdAt";
            default -> {
                known = false;
                yield "createdAt";
            }
        };
        Sort.Order order = new Sort.Order(known ? direction : Sort.Direction.DESC, property);
        // The id breaks ties so that paging through equal values never repeats or skips a row.
        return Sort.by(order, Sort.Order.asc("id"));
    }

    private ExecutedRecordResponse toResponse(ExecutedRecord record, UserAccount currentUser) {
        DocumentRecord document = record.getFormDocument();
        DocumentRevisionRecord revision = record.getFormRevision();
        ControlledCopyRecord sourceCopy = record.getSourceControlledCopy();
        boolean fileAvailable = StringUtils.hasText(record.getStorageObjectKey());
        return new ExecutedRecordResponse(
                record.getId().toString(),
                record.getRecordNumber(),
                document == null ? null : document.getId().toString(),
                document == null ? null : document.getDocumentNumber(),
                document == null ? null : document.getDocumentName(),
                revision == null ? null : revision.getId().toString(),
                revision == null ? null : revision.getRevisionNumber(),
                record.getCaptureMethod(),
                record.getStatus(),
                record.getFilledBy() == null ? null : record.getFilledBy().getId().toString(),
                record.getFilledBy() == null ? null : record.getFilledBy().getFullName(),
                record.getFilledAt(),
                sourceCopy == null ? null : sourceCopy.getId().toString(),
                sourceCopy == null ? null : sourceCopy.getControlledCopyNumber(),
                fileAvailable,
                record.getApprovedBy() == null ? null : record.getApprovedBy().getId().toString(),
                record.getApprovedBy() == null ? null : record.getApprovedBy().getFullName(),
                record.getRejectedBy() == null ? null : record.getRejectedBy().getId().toString(),
                record.getRejectedBy() == null ? null : record.getRejectedBy().getFullName(),
                record.getRejectedAt(),
                record.getRejectedReason(),
                record.getCreatedAt(),
                record.getFileName(),
                record.getContentType(),
                record.getFileSize(),
                record.getRecallBatchId() == null ? null : record.getRecallBatchId().toString()
        );
    }
}

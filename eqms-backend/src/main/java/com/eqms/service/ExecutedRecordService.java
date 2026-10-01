package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.ApproveExecutedRecordRequest;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.dto.executedrecord.RecordExecutionRequest;
import com.eqms.dto.executedrecord.RejectExecutedRecordRequest;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.EformEditSession;
import com.eqms.entity.EformFillRun;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.FormSettings;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.EformEditSessionRepository;
import com.eqms.repository.EformFillRunRepository;
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

/**
 * A single execution of a Form -- either a filled eForm submission or a scanned paper Controlled
 * Copy -- tracked against its source Form {@link DocumentRecord}. Replaces the prior workaround of
 * uploading a scanned form back in as a brand-new Document with type RECORD. See the approved plan
 * "Form / eForm Executed Records" for the full design rationale.
 *
 * <p>Both capture methods converge on the same lifecycle: DRAFT is never created by this service
 * (a draft eForm in progress is purely a client-side/OnlyOffice-session concept until submitted) --
 * a record is born at SUBMITTED, optionally moves through PENDING_APPROVAL, and ends at EXECUTED or
 * the terminal REJECTED (a rejected record is never reopened; a correction is a fresh execution).
 */
@Service
public class ExecutedRecordService {

    private static final ZoneId SYSTEM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String ENTITY_TYPE = "EXECUTED_RECORD";
    private static final int MAX_LIST_PAGE_SIZE = 200;

    public static final String CAPTURE_EFORM = "EFORM";
    public static final String CAPTURE_PAPER = "PAPER_SCAN";

    private static final String STATUS_PENDING_APPROVAL = "PENDING_APPROVAL";
    private static final String STATUS_EXECUTED = "EXECUTED";
    private static final String STATUS_REJECTED = "REJECTED";

    public static final String P_FILL_EFORM = "documents.form.fill_eform";
    public static final String P_RECORD_PAPER = "documents.form.record_physical_copy";
    public static final String P_APPROVE = "documents.form.approve_executed_record";
    public static final String P_REJECT = "documents.form.reject_executed_record";
    public static final String P_VIEW = "documents.form.view_executed_records";
    public static final String P_DOWNLOAD = "documents.form.download_executed_record";

    private static final String CC_STATUS_READY_FOR_DISTRIBUTION = "READY_FOR_DISTRIBUTION";
    private static final String CC_STATUS_DISTRIBUTED = "DISTRIBUTED";

    private final ExecutedRecordRepository executedRecordRepository;
    private final FormSettingsService formSettingsService;
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
    private final SodConstraintService sodConstraintService;
    private final EformEditSessionRepository eformEditSessionRepository;
    private final EformFillRunRepository eformFillRunRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private ControlledCopyService controlledCopyService;

    public ExecutedRecordService(
            ExecutedRecordRepository executedRecordRepository,
            FormSettingsService formSettingsService,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            ControlledCopyRepository controlledCopyRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            ElectronicSignatureService electronicSignatureService,
            FileStorageService fileStorageService,
            SodConstraintService sodConstraintService,
            EformEditSessionRepository eformEditSessionRepository,
            EformFillRunRepository eformFillRunRepository
    ) {
        this.executedRecordRepository = executedRecordRepository;
        this.formSettingsService = formSettingsService;
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
        this.sodConstraintService = sodConstraintService;
        this.eformEditSessionRepository = eformEditSessionRepository;
        this.eformFillRunRepository = eformFillRunRepository;
    }

    // ---- Paper path -------------------------------------------------------------------------

    @Transactional
    public ExecutedRecordResponse recordPhysicalCopy(UUID formDocumentId, RecordExecutionRequest request,
                                                       String originalFileName, InputStream fileStream) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_RECORD_PAPER, "Not permitted to record a physical copy");
        DocumentRecord document = requireDocument(formDocumentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = requireAllowed(formDocumentId, true);
        DocumentRevisionRecord effective = requireEffectiveRevision(document);

        UUID controlledCopyId = parseUuid(request.sourceControlledCopyId(), "A Controlled Copy must be selected");
        ControlledCopyRecord controlledCopy = controlledCopyRepository.findById(controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled Copy not found"));
        if (!document.getId().equals(controlledCopy.getDocument().getId())) {
            throw new IllegalArgumentException("The selected Controlled Copy does not belong to this Form");
        }
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

        return finalizeSubmission(record, settings, currentUser, request.signatureToken(), request.reason(), "RECORD_LOGGED");
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

    // ---- eForm path (interim: direct upload of an already-filled file) -----------------------

    /**
     * Interim implementation: the user fills the eForm outside the system (or via a manual
     * OnlyOffice session today) and uploads the resulting filled file directly. Live OnlyOffice
     * Form Creator design + in-browser fill-session embedding is the next increment (see plan
     * Phase 0/3) -- this upload path is the fully working, tested lifecycle in the meantime and
     * the wiring point {@link #finalizeSubmission} does not change once that lands.
     */
    @Transactional
    public ExecutedRecordResponse submitEform(UUID formDocumentId, RecordExecutionRequest request,
                                               String originalFileName, InputStream fileStream) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_FILL_EFORM, "Not permitted to fill this eForm");
        DocumentRecord document = requireDocument(formDocumentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = requireAllowed(formDocumentId, false);
        DocumentRevisionRecord effective = requireEffectiveRevision(document);

        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber(nextRecordNumber(document));
        record.setFormDocument(document);
        record.setFormRevision(effective);
        record.setCaptureMethod(CAPTURE_EFORM);
        record.setFilledBy(currentUser);
        record.setFilledAt(Instant.now());

        store(record, document.getId(), originalFileName, fileStream);

        return finalizeSubmission(record, settings, currentUser, request.signatureToken(), request.reason(), "EFORM_SUBMITTED");
    }

    /**
     * Live path (Phase 2a): the user filled the Form's designed fields directly in OnlyOffice
     * instead of uploading a file. {@code eformSessionId} must be a FILL session this same user
     * started, already saved at least once by an OnlyOffice callback. Reuses
     * {@link #finalizeSubmission} unchanged -- only how the file is acquired differs from
     * {@link #submitEform}.
     */
    @Transactional
    public ExecutedRecordResponse submitEformFromSession(UUID formDocumentId, UUID eformSessionId, String reason, String signatureToken) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_FILL_EFORM, "Not permitted to fill this eForm");
        DocumentRecord document = requireDocument(formDocumentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = requireAllowed(formDocumentId, false);
        DocumentRevisionRecord effective = requireEffectiveRevision(document);

        EformEditSession session = eformEditSessionRepository.findById(eformSessionId)
                .orElseThrow(() -> new IllegalArgumentException("eForm session not found"));
        if (!"FILL".equals(session.getKind()) || !document.getId().equals(session.getFormDocument().getId())) {
            throw new IllegalArgumentException("This session does not belong to this Form");
        }
        if (session.getStartedBy() == null || !session.getStartedBy().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You did not start this eForm session");
        }
        if (!"SAVED".equals(session.getStatus())) {
            throw new IllegalStateException("Fill in at least one field (and let it auto-save) before submitting.");
        }

        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber(nextRecordNumber(document));
        record.setFormDocument(document);
        record.setFormRevision(effective);
        record.setCaptureMethod(CAPTURE_EFORM);
        record.setFilledBy(currentUser);
        record.setFilledAt(Instant.now());

        // A fresh copy under the ExecutedRecord's own storage key -- its file must remain
        // immutable and independent of the session's lifecycle (which may be cleaned up later).
        try (InputStream sessionFile = fileStorageService.openStoredFile(session.getStorageObjectKey())) {
            store(record, document.getId(), document.getDocumentNumber() + "_" + record.getRecordNumber() + ".pdf", sessionFile);
        }

        session.setStatus("SUBMITTED");
        eformEditSessionRepository.save(session);

        return finalizeSubmission(record, settings, currentUser, signatureToken, reason, "EFORM_SUBMITTED");
    }

    /**
     * Sequential path (Phase 2a multi-signer): the last Role in a Form's configured signing order
     * just signed off its {@link EformFillRun}, which has now accumulated every prior role's work
     * into one file. Called only by {@code EformEditSessionService#completeFillStep} once it has
     * confirmed the run is COMPLETED -- never exposed as a standalone permission check beyond the
     * caller already being that last signer. Reuses {@link #finalizeSubmission} unchanged, exactly
     * like {@link #submitEformFromSession} does for the single-signer case.
     */
    @Transactional
    public ExecutedRecordResponse submitEformFromFillRun(UUID formDocumentId, UUID fillRunId, String reason, String signatureToken) throws IOException {
        // Called only internally by EformEditSessionService#completeFillStep once it has confirmed
        // the caller is the last signer in this run's sequence -- authorization already happened
        // there via EformSignerAssignment, not a generic documents.form.fill_eform permission check
        // (the final signer may hold only a sign role, not the broader fill permission).
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = requireDocument(formDocumentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = requireAllowed(formDocumentId, false);
        DocumentRevisionRecord effective = requireEffectiveRevision(document);

        EformFillRun run = eformFillRunRepository.findById(fillRunId)
                .orElseThrow(() -> new IllegalArgumentException("Fill run not found"));
        if (!document.getId().equals(run.getFormDocument().getId())) {
            throw new IllegalArgumentException("This fill run does not belong to this Form");
        }
        if (!"COMPLETED".equals(run.getStatus())) {
            throw new IllegalStateException("Not all signer roles have completed yet.");
        }

        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber(nextRecordNumber(document));
        record.setFormDocument(document);
        record.setFormRevision(effective);
        record.setCaptureMethod(CAPTURE_EFORM);
        // The person who actually did the data-entry FILL phase, not the last signer calling this
        // method (they may be a different person entirely).
        record.setFilledBy(run.getStartedBy());
        record.setFilledAt(run.getCreatedAt());
        record.setSourceControlledCopy(run.getControlledCopy());

        try (InputStream runFile = fileStorageService.openStoredFile(run.getStorageObjectKey())) {
            store(record, document.getId(), document.getDocumentNumber() + "_" + record.getRecordNumber() + ".pdf", runFile);
        }

        return finalizeSubmission(record, settings, currentUser, signatureToken, reason, "EFORM_SUBMITTED");
    }

    private ExecutedRecordResponse finalizeSubmission(ExecutedRecord record, FormSettings settings,
                                                        UserAccount currentUser, String signatureToken, String reason, String meaning) {
        boolean needsApproval = settings.isRequireApproval();
        record.setStatus(needsApproval ? STATUS_PENDING_APPROVAL : STATUS_EXECUTED);

        var signature = electronicSignatureService.createEntitySignature(
                ENTITY_TYPE, record.getId(), record.getRecordNumber(), currentUser,
                signatureToken, meaning, reason, null, null, record.getStatus());
        record.setSubmitSignatureId(signature.getId());

        ExecutedRecord saved = executedRecordRepository.save(record);
        auditTrailService.logAs(currentUser, ENTITY_TYPE, saved.getRecordNumber(), saved.getId(),
                "SUBMIT", null, saved.getStatus(), "Captured via " + saved.getCaptureMethod(), List.of(), signature.getId());
        return toResponse(saved, currentUser);
    }

    // ---- Approval -----------------------------------------------------------------------------

    @Transactional
    public ExecutedRecordResponse approve(UUID id, ApproveExecutedRecordRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_APPROVE, "Not permitted to approve Executed Records");
        ExecutedRecord record = requireRecord(id);
        requireStatus(record, "approved", STATUS_PENDING_APPROVAL);
        // Self-approval guard: the filler cannot also approve their own record, when an admin has
        // configured fill/approve as a conflicting permission pair (same SoD mechanism the rest of
        // the app uses -- off by default, opt-in via Settings > Security > Segregation of Duties).
        boolean ownRecord = record.getFilledBy() != null && record.getFilledBy().getId().equals(currentUser.getId());
        if (ownRecord && sodConstraintService.isActiveConstraint(P_FILL_EFORM, P_APPROVE)) {
            throw new AccessDeniedException("You filled this record and cannot also approve it (Segregation of Duties).");
        }

        var signature = electronicSignatureService.createEntitySignature(
                ENTITY_TYPE, record.getId(), record.getRecordNumber(), currentUser,
                request.signatureToken(), "EFORM_APPROVED", request.comment(), null, STATUS_PENDING_APPROVAL, STATUS_EXECUTED);
        record.setApproveSignatureId(signature.getId());
        record.setApprovedBy(currentUser);
        record.setStatus(STATUS_EXECUTED);

        ExecutedRecord saved = executedRecordRepository.save(record);
        auditTrailService.logAs(currentUser, ENTITY_TYPE, saved.getRecordNumber(), saved.getId(),
                "APPROVE", STATUS_PENDING_APPROVAL, STATUS_EXECUTED, request.comment(), List.of(), signature.getId());
        return toResponse(saved, currentUser);
    }

    @Transactional
    public ExecutedRecordResponse reject(UUID id, RejectExecutedRecordRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_REJECT, "Not permitted to reject Executed Records");
        if (!StringUtils.hasText(request.reason())) {
            throw new IllegalArgumentException("A rejection reason is required");
        }
        ExecutedRecord record = requireRecord(id);
        requireStatus(record, "rejected", STATUS_PENDING_APPROVAL);
        boolean ownRecord = record.getFilledBy() != null && record.getFilledBy().getId().equals(currentUser.getId());
        if (ownRecord && sodConstraintService.isActiveConstraint(P_FILL_EFORM, P_REJECT)) {
            throw new AccessDeniedException("You filled this record and cannot also reject it (Segregation of Duties).");
        }

        var signature = electronicSignatureService.createEntitySignature(
                ENTITY_TYPE, record.getId(), record.getRecordNumber(), currentUser,
                request.signatureToken(), "EFORM_REJECTED", request.reason(), null, STATUS_PENDING_APPROVAL, STATUS_REJECTED);
        record.setRejectedBy(currentUser);
        record.setRejectedAt(Instant.now());
        record.setRejectedReason(request.reason());
        record.setStatus(STATUS_REJECTED);

        ExecutedRecord saved = executedRecordRepository.save(record);
        auditTrailService.logAs(currentUser, ENTITY_TYPE, saved.getRecordNumber(), saved.getId(),
                "REJECT", STATUS_PENDING_APPROVAL, STATUS_REJECTED, request.reason(), List.of(), signature.getId());
        return toResponse(saved, currentUser);
    }

    // ---- Read / list --------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ExecutedRecordResponse getDetail(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_VIEW, "Not permitted to view Executed Records");
        return toResponse(requireRecord(id), currentUser);
    }

    @Transactional(readOnly = true)
    public PageResponse<ExecutedRecordResponse> list(
            Integer page, Integer limit, String search, String status, String captureMethod,
            String formDocumentId, String filledFrom, String filledTo, String sortBy, String sortDirection
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_VIEW, "Not permitted to view Executed Records");
        int safePage = page == null || page < 1 ? 1 : page;
        int safeLimit = limit == null || limit < 1 ? 20 : Math.min(limit, MAX_LIST_PAGE_SIZE);

        Specification<ExecutedRecord> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status.trim())) {
                predicates.add(cb.equal(root.get("status"), status.trim().toUpperCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(captureMethod) && !"all".equalsIgnoreCase(captureMethod.trim())) {
                predicates.add(cb.equal(root.get("captureMethod"), captureMethod.trim().toUpperCase(Locale.ROOT)));
            }
            UUID formDocumentUuid = parseUuidOrNull(formDocumentId);
            if (formDocumentUuid != null) {
                predicates.add(cb.equal(root.get("formDocument").get("id"), formDocumentUuid));
            }
            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("recordNumber")), pattern),
                        cb.like(cb.lower(root.get("formDocument").<String>get("documentNumber")), pattern)
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
        if (!StringUtils.hasText(record.getStorageObjectKey()) && !StringUtils.hasText(record.getStorageProvider())) {
            throw new IllegalStateException("No file stored for this Executed Record");
        }
        return fileStorageService.readFile(record.getStorageObjectKey());
    }

    // ---- Helpers ------------------------------------------------------------------------------

    private FormSettings requireAllowed(UUID formDocumentId, boolean paper) {
        FormSettings settings = formSettingsService.requireSettingsOrNull(formDocumentId);
        if (settings == null || (paper ? !settings.isAllowPaper() : !settings.isAllowEform())) {
            throw new IllegalStateException(paper
                    ? "This Form does not accept physical-copy Executed Records."
                    : "This Form does not accept eForm submissions.");
        }
        return settings;
    }

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

    private void requireStatus(ExecutedRecord record, String action, String... allowed) {
        for (String s : allowed) {
            if (s.equals(record.getStatus())) {
                return;
            }
        }
        throw new IllegalStateException("Executed Record " + record.getRecordNumber() + " is " + record.getStatus()
                + " and cannot be " + action + ".");
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

    private Sort resolveSort(String sortBy, String sortDirection) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String property = switch (sortBy == null ? "" : sortBy.trim().toLowerCase(Locale.ROOT)) {
            case "number" -> "recordNumber";
            case "status" -> "status";
            case "method" -> "captureMethod";
            case "filled" -> "filledAt";
            default -> "createdAt";
        };
        return Sort.by(direction, property);
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
                record.getCreatedAt()
        );
    }
}

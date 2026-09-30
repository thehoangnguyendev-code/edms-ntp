package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyActionRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyBatchDistributeRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyCreateRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyEligibilityRuleRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyEligibilityRuleResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyFiltersResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyRequestContextResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyResponse;
import com.eqms.dto.user.LookupItemResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UncontrolledCopyDistributionJob;
import com.eqms.entity.UncontrolledCopyDistributionJobItem;
import com.eqms.entity.UncontrolledCopyEligibilityRule;
import com.eqms.entity.UncontrolledCopyPolicySetting;
import com.eqms.entity.UncontrolledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.UncontrolledCopyDistributionJobItemRepository;
import com.eqms.repository.UncontrolledCopyDistributionJobRepository;
import com.eqms.repository.UncontrolledCopyEligibilityRuleRepository;
import com.eqms.repository.UncontrolledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Uncontrolled Copy lifecycle: Request -> (Approve | Reject) -> Generate -> Distribute, plus Cancel before
 * distribution and lazy/scheduled Expiry after the policy's validity window. Deliberately separate from
 * {@link ControlledCopyService} (own table, own permissions, own audit entity type "Uncontrolled Copy") --
 * an Uncontrolled Copy is never tracked, recalled or reconciled after issuance. Reuses only generic
 * plumbing: {@link ControlledCopyPdfMarkingService} for the watermark/stamp overlay, {@link FileStorageService}
 * for storage, the e-signature / audit services, and the async job shape of the Controlled Copy batch pipeline.
 */
@Service
public class UncontrolledCopyService {

    private static final Logger log = LoggerFactory.getLogger(UncontrolledCopyService.class);
    private static final ZoneId SYSTEM_ZONE = ZoneId.systemDefault();
    private static final int MAX_LIST_PAGE_SIZE = 50;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static final String ENTITY_TYPE = "Uncontrolled Copy";
    private static final String SIGNATURE_ENTITY_TYPE = "UncontrolledCopyRecord";

    /** Default watermark title line; editable on the Uncontrolled Copies Policy screen. */
    public static final String MANDATORY_WATERMARK_TEXT = "UNCONTROLLED COPY — NOT VALID FOR PRODUCTION USE";

    public static final String STATUS_REQUESTED = "REQUESTED";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_GENERATED = "GENERATED";
    public static final String STATUS_DISTRIBUTED = "DISTRIBUTED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_EXPIRED = "EXPIRED";
    private static final List<String> ALL_STATUSES = List.of(
            STATUS_REQUESTED, STATUS_APPROVED, STATUS_REJECTED, STATUS_GENERATED, STATUS_DISTRIBUTED, STATUS_CANCELLED, STATUS_EXPIRED);

    public static final String P_REQUEST = "documents.uncontrolled_copy.request";
    public static final String P_APPROVE = "documents.uncontrolled_copy.approve_request";
    public static final String P_REJECT = "documents.uncontrolled_copy.reject_request";
    public static final String P_CANCEL = "documents.uncontrolled_copy.cancel_request";
    public static final String P_DISTRIBUTE = "documents.uncontrolled_copy.distribute";
    public static final String P_VIEW = "documents.uncontrolled_copy.view";
    public static final String P_VIEW_FILE = "documents.uncontrolled_copy.view_file";
    public static final String P_PREVIEW_FILE = "documents.uncontrolled_copy.preview_file";
    public static final String P_DOWNLOAD_FILE = "documents.uncontrolled_copy.download_file";
    private static final String P_REQUEST_FOR_OTHERS = "documents.workspace.manage";

    /** Outcome of one async e-mail delivery attempt; mirrors ControlledCopyFinalizationOutcome but kept separate on purpose. */
    public enum DeliveryOutcome { SUCCESS, FAILED, SKIPPED }

    public record FileDownload(byte[] bytes, String fileName, String contentType) {
    }

    private final UncontrolledCopyRepository uncontrolledCopyRepository;
    private final UncontrolledCopyEligibilityRuleRepository eligibilityRuleRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final UncontrolledCopyDistributionJobRepository jobRepository;
    private final UncontrolledCopyDistributionJobItemRepository jobItemRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final AuditTrailService auditTrailService;
    private final ElectronicSignatureService electronicSignatureService;
    private final FileStorageService fileStorageService;
    private final ControlledCopyPdfMarkingService pdfMarkingService;
    private final UncontrolledCopyPolicyService policyService;
    private final EmailNotificationService emailNotificationService;
    private final SystemActorProvider systemActorProvider;
    private final ApplicationEventPublisher eventPublisher;
    private final SodConstraintService sodConstraintService;

    public UncontrolledCopyService(
            UncontrolledCopyRepository uncontrolledCopyRepository,
            UncontrolledCopyEligibilityRuleRepository eligibilityRuleRepository,
            DocumentTypeRepository documentTypeRepository,
            UncontrolledCopyDistributionJobRepository jobRepository,
            UncontrolledCopyDistributionJobItemRepository jobItemRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            ElectronicSignatureService electronicSignatureService,
            FileStorageService fileStorageService,
            ControlledCopyPdfMarkingService pdfMarkingService,
            UncontrolledCopyPolicyService policyService,
            EmailNotificationService emailNotificationService,
            SystemActorProvider systemActorProvider,
            ApplicationEventPublisher eventPublisher,
            SodConstraintService sodConstraintService
    ) {
        this.uncontrolledCopyRepository = uncontrolledCopyRepository;
        this.eligibilityRuleRepository = eligibilityRuleRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.jobRepository = jobRepository;
        this.jobItemRepository = jobItemRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.auditTrailService = auditTrailService;
        this.electronicSignatureService = electronicSignatureService;
        this.fileStorageService = fileStorageService;
        this.pdfMarkingService = pdfMarkingService;
        this.policyService = policyService;
        this.emailNotificationService = emailNotificationService;
        this.systemActorProvider = systemActorProvider;
        this.eventPublisher = eventPublisher;
        this.sodConstraintService = sodConstraintService;
    }

    // ------------------------------------------------------------------------------------------------------------
    // Read side
    // ------------------------------------------------------------------------------------------------------------

    public UncontrolledCopyFiltersResponse getFilters() {
        List<LookupItemResponse> statuses = ALL_STATUSES.stream()
                .map(code -> new LookupItemResponse(code, statusLabel(code), code, statusLabel(code), code))
                .toList();
        return new UncontrolledCopyFiltersResponse(statuses);
    }

    @Transactional(readOnly = true)
    public PageResponse<UncontrolledCopyResponse> list(
            Integer page,
            Integer limit,
            String search,
            String status,
            String documentId,
            String createdFrom,
            String createdTo,
            String validFrom,
            String validTo,
            String approvedFrom,
            String approvedTo,
            String distributedFrom,
            String distributedTo,
            String sortBy,
            String sortDirection
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(currentUser, P_VIEW, P_REQUEST)) {
            throw new AccessDeniedException("Uncontrolled copy access denied");
        }
        int safePage = page == null || page < 1 ? 1 : page;
        int safeLimit = limit == null || limit < 1 ? 20 : Math.min(limit, MAX_LIST_PAGE_SIZE);
        boolean seesAll = seesAllCopies(currentUser);
        Specification<UncontrolledCopyRecord> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!seesAll) {
                predicates.add(cb.equal(root.get("requestedBy").get("id"), currentUser.getId()));
            }
            if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status.trim())) {
                predicates.add(cb.equal(root.get("statusCode"), status.trim().toUpperCase(Locale.ROOT)));
            }
            UUID documentUuid = parseUuidOrNull(documentId);
            if (documentUuid != null) {
                predicates.add(cb.equal(root.get("document").get("id"), documentUuid));
            }
            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("uncontrolledCopyNumber")), pattern),
                        cb.like(cb.lower(root.<String>get("documentNumber")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("documentTitle"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("reason"), "")), pattern)
                ));
            }
            LocalDate from = parseDate(createdFrom);
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("createdAt"), from.atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate to = parseDate(createdTo);
            if (to != null) {
                predicates.add(cb.lessThan(root.<Instant>get("createdAt"), to.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate validFromDate = parseDate(validFrom);
            if (validFromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("validUntil"), validFromDate.atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate validToDate = parseDate(validTo);
            if (validToDate != null) {
                predicates.add(cb.lessThan(root.<Instant>get("validUntil"), validToDate.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate approvedFromDate = parseDate(approvedFrom);
            if (approvedFromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("approvedAt"), approvedFromDate.atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate approvedToDate = parseDate(approvedTo);
            if (approvedToDate != null) {
                predicates.add(cb.lessThan(root.<Instant>get("approvedAt"), approvedToDate.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate distributedFromDate = parseDate(distributedFrom);
            if (distributedFromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("distributedAt"), distributedFromDate.atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            LocalDate distributedToDate = parseDate(distributedTo);
            if (distributedToDate != null) {
                predicates.add(cb.lessThan(root.<Instant>get("distributedAt"), distributedToDate.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Page<UncontrolledCopyRecord> result = uncontrolledCopyRepository.findAll(
                specification, PageRequest.of(safePage - 1, safeLimit, resolveSort(sortBy, sortDirection)));
        List<UncontrolledCopyResponse> data = result.getContent().stream().map(copy -> toResponse(copy, currentUser)).toList();
        return new PageResponse<>(data, new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public UncontrolledCopyResponse getDetail(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        if (!canViewRecord(currentUser, copy)) {
            throw new AccessDeniedException("Uncontrolled copy access denied");
        }
        return toResponse(copy, currentUser);
    }

    @Transactional(readOnly = true)
    public UncontrolledCopyRequestContextResponse getRequestContext(String documentId, String revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = null;
        DocumentRevisionRecord requestedRevision = null;
        if (StringUtils.hasText(revisionId)) {
            requestedRevision = documentRevisionRepository.findById(UUID.fromString(revisionId.trim()))
                    .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
            document = requestedRevision.getDocument();
        }
        if (document == null) {
            document = resolveDocument(documentId);
        }
        documentAuthorizationService.requireCanViewDocument(currentUser, document);

        DocumentRevisionRecord effective = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE").orElse(null);
        String documentStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        EligibilityResult eligibility = resolveEligibility(document);
        boolean typeEligible = eligibility.allowed();
        boolean hasPermission = permissionEvaluationService.hasPermission(currentUser, P_REQUEST);
        boolean revisionMatches = requestedRevision == null || (effective != null && Objects.equals(requestedRevision.getId(), effective.getId()));
        boolean documentActive = "ACTIVE".equalsIgnoreCase(documentStatus == null ? null : documentStatus.trim());
        boolean canRequest = hasPermission && typeEligible && effective != null && revisionMatches && documentActive && !document.isTemplate();

        String message = null;
        if (!canRequest) {
            if (!hasPermission) {
                message = "You do not have permission to request an uncontrolled copy.";
            } else if (document.isTemplate()) {
                message = "Template documents cannot have an uncontrolled copy requested.";
            } else if (!typeEligible) {
                message = eligibility.reason() != null ? eligibility.reason() : "Uncontrolled copies are not enabled for this document.";
            } else if (effective == null || !revisionMatches) {
                message = "Uncontrolled copies can only be requested for the current Effective revision.";
            } else {
                message = "Uncontrolled copies are available only when the document is Active.";
            }
        }
        UncontrolledCopyPolicySetting policy = policyService.loadOrDefault();
        DocumentRevisionRecord shown = effective != null ? effective : requestedRevision;
        return new UncontrolledCopyRequestContextResponse(
                idString(document.getId()),
                document.getDocumentNumber(),
                document.getDocumentName(),
                document.getDocumentType() == null ? null : document.getDocumentType().getName(),
                documentStatus,
                shown == null ? null : idString(shown.getId()),
                shown == null ? null : shown.getRevisionNumber(),
                shown == null || shown.getStatus() == null ? null : shown.getStatus().getCode(),
                typeEligible,
                canRequest,
                hasPermission && permissionEvaluationService.hasPermission(currentUser, P_REQUEST_FOR_OTHERS),
                message,
                policy.isApprovalRequired(),
                policy.getValidityHours(),
                policy.isAllowRedownload(),
                policyService.markingFor(policy),
                normalize(policyService.markingFor(policy).watermarkText())
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDistributionJobStatus(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        if (!canViewRecord(currentUser, copy)) {
            throw new AccessDeniedException("Uncontrolled copy access denied");
        }
        UncontrolledCopyDistributionJob job = jobRepository.findByUncontrolledCopy_IdOrderByCreatedAtDesc(id).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No distribution job found for uncontrolled copy: " + id));
        List<UncontrolledCopyDistributionJobItem> items = jobItemRepository.findAllByJob_IdOrderByIdAsc(job.getId());
        boolean finished = "COMPLETED".equals(job.getStatus()) || "COMPLETED_WITH_ERRORS".equals(job.getStatus());
        int succeeded = finished ? job.getSucceededItems() : (int) items.stream().filter(i -> "SUCCESS".equals(i.getStatus())).count();
        int failed = finished ? job.getFailedItems() : (int) items.stream().filter(i -> "FAILED".equals(i.getStatus())).count();
        int skipped = finished
                ? Math.max(job.getTotalItems() - succeeded - failed, 0)
                : (int) items.stream().filter(i -> "SKIPPED".equals(i.getStatus())).count();
        String status = switch (job.getStatus()) {
            case "COMPLETED" -> "completed";
            case "COMPLETED_WITH_ERRORS" -> "completed_with_errors";
            default -> "in_progress";
        };
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("uncontrolledCopyId", id.toString());
        response.put("jobId", job.getId().toString());
        response.put("processed", succeeded + failed + skipped);
        response.put("total", job.getTotalItems());
        response.put("succeeded", succeeded);
        response.put("failed", failed);
        response.put("skipped", skipped);
        response.put("status", status);
        response.put("lastError", items.stream().map(UncontrolledCopyDistributionJobItem::getLastErrorMessage)
                .filter(StringUtils::hasText).findFirst().orElse(null));
        return response;
    }

    // ------------------------------------------------------------------------------------------------------------
    // Lifecycle actions
    // ------------------------------------------------------------------------------------------------------------

    @Transactional
    public UncontrolledCopyResponse requestUncontrolledCopy(UncontrolledCopyCreateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_REQUEST, "You do not have permission to request an uncontrolled copy.");
        DocumentRecord document = resolveDocument(request == null ? null : request.documentId());
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        if (document.isTemplate()) {
            throw new IllegalArgumentException("Uncontrolled copies cannot be requested for controlled document templates");
        }
        String documentStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        if (!"ACTIVE".equalsIgnoreCase(documentStatus == null ? null : documentStatus.trim())) {
            throw new IllegalArgumentException("Uncontrolled copies are available only when the document is Active.");
        }
        EligibilityResult eligibility = resolveEligibility(document);
        if (!eligibility.allowed()) {
            throw new IllegalArgumentException(eligibility.reason() != null
                    ? eligibility.reason() : "Uncontrolled copies are not enabled for this document.");
        }
        DocumentRevisionRecord revision = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")
                .orElseThrow(() -> new IllegalArgumentException("Uncontrolled copies can only be requested for an Effective revision."));
        UUID requestedRevisionId = parseUuidOrNull(request == null ? null : request.revisionId());
        if (requestedRevisionId != null && !requestedRevisionId.equals(revision.getId())) {
            throw new IllegalArgumentException("Uncontrolled copies can only be requested for the current Effective revision.");
        }
        String reason = normalize(request == null ? null : request.reason());
        if (!StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("A request reason is required.");
        }
        ObjectNode recipient = resolveRecipient(currentUser, request);

        UncontrolledCopyPolicySetting policy = policyService.loadOrDefault();
        Instant now = Instant.now();
        UncontrolledCopyRecord copy = new UncontrolledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setRevision(revision);
        copy.setUncontrolledCopyNumber(nextUncontrolledCopyNumber(document));
        copy.setDocumentNumber(document.getDocumentNumber());
        copy.setDocumentTitle(document.getDocumentName());
        copy.setRevisionNumber(revision.getRevisionNumber());
        copy.setReason(reason);
        copy.setRequestedBy(currentUser);
        copy.setRequestedAt(now);
        copy.setRecipientSnapshot(recipient);
        setStatus(copy, policy.isApprovalRequired() ? STATUS_REQUESTED : STATUS_APPROVED);
        uncontrolledCopyRepository.saveAndFlush(copy);

        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                SIGNATURE_ENTITY_TYPE, copy.getId(), copy.getUncontrolledCopyNumber(), currentUser,
                request == null ? null : request.signatureToken(), "UNCONTROLLED_COPY_REQUESTED", reason, null, null, copy.getStatus());
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "REQUEST",
                null, copy.getStatus(), "Reason: " + reason + "; Recipient: " + recipientLabel(recipient), List.of(), signatureId(signature));
        if (!policy.isApprovalRequired()) {
            auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "AUTO_APPROVE",
                    statusLabel(STATUS_REQUESTED), copy.getStatus(),
                    "Approval step not required by the Uncontrolled Copies Policy.", List.of(), null);
        }
        return toResponse(copy, currentUser);
    }

    @Transactional
    public UncontrolledCopyResponse approveRequest(UUID id, UncontrolledCopyActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        requirePermission(currentUser, P_APPROVE, "You do not have permission to approve uncontrolled copy requests.");
        requireNotOwnRequest(currentUser, copy, "You cannot approve your own uncontrolled copy request.");
        requireStatus(copy, "approved", STATUS_REQUESTED);
        String reason = firstNonBlank(normalize(request == null ? null : request.reason()), "Approved uncontrolled copy request");
        String from = copy.getStatus();
        copy.setApprovedBy(currentUser);
        copy.setApprovedAt(Instant.now());
        setStatus(copy, STATUS_APPROVED);
        uncontrolledCopyRepository.saveAndFlush(copy);
        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                SIGNATURE_ENTITY_TYPE, copy.getId(), copy.getUncontrolledCopyNumber(), currentUser,
                request == null ? null : request.signatureToken(), "UNCONTROLLED_COPY_APPROVED", reason, null, from, copy.getStatus());
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "APPROVE",
                from, copy.getStatus(), reason, List.of(), signatureId(signature));
        return toResponse(copy, currentUser);
    }

    @Transactional
    public UncontrolledCopyResponse rejectRequest(UUID id, UncontrolledCopyActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        requirePermission(currentUser, P_REJECT, "You do not have permission to reject uncontrolled copy requests.");
        requireNotOwnRequest(currentUser, copy, "You cannot reject your own uncontrolled copy request. Cancel it instead.");
        requireStatus(copy, "rejected", STATUS_REQUESTED);
        String reason = normalize(request == null ? null : request.reason());
        if (!StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("A rejection reason is required.");
        }
        String from = copy.getStatus();
        copy.setRejectedBy(currentUser);
        copy.setRejectedAt(Instant.now());
        copy.setRejectionReason(reason);
        setStatus(copy, STATUS_REJECTED);
        uncontrolledCopyRepository.saveAndFlush(copy);
        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                SIGNATURE_ENTITY_TYPE, copy.getId(), copy.getUncontrolledCopyNumber(), currentUser,
                request == null ? null : request.signatureToken(), "UNCONTROLLED_COPY_REJECTED", reason, null, from, copy.getStatus());
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "REJECT",
                from, copy.getStatus(), reason, List.of(), signatureId(signature));
        return toResponse(copy, currentUser);
    }

    /**
     * Renders the watermarked PDF from the revision's published PDF and stores it as a new immutable object.
     * The watermark title {@link #MANDATORY_WATERMARK_TEXT} is always drawn (watermark forced on, all pages)
     * regardless of the policy's watermark toggle; the policy only styles it.
     */
    @Transactional
    public UncontrolledCopyResponse generate(UUID id, UncontrolledCopyActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        requirePermission(currentUser, P_DISTRIBUTE, "You do not have permission to generate uncontrolled copies.");
        requireStatus(copy, "generated", STATUS_APPROVED);
        DocumentRevisionRecord revision = copy.getRevision();
        if (revision == null || revision.getStatus() == null || !"EFFECTIVE".equalsIgnoreCase(revision.getStatus().getCode())) {
            throw new IllegalStateException("The source revision is no longer Effective; the uncontrolled copy cannot be generated.");
        }
        byte[] published = requirePublishedPdfBytes(revision);
        Instant generatedAt = Instant.now();
        ControlledCopyPdfMarkingService.Marked marked = renderMarking(copy, published, generatedAt);
        try (ByteArrayInputStream input = new ByteArrayInputStream(marked.pdf())) {
            FileStorageService.StorageWriteResult stored = fileStorageService.storeUncontrolledCopyPdf(copy.getId(), copy.getUncontrolledCopyNumber(), input);
            copy.setUncontrolledCopyFilePath(stored.storedPath());
            copy.setUncontrolledCopyStorageProvider(stored.provider());
            copy.setUncontrolledCopyStorageBucket(stored.bucket());
            copy.setUncontrolledCopyStorageObjectKey(stored.objectKey());
            copy.setUncontrolledCopyStorageVersionId(stored.versionId());
            copy.setUncontrolledCopyChecksum(stored.checksum());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store the uncontrolled copy PDF.", ex);
        }
        String from = copy.getStatus();
        copy.setMarkingApplied(true);
        copy.setMarkingLayout(pdfMarkingService.toJson(marked.placements()));
        copy.setGeneratedBy(currentUser);
        copy.setGeneratedAt(generatedAt);
        setStatus(copy, STATUS_GENERATED);
        uncontrolledCopyRepository.saveAndFlush(copy);
        String comment = firstNonBlank(normalize(request == null ? null : request.reason()), "Generated watermarked uncontrolled copy")
                + "; Checksum: " + firstNonBlank(copy.getUncontrolledCopyChecksum(), "n/a");
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "GENERATE",
                from, copy.getStatus(), comment, List.of(), null);
        return toResponse(copy, currentUser);
    }

    @Transactional
    public UncontrolledCopyResponse distribute(UUID id, UncontrolledCopyActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_DISTRIBUTE, "You do not have permission to distribute uncontrolled copies.");
        String reason = firstNonBlank(normalize(request == null ? null : request.reason()), "Distributed uncontrolled copy");
        UncontrolledCopyRecord copy = requireCopy(id);
        UncontrolledCopyDistributionJob job = distributeOne(copy, currentUser, request == null ? null : request.signatureToken(), reason);
        eventPublisher.publishEvent(new UncontrolledCopyDistributedEvent(copy.getId(), job.getId(), currentUser.getId()));
        return toResponse(copy, currentUser);
    }

    /** All-or-nothing: every listed copy must be Generated, and ONE e-signature covers the whole action. */
    @Transactional
    public List<UncontrolledCopyResponse> distributeBatch(UncontrolledCopyBatchDistributeRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_DISTRIBUTE, "You do not have permission to distribute uncontrolled copies.");
        List<UUID> ids = request == null || request.ids() == null ? List.of()
                : request.ids().stream().map(this::parseUuidOrNull).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            throw new IllegalArgumentException("Select at least one uncontrolled copy to distribute.");
        }
        List<UncontrolledCopyRecord> copies = uncontrolledCopyRepository.findAllById(ids);
        if (copies.size() != ids.size()) {
            throw new IllegalArgumentException("One or more uncontrolled copies were not found.");
        }
        for (UncontrolledCopyRecord copy : copies) {
            requireStatus(copy, "distributed", STATUS_GENERATED);
        }
        String reason = firstNonBlank(normalize(request.reason()), "Distributed uncontrolled copies (batch)");
        List<UncontrolledCopyDistributedEvent> events = new ArrayList<>();
        for (UncontrolledCopyRecord copy : copies) {
            UncontrolledCopyDistributionJob job = distributeOne(copy, currentUser, request.signatureToken(), reason);
            events.add(new UncontrolledCopyDistributedEvent(copy.getId(), job.getId(), currentUser.getId()));
        }
        events.forEach(eventPublisher::publishEvent);
        return copies.stream().map(copy -> toResponse(copy, currentUser)).toList();
    }

    private UncontrolledCopyDistributionJob distributeOne(UncontrolledCopyRecord copy, UserAccount currentUser, String signatureToken, String reason) {
        requireStatus(copy, "distributed", STATUS_GENERATED);
        if (!StringUtils.hasText(copy.getUncontrolledCopyFilePath())) {
            throw new IllegalStateException("The uncontrolled copy file has not been generated.");
        }
        UncontrolledCopyPolicySetting policy = policyService.loadOrDefault();
        Instant distributedAt = Instant.now();
        String from = copy.getStatus();
        copy.setDistributedBy(currentUser);
        copy.setDistributedAt(distributedAt);
        copy.setValidUntil(distributedAt.plusSeconds(Math.max(policy.getValidityHours(), 1) * 3600L));
        JsonNode snapshot = copy.getRecipientSnapshot();
        if (snapshot instanceof ObjectNode objectNode) {
            objectNode.put("distributedAt", distributedAt.toString());
            copy.setRecipientSnapshot(objectNode.deepCopy());
        }
        setStatus(copy, STATUS_DISTRIBUTED);
        uncontrolledCopyRepository.saveAndFlush(copy);

        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                SIGNATURE_ENTITY_TYPE, copy.getId(), copy.getUncontrolledCopyNumber(), currentUser,
                signatureToken, "UNCONTROLLED_COPY_DISTRIBUTED", reason, null, from, copy.getStatus());
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "DISTRIBUTE",
                from, copy.getStatus(),
                reason + "; Recipient: " + recipientLabel(copy.getRecipientSnapshot())
                        + "; Valid until: " + DateTimeFormatUtils.formatDateTime(copy.getValidUntil()),
                List.of(), signatureId(signature));

        UncontrolledCopyDistributionJob job = new UncontrolledCopyDistributionJob();
        job.setUncontrolledCopy(copy);
        job.setRequestedBy(currentUser);
        job.setActionType("DISTRIBUTE");
        job.setStatus("PENDING");
        job.setTotalItems(1);
        job = jobRepository.save(job);
        UncontrolledCopyDistributionJobItem item = new UncontrolledCopyDistributionJobItem();
        item.setJob(job);
        item.setUncontrolledCopy(copy);
        item.setRecipientEmail(recipientEmail(copy.getRecipientSnapshot()));
        item.setStatus("PENDING");
        item.setAttempts(0);
        jobItemRepository.save(item);
        return job;
    }

    @Transactional
    public UncontrolledCopyResponse cancel(UUID id, UncontrolledCopyActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        requirePermission(currentUser, P_CANCEL, "You do not have permission to cancel uncontrolled copy requests.");
        if (!isOwnRequest(currentUser, copy) && !permissionEvaluationService.hasAnyPermission(currentUser, P_APPROVE, P_DISTRIBUTE)) {
            throw new AccessDeniedException("Only the requester or Document Control can cancel this uncontrolled copy request.");
        }
        requireStatus(copy, "cancelled", STATUS_REQUESTED, STATUS_APPROVED, STATUS_GENERATED);
        String reason = normalize(request == null ? null : request.reason());
        if (!StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("A cancellation reason is required.");
        }
        String from = copy.getStatus();
        copy.setCancelledBy(currentUser);
        copy.setCancelledAt(Instant.now());
        copy.setCancelReason(reason);
        setStatus(copy, STATUS_CANCELLED);
        uncontrolledCopyRepository.saveAndFlush(copy);
        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                SIGNATURE_ENTITY_TYPE, copy.getId(), copy.getUncontrolledCopyNumber(), currentUser,
                request == null ? null : request.signatureToken(), "UNCONTROLLED_COPY_CANCELLED", reason, null, from, copy.getStatus());
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "CANCEL",
                from, copy.getStatus(), reason, List.of(), signatureId(signature));
        return toResponse(copy, currentUser);
    }

    // ------------------------------------------------------------------------------------------------------------
    // File access
    // ------------------------------------------------------------------------------------------------------------

    /** Inline view of the stored (already watermarked) file. Read-only: never consumes the download allowance. */
    @Transactional
    public FileDownload preview(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        if (!canPreview(currentUser, copy)) {
            throw new AccessDeniedException(isExpired(copy)
                    ? "This uncontrolled copy has expired and can no longer be viewed."
                    : "Uncontrolled copy file access denied");
        }
        byte[] bytes = readStoredFile(copy);
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "VIEW_FILE",
                null, copy.getStatus(), "Viewed the uncontrolled copy file", List.of(), null);
        return new FileDownload(bytes, downloadFileName(copy), "application/pdf");
    }

    @Transactional
    public FileDownload download(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyRecord copy = requireCopy(id);
        if (isExpired(copy)) {
            throw new AccessDeniedException("This uncontrolled copy has expired and can no longer be downloaded.");
        }
        if (!canDownloadIgnoringLimit(currentUser, copy)) {
            throw new AccessDeniedException("Uncontrolled copy download denied");
        }
        boolean downloadOnce = !policyService.loadOrDefault().isAllowRedownload() && !permissionEvaluationService.hasPermission(currentUser, P_DISTRIBUTE);
        byte[] bytes = readStoredFile(copy);
        if (uncontrolledCopyRepository.consumeDownload(copy.getId(), Instant.now(), downloadOnce) == 0) {
            throw new AccessDeniedException("Re-download is disabled by the Uncontrolled Copies Policy and this copy was already downloaded.");
        }
        auditTrailService.logAs(currentUser, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "DOWNLOAD",
                null, copy.getStatus(), "Downloaded the uncontrolled copy file", List.of(), null);
        return new FileDownload(bytes, downloadFileName(copy), "application/pdf");
    }

    // ------------------------------------------------------------------------------------------------------------
    // Async support (called from UncontrolledCopyDistributionAsyncService)
    // ------------------------------------------------------------------------------------------------------------

    /**
     * The one distribution e-mail for a copy (PDF attached + login-required download link), mirroring
     * ControlledCopyService#sendDcoBatchZipEmail's shape. SKIPPED when the copy is no longer Distributed or
     * the recipient has no e-mail address (the copy stays available in the app either way).
     */
    @Transactional
    public DeliveryOutcome sendDistributionEmail(UUID copyId, String recipientEmail, UUID issuerUserId) {
        UncontrolledCopyRecord copy = copyId == null ? null : uncontrolledCopyRepository.findById(copyId).orElse(null);
        if (copy == null || !STATUS_DISTRIBUTED.equals(copy.getStatusCode())) {
            return DeliveryOutcome.SKIPPED;
        }
        if (!StringUtils.hasText(recipientEmail)) {
            return DeliveryOutcome.SKIPPED;
        }
        UserAccount issuer = resolveIssuerOrSystemActor(issuerUserId);
        byte[] pdf = readStoredFile(copy);
        UUID recipientUserId = parseUuidOrNull(textField(copy.getRecipientSnapshot(), "userId"));
        UserAccount recipientUser = recipientUserId == null ? null : userAccountRepository.findById(recipientUserId).orElse(null);
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("uncontrolledCopyNumber", value(copy.getUncontrolledCopyNumber()));
        variables.put("documentNumber", value(copy.getDocumentNumber()));
        variables.put("documentTitle", value(copy.getDocumentTitle()));
        variables.put("revisionNumber", value(copy.getRevisionNumber()));
        variables.put("issuedAt", value(DateTimeFormatUtils.formatDateTime(copy.getDistributedAt())));
        variables.put("validUntil", value(DateTimeFormatUtils.formatDateTime(copy.getValidUntil())));
        variables.put("downloadLink", emailNotificationService.buildUncontrolledCopyDownloadUrl(copy.getId()));
        boolean sent = emailNotificationService.sendUncontrolledCopyDistribution(
                recipientEmail, recipientUser, issuer, variables, downloadFileName(copy), pdf);
        if (!sent) {
            return DeliveryOutcome.FAILED;
        }
        auditTrailService.logAs(issuer, ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "DISTRIBUTION_EMAIL_SENT",
                null, null, "Distribution e-mail sent to " + recipientEmail, List.of(), null);
        return DeliveryOutcome.SUCCESS;
    }

    /** Records a delivery that failed after every automatic retry. The copy itself stays Distributed (in-app download still works). */
    @Transactional
    public void recordDistributionEmailFailure(UUID copyId, UUID issuerUserId, String recipientEmail, String message) {
        UncontrolledCopyRecord copy = copyId == null ? null : uncontrolledCopyRepository.findById(copyId).orElse(null);
        if (copy == null) {
            return;
        }
        auditTrailService.logAs(resolveIssuerOrSystemActor(issuerUserId), ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(),
                "DISTRIBUTION_EMAIL_FAILED", null, null,
                "Distribution e-mail to " + firstNonBlank(recipientEmail, "(no address)") + " failed: " + message, List.of(), null);
    }

    /** Flips one Distributed copy past its validity window to Expired, in its own transaction. */
    @Transactional
    public boolean expireCopy(UUID copyId) {
        UncontrolledCopyRecord copy = copyId == null ? null : uncontrolledCopyRepository.findById(copyId).orElse(null);
        return copy != null && expireIfDue(copy);
    }

    // ------------------------------------------------------------------------------------------------------------
    // Eligibility resolution (V503 rule matrix; replaces the removed DocumentType.allowUncontrolledCopy flag)
    // ------------------------------------------------------------------------------------------------------------

    /** Outcome of resolving whether a document may have an uncontrolled copy requested. */
    public record EligibilityResult(boolean allowed, String reason) {
    }

    /**
     * Most-specific-wins resolution: active {@link UncontrolledCopyEligibilityRule} rows are matched
     * by Document Type, falling back to the global catch-all (null Document Type) when no
     * type-specific rule matches. Ties at the same specificity are broken by most-recently-updated.
     * Returns not-allowed with a human-readable reason if nothing matches (should not normally
     * happen once the catch-all is seeded).
     */
    public EligibilityResult resolveEligibility(DocumentRecord document) {
        UUID typeId = document.getDocumentType() == null ? null : document.getDocumentType().getId();
        UncontrolledCopyEligibilityRule best = null;
        int bestTier = -1;
        for (UncontrolledCopyEligibilityRule rule : eligibilityRuleRepository.findAllByActiveTrue()) {
            UUID ruleTypeId = rule.getDocumentType() == null ? null : rule.getDocumentType().getId();
            int tier;
            if (ruleTypeId != null) {
                if (!Objects.equals(ruleTypeId, typeId)) {
                    continue;
                }
                tier = 1;
            } else {
                tier = 0;
            }
            if (tier > bestTier || (tier == bestTier && best != null
                    && rule.getUpdatedAt() != null && best.getUpdatedAt() != null && rule.getUpdatedAt().isAfter(best.getUpdatedAt()))) {
                best = rule;
                bestTier = tier;
            }
        }
        if (best == null) {
            return new EligibilityResult(false, "No uncontrolled copy eligibility rule matched this document.");
        }
        if (best.isAllowed()) {
            return new EligibilityResult(true, null);
        }
        String scope = bestTier == 1 ? "this document type" : "documents by default";
        return new EligibilityResult(false, "Uncontrolled copies are not allowed for " + scope + " by the eligibility rules.");
    }

    // ------------------------------------------------------------------------------------------------------------
    // Eligibility rule matrix CRUD (V503 uncontrolled_copy_eligibility_rules table)
    // ------------------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<UncontrolledCopyEligibilityRuleResponse> listEligibilityRules() {
        return eligibilityRuleRepository.findAll(Sort.by(Sort.Direction.ASC, "system").descending()
                        .and(Sort.by(Sort.Direction.DESC, "updatedAt"))).stream()
                .map(this::toRuleResponse)
                .toList();
    }

    /** Server-side search/filter/pagination over the eligibility rule matrix, mirroring
     *  SodConstraintService#listPaged's in-memory filter-then-{@link com.eqms.util.PagedList#paginate}
     *  shape (the underlying row count is always small -- a config matrix, not transactional data --
     *  so filtering the already-loaded response list is simpler than a dynamic JPA specification,
     *  same tradeoff SoD already made). Sorting applies before pagination to all rows. */
    @Transactional(readOnly = true)
    public com.eqms.dto.user.PageResponse<UncontrolledCopyEligibilityRuleResponse> listEligibilityRulesPaged(
            int page, int limit, String search, String status, String sortBy, String sortDirection) {
        java.util.Comparator<UncontrolledCopyEligibilityRuleResponse> comparator = switch (sortBy == null ? "updatedAt" : sortBy) {
            case "documentTypeName" -> java.util.Comparator.comparing(
                    r -> r.documentTypeName() == null ? "Any" : r.documentTypeName(), String.CASE_INSENSITIVE_ORDER);
            case "allowed" -> java.util.Comparator.comparing(UncontrolledCopyEligibilityRuleResponse::allowed);
            case "active" -> java.util.Comparator.comparing(UncontrolledCopyEligibilityRuleResponse::active);
            case "updatedAt" -> java.util.Comparator.comparing(UncontrolledCopyEligibilityRuleResponse::updatedAt,
                    java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()));
            default -> throw new IllegalArgumentException("Unsupported eligibility rule sort column");
        };
        if ("desc".equalsIgnoreCase(sortDirection)) comparator = comparator.reversed();
        else if (!"asc".equalsIgnoreCase(sortDirection)) throw new IllegalArgumentException("Sort direction must be asc or desc");
        List<UncontrolledCopyEligibilityRuleResponse> filtered = listEligibilityRules().stream()
                .filter(r -> {
                    if ("ACTIVE".equalsIgnoreCase(status) && !r.active()) return false;
                    if ("INACTIVE".equalsIgnoreCase(status) && r.active()) return false;
                    String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
                    if (q.isEmpty()) return true;
                    return (r.documentTypeName() == null ? "any" : r.documentTypeName())
                            .toLowerCase(Locale.ROOT).contains(q);
                })
                .sorted(comparator.thenComparing(UncontrolledCopyEligibilityRuleResponse::id))
                .toList();
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    @Transactional
    public UncontrolledCopyEligibilityRuleResponse createEligibilityRule(UncontrolledCopyEligibilityRuleRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        DocumentType documentType = resolveDocumentTypeOrNull(request.documentTypeId());
        if (request.active()) {
            requireNoDuplicateActiveRule(null, documentType);
        }
        UncontrolledCopyEligibilityRule rule = new UncontrolledCopyEligibilityRule();
        rule.setId(UUID.randomUUID());
        rule.setDocumentType(documentType);
        rule.setAllowed(request.allowed());
        rule.setActive(request.active());
        rule.setSystem(false);
        rule.setCreatedBy(currentUser);
        rule.setUpdatedBy(currentUser);
        try {
            eligibilityRuleRepository.saveAndFlush(rule);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new IllegalArgumentException(
                    "An active eligibility rule already exists for this Document Type.", ex);
        }
        auditTrailService.logAs(currentUser, "UNCONTROLLED_COPY_ELIGIBILITY_RULE", ruleLabel(rule), rule.getId(), "CREATED",
                null, rule.isAllowed() ? "Allowed" : "Blocked",
                withReason("Created uncontrolled copy eligibility rule " + ruleLabel(rule), request.reason()), List.of(), null);
        return toRuleResponse(rule);
    }

    @Transactional
    public UncontrolledCopyEligibilityRuleResponse updateEligibilityRule(UUID id, UncontrolledCopyEligibilityRuleRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        UncontrolledCopyEligibilityRule rule = requireEligibilityRule(id);
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        String oldAllowed = rule.isAllowed() ? "Allowed" : "Blocked";
        DocumentType documentType = resolveDocumentTypeOrNull(request.documentTypeId());
        if (request.active()) {
            requireNoDuplicateActiveRule(rule.getId(), documentType);
        }
        addRuleChange(changes, "Document Type", nameOf(rule.getDocumentType()), nameOf(documentType));
        addRuleChange(changes, "Allowed", oldAllowed, request.allowed() ? "Allowed" : "Blocked");
        addRuleChange(changes, "Active", rule.isActive() ? "Active" : "Inactive", request.active() ? "Active" : "Inactive");
        // The seed marker describes an Any default, not a protection/authorization flag.
        if (rule.isSystem() && documentType != null) {
            addRuleChange(changes, "System Default", "Yes", "No");
            rule.setSystem(false);
        }
        rule.setDocumentType(documentType);
        rule.setAllowed(request.allowed());
        rule.setActive(request.active());
        rule.setUpdatedBy(currentUser);
        try {
            eligibilityRuleRepository.saveAndFlush(rule);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new IllegalArgumentException(
                    "An active eligibility rule already exists for this Document Type.", ex);
        }
        auditTrailService.logAs(currentUser, "UNCONTROLLED_COPY_ELIGIBILITY_RULE", ruleLabel(rule), rule.getId(), "UPDATED",
                oldAllowed, rule.isAllowed() ? "Allowed" : "Blocked",
                withReason("Updated uncontrolled copy eligibility rule " + ruleLabel(rule), request.reason()), changes, null);
        return toRuleResponse(rule);
    }

    @Transactional
    public void deleteEligibilityRule(UUID id, String reason) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UncontrolledCopyEligibilityRule rule = requireEligibilityRule(id);
        auditTrailService.logAs(currentUser, "UNCONTROLLED_COPY_ELIGIBILITY_RULE", ruleLabel(rule), rule.getId(), "DELETED",
                rule.isAllowed() ? "Allowed" : "Blocked", null,
                withReason("Deleted uncontrolled copy eligibility rule " + ruleLabel(rule), reason), List.of(), null);
        eligibilityRuleRepository.delete(rule);
    }

    private void requireNoDuplicateActiveRule(UUID excludeId, DocumentType documentType) {
        UUID typeId = documentType == null ? null : documentType.getId();
        boolean duplicate = eligibilityRuleRepository.findAllByActiveTrue().stream()
                .filter(r -> excludeId == null || !r.getId().equals(excludeId))
                .anyMatch(r -> Objects.equals(r.getDocumentType() == null ? null : r.getDocumentType().getId(), typeId));
        if (duplicate) {
            throw new IllegalArgumentException("An active eligibility rule already exists for this Document Type.");
        }
    }

    private DocumentType resolveDocumentTypeOrNull(UUID id) {
        if (id == null) {
            return null;
        }
        return documentTypeRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Document Type not found"));
    }

    private UncontrolledCopyEligibilityRule requireEligibilityRule(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Eligibility rule id is required");
        }
        return eligibilityRuleRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Eligibility rule not found"));
    }

    private UncontrolledCopyEligibilityRuleResponse toRuleResponse(UncontrolledCopyEligibilityRule rule) {
        return new UncontrolledCopyEligibilityRuleResponse(
                rule.getId(),
                rule.getDocumentType() == null ? null : rule.getDocumentType().getId(),
                nameOf(rule.getDocumentType()),
                rule.isAllowed(),
                rule.isActive(),
                rule.isSystem(),
                rule.getUpdatedAt()
        );
    }

    private static String nameOf(DocumentType type) {
        return type == null ? "Any" : type.getName();
    }

    private static String ruleLabel(UncontrolledCopyEligibilityRule rule) {
        return nameOf(rule.getDocumentType());
    }

    private static void addRuleChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    /** Folds the e-signature/action reason into the audit comment, mirroring SodConstraintService#withReason. */
    private static String withReason(String comment, String reason) {
        return StringUtils.hasText(reason) ? comment + " Reason: " + reason : comment;
    }


    // ------------------------------------------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------------------------------------------

    private ControlledCopyPdfMarkingService.Marked renderMarking(UncontrolledCopyRecord copy, byte[] pdf, Instant issuedAt) {
        ControlledCopyStatusMarking configured = policyService.markingFor(policyService.loadOrDefault());
        MarkingPlan plan = markingPlan(configured, copy.getUncontrolledCopyNumber(),
                recipientLabel(copy.getRecipientSnapshot()), DateTimeFormatUtils.formatDateTime(issuedAt));
        return pdfMarkingService.applyStatusMarkingWithLayout(pdf, plan.config(), plan.watermarkLines(), plan.stampLines(), List.of());
    }

    /** The effective marking config and the exact lines drawn on an uncontrolled copy. */
    public record MarkingPlan(ControlledCopyStatusMarking config, List<String> watermarkLines, List<String> stampLines) {
    }

    /**
     * Single source of truth for what an uncontrolled copy carries -- used by real generation and by the policy screen's
     * server-rendered preview ({@link UncontrolledCopyMarkingPreviewService}), so the preview can never drift from the real file.
     */
    public static MarkingPlan markingPlan(ControlledCopyStatusMarking configured, String copyNumber, String viewer, String timestamp) {
        // Watermark is mandatory and on every page: only its styling (and, per the policy screen,
        // its title text) comes from the policy.
        ControlledCopyStatusMarking forced = new ControlledCopyStatusMarking(
                Boolean.TRUE, null, null, null, null, null, null, null, "ALL",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null
        ).mergedOver(configured);
        List<String> watermarkLines = new ArrayList<>();
        // Single, fully editable title line -- defaults to MANDATORY_WATERMARK_TEXT (baked into
        // UncontrolledCopyPolicyService.defaultMarking()) but an admin may replace it entirely.
        watermarkLines.add(firstNonBlank(normalize(configured.watermarkText()), MANDATORY_WATERMARK_TEXT));
        if (!Boolean.FALSE.equals(configured.watermarkShowRecipient())) {
            watermarkLines.add("Issued to: " + viewer);
        }
        if (!Boolean.FALSE.equals(configured.watermarkShowIssuedDate())) {
            watermarkLines.add("Issued: " + timestamp);
        }
        List<String> stampLines = new ArrayList<>();
        if (Boolean.TRUE.equals(configured.stampEnabled())) {
            stampLines.add(firstNonBlank(normalize(configured.stampText()), "UNCONTROLLED COPY"));
            if (!Boolean.FALSE.equals(configured.stampShowCopyNumber())) {
                stampLines.add(copyNumber);
            }
            if (Boolean.TRUE.equals(configured.stampShowDate())) {
                stampLines.add(timestamp);
            }
        }
        return new MarkingPlan(forced, watermarkLines, stampLines);
    }

    private byte[] requirePublishedPdfBytes(DocumentRevisionRecord revision) {
        String publishedPdfPath = revision.getPreviewFilePath();
        if (!StringUtils.hasText(publishedPdfPath)) {
            throw new IllegalStateException("Published PDF is not available for the effective revision.");
        }
        try {
            byte[] bytes = fileStorageService.readFile(publishedPdfPath);
            if (bytes == null || bytes.length == 0) {
                throw new IllegalStateException("Published PDF is empty.");
            }
            return bytes;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load the published PDF for uncontrolled copy generation.", ex);
        }
    }

    private byte[] readStoredFile(UncontrolledCopyRecord copy) {
        if (!StringUtils.hasText(copy.getUncontrolledCopyFilePath())) {
            throw new IllegalStateException("The uncontrolled copy file is not available.");
        }
        try {
            byte[] bytes = fileStorageService.readFile(copy.getUncontrolledCopyFilePath(), copy.getUncontrolledCopyChecksum());
            if (bytes == null || bytes.length == 0) {
                throw new IllegalStateException("The uncontrolled copy file is empty.");
            }
            return bytes;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read the uncontrolled copy file.", ex);
        }
    }

    private boolean expireIfDue(UncontrolledCopyRecord copy) {
        if (!STATUS_DISTRIBUTED.equals(copy.getStatusCode()) || copy.getValidUntil() == null || Instant.now().isBefore(copy.getValidUntil())) {
            return false;
        }
        String from = copy.getStatus();
        setStatus(copy, STATUS_EXPIRED);
        uncontrolledCopyRepository.saveAndFlush(copy);
        auditTrailService.logAs(systemActorProvider.get(), ENTITY_TYPE, copy.getUncontrolledCopyNumber(), copy.getId(), "EXPIRE",
                from, copy.getStatus(), "Validity window ended at " + DateTimeFormatUtils.formatDateTime(copy.getValidUntil()), List.of(), null);
        return true;
    }

    private boolean isExpired(UncontrolledCopyRecord copy) {
        return STATUS_EXPIRED.equals(copy.getStatusCode())
                || (STATUS_DISTRIBUTED.equals(copy.getStatusCode()) && copy.getValidUntil() != null && !Instant.now().isBefore(copy.getValidUntil()));
    }

    private boolean seesAllCopies(UserAccount user) {
        return permissionEvaluationService.hasPermission(user, P_VIEW)
                && (permissionEvaluationService.hasAnyPermission(user, P_APPROVE, P_REJECT, P_DISTRIBUTE)
                || documentAuthorizationService.canViewAllDocuments(user));
    }

    private boolean canViewRecord(UserAccount user, UncontrolledCopyRecord copy) {
        return seesAllCopies(user) || isOwnRequest(user, copy) || isRecipient(user, copy);
    }

    private boolean isOwnRequest(UserAccount user, UncontrolledCopyRecord copy) {
        return user != null && copy.getRequestedBy() != null && Objects.equals(user.getId(), copy.getRequestedBy().getId());
    }

    /**
     * Recipient access is keyed strictly on the snapshot's system {@code userId}. There is deliberately NO fallback to
     * matching the signed-in user's e-mail address: an account that merely shares an address with a recipient must
     * never inherit the copy. (Legacy snapshots without a userId therefore have no recipient-based access; the
     * requester and Document Control keep theirs.)
     */
    private boolean isRecipient(UserAccount user, UncontrolledCopyRecord copy) {
        if (user == null || user.getId() == null) {
            return false;
        }
        String recipientUserId = textField(copy.getRecipientSnapshot(), "userId");
        return StringUtils.hasText(recipientUserId) && recipientUserId.equals(user.getId().toString());
    }

    private boolean canPreview(UserAccount user, UncontrolledCopyRecord copy) {
        if (!StringUtils.hasText(copy.getUncontrolledCopyFilePath())
                || !permissionEvaluationService.hasAnyPermission(user, P_PREVIEW_FILE, P_VIEW_FILE)) {
            return false;
        }
        boolean documentControl = permissionEvaluationService.hasAnyPermission(user, P_DISTRIBUTE, P_APPROVE);
        if (STATUS_GENERATED.equals(copy.getStatusCode())) {
            return documentControl;
        }
        if (STATUS_DISTRIBUTED.equals(copy.getStatusCode()) && !isExpired(copy)) {
            return documentControl || isOwnRequest(user, copy) || isRecipient(user, copy);
        }
        return false;
    }

    private boolean canDownloadIgnoringLimit(UserAccount user, UncontrolledCopyRecord copy) {
        return STATUS_DISTRIBUTED.equals(copy.getStatusCode())
                && !isExpired(copy)
                && StringUtils.hasText(copy.getUncontrolledCopyFilePath())
                && permissionEvaluationService.hasPermission(user, P_DOWNLOAD_FILE)
                && (isOwnRequest(user, copy) || isRecipient(user, copy) || permissionEvaluationService.hasPermission(user, P_DISTRIBUTE));
    }

    /**
     * The copy is always held by a real, Active system user (the requester when no {@code recipientUserId} is given);
     * {@code userId} in the snapshot is the ONLY key {@link #isRecipient} matches on. An external party is recorded
     * as a display/audit label only ({@code externalRecipient}) -- it never becomes a login-gated download identity.
     */
    private ObjectNode resolveRecipient(UserAccount currentUser, UncontrolledCopyCreateRequest request) {
        ObjectNode node = MAPPER.createObjectNode();
        String rawRecipientUserId = normalize(request == null ? null : request.recipientUserId());
        UUID recipientUserId = parseUuidOrNull(rawRecipientUserId);
        if (rawRecipientUserId != null && recipientUserId == null) {
            throw new IllegalArgumentException("The recipient must be selected from the system's users.");
        }
        String externalLabel = normalize(request == null ? null : request.externalRecipientLabel());
        if (externalLabel != null && externalLabel.length() > 255) {
            throw new IllegalArgumentException("The external recipient label must be 255 characters or fewer.");
        }
        boolean forSelf = recipientUserId == null || recipientUserId.equals(currentUser.getId());
        if ((!forSelf || externalLabel != null) && !permissionEvaluationService.hasPermission(currentUser, P_REQUEST_FOR_OTHERS)) {
            throw new AccessDeniedException("Only Document Control may request uncontrolled copies for another user or an external recipient.");
        }
        UserAccount holder = currentUser;
        if (!forSelf) {
            holder = userAccountRepository.findById(recipientUserId)
                    .orElseThrow(() -> new IllegalArgumentException("Recipient user not found"));
            if (holder.getStatus() != com.eqms.entity.UserStatus.Active) {
                throw new IllegalArgumentException("The recipient user account is not Active.");
            }
        }
        node.put("type", externalLabel != null ? "EXTERNAL_HANDOVER" : (forSelf ? "SELF" : "INTERNAL"));
        node.put("userId", holder.getId().toString());
        node.put("name", value(holder.getFullName()));
        node.put("email", value(holder.getEmail()));
        if (externalLabel != null) {
            node.put("externalRecipient", externalLabel);
        }
        node.put("capturedAt", Instant.now().toString());
        return node;
    }

    private String nextUncontrolledCopyNumber(DocumentRecord document) {
        String base = "UC-" + firstNonBlank(normalize(document.getDocumentNumber()), "DOC").replaceAll("\\s+", "");
        long sequence = uncontrolledCopyRepository.countByDocument_Id(document.getId()) + 1;
        String candidate = base + "-" + String.format("%03d", sequence);
        while (uncontrolledCopyRepository.existsByUncontrolledCopyNumber(candidate)) {
            sequence++;
            candidate = base + "-" + String.format("%03d", sequence);
        }
        return candidate;
    }

    private void requireStatus(UncontrolledCopyRecord copy, String action, String... allowed) {
        for (String status : allowed) {
            if (status.equals(copy.getStatusCode())) {
                return;
            }
        }
        throw new IllegalStateException("Uncontrolled copy " + copy.getUncontrolledCopyNumber() + " is " + copy.getStatus()
                + " and cannot be " + action + ".");
    }

    /**
     * Segregation of Duties at action time: the approval decision (approve or reject) must come from someone other
     * than the requester -- WHILE the system SoD constraint "Request vs Approve Uncontrolled Copy"
     * ({@link #P_REQUEST} / {@link #P_APPROVE}, seeded by V502) is active. One rule governs both approve and reject.
     * An administrator can deactivate it on the Segregation of Duties screen (e-signed, audited), which then allows
     * self-decision. Same exception type as RevisionService's author-cannot-approve rule (403). The requester can
     * always withdraw via Cancel.
     */
    private void requireNotOwnRequest(UserAccount user, UncontrolledCopyRecord copy, String message) {
        if (isSelfDecisionBlocked(user, copy)) {
            throw new AccessDeniedException(message);
        }
    }

    /** True when {@code user} is the requester AND the self-decision SoD constraint is currently active. */
    private boolean isSelfDecisionBlocked(UserAccount user, UncontrolledCopyRecord copy) {
        return isOwnRequest(user, copy) && sodConstraintService.isActiveConstraint(P_REQUEST, P_APPROVE);
    }

    private void requirePermission(UserAccount user, String permission, String message) {
        if (!permissionEvaluationService.hasPermission(user, permission)) {
            throw new AccessDeniedException(message);
        }
    }

    private UncontrolledCopyRecord requireCopy(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Uncontrolled copy not found");
        }
        return uncontrolledCopyRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Uncontrolled copy not found"));
    }

    private DocumentRecord resolveDocument(String documentIdOrNumber) {
        if (!StringUtils.hasText(documentIdOrNumber)) {
            throw new IllegalArgumentException("Document identifier is required");
        }
        String trimmed = documentIdOrNumber.trim();
        UUID documentId = parseUuidOrNull(trimmed);
        if (documentId != null) {
            return documentRecordRepository.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
        }
        return documentRecordRepository.findByDocumentNumber(trimmed).orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    private UserAccount resolveIssuerOrSystemActor(UUID issuerUserId) {
        if (issuerUserId != null) {
            UserAccount issuer = userAccountRepository.findById(issuerUserId).orElse(null);
            if (issuer != null) {
                return issuer;
            }
        }
        return systemActorProvider.get();
    }

    private void setStatus(UncontrolledCopyRecord copy, String statusCode) {
        copy.setStatusCode(statusCode);
        copy.setStatus(statusLabel(statusCode));
    }

    static String statusLabel(String statusCode) {
        if (statusCode == null) {
            return null;
        }
        return switch (statusCode) {
            case STATUS_REQUESTED -> "Requested";
            case STATUS_APPROVED -> "Approved";
            case STATUS_REJECTED -> "Rejected";
            case STATUS_GENERATED -> "Generated";
            case STATUS_DISTRIBUTED -> "Distributed";
            case STATUS_CANCELLED -> "Cancelled";
            case STATUS_EXPIRED -> "Expired";
            default -> statusCode;
        };
    }

    private Sort resolveSort(String sortBy, String sortDirection) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String property = switch (sortBy == null ? "" : sortBy.trim().toLowerCase(Locale.ROOT)) {
            case "number" -> "uncontrolledCopyNumber";
            case "document" -> "documentNumber";
            case "status" -> "statusCode";
            case "validuntil" -> "validUntil";
            case "requested" -> "requestedAt";
            case "approved" -> "approvedAt";
            case "distributed" -> "distributedAt";
            default -> "createdAt";
        };
        return Sort.by(direction, property);
    }

    private UncontrolledCopyResponse toResponse(UncontrolledCopyRecord copy, UserAccount currentUser) {
        JsonNode recipient = copy.getRecipientSnapshot();
        String code = copy.getStatusCode();
        boolean expired = isExpired(copy);
        boolean own = isOwnRequest(currentUser, copy);
        boolean canCancel = permissionEvaluationService.hasPermission(currentUser, P_CANCEL)
                && (own || permissionEvaluationService.hasAnyPermission(currentUser, P_APPROVE, P_DISTRIBUTE))
                && (STATUS_REQUESTED.equals(code) || STATUS_APPROVED.equals(code) || STATUS_GENERATED.equals(code));
        // Only consult the SoD constraint when it can matter (own request still awaiting a decision).
        boolean selfDecisionBlocked = own && STATUS_REQUESTED.equals(code) && isSelfDecisionBlocked(currentUser, copy);
        UncontrolledCopyResponse.Capabilities capabilities = new UncontrolledCopyResponse.Capabilities(
                STATUS_REQUESTED.equals(code) && !selfDecisionBlocked && permissionEvaluationService.hasPermission(currentUser, P_APPROVE),
                STATUS_REQUESTED.equals(code) && !selfDecisionBlocked && permissionEvaluationService.hasPermission(currentUser, P_REJECT),
                STATUS_APPROVED.equals(code) && permissionEvaluationService.hasPermission(currentUser, P_DISTRIBUTE),
                STATUS_GENERATED.equals(code) && permissionEvaluationService.hasPermission(currentUser, P_DISTRIBUTE),
                canCancel,
                canPreview(currentUser, copy),
                canDownloadIgnoringLimit(currentUser, copy)
                        && (policyService.loadOrDefault().isAllowRedownload() || copy.getDownloadCount() == 0
                        || permissionEvaluationService.hasPermission(currentUser, P_DISTRIBUTE))
        );
        return new UncontrolledCopyResponse(
                idString(copy.getId()),
                copy.getUncontrolledCopyNumber(),
                copy.getDocument() == null ? null : idString(copy.getDocument().getId()),
                copy.getDocumentNumber(),
                copy.getDocumentTitle(),
                copy.getRevision() == null ? null : idString(copy.getRevision().getId()),
                copy.getRevisionNumber(),
                copy.getReason(),
                expired && !STATUS_EXPIRED.equals(code) ? statusLabel(STATUS_EXPIRED) : copy.getStatus(),
                expired && !STATUS_EXPIRED.equals(code) ? STATUS_EXPIRED : code,
                copy.getRequestedBy() == null ? null : idString(copy.getRequestedBy().getId()),
                userName(copy.getRequestedBy()),
                formatInstant(copy.getRequestedAt()),
                userName(copy.getApprovedBy()),
                formatInstant(copy.getApprovedAt()),
                userName(copy.getRejectedBy()),
                formatInstant(copy.getRejectedAt()),
                copy.getRejectionReason(),
                userName(copy.getGeneratedBy()),
                formatInstant(copy.getGeneratedAt()),
                userName(copy.getDistributedBy()),
                formatInstant(copy.getDistributedAt()),
                userName(copy.getCancelledBy()),
                formatInstant(copy.getCancelledAt()),
                copy.getCancelReason(),
                textField(recipient, "type"),
                textField(recipient, "name"),
                textField(recipient, "email"),
                textField(recipient, "externalRecipient"),
                copy.isMarkingApplied(),
                StringUtils.hasText(copy.getUncontrolledCopyFilePath()),
                formatInstant(copy.getValidUntil()),
                expired,
                copy.getDownloadCount(),
                formatInstant(copy.getLastDownloadedAt()),
                formatInstant(copy.getCreatedAt()),
                formatInstant(copy.getUpdatedAt()),
                capabilities
        );
    }

    private String downloadFileName(UncontrolledCopyRecord copy) {
        String base = firstNonBlank(copy.getUncontrolledCopyNumber(), idString(copy.getId()));
        return base.replaceAll("[\\\\/:*?\"<>|\\s]+", "_") + ".pdf";
    }

    private static String recipientLabel(JsonNode snapshot) {
        String name = textField(snapshot, "name");
        String email = textField(snapshot, "email");
        String holder;
        if (StringUtils.hasText(name) && StringUtils.hasText(email) && !name.equalsIgnoreCase(email)) {
            holder = name + " <" + email + ">";
        } else {
            holder = StringUtils.hasText(name) ? name : (StringUtils.hasText(email) ? email : "(unknown recipient)");
        }
        String external = textField(snapshot, "externalRecipient");
        return external == null ? holder : external + " (external; handed over by " + holder + ")";
    }

    private static String recipientEmail(JsonNode snapshot) {
        String email = textField(snapshot, "email");
        return StringUtils.hasText(email) ? email : null;
    }

    private static String textField(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return null;
        }
        String text = node.get(field).asText();
        return StringUtils.hasText(text) ? text : null;
    }

    private static UUID signatureId(ElectronicSignature signature) {
        return signature == null ? null : signature.getId();
    }

    private static String userName(UserAccount user) {
        return user == null ? null : user.getFullName();
    }

    private static String formatInstant(Instant value) {
        return value == null ? null : value.toString();
    }

    private static String idString(UUID id) {
        return id == null ? null : id.toString();
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }

    private static String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static String firstNonBlank(String... values) {
        for (String candidate : values) {
            if (StringUtils.hasText(candidate)) {
                return candidate.trim();
            }
        }
        return null;
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

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim().length() > 10 ? value.trim().substring(0, 10) : value.trim());
        } catch (DateTimeParseException ex) {
            log.debug("Ignoring unparseable uncontrolled copy date filter '{}'", value);
            return null;
        }
    }
}

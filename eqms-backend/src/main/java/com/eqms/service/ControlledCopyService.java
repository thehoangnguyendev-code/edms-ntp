package com.eqms.service;

import org.springframework.context.ApplicationEventPublisher;
import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.document.ControlledCopyApproveRequest;
import com.eqms.dto.document.ControlledCopyCancelRequest;
import com.eqms.dto.document.ControlledCopyDestroyRequest;
import com.eqms.dto.document.ControlledCopyDistributeRequest;
import com.eqms.dto.document.ControlledCopyEvidenceResponse;
import com.eqms.dto.document.ControlledCopyFiltersResponse;
import com.eqms.dto.document.ControlledCopyDistributionBatchSummaryResponse;
import com.eqms.dto.document.ControlledCopyListItemResponse;
import com.eqms.dto.document.ControlledCopyRequestContextResponse;
import com.eqms.dto.document.ControlledCopyPreviewResponse;
import com.eqms.dto.document.SignatureResponse;
import com.eqms.dto.document.StatusResponse;
import com.eqms.dto.document.ControlledCopyPrintRequest;
import com.eqms.dto.document.ControlledCopyRecallRequest;
import com.eqms.dto.document.ControlledCopyReplaceRequest;
import com.eqms.dto.document.ControlledCopyRequestCreateRequest;
import com.eqms.dto.user.LookupItemResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.ControlledCopyEvidenceFile;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyDistributionJob;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.ControlledCopyEvidenceFileRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.RevisionPublishingMetadataRepository;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.util.EmailTemplateTypeUtils;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.eqms.auth.AuthenticatedUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.io.ByteArrayOutputStream;
import java.io.BufferedWriter;
import java.io.OutputStream;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.util.stream.Stream;
import javax.imageio.ImageIO;
import javax.imageio.IIOImage;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;

@Service
public class ControlledCopyService {

    private static final int MAX_LIST_PAGE_SIZE = 50;
    private static final SecureRandom PREVIEW_PASSWORD_RANDOM = new SecureRandom();
    private static final int PREVIEW_PASSWORD_BYTES = 18;

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyService.class);
    private static final ZoneId SYSTEM_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter DMY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final long MAX_EVIDENCE_FILE_SIZE_BYTES = 10L * 1024L * 1024L;
    private static final int MAX_EVIDENCE_DIMENSION = 4096;
    private static final long MAX_EVIDENCE_PIXELS = 16L * 1024L * 1024L;
    private static final String STATUS_READY_FOR_DISTRIBUTION = "READY_FOR_DISTRIBUTION";
    private static final String STATUS_DISTRIBUTED = "DISTRIBUTED";
    private static final String STATUS_OBSOLETED = "OBSOLETED";
    private static final String STATUS_CLOSED_CANCELLED = "CLOSED_CANCELLED";
    private static final String OBSOLETE_REASON_EXPIRED = "EXPIRED";
    private static final String OBSOLETE_REASON_RECALLED = "RECALLED";
    private static final String OBSOLETE_REASON_LOST = "LOST";
    private static final String OBSOLETE_REASON_DAMAGED = "DAMAGED";
    private static final String OBSOLETE_REASON_DESTROYED = "DESTROYED";

    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyEvidenceFileRepository controlledCopyEvidenceFileRepository;
    private final ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    private final ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserService currentUserService;
    private final TokenService tokenService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuditTrailService auditTrailService;
    private final EmailNotificationService emailNotificationService;
    private final FileStorageService fileStorageService;
    private SystemConfigurationService systemConfigurationService;
    private final SecureFileAccessService secureFileAccessService;
    private final ControlledCopyPolicyService controlledCopyPolicyService;
    private final ControlledCopyExpiryLimitService controlledCopyExpiryLimitService;
    private final ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    private final RevisionPublishingMetadataRepository revisionPublishingMetadataRepository;
    private final PublishingPdfComposerService publishingPdfComposerService;
    private final ControlledCopyDistributionJobService controlledCopyDistributionJobService;
    private final NotificationDispatcher notificationDispatcher;
    private final org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder passwordEncoder;
    private final ControlledCopyPreviewGrantService controlledCopyPreviewGrantService;
    private final ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    private final com.eqms.repository.ControlledCopyPlaceholderFieldRepository controlledCopyPlaceholderFieldRepository;
    private final ControlledCopyPlaceholderValueBuilder placeholderValueBuilder;
    private final ControlledCopyPdfMarkingService pdfMarkingService;
    private final ControlledCopyWithdrawalNoticeService withdrawalNoticeService;
    private final SignatureTokenConsumptionService signatureTokenConsumptionService;

    @PersistenceContext
    private EntityManager entityManager;

    @org.springframework.beans.factory.annotation.Autowired
    private ApplicationEventPublisher eventPublisher;

    // @Lazy breaks the circular dependency: ControlledCopyBatchDistributionAsyncService already
    // depends on ControlledCopyService.
    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private ControlledCopyBatchDistributionAsyncService controlledCopyBatchDistributionAsyncService;

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private ControlledCopyBatchRecallAsyncService controlledCopyBatchRecallAsyncService;

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private ControlledCopyBatchCancelAsyncService controlledCopyBatchCancelAsyncService;

    @org.springframework.beans.factory.annotation.Autowired
    private ClamAvScanService clamAvScanService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.eqms.repository.ControlledCopyBatchStatusDiscrepancyRepository controlledCopyBatchStatusDiscrepancyRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private ElectronicSignatureService electronicSignatureService;

    @org.springframework.beans.factory.annotation.Autowired
    private SystemActorProvider systemActorProvider;

    @org.springframework.beans.factory.annotation.Autowired
    private EformSignerAssignmentService eformSignerAssignmentService;

    @org.springframework.beans.factory.annotation.Autowired
    private FormSettingsService formSettingsService;

    public ControlledCopyService(
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyEvidenceFileRepository controlledCopyEvidenceFileRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            ControlledCopyStatusDefinitionRepository controlledCopyStatusDefinitionRepository,
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            TokenService tokenService,
            DocumentAuthorizationService documentAuthorizationService,
            PermissionEvaluationService permissionEvaluationService,
            AuditTrailService auditTrailService,
            EmailNotificationService emailNotificationService,
            FileStorageService fileStorageService,
            SecureFileAccessService secureFileAccessService,
            ControlledCopyPolicyService controlledCopyPolicyService,
            ControlledCopyExpiryLimitService controlledCopyExpiryLimitService,
            ControlledCopyAuthorizationService controlledCopyAuthorizationService,
            RevisionPublishingMetadataRepository revisionPublishingMetadataRepository,
            PublishingPdfComposerService publishingPdfComposerService,
            ControlledCopyDistributionJobService controlledCopyDistributionJobService,
            NotificationDispatcher notificationDispatcher,
            org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder passwordEncoder,
            ControlledCopyPreviewGrantService controlledCopyPreviewGrantService,
            ControlledCopyBatchStatusService controlledCopyBatchStatusService,
            com.eqms.repository.ControlledCopyPlaceholderFieldRepository controlledCopyPlaceholderFieldRepository,
            ControlledCopyPlaceholderValueBuilder placeholderValueBuilder,
            ControlledCopyPdfMarkingService pdfMarkingService,
            ControlledCopyWithdrawalNoticeService withdrawalNoticeService,
            SignatureTokenConsumptionService signatureTokenConsumptionService
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.controlledCopyEvidenceFileRepository = controlledCopyEvidenceFileRepository;
        this.controlledCopyDistributionBatchRepository = controlledCopyDistributionBatchRepository;
        this.controlledCopyStatusDefinitionRepository = controlledCopyStatusDefinitionRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.departmentRepository = departmentRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserService = currentUserService;
        this.tokenService = tokenService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.auditTrailService = auditTrailService;
        this.emailNotificationService = emailNotificationService;
        this.fileStorageService = fileStorageService;
        this.secureFileAccessService = secureFileAccessService;
        this.controlledCopyPolicyService = controlledCopyPolicyService;
        this.controlledCopyExpiryLimitService = controlledCopyExpiryLimitService;
        this.controlledCopyAuthorizationService = controlledCopyAuthorizationService;
        this.revisionPublishingMetadataRepository = revisionPublishingMetadataRepository;
        this.publishingPdfComposerService = publishingPdfComposerService;
        this.controlledCopyDistributionJobService = controlledCopyDistributionJobService;
        this.notificationDispatcher = notificationDispatcher;
        this.passwordEncoder = passwordEncoder;
        this.controlledCopyPreviewGrantService = controlledCopyPreviewGrantService;
        this.controlledCopyBatchStatusService = controlledCopyBatchStatusService;
        this.controlledCopyPlaceholderFieldRepository = controlledCopyPlaceholderFieldRepository;
        this.placeholderValueBuilder = placeholderValueBuilder;
        this.pdfMarkingService = pdfMarkingService;
        this.withdrawalNoticeService = withdrawalNoticeService;
        this.signatureTokenConsumptionService = signatureTokenConsumptionService;
    }

    @Autowired
    public void setSystemConfigurationService(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    public record FileDownload(byte[] bytes, String fileName, String contentType) {
    }

    private record RecipientAllocation(
            UserAccount user,
            String identifier,
            String label,
            String displayName,
            int quantity
    ) {
    }

    @Transactional(readOnly = true)
    public ControlledCopyFiltersResponse getFilters() {
        List<LookupItemResponse> statuses = controlledCopyStatusDefinitionRepository.findAllByOrderBySortOrderAsc().stream()
                .map(status -> new LookupItemResponse(
                        status.getCode(),
                        status.getLabel(),
                        status.getCode(),
                        status.getLabel(),
                        status.getCode()
                ))
                .toList();
        return new ControlledCopyFiltersResponse(statuses);
    }

    @Transactional(readOnly = true)
    public PageResponse<ControlledCopyListItemResponse> list(
            Integer page,
            Integer limit,
            String search,
            String status,
            String department,
            String documentId,
            String createdFrom,
            String createdTo,
            String validFrom,
            String validTo,
            String expiryFrom,
            String expiryTo,
            String recallFrom,
            String recallTo,
            String sortBy,
            String sortDirection
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        int safePage = Math.max(page == null ? 1 : page, 1);
        int safeLimit = Math.min(Math.max(limit == null ? 10 : limit, 1), MAX_LIST_PAGE_SIZE);
        Specification<ControlledCopyRecord> specification = buildSpecification(
                search,
                status,
                department,
                documentId,
                createdFrom,
                createdTo,
                validFrom,
                validTo,
                expiryFrom,
                expiryTo,
                recallFrom,
                recallTo
        ).and(buildAuthorizationSpecification(currentUser));

        Pageable pageable = PageRequest.of(safePage - 1, safeLimit, resolveSort(sortBy, sortDirection));
        Page<ControlledCopyRecord> pageResult = controlledCopyRepository.findAll(specification, pageable);

        return new PageResponse<>(
                pageResult.getContent().stream().map(copy -> toResponse(copy, false)).toList(),
                new PaginationResponse(safePage, safeLimit, (int) pageResult.getTotalElements(), pageResult.getTotalPages())
        );
    }

    /** DB-side equivalent of {@link #resolveComparator(String, String)}, used with Pageable. */
    private Sort resolveSort(String sortBy, String sortDirection) {
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String property = switch (Optional.ofNullable(sortBy).orElse("created").toLowerCase(Locale.ROOT)) {
            case "controlledcopynumber" -> "controlledCopyNumber";
            case "documentnumber", "document" -> "documentNumber";
            case "name", "documentname" -> "documentTitle";
            case "status" -> "statusCode";
            case "validuntil" -> "validUntil";
            case "distributionlist" -> "distributionList";
            case "openedby" -> "requestedBy.fullName";
            case "revisionnumber", "version" -> "revisionNumber";
            case "revisionname" -> "revision.revisionName";
            default -> "createdAt";
        };
        return Sort.by(direction, property).and(Sort.by(Sort.Direction.ASC, "createdAt"));
    }

    @Transactional(readOnly = true)
    public void writeExport(
            String search,
            String status,
            String department,
            String documentId,
            String createdFrom,
            String createdTo,
            String validFrom,
            String validTo,
            String expiryFrom,
            String expiryTo,
            String recallFrom,
            String recallTo,
            String sortBy,
            String sortDirection,
            OutputStream output
    ) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Keep export on the same database-side filtering, authorization and
        // ordering path as the paged register. The CSV is written one page at
        // a time so a large export does not retain all records or the complete
        // response in application memory.
        Specification<ControlledCopyRecord> specification = buildSpecification(
                search,
                status,
                department,
                documentId,
                createdFrom,
                createdTo,
                validFrom,
                validTo,
                expiryFrom,
                expiryTo,
                recallFrom,
                recallTo
        ).and(buildAuthorizationSpecification(currentUser));

        Writer writer = new BufferedWriter(new java.io.OutputStreamWriter(output, StandardCharsets.UTF_8));
        writer.write("Document Number,Controlled Copy Number,Created,Opened By,Name,Status,Valid Until,Document,Distribution List,Version,Location,Business Unit,Department,Recipient,Distribution Comment\n");

        final int exportPageSize = 500;
        int pageNumber = 0;
        Page<ControlledCopyRecord> pageResult;
        do {
            pageResult = controlledCopyRepository.findAll(
                    specification,
                    PageRequest.of(pageNumber, exportPageSize, resolveSort(sortBy, sortDirection))
            );
            for (ControlledCopyRecord copy : pageResult.getContent()) {
                ControlledCopyListItemResponse item = toResponse(copy, false);
                writer.write(String.join(",",
                        csv(item.controlledCopyNumber()),
                        csv(item.controlNumber()),
                        csv(formatCreated(item.createdDate(), item.createdTime())),
                        csv(item.openedBy()),
                        csv(item.name()),
                        csv(item.status()),
                        csv(item.validUntil()),
                        csv(item.documentNumber()),
                        csv(item.distributionList()),
                        csv(item.revisionNumber()),
                        csv(item.location()),
                        csv(item.businessUnit()),
                        csv(item.department()),
                        csv(item.recipientName()),
                        csv(item.distributionComment())
                ));
                writer.write('\n');
            }
            writer.flush();
            pageNumber++;
        } while (pageResult.hasNext());

        writer.flush();
    }

    @Transactional
    public ControlledCopyListItemResponse getById(UUID id) {
        // Self-invocation: getControlledCopyDetail()'s own @Transactional is skipped by the Spring
        // proxy here, so this method's own annotation is what actually governs the transaction --
        // it must stay writable so the "Opened By" mark-opened logic inside can persist.
        return getControlledCopyDetail(id);
    }

    @Transactional(readOnly = true)
    public ControlledCopyRequestContextResponse getRequestContext(String documentId, String revisionId) {
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

        documentAuthorizationService.requireCanAccessControlledCopy(currentUser, document);

        if (document.isTemplate()) {
            throw new IllegalArgumentException("Controlled copies cannot be requested for controlled document templates");
        }

        DocumentRevisionRecord currentEffectiveRevision = requireEffectiveRevision(document);
        String documentStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        String revisionStatus = currentEffectiveRevision.getStatus() == null ? null : currentEffectiveRevision.getStatus().getCode();
        if (requestedRevision != null) {
            String requestedStatus = requestedRevision.getStatus() == null ? null : requestedRevision.getStatus().getCode();
            String normalizedRequestedStatus = StringUtils.hasText(requestedStatus) ? requestedStatus.trim() : null;
            if (!"EFFECTIVE".equalsIgnoreCase(normalizedRequestedStatus)) {
                throw new IllegalArgumentException("Controlled copies can only be requested for an effective revision");
            }
            if (!Objects.equals(requestedRevision.getId(), currentEffectiveRevision.getId())) {
                throw new IllegalArgumentException("Controlled copies can only be requested for the current effective revision");
            }
        }

        boolean hasRequestPermission = permissionEvaluationService.hasPermission(currentUser, "documents.controlled_copy.request");
        boolean canRequest = "ACTIVE".equalsIgnoreCase(StringUtils.hasText(documentStatus) ? documentStatus.trim() : null)
                && currentEffectiveRevision.getId() != null
                && hasRequestPermission;
        boolean canRequestForOthers = hasRequestPermission
                && permissionEvaluationService.hasPermission(currentUser, "documents.workspace.manage");
        String message = canRequest
                ? null
                : "Request Controlled Copy requires permission and is available only when the document is Active and the latest revision is Effective.";
        // Every Controlled Copy always has a real, resolved expiry (the mandatory Global Default
        // row guarantees a match) -- there is no "never expires" state. Resolve the same rule the
        // actual request submission will use (resolveMaximumExpiry), so this preview can never
        // drift from what gets applied at submit time.
        var matchedExpiryLimit = controlledCopyExpiryLimitService.resolveMatchingLimit(document.getDocumentType(), document.getDepartment());
        Integer expiryDurationValue = matchedExpiryLimit.map(com.eqms.entity.ControlledCopyExpiryLimit::getDurationValue).orElse(null);
        String expiryDurationUnit = matchedExpiryLimit.map(com.eqms.entity.ControlledCopyExpiryLimit::getDurationUnit).orElse(null);

        return new ControlledCopyRequestContextResponse(
                document.getId() == null ? null : document.getId().toString(),
                document.getDocumentNumber(),
                document.getDocumentName(),
                document.getDocumentType() == null ? null : document.getDocumentType().getName(),
                document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName(),
                documentStatus,
                currentEffectiveRevision.getId() == null ? null : currentEffectiveRevision.getId().toString(),
                currentEffectiveRevision.getRevisionNumber(),
                currentEffectiveRevision.getRevisionName(),
                revisionStatus,
                DateTimeFormatUtils.formatDate(currentEffectiveRevision.getEffectiveDate()),
                DateTimeFormatUtils.formatDate(currentEffectiveRevision.getValidUntil()),
                canRequest,
                canRequestForOthers,
                message,
                expiryDurationValue,
                expiryDurationUnit
        );
    }

    @Transactional
    public ControlledCopyListItemResponse getControlledCopyDetail(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopyForDetail(id);
        if (!canViewControlledCopy(currentUser, copy)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        // "Opened By" reflects whoever last opened this copy's detail view, matching the same
        // pattern DocumentService/RevisionService already use for their own "Opened By" column --
        // previously this copy had no such tracking at all and the DTO field was fabricated from
        // requestedBy (see toResponse below).
        copy.setOpenedBy(currentUser);
        controlledCopyRepository.save(copy);
        auditTrailService.logAs(
                currentUser,
                "Controlled Copy",
                copy.getControlledCopyNumber(),
                copy.getId(),
                "VIEW",
                null,
                copy.getStatus(),
                "Opened controlled copy detail"
        );
        return toResponse(copy, true);
    }

    /**
     * The PDF of this copy for an authorised signed-in user (Document tab): the stored issued file while valid; the same file with a
     * server-drawn status text once it is withdrawn or cancelled; and, before distribution, a preview composed exactly as it would be
     * issued (nothing is stored) marked "PREVIEW - NOT ISSUED". Read-only: no download/print counter is consumed.
     */
    @Transactional
    public FileDownload viewIssuedDocument(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopyForDetail(id);
        if (!canViewControlledCopy(currentUser, copy)
                || !permissionEvaluationService.hasPermission(currentUser, "documents.controlled_copy.view_file")) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        String status = copy.getStatusCode() == null ? "" : copy.getStatusCode().trim().toUpperCase(Locale.ROOT);
        byte[] pdf;
        List<String> banner = null;
        com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking statusMarking = null;
        List<String> watermarkLines = List.of();
        List<String> stampLines = List.of();
        try {
            if (STATUS_READY_FOR_DISTRIBUTION.equals(status)) {
                pdf = composeIssuedPreview(copy);
                banner = List.of("PREVIEW - NOT ISSUED");
            } else {
                pdf = loadControlledCopyPreviewPdf(copy);
                if (STATUS_OBSOLETED.equals(status) || STATUS_CLOSED_CANCELLED.equals(status)) {
                    statusMarking = controlledCopyPolicyService.statusMarkingFor(controlledCopyPolicyService.loadOrDefault(), status);
                    String reason = STATUS_OBSOLETED.equals(status)
                            ? ControlledCopyWithdrawalNoticeService.reasonLabel(copy.getObsoleteReason())
                            : "Request cancelled";
                    java.time.Instant endedAt = STATUS_OBSOLETED.equals(status)
                            ? (copy.getRecalledAt() != null ? copy.getRecalledAt() : copy.getObsoletedAt())
                            : copy.getCancelledAt();
                    String date = endedAt == null ? null
                            : (STATUS_OBSOLETED.equals(status) ? "Withdrawn " : "Cancelled ")
                            + DateTimeFormatUtils.formatDate(endedAt.atZone(SYSTEM_ZONE).toLocalDate());
                    ControlledCopyPdfMarkingService.StatusLines lines = pdfMarkingService.statusLines(statusMarking, reason, date);
                    watermarkLines = lines.watermark();
                    stampLines = lines.stamp();
                }
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load the controlled copy PDF", ex);
        }
        if (pdf == null || pdf.length == 0) {
            throw new IllegalStateException("The controlled copy PDF is not available");
        }
        if (banner != null) {
            pdf = pdfMarkingService.applyStatusWatermark(pdf, banner);
        }
        if (statusMarking != null) {
            pdf = pdfMarkingService.applyStatusMarking(pdf, statusMarking, watermarkLines, stampLines, issuedMarks(copy, pdf));
        }
        auditPreviewAccess(currentUser, copy, "VIEW_ISSUED_DOCUMENT", "Viewed the controlled copy document (" + status + ")");
        return new FileDownload(pdf, buildControlledCopyDownloadFileName(copy), "application/pdf");
    }

    /** Composes and marks the PDF the way distribution would, without changing or storing anything. */
    private byte[] composeIssuedPreview(ControlledCopyRecord copy) throws IOException {
        RevisionPublishingMetadata metadata = copy.getRevision() == null || copy.getRevision().getId() == null ? null
                : revisionPublishingMetadataRepository.findByRevision_Id(copy.getRevision().getId()).orElse(null);
        com.fasterxml.jackson.databind.JsonNode recipient = placeholderValueBuilder.recipientSnapshotForPreview(copy);
        boolean hasTemplate = metadata != null && metadata.getPublishingTemplate() != null
                && StringUtils.hasText(metadata.getSelectedPublishingLayout());
        byte[] base = hasTemplate ? composeThroughTemplate(copy, metadata, recipient) : loadControlledCopyPreviewPdf(copy);
        if (base == null || base.length == 0) {
            return base;
        }
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        if (!pdfMarkingService.isMarkingEnabled(policy)) {
            return base;
        }
        // The "PREVIEW - NOT ISSUED" text is drawn over the page next; the watermark would collide with it, so the preview keeps the stamp only.
        ControlledCopyPolicySetting previewPolicy = new ControlledCopyPolicySetting();
        org.springframework.beans.BeanUtils.copyProperties(policy, previewPolicy);
        previewPolicy.setWatermarkEnabled(false);
        return pdfMarkingService.isMarkingEnabled(previewPolicy) ? pdfMarkingService.apply(base, copy, recipient, previewPolicy) : base;
    }

    /**
     * The recall / withdrawal notice for a copy that is no longer valid. Built entirely on the server from the copy's record and
     * the recipient details captured at distribution; every generation is audited.
     */
    @Transactional
    public FileDownload generateWithdrawalNotice(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopyForDetail(id);
        if (!canViewControlledCopy(currentUser, copy)
                || !permissionEvaluationService.hasPermission(currentUser, "documents.controlled_copy.recall")) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        if (!STATUS_OBSOLETED.equalsIgnoreCase(copy.getStatusCode())) {
            throw new IllegalStateException("A notice can only be generated for a controlled copy that is no longer valid.");
        }
        com.fasterxml.jackson.databind.JsonNode recipient = placeholderValueBuilder.captureRecipientSnapshotIfAbsent(copy);
        byte[] pdf = withdrawalNoticeService.build(copy, recipient, currentUser);
        auditPreviewAccess(currentUser, copy, "GENERATE_WITHDRAWAL_NOTICE",
                "Generated the withdrawal notice (" + ControlledCopyWithdrawalNoticeService.reasonLabel(copy.getObsoleteReason()) + ")");
        return new FileDownload(pdf, "Withdrawal-Notice-" + copy.getControlledCopyNumber() + ".pdf", "application/pdf");
    }

    @Transactional
    public Object getControlledCopyResolvedDetail(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        Optional<ControlledCopyRecord> copy = controlledCopyRepository.findById(id);
        if (copy.isPresent()) {
            ControlledCopyRecord record = copy.get();
            if (!canViewControlledCopy(currentUser, record)) {
                throw new AccessDeniedException("Controlled copy access denied");
            }
            // Same "Opened By" tracking as getControlledCopyDetail() -- this is the endpoint the
            // frontend's detail view actually calls (getControlledCopyDetailById -> /resolved-detail),
            // so this is the real path that must mark the copy opened, not just the /{id} one.
            record.setOpenedBy(currentUser);
            controlledCopyRepository.save(record);
            auditTrailService.logAs(
                    currentUser,
                    "Controlled Copy",
                    record.getControlledCopyNumber(),
                    record.getId(),
                    "VIEW",
                    null,
                    record.getStatus(),
                    "Opened controlled copy detail"
            );
            return toResponse(record, true);
        }

        ControlledCopyDistributionBatch batch = requireDistributionBatch(id);
        if (!documentAuthorizationService.canAccessControlledCopy(currentUser, batch.getRevision())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        return toBatchSummaryResponse(batch);
    }

    @Transactional(readOnly = true)
    public Object getControlledCopyResolvedDetailForSnapshot(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        Optional<ControlledCopyRecord> copy = controlledCopyRepository.findById(id);
        if (copy.isPresent()) {
            if (!canViewControlledCopy(currentUser, copy.get())) {
                throw new AccessDeniedException("Controlled copy access denied");
            }
            return toResponse(copy.get(), true);
        }

        ControlledCopyDistributionBatch batch = requireDistributionBatch(id);
        if (!documentAuthorizationService.canAccessControlledCopy(currentUser, batch.getRevision())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        return toBatchSummaryResponse(batch);
    }

    @Transactional
    public ControlledCopyPreviewResponse openPreview(UUID id, String token, String password) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        controlledCopyAuthorizationService.requireTokenPreviewAccess(copy, token, password);
        UserAccount currentUser = findAuthenticatedPreviewUser();
        auditPreviewAccess(currentUser, copy, "OPEN_PREVIEW", "Opened controlled copy preview");
        // The grant doubles as the viewing session: it lasts as long as the policy lets an external recipient keep the copy open.
        long sessionSeconds = controlledCopyPolicyService.loadOrDefault().getPreviewSessionMinutes() * 60L;
        return buildPreviewResponse(copy, controlledCopyPreviewGrantService.issue(copy, sessionSeconds));
    }

    @Transactional
    public FileDownload downloadControlledCopy(UUID id, String token, String password) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        UserAccount currentUser = requirePreviewAccess(copy, token);
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        if (!policy.isAllowDownload()) {
            throw new AccessDeniedException("Download is disabled by the Controlled Copies Policy.");
        }
        try {
            byte[] pdfBytes = loadControlledCopyPreviewPdf(copy);
            if (pdfBytes == null || pdfBytes.length == 0) {
                throw new IllegalStateException("Controlled copy preview file is not available");
            }
            if (controlledCopyRepository.consumeDownload(copy.getId(), Instant.now(), policy.isDownloadOnce()) == 0) {
                throw new AccessDeniedException("Download limit reached for this controlled copy.");
            }
            auditPreviewAccess(currentUser, copy, "DOWNLOAD", "Downloaded controlled copy preview");
            return new FileDownload(
                    pdfBytes,
                    buildControlledCopyDownloadFileName(copy),
                    "application/pdf"
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load controlled copy preview file", ex);
        }
    }

    @Transactional
    public FileDownload previewControlledCopyFile(UUID id, String token) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        UserAccount currentUser = requirePreviewAccess(copy, token);
        try {
            byte[] pdfBytes = loadControlledCopyPreviewPdf(copy);
            if (pdfBytes == null || pdfBytes.length == 0) {
                throw new IllegalStateException("Controlled copy preview file is not available");
            }
            auditPreviewAccess(currentUser, copy, "VIEW_FILE", "Loaded controlled copy PDF into the embedded viewer");
            return new FileDownload(pdfBytes, buildControlledCopyDownloadFileName(copy), "application/pdf");
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load controlled copy preview file", ex);
        }
    }

    @Transactional
    public byte[] renderPreviewPage(UUID id, String token, int pageNumber) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        UserAccount currentUser = requirePreviewAccess(copy, token);
        int safePage = Math.max(pageNumber, 1);
        byte[] rendered = renderControlledCopyPreviewPage(copy, safePage);
        auditPreviewAccess(currentUser, copy, "VIEW_PAGE", "Viewed page " + safePage);
        return rendered;
    }

    @Transactional
    public ControlledCopyPreviewResponse closePreview(UUID id, String token, Long timeSpentMs) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        UserAccount currentUser = requirePreviewAccess(copy, token);
        String comment = "User closed controlled copy preview";
        if (timeSpentMs != null && timeSpentMs > 0) {
            comment += " | Time spent: " + timeSpentMs + "ms";
        }
        auditPreviewAccess(currentUser, copy, "CLOSE_PREVIEW", comment);
        return buildPreviewResponse(copy, token);
    }

    @Transactional
    public void consumePreviewPrint(UUID id, String token) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        UserAccount currentUser = requirePreviewAccess(copy, token);
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        if (!policy.isAllowPrint()) {
            throw new AccessDeniedException("Printing is disabled by the Controlled Copies Policy.");
        }
        if (controlledCopyRepository.consumePrint(copy.getId(), policy.isPrintOnce()) == 0) {
            throw new AccessDeniedException("Print limit reached for this controlled copy.");
        }
        auditPreviewAccess(currentUser, copy, "PRINT", "Printed controlled copy preview");
    }

    @Transactional(readOnly = true)
    public List<SignatureResponse> getControlledCopySignatures(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(id);
        if (!canViewControlledCopy(currentUser, copy)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        return buildSignatureRows(copy);
    }

    @Transactional(readOnly = true)
    public List<ControlledCopyEvidenceResponse> listEvidence(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(id);
        if (!canViewControlledCopy(currentUser, copy)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        return toEvidenceResponses(id);
    }

    @Transactional(readOnly = true)
    public FileDownload downloadEvidence(UUID controlledCopyId, UUID evidenceId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(controlledCopyId);
        if (!canViewControlledCopy(currentUser, copy)) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        ControlledCopyEvidenceFile evidence = controlledCopyEvidenceFileRepository.findByIdAndControlledCopy_Id(evidenceId, controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy evidence file not found"));
        try {
            auditTrailService.logAs(
                    currentUser,
                    "CONTROLLED_COPY",
                    copy.getControlledCopyNumber(),
                    copy.getId(),
                    "DOWNLOAD_EVIDENCE",
                    null,
                    copy.getStatus(),
                    evidence.getFileName()
            );
            return new FileDownload(
                    fileStorageService.readFile(evidence.getStoredPath()),
                    evidence.getFileName(),
                    StringUtils.hasText(evidence.getContentType()) ? evidence.getContentType() : "application/octet-stream"
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load controlled copy evidence file", ex);
        }
    }

    @Transactional
    public ControlledCopyListItemResponse requestControlledCopy(ControlledCopyRequestCreateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();

        DocumentRecord document = resolveDocument(firstNonBlank(
                request == null ? null : request.documentId(),
                request == null ? null : request.documentNumber()
        ));
        if (document.isTemplate()) {
            throw new IllegalArgumentException("Controlled copies cannot be requested for controlled document templates");
        }
        DocumentRevisionRecord revision = requireEffectiveRevision(document);
        // Uses the exact evaluator behind the capability API.  Do not add a
        // second flat permission or scope check here: that would allow the UI
        // and mutation endpoint to drift when workflow policy is changed.
        controlledCopyAuthorizationService.requireRequestControlledCopy(currentUser, document, revision);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy request");
        if (request != null && StringUtils.hasText(request.sourceRevisionId())) {
            UUID requestedSourceRevisionId = parseUuidOrNull(request.sourceRevisionId());
            if (requestedSourceRevisionId != null && !requestedSourceRevisionId.equals(revision.getId())) {
                throw new IllegalArgumentException("Controlled copies can only be requested for the current effective revision");
            }
        }

        String deliveryMode = normalize(firstNonBlank(request == null ? null : request.deliveryMode(), "PAPER")).toUpperCase(Locale.ROOT);
        if ("ELECTRONIC".equals(deliveryMode)) {
            var formSettings = formSettingsService.requireSettingsOrNull(document.getId());
            if (formSettings == null || !formSettings.isAllowEform()) {
                throw new IllegalArgumentException("This Document does not accept electronic eForm distribution.");
            }
        } else {
            deliveryMode = "PAPER";
        }

        String distributionMode = normalize(firstNonBlank(
                request == null ? null : request.distributionMode(),
                request == null || request.externalRecipients() == null || request.externalRecipients().isEmpty() ? "INTERNAL" : "EXTERNAL"
        ));
        boolean externalMode = "external".equalsIgnoreCase(distributionMode);
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        if (externalMode && !policy.isAllowEmailDistribution()) {
            throw new AccessDeniedException("Email distribution is disabled by the Controlled Copies Policy.");
        }
        boolean canRequestForOthers = permissionEvaluationService.hasPermission(currentUser, "documents.workspace.manage");
        if (externalMode && !canRequestForOthers) {
            throw new AccessDeniedException("Only users with controlled-copy administration permission can request copies for external recipients.");
        }

        List<String> locationIds = request == null || request.locationIds() == null ? List.of() : request.locationIds().stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
        List<String> locationNames = request == null || request.locationNames() == null ? List.of() : request.locationNames().stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
        List<String> recipientIds = request == null || request.recipientIds() == null ? List.of() : request.recipientIds().stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
        List<String> recipientLabels = request == null || request.recipientLabels() == null ? List.of() : request.recipientLabels().stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
        List<String> externalRecipients = request == null || request.externalRecipients() == null ? List.of() : request.externalRecipients().stream().filter(StringUtils::hasText).map(String::trim).toList();
        boolean requestedHasExpiryDate = request != null && Boolean.TRUE.equals(request.hasExpiryDate());
        Instant expiryDate = parseInstant(request == null ? null : request.expiryDate(), null);
        Instant maximumExpiryDate = controlledCopyExpiryLimitService.resolveMaximumExpiry(document.getDocumentType(), document.getDepartment());
        if (maximumExpiryDate == null) {
            throw new IllegalStateException("No active Controlled Copy expiry policy is configured.");
        }
        if (expiryDate == null) {
            expiryDate = maximumExpiryDate;
        } else if (expiryDate.isAfter(maximumExpiryDate)) {
            throw new IllegalArgumentException("Expiry date cannot exceed the configured Controlled Copy expiry limit.");
        }
        boolean hasExpiryDate = requestedHasExpiryDate || expiryDate != null;
        // No explicit date was requested: the expiry above is only a projection (now + policy
        // duration) shown while the copy waits in Ready for Distribution. It is recomputed as
        // distributedAt + duration at Distribute time so the copy can never expire before it is
        // actually distributed. An explicit requester-chosen date is a fixed deadline and is left
        // exactly as requested at Distribute time.
        boolean expiryAnchoredToDistribution = !requestedHasExpiryDate;

        List<RecipientAllocation> recipients = resolveRequestRecipients(
                request,
                externalMode,
                externalRecipients,
                !recipientIds.isEmpty() ? recipientIds : locationIds,
                !recipientLabels.isEmpty() ? recipientLabels : locationNames
        );
        if (recipients.isEmpty()) {
            throw new IllegalArgumentException(externalMode
                    ? "At least one valid external recipient email is required"
                    : "At least one internal recipient is required");
        }
        if ("ELECTRONIC".equals(deliveryMode) && (externalMode || recipients.stream().anyMatch(r -> r.user() == null))) {
            // One request may still target several people -- the per-recipient loop below already
            // creates one ControlledCopyRecord per recipient, each individually scoped to exactly
            // one filler; only external/email-only recipients (no internal account) are rejected.
            throw new IllegalArgumentException("An electronic eForm distribution requires internal recipients only.");
        }

        int totalCopies = recipients.stream().mapToInt(recipient -> Math.max(recipient.quantity(), 1)).sum();
        int requestedQuantity = Optional.ofNullable(request == null ? null : request.quantity())
                .orElse(Optional.ofNullable(request == null ? null : request.copies()).orElse(totalCopies));
        if (requestedQuantity != totalCopies) {
            throw new IllegalArgumentException("Sum(recipients.quantity) must equal Request.quantity.");
        }
        if (!canRequestForOthers && (externalMode
                || totalCopies != 1
                || recipients.size() != 1
                || recipients.get(0).user() == null
                || currentUser.getId() == null
                || !currentUser.getId().equals(recipients.get(0).user().getId()))) {
            throw new AccessDeniedException("Document viewers may request only one internal controlled copy for themselves.");
        }
        byte[] publishedPdf = requirePublishedPdfBytes(revision);
        long documentSequenceSeed = nextDocumentControlledCopySequence(document);
        // Persist the actual recipient names in the distribution list.  The
        // location/department remains a separate field; mixing them here made
        // a single-user copy appear to be distributed to a department.
        String joinedDistributionList = recipients.stream()
                .map(RecipientAllocation::displayName)
                .filter(StringUtils::hasText)
                .distinct()
                .toList()
                .stream()
                .reduce((left, right) -> left + ", " + right)
                .orElse(null);
        String joinedExternalRecipients = externalMode
                ? recipients.stream().map(RecipientAllocation::identifier).filter(StringUtils::hasText).distinct().reduce((left, right) -> left + ", " + right).orElse(null)
                : null;
        // Every recipient allocation in a business-unit/department request carries that target's
        // own name as its label (repeated once per user resolved into it) -- distinct + join to
        // get every selected unit's name, not just the first. Using recipients.get(0) here used to
        // silently drop every unit after the first when more than one was selected in the same
        // request (e.g. "Quality Control" + "Quality Assurance" -> only "Quality Control" was ever
        // persisted). location/locationCode deliberately stay first-only: they're used elsewhere as
        // a single scalar identifier (search/fallback), not as the user-facing distribution list.
        String joinedDistributionUnitLabels = recipients.stream()
                .map(RecipientAllocation::label)
                .filter(StringUtils::hasText)
                .distinct()
                .reduce((left, right) -> left + "; " + right)
                .orElse(recipients.get(0).label());
        String resolvedLocation = recipients.get(0).label();
        String resolvedLocationCode = locationIds.isEmpty() ? recipients.get(0).identifier() : locationIds.get(0);
        String resolvedScope = resolveDistributionScope(request, distributionMode);
        String resolvedDistributionList = externalMode
                ? "External"
                : ("business-unit".equalsIgnoreCase(resolvedScope) || "department".equalsIgnoreCase(resolvedScope))
                        ? joinedDistributionUnitLabels
                        : ("individual".equalsIgnoreCase(resolvedScope) && totalCopies > 1)
                                ? "Individual"
                        : joinedDistributionList;
        String reason = normalize(firstNonBlank(
                request == null ? null : request.reason(),
                request == null ? null : request.purpose(),
                request == null ? null : request.signature()
        ));
        if (!StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("A request reason is required.");
        }

        ControlledCopyDistributionBatch batch = createDistributionBatch(
                document,
                revision,
                currentUser,
                totalCopies,
                resolvedDistributionList,
                distributionMode,
                externalMode ? "external" : resolvedScope,
                externalMode ? "External Recipients" : resolvedLocation,
                externalMode ? "EXT" : resolvedLocationCode,
                joinedExternalRecipients,
                reason,
                hasExpiryDate,
                expiryDate,
                expiryAnchoredToDistribution
        );

        ControlledCopyRecord firstCreated = null;
        int copyIndex = 1;
        // The display "Controlled Copy N" numbering must stay unique across every request/reissue
        // for this revision — separate from copyIndex above, which only seeds the unrelated
        // per-document CC.xxx.NNN sequence and must keep starting at 1 for that generator.
        int displayCopyNumber = nextCopyNumberForRevision(revision);
        for (RecipientAllocation recipient : recipients) {
            int allocationQuantity = Math.max(recipient.quantity(), 1);
            for (int allocationIndex = 0; allocationIndex < allocationQuantity; allocationIndex++) {
            ControlledCopyRecord copy = new ControlledCopyRecord();
            copy.setId(UUID.randomUUID());
            copy.setDocument(document);
            copy.setRevision(revision);
            copy.setDistributionBatch(batch);
            copy.setControlledCopyNumber(nextControlledCopyNumber(revision, documentSequenceSeed + copyIndex - 1));
            copy.setCopyNumber(displayCopyNumber);
            copy.setTotalCopies(totalCopies);
            copy.setDocumentNumber(document.getDocumentNumber());
            copy.setDocumentTitle(document.getDocumentName());
            copy.setRevisionNumber(revision.getRevisionNumber());
            copy.setBusinessUnitName(document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName());
            copy.setDepartmentName(document.getDepartment() == null ? null : document.getDepartment().getName());
            // A batch is summarized as "External", while every child record
            // retains only its own recipient. This prevents one external
            // email list from appearing on every controlled-copy record.
            copy.setDistributionList(externalMode ? "External" : recipient.displayName());
            copy.setDeliveryMode(deliveryMode);
            copy.setDistributionMode(distributionMode == null ? null : distributionMode.toUpperCase(Locale.ROOT));
            copy.setDistributionScope(externalMode ? "external" : resolveDistributionScope(request, distributionMode));
            copy.setLocation(externalMode ? "External Recipients" : resolvedLocation);
            copy.setLocationCode(externalMode ? "EXT" : resolvedLocationCode);
            copy.setRequestReason(reason);
            copy.setExternalRecipients(externalMode ? recipient.identifier() : null);
            copy.setRecipientUser(recipient.user());
            copy.setRecipientName(recipient.displayName());
            copy.setAccessToken(generateAccessToken());
            copy.setAccessTokenIssuedAt(Instant.now());
            setControlledCopyStatus(copy, STATUS_READY_FOR_DISTRIBUTION);
            copy.setCurrentStage("Ready for Distribution");
            copy.setRequestedBy(currentUser);
            copy.setRequestedAt(Instant.now());
            copy.setValidUntil(revision.getValidUntil());
            copy.setEffectiveDate(revision.getEffectiveDate());
            copy.setHasExpiryDate(hasExpiryDate);
            copy.setExpiryDate(expiryDate);
            copy.setExpiryAnchoredToDistribution(expiryAnchoredToDistribution);
            copy.setExpiryReminderSentAt(null);
            storeControlledCopyPublishedPdf(copy, publishedPdf);
            controlledCopyRepository.save(copy);
            auditTrailService.logAs(
                    currentUser,
                    "Controlled Copy",
                    copy.getControlledCopyNumber(),
                    copy.getId(),
                    "REQUEST",
                    null,
                    copy.getStatus(),
                    reason,
                    List.of(),
                    signatureSessionId
            );
            if (firstCreated == null) {
                firstCreated = copy;
            }
            copyIndex++;
            displayCopyNumber++;
            }
        }

        electronicSignatureService.createEntitySignature("ControlledCopyDistributionBatch", batch.getId(), batch.getBatchNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_REQUESTED", reason, null, null, firstCreated == null ? null : firstCreated.getStatus());
        // Distribute/Cancel/Recall each log a batch-level row alongside every member copy's own
        // row (see the "Controlled Copy Distribution Batch" logAs calls elsewhere in this class);
        // Request never did, so the batch's own Audit Trail tab had no "created" event of its own
        // -- viewing it only ever showed as many near-identical per-copy REQUEST rows as there were
        // recipients (merged in from its members), with no single row representing the batch itself.
        auditTrailService.logAs(
                currentUser,
                "Controlled Copy Distribution Batch",
                batch.getBatchNumber(),
                batch.getId(),
                "REQUEST",
                null,
                firstCreated == null ? null : firstCreated.getStatus(),
                reason,
                List.of(),
                signatureSessionId
        );
        return toResponse(firstCreated, false);
    }

    @Transactional
    public PageResponse<ControlledCopyDistributionBatchSummaryResponse> listDistributionBatches(
            Integer page,
            Integer limit,
            String search,
            String status,
            String documentId,
            String createdFrom,
            String createdTo,
            String validFrom,
            String validTo,
            String expiryFrom,
            String expiryTo,
            String recallFrom,
            String recallTo,
            String sortBy,
            String sortDirection
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        int safePage = Math.max(page == null ? 1 : page, 1);
        int safeLimit = Math.min(Math.max(limit == null ? 10 : limit, 1), MAX_LIST_PAGE_SIZE);
        // Filtering and authorization both execute in SQL.  Do not load the whole
        // batch register and then slice it in Java: that turns a paged UI request
        // into an unbounded memory/latency cost as the register grows.
        Specification<ControlledCopyDistributionBatch> dbFilters = buildBatchListSpecification(
                search, status, documentId, createdFrom, createdTo, validFrom, validTo,
                expiryFrom, expiryTo, recallFrom, recallTo)
                .and(buildBatchAuthorizationSpecification(currentUser));
        Page<ControlledCopyDistributionBatch> pageResult = controlledCopyDistributionBatchRepository.findAll(
                dbFilters,
                PageRequest.of(safePage - 1, safeLimit, resolveBatchSort(sortBy, sortDirection))
        );
        // Reconcile only the page returned to the caller. Newly-created records
        // already have a synchronized status; this is solely a bounded repair for
        // legacy data while the reconciliation scheduler covers the remainder.
        controlledCopyBatchStatusService.synchronizeBatches(pageResult.getContent());
        return new PageResponse<>(
                pageResult.getContent().stream().map(batch -> toBatchSummaryResponse(batch, false)).toList(),
                new PaginationResponse(safePage, safeLimit, (int) pageResult.getTotalElements(), pageResult.getTotalPages())
        );
    }

    /** SQL mirror of {@link DocumentAuthorizationService#canAccessControlledCopy(UserAccount, DocumentRevisionRecord)}
     * for the batch register. Keep this in lockstep with the record-list authorization specification. */
    private Specification<ControlledCopyDistributionBatch> buildBatchAuthorizationSpecification(UserAccount currentUser) {
        if (documentAuthorizationService.canViewAllDocuments(currentUser)) {
            return (root, query, cb) -> cb.conjunction();
        }
        UUID userId = currentUser.getId();
        boolean strictEligible = documentAuthorizationService.isStrictViewEligible(currentUser);
        return (root, query, cb) -> {
            Join<ControlledCopyDistributionBatch, DocumentRevisionRecord> revision = root.join("revision", JoinType.LEFT);
            List<Predicate> allowed = new ArrayList<>();
            allowed.add(cb.equal(revision.get("author").get("id"), userId));

            Subquery<Long> participantSubquery = query.subquery(Long.class);
            Root<RevisionWorkflowParticipant> participant = participantSubquery.from(RevisionWorkflowParticipant.class);
            participantSubquery.select(cb.literal(1L)).where(
                    cb.equal(participant.get("revision").get("id"), revision.get("id")),
                    participant.get("participantType").in("CO_AUTHOR", "REVIEWER", "APPROVER"),
                    cb.equal(participant.get("user").get("id"), userId)
            );
            allowed.add(cb.exists(participantSubquery));
            if (strictEligible) {
                allowed.add(revision.get("status").get("code").in("EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED"));
            }
            return cb.or(allowed.toArray(Predicate[]::new));
        };
    }

    private Sort resolveBatchSort(String sortBy, String sortDirection) {
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String property = switch (Optional.ofNullable(sortBy).orElse("created").toLowerCase(Locale.ROOT)) {
            case "controlledcopynumber", "batchnumber" -> "batchNumber";
            case "documentnumber", "document" -> "documentNumber";
            case "name", "documentname" -> "documentTitle";
            case "status" -> "statusCode";
            case "validuntil" -> "revision.validUntil";
            case "distributionlist" -> "distributionList";
            case "openedby" -> "requestedBy.fullName";
            case "revisionnumber", "version" -> "revisionNumber";
            case "lastupdated", "lastupdatedat", "updated", "updatedat" -> "updatedAt";
            default -> "requestedAt";
        };
        return Sort.by(direction, property).and(Sort.by(Sort.Direction.ASC, "requestedAt"));
    }

    private Specification<ControlledCopyDistributionBatch> buildBatchListSpecification(
            String search, String status, String documentId, String createdFrom, String createdTo,
            String validFrom, String validTo, String expiryFrom, String expiryTo,
            String recallFrom, String recallTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                Join<ControlledCopyDistributionBatch, UserAccount> requestedBy = root.join("requestedBy", JoinType.LEFT);
                Join<ControlledCopyDistributionBatch, UserAccount> distributedBy = root.join("distributedBy", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("batchNumber")), pattern),
                        cb.like(cb.lower(root.get("documentNumber")), pattern),
                        cb.like(cb.lower(root.get("documentTitle")), pattern),
                        cb.like(cb.lower(root.get("revisionNumber")), pattern),
                        cb.like(cb.lower(root.get("distributionList")), pattern),
                        cb.like(cb.lower(root.get("location")), pattern),
                        cb.like(cb.lower(requestedBy.get("fullName")), pattern),
                        cb.like(cb.lower(distributedBy.get("fullName")), pattern)
                ));
            }
            if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status.trim())) {
                String normalized = normalizeControlledCopyStatusCode(status);
                predicates.add(cb.or(
                        cb.equal(cb.lower(root.get("statusCode")), normalized.toLowerCase(Locale.ROOT)),
                        cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase(Locale.ROOT))
                ));
            }
            if (StringUtils.hasText(documentId) && !"all".equalsIgnoreCase(documentId.trim())) {
                String value = documentId.trim();
                UUID documentUuid = parseUuidOrNull(value);
                Predicate documentNumber = cb.equal(cb.lower(root.get("documentNumber")), value.toLowerCase(Locale.ROOT));
                predicates.add(documentUuid == null
                        ? documentNumber
                        : cb.or(documentNumber, cb.equal(root.get("document").get("id"), documentUuid)));
            }
            addInstantRangePredicates(cb, root.get("requestedAt"), createdFrom, createdTo, predicates);
            addInstantRangePredicates(cb, root.get("expiryDate"), expiryFrom, expiryTo, predicates);
            addInstantRangePredicates(cb, root.get("recallDate"), recallFrom, recallTo, predicates);
            if (StringUtils.hasText(validFrom) || StringUtils.hasText(validTo)) {
                Join<ControlledCopyDistributionBatch, DocumentRevisionRecord> revision = root.join("revision", JoinType.LEFT);
                LocalDate from = parseDate(validFrom);
                LocalDate to = parseDate(validTo);
                if (from != null) predicates.add(cb.greaterThanOrEqualTo(revision.get("validUntil"), from));
                if (to != null) predicates.add(cb.lessThanOrEqualTo(revision.get("validUntil"), to));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void addInstantRangePredicates(CriteriaBuilder cb, jakarta.persistence.criteria.Expression<Instant> field,
                                           String fromText, String toText, List<Predicate> predicates) {
        LocalDate from = parseDate(fromText);
        LocalDate to = parseDate(toText);
        if (from != null) predicates.add(cb.greaterThanOrEqualTo(field, from.atStartOfDay(SYSTEM_ZONE).toInstant()));
        if (to != null) predicates.add(cb.lessThan(field, to.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
    }

    @Transactional
    public com.eqms.dto.user.PageResponse<com.eqms.dto.document.ControlledCopyBatchStatusDiscrepancyResponse> listBatchStatusDiscrepancies(Integer page, Integer limit) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, "documents.admin.view", "Current user cannot review controlled copy status discrepancies.");
        int safePage = page == null || page < 1 ? 1 : page;
        int safeLimit = limit == null || limit < 1 ? 20 : Math.min(limit, 100);
        org.springframework.data.domain.Page<com.eqms.entity.ControlledCopyBatchStatusDiscrepancy> pageResult =
                controlledCopyBatchStatusDiscrepancyRepository.findAllByStatusOrderByDetectedAtDesc(
                        com.eqms.entity.ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN,
                        org.springframework.data.domain.PageRequest.of(safePage - 1, safeLimit)
                );
        List<com.eqms.dto.document.ControlledCopyBatchStatusDiscrepancyResponse> data = pageResult.getContent().stream()
                .map(discrepancy -> new com.eqms.dto.document.ControlledCopyBatchStatusDiscrepancyResponse(
                        discrepancy.getId(),
                        discrepancy.getBatch() != null ? discrepancy.getBatch().getId() : null,
                        discrepancy.getBatchNumber(),
                        discrepancy.getBatch() != null ? discrepancy.getBatch().getDocumentNumber() : null,
                        discrepancy.getBatch() != null ? discrepancy.getBatch().getDocumentTitle() : null,
                        discrepancy.getExpectedStatusCode(),
                        discrepancy.getActualStatusCode(),
                        discrepancy.getDetectedAt(),
                        discrepancy.getLastCheckedAt()
                ))
                .toList();
        return new com.eqms.dto.user.PageResponse<>(
                data,
                new com.eqms.dto.user.PaginationResponse(safePage, safeLimit, pageResult.getTotalElements(), pageResult.getTotalPages())
        );
    }

    @Transactional
    public ControlledCopyDistributionBatchSummaryResponse getDistributionBatchById(UUID batchId) {
        return getControlledCopyDistributionBatchDetail(batchId);
    }

    @Transactional
    public ControlledCopyDistributionBatchSummaryResponse getControlledCopyDistributionBatchDetail(UUID batchId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        if (!documentAuthorizationService.canAccessControlledCopy(currentUser, batch.getRevision())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        controlledCopyBatchStatusService.synchronize(batch);
        return toBatchSummaryResponse(batch, true);
    }

    /**
     * Returns batch members through one bounded query.  The expansion UI must not
     * issue one detail request per controlled-copy record: that creates an N+1
     * request burst for every expanded batch and is especially harmful for large
     * department distributions.
     */
    @Transactional(readOnly = true)
    public PageResponse<ControlledCopyListItemResponse> listDistributionBatchCopies(
            UUID batchId,
            Integer page,
            Integer limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        if (!documentAuthorizationService.canAccessControlledCopy(currentUser, batch.getRevision())) {
            throw new AccessDeniedException("Controlled copy access denied");
        }
        int safePage = Math.max(page == null ? 1 : page, 1);
        int safeLimit = Math.min(Math.max(limit == null ? 25 : limit, 1), 100);
        Page<ControlledCopyRecord> result = controlledCopyRepository.findAllByDistributionBatch_Id(
                batchId,
                PageRequest.of(safePage - 1, safeLimit, Sort.by(Sort.Direction.ASC, "copyNumber"))
        );
        return new PageResponse<>(
                result.getContent().stream().map(copy -> toResponse(copy, false)).toList(),
                new PaginationResponse(safePage, safeLimit, (int) result.getTotalElements(), result.getTotalPages())
        );
    }

    @Transactional
    public ControlledCopyDistributionBatchSummaryResponse distributeBatch(UUID batchId, ControlledCopyDistributeRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        controlledCopyAuthorizationService.requireDistributeControlledCopy(currentUser, batch);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy distribution");
        String distributionComment = normalize(request == null ? null : request.comment());
        if (!StringUtils.hasText(distributionComment)) {
            throw new IllegalArgumentException("Comments are required when distributing a controlled copy");
        }
        Instant distributedAt = parseInstant(request == null ? null : request.distributedAt(), Instant.now());

        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batchId);
        if (copies.isEmpty()) {
            throw new IllegalArgumentException("Controlled copy distribution batch has no copy records");
        }

        batch.setStatusCode(STATUS_DISTRIBUTED);
        batch.setStatus("Distributed");
        batch.setDistributedBy(currentUser);
        batch.setDistributedAt(distributedAt);
        batch.setDistributionComment(distributionComment);
        batch.setQuantity(copies.size());
        // Every copy in a batch shares one document, so anchoring resolves to the same recomputed
        // instant for all of them; mirror it on the batch record too, which is what the batch
        // summary response displays for a multi-recipient distribution.
        anchorExpiryToDistributionIfNeeded(batch, distributedAt);

        com.fasterxml.jackson.databind.JsonNode customPlaceholderValues =
                sanitizeCustomPlaceholderValues(request == null ? null : request.customPlaceholderValues());

        for (ControlledCopyRecord copy : copies) {
            anchorExpiryToDistributionIfNeeded(copy, distributedAt);
            ensureControlledCopyNotExpired(copy, distributedAt);
            setControlledCopyStatus(copy, STATUS_DISTRIBUTED);
            copy.setCurrentStage("Distributed");
            copy.setDistributedBy(currentUser);
            copy.setDistributedAt(distributedAt);
            copy.setCustomPlaceholderValues(customPlaceholderValues);
            // See the single-copy distribute() for why external copies must never be resolved
            // to an internal user reference here.
            UserAccount recipientUser = isExternalDistribution(copy)
                    ? null
                    : resolveOptionalUserReference(
                    request == null ? null : request.distributedTo(),
                    copy.getRecipientName()
            );
            if (recipientUser != null) {
                copy.setRecipientUser(recipientUser);
                copy.setRecipientName(recipientUser.getFullName());
            } else {
                copy.setRecipientName(normalize(firstNonBlank(
                        request == null ? null : request.distributedTo(),
                        copy.getRecipientName(),
                        copy.getDistributionList(),
                        copy.getLocation()
                )));
            }
            if (!StringUtils.hasText(copy.getAccessToken())) {
                copy.setAccessToken(generateAccessToken());
                copy.setAccessTokenIssuedAt(Instant.now());
            }
            // Preview password issuance and the distribution e-mail (which carries that password +
            // the preview link) are deliberately NOT done here. This loop only flips status/metadata
            // synchronously; the placeholder-composed, copy-specific PDF is rendered afterward by the
            // async per-copy step (finalizeDistributedCopy) once this transaction commits. Emailing
            // before that step ran would hand out a preview link that still points at the generic,
            // uncomposed PDF -- see the single-copy distribute() above for the correct order this
            // mirrors (compose -> then notify), applied here in finalizeDistributedCopy instead since
            // composition itself is async for a batch.
            copy.setDistributionComment(distributionComment);
            copy.setRecipientDate(LocalDate.now(SYSTEM_ZONE));
            if (StringUtils.hasText(request == null ? null : request.location())) {
                copy.setLocation(request.location().trim());
            }
            controlledCopyRepository.save(copy);
            auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "DISTRIBUTE", "Ready for Distribution", "Distributed", distributionComment, List.of(), signatureSessionId);
        }

        controlledCopyDistributionBatchRepository.save(batch);
        electronicSignatureService.createEntitySignature("ControlledCopyDistributionBatch", batch.getId(), batch.getBatchNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_DISTRIBUTED", distributionComment, null, "Ready for Distribution", "Distributed");
        auditTrailService.logAs(currentUser, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "DISTRIBUTE", "Ready for Distribution", "Distributed", distributionComment, List.of(), signatureSessionId);

        // Kick off the async per-copy "slow part" (placeholder-composed PDF re-render, see
        // finalizeDistributedCopy) once this transaction commits. Without creating the job here
        // and publishing this event, ControlledCopyBatchDistributionAsyncService.onBatchDistributed
        // is never invoked — the batch would already be fully Distributed synchronously above,
        // but the progress modal/job-status polling on the frontend would have nothing to track
        // and would appear stuck indefinitely.
        ControlledCopyDistributionJob job = controlledCopyDistributionJobService.create(batch, currentUser, copies);
        eventPublisher.publishEvent(new ControlledCopyBatchDistributedEvent(
                batch.getId(), job.getId(), copies.stream().map(ControlledCopyRecord::getId).toList(), currentUser.getId()
        ));
        return toBatchSummaryResponse(batch, true);
    }

    /**
     * Finalizes the per-copy background processing step of a batch distribution
     * (e.g. re-rendered PDF / stamped preview) after the batch's status transition
     * has already committed. Returns {@link ControlledCopyFinalizationOutcome#SUCCESS} when the
     * copy was finalized (or was already finalized), {@link ControlledCopyFinalizationOutcome#FAILED}
     * when it could not be processed on this attempt, or
     * {@link ControlledCopyFinalizationOutcome#SKIPPED_TERMINAL} when a concurrent lifecycle action
     * (Obsolete/Cancel) has already moved the copy to a terminal state -- callers must treat that as
     * a completed, intentional outcome, never as a failure to retry or restore from.
     */
    @Transactional
    public ControlledCopyFinalizationOutcome finalizeDistributedCopy(UUID copyId, UUID issuerUserId) {
        if (copyId == null) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId).orElse(null);
        if (copy == null) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        if (isTerminalControlledCopyStatus(copy.getStatusCode())) {
            return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
        }
        // Note: distributeBatch() already flips each child copy's status to DISTRIBUTED
        // synchronously before this async step runs, so this is normally already true here.
        // The actual "slow part" this method exists for is the placeholder-composed PDF
        // re-render below, which must still run regardless of that status guard.
        boolean alreadyDistributed = STATUS_DISTRIBUTED.equalsIgnoreCase(normalizeControlledCopyStatusCode(copy.getStatusCode()));
        // Never issue credentials/notify for a copy that was already finalized (e.g. this method
        // re-run after a status-only guard tripped above) -- that would re-send the distribution
        // e-mail (with a freshly rotated password, invalidating the one already sent) for a copy
        // whose recipient already has a working preview link.
        boolean alreadyFinalized = StringUtils.hasText(copy.getPreviewPasswordHash());
        UserAccount issuer = resolveIssuerOrSystemActor(issuerUserId);
        // This method runs on the batch executor's async thread (ControlledCopyBatchDistribution-
        // AsyncService), which has no incoming HTTP request and therefore no SecurityContext --
        // but applyComposedControlledCopyPlaceholders() below calls down into
        // PublishingPdfComposerService -> RevisionService.getRevision(), which requires an
        // authenticated current user for its own permission check. Without this, every batch
        // distribution's per-copy finalize step failed outright ("Authentication required"),
        // exhausted its 3 retries, and got silently rolled back to Ready for Distribution --
        // Distribute Batch never actually completed for any batch. Establish a SecurityContext for
        // the already-resolved issuer, exactly as AuthTokenFilter does for a real request, for the
        // duration of this call only, then restore whatever the thread had before (it is pooled and
        // reused across unrelated async tasks).
        var previousSecurityContext = establishIssuerSecurityContext(issuer);
        try {
            applyComposedControlledCopyPlaceholders(copy);
            if (!alreadyDistributed) {
                setControlledCopyStatus(copy, STATUS_DISTRIBUTED);
                copy.setCurrentStage("Distributed");
            }
            String previewPassword = alreadyFinalized ? null : issuePreviewPassword(copy);
            // Flush now (not just save()) so an optimistic-lock conflict on this copy (e.g. a
            // concurrent Obsolete/Cancel, or this same method racing itself) surfaces here -- before
            // the e-mail below is dispatched -- rather than only at this transaction's commit, after
            // that side-effect already ran and can no longer be undone.
            controlledCopyRepository.saveAndFlush(copy);
            if (!alreadyFinalized) {
                // Only NOW -- after the copy-specific composed PDF actually exists -- do stakeholders
                // get notified and the recipient's e-mail (with the preview link + password) go out.
                // Sending this any earlier (e.g. synchronously in distributeControlledCopyBatch(), before
                // this async step ran) would hand out a link to the still-generic, uncomposed PDF.
                notifyControlledCopyStakeholders(copy, issuer, "DISTRIBUTE", copy.getDistributionComment());
                sendControlledCopyDistributionNotification(copy, issuer, copy.getDistributionComment(), true, previewPassword);
            }
            // No audit row for this async step's success: the signed "DISTRIBUTE" entry written by
            // distributeControlledCopyBatch() (Ready for Distribution -> Distributed) already
            // records the action in full. This step is internal post-processing (per-copy PDF
            // composition + recipient e-mail), not a distinct business action -- emitting a second
            // "... -> Distributed" row with a fictional "Processing" from-status and no e-signature
            // only duplicated the timeline. Its failure IS still audited (DISTRIBUTE_PROCESSING_FAILED
            // in markDistributedCopyProcessingFailed), because a rollback to Ready for Distribution
            // is a real, reviewer-relevant state change. Recall/Cancel batch flows never emitted an
            // equivalent success row either.
            return ControlledCopyFinalizationOutcome.SUCCESS;
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.setContext(previousSecurityContext);
        }
    }

    /**
     * Establishes a SecurityContext for `issuer` on the current thread (mirroring what
     * AuthTokenFilter does for a real HTTP request) so downstream code that requires
     * currentUserService.requireCurrentUser() works correctly when invoked from an @Async
     * background thread, which never receives one on its own. Returns the context that was in
     * place before the call, so the caller can restore it in a finally block -- this thread may be
     * pooled and reused for unrelated work afterward.
     */
    private org.springframework.security.core.context.SecurityContext establishIssuerSecurityContext(UserAccount issuer) {
        var previous = org.springframework.security.core.context.SecurityContextHolder.getContext();
        if (issuer != null) {
            var permissions = permissionEvaluationService.getPermissionCodes(issuer);
            var principal = new AuthenticatedUser(issuer.getId(), null, issuer.getUsername(), issuer.getRoleName(), permissions);
            var authentication = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                    principal, null, tokenService.toAuthorities(permissions));
            var context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            org.springframework.security.core.context.SecurityContextHolder.setContext(context);
        }
        return previous;
    }

    /**
     * Re-reads a copy's status in its own fresh transaction to check whether it has already reached
     * a terminal lifecycle state. Used by the async worker after catching an optimistic-lock
     * conflict from {@link #finalizeDistributedCopy} -- the conflict itself surfaces at the
     * enclosing {@code @Transactional} proxy boundary (i.e. after that method has already returned
     * to its caller), so re-checking here in a brand-new transaction is the only reliable way to
     * learn which concurrent writer actually won the race.
     */
    @Transactional(readOnly = true)
    public boolean isControlledCopyInTerminalState(UUID copyId) {
        if (copyId == null) {
            return false;
        }
        return controlledCopyRepository.findById(copyId)
                .map(ControlledCopyRecord::getStatusCode)
                .map(this::isTerminalControlledCopyStatus)
                .orElse(false);
    }

    private boolean isTerminalControlledCopyStatus(String statusCode) {
        String normalized = normalizeControlledCopyStatusCode(statusCode);
        return STATUS_OBSOLETED.equalsIgnoreCase(normalized) || STATUS_CLOSED_CANCELLED.equalsIgnoreCase(normalized);
    }

    /**
     * Re-triggers async processing for only the FAILED items of a batch's most recent
     * distribution job (see {@link ControlledCopyBatchDistributionAsyncService#retryFailedItems}).
     * Fires the retry in the background and returns immediately; progress is reported over the
     * same SSE channel/job-status endpoint the initial Distribute Batch action uses.
     */
    @Transactional(readOnly = true)
    public void retryFailedDistribution(UUID batchId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        controlledCopyAuthorizationService.requireRetryControlledCopyBatchAction(currentUser, batch, com.eqms.enums.ControlledCopyWorkflowAction.DISTRIBUTE_BATCH);
        controlledCopyBatchDistributionAsyncService.retryFailedItems(batchId, currentUser.getId());
    }

    /**
     * Re-triggers async processing for only the FAILED items of a batch's most recent recall job.
     */
    @Transactional(readOnly = true)
    public void retryFailedRecall(UUID batchId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        controlledCopyAuthorizationService.requireRetryControlledCopyBatchAction(currentUser, batch, com.eqms.enums.ControlledCopyWorkflowAction.RECALL_BATCH);
        controlledCopyBatchRecallAsyncService.retryFailedItems(batchId, currentUser.getId(), batch.getRecallReason(), batch.getRecallDate());
    }

    /**
     * Re-triggers async processing for only the FAILED items of a batch's most recent cancel job.
     */
    @Transactional(readOnly = true)
    public void retryFailedCancel(UUID batchId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        controlledCopyAuthorizationService.requireRetryControlledCopyBatchAction(currentUser, batch, com.eqms.enums.ControlledCopyWorkflowAction.CANCEL_REQUEST);
        controlledCopyBatchCancelAsyncService.retryFailedItems(batchId, currentUser.getId(), batch.getDistributionComment());
    }

    /**
     * Rolls a controlled copy back to "Ready for Distribution" after its background
     * processing step (see {@link #finalizeDistributedCopy}) failed after retries,
     * so the batch can be retried instead of leaving the copy in a stuck state.
     */
    @Transactional
    public void markDistributedCopyProcessingFailed(UUID copyId, UUID issuerUserId, String message) {
        if (copyId == null) {
            return;
        }
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId).orElse(null);
        if (copy == null) {
            return;
        }
        if (isTerminalControlledCopyStatus(copy.getStatusCode())) {
            // A concurrent lifecycle action (Obsolete/Cancel) already moved this copy to a terminal
            // state -- never "restore" it back to Ready for Distribution.
            return;
        }
        UserAccount issuer = resolveIssuerOrSystemActor(issuerUserId);
        // Truthful from-status: distributeControlledCopyBatch() had already moved this copy to
        // Distributed; the async post-processing (PDF compose + recipient e-mail) then failed after
        // retries, so it is rolled back here. There is no "Processing" lifecycle state -- recording
        // the real transition (Distributed -> Ready for Distribution) is what tells a reviewer the
        // copy was NOT actually delivered and the batch needs a retry.
        String rolledBackFrom = firstNonBlank(copy.getStatus(), STATUS_DISTRIBUTED);
        setControlledCopyStatus(copy, STATUS_READY_FOR_DISTRIBUTION);
        copy.setCurrentStage("Ready for Distribution");
        controlledCopyRepository.save(copy);
        auditTrailService.logAs(issuer, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(),
                "DISTRIBUTE_PROCESSING_FAILED", rolledBackFrom, "Ready for Distribution",
                StringUtils.hasText(message) ? message : "Controlled copy batch distribution processing failed.",
                List.of(), null);
    }

    /**
     * Resolves the actor for background/async processing audit entries. Falls back to the reserved
     * SYSTEM account (V413) when the original issuer's account can no longer be found (e.g. deleted
     * between request and async completion), so the state change is never left without an audit
     * trail entry and is never mis-attributed to a real human.
     */
    private UserAccount resolveIssuerOrSystemActor(UUID issuerUserId) {
        UserAccount issuer = issuerUserId == null ? null : userAccountRepository.findById(issuerUserId).orElse(null);
        if (issuer != null) {
            return issuer;
        }
        // The original issuer's account is gone (renamed/deleted between request and async
        // completion). Attribute the state change to the reserved SYSTEM account (V413) so the
        // audit trail still records a real, unambiguous "who" -- never null, never a human who
        // did not perform this.
        return systemActorProvider.get();
    }

    @Transactional
    public ControlledCopyListItemResponse markAsPrinted(UUID id, ControlledCopyPrintRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(id);
        controlledCopyAuthorizationService.requirePrintControlledCopy(currentUser, copy);
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy print confirmation");
        if (controlledCopyRepository.consumePrint(copy.getId(), policy.isPrintOnce()) == 0) {
            throw new AccessDeniedException("Print limit reached for this controlled copy.");
        }
        copy.setPrintedBy(currentUser);
        copy.setPrintedAt(parseInstant(request == null ? null : request.printedAt(), Instant.now()));
        copy.setCurrentStage("Ready for Distribution");
        // Flush now so an optimistic-lock conflict surfaces here, before the notification below.
        controlledCopyRepository.saveAndFlush(copy);
        auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "PRINT", null, copy.getStatus(), "Controlled copy marked as printed", List.of(), signatureSessionId);
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), currentUser.getId(), "PRINT", "Controlled copy marked as printed", null));
        return toResponse(copy, false);
    }

    @Transactional
    public ControlledCopyListItemResponse distribute(UUID id, ControlledCopyDistributeRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(id);
        controlledCopyAuthorizationService.requireDistributeControlledCopy(currentUser, copy);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy distribution");
        String distributionComment = normalize(request == null ? null : request.comment());
        if (!StringUtils.hasText(distributionComment)) {
            throw new IllegalArgumentException("Comments are required when distributing a controlled copy");
        }
        Instant distributedAt = parseInstant(request == null ? null : request.distributedAt(), Instant.now());
        anchorExpiryToDistributionIfNeeded(copy, distributedAt);
        ensureControlledCopyNotExpired(copy, distributedAt);
        if ("ELECTRONIC".equals(copy.getDeliveryMode())) {
            // Every scanned OnlyOffice Role on the Form's fillable template must have a signer
            // assigned before this copy can go out -- otherwise the Fill/Sign chain has no one to
            // hand off to partway through.
            eformSignerAssignmentService.requireFullyAssignedOrThrow(copy.getId());
        }
        setControlledCopyStatus(copy, STATUS_DISTRIBUTED);
        copy.setCurrentStage("Distributed");
        copy.setDistributedBy(currentUser);
        copy.setDistributedAt(distributedAt);
        // External copies have no internal login account -- the recipient is only an e-mail
        // address (externalRecipients). Never look one up by name/e-mail here: if that address
        // happens to match an unrelated internal user's account (e.g. a test user sharing an
        // e-mail), the copy would get silently hijacked to that internal user's identity/inbox.
        UserAccount recipientUser = isExternalDistribution(copy)
                ? null
                : resolveOptionalUserReference(
                request == null ? null : request.distributedTo(),
                copy.getRecipientName()
        );
        if (recipientUser != null) {
            copy.setRecipientUser(recipientUser);
            copy.setRecipientName(recipientUser.getFullName());
        } else {
            copy.setRecipientName(normalize(firstNonBlank(
                    request == null ? null : request.distributedTo(),
                    copy.getRecipientName(),
                    copy.getDistributionList(),
                    copy.getLocation()
            )));
        }
        if (!StringUtils.hasText(copy.getAccessToken())) {
            copy.setAccessToken(generateAccessToken());
            copy.setAccessTokenIssuedAt(Instant.now());
        }
        String previewPassword = issuePreviewPassword(copy);
        copy.setDistributionComment(distributionComment);
        copy.setRecipientDate(LocalDate.now(SYSTEM_ZONE));
        if (StringUtils.hasText(request == null ? null : request.location())) {
            copy.setLocation(request.location().trim());
        }
        copy.setCustomPlaceholderValues(sanitizeCustomPlaceholderValues(request == null ? null : request.customPlaceholderValues()));
        applyComposedControlledCopyPlaceholders(copy);
        // Flush now (not just save()) so an optimistic-lock conflict on this copy surfaces here --
        // before the e-mail further below is dispatched -- rather than only at this transaction's
        // commit, after that side-effect already ran and can no longer be undone.
        controlledCopyRepository.saveAndFlush(copy);
        electronicSignatureService.createEntitySignature("ControlledCopyRecord", copy.getId(), copy.getControlledCopyNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_DISTRIBUTED", distributionComment, null, "Ready for Distribution", "Distributed");
        auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "DISTRIBUTE", "Ready for Distribution", "Distributed", distributionComment, List.of(), signatureSessionId);
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), currentUser.getId(), "DISTRIBUTE", distributionComment, previewPassword));
        return toResponse(copy, false);
    }

    @Transactional
    public ControlledCopyListItemResponse destroy(UUID id, ControlledCopyDestroyRequest request) {
        return destroy(id, request, List.of());
    }

    /**
     * Report a distributed controlled copy as Lost/Damaged. Authorization is enforced up-front
     * via {@link ControlledCopyAuthorizationService#requireReportLostDamaged} before any file or
     * repository interaction, so a denial has zero side effects.
     */
    @Transactional
    public ControlledCopyListItemResponse reportLostDamaged(UUID id, ControlledCopyDestroyRequest request, List<MultipartFile> evidenceFiles) {
        ControlledCopyRecord copy = requireControlledCopy(id);
        UserAccount currentUser = currentUserService.requireCurrentUser();
        controlledCopyAuthorizationService.requireReportLostDamaged(currentUser, copy);
        return destroy(id, request, evidenceFiles);
    }

    @Transactional
    public ControlledCopyListItemResponse destroy(UUID id, ControlledCopyDestroyRequest request, List<MultipartFile> evidenceFiles) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (controlledCopyDistributionBatchRepository.existsById(id)) {
            throw new IllegalArgumentException("Report Lost/Damaged is only available for a single controlled copy record.");
        }
        ControlledCopyRecord copy = requireControlledCopy(id);
        // Sole authorization gate for this action: object-scoped policy resolves the required
        // permission dynamically (same code the report-lost/damaged capability endpoint checks),
        // so there is exactly one source of truth for whether this call is allowed.
        controlledCopyAuthorizationService.requireReportLostDamaged(currentUser, copy);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy destruction");
        if (!STATUS_DISTRIBUTED.equalsIgnoreCase(copy.getStatusCode()) && !"Distributed".equalsIgnoreCase(copy.getCurrentStage())) {
            throw new IllegalArgumentException("Report Lost/Damaged is only available for distributed controlled copies.");
        }
        String fromStatus = copy.getCurrentStage();
        List<MultipartFile> files = evidenceFiles == null ? List.of() : evidenceFiles.stream().filter(file -> file != null && !file.isEmpty()).toList();
        String destructionType = normalize(request == null ? null : request.destructionType());
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        if (("Damaged".equalsIgnoreCase(destructionType) || "Lost".equalsIgnoreCase(destructionType)) && !policy.isAllowReportLostDamaged()) {
            throw new AccessDeniedException("Reporting lost or damaged copies is disabled by the Controlled Copies Policy.");
        }
        if ("Damaged".equalsIgnoreCase(destructionType) && files.isEmpty()) {
            throw new IllegalArgumentException("At least one evidence file is required for damaged controlled copies");
        }
        UserAccount destroyedByUser = resolveUserReference(request == null ? null : request.destroyedByUserId(), request == null ? null : request.destroyedBy(), currentUser);
        UserAccount witnessUser = resolveOptionalUserReference(request == null ? null : request.witnessedByUserId(), request == null ? null : request.witnessedBy());
        if (destroyedByUser != null && witnessUser != null && destroyedByUser.getId().equals(witnessUser.getId())) {
            throw new IllegalArgumentException("Executor and witness must be different users");
        }
        Instant destroyedAt = parseInstant(request == null ? null : request.destroyedAt(), Instant.now());
        // Independent of the client-side check -- a client-only guard is not a control. A future
        // timestamp on a destruction/loss event is an audit-trail integrity issue regardless of how
        // it got past the UI.
        if (destroyedAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Destruction date cannot be in the future");
        }
        setControlledCopyStatus(copy, STATUS_OBSOLETED);
        copy.setCurrentStage("Obsoleted");
        String obsoleteReason = resolveDestroyObsoleteReason(destructionType);
        copy.setObsoleteReason(obsoleteReason);
        copy.setDestroyedBy(destroyedByUser == null ? currentUser : destroyedByUser);
        copy.setDestroyedAt(destroyedAt);
        copy.setObsoletedBy(currentUser);
        copy.setObsoletedAt(Instant.now());
        copy.setDestroyReason(normalize(request == null ? null : request.destroyReason()));
        copy.setDestructionMethod(normalize(request == null ? null : request.destructionMethod()));
        copy.setDestructionType(destructionType);
        copy.setWitnessedBy(witnessUser == null ? normalize(request == null ? null : request.witnessedBy()) : witnessUser.getFullName());
        storeEvidenceFiles(copy, files, currentUser);
        // Flush now so an optimistic-lock conflict surfaces here, before the notification below.
        controlledCopyRepository.saveAndFlush(copy);
        String actionType = resolveDestroyAuditAction(obsoleteReason);
        String auditComment = buildDestroyAuditComment(copy, files.size());
        electronicSignatureService.createEntitySignature("ControlledCopyRecord", copy.getId(), copy.getControlledCopyNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_DESTROYED", copy.getDestroyReason(), null, fromStatus, "Obsoleted");
        auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), actionType, fromStatus, "Obsoleted", auditComment, List.of(), signatureSessionId);
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), currentUser.getId(), actionType, auditComment, null));
        controlledCopyBatchStatusService.synchronize(copy);
        return toResponse(copy, true);
    }

    /**
     * Reissues a brand-new controlled copy for the same recipient after the original was
     * reported Lost/Damaged. Authorization (including the Controlled Copies Policy toggle and
     * the "must currently be Obsoleted with a Lost/Damaged reason" invariant) is enforced by
     * {@link ControlledCopyAuthorizationService#requireReplaceLostDamaged}.
     */
    @Transactional
    public ControlledCopyListItemResponse replaceLostDamaged(UUID id, ControlledCopyReplaceRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord original = requireControlledCopy(id);
        controlledCopyAuthorizationService.requireReplaceLostDamaged(currentUser, original);
        // The Obsoleted + Lost/Damaged invariant checked above stays true forever after the first
        // replacement (nothing about `original` changes when a replacement is issued), so without
        // this guard a double-click, retry, or two people acting on the same lost/damaged copy would
        // each pass authorization and mint a separate replacement -- multiple controlled copies loose
        // in the field for what should be exactly one lost/damaged original.
        if (controlledCopyRepository.findTopByReplacedControlledCopy_IdOrderByRequestedAtDesc(original.getId()).isPresent()) {
            throw new IllegalArgumentException("This controlled copy has already been replaced.");
        }
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy replacement");

        DocumentRevisionRecord revision = original.getRevision();
        byte[] publishedPdf = requirePublishedPdfBytes(revision);
        long documentSequenceSeed = nextDocumentControlledCopySequence(original.getDocument());
        String reason = normalize(request == null ? null : request.reason());

        ControlledCopyDistributionBatch batch = createDistributionBatch(
                original.getDocument(),
                revision,
                currentUser,
                1,
                original.getDistributionList(),
                original.getDistributionMode(),
                original.getDistributionScope(),
                original.getLocation(),
                original.getLocationCode(),
                original.getExternalRecipients(),
                StringUtils.hasText(reason)
                        ? "Replacement for " + original.getControlledCopyNumber() + ": " + reason
                        : "Replacement for " + original.getControlledCopyNumber(),
                Boolean.TRUE.equals(original.getHasExpiryDate()),
                original.getExpiryDate(),
                // A Lost/Damaged replacement always inherits the original's already-fixed expiry
                // exactly, never recomputed at this replacement's own Distribute time.
                false
        );

        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(original.getDocument());
        copy.setRevision(revision);
        copy.setDistributionBatch(batch);
        copy.setReplacedControlledCopy(original);
        copy.setControlledCopyNumber(nextControlledCopyNumber(revision, documentSequenceSeed));
        copy.setCopyNumber(nextCopyNumberForRevision(revision));
        copy.setTotalCopies(1);
        copy.setDocumentNumber(original.getDocumentNumber());
        copy.setDocumentTitle(original.getDocumentTitle());
        copy.setRevisionNumber(original.getRevisionNumber());
        copy.setBusinessUnitName(original.getBusinessUnitName());
        copy.setDepartmentName(original.getDepartmentName());
        copy.setDistributionList(original.getDistributionList());
        copy.setDistributionMode(original.getDistributionMode());
        copy.setDistributionScope(original.getDistributionScope());
        copy.setLocation(original.getLocation());
        copy.setLocationCode(original.getLocationCode());
        copy.setRequestReason(StringUtils.hasText(reason)
                ? "Replacement for " + original.getControlledCopyNumber() + ": " + reason
                : "Replacement for " + original.getControlledCopyNumber());
        copy.setExternalRecipients(original.getExternalRecipients());
        copy.setRecipientUser(original.getRecipientUser());
        copy.setRecipientName(original.getRecipientName());
        copy.setAccessToken(generateAccessToken());
        copy.setAccessTokenIssuedAt(Instant.now());
        setControlledCopyStatus(copy, STATUS_READY_FOR_DISTRIBUTION);
        copy.setCurrentStage("Ready for Distribution");
        copy.setRequestedBy(currentUser);
        copy.setRequestedAt(Instant.now());
        copy.setValidUntil(revision.getValidUntil());
        copy.setEffectiveDate(revision.getEffectiveDate());
        copy.setHasExpiryDate(original.getHasExpiryDate());
        copy.setExpiryDate(original.getExpiryDate());
        storeControlledCopyPublishedPdf(copy, publishedPdf);
        // Flush now so an optimistic-lock conflict surfaces here, before the notification below.
        // Also where the true-concurrency case of the duplicate-replacement guard above actually
        // gets enforced: the up-front SELECT closes the common (sequential) double-submit, but two
        // truly simultaneous requests could both pass it before either commits -- the unique index
        // on replaced_controlled_copy_id (V410) is what makes the loser fail here instead of
        // silently minting a second replacement.
        try {
            controlledCopyRepository.saveAndFlush(copy);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new IllegalArgumentException("This controlled copy has already been replaced.");
        }

        String auditComment = "Replacement controlled copy " + copy.getControlledCopyNumber()
                + " issued for " + original.getControlledCopyNumber()
                + (StringUtils.hasText(reason) ? "; Reason: " + reason : "");
        electronicSignatureService.createEntitySignature("ControlledCopyRecord", copy.getId(), copy.getControlledCopyNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_REISSUED", reason, null, original.getStatus(), copy.getStatus());
        auditTrailService.logAs(
                currentUser,
                "Controlled Copy",
                copy.getControlledCopyNumber(),
                copy.getId(),
                "REPLACE_LOST_DAMAGED",
                original.getStatus(),
                copy.getStatus(),
                auditComment,
                List.of(),
                signatureSessionId
        );
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), currentUser.getId(), "REPLACE_LOST_DAMAGED", auditComment, null));
        return toResponse(copy, true);
    }

    @Transactional
    public ControlledCopyListItemResponse recall(UUID id, ControlledCopyRecallRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(id);
        controlledCopyAuthorizationService.requireRecallControlledCopy(currentUser, copy);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy recall");
        ensureCanRecall(copy.getCurrentStage(), copy.getStatusCode(), "controlled copy");
        String fromStatus = copy.getCurrentStage();
        setControlledCopyStatus(copy, STATUS_OBSOLETED);
        copy.setCurrentStage("Obsoleted");
        copy.setObsoleteReason(OBSOLETE_REASON_RECALLED);
        copy.setRecalledBy(currentUser);
        Instant recalledAt = parseInstant(request == null ? null : request.recallDate(), Instant.now());
        copy.setRecalledAt(recalledAt);
        copy.setObsoletedBy(currentUser);
        copy.setObsoletedAt(recalledAt);
        copy.setRecallReason(normalize(request == null ? null : request.recallReason()));
        if (!StringUtils.hasText(copy.getRecallReason())) {
            throw new IllegalArgumentException("Reason for recall is required.");
        }
        // Flush now so an optimistic-lock conflict surfaces here, before the notification below.
        controlledCopyRepository.saveAndFlush(copy);
        String auditComment = buildControlledCopyRecordActionComment(copy, "RECALL", firstNonBlank(copy.getRecallReason(), request == null ? null : request.comment()));
        electronicSignatureService.createEntitySignature("ControlledCopyRecord", copy.getId(), copy.getControlledCopyNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_RECALLED", copy.getRecallReason(), null, fromStatus, "Obsoleted");
        auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "RECALL", fromStatus, "Obsoleted", auditComment, List.of(), signatureSessionId);
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), currentUser.getId(), "RECALL", auditComment, null));
        controlledCopyBatchStatusService.synchronize(copy);
        return toResponse(copy, false);
    }

    /**
     * System-driven closure of the Controlled Copy register once the form it was issued for has
     * actually been completed and recorded as an {@code ExecutedRecord} -- reuses the exact same
     * Recall/Obsoleted status machinery {@link #recall} uses, mirroring the already-proven
     * "system closes a copy without a human e-signature" pattern live in
     * {@code ControlledCopyExpiryProcessingService#obsoleteExpiredCopy}. No
     * {@code createEntitySignature} call here: the GxP-significant fact is already signed on the
     * ExecutedRecord itself (RECORD_LOGGED / EFORM_SUBMITTED); this closure is a system-driven
     * consequence, not a separately-attested act -- also sidesteps the signature-token single-use
     * collision a second signature on the same token would hit. {@code actor} may be a real user
     * (the paper path, where a human just signed the ExecutedRecord) or the system actor (the
     * electronic path, where the last signer's own signature already covers the GxP event).
     */
    @Transactional
    public void closeAfterExecutedRecord(UUID controlledCopyId, UserAccount actor, String reason) {
        ControlledCopyRecord copy = requireControlledCopy(controlledCopyId);
        ensureCanRecall(copy.getCurrentStage(), copy.getStatusCode(), "controlled copy");
        String fromStatus = copy.getCurrentStage();
        Instant now = Instant.now();
        setControlledCopyStatus(copy, STATUS_OBSOLETED);
        copy.setCurrentStage("Obsoleted");
        copy.setObsoleteReason(OBSOLETE_REASON_RECALLED);
        copy.setRecalledBy(actor);
        copy.setRecalledAt(now);
        copy.setObsoletedBy(actor);
        copy.setObsoletedAt(now);
        copy.setRecallReason(normalize(reason));
        controlledCopyRepository.saveAndFlush(copy);
        String auditComment = buildControlledCopyRecordActionComment(copy, "RECALL", reason);
        auditTrailService.logAs(actor, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(),
                "RECALL", fromStatus, "Obsoleted", auditComment, List.of(), null);
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), actor.getId(), "RECALL", auditComment, null));
        controlledCopyBatchStatusService.synchronize(copy);
    }

    @Transactional
    public ControlledCopyListItemResponse cancel(UUID id, ControlledCopyCancelRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(id);
        controlledCopyAuthorizationService.requireCancelControlledCopy(currentUser, copy);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy cancellation");
        ensureCanCancel(copy.getCurrentStage(), copy.getStatusCode(), "controlled copy");
        String fromStatus = copy.getCurrentStage();
        setControlledCopyStatus(copy, STATUS_CLOSED_CANCELLED);
        copy.setCurrentStage("Closed - Cancelled");
        copy.setObsoleteReason(null);
        copy.setCancelledBy(currentUser);
        copy.setCancelledAt(Instant.now());
        copy.setRequestReason(normalize(firstNonBlank(copy.getRequestReason(), request == null ? null : request.reason())));
        // Flush now so an optimistic-lock conflict surfaces here, before the notification below.
        controlledCopyRepository.saveAndFlush(copy);
        String auditComment = buildControlledCopyRecordActionComment(copy, "CANCEL", request == null ? null : request.reason());
        electronicSignatureService.createEntitySignature("ControlledCopyRecord", copy.getId(), copy.getControlledCopyNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_DISTRIBUTION_CANCELLED", copy.getRequestReason(), null, fromStatus, "Closed - Cancelled");
        auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "CANCEL", fromStatus, "Closed - Cancelled", auditComment, List.of(), signatureSessionId);
        // Notified only after this transaction commits -- see ControlledCopyActionNotificationEvent.
        eventPublisher.publishEvent(new ControlledCopyActionNotificationEvent(copy.getId(), currentUser.getId(), "CANCEL", auditComment, null));
        controlledCopyBatchStatusService.synchronize(copy);
        return toResponse(copy, false);
    }

    @Transactional
    public ControlledCopyDistributionBatchSummaryResponse cancelBatch(UUID batchId, ControlledCopyCancelRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        controlledCopyAuthorizationService.requireCancelControlledCopy(currentUser, batch);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy batch cancellation");
        ensureCanCancel(batch.getStatus(), batch.getStatusCode(), "controlled copy batch");
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batchId);
        if (copies.isEmpty()) {
            throw new IllegalArgumentException("Controlled copy distribution batch has no copy records");
        }

        String cancellationReason = normalize(firstNonBlank(batch.getRequestReason(), request == null ? null : request.reason()));
        String fromStatus = batch.getStatus();
        batch.setStatusCode(STATUS_CLOSED_CANCELLED);
        batch.setStatus("Closed - Cancelled");
        batch.setDistributionComment(cancellationReason);

        // Distributed copies can never be cancelled (use Recall/Destroy instead) — pre-filter
        // them out rather than aborting the whole batch, so the copies that ARE eligible still
        // get cancelled even when the batch is a mix of statuses.
        List<ControlledCopyRecord> eligibleCopies = copies.stream()
                .filter(copy -> !STATUS_DISTRIBUTED.equalsIgnoreCase(normalizeControlledCopyStatusCode(copy.getStatusCode())))
                .toList();

        controlledCopyDistributionBatchRepository.save(batch);
        String batchAuditComment = buildControlledCopyBatchActionComment(batch, "CANCEL", cancellationReason);
        electronicSignatureService.createEntitySignature("ControlledCopyDistributionBatch", batch.getId(), batch.getBatchNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_DISTRIBUTION_CANCELLED", cancellationReason, null, fromStatus, "Closed - Cancelled");
        auditTrailService.logAs(currentUser, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "CANCEL", fromStatus, "Closed - Cancelled", batchAuditComment, List.of(), signatureSessionId);
        // Per-copy stakeholder notification (including each copy's actual recipient) is sent from
        // finalizeCancelledCopy() below, once a copy is actually cancelled -- not here. Notifying
        // eagerly for the whole (unfiltered) `copies` list would (a) tell a Distributed copy's
        // recipient their copy was cancelled when it wasn't (ineligible, excluded above), and
        // (b) tell every recipient "cancelled" before knowing whether their specific copy's async
        // finalize step actually succeeds.

        // Per-copy cancel (status flip + individual audit log) runs async, per copy, with
        // retry/progress tracking — mirrors distributeBatch()/recallBatch()'s job/event pattern.
        // Job is always created (even with 0 eligible items, e.g. every copy already Distributed)
        // so job-status polling never 404s into a stuck progress modal.
        ControlledCopyDistributionJob cancelJob = controlledCopyDistributionJobService.create(batch, currentUser, eligibleCopies, "CANCEL");
        eventPublisher.publishEvent(new ControlledCopyBatchCancelledEvent(
                batch.getId(), cancelJob.getId(), eligibleCopies.stream().map(ControlledCopyRecord::getId).toList(),
                currentUser.getId(), cancellationReason
        ));
        return toBatchSummaryResponse(batch);
    }

    /**
     * Per-copy cancel mutation used by the async batch-cancel processing step
     * (see {@link ControlledCopyBatchCancelAsyncService}). Never throws -- the caller inspects the
     * returned {@link ControlledCopyFinalizationOutcome} and marks the item FAILED/SKIPPED
     * accordingly, so one bad copy never blocks the rest of the batch. A Distributed copy always
     * fails here (by design — Distributed copies can never be cancelled) and is reported to the
     * user as such via the item's error message rather than a hard batch-wide rejection.
     */
    @Transactional
    public ControlledCopyFinalizationOutcome finalizeCancelledCopy(UUID copyId, UUID issuerUserId, String cancellationReason) {
        if (copyId == null) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId).orElse(null);
        if (copy == null) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        // A concurrent lifecycle action (e.g. the source Revision/Document being Obsoleted, which
        // cascades to every non-terminal copy including Ready-for-Distribution ones) may have
        // already moved this copy to a terminal state while it sat waiting for this async step.
        // Blindly proceeding would overwrite that outcome's status/obsoleteReason with "Cancelled"
        // -- corrupting the audit trail about why the copy actually became invalid.
        if (isTerminalControlledCopyStatus(copy.getStatusCode())) {
            return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
        }
        if (STATUS_DISTRIBUTED.equalsIgnoreCase(normalizeControlledCopyStatusCode(copy.getStatusCode()))) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        try {
            UserAccount issuer = resolveIssuerOrSystemActor(issuerUserId);
            String fromStatus = copy.getCurrentStage();
            setControlledCopyStatus(copy, STATUS_CLOSED_CANCELLED);
            copy.setCurrentStage("Closed - Cancelled");
            copy.setObsoleteReason(null);
            copy.setCancelledBy(issuer);
            copy.setCancelledAt(Instant.now());
            copy.setRequestReason(firstNonBlank(copy.getRequestReason(), cancellationReason));
            // Flush now (not just save()) so an optimistic-lock conflict with a concurrent action on
            // this same copy surfaces here -- before the notification below is dispatched -- rather
            // than only at this transaction's commit, after the e-mail side-effect already ran.
            controlledCopyRepository.saveAndFlush(copy);
            String auditComment = buildControlledCopyRecordActionComment(copy, "CANCEL", cancellationReason);
            auditTrailService.logAs(issuer, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "CANCEL", fromStatus, "Closed - Cancelled", auditComment, List.of(), null);
            // No per-copy notification here (deliberately -- see notifyBatchCancelled()): this
            // runs once per member copy, and per-copy notifying used to fire the SAME "your batch
            // was cancelled" e-mail/in-app message once for EACH copy in the batch -- a batch of 5
            // sent the actor 5 near-identical notifications. ControlledCopyBatchCancelAsyncService
            // sends exactly one consolidated notification after every copy has been processed.
            return ControlledCopyFinalizationOutcome.SUCCESS;
        } catch (org.springframework.dao.OptimisticLockingFailureException conflictEx) {
            // Same reasoning as finalizeDistributedCopy(): the version conflict surfaces only at
            // this method's own transactional-proxy boundary, i.e. after it already returned/rolled
            // back -- re-check in a fresh read to learn whether a concurrent action actually won by
            // moving the copy to a terminal state (not a real failure) or something else conflicted.
            if (isControlledCopyInTerminalState(copyId)) {
                return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
            }
            log.warn("Optimistic lock conflict cancelling controlled copy {} as part of batch cancel processing.", copyId, conflictEx);
            return ControlledCopyFinalizationOutcome.FAILED;
        } catch (Exception ex) {
            log.warn("Failed to cancel controlled copy {} as part of batch cancel processing.", copyId, ex);
            return ControlledCopyFinalizationOutcome.FAILED;
        }
    }

    @Transactional
    public ControlledCopyDistributionBatchSummaryResponse recallBatch(UUID batchId, ControlledCopyRecallRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyDistributionBatch batch = requireDistributionBatch(batchId);
        controlledCopyAuthorizationService.requireRecallControlledCopy(currentUser, batch);
        UUID signatureSessionId = requireValidSignatureToken(request == null ? null : request.signatureToken(), currentUser, "controlled copy batch recall");
        ensureCanRecall(batch.getStatus(), batch.getStatusCode(), "controlled copy batch");
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batchId);
        if (copies.isEmpty()) {
            throw new IllegalArgumentException("Controlled copy distribution batch has no copy records");
        }

        String recallReason = normalize(request == null ? null : request.recallReason());
        if (!StringUtils.hasText(recallReason)) {
            throw new IllegalArgumentException("Reason for recall is required.");
        }
        String fromStatus = batch.getStatus();
        batch.setStatusCode(STATUS_OBSOLETED);
        batch.setStatus("Obsoleted");
        batch.setDistributionComment(recallReason);

        Instant recalledAt = parseInstant(request == null ? null : request.recallDate(), Instant.now());
        batch.setRecallDate(recalledAt);
        batch.setRecallReason(recallReason);
        List<ControlledCopyRecord> eligibleCopies = copies.stream()
                .filter(copy -> {
                    String copyStatus = normalizeControlledCopyStatusCode(firstNonBlank(copy.getStatusCode(), copy.getCurrentStage()));
                    return STATUS_DISTRIBUTED.equalsIgnoreCase(copyStatus) || STATUS_OBSOLETED.equalsIgnoreCase(copyStatus);
                })
                .toList();

        controlledCopyDistributionBatchRepository.save(batch);
        String batchAuditComment = buildControlledCopyBatchActionComment(batch, "RECALL", recallReason);
        electronicSignatureService.createEntitySignature("ControlledCopyDistributionBatch", batch.getId(), batch.getBatchNumber(), currentUser, request == null ? null : request.signatureToken(), "CONTROLLED_COPY_RECALLED", recallReason, null, fromStatus, "Obsoleted");
        auditTrailService.logAs(currentUser, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "RECALL", fromStatus, "Obsoleted", batchAuditComment, List.of(), signatureSessionId);
        // Per-copy stakeholder notification (including each copy's actual recipient) is sent from
        // finalizeRecalledCopy() below, once a copy is actually recalled -- see cancelBatch()'s
        // matching comment above for why notifying eagerly here is wrong.

        // Per-copy recall (status flip + individual audit log) runs async, per copy, with
        // retry/progress tracking — mirrors distributeBatch()'s job/event pattern so a large
        // batch never blocks this request and one bad copy never blocks the rest. The job is
        // always created (even with 0 eligible items) so the frontend's job-status polling never
        // 404s into an indefinitely "stuck" progress modal for the rare edge case where every
        // child copy has already drifted out of an eligible status.
        ControlledCopyDistributionJob recallJob = controlledCopyDistributionJobService.create(batch, currentUser, eligibleCopies, "RECALL");
        eventPublisher.publishEvent(new ControlledCopyBatchRecalledEvent(
                batch.getId(), recallJob.getId(), eligibleCopies.stream().map(ControlledCopyRecord::getId).toList(),
                currentUser.getId(), recallReason, recalledAt
        ));
        return toBatchSummaryResponse(batch);
    }

    /**
     * Per-copy recall mutation used by the async batch-recall processing step
     * (see {@link ControlledCopyBatchRecallAsyncService}). Never throws -- the caller inspects the
     * returned {@link ControlledCopyFinalizationOutcome} and marks the item FAILED/SKIPPED
     * accordingly, so one bad copy never blocks the rest of the batch.
     */
    @Transactional
    public ControlledCopyFinalizationOutcome finalizeRecalledCopy(UUID copyId, UUID issuerUserId, String recallReason, Instant recalledAt) {
        if (copyId == null) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        ControlledCopyRecord copy = controlledCopyRepository.findById(copyId).orElse(null);
        if (copy == null) {
            return ControlledCopyFinalizationOutcome.FAILED;
        }
        // recallBatch() intentionally snapshots Distributed OR already-Obsoleted copies as
        // eligible, so OBSOLETED alone isn't a reliable "concurrent action already handled this"
        // signal here (unlike Distribute/Cancel, where reaching a terminal state is never expected
        // going in). Only skip when the copy is unambiguously not this recall's to finalize:
        // Closed/Cancelled can never legitimately arrive here, and an OBSOLETED copy whose reason
        // is something OTHER than "Recalled" was made invalid by a different, unrelated action
        // (e.g. its Revision/Document being Obsoleted concurrently) -- overwriting that reason with
        // "Recalled" would corrupt the audit trail about why the copy actually became invalid.
        String currentStatus = normalizeControlledCopyStatusCode(copy.getStatusCode());
        if (STATUS_CLOSED_CANCELLED.equalsIgnoreCase(currentStatus)) {
            return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
        }
        if (STATUS_OBSOLETED.equalsIgnoreCase(currentStatus) && !OBSOLETE_REASON_RECALLED.equalsIgnoreCase(copy.getObsoleteReason())) {
            return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
        }
        try {
            UserAccount issuer = resolveIssuerOrSystemActor(issuerUserId);
            String fromStatus = copy.getCurrentStage();
            setControlledCopyStatus(copy, STATUS_OBSOLETED);
            copy.setCurrentStage("Obsoleted");
            copy.setObsoleteReason(OBSOLETE_REASON_RECALLED);
            copy.setRecalledBy(issuer);
            copy.setRecalledAt(recalledAt);
            copy.setObsoletedBy(issuer);
            copy.setObsoletedAt(recalledAt);
            copy.setRecallReason(firstNonBlank(copy.getRecallReason(), recallReason));
            // Flush now (not just save()) so an optimistic-lock conflict with a concurrent action on
            // this same copy surfaces here -- before the notification below is dispatched -- rather
            // than only at this transaction's commit, after the e-mail side-effect already ran.
            controlledCopyRepository.saveAndFlush(copy);
            String auditComment = buildControlledCopyRecordActionComment(copy, "RECALL", recallReason);
            auditTrailService.logAs(issuer, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "RECALL", fromStatus, "Obsoleted", auditComment, List.of(), null);
            // Per-copy notification (covers this copy's own recipient, distributor, requester, etc.)
            // only fires once the copy is actually recalled -- never eagerly for the whole batch.
            notifyControlledCopyStakeholders(copy, issuer, "RECALL", auditComment);
            return ControlledCopyFinalizationOutcome.SUCCESS;
        } catch (org.springframework.dao.OptimisticLockingFailureException conflictEx) {
            // Same reasoning as finalizeDistributedCopy()/finalizeCancelledCopy(): the version
            // conflict surfaces only at this method's own transactional-proxy boundary -- re-check
            // in a fresh read to learn whether a concurrent action actually won by moving the copy
            // to a terminal state (not a real failure) or something else conflicted.
            if (isControlledCopyInTerminalState(copyId)) {
                return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
            }
            log.warn("Optimistic lock conflict recalling controlled copy {} as part of batch recall processing.", copyId, conflictEx);
            return ControlledCopyFinalizationOutcome.FAILED;
        } catch (Exception ex) {
            log.warn("Failed to recall controlled copy {} as part of batch recall processing.", copyId, ex);
            return ControlledCopyFinalizationOutcome.FAILED;
        }
    }

    private void ensureCanCancel(String currentStage, String statusCode, String targetLabel) {
        if (!STATUS_READY_FOR_DISTRIBUTION.equalsIgnoreCase(normalizeControlledCopyStatusCode(firstNonBlank(statusCode, currentStage)))) {
            throw new IllegalStateException(targetLabel + " can only be cancelled while it is Ready for Distribution");
        }
    }

    private void ensureCanRecall(String currentStage, String statusCode, String targetLabel) {
        String status = normalizeControlledCopyStatusCode(firstNonBlank(statusCode, currentStage));
        if (!STATUS_DISTRIBUTED.equalsIgnoreCase(status) && !STATUS_OBSOLETED.equalsIgnoreCase(status)) {
            throw new IllegalStateException(targetLabel + " can only be recalled while it is Distributed or Obsoleted");
        }
    }

    private String buildControlledCopyDownloadFileName(ControlledCopyRecord copy) {
        String baseName = firstNonBlank(
                copy == null ? null : copy.getControlledCopyNumber(),
                copy == null ? null : copy.getDocumentNumber(),
                "controlled-copy"
        );
        return baseName.replaceAll("\\s+", "_") + ".pdf";
    }

    private String resolveDestroyObsoleteReason(String destructionType) {
        String normalized = normalize(destructionType);
        if ("LOST".equalsIgnoreCase(normalized)) {
            return OBSOLETE_REASON_LOST;
        }
        if ("DAMAGED".equalsIgnoreCase(normalized)) {
            return OBSOLETE_REASON_DAMAGED;
        }
        return OBSOLETE_REASON_DESTROYED;
    }

    private String resolveDestroyAuditAction(String obsoleteReason) {
        if (OBSOLETE_REASON_LOST.equalsIgnoreCase(obsoleteReason)) {
            return "REPORT_LOST";
        }
        if (OBSOLETE_REASON_DAMAGED.equalsIgnoreCase(obsoleteReason)) {
            return "REPORT_DAMAGED";
        }
        return "DESTROY";
    }

    private ControlledCopyDistributionBatch createDistributionBatch(
            DocumentRecord document,
            DocumentRevisionRecord revision,
            UserAccount currentUser,
            int quantity,
            String distributionList,
            String distributionMode,
            String distributionScope,
            String location,
            String locationCode,
            String externalRecipients,
            String requestReason,
            boolean hasExpiryDate,
            Instant expiryDate,
            boolean expiryAnchoredToDistribution
    ) {
        ControlledCopyDistributionBatch batch = new ControlledCopyDistributionBatch();
        batch.setId(UUID.randomUUID());
        batch.setBatchNumber(nextDistributionBatchNumber(document, revision, quantity));
        batch.setDocument(document);
        batch.setRevision(revision);
        batch.setDocumentNumber(document == null ? null : document.getDocumentNumber());
        batch.setDocumentTitle(document == null ? null : document.getDocumentName());
        batch.setRevisionNumber(revision == null ? null : revision.getRevisionNumber());
        batch.setQuantity(quantity);
        batch.setStatusCode(STATUS_READY_FOR_DISTRIBUTION);
        batch.setStatus(controlledCopyStatusLabel(STATUS_READY_FOR_DISTRIBUTION));
        batch.setDistributionList(distributionList);
        batch.setDistributionMode(distributionMode == null ? null : distributionMode.toUpperCase(Locale.ROOT));
        batch.setDistributionScope(distributionScope);
        batch.setLocation(location);
        batch.setLocationCode(locationCode);
        batch.setExternalRecipients(externalRecipients);
        batch.setRequestReason(requestReason);
        batch.setHasExpiryDate(hasExpiryDate);
        batch.setExpiryDate(expiryDate);
        batch.setExpiryAnchoredToDistribution(expiryAnchoredToDistribution);
        batch.setRequestedBy(currentUser);
        batch.setRequestedAt(Instant.now());
        return controlledCopyDistributionBatchRepository.save(batch);
    }

    private ControlledCopyDistributionBatch requireDistributionBatch(UUID batchId) {
        return controlledCopyDistributionBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy distribution batch not found"));
    }

    private String nextDistributionBatchNumber(DocumentRecord document, DocumentRevisionRecord revision, int quantity) {
        String documentNumber = firstNonBlank(
                document == null ? null : document.getDocumentNumber(),
                revision == null ? null : revision.getDocumentNumber()
        );
        String normalizedDocumentNumber = normalizeControlledCopyBaseCode(documentNumber);
        if (StringUtils.hasText(normalizedDocumentNumber)) {
            long batchSequence = nextDocumentControlledCopyBatchSequence(document, normalizedDocumentNumber);
            return "CCB."
                    + normalizedDocumentNumber
                    + ".B"
                    + String.format(Locale.ROOT, "%03d", batchSequence);
        }
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?1)")
                .setParameter(1, 0x4343425F46414C4CL)
                .getSingleResult();
        long count = controlledCopyDistributionBatchRepository.count() + 1;
        return "CCB." + String.format(Locale.ROOT, "%06d", count) + ".B001";
    }

    private long nextDocumentControlledCopyBatchSequence(DocumentRecord document, String normalizedDocumentNumber) {
        String prefix = "CCB." + normalizeControlledCopyBaseCode(normalizedDocumentNumber) + ".B";
        // Batch numbers are human-visible identifiers and must remain unique when
        // two requests for the same document arrive concurrently.  The surrounding
        // request transaction holds this PostgreSQL advisory lock until commit,
        // serializing sequence calculation without introducing a database-specific
        // sequence per document.
        long lockKey = document != null && document.getId() != null
                ? document.getId().getMostSignificantBits()
                    ^ document.getId().getLeastSignificantBits()
                    ^ 0x4343425F42415443L
                : Integer.toUnsignedLong(("CCB_BATCH:" + prefix).hashCode());
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?1)")
                .setParameter(1, lockKey)
                .getSingleResult();
        Stream<ControlledCopyDistributionBatch> batchStream = (document != null && document.getId() != null
                ? controlledCopyDistributionBatchRepository.findAllByDocument_Id(document.getId())
                : controlledCopyDistributionBatchRepository.findAllByBatchNumberStartingWith(prefix))
                .stream();
        return batchStream
                .map(ControlledCopyDistributionBatch::getBatchNumber)
                .mapToLong(batchNumber -> extractDistributionBatchSequence(batchNumber, prefix))
                .max()
                .orElse(0L) + 1L;
    }

    private long extractDistributionBatchSequence(String batchNumber, String prefix) {
        if (!StringUtils.hasText(batchNumber) || !batchNumber.startsWith(prefix)) {
            return 0L;
        }
        try {
            return Long.parseLong(batchNumber.substring(prefix.length()));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private ControlledCopyDistributionBatchSummaryResponse toBatchSummaryResponse(ControlledCopyDistributionBatch batch) {
        return toBatchSummaryResponse(batch, true);
    }

    /**
     * List endpoints intentionally avoid materialising each batch's children.
     * A batch can represent a large departmental distribution, so loading the
     * child register to render every parent row creates an N+1 database query
     * pattern and puts an arbitrary ceiling on a paged response.
     */
    private ControlledCopyDistributionBatchSummaryResponse toBatchSummaryResponse(
            ControlledCopyDistributionBatch batch,
            boolean includeCopyIds
    ) {
        UUID batchId = batch == null ? null : batch.getId();
        long persistedQuantity = batchId == null ? 0 : controlledCopyRepository.countByDistributionBatch_Id(batchId);
        int quantity = batch == null || batch.getQuantity() <= 0
                ? Math.toIntExact(persistedQuantity)
                : batch.getQuantity();
        int readyCount = batchId == null ? 0 : Math.toIntExact(
                controlledCopyRepository.countByDistributionBatch_IdAndStatusCode(batchId, STATUS_READY_FOR_DISTRIBUTION));
        int distributedCount = batchId == null ? 0 : Math.toIntExact(
                controlledCopyRepository.countByDistributionBatch_IdAndStatusCode(batchId, STATUS_DISTRIBUTED));
        ControlledCopyRecord firstCopy = batchId == null
                ? null
                : controlledCopyRepository.findTopByDistributionBatch_IdOrderByCopyNumberAsc(batchId).orElse(null);
        List<ControlledCopyRecord> allCopiesForBatch = includeCopyIds && batchId != null
                ? controlledCopyRepository.findAllByDistributionBatch_IdOrderByCopyNumberAsc(batchId)
                : List.of();
        List<String> copyIds = allCopiesForBatch.stream()
                .map(ControlledCopyRecord::getId)
                .filter(java.util.Objects::nonNull)
                .map(UUID::toString)
                .toList();
        // A batch distributed to multiple departments/business units at once (locationIds is a
        // list at request time) can have member copies that don't all share one value -- show the
        // shared value when every copy agrees, "Multiple" when they genuinely differ, null when
        // none has one. Only computed when the member copies were already loaded above (detail
        // view); list rows don't show Business Unit/Department, so no extra query for that case.
        String batchBusinessUnitName = distinctBatchFieldValue(allCopiesForBatch, ControlledCopyRecord::getBusinessUnitName);
        String batchDepartmentName = distinctBatchFieldValue(allCopiesForBatch, ControlledCopyRecord::getDepartmentName);
        // Keep the actual child controlled-copy number in the API response.  The
        // distribution batch number is a separate identifier and is only the
        // user-facing number when the request contains multiple copies.
        String controlledCopyNumber = firstCopy == null ? null : firstCopy.getControlledCopyNumber();
        String documentId = batch == null || batch.getDocument() == null || batch.getDocument().getId() == null
                ? null
                : batch.getDocument().getId().toString();
        String documentNumber = batch == null ? null : batch.getDocumentNumber();
        String documentTitle = stripControlledCopySuffix(firstNonBlank(
                batch == null ? null : batch.getDocumentTitle(),
                batch == null || batch.getRevision() == null ? null : batch.getRevision().getDocumentName()
        ));
        String batchScope = batch == null ? null : batch.getDistributionScope();
        boolean isSingleton = quantity == 1 && firstCopy != null;
        String persistedRecipientNames = isSingleton ? firstCopy.getRecipientName() : null;
        String displayDistributionList = firstNonBlank(
                "business-unit".equalsIgnoreCase(batchScope) || "department".equalsIgnoreCase(batchScope)
                        ? (batch == null ? null : batch.getDistributionList())
                        : "external".equalsIgnoreCase(batchScope) ? "External"
                        : "individual".equalsIgnoreCase(batchScope) && !isSingleton ? "Individual"
                        : persistedRecipientNames,
                batch == null ? null : batch.getDistributionList());
        String distributionRecipients = buildDistributionRecipients(
                batch == null ? null : batch.getDistributionMode(),
                displayDistributionList,
                batch == null ? null : batch.getExternalRecipients()
        );
        String documentDisplayLabel = buildDocumentDisplayName(
                documentNumber,
                documentTitle
        );
        // A singleton batch (exactly one copy) is driven end-to-end by the single-copy
        // distribute/recall/cancel/destroy endpoints, which only ever mutate the child
        // ControlledCopyRecord — never the parent batch's own requestedAt/distributedAt/
        // expiryDate/recallDate fields. Falling back to the one real copy's values here keeps
        // this list-facing summary accurate instead of showing "-" for data that does exist.
        Instant effectiveExpiryDate = batch != null && batch.getExpiryDate() != null
                ? batch.getExpiryDate() : (isSingleton ? firstCopy.getExpiryDate() : null);
        Boolean effectiveHasExpiryDate = batch != null && batch.getHasExpiryDate() != null
                ? batch.getHasExpiryDate() : (isSingleton ? firstCopy.getHasExpiryDate() : null);
        UserAccount effectiveRequestedBy = batch != null && batch.getRequestedBy() != null
                ? batch.getRequestedBy() : (isSingleton ? firstCopy.getRequestedBy() : null);
        Instant effectiveRequestedAt = batch != null && batch.getRequestedAt() != null
                ? batch.getRequestedAt() : (isSingleton ? firstCopy.getRequestedAt() : null);
        UserAccount effectiveDistributedBy = batch != null && batch.getDistributedBy() != null
                ? batch.getDistributedBy() : (isSingleton ? firstCopy.getDistributedBy() : null);
        Instant effectiveDistributedAt = batch != null && batch.getDistributedAt() != null
                ? batch.getDistributedAt() : (isSingleton ? firstCopy.getDistributedAt() : null);
        Instant effectiveRecallDate = batch != null && batch.getRecallDate() != null
                ? batch.getRecallDate() : (isSingleton ? firstCopy.getRecalledAt() : null);
        String effectiveRecallReason = batch != null && StringUtils.hasText(batch.getRecallReason())
                ? batch.getRecallReason() : (isSingleton ? firstCopy.getRecallReason() : null);
        // The batch row's own updatedAt covers batch-level actions and any member action that
        // flips the aggregated batch status; for a singleton the child copy is the source of
        // truth for single-copy actions, so take whichever is more recent.
        Instant batchUpdatedAt = batch == null ? null : batch.getUpdatedAt();
        Instant firstCopyUpdatedAt = isSingleton ? firstCopy.getUpdatedAt() : null;
        Instant effectiveLastUpdatedAt = batchUpdatedAt == null ? firstCopyUpdatedAt
                : firstCopyUpdatedAt == null ? batchUpdatedAt
                : (firstCopyUpdatedAt.isAfter(batchUpdatedAt) ? firstCopyUpdatedAt : batchUpdatedAt);
        return new ControlledCopyDistributionBatchSummaryResponse(
                batch == null || batch.getId() == null ? null : batch.getId().toString(),
                batch == null ? null : batch.getBatchNumber(),
                controlledCopyNumber,
                isSingleton
                        ? buildControlledCopyName(documentTitle, batch == null ? null : batch.getRevisionNumber(), firstCopy.getCopyNumber())
                        : buildControlledCopyBatchName(documentTitle, batch == null ? null : batch.getRevisionNumber()),
                // Distinct from controlledCopyName above (which always ends with "Controlled Copy N"/
                // a batch quantity suffix) -- this is just "<document title>_<revision>", matching the
                // per-copy list response's own revisionName so the FE's "Document Revision" column
                // never has to fall back to reusing the Controlled Copy Name column's value.
                buildRevisionName(documentTitle, batch == null ? null : batch.getRevisionNumber()),
                firstCopy == null || firstCopy.getId() == null ? null : firstCopy.getId().toString(),
                documentId,
                documentNumber,
                documentTitle,
                documentDisplayLabel,
                batch == null ? null : batch.getRevisionNumber(),
                batch == null || batch.getRevision() == null || batch.getRevision().getId() == null ? null : batch.getRevision().getId().toString(),
                batch == null || batch.getRevision() == null ? null : DateTimeFormatUtils.formatDate(batch.getRevision().getValidUntil()),
                // A policy-derived expiry is only computed at distribution time (see
                // anchorExpiryToDistributionIfNeeded); before that the stored value is a placeholder,
                // so it is not shown while the batch is still Ready for Distribution.
                effectiveExpiryDate == null || (effectiveDistributedAt == null && Boolean.TRUE.equals(batch == null
                        ? (isSingleton ? firstCopy.getExpiryAnchoredToDistribution() : null)
                        : batch.getExpiryAnchoredToDistribution()))
                        ? null : DateTimeFormatUtils.formatDateTime(effectiveExpiryDate),
                effectiveHasExpiryDate,
                quantity,
                readyCount,
                distributedCount,
                batch == null ? null : batch.getStatus(),
                batch == null ? null : batch.getStatusCode(),
                displayDistributionList,
                batch == null ? null : batch.getDistributionMode(),
                distributionRecipients,
                batch == null ? null : batch.getDistributionScope(),
                batch == null ? null : batch.getLocation(),
                batch == null ? null : batch.getLocationCode(),
                batch == null ? null : batch.getExternalRecipients(),
                effectiveRequestedBy == null ? null : effectiveRequestedBy.getFullName(),
                effectiveRequestedAt == null ? null : DateTimeFormatUtils.formatDateTime(effectiveRequestedAt),
                effectiveDistributedBy == null ? null : effectiveDistributedBy.getFullName(),
                effectiveDistributedAt == null ? null : DateTimeFormatUtils.formatDateTime(effectiveDistributedAt),
                effectiveRecallDate == null ? null : DateTimeFormatUtils.formatDateTime(effectiveRecallDate),
                effectiveRecallReason,
                batchBusinessUnitName,
                batchDepartmentName,
                copyIds,
                effectiveLastUpdatedAt == null ? null : DateTimeFormatUtils.formatDateTime(effectiveLastUpdatedAt)
        );
    }

    private String distinctBatchFieldValue(List<ControlledCopyRecord> copies, java.util.function.Function<ControlledCopyRecord, String> extractor) {
        java.util.Set<String> distinctValues = copies.stream()
                .map(extractor)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        if (distinctValues.isEmpty()) {
            return null;
        }
        return distinctValues.size() == 1 ? distinctValues.iterator().next() : "Multiple";
    }

    private boolean matchesBatchSearch(ControlledCopyDistributionBatch batch, String search) {
        if (!StringUtils.hasText(search) || batch == null) {
            return true;
        }
        String pattern = search.trim().toLowerCase(Locale.ROOT);
        return contains(batch.getBatchNumber(), pattern)
                || contains(batch.getDocumentNumber(), pattern)
                || contains(batch.getDocumentTitle(), pattern)
                || contains(batch.getRevisionNumber(), pattern)
                || contains(batch.getDistributionList(), pattern)
                || contains(batch.getLocation(), pattern)
                || contains(batch.getRequestedBy() == null ? null : batch.getRequestedBy().getFullName(), pattern)
                || contains(batch.getDistributedBy() == null ? null : batch.getDistributedBy().getFullName(), pattern);
    }

    private boolean matchesBatchStatus(ControlledCopyDistributionBatch batch, String status) {
        if (!StringUtils.hasText(status) || "All".equalsIgnoreCase(status) || batch == null) {
            return true;
        }
        String normalized = normalizeControlledCopyStatusCode(status);
        return normalized.equalsIgnoreCase(batch.getStatusCode())
                || normalized.equalsIgnoreCase(normalizeControlledCopyStatusCode(batch.getStatus()))
                || status.trim().equalsIgnoreCase(batch.getStatus())
                || status.trim().equalsIgnoreCase(batch.getStatusCode());
    }

    private boolean matchesBatchDocument(ControlledCopyDistributionBatch batch, String documentId) {
        if (!StringUtils.hasText(documentId) || "All".equalsIgnoreCase(documentId) || batch == null) {
            return true;
        }
        String trimmed = documentId.trim();
        return trimmed.equalsIgnoreCase(batch.getDocumentNumber())
                || (batch.getDocument() != null && batch.getDocument().getId() != null && trimmed.equalsIgnoreCase(batch.getDocument().getId().toString()))
                || (batch.getRevision() != null && batch.getRevision().getDocument() != null && batch.getRevision().getDocument().getId() != null && trimmed.equalsIgnoreCase(batch.getRevision().getDocument().getId().toString()));
    }

    private boolean matchesBatchDateRange(ControlledCopyDistributionBatch batch, String createdFrom, String createdTo, String validFrom, String validTo, String expiryFrom, String expiryTo, String recallFrom, String recallTo) {
        if (batch == null) {
            return false;
        }
        boolean createdMatches = matchesInstantRange(batch.getRequestedAt(), createdFrom, createdTo);
        boolean validMatches = matchesLocalDateRange(batch.getRevision() == null ? null : batch.getRevision().getValidUntil(), validFrom, validTo);
        boolean expiryMatches = matchesInstantRange(batch.getExpiryDate(), expiryFrom, expiryTo);
        boolean recallMatches = matchesInstantRange(batch.getRecallDate(), recallFrom, recallTo);
        return createdMatches && validMatches && expiryMatches && recallMatches;
    }

    private boolean matchesInstantRange(Instant value, String from, String to) {
        if (value == null) {
            return !StringUtils.hasText(from) && !StringUtils.hasText(to);
        }
        if (StringUtils.hasText(from)) {
            LocalDate fromDate = parseDate(from);
            if (fromDate != null && value.isBefore(fromDate.atStartOfDay(SYSTEM_ZONE).toInstant())) {
                return false;
            }
        }
        if (StringUtils.hasText(to)) {
            LocalDate toDate = parseDate(to);
            if (toDate != null && !value.isBefore(toDate.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant())) {
                return false;
            }
        }
        return true;
    }

    private boolean matchesLocalDateRange(LocalDate value, String from, String to) {
        if (value == null) {
            return !StringUtils.hasText(from) && !StringUtils.hasText(to);
        }
        if (StringUtils.hasText(from)) {
            LocalDate fromDate = parseDate(from);
            if (fromDate != null && value.isBefore(fromDate)) {
                return false;
            }
        }
        if (StringUtils.hasText(to)) {
            LocalDate toDate = parseDate(to);
            if (toDate != null && value.isAfter(toDate)) {
                return false;
            }
        }
        return true;
    }

    private Comparator<ControlledCopyDistributionBatch> resolveBatchComparator(String sortBy, String sortDirection) {
        Comparator<ControlledCopyDistributionBatch> comparator = switch (Optional.ofNullable(sortBy).orElse("created").toLowerCase(Locale.ROOT)) {
            case "controlledcopynumber", "batchnumber" -> Comparator.comparing(batch -> normalizeForSort(batch.getBatchNumber()));
            case "documentnumber" -> Comparator.comparing(batch -> normalizeForSort(batch.getDocumentNumber()));
            case "name", "documentname" -> Comparator.comparing(batch -> normalizeForSort(batch.getDocumentTitle()));
            case "status" -> Comparator.comparing(batch -> normalizeForSort(batch.getStatusCode() == null ? batch.getStatus() : batch.getStatusCode()));
            case "validuntil" -> Comparator.comparing(batch -> batch.getRevision() == null ? null : batch.getRevision().getValidUntil(), Comparator.nullsLast(Comparator.naturalOrder()));
            case "document" -> Comparator.comparing(batch -> normalizeForSort(batch.getDocumentNumber()));
            case "distributionlist" -> Comparator.comparing(batch -> normalizeForSort(batch.getDistributionList()));
            case "openedby" -> Comparator.comparing(batch -> normalizeForSort(batch.getRequestedBy() == null ? null : batch.getRequestedBy().getFullName()));
            case "revisionnumber", "version" -> Comparator.comparing(batch -> normalizeForSort(batch.getRevisionNumber()));
            case "lastupdated", "lastupdatedat", "updated", "updatedat" -> Comparator.comparing(ControlledCopyDistributionBatch::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> Comparator.comparing(ControlledCopyDistributionBatch::getRequestedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
        if ("desc".equalsIgnoreCase(sortDirection)) {
            comparator = comparator.reversed();
        }
        return comparator.thenComparing(ControlledCopyDistributionBatch::getRequestedAt, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    private boolean contains(String value, String pattern) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(pattern);
    }

    private boolean canViewControlledCopy(UserAccount currentUser, ControlledCopyRecord copy) {
        if (copy == null) {
            return false;
        }
        if (documentAuthorizationService.canAccessControlledCopy(currentUser, copy.getRevision())) {
            return true;
        }
        if (currentUser == null || currentUser.getId() == null) {
            return false;
        }
        if (copy.getRecipientUser() != null && currentUser.getId().equals(copy.getRecipientUser().getId())) {
            return true;
        }
        if (matchesUserReference(currentUser, copy.getRecipientName())) {
            return true;
        }
        return currentUser.getId().equals(optionalUserId(copy.getRequestedBy()))
                || currentUser.getId().equals(optionalUserId(copy.getApprovedBy()))
                || currentUser.getId().equals(optionalUserId(copy.getPrintedBy()))
                || currentUser.getId().equals(optionalUserId(copy.getDistributedBy()))
                || currentUser.getId().equals(optionalUserId(copy.getRecalledBy()))
                || currentUser.getId().equals(optionalUserId(copy.getDestroyedBy()))
                || currentUser.getId().equals(optionalUserId(copy.getCancelledBy()))
                || currentUser.getId().equals(optionalUserId(copy.getObsoletedBy()));
    }

    private boolean matchesUserReference(UserAccount user, String reference) {
        if (user == null || user.getId() == null || !StringUtils.hasText(reference)) {
            return false;
        }
        String normalizedReference = reference.trim();
        return (user.getFullName() != null && normalizedReference.equalsIgnoreCase(user.getFullName()))
                || (user.getUsername() != null && normalizedReference.equalsIgnoreCase(user.getUsername()))
                || (user.getEmail() != null && normalizedReference.equalsIgnoreCase(user.getEmail()));
    }

    private UUID optionalUserId(UserAccount user) {
        return user == null ? null : user.getId();
    }

    private void requirePermission(UserAccount currentUser, String permissionCode, String message) {
        if (!permissionEvaluationService.hasPermission(currentUser, permissionCode)) {
            throw new AccessDeniedException(message);
        }
    }

    private ControlledCopyRecord requireControlledCopy(UUID id) {
        return controlledCopyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy not found"));
    }

    private ControlledCopyRecord requireControlledCopyForDetail(UUID id) {
        return controlledCopyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Controlled copy not found"));
    }

    private DocumentRecord resolveDocument(String documentIdOrNumber) {
        if (!StringUtils.hasText(documentIdOrNumber)) {
            throw new IllegalArgumentException("Document identifier is required");
        }
        String trimmed = documentIdOrNumber.trim();
        try {
            UUID documentId = UUID.fromString(trimmed);
            return documentRecordRepository.findById(documentId)
                    .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        } catch (IllegalArgumentException ignored) {
            return documentRecordRepository.findByDocumentNumber(trimmed)
                    .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        }
    }

    private DocumentRevisionRecord requireEffectiveRevision(DocumentRecord document) {
        return documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")
                .orElseThrow(() -> new IllegalArgumentException("Controlled copies can only be requested for an effective revision"));
    }

    private int normalizeCopyCount(ControlledCopyRequestCreateRequest request) {
        int requested = Optional.ofNullable(request == null ? null : request.quantity())
                .orElse(Optional.ofNullable(request == null ? null : request.copies()).orElse(1));
        return Math.min(Math.max(requested, 1), 50);
    }

    private String resolveDistributionScope(ControlledCopyRequestCreateRequest request, String distributionMode) {
        if (!"internal".equalsIgnoreCase(distributionMode) || request == null || request.locationIds() == null || request.locationIds().isEmpty()) {
            return null;
        }
        return request.distributionScope() != null ? request.distributionScope() : (request.locationIds().size() > 1 ? "multiple" : "single");
    }

    private String resolveLocationCode(ControlledCopyRequestCreateRequest request) {
        if (request == null || request.locationIds() == null || request.locationIds().isEmpty()) {
            return null;
        }
        return request.locationIds().get(0);
    }

    private String nextControlledCopyNumber(DocumentRevisionRecord revision, long sequence) {
        String documentNumber = firstNonBlank(
                revision == null ? null : revision.getDocumentNumber(),
                revision == null || revision.getDocument() == null ? null : revision.getDocument().getDocumentNumber()
        );
        String normalizedDocumentNumber = normalizeControlledCopyBaseCode(documentNumber);
        if (StringUtils.hasText(normalizedDocumentNumber)) {
            long candidateSequence = Math.max(sequence, 1);
            while (candidateSequence <= 999L) {
                String candidate = "CC."
                        + normalizedDocumentNumber
                        + "."
                        + String.format(Locale.ROOT, "%03d", candidateSequence);
                if (controlledCopyRepository.findByControlledCopyNumber(candidate).isEmpty()) {
                    return candidate;
                }
                candidateSequence++;
            }
        }
        long count = controlledCopyRepository.countByCreatedAtIsNotNull() + Math.max(sequence, 1);
        return "CC." + String.format(Locale.ROOT, "%06d", count);
    }

    /**
     * The display copy number ("Controlled Copy N") must stay unique per revision across every
     * request AND every reissue — otherwise a later request or a reissue of a lost/damaged copy
     * would collide with an earlier "Controlled Copy 1" for the same revision, even though its
     * own controlledCopyNumber (CC.xxx.NNN) is unique. Continue from the highest copyNumber ever
     * assigned for this revision instead of restarting at 1 for each new batch/reissue.
     */
    private int nextCopyNumberForRevision(DocumentRevisionRecord revision) {
        if (revision == null || revision.getId() == null) {
            return 1;
        }
        // Serialize allocation per revision so two concurrent requests/reissues can never
        // compute the same "next" copyNumber. Held for the lifetime of the caller's
        // transaction (pg_advisory_xact_lock auto-releases on commit/rollback).
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(?1)")
                .setParameter(1, revision.getId().getMostSignificantBits())
                .getSingleResult();
        return controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(revision.getId()).stream()
                .map(ControlledCopyRecord::getCopyNumber)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private long nextDocumentControlledCopySequence(DocumentRecord document) {
        if (document == null || document.getId() == null) {
            return controlledCopyRepository.countByCreatedAtIsNotNull() + 1;
        }
        return controlledCopyRepository.findAllByRevision_Document_IdOrderByCreatedAtDesc(document.getId()).stream()
                .map(ControlledCopyRecord::getControlledCopyNumber)
                .mapToLong(this::extractControlledCopySequence)
                .max()
                .orElse(0L) + 1L;
    }

    private long extractControlledCopySequence(String controlledCopyNumber) {
        if (!StringUtils.hasText(controlledCopyNumber)) {
            return 0L;
        }
        String[] segments = controlledCopyNumber.trim().split("\\.");
        if (segments.length == 0) {
            return 0L;
        }
        try {
            return Long.parseLong(segments[segments.length - 1]);
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private String normalizeCodeSegment(String value) {
        return StringUtils.hasText(value) ? value.trim().replace('-', '.') : "";
    }

    private String normalizeControlledCopyBaseCode(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        List<String> segments = Arrays.stream(value.trim().split("[.\\-_\\s]+"))
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(segment -> !"EXT".equalsIgnoreCase(segment))
                .toList();
        return String.join(".", segments);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private UUID parseUuidOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(value.trim(), DMY_DATE);
            } catch (DateTimeParseException ex) {
                return null;
            }
        }
    }

    private Specification<ControlledCopyRecord> buildSpecification(
            String search,
            String status,
            String department,
            String documentId,
            String createdFrom,
            String createdTo,
            String validFrom,
            String validTo,
            String expiryFrom,
            String expiryTo,
            String recallFrom,
            String recallTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<ControlledCopyRecord, DocumentRecord> documentJoin = root.join("document", JoinType.LEFT);
            Join<ControlledCopyRecord, DocumentRevisionRecord> revisionJoin = root.join("revision", JoinType.LEFT);
            Join<ControlledCopyRecord, UserAccount> requestedByJoin = root.join("requestedBy", JoinType.LEFT);
            Join<ControlledCopyRecord, UserAccount> printedByJoin = root.join("printedBy", JoinType.LEFT);
            Join<ControlledCopyRecord, UserAccount> distributedByJoin = root.join("distributedBy", JoinType.LEFT);
            Join<ControlledCopyRecord, UserAccount> recalledByJoin = root.join("recalledBy", JoinType.LEFT);
            Join<ControlledCopyRecord, UserAccount> destroyedByJoin = root.join("destroyedBy", JoinType.LEFT);

            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("controlledCopyNumber")), pattern),
                        cb.like(cb.lower(root.get("documentNumber")), pattern),
                        cb.like(cb.lower(root.get("documentTitle")), pattern),
                        cb.like(cb.lower(root.get("revisionNumber")), pattern),
                        cb.like(cb.lower(root.get("distributionList")), pattern),
                        cb.like(cb.lower(root.get("location")), pattern),
                        cb.like(cb.lower(root.get("recipientName")), pattern),
                        cb.like(cb.lower(root.get("departmentName")), pattern),
                        cb.like(cb.lower(requestedByJoin.get("fullName")), pattern),
                        cb.like(cb.lower(printedByJoin.get("fullName")), pattern),
                        cb.like(cb.lower(distributedByJoin.get("fullName")), pattern),
                        cb.like(cb.lower(recalledByJoin.get("fullName")), pattern),
                        cb.like(cb.lower(destroyedByJoin.get("fullName")), pattern),
                        cb.like(cb.lower(documentJoin.get("documentName")), pattern)
                ));
            }

            if (StringUtils.hasText(status) && !"All".equalsIgnoreCase(status)) {
                String normalizedStatus = normalizeStatusFilter(status);
                predicates.add(cb.or(
                        cb.equal(cb.lower(root.get("statusCode")), normalizedStatus),
                        cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase(Locale.ROOT)),
                        cb.equal(cb.lower(root.get("status")), status.trim().replace("_", " ").replace("-", " ").toLowerCase(Locale.ROOT))
                ));
            }
            if (StringUtils.hasText(department) && !"All".equalsIgnoreCase(department)) {
                predicates.add(cb.equal(cb.lower(root.get("departmentName")), department.trim().toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(documentId) && !"All".equalsIgnoreCase(documentId)) {
                String trimmedDocumentId = documentId.trim();
                List<Predicate> documentPredicates = new ArrayList<>();
                documentPredicates.add(cb.equal(cb.lower(root.get("documentNumber")), trimmedDocumentId.toLowerCase(Locale.ROOT)));

                UUID parsedDocumentId = parseUuidOrNull(trimmedDocumentId);
                if (parsedDocumentId != null) {
                    documentPredicates.add(cb.equal(documentJoin.get("id"), parsedDocumentId));
                    documentPredicates.add(cb.equal(revisionJoin.get("document").get("id"), parsedDocumentId));
                }

                predicates.add(cb.or(documentPredicates.toArray(Predicate[]::new)));
            }
            addInstantDateRangePredicate(predicates, cb, root.get("createdAt"), createdFrom, createdTo);
            addDateRangePredicate(predicates, cb, root.get("validUntil"), validFrom, validTo);
            addInstantDateRangePredicate(predicates, cb, root.get("expiryDate"), expiryFrom, expiryTo);
            addInstantDateRangePredicate(predicates, cb, root.get("recalledAt"), recallFrom, recallTo);
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /**
     * Database-level mirror of {@link #canViewControlledCopy(UserAccount, ControlledCopyRecord)},
     * used so the list endpoint can filter+paginate in SQL instead of loading every filter-matched
     * row into memory to authorize row-by-row. This is a literal translation of that method's
     * conditions — not a redesign — to minimize the risk of the two diverging. If
     * {@link DocumentAuthorizationService#canViewAllDocuments} is true, no restriction is added
     * (matches the "return true immediately" branch in the Java version). Keep both in sync by
     * hand; there is deliberately no shared implementation because one is a Java predicate over a
     * loaded entity and the other is a JPA Criteria predicate translated to SQL.
     */
    private Specification<ControlledCopyRecord> buildAuthorizationSpecification(UserAccount currentUser) {
        if (documentAuthorizationService.canViewAllDocuments(currentUser)) {
            return (root, query, cb) -> cb.conjunction();
        }
        UUID userId = currentUser.getId();
        boolean strictEligible = documentAuthorizationService.isStrictViewEligible(currentUser);
        String fullName = currentUser.getFullName();
        String username = currentUser.getUsername();
        String email = currentUser.getEmail();

        return (root, query, cb) -> {
            Join<ControlledCopyRecord, DocumentRevisionRecord> revisionJoin = root.join("revision", JoinType.LEFT);
            List<Predicate> allowed = new ArrayList<>();

            // Author of the revision.
            allowed.add(cb.equal(revisionJoin.get("author").get("id"), userId));

            // Co-author / reviewer / approver participant on the revision.
            Subquery<Long> participantSubquery = query.subquery(Long.class);
            Root<RevisionWorkflowParticipant> participantRoot = participantSubquery.from(RevisionWorkflowParticipant.class);
            participantSubquery.select(cb.literal(1L)).where(
                    cb.equal(participantRoot.get("revision").get("id"), revisionJoin.get("id")),
                    participantRoot.get("participantType").in("CO_AUTHOR", "REVIEWER", "APPROVER"),
                    cb.equal(participantRoot.get("user").get("id"), userId)
            );
            allowed.add(cb.exists(participantSubquery));

            // Strict-view rule: broad view permission grants visibility of terminal-status revisions.
            if (strictEligible) {
                allowed.add(revisionJoin.get("status").get("code").in("EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED"));
            }

            // Controlled-copy-specific actor references (recipient, requester, or anyone who
            // performed a lifecycle action on this exact copy).
            allowed.add(cb.equal(root.get("recipientUser").get("id"), userId));
            if (StringUtils.hasText(fullName)) {
                allowed.add(cb.equal(cb.lower(root.get("recipientName")), fullName.trim().toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(username)) {
                allowed.add(cb.equal(cb.lower(root.get("recipientName")), username.trim().toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(email)) {
                allowed.add(cb.equal(cb.lower(root.get("recipientName")), email.trim().toLowerCase(Locale.ROOT)));
            }
            for (String actorField : List.of("requestedBy", "approvedBy", "printedBy", "distributedBy", "recalledBy", "destroyedBy", "cancelledBy", "obsoletedBy")) {
                allowed.add(cb.equal(root.get(actorField).get("id"), userId));
            }

            return cb.or(allowed.toArray(Predicate[]::new));
        };
    }

    private Comparator<ControlledCopyRecord> resolveComparator(String sortBy, String sortDirection) {
        Comparator<ControlledCopyRecord> comparator = switch (Optional.ofNullable(sortBy).orElse("created").toLowerCase(Locale.ROOT)) {
            case "controlledcopynumber" -> Comparator.comparing(copy -> normalizeForSort(copy.getControlledCopyNumber()));
            case "documentnumber" -> Comparator.comparing(copy -> normalizeForSort(copy.getDocumentNumber()));
            case "name", "documentname" -> Comparator.comparing(copy -> normalizeForSort(copy.getDocumentTitle()));
            case "status" -> Comparator.comparing(copy -> normalizeForSort(copy.getStatusCode() == null ? copy.getStatus() : copy.getStatusCode()));
            case "validuntil" -> Comparator.comparing(ControlledCopyRecord::getValidUntil, Comparator.nullsLast(Comparator.naturalOrder()));
            case "document" -> Comparator.comparing(copy -> normalizeForSort(copy.getDocumentNumber()));
            case "distributionlist" -> Comparator.comparing(copy -> normalizeForSort(copy.getDistributionList()));
            case "openedby" -> Comparator.comparing(copy -> normalizeForSort(copy.getRequestedBy() == null ? null : copy.getRequestedBy().getFullName()));
            case "revisionnumber", "version" -> Comparator.comparing(copy -> normalizeForSort(copy.getRevisionNumber()));
            case "revisionname" -> Comparator.comparing(copy -> copy.getRevision() == null ? "" : normalizeForSort(copy.getRevision().getRevisionName()));
            default -> Comparator.comparing(ControlledCopyRecord::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
        if ("desc".equalsIgnoreCase(sortDirection)) {
            comparator = comparator.reversed();
        }
        return comparator.thenComparing(ControlledCopyRecord::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    private String normalizeForSort(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private void setControlledCopyStatus(ControlledCopyRecord copy, String statusCode) {
        String normalizedCode = normalizeControlledCopyStatusCode(statusCode);
        copy.setStatusCode(normalizedCode);
        copy.setStatus(controlledCopyStatusDefinitionRepository.findById(normalizedCode)
                .map(status -> StringUtils.hasText(status.getLabel()) ? status.getLabel() : normalizedCode)
                .orElseGet(() -> controlledCopyStatusLabel(normalizedCode)));
    }

    private String normalizeStatusFilter(String status) {
        return normalizeControlledCopyStatusCode(status).toLowerCase(Locale.ROOT);
    }

    private String normalizeControlledCopyStatusCode(String status) {
        if (!StringUtils.hasText(status)) {
            return STATUS_READY_FOR_DISTRIBUTION;
        }
        String normalized = status.trim()
                .replace("-", " ")
                .replace("_", " ")
                .replaceAll("\\s+", " ")
                .toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "READY FOR DISTRIBUTION", "READY FOR DISTRIBUTE" -> STATUS_READY_FOR_DISTRIBUTION;
            case "DISTRIBUTED" -> STATUS_DISTRIBUTED;
            case "OBSOLETE", "OBSOLETED", "RECALLED", "LOST", "DAMAGED", "DESTROYED" -> STATUS_OBSOLETED;
            case "CLOSED CANCELLED", "CANCELLED", "CLOSED" -> STATUS_CLOSED_CANCELLED;
            default -> status.trim().toUpperCase(Locale.ROOT);
        };
    }

    private String controlledCopyStatusLabel(String statusCode) {
        return switch (normalizeControlledCopyStatusCode(statusCode)) {
            case STATUS_DISTRIBUTED -> "Distributed";
            case STATUS_OBSOLETED -> "Obsoleted";
            case STATUS_CLOSED_CANCELLED -> "Closed - Cancelled";
            default -> "Ready for Distribution";
        };
    }

    private String formatCreated(String createdDate, String createdTime) {
        if (!StringUtils.hasText(createdDate)) {
            return "";
        }
        return StringUtils.hasText(createdTime) ? createdDate + " " + createdTime : createdDate;
    }

    private String csv(String value) {
        return com.eqms.util.CsvSafety.escapeCell(value);
    }

    private void addInstantDateRangePredicate(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<Instant> field,
            String from,
            String to
    ) {
        if (StringUtils.hasText(from)) {
            LocalDate fromDate = parseDate(from);
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(field, fromDate.atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
        }
        if (StringUtils.hasText(to)) {
            LocalDate toDate = parseDate(to);
            if (toDate != null) {
                predicates.add(cb.lessThan(field, toDate.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant()));
            }
        }
    }

    private void addDateRangePredicate(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<LocalDate> field,
            String from,
            String to
    ) {
        if (StringUtils.hasText(from)) {
            LocalDate fromDate = parseDate(from);
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(field, fromDate));
            }
        }
        if (StringUtils.hasText(to)) {
            LocalDate toDate = parseDate(to);
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(field, toDate));
            }
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private Instant parseInstant(String value, Instant fallback) {
        if (!StringUtils.hasText(value)) {
            return fallback;
        }
        String trimmed = value.trim();
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ignored) {
            try {
                if (trimmed.length() >= 16 && trimmed.charAt(4) == '-' && trimmed.charAt(7) == '-') {
                    return LocalDateTime.parse(trimmed, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")).atZone(SYSTEM_ZONE).toInstant();
                }
                if (trimmed.length() == 10 && trimmed.charAt(4) == '-' && trimmed.charAt(7) == '-') {
                    return java.time.LocalDate.parse(trimmed).atStartOfDay(SYSTEM_ZONE).toInstant();
                }
                if (trimmed.length() >= 19 && trimmed.charAt(2) == '/' && trimmed.charAt(5) == '/') {
                    LocalDateTime parsed = LocalDateTime.parse(trimmed.substring(0, 19), DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
                    return parsed.atZone(SYSTEM_ZONE).toInstant();
                }
                if (trimmed.length() >= 16 && trimmed.charAt(2) == '/' && trimmed.charAt(5) == '/') {
                    LocalDateTime parsed = LocalDateTime.parse(trimmed.substring(0, 16), DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
                    return parsed.atZone(SYSTEM_ZONE).toInstant();
                }
            } catch (DateTimeParseException ignoredAgain) {
                return fallback;
            }
        }
        return fallback;
    }

    /**
     * If this copy's expiry was defaulted from the Expiry Policy's duration (not an explicit date
     * the requester chose), recompute it as {@code distributedAt + duration} so it is anchored to
     * the real distribution moment instead of whenever the request happened to be created -- a
     * copy that waited in Ready for Distribution can then never turn out to already be expired.
     * Must run before {@link #ensureControlledCopyNotExpired} at every Distribute call site.
     */
    private void anchorExpiryToDistributionIfNeeded(ControlledCopyRecord copy, Instant distributedAt) {
        if (copy == null || !Boolean.TRUE.equals(copy.getExpiryAnchoredToDistribution()) || copy.getDocument() == null) {
            return;
        }
        Instant recomputed = controlledCopyExpiryLimitService.resolveExpiryFrom(
                copy.getDocument().getDocumentType(), copy.getDocument().getDepartment(), distributedAt);
        if (recomputed != null) {
            copy.setExpiryDate(recomputed);
        }
    }

    /** Batch-record counterpart of {@link #anchorExpiryToDistributionIfNeeded(ControlledCopyRecord, Instant)}. */
    private void anchorExpiryToDistributionIfNeeded(ControlledCopyDistributionBatch batch, Instant distributedAt) {
        if (batch == null || !Boolean.TRUE.equals(batch.getExpiryAnchoredToDistribution()) || batch.getDocument() == null) {
            return;
        }
        Instant recomputed = controlledCopyExpiryLimitService.resolveExpiryFrom(
                batch.getDocument().getDocumentType(), batch.getDocument().getDepartment(), distributedAt);
        if (recomputed != null) {
            batch.setExpiryDate(recomputed);
        }
    }

    private void ensureControlledCopyNotExpired(ControlledCopyRecord copy, Instant executionTime) {
        if (copy == null || !Boolean.TRUE.equals(copy.getHasExpiryDate()) || copy.getExpiryDate() == null || executionTime == null) {
            return;
        }
        if (!executionTime.isBefore(copy.getExpiryDate())) {
            throw new IllegalArgumentException("Controlled copy has expired and cannot be distributed.");
        }
    }

    private byte[] requirePublishedPdfBytes(DocumentRevisionRecord revision) {
        if (revision == null || revision.getStatus() == null || !"EFFECTIVE".equalsIgnoreCase(revision.getStatus().getCode())) {
            throw new IllegalArgumentException("Controlled copies can only be created from the published PDF of an effective revision.");
        }
        String publishedPdfPath = revision.getPreviewFilePath();
        if (!StringUtils.hasText(publishedPdfPath)) {
            throw new IllegalStateException("Published PDF is not available for the effective revision.");
        }
        try {
            byte[] pdfBytes = fileStorageService.readFile(publishedPdfPath);
            if (pdfBytes == null || pdfBytes.length == 0) {
                throw new IllegalStateException("Published PDF is empty.");
            }
            return pdfBytes;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load published PDF for controlled copy creation.", ex);
        }
    }

    private void storeControlledCopyPublishedPdf(ControlledCopyRecord copy, byte[] publishedPdf) {
        if (copy == null || copy.getId() == null || publishedPdf == null || publishedPdf.length == 0) {
            return;
        }
        try (ByteArrayInputStream input = new ByteArrayInputStream(publishedPdf)) {
            FileStorageService.StorageWriteResult stored = fileStorageService.storeControlledCopyPdf(copy, input);
            copy.setControlledCopyFilePath(stored.storedPath());
            copy.setControlledCopyStorageProvider(stored.provider());
            copy.setControlledCopyStorageBucket(stored.bucket());
            copy.setControlledCopyStorageObjectKey(stored.objectKey());
            copy.setControlledCopyStorageVersionId(stored.versionId());
            copy.setControlledCopyChecksum(stored.checksum());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store controlled copy PDF.", ex);
        }
    }

    /**
     * Re-composes the controlled copy's PDF through the revision's publishing template (when
     * one is configured) with the controlled-copy-specific {{copyNo}}/{{distributionList}}
     * placeholders filled in, and stores the result as a new WORM object (never overwrites the
     * previously stored file). Called once per copy at Distribute time — never at Request time,
     * since composition invokes DOCX-to-PDF conversion and is too expensive to run for every
     * copy in a large batch synchronously; for batches this runs inside the existing async
     * per-copy processing step (finalizeDistributedCopy), which already retries on failure and
     * survives a backend restart.
     * <p>
     * Best-effort: if the revision has no publishing template configured, or composition fails
     * for any reason, the copy simply keeps the already-stored (uncomposed) published PDF —
     * this must never block or fail the Distribute action itself.
     */
    /**
     * Keeps only the values whose key matches a currently-active
     * {@link com.eqms.entity.ControlledCopyPlaceholderField} — an unknown or deactivated key is
     * silently dropped rather than rejected, since it must never be able to shadow a built-in
     * placeholder key (copyNo, documentNumber, ...) or block the Distribute action itself.
     */
    private com.fasterxml.jackson.databind.JsonNode sanitizeCustomPlaceholderValues(Map<String, String> raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        java.util.Set<String> activeKeys = controlledCopyPlaceholderFieldRepository.findAllByActiveTrue().stream()
                .map(field -> field.getFieldKey().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        com.fasterxml.jackson.databind.node.ObjectNode node =
                new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
        raw.forEach((key, value) -> {
            if (StringUtils.hasText(key) && value != null && activeKeys.contains(key.toLowerCase(Locale.ROOT))
                    && !ControlledCopyPlaceholderValueBuilder.isReserved(key)) {
                node.put(key, value);
            }
        });
        return node.isEmpty() ? null : node;
    }

    /**
     * Renders the copy-specific PDF (copy number, distribution list, and any custom placeholder
     * values are unique per Controlled Copy, so this cannot reuse the Revision's shared published
     * PDF). Deliberately does NOT catch its own exceptions: a failure here must fail the whole
     * distribute action (single-copy path) or the batch item (async batch path, which already
     * retries and marks the item FAILED on any exception from finalizeDistributedCopy) rather than
     * silently leaving the copy marked Distributed with the generic, non-personalized PDF -- see
     * TBR-CC-011.
     */
    private void applyComposedControlledCopyPlaceholders(ControlledCopyRecord copy) {
        if (copy == null || copy.getRevision() == null || copy.getRevision().getId() == null) {
            return;
        }
        RevisionPublishingMetadata metadata = revisionPublishingMetadataRepository
                .findByRevision_Id(copy.getRevision().getId())
                .orElse(null);
        boolean hasTemplate = metadata != null
                && metadata.getPublishingTemplate() != null
                && StringUtils.hasText(metadata.getSelectedPublishingLayout());
        // Recipient details are captured once, when the copy is distributed (also for a copy that has no template).
        com.fasterxml.jackson.databind.JsonNode recipientSnapshot = placeholderValueBuilder.captureRecipientSnapshotIfAbsent(copy);
        byte[] composedPdf = hasTemplate ? composeThroughTemplate(copy, metadata, recipientSnapshot) : null;
        markAndStore(copy, composedPdf, recipientSnapshot);
    }

    /** Composes the copy through the revision's publishing template (the existing behaviour, unchanged). */
    private byte[] composeThroughTemplate(ControlledCopyRecord copy, RevisionPublishingMetadata metadata,
                                          com.fasterxml.jackson.databind.JsonNode recipientSnapshot) {
        // System-computed values the DCO must never be asked to retype -- copyNo/distributionList
        // were already auto-filled here; recipientDepartment was missing, forcing a manual "Additional
        // Details" prompt (driven by controlled_copy_placeholder_fields) for data the copy already
        // captured at request time. Auto-filling it here means that prompt no longer needs to exist
        // for this value -- see the 2026-09-04 cleanup of the misconfigured placeholder field rows.
        // Server-computed, reserved values: copy identity and recipient (captured once, immutable) -- see
        // ControlledCopyPlaceholderValueBuilder. A value typed in for a reserved key is ignored below.
        Map<String, String> placeholderValues = new java.util.HashMap<>(placeholderValueBuilder.build(
                copy,
                recipientSnapshot,
                // Printed on the document itself inside a fixed-width frame -- only the short sequence is shown;
                // the full unique code stays available in emails, UI and audit trail.
                StringUtils.hasText(copy.getControlledCopyNumber()) ? shortControlledCopyNumber(copy.getControlledCopyNumber()) : ""));
        if (copy.getCustomPlaceholderValues() != null) {
            copy.getCustomPlaceholderValues().fields().forEachRemaining(entry -> {
                if (!ControlledCopyPlaceholderValueBuilder.isReserved(entry.getKey())) {
                    placeholderValues.put(entry.getKey(), entry.getValue().asText(""));
                }
            });
        }
        PublishingPdfComposerService.PublishingCompositionResult composition;
        try {
            composition = publishingPdfComposerService.composePreview(
                    copy.getRevision(),
                    PublishingWorkspaceService.effectiveTemplate(metadata),
                    metadata.getSelectedPublishingLayout(),
                    null, null, null,
                    placeholderValues
            );
        } catch (java.io.IOException ex) {
            throw new IllegalStateException(
                    "Failed to compose controlled-copy-specific PDF for copy " + copy.getId(), ex);
        }
        byte[] composedPdf = composition == null ? null : composition.pdfBytes();
        if (composedPdf == null || composedPdf.length == 0) {
            throw new IllegalStateException(
                    "Controlled-copy-specific PDF composition returned no bytes for copy " + copy.getId());
        }
        return composedPdf;
    }

    /**
     * Burns the configured stamp/watermark into the PDF this copy will hold and stores it. A copy without a template keeps
     * the published PDF stored at request time as its base. A failure here fails the whole distribution (never an unmarked copy).
     */
    private void markAndStore(ControlledCopyRecord copy, byte[] composedPdf, com.fasterxml.jackson.databind.JsonNode recipientSnapshot) {
        if (composedPdf == null && copy.isMarkingApplied()) {
            // A retry: the stored PDF is already marked and there is no template to compose a fresh one from.
            return;
        }
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        byte[] toStore = composedPdf;
        if (pdfMarkingService.isMarkingEnabled(policy)) {
            byte[] base = composedPdf;
            if (base == null) {
                try {
                    base = StringUtils.hasText(copy.getControlledCopyFilePath()) ? fileStorageService.readFile(copy.getControlledCopyFilePath()) : null;
                } catch (IOException ex) {
                    throw new IllegalStateException("Failed to read the controlled copy PDF to mark it: " + copy.getId(), ex);
                }
            }
            ControlledCopyPdfMarkingService.Marked marked = pdfMarkingService.applyWithLayout(base, copy, recipientSnapshot, policy);
            toStore = marked.pdf();
            copy.setMarkingApplied(true);
            // Remember where the marks went, so a later status stamp can be placed without covering them.
            copy.setMarkingLayout(pdfMarkingService.toJson(marked.placements()));
        }
        storeControlledCopyPublishedPdf(copy, toStore);
    }

    /**
     * The stamp and watermark this copy carries from when it was issued. Copies issued since the layout is recorded have it stored.
     * For older copies the stamp frames are read back from the stored PDF, and a watermark is assumed across the middle of the page,
     * so the status marks are still kept clear of them.
     */
    private List<ControlledCopyPdfMarkingService.Placement> issuedMarks(ControlledCopyRecord copy, byte[] storedPdf) {
        if (!copy.isMarkingApplied()) {
            return List.of();
        }
        List<ControlledCopyPdfMarkingService.Placement> recorded = pdfMarkingService.fromJson(copy.getMarkingLayout());
        if (!recorded.isEmpty()) {
            return recorded;
        }
        List<ControlledCopyPdfMarkingService.Placement> legacy = new java.util.ArrayList<>(pdfMarkingService.detectIssuedStamps(storedPdf));
        legacy.add(pdfMarkingService.legacyWatermarkEstimate());
        return legacy;
    }

    private ControlledCopyListItemResponse toResponse(ControlledCopyRecord copy, boolean includeEvidence) {
        String createdDate = copy.getRequestedAt() == null ? DateTimeFormatUtils.formatDate(copy.getCreatedAt() == null ? null : copy.getCreatedAt().atZone(SYSTEM_ZONE).toLocalDate()) : DateTimeFormatUtils.formatDate(copy.getRequestedAt().atZone(SYSTEM_ZONE).toLocalDate());
        String createdTime = copy.getRequestedAt() == null
                ? copy.getCreatedAt() == null ? null : copy.getCreatedAt().atZone(SYSTEM_ZONE).toLocalTime().withNano(0).toString()
                : copy.getRequestedAt().atZone(SYSTEM_ZONE).toLocalTime().withNano(0).toString();
        List<ControlledCopyEvidenceResponse> evidenceFiles = includeEvidence ? toEvidenceResponses(copy.getId()) : List.of();
        String controlledCopyNumber = displayControlledCopyNumber(copy.getControlledCopyNumber());
        String documentNumber = firstNonBlank(
                copy.getDocumentNumber(),
                copy.getRevision() == null ? null : copy.getRevision().getDocumentNumber(),
                copy.getDocument() == null ? null : copy.getDocument().getDocumentNumber()
        );
        String distributionRecipients = buildDistributionRecipients(
                copy.getDistributionMode(),
                copy.getDistributionList(),
                copy.getExternalRecipients()
        );
        String documentTitle = firstNonBlank(
                copy.getDocumentTitle(),
                copy.getRevision() == null ? null : copy.getRevision().getDocumentName(),
                copy.getDocument() == null ? null : copy.getDocument().getDocumentName()
        );
        // Always prefer the live revision's revision_number as the authoritative source.
        // The denormalised copy.revisionNumber may be stale for records created before
        // the V70/V71 backfill migrations, so the live revision value takes priority.
        // normalizeVersionFormat() ensures the result is always X.Y.Z (3-part semver).
        String revisionNumber = normalizeVersionFormat(firstNonBlank(
                copy.getRevision() == null ? null : copy.getRevision().getRevisionNumber(),
                copy.getRevisionNumber()
        ));
        documentTitle = stripDuplicateDocumentCode(documentNumber, documentTitle);
        String displayLabel = buildDocumentDisplayName(documentNumber, documentTitle);

        // Resolve revisionName: prefer the stored revision_name from the live revision,
        // but rebuild it if it doesn't end with the current revisionNumber (stale data guard).
        String rawRevisionName = copy.getRevision() == null ? null : copy.getRevision().getRevisionName();
        String revisionName;
        if (StringUtils.hasText(rawRevisionName)
                && StringUtils.hasText(revisionNumber)
                && rawRevisionName.endsWith("_" + revisionNumber)) {
            revisionName = rawRevisionName;
        } else {
            // Build from scratch using the correct document title and current revisionNumber
            String nameForRevision = firstNonBlank(
                    copy.getRevision() == null ? null : copy.getRevision().getDocumentName(),
                    copy.getDocument() == null ? null : copy.getDocument().getDocumentName(),
                    copy.getDocumentTitle()
            );
            revisionName = buildRevisionName(nameForRevision, revisionNumber);
        }

        ControlledCopyRecord replacedControlledCopy = copy.getReplacedControlledCopy();
        ControlledCopyRecord replacementControlledCopy = controlledCopyRepository
                .findTopByReplacedControlledCopy_IdOrderByRequestedAtDesc(copy.getId())
                .orElse(null);

        return new ControlledCopyListItemResponse(
                copy.getId().toString(),
                controlledCopyNumber,
                createdDate,
                createdTime,
                copy.getOpenedBy() == null ? null : copy.getOpenedBy().getFullName(),
                buildControlledCopyName(documentTitle, revisionNumber, copy.getCopyNumber()),
                copy.getStatus(),
                copy.getStatusCode(),
                new StatusResponse(copy.getStatusCode(), copy.getStatus()),
                DateTimeFormatUtils.formatDate(copy.getValidUntil()),
                // Placeholder until distribution: a policy-derived expiry is (re)computed at distribute time.
                copy.getDistributedAt() == null && Boolean.TRUE.equals(copy.getExpiryAnchoredToDistribution())
                        ? null : DateTimeFormatUtils.formatDateTime(copy.getExpiryDate()),
                copy.getHasExpiryDate(),
                DateTimeFormatUtils.formatDateTime(copy.getExpiryReminderSentAt()),
                documentNumber,
                displayLabel,
                copy.getDistributionList(),
                copy.getDistributionMode(),
                distributionRecipients,
                revisionNumber,
                copy.getLocation(),
                copy.getLocationCode(),
                copy.getBusinessUnitName(),
                copy.getDepartmentName(),
                copy.getRequestReason(),
                // Full timestamp -- distribution is stamped with Instant.now(), and the "Distributed
                // On" column shows the time, not just the date (date-only rendered as "00:00:00").
                copy.getDistributedAt() == null ? null : DateTimeFormatUtils.formatDateTime(copy.getDistributedAt()),
                copy.getDistributedBy() == null ? null : copy.getDistributedBy().getFullName(),
                copy.getRecipientName(),
                copy.getRecipientUser() == null ? null : copy.getRecipientUser().getEmployeeCode(),
                copy.getRecipientUser() == null ? null : copy.getRecipientUser().getDepartment(),
                // Internal recipient: their account e-mail. External recipient: recipientName is
                // already the e-mail address.
                copy.getRecipientUser() != null ? copy.getRecipientUser().getEmail()
                        : (isExternalDistribution(copy) ? copy.getRecipientName() : null),
                copy.getRecipientSignature(),
                DateTimeFormatUtils.formatDate(copy.getRecipientDate()),
                copy.getRecalledAt() == null ? null : DateTimeFormatUtils.formatDate(copy.getRecalledAt().atZone(SYSTEM_ZONE).toLocalDate()),
                copy.getRecalledBy() == null ? null : copy.getRecalledBy().getFullName(),
                copy.getRecallReason(),
                controlledCopyNumber,
                copy.getDocument() == null ? null : copy.getDocument().getId().toString(),
                copy.getRevision() == null || copy.getRevision().getId() == null ? null : copy.getRevision().getId().toString(),
                documentTitle,
                copy.getCopyNumber(),
                copy.getTotalCopies(),
                createdDate,
                copy.getRequestedBy() == null ? null : copy.getRequestedBy().getFullName(),
                copy.getCurrentStage(),
                DateTimeFormatUtils.formatDate(copy.getEffectiveDate()),
                copy.getPrintedAt() == null ? null : DateTimeFormatUtils.formatDate(copy.getPrintedAt().atZone(SYSTEM_ZONE).toLocalDate()),
                copy.getPrintedBy() == null ? null : copy.getPrintedBy().getFullName(),
                copy.getDestroyedAt() == null ? null : DateTimeFormatUtils.formatDate(copy.getDestroyedAt().atZone(SYSTEM_ZONE).toLocalDate()),
                copy.getDestroyedBy() == null ? null : copy.getDestroyedBy().getFullName(),
                copy.getDestroyReason(),
                copy.getDestructionMethod(),
                copy.getDestructionType(),
                copy.getWitnessedBy(),
                copy.getDistributionComment(),
                copy.getExternalRecipients(),
                evidenceFiles,
                revisionName,
                copy.getObsoleteReason(),
                copy.getDistributionBatch() == null ? null : copy.getDistributionBatch().getId().toString(),
                copy.getDistributionBatch() == null ? null : copy.getDistributionBatch().getBatchNumber(),
                replacedControlledCopy == null ? null : replacedControlledCopy.getId().toString(),
                replacedControlledCopy == null ? null : displayControlledCopyNumber(replacedControlledCopy.getControlledCopyNumber()),
                replacementControlledCopy == null ? null : replacementControlledCopy.getId().toString(),
                replacementControlledCopy == null ? null : displayControlledCopyNumber(replacementControlledCopy.getControlledCopyNumber()),
                copy.getUpdatedAt() == null ? null : DateTimeFormatUtils.formatDateTime(copy.getUpdatedAt()),
                copy.getDeliveryMode()
        );
    }

    private List<SignatureResponse> buildSignatureRows(ControlledCopyRecord copy) {
        if (copy == null) {
            return List.of();
        }

        List<SignatureResponse> rows = new ArrayList<>();
        addSignatureRow(rows, "Requested By", copy.getRequestedBy(), copy.getRequestedAt(), copy.getCreatedAt(), "Requested On");
        addSignatureRow(rows, "Printed By", copy.getPrintedBy(), copy.getPrintedAt(), null, "Printed On");
        addSignatureRow(rows, "Distributed By", copy.getDistributedBy(), copy.getDistributedAt(), null, "Distributed On");
        addSignatureRow(rows, "Recalled By", copy.getRecalledBy(), copy.getRecalledAt(), null, "Recalled On");
        addSignatureRow(rows, "Destroyed By", copy.getDestroyedBy(), copy.getDestroyedAt(), null, "Destroyed On");
        addSignatureRow(rows, "Cancelled By", copy.getCancelledBy(), copy.getCancelledAt(), null, "Cancelled On");
        return rows;
    }

    private void addSignatureRow(
            List<SignatureResponse> rows,
            String labelBy,
            UserAccount user,
            Instant primaryInstant,
            Instant fallbackInstant,
            String labelOn
    ) {
        Instant instant = primaryInstant != null ? primaryInstant : fallbackInstant;
        if (user == null && instant == null) {
            return;
        }
        rows.add(new SignatureResponse(
                labelBy,
                user == null || !StringUtils.hasText(user.getFullName()) ? "-" : user.getFullName(),
                labelOn,
                DateTimeFormatUtils.formatDateTime(instant)
        ));
    }


    private String displayControlledCopyNumber(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        String normalized = value.trim().replace('-', '.');
        return normalized.replaceAll("(?i)\\.EXT\\.", ".").replaceAll("(?i)\\.EXT$", "");
    }

    /**
     * Plain 3-digit sequence number (e.g. "002") extracted from the trailing segment of a full
     * controlled-copy code (e.g. "CC.SOP.0037.002"). Only for the in-document "copyNo" placeholder,
     * whose printed frame the full code overflows -- do not reuse where cross-document uniqueness
     * matters (emails, UI, audit trail keep the full code via displayControlledCopyNumber).
     */
    private String shortControlledCopyNumber(String value) {
        String display = displayControlledCopyNumber(value);
        if (!StringUtils.hasText(display)) {
            return display;
        }
        String[] segments = display.split("\\.");
        String tail = segments[segments.length - 1];
        return tail.matches("\\d{1,3}") ? tail : display;
    }

    private String trimCopySuffix(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        String normalized = value.trim();
        int lastDot = normalized.lastIndexOf('.');
        if (lastDot > 0) {
            String tail = normalized.substring(lastDot + 1);
            if (tail.matches("\\d{3}")) {
                return normalized.substring(0, lastDot);
            }
        }
        return normalized;
    }

    private String buildDocumentDisplayName(String documentNumber, String documentTitle) {
        String safeNumber = StringUtils.hasText(documentNumber) ? documentNumber.trim() : "";
        String safeTitle = StringUtils.hasText(documentTitle) ? documentTitle.trim() : "";
        if (StringUtils.hasText(safeNumber) && StringUtils.hasText(safeTitle)) {
            return safeNumber + " - " + safeTitle;
        }
        if (StringUtils.hasText(safeNumber)) {
            return safeNumber;
        }
        if (StringUtils.hasText(safeTitle)) {
            return safeTitle;
        }
        return "Untitled Document";
    }

    private String buildControlledCopyName(String documentTitle, String revisionNumber, Integer copyNumber) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(documentTitle)) {
            parts.add(documentTitle.trim());
        }
        if (StringUtils.hasText(revisionNumber)) {
            parts.add(revisionNumber.trim());
        }
        parts.add("Controlled Copy " + String.valueOf(copyNumber == null ? 1 : copyNumber));
        return String.join(" - ", parts);
    }

    private String buildControlledCopyBatchName(String documentTitle, String revisionNumber) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(documentTitle)) {
            parts.add(documentTitle.trim());
        }
        if (StringUtils.hasText(revisionNumber)) {
            parts.add(revisionNumber.trim());
        }
        // No copy-count suffix -- the list/detail views already show it in a dedicated Quantity column.
        parts.add("Controlled Copies");
        return String.join(" - ", parts);
    }

    private String buildDistributionRecipients(String distributionMode, String distributionList, String externalRecipients) {
        if ("EXTERNAL".equalsIgnoreCase(distributionMode) && StringUtils.hasText(externalRecipients)) {
            return externalRecipients.trim();
        }
        if (StringUtils.hasText(distributionList)) {
            return distributionList.trim();
        }
        return StringUtils.hasText(externalRecipients) ? externalRecipients.trim() : null;
    }

    /**
     * Builds the canonical revision name in the format "DocumentTitle_X.Y.Z".
     * Mirrors RevisionService.buildRevisionName() to allow defensive rebuilding in toResponse().
     */
    private String buildRevisionName(String documentTitle, String version) {
        String safeTitle = StringUtils.hasText(documentTitle) ? documentTitle.trim() : "";
        String safeVersion = normalizeVersionFormat(StringUtils.hasText(version) ? version.trim() : "0.0.1");
        if (!StringUtils.hasText(safeTitle)) {
            return safeVersion;
        }
        return safeTitle + "_" + safeVersion;
    }

    /**
     * Canonicalises a revision number while PRESERVING its format family (part count), so a
     * controlled copy of a two-part-family document keeps showing "0.2" rather than "0.0.2".
     * Mirrors {@code RevisionService.normalizeVersionFormat}.
     *   two-part  "0.1" -> "0.1",   "1.0"   -> "1.0"
     *   three-part "0.0.1" -> "0.0.1", "0.1.0" -> "0.0.1", "1.0.0" -> "1.0.0"
     */
    private String normalizeVersionFormat(String version) {
        if (!StringUtils.hasText(version)) {
            return "0.0.1";
        }
        String trimmed = version.trim();
        String[] parts = trimmed.split("\\.", -1);
        int major = parseSafePart(parts, 0);
        if (parts.length <= 2) {
            return major + "." + parseSafePart(parts, 1);
        }
        int middle = parseSafePart(parts, 1);
        int patch = parseSafePart(parts, 2);
        if (middle != 0 && patch == 0) {
            patch = middle;
        }
        return String.format("%d.0.%d", major, patch);
    }

    private int parseSafePart(String[] parts, int index) {
        if (parts == null || index >= parts.length || !StringUtils.hasText(parts[index])) {
            return 0;
        }
        try {
            return Math.max(Integer.parseInt(parts[index].trim()), 0);
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String stripDuplicateDocumentCode(String documentNumber, String documentTitle) {
        if (!StringUtils.hasText(documentNumber) || !StringUtils.hasText(documentTitle)) {
            return documentTitle;
        }
        String normalizedNumber = documentNumber.replaceAll("[-_.\\s]", "").toLowerCase(Locale.ROOT);
        String normalizedTitle = documentTitle.replaceAll("[-_.\\s]", "").toLowerCase(Locale.ROOT);
        if (!normalizedTitle.startsWith(normalizedNumber)) {
            return documentTitle;
        }
        String stripped = documentTitle.substring(Math.min(documentNumber.length(), documentTitle.length()))
                .replaceFirst("^\\s*[-:|]\\s*", "")
                .trim();
        return StringUtils.hasText(stripped) ? stripped : documentTitle;
    }

    private String stripControlledCopySuffix(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value.trim().replaceAll("\\s*-\\s*Controlled Copy\\s+\\d+\\s*$", "").trim();
    }

    private List<ControlledCopyEvidenceResponse> toEvidenceResponses(UUID controlledCopyId) {
        return controlledCopyEvidenceFileRepository.findAllByControlledCopy_IdOrderByUploadedAtAsc(controlledCopyId)
                .stream()
                .map(this::toEvidenceResponse)
                .toList();
    }

    private ControlledCopyEvidenceResponse toEvidenceResponse(ControlledCopyEvidenceFile evidence) {
        return new ControlledCopyEvidenceResponse(
                evidence.getId().toString(),
                evidence.getFileName(),
                evidence.getContentType(),
                evidence.getFileSize(),
                evidence.getUploadedBy() == null ? null : evidence.getUploadedBy().getFullName(),
                evidence.getUploadedAt() == null ? null : evidence.getUploadedAt().toString(),
                "/api/controlled-copies/" + evidence.getControlledCopy().getId() + "/evidence/" + evidence.getId() + "/download",
                evidence.getOriginalFileName(),
                evidence.getOriginalContentType(),
                evidence.getOriginalFileSize(),
                evidence.getOriginalSha256(),
                evidence.getWatermarkedSha256(),
                evidence.isWatermarked()
        );
    }

    private void storeEvidenceFiles(ControlledCopyRecord copy, List<MultipartFile> files, UserAccount currentUser) {
        if (files == null || files.isEmpty()) {
            return;
        }
        int nextSequence = controlledCopyEvidenceFileRepository
                .findAllByControlledCopy_IdOrderByUploadedAtAsc(copy.getId()).size() + 1;
        for (MultipartFile file : files) {
            validateEvidenceFile(file);
            try {
                scanEvidenceFileOrThrow(file);
                WatermarkedEvidence evidenceUpload = watermarkEvidence(file);
                String evidenceStem = buildEvidenceFileStem(copy, nextSequence++);
                String originalFileName = evidenceStem + extensionOf(evidenceUpload.originalFileName(), ".jpg");
                String watermarkedFileName = evidenceStem
                        + (evidenceUpload.watermarked() ? "-watermarked" : "")
                        + extensionOf(evidenceUpload.fileName(), ".jpg");
                FileStorageService.StorageWriteResult originalStored = null;
                if (evidenceUpload.watermarked()) {
                    originalStored = fileStorageService.storeControlledCopyEvidence(
                            copy,
                            originalFileName,
                            new ByteArrayInputStream(evidenceUpload.originalBytes())
                    );
                }
                FileStorageService.StorageWriteResult stored = fileStorageService.storeControlledCopyEvidence(
                        copy, watermarkedFileName, new ByteArrayInputStream(evidenceUpload.bytes()));
                ControlledCopyEvidenceFile evidence = new ControlledCopyEvidenceFile();
                evidence.setId(UUID.randomUUID());
                evidence.setControlledCopy(copy);
                evidence.setFileName(watermarkedFileName);
                evidence.setContentType(evidenceUpload.contentType());
                evidence.setFileSize((long) evidenceUpload.bytes().length);
                evidence.setStoredPath(stored.storedPath());
                evidence.setOriginalFileName(originalFileName);
                evidence.setOriginalContentType(evidenceUpload.originalContentType());
                evidence.setOriginalFileSize((long) evidenceUpload.originalBytes().length);
                evidence.setOriginalStoredPath(originalStored == null ? stored.storedPath() : originalStored.storedPath());
                evidence.setOriginalSha256(evidenceUpload.originalSha256());
                evidence.setWatermarkedSha256(evidenceUpload.watermarkedSha256());
                evidence.setWatermarked(evidenceUpload.watermarked());
                evidence.setUploadedBy(currentUser);
                controlledCopyEvidenceFileRepository.save(evidence);
                auditTrailService.logAs(currentUser, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "UPLOAD_EVIDENCE", null, copy.getStatus(), evidence.getFileName());
            } catch (IOException ex) {
                throw new IllegalStateException("Failed to store controlled copy evidence file: " + file.getOriginalFilename(), ex);
            }
        }
    }

    private String buildEvidenceFileStem(ControlledCopyRecord copy, int sequence) {
        String controlNumber = sanitizeFileName(copy.getControlledCopyNumber());
        String reason = normalize(copy.getDestroyReason()).toLowerCase(Locale.ROOT).contains("lost") ? "lost" : "damaged";
        return controlNumber + "-" + reason + "-evidence-" + String.format(Locale.ROOT, "%02d", sequence);
    }

    private String extensionOf(String fileName, String fallback) {
        String safe = sanitizeFileName(fileName);
        int dot = safe.lastIndexOf('.');
        return dot >= 0 && dot < safe.length() - 1 ? safe.substring(dot).toLowerCase(Locale.ROOT) : fallback;
    }

    private record WatermarkedEvidence(
            byte[] originalBytes,
            String originalFileName,
            String originalContentType,
            byte[] bytes,
            String fileName,
            String contentType,
            String originalSha256,
            String watermarkedSha256,
            boolean watermarked
    ) { }

    private record DecodedEvidenceImage(BufferedImage image, String contentType, boolean jpeg) { }

    private WatermarkedEvidence watermarkEvidence(MultipartFile file) throws IOException {
        byte[] original = file.getBytes();
        DecodedEvidenceImage decoded = decodeEvidenceImage(original);
        BufferedImage image = decoded.image();
        String originalName = sanitizeFileName(file.getOriginalFilename());
        String originalContentType = decoded.contentType();

        String logoData = systemConfigurationService == null ? null : systemConfigurationService.getPublicBranding().systemLogo();
        if (!StringUtils.hasText(logoData) || !logoData.startsWith("data:image/")) {
            return unchangedEvidence(original, originalName, originalContentType);
        }
        int comma = logoData.indexOf(',');
        if (comma < 0) {
            return unchangedEvidence(original, originalName, originalContentType);
        }
        byte[] logoBytes;
        try {
            logoBytes = Base64.getDecoder().decode(logoData.substring(comma + 1));
        } catch (IllegalArgumentException ex) {
            return unchangedEvidence(original, originalName, originalContentType);
        }
        BufferedImage logo = ImageIO.read(new ByteArrayInputStream(logoBytes));
        if (logo == null) {
            return unchangedEvidence(original, originalName, originalContentType);
        }

        image = scaleEvidenceImage(image);

        int margin = Math.max(12, Math.min(image.getWidth(), image.getHeight()) / 40);
        int maxWidth = Math.max(1, image.getWidth() / 5);
        int maxHeight = Math.max(1, image.getHeight() / 8);
        double scale = Math.min((double) maxWidth / logo.getWidth(), (double) maxHeight / logo.getHeight());
        int logoWidth = Math.max(1, (int) Math.round(logo.getWidth() * scale));
        int logoHeight = Math.max(1, (int) Math.round(logo.getHeight() * scale));
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setComposite(AlphaComposite.SrcOver);
            graphics.drawImage(logo, margin, margin, logoWidth, logoHeight, null);
        } finally {
            graphics.dispose();
        }

        boolean jpeg = decoded.jpeg();
        String format = jpeg ? "jpg" : "png";
        byte[] encoded = encodeEvidenceImage(image, format, jpeg ? 0.92f : null);
        String extension = jpeg ? ".jpg" : ".png";
        String watermarkedName = originalName.replaceFirst("(?i)\\.[^.]+$", "") + "-watermarked" + extension;
        return new WatermarkedEvidence(
                original, originalName, originalContentType, encoded, watermarkedName,
                jpeg ? "image/jpeg" : "image/png", sha256(original), sha256(encoded), true);
    }

    private DecodedEvidenceImage decodeEvidenceImage(byte[] bytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) {
                throw new IllegalArgumentException("Evidence file must be a valid JPEG or PNG image");
            }
            java.util.Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Evidence file must be a valid JPEG or PNG image");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                boolean jpeg = "jpeg".equals(format) || "jpg".equals(format);
                if (!jpeg && !"png".equals(format)) {
                    throw new IllegalArgumentException("Evidence file must be a valid JPEG or PNG image");
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_EVIDENCE_PIXELS) {
                    throw new IllegalArgumentException("Evidence image exceeds the maximum allowed pixel dimensions");
                }
                BufferedImage image = reader.read(0);
                if (image == null) {
                    throw new IllegalArgumentException("Evidence file must be a valid JPEG or PNG image");
                }
                return new DecodedEvidenceImage(image, jpeg ? "image/jpeg" : "image/png", jpeg);
            } finally {
                reader.dispose();
            }
        }
    }

    private WatermarkedEvidence unchangedEvidence(byte[] bytes, String fileName, String contentType) {
        String hash = sha256(bytes);
        return new WatermarkedEvidence(bytes, fileName, contentType, bytes, fileName, contentType, hash, hash, false);
    }

    private byte[] encodeEvidenceImage(BufferedImage source, String format, Float quality) throws IOException {
        BufferedImage image = source;
        if ("jpg".equals(format) && source.getColorModel().hasAlpha()) {
            image = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            try {
                graphics.setColor(Color.WHITE);
                graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
                graphics.drawImage(source, 0, 0, null);
            } finally {
                graphics.dispose();
            }
        }
        if (quality == null) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, format, output);
            return output.toByteArray();
        }
        java.util.Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName(format);
        if (!writers.hasNext()) throw new IOException("No image writer available for " + format);
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), param);
            imageOutput.flush();
            return output.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    private BufferedImage scaleEvidenceImage(BufferedImage source) {
        int longestSide = Math.max(source.getWidth(), source.getHeight());
        if (longestSide <= MAX_EVIDENCE_DIMENSION) {
            return source;
        }
        double scale = (double) MAX_EVIDENCE_DIMENSION / longestSide;
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        int type = source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage resized = new BufferedImage(width, height, type);
        Graphics2D graphics = resized.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return resized;
    }

    private String sha256(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) hex.append(String.format("%02x", value));
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private void validateEvidenceFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Evidence file is required");
        }
        if (file.getSize() > MAX_EVIDENCE_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("Evidence file " + file.getOriginalFilename() + " exceeds the maximum allowed size of 10 MB");
        }
        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType)
                || !("image/jpeg".equalsIgnoreCase(contentType) || "image/png".equalsIgnoreCase(contentType))) {
            throw new IllegalArgumentException("Only JPEG and PNG evidence files are allowed");
        }
    }

    /**
     * Evidence images are decoded (ImageIO) for watermarking, which rejects most non-image
     * content outright — but a crafted polyglot file (a valid image with an embedded payload)
     * would still pass that check. Scan the raw bytes before they are watermarked/stored. Fails
     * closed: if the scanner is enabled but unreachable, the upload is rejected, not silently
     * allowed through (see {@link ClamAvScanService}).
     */
    private void scanEvidenceFileOrThrow(MultipartFile file) throws IOException {
        if (!clamAvScanService.isEnabled()) {
            return;
        }
        ClamAvScanService.ScanResult result = clamAvScanService.scan(file.getBytes());
        if (!result.clean()) {
            throw new IllegalArgumentException("Evidence file " + file.getOriginalFilename()
                    + " was rejected by the virus scanner" + (StringUtils.hasText(result.signatureName()) ? " (" + result.signatureName() + ")" : ""));
        }
    }

    private boolean isExternalDistribution(ControlledCopyRecord copy) {
        return copy != null
                && (StringUtils.hasText(copy.getExternalRecipients())
                        || "external".equalsIgnoreCase(copy.getDistributionScope())
                        || "EXTERNAL".equalsIgnoreCase(copy.getDistributionMode()));
    }

    private UserAccount resolveUserReference(String preferredId, String fallbackReference, UserAccount fallbackUser) {
        UserAccount resolved = resolveOptionalUserReference(preferredId, fallbackReference);
        return resolved == null ? fallbackUser : resolved;
    }

    private UserAccount resolveOptionalUserReference(String preferredId, String fallbackReference) {
        if (StringUtils.hasText(preferredId)) {
            try {
                UUID userId = UUID.fromString(preferredId.trim());
                return currentUserService.findUserById(userId)
                        .orElseThrow(() -> new IllegalArgumentException("Selected user was not found"));
            } catch (IllegalArgumentException ex) {
                // Older clients sent the recipient display name (or email)
                // instead of the UUID. Resolve that representation instead of
                // treating it as an invalid UUID.
                return currentUserService.findUserByUsername(preferredId)
                        .or(() -> currentUserService.findUserByFullName(preferredId))
                        .or(() -> currentUserService.findUserByEmail(preferredId))
                        .orElseGet(() -> StringUtils.hasText(fallbackReference)
                                ? currentUserService.findUserByUsername(fallbackReference)
                                .or(() -> currentUserService.findUserByFullName(fallbackReference))
                                .orElse(null)
                                : null);
            }
        }
        if (StringUtils.hasText(fallbackReference)) {
            String normalized = fallbackReference.trim();
            return currentUserService.findUserByUsername(normalized)
                    .or(() -> currentUserService.findUserByFullName(normalized))
                    .or(() -> currentUserService.findUserByEmail(normalized))
                    .orElse(null);
        }
        return null;
    }

    private String sanitizeFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "evidence-file";
        }
        return fileName.replace("\\", "_").replace("/", "_").trim();
    }

    private String buildDestroyAuditComment(ControlledCopyRecord copy, int evidenceCount) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(copy.getDestructionType())) {
            parts.add("Type: " + copy.getDestructionType());
        }
        if (StringUtils.hasText(copy.getDestructionMethod())) {
            parts.add("Method: " + copy.getDestructionMethod());
        }
        if (StringUtils.hasText(copy.getDestroyReason())) {
            parts.add("Reason: " + copy.getDestroyReason());
        }
        if (StringUtils.hasText(copy.getWitnessedBy())) {
            parts.add("Witness: " + copy.getWitnessedBy());
        }
        if (evidenceCount > 0) {
            parts.add("Evidence files: " + evidenceCount);
        }
        return parts.isEmpty() ? "Controlled copy destroyed" : String.join(" | ", parts);
    }

    private String generateAccessToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * Issues a second-factor credential only as part of Distribution. Its plaintext is never put
     * on the entity, response, audit record or log; only the BCrypt hash is persisted and the
     * plaintext is passed to that distribution email's template variables.
     */
    private String issuePreviewPassword(ControlledCopyRecord copy) {
        if (copy == null) {
            throw new IllegalArgumentException("Controlled copy is required to issue preview credentials");
        }
        if (passwordEncoder == null) {
            throw new IllegalStateException("Preview password encoder is not configured");
        }
        byte[] randomBytes = new byte[PREVIEW_PASSWORD_BYTES];
        PREVIEW_PASSWORD_RANDOM.nextBytes(randomBytes);
        String password = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        copy.setPreviewPasswordHash(passwordEncoder.encode(password));
        return password;
    }

    private List<RecipientAllocation> resolveRequestRecipients(
            ControlledCopyRequestCreateRequest request,
            boolean externalMode,
            List<String> externalRecipients,
            List<String> legacyRecipientIds,
            List<String> legacyRecipientLabels
    ) {
        if (request != null && request.recipients() != null && !request.recipients().isEmpty()) {
            List<RecipientAllocation> allocations = new ArrayList<>();
            for (ControlledCopyRequestCreateRequest.ControlledCopyRecipientRequest recipient : request.recipients()) {
                if (recipient == null) {
                    continue;
                }
                int quantity = Math.max(Optional.ofNullable(recipient.quantity()).orElse(1), 1);
                String recipientType = normalize(firstNonBlank(recipient.recipientType(), externalMode ? "EMAIL" : "USER"));
                if ("EMAIL".equalsIgnoreCase(recipientType) || StringUtils.hasText(recipient.recipientEmail())) {
                    String email = normalizeEmail(recipient.recipientEmail());
                    if (StringUtils.hasText(email) && isValidEmailAddress(email)) {
                        allocations.add(new RecipientAllocation(null, email, email, email, quantity));
                    }
                    continue;
                }
                UserAccount user = resolveUserByIdOrReference(recipient.recipientUserId(), recipient.location());
                if (user != null) {
                    allocations.add(new RecipientAllocation(
                            user,
                            user.getId() == null ? recipient.recipientUserId() : user.getId().toString(),
                            firstNonBlank(recipient.department(), recipient.location(), user.getDepartment(), user.getFullName()),
                            buildRecipientDisplayName(user),
                            quantity
                    ));
                }
            }
            return dedupeAllocations(allocations);
        }
        return externalMode
                ? resolveExternalRecipients(externalRecipients)
                : resolveInternalRecipients(request, legacyRecipientIds, legacyRecipientLabels);
    }

    private List<RecipientAllocation> resolveInternalRecipients(
            ControlledCopyRequestCreateRequest request,
            List<String> locationIds,
            List<String> locationNames
    ) {
        String scope = request == null ? null : normalize(request.distributionScope());
        if (!StringUtils.hasText(scope)) {
            scope = "business-unit";
        }

        List<RecipientAllocation> allocations = new ArrayList<>();
        List<String> sourceIds = locationIds == null ? List.of() : locationIds;
        List<String> sourceLabels = locationNames == null ? List.of() : locationNames;

        if (sourceIds.isEmpty() && sourceLabels.isEmpty()) {
            return List.of();
        }

        if ("individual".equalsIgnoreCase(scope)) {
            for (int index = 0; index < sourceIds.size(); index++) {
                String userId = sourceIds.get(index);
                UserAccount user = resolveUserByIdOrReference(userId, sourceLabels.size() > index ? sourceLabels.get(index) : null);
                if (user != null) {
                    allocations.add(new RecipientAllocation(
                            user,
                            user.getId() == null ? userId : user.getId().toString(),
                            firstNonBlank(user.getEmail(), user.getUsername(), user.getFullName()),
                            buildRecipientDisplayName(user),
                            1
                    ));
                }
            }
            if (!allocations.isEmpty()) {
                return dedupeAllocations(allocations);
            }
        }

        for (int index = 0; index < sourceIds.size(); index++) {
            String targetId = sourceIds.get(index);
            String fallbackLabel = sourceLabels.size() > index ? sourceLabels.get(index) : null;
            List<RecipientAllocation> targetAllocations = switch (scope.toLowerCase(Locale.ROOT)) {
                case "department" -> resolveDepartmentRecipients(targetId, fallbackLabel);
                case "business-unit" -> resolveBusinessUnitRecipients(targetId, fallbackLabel);
                default -> List.of();
            };
            allocations.addAll(targetAllocations);
        }

        return dedupeAllocations(allocations);
    }

    private List<RecipientAllocation> resolveExternalRecipients(List<String> rawEmails) {
        if (rawEmails == null || rawEmails.isEmpty()) {
            return List.of();
        }

        List<RecipientAllocation> allocations = new ArrayList<>();
        for (String rawEmail : rawEmails) {
            String email = normalizeEmail(rawEmail);
            if (!StringUtils.hasText(email) || !isValidEmailAddress(email)) {
                continue;
            }
            allocations.add(new RecipientAllocation(null, email, email, email, 1));
        }
        return dedupeAllocations(allocations);
    }

    private List<RecipientAllocation> resolveBusinessUnitRecipients(String targetId, String fallbackLabel) {
        BusinessUnit businessUnit = resolveBusinessUnit(targetId, fallbackLabel);
        if (businessUnit == null) {
            return List.of();
        }
        List<UserAccount> users = userAccountRepository.findAllByBusinessUnitNameOrCodeAndStatus(
                firstNonBlank(businessUnit.getName(), ""),
                firstNonBlank(businessUnit.getCode(), ""),
                com.eqms.entity.UserStatus.Active
        );
        if (users.isEmpty()) {
            return List.of();
        }
        String identifier = businessUnit.getId() == null ? businessUnit.getName() : businessUnit.getId().toString();
        String label = StringUtils.hasText(businessUnit.getName()) ? businessUnit.getName().trim() : businessUnit.getCode();
        return users.stream()
                .map(user -> new RecipientAllocation(
                        user,
                        user.getId() == null ? user.getEmail() : user.getId().toString(),
                        StringUtils.hasText(label) ? label : buildRecipientDisplayName(user),
                        buildRecipientDisplayName(user),
                        1
                ))
                .toList();
    }

    private List<RecipientAllocation> resolveDepartmentRecipients(String targetId, String fallbackLabel) {
        Department department = resolveDepartment(targetId, fallbackLabel);
        if (department == null) {
            return List.of();
        }
        List<UserAccount> users = userAccountRepository.findAllByDepartmentNameOrCodeAndStatus(
                firstNonBlank(department.getName(), ""),
                firstNonBlank(department.getCode(), ""),
                com.eqms.entity.UserStatus.Active
        );
        if (users.isEmpty()) {
            return List.of();
        }
        String identifier = department.getId() == null ? department.getName() : department.getId().toString();
        String label = StringUtils.hasText(department.getName()) ? department.getName().trim() : department.getCode();
        return users.stream()
                .map(user -> new RecipientAllocation(
                        user,
                        user.getId() == null ? user.getEmail() : user.getId().toString(),
                        StringUtils.hasText(label) ? label : buildRecipientDisplayName(user),
                        buildRecipientDisplayName(user),
                        1
                ))
                .toList();
    }

    private List<RecipientAllocation> dedupeAllocations(List<RecipientAllocation> allocations) {
        if (allocations == null || allocations.isEmpty()) {
            return List.of();
        }
        Map<String, RecipientAllocation> unique = new java.util.LinkedHashMap<>();
        for (RecipientAllocation allocation : allocations) {
            if (allocation == null) {
                continue;
            }
            String key = normalize(firstNonBlank(allocation.identifier(), allocation.label(), allocation.displayName()));
            if (!StringUtils.hasText(key)) {
                continue;
            }
            unique.putIfAbsent(key.toLowerCase(Locale.ROOT), allocation);
        }
        return new ArrayList<>(unique.values());
    }

    private BusinessUnit resolveBusinessUnit(String targetId, String fallbackLabel) {
        if (StringUtils.hasText(targetId)) {
            try {
                UUID id = UUID.fromString(targetId.trim());
                return businessUnitRepository.findById(id).orElse(null);
            } catch (IllegalArgumentException ignored) {
                Optional<BusinessUnit> byCode = businessUnitRepository.findByCodeIgnoreCase(targetId.trim());
                if (byCode.isPresent()) {
                    return byCode.get();
                }
                Optional<BusinessUnit> byName = businessUnitRepository.findByNameIgnoreCase(targetId.trim());
                if (byName.isPresent()) {
                    return byName.get();
                }
            }
        }
        if (StringUtils.hasText(fallbackLabel)) {
            String normalized = fallbackLabel.trim();
            return businessUnitRepository.findByNameIgnoreCase(normalized)
                    .or(() -> businessUnitRepository.findByCodeIgnoreCase(normalized))
                    .orElse(null);
        }
        return null;
    }

    private Department resolveDepartment(String targetId, String fallbackLabel) {
        if (StringUtils.hasText(targetId)) {
            try {
                UUID id = UUID.fromString(targetId.trim());
                return departmentRepository.findById(id).orElse(null);
            } catch (IllegalArgumentException ignored) {
                Optional<Department> byCode = departmentRepository.findByCodeIgnoreCase(targetId.trim());
                if (byCode.isPresent()) {
                    return byCode.get();
                }
                Optional<Department> byName = departmentRepository.findByNameIgnoreCase(targetId.trim());
                if (byName.isPresent()) {
                    return byName.get();
                }
            }
        }
        if (StringUtils.hasText(fallbackLabel)) {
            String normalized = fallbackLabel.trim();
            return departmentRepository.findByNameIgnoreCase(normalized)
                    .or(() -> departmentRepository.findByCodeIgnoreCase(normalized))
                    .orElse(null);
        }
        return null;
    }

    private UserAccount resolveUserByIdOrReference(String targetId, String fallbackReference) {
        if (StringUtils.hasText(targetId)) {
            try {
                UUID id = UUID.fromString(targetId.trim());
                return userAccountRepository.findById(id).orElse(null);
            } catch (IllegalArgumentException ignored) {
                Optional<UserAccount> byUsername = userAccountRepository.findByUsername(targetId.trim());
                if (byUsername.isPresent()) {
                    return byUsername.get();
                }
                Optional<UserAccount> byEmail = userAccountRepository.findByEmail(targetId.trim());
                if (byEmail.isPresent()) {
                    return byEmail.get();
                }
            }
        }
        return resolveOptionalUserReference(null, fallbackReference);
    }

    private boolean matchesBusinessUnit(UserAccount user, BusinessUnit businessUnit) {
        if (user == null || businessUnit == null) {
            return false;
        }
        String userUnit = normalize(user.getBusinessUnit());
        return StringUtils.hasText(userUnit)
                && (userUnit.equalsIgnoreCase(normalize(businessUnit.getName()))
                || userUnit.equalsIgnoreCase(normalize(businessUnit.getCode())));
    }

    private boolean matchesDepartment(UserAccount user, Department department) {
        if (user == null || department == null) {
            return false;
        }
        String userDepartment = normalize(user.getDepartment());
        return StringUtils.hasText(userDepartment)
                && (userDepartment.equalsIgnoreCase(normalize(department.getName()))
                || userDepartment.equalsIgnoreCase(normalize(department.getCode())));
    }

    private String buildTargetLabel(String code, String name) {
        if (StringUtils.hasText(code) && StringUtils.hasText(name)) {
            return code.trim() + " - " + name.trim();
        }
        return firstNonBlank(code, name);
    }

    private String buildRecipientDisplayName(UserAccount user) {
        if (user == null) {
            return null;
        }
        return firstNonBlank(user.getFullName(), user.getEmail(), user.getUsername());
    }

    private String normalizeEmail(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : null;
    }

    private boolean isValidEmailAddress(String email) {
        return StringUtils.hasText(email) && email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private String resolveWatermarkRecipientLabel(ControlledCopyRecord copy) {
        if (copy == null) {
            return "";
        }
        UserAccount recipientUser = copy.getRecipientUser();
        if (recipientUser != null) {
            if (StringUtils.hasText(recipientUser.getEmail())) {
                return recipientUser.getEmail();
            }
            if (StringUtils.hasText(recipientUser.getUsername())) {
                return recipientUser.getUsername();
            }
            if (StringUtils.hasText(recipientUser.getFullName())) {
                return recipientUser.getFullName();
            }
        }
        return StringUtils.hasText(copy.getRecipientName()) ? copy.getRecipientName() : "";
    }

    private ControlledCopyPreviewResponse buildPreviewResponse(ControlledCopyRecord copy, String token) {
        int pageCount = countPreviewPages(copy);
        return new ControlledCopyPreviewResponse(
                copy.getId() == null ? null : copy.getId().toString(),
                copy.getControlledCopyNumber(),
                copy.getDocumentTitle(),
                copy.getDocumentNumber(),
                copy.getRevisionNumber(),
                copy.getRecipientName(),
                pageCount,
                token,
                isDownloadAllowed(copy),
                isPrintAllowed(copy),
                controlledCopyPolicyService.loadOrDefault().isDownloadOnce(),
                controlledCopyPolicyService.loadOrDefault().isPrintOnce(),
                java.util.Optional.ofNullable(controlledCopyPreviewGrantService.expiresAt(token)).map(java.time.Instant::toString).orElse(null)
        );
    }

    private boolean isDownloadAllowed(ControlledCopyRecord copy) {
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        return policy.isAllowDownload() && (!policy.isDownloadOnce() || copy.getDownloadCount() < 1);
    }

    private boolean isPrintAllowed(ControlledCopyRecord copy) {
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        return policy.isAllowPrint() && (!policy.isPrintOnce() || copy.getPrintCount() < 1);
    }

    private UserAccount requirePreviewAccess(ControlledCopyRecord copy, String token) {
        if (copy == null) {
            throw new AccessDeniedException("Access Denied");
        }
        // The initial endpoint validates the recipient's token + password and
        // exchanges them for a short-lived, copy-bound signed grant.  Every
        // subsequent file/page/print call must present that grant; accepting the
        // long-lived email token here would let callers bypass the password.
        controlledCopyAuthorizationService.requireNotExpired(copy);
        // Re-check lifecycle status on every call within an already-open preview session, not just
        // at openPreview() -- otherwise a copy Obsoleted/Cancelled mid-session stays viewable for
        // up to the remaining grant TTL (15 min). See requireStatusAllowedForPreview's own comment.
        controlledCopyAuthorizationService.requireStatusAllowedForPreview(copy);
        controlledCopyPreviewGrantService.require(copy, token);

        // Preview links are deliberately usable by an anonymous/guest browser
        // after the token/password handshake.  Do not require an eQMS session
        // here: external recipients do not have an account in this tenant.
        // When a session is present, retain the recipient binding below.
        UserAccount currentUser = findAuthenticatedPreviewUser();
        if (currentUser == null) {
            return null;
        }

        UserAccount recipientUser = copy.getRecipientUser();
        if (recipientUser != null) {
            if (recipientUser.getId() == null || !recipientUser.getId().equals(currentUser.getId())) {
                throw new AccessDeniedException("Access Denied");
            }
            return currentUser;
        }
        if (StringUtils.hasText(copy.getRecipientName())) {
            String recipientName = copy.getRecipientName().trim();
            boolean matches = currentUser.getFullName() != null && recipientName.equalsIgnoreCase(currentUser.getFullName())
                    || currentUser.getUsername() != null && recipientName.equalsIgnoreCase(currentUser.getUsername())
                    || currentUser.getEmail() != null && recipientName.equalsIgnoreCase(currentUser.getEmail());
            if (!matches) {
                throw new AccessDeniedException("Access Denied");
            }
        }
        return currentUser;
    }

    private void auditPreviewAccess(
            UserAccount actor,
            ControlledCopyRecord copy,
            String action,
            String comment
    ) {
        if (actor != null) {
            auditTrailService.logAs(
                    actor,
                    "Controlled Copy",
                    copy.getControlledCopyNumber(),
                    copy.getId(),
                    action,
                    null,
                    copy.getStatus(),
                    comment
            );
            return;
        }
        auditTrailService.logExternal(
                resolvePreviewRecipientIdentifier(copy),
                "Controlled Copy",
                copy.getControlledCopyNumber(),
                copy.getId(),
                action,
                null,
                copy.getStatus(),
                comment
        );
    }

    private String resolvePreviewRecipientIdentifier(ControlledCopyRecord copy) {
        if (copy != null && copy.getRecipientUser() != null) {
            UserAccount recipient = copy.getRecipientUser();
            if (StringUtils.hasText(recipient.getEmail())) {
                return recipient.getEmail();
            }
            if (StringUtils.hasText(recipient.getUsername())) {
                return recipient.getUsername();
            }
        }
        return copy == null ? null : copy.getRecipientName();
    }

    private UserAccount findAuthenticatedPreviewUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            return null;
        }
        return currentUserService.findUserById(principal.userId()).orElse(null);
    }

    private int countPreviewPages(ControlledCopyRecord copy) {
        try {
            byte[] pdfBytes = loadControlledCopyPreviewPdf(copy);
            if (pdfBytes == null || pdfBytes.length == 0) {
                return 0;
            }
            try (PDDocument document = Loader.loadPDF(pdfBytes)) {
                return document.getNumberOfPages();
            }
        } catch (Exception ex) {
            log.warn("Failed to count preview pages for controlled copy {}: {}", copy == null ? null : copy.getControlledCopyNumber(), ex.getMessage());
            return 0;
        }
    }

    private byte[] renderControlledCopyPreviewPage(ControlledCopyRecord copy, int pageNumber) {
        try {
            byte[] pdfBytes = loadControlledCopyPreviewPdf(copy);
            if (pdfBytes == null || pdfBytes.length == 0) {
                throw new IllegalStateException("Controlled copy preview file is not available");
            }
            try (PDDocument document = Loader.loadPDF(pdfBytes); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                int zeroBased = Math.min(pageNumber - 1, Math.max(document.getNumberOfPages() - 1, 0));
                PDFRenderer renderer = new PDFRenderer(document);
                BufferedImage image = renderer.renderImageWithDPI(zeroBased, 160, ImageType.RGB);
                ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
                if (!copy.isMarkingApplied() && (policy == null || policy.isWatermarkEnabled())) {
                    applyControlledCopyWatermark(image, copy, policy);
                }
                ImageIO.write(image, "png", output);
                return output.toByteArray();
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to render controlled copy preview page", ex);
        }
    }

    private byte[] loadControlledCopyPreviewPdf(ControlledCopyRecord copy) throws IOException {
        if (copy == null) {
            return null;
        }
        if (StringUtils.hasText(copy.getControlledCopyFilePath())) {
            return fileStorageService.readFile(copy.getControlledCopyFilePath());
        }
        if (copy.getRevision() == null) {
            return null;
        }
        String previewPath = StringUtils.hasText(copy.getRevision().getPreviewFilePath())
                ? copy.getRevision().getPreviewFilePath()
                : copy.getRevision().getFilePath();
        if (!StringUtils.hasText(previewPath)) {
            return null;
        }
        return fileStorageService.readFile(previewPath);
    }

    private void applyControlledCopyWatermark(BufferedImage image, ControlledCopyRecord copy, ControlledCopyPolicySetting policy) {
        if (image == null) {
            return;
        }
        boolean showCopyNumber = policy == null || policy.isWatermarkCopyNumber();
        boolean showRecipient = policy == null || policy.isWatermarkRecipient();
        boolean showDistributedDate = policy == null || policy.isWatermarkDistributedDate();
        boolean showExpiryDate = policy == null || policy.isWatermarkExpiryDate();
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.18f));
            g.setColor(new Color(60, 60, 60));
            g.setFont(new Font("SansSerif", Font.BOLD, Math.max(18, image.getWidth() / 28)));
            String[] lines = new String[] {
                    "Controlled Copy",
                    showCopyNumber && StringUtils.hasText(copy.getControlledCopyNumber()) ? copy.getControlledCopyNumber() : "",
                    showRecipient ? resolveWatermarkRecipientLabel(copy) : "",
                    // Distributed On the watermark reflects the copy's actual distribution
                    // timestamp (not render time) so the stamp stays accurate no matter when
                    // the PDF is later re-previewed/re-downloaded.
                    showDistributedDate && copy.getDistributedAt() != null
                            ? "Distributed: " + DateTimeFormatUtils.formatDateTime(copy.getDistributedAt())
                            : "",
                    showExpiryDate && copy.getExpiryDate() != null
                            ? "Expires: " + DateTimeFormatUtils.formatDateTime(copy.getExpiryDate())
                            : ""
            };
            AffineTransform original = g.getTransform();
            g.rotate(Math.toRadians(-28), image.getWidth() / 2.0, image.getHeight() / 2.0);
            int centerX = image.getWidth() / 2;
            int centerY = image.getHeight() / 2;
            int lineHeight = g.getFontMetrics().getHeight() + 6;
            int startY = centerY - ((lines.length - 1) * lineHeight) / 2;
            for (int i = 0; i < lines.length; i++) {
                String line = lines[i];
                if (!StringUtils.hasText(line)) {
                    continue;
                }
                int textWidth = g.getFontMetrics().stringWidth(line);
                g.drawString(line, centerX - textWidth / 2, startY + (i * lineHeight));
            }
            g.setTransform(original);
        } finally {
            g.dispose();
        }
    }

    /**
     * @param partOfBatch when true and delivery is redirected to the DCO, the per-copy DCO email
     *                    with the direct link is skipped here — the DCO instead gets ONE
     *                    aggregated ZIP email after the whole batch finishes (see
     *                    {@link #sendDcoBatchZipEmail}), so we don't spam them with one email per copy.
     */
    // Package-private (not private): also called from ControlledCopyNotificationAsyncService,
    // which runs the single-copy distribute() notification after that transaction commits (see
    // ControlledCopyActionNotificationEvent's javadoc for why).
    void sendControlledCopyDistributionNotification(
            ControlledCopyRecord copy,
            UserAccount actor,
            String comment,
            boolean partOfBatch,
            String previewPassword
    ) {
        try {
            if (copy == null) {
                return;
            }
            UserAccount recipient = copy.getRecipientUser();
            Map<String, String> variables = emailNotificationService.buildControlledCopyVariables(
                    copy,
                    actor,
                    recipient,
                    "DISTRIBUTE",
                    comment,
                    Map.of(
                            "controlledCopyStatus", copy.getStatus() == null ? "" : copy.getStatus(),
                            "workflowStage", copy.getCurrentStage() == null ? "" : copy.getCurrentStage(),
                            "workflowAction", "DISTRIBUTE",
                            "workflowComment", comment == null ? "" : comment,
                            "documentTitle", copy.getDocumentTitle() == null ? "" : copy.getDocumentTitle(),
                            "documentNumber", copy.getDocumentNumber() == null ? "" : copy.getDocumentNumber(),
                            "revisionNumber", copy.getRevisionNumber() == null ? "" : copy.getRevisionNumber(),
                            // Plaintext is scoped to this outbound email payload only. The record
                            // persists only its BCrypt hash, never the credential itself.
                            "previewPassword", previewPassword == null ? "" : previewPassword
                    )
            );
            if (recipient != null) {
                notificationDispatcher.dispatch("controlled_copy.distributed", List.of(recipient), variables);
                variables.put("notificationPolicyManaged", "true");
            }

            ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
            UserAccount dco = resolveDcoRecipient(policy, actor, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId());
            boolean redirectToDco = policy.isRedirectDeliveryToDco() && dco != null;
            String requesterTemplateType = redirectToDco
                    ? EmailTemplateTypeUtils.CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION_NO_ACCESS
                    : EmailTemplateTypeUtils.CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION;

            if (recipient != null && StringUtils.hasText(recipient.getEmail())) {
                emailNotificationService.sendControlledCopyNotification(requesterTemplateType, List.of(recipient), variables);
            } else {
                String recipientEmail = normalize(copy.getRecipientName());
                if (StringUtils.hasText(recipientEmail) && isValidEmailAddress(recipientEmail)) {
                    emailNotificationService.sendControlledCopyNotificationToEmails(requesterTemplateType, List.of(recipientEmail), variables);
                }
            }

            if (redirectToDco && !partOfBatch) {
                emailNotificationService.sendControlledCopyNotification(EmailTemplateTypeUtils.CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION, List.of(dco), variables);
                auditTrailService.logAs(actor, "Controlled Copy", copy.getControlledCopyNumber(), copy.getId(), "DCO_DELIVERY_SENT", null, null,
                        "Delivery redirected to DCO (" + dco.getFullName() + ") per Controlled Copies Policy.", List.of(), null);
            }
        } catch (Exception ex) {
            log.warn("Failed to dispatch controlled copy distribution email for copy {}: {}", copy == null ? null : copy.getControlledCopyNumber(), ex.getMessage(), ex);
        }
    }

    /**
     * Resolves the DCO delivery recipient, re-validating eligibility at send time (not just at
     * policy-save time) since the assigned user's permission/account status can change afterward.
     * Returns null whenever redirection cannot safely happen -- callers already treat null as
     * "fall back to normal per-recipient delivery", so this is a fail-safe, not a failure: a
     * distribute action must never be blocked just because the DCO routing is misconfigured. Every
     * fallback is recorded BOTH to the notification delivery-failure log (for admin follow-up) AND
     * the Audit Trail against the triggering entity (for GMP traceability -- an auditor pulling the
     * history of a specific controlled copy/batch must be able to see that redirection was
     * attempted and fell back, not just find that information in a separate operational log).
     *
     * @param entityType e.g. "Controlled Copy" or "Controlled Copy Distribution Batch"
     * @param entityName e.g. controlled copy number or batch number, for the audit entry label
     * @param entityId   the controlled copy or batch id
     */
    private UserAccount resolveDcoRecipient(ControlledCopyPolicySetting policy, UserAccount actor, String entityType, String entityName, UUID entityId) {
        if (policy == null || !policy.isRedirectDeliveryToDco()) {
            return null;
        }
        String reason;
        String contextLabel;
        if (policy.getDcoRecipientUserId() == null) {
            reason = "Delivery redirection is enabled but no DCO recipient is configured.";
            contextLabel = "policy";
        } else {
            UserAccount recipient = userAccountRepository.findById(policy.getDcoRecipientUserId()).orElse(null);
            if (recipient == null) {
                reason = "The configured DCO recipient user no longer exists.";
                contextLabel = policy.getDcoRecipientUserId().toString();
            } else if (recipient.getStatus() != com.eqms.entity.UserStatus.Active) {
                reason = "The configured DCO recipient's account (" + recipient.getFullName() + ") is not Active.";
                contextLabel = recipient.getEmail();
            } else if (!permissionEvaluationService.hasPermission(recipient, ControlledCopyPolicyService.DCO_RECIPIENT_PERMISSION)) {
                reason = "The configured DCO recipient (" + recipient.getFullName() + ") no longer holds the \"Receive Controlled Copies as DCO\" permission.";
                contextLabel = recipient.getEmail();
            } else {
                return recipient;
            }
        }
        emailNotificationService.recordControlledCopyDcoMisconfiguration(contextLabel, reason);
        auditTrailService.logAs(actor, entityType, entityName, entityId, "DCO_DELIVERY_FALLBACK", null, null,
                "Delivery redirection to DCO could not be applied -- fell back to normal delivery. Reason: " + reason,
                List.of(), null);
        return null;
    }

    /**
     * Sanitizes a value for safe use inside a ZIP entry filename: strips characters that are
     * invalid/ambiguous across common filesystems, collapses whitespace, and bounds length.
     */
    private String sanitizeForFileName(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String cleaned = value.trim().replaceAll("[\\\\/:*?\"<>|]", "-").replaceAll("\\s+", "_");
        return cleaned.length() > 80 ? cleaned.substring(0, 80) : cleaned;
    }

    private record ZipBuildResult(byte[] zipBytes, List<String> includedNumbers, List<String> failedNumbers) {
    }

    /** Per-copy isolation is deliberate: a batch can be hundreds/thousands of records, and one bad PDF
     *  read (corrupt file, transient storage error, ...) must never take down the whole ZIP for every
     *  other copy in the batch. Every failure is returned, not silently dropped. */
    private ZipBuildResult buildDcoZip(List<ControlledCopyRecord> copies, UUID batchId) throws IOException {
        List<String> includedNumbers = new java.util.ArrayList<>();
        List<String> failedNumbers = new java.util.ArrayList<>();
        java.io.ByteArrayOutputStream zipBuffer = new java.io.ByteArrayOutputStream();
        java.util.Set<String> usedNames = new java.util.HashSet<>();
        try (java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(zipBuffer)) {
            for (ControlledCopyRecord copy : copies) {
                try {
                    byte[] pdfBytes = loadControlledCopyPreviewPdf(copy);
                    if (pdfBytes == null || pdfBytes.length == 0) {
                        failedNumbers.add(copy.getControlledCopyNumber());
                        continue;
                    }
                    String baseName = String.join("_",
                            List.of(
                                    sanitizeForFileName(copy.getDocumentNumber()),
                                    "Rev" + sanitizeForFileName(copy.getRevisionNumber()),
                                    "Copy" + (copy.getCopyNumber() > 0 ? copy.getCopyNumber() : 0),
                                    sanitizeForFileName(copy.getRecipientName())
                            ).stream().filter(StringUtils::hasText).toList()
                    ) + ".pdf";
                    String entryName = baseName;
                    int suffix = 2;
                    while (!usedNames.add(entryName)) {
                        entryName = baseName.replace(".pdf", "") + "_" + suffix + ".pdf";
                        suffix++;
                    }
                    zip.putNextEntry(new java.util.zip.ZipEntry(entryName));
                    zip.write(pdfBytes);
                    zip.closeEntry();
                    includedNumbers.add(copy.getControlledCopyNumber());
                } catch (Exception copyEx) {
                    failedNumbers.add(copy.getControlledCopyNumber());
                    log.warn("Skipped controlled copy {} while building DCO batch ZIP for batch {}: {}",
                            copy.getControlledCopyNumber(), batchId, copyEx.getMessage(), copyEx);
                }
            }
        }
        return new ZipBuildResult(zipBuffer.toByteArray(), includedNumbers, failedNumbers);
    }

    public record DcoBatchZipFile(String fileName, byte[] bytes, int includedCount, int totalCount) {
    }

    /**
     * Rebuilds the same ZIP {@link #sendDcoBatchZipEmail} last emailed the DCO, for the "download"
     * link in that email -- so the DCO isn't solely dependent on their mail client keeping the
     * attachment (some strip large attachments, or the DCO reads the email from a different device).
     * Sourced from the batch's most recent DISTRIBUTE run's durable job/item records, not the
     * transient in-memory list from whenever that run first finished.
     */
    @Transactional(readOnly = true)
    public DcoBatchZipFile buildDcoBatchZipForDownload(UUID batchId) throws IOException {
        // Open to any current holder of the DCO permission, not just whoever was configured as the
        // recipient at send time -- consistent with how the rest of this feature resolves eligibility
        // (see resolveDcoRecipient), so a re-assignment doesn't lock the previous DCO's teammates out
        // of a batch still sitting in their inbox.
        UserAccount requester = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(requester, ControlledCopyPolicyService.DCO_RECIPIENT_PERMISSION)) {
            throw new AccessDeniedException("You do not hold the \"Receive Controlled Copies as DCO\" permission");
        }
        ControlledCopyDistributionBatch batch = controlledCopyDistributionBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalArgumentException("Distribution batch not found"));
        List<UUID> succeededCopyIds = controlledCopyDistributionJobService.succeededDistributeCopyIds(batchId);
        if (succeededCopyIds.isEmpty()) {
            throw new IllegalStateException("This batch has no successfully distributed copies to download");
        }
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllById(succeededCopyIds);
        ZipBuildResult built = buildDcoZip(copies, batchId);
        if (built.includedNumbers().isEmpty()) {
            throw new IllegalStateException("None of this batch's copies could be read to build the ZIP");
        }
        String zipFileName = "ControlledCopies_Batch_" + sanitizeForFileName(batch.getBatchNumber()) + ".zip";
        return new DcoBatchZipFile(zipFileName, built.zipBytes(), built.includedNumbers().size(), copies.size());
    }

    /**
     * Builds the one aggregated ZIP + email sent to the DCO after a distribution batch finishes
     * processing (all copies' PDFs finalized), when Controlled Copies Policy redirects delivery
     * to the DCO. Called from {@link ControlledCopyBatchDistributionAsyncService} once per batch,
     * after every succeeded copy's placeholder-composed PDF has been rendered. A no-op when the
     * policy doesn't redirect to a DCO, or when there are no succeeded copies to zip.
     */
    @Transactional
    public void sendDcoBatchZipEmail(UUID batchId, List<UUID> succeededCopyIds, UUID issuerUserId) {
        if (batchId == null || succeededCopyIds == null || succeededCopyIds.isEmpty()) {
            return;
        }
        ControlledCopyDistributionBatch batch = controlledCopyDistributionBatchRepository.findById(batchId).orElse(null);
        if (batch == null) {
            return;
        }
        UserAccount issuer = resolveIssuerOrSystemActor(issuerUserId);
        ControlledCopyPolicySetting policy = controlledCopyPolicyService.loadOrDefault();
        UserAccount dco = resolveDcoRecipient(policy, issuer, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId());
        if (dco == null) {
            return;
        }
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllById(succeededCopyIds);
        if (copies.isEmpty()) {
            return;
        }
        ZipBuildResult built;
        try {
            built = buildDcoZip(copies, batchId);
        } catch (Exception ex) {
            log.warn("Failed to build DCO batch ZIP for batch {}: {}", batchId, ex.getMessage(), ex);
            emailNotificationService.recordControlledCopyDcoMisconfiguration(
                    dco.getEmail(), "Failed to build the batch ZIP for batch " + batch.getBatchNumber() + ": " + ex.getMessage());
            auditTrailService.logAs(issuer, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "DCO_ZIP_BUILD_FAILED", null, null,
                    "Failed to build the DCO batch ZIP: " + ex.getMessage(), List.of(), null);
            return;
        }
        byte[] zipBytes = built.zipBytes();
        List<String> includedNumbers = built.includedNumbers();
        List<String> failedNumbers = built.failedNumbers();
        if (includedNumbers.isEmpty()) {
            log.warn("DCO batch ZIP for batch {} has no readable copies ({} failed) — email not sent.", batchId, failedNumbers.size());
            emailNotificationService.recordControlledCopyDcoMisconfiguration(
                    dco.getEmail(), "None of the " + copies.size() + " copies in batch " + batch.getBatchNumber() + " could be read to build the ZIP.");
            auditTrailService.logAs(issuer, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "DCO_ZIP_SEND_FAILED", null, null,
                    "None of the " + copies.size() + " copies could be read to build the DCO ZIP -- email not sent.", List.of(), null);
            return;
        }
        try {
            Map<String, String> variables = new java.util.LinkedHashMap<>();
            variables.put("batchNumber", batch.getBatchNumber() == null ? "" : batch.getBatchNumber());
            variables.put("documentTitle", copies.get(0).getDocumentTitle() == null ? "" : copies.get(0).getDocumentTitle());
            variables.put("revisionNumber", copies.get(0).getRevisionNumber() == null ? "" : copies.get(0).getRevisionNumber());
            variables.put("copyCount", includedNumbers.size() + " of " + copies.size()
                    + (failedNumbers.isEmpty() ? "" : " (" + failedNumbers.size() + " could not be processed — contact Document Control)"));
            variables.put("dcoZipDownloadUrl", emailNotificationService.buildControlledCopyDcoZipDownloadUrl(batchId));
            String zipFileName = "ControlledCopies_Batch_" + sanitizeForFileName(batch.getBatchNumber()) + ".zip";
            emailNotificationService.sendControlledCopyBatchZipToDco(dco, issuer, variables, zipFileName, zipBytes);
            // GMP traceability: an auditor must be able to reconstruct exactly which copies were --
            // and were not -- included in a given ZIP sent to a given DCO on a given date, without
            // relying on application logs alone.
            auditTrailService.logAs(issuer, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "DCO_ZIP_SENT", null, null,
                    "Sent DCO ZIP to " + dco.getFullName() + " (" + dco.getEmail() + "): included " + includedNumbers.size() + " of " + copies.size() + " copies ["
                            + summarizeCopyNumbers(includedNumbers) + "]"
                            + (failedNumbers.isEmpty() ? "" : "; excluded " + failedNumbers.size() + " [" + summarizeCopyNumbers(failedNumbers) + "]"),
                    List.of(), null);
            if (!failedNumbers.isEmpty()) {
                emailNotificationService.recordControlledCopyDcoMisconfiguration(
                        dco.getEmail(), "Batch " + batch.getBatchNumber() + " ZIP was sent but " + failedNumbers.size()
                                + " of " + copies.size() + " copies could not be included: " + String.join(", ", failedNumbers));
            }
        } catch (Exception ex) {
            log.warn("Failed to send DCO batch ZIP email for batch {}: {}", batchId, ex.getMessage(), ex);
            emailNotificationService.recordControlledCopyDcoMisconfiguration(
                    dco.getEmail(), "Batch ZIP for " + batch.getBatchNumber() + " was built (" + includedNumbers.size() + " copies) but could not be emailed: " + ex.getMessage());
            auditTrailService.logAs(issuer, "Controlled Copy Distribution Batch", batch.getBatchNumber(), batch.getId(), "DCO_ZIP_SEND_FAILED", null, null,
                    "DCO ZIP was built (" + includedNumbers.size() + " copies) but could not be emailed: " + ex.getMessage(), List.of(), null);
        }
    }

    /** Caps an audit-trail comment's copy-number listing so a very large batch doesn't produce an unbounded entry. */
    private String summarizeCopyNumbers(List<String> numbers) {
        int cap = 30;
        if (numbers.size() <= cap) {
            return String.join(", ", numbers);
        }
        return String.join(", ", numbers.subList(0, cap)) + ", and " + (numbers.size() - cap) + " more";
    }

    // Package-private (not private): also called from ControlledCopyLifecycleObsolescenceService
    // when a copy is auto-Obsoleted as a cascade of Document/Revision Obsolete or a new Revision
    // publish -- that path previously only wrote an audit trail entry, leaving the copy's holder
    // with no notice that their controlled copy is no longer valid.
    /**
     * The ONE consolidated notification for a Cancel Batch action -- e-mail + in-app -- sent once
     * after every member copy has finished processing, to the actor alone. Replaces the previous
     * per-copy notifyControlledCopyStakeholders() call inside finalizeCancelledCopy(), which fired
     * the same "your batch was cancelled" message once for EACH copy (5 copies = 5 duplicate
     * notifications) and also (incorrectly, for the same reason CANCEL skips it for a single copy
     * -- see notifyControlledCopyStakeholders()) notified each copy's own never-actually-delivered
     * recipient. @Transactional so the batch/actor's lazy associations resolve safely: this is
     * invoked from ControlledCopyBatchCancelAsyncService, an @Async listener with no surrounding
     * transaction of its own (deliberately, so a slow SMTP send never holds a DB connection open).
     */
    @Transactional(readOnly = true)
    public void notifyBatchCancelled(UUID batchId, UUID actorUserId, int succeeded, int failed, int skipped) {
        try {
            if (batchId == null || actorUserId == null) {
                return;
            }
            ControlledCopyDistributionBatch batch = controlledCopyDistributionBatchRepository.findById(batchId).orElse(null);
            UserAccount actor = userAccountRepository.findById(actorUserId).orElse(null);
            if (batch == null || actor == null || !StringUtils.hasText(actor.getEmail())) {
                return;
            }
            int total = succeeded + failed + skipped;
            StringBuilder comment = new StringBuilder("Cancelled ").append(succeeded).append(" of ").append(total)
                    .append(succeeded == 1 ? " controlled copy" : " controlled copies")
                    .append(" in batch ").append(batch.getBatchNumber());
            if (failed > 0) {
                comment.append("; ").append(failed).append(" failed");
            }
            if (skipped > 0) {
                comment.append("; ").append(skipped).append(" skipped (already in a terminal state)");
            }
            Map<String, String> variables = emailNotificationService.buildControlledCopyBatchVariables(
                    batch, actor, actor, "CANCEL", comment.toString(),
                    Map.of(
                            "controlledCopyStatus", batch.getStatus() == null ? "" : batch.getStatus(),
                            "workflowStage", batch.getStatus() == null ? "" : batch.getStatus(),
                            "workflowAction", "CANCEL",
                            "workflowComment", comment.toString()
                    )
            );
            emailNotificationService.sendControlledCopyNotification(
                    resolveControlledCopyNotificationTemplate("CANCEL"), List.of(actor), variables);
        } catch (Exception ex) {
            log.warn("Failed to dispatch batch cancellation notification for batch {}: {}", batchId, ex.getMessage(), ex);
        }
    }

    void notifyControlledCopyStakeholders(ControlledCopyRecord copy, UserAccount actor, String action, String comment) {
        try {
            if (copy == null) {
                return;
            }
            List<UserAccount> recipients = new ArrayList<>();
            if (copy.getRequestedBy() != null) {
                recipients.add(copy.getRequestedBy());
            }
            if (copy.getDistributedBy() != null) {
                recipients.add(copy.getDistributedBy());
            }
            if (copy.getDestroyedBy() != null) {
                recipients.add(copy.getDestroyedBy());
            }
            if (copy.getRecalledBy() != null) {
                recipients.add(copy.getRecalledBy());
            }
            if (copy.getCancelledBy() != null) {
                recipients.add(copy.getCancelledBy());
            }
            if (copy.getApprovedBy() != null) {
                recipients.add(copy.getApprovedBy());
            }
            if (copy.getPrintedBy() != null) {
                recipients.add(copy.getPrintedBy());
            }

            // CANCEL is only ever possible while a copy is still Ready for Distribution (see
            // ensureCanCancel) -- it was NEVER actually handed to its intended recipient. Emailing
            // that recipientUser/external address "your controlled copy has been cancelled" is
            // meaningless to them (they never knew it existed) and reads as a confusing, out-of-
            // context message. The person who actually needs to know is whoever is tracking this
            // request -- the requester (and the actor who cancelled it, if different) -- not the
            // never-notified intended recipient. RECALL is the correct analog for a copy that WAS
            // actually distributed (see ensureCanRecall), and still notifies the recipient as before.
            boolean isPreDistributionCancel = "CANCEL".equalsIgnoreCase(action);

            // The actual recipient is already notified above (policy-managed dispatch, the direct
            // generic send, or -- for DISTRIBUTE -- the dedicated distribution e-mail sent
            // separately). Excluding them here prevents a second, different-looking e-mail to the
            // same person whenever the recipient also happens to be one of the internal actors
            // below -- most commonly true whenever someone requests a copy for themselves
            // (recipientUser == requestedBy). Not applicable to CANCEL: recipientUser is being
            // skipped entirely above, and there is nothing to de-duplicate against.
            UUID recipientUserId = copy.getRecipientUser() == null ? null : copy.getRecipientUser().getId();
            // The person who just performed THIS action (`actor`) never needs a "stakeholder" ping
            // about their own click -- they already know it happened (they're watching the
            // progress modal/result). Without this, distributedBy is set to the batch-distribute
            // actor on every member copy synchronously, so whoever runs Distribute Batch ends up as
            // a stakeholder on every one of its N copies and gets N near-identical in-app/e-mail
            // notifications about the batch action they themselves just triggered.
            //
            // CANCEL is the one exception: it is the ONLY notification this request will ever
            // generate (the recipientUser branch below is skipped for it), so the requester -- who
            // in the common case (self-service cancel of one's own request) IS the actor -- must
            // still get a durable e-mail/in-app record of it, not just a transient success toast.
            UUID actorId = actor == null || isPreDistributionCancel ? null : actor.getId();
            recipients = recipients.stream()
                    .filter(java.util.Objects::nonNull)
                    .filter(recipient -> recipientUserId == null || !recipientUserId.equals(recipient.getId()))
                    .filter(recipient -> actorId == null || !actorId.equals(recipient.getId()))
                    .distinct()
                    .toList();

            // Independent of the internal-actors list below: this copy's actual recipient (an
            // internal user, or an external e-mail address) must be notified regardless of whether
            // any internal actor happens to be attached to this copy.
            String policyEvent = resolveControlledCopyPolicyEvent(action);
            String templateType = resolveControlledCopyNotificationTemplate(action);
            if (isPreDistributionCancel) {
                // Skipped -- see isPreDistributionCancel above.
            } else if (copy.getRecipientUser() != null) {
                if (StringUtils.hasText(policyEvent)) {
                    Map<String, String> policyVariables = emailNotificationService.buildControlledCopyVariables(
                            copy, actor, copy.getRecipientUser(), action, comment, Map.of("actionUrl",
                                    "/documents/controlled-copies/" + copy.getId())
                    );
                    notificationDispatcher.dispatch(policyEvent, List.of(copy.getRecipientUser()), policyVariables);
                } else if (!"DISTRIBUTE".equalsIgnoreCase(action)
                        && copy.getRecipientUser().getEmail() != null && !copy.getRecipientUser().getEmail().isBlank()) {
                    // No admin-managed notification policy exists for this action (e.g. OBSOLETE) --
                    // still notify the named internal recipient directly via the plain template.
                    // Without this, they'd only be notified when they also happen to be one of the
                    // internal actors below (requestedBy/distributedBy/...), which for a cascaded
                    // Obsolete (someone else's action on the source Revision/Document) is never true.
                    // DISTRIBUTE is excluded: sendControlledCopyDistributionNotification() already
                    // notifies this exact recipient with the dedicated (preview link + password)
                    // e-mail -- sending this generic one too would be a duplicate, different-looking
                    // notification for the same single action.
                    Map<String, String> recipientVariables = emailNotificationService.buildControlledCopyVariables(
                            copy, actor, copy.getRecipientUser(), action, comment, Map.of(
                                    "controlledCopyStatus", copy.getStatus() == null ? "" : copy.getStatus(),
                                    "workflowStage", copy.getCurrentStage() == null ? "" : copy.getCurrentStage(),
                                    "workflowAction", action == null ? "" : action,
                                    "workflowComment", comment == null ? "" : comment
                            )
                    );
                    emailNotificationService.sendControlledCopyNotification(templateType, List.of(copy.getRecipientUser()), recipientVariables);
                }
            } else {
                // External copies have no internal login account -- the recipient is only an
                // e-mail address (see isExternalDistribution()/distribute()). Without this branch,
                // an external recipient who actually holds the file/preview link never learns it
                // was Recalled/Cancelled/Destroyed -- they'd only find out by hitting an Access
                // Denied page next time they open the (now-blocked) link.
                String recipientEmail = normalize(copy.getRecipientName());
                if (StringUtils.hasText(recipientEmail) && isValidEmailAddress(recipientEmail)) {
                    Map<String, String> externalVariables = emailNotificationService.buildControlledCopyVariables(
                            copy, actor, null, action, comment, Map.of("actionUrl", "")
                    );
                    emailNotificationService.sendControlledCopyNotificationToEmails(templateType, List.of(recipientEmail), externalVariables);
                }
            }

            if (recipients.isEmpty()) {
                return;
            }

            for (UserAccount recipient : recipients) {
                if (recipient.getEmail() == null || recipient.getEmail().isBlank()) {
                    continue;
                }
                Map<String, String> variables = emailNotificationService.buildControlledCopyVariables(
                        copy,
                        actor,
                        recipient,
                        action,
                        comment,
                        Map.of(
                                "controlledCopyStatus", copy.getStatus() == null ? "" : copy.getStatus(),
                                "workflowStage", copy.getCurrentStage() == null ? "" : copy.getCurrentStage(),
                                "workflowAction", action == null ? "" : action,
                                "workflowComment", comment == null ? "" : comment,
                                "documentTitle", copy.getDocumentTitle() == null ? "" : copy.getDocumentTitle(),
                                "documentNumber", copy.getDocumentNumber() == null ? "" : copy.getDocumentNumber(),
                                "revisionNumber", copy.getRevisionNumber() == null ? "" : copy.getRevisionNumber()
                        )
                );
                if (StringUtils.hasText(policyEvent)) {
                    variables.put("notificationPolicyManaged", "true");
                }
                emailNotificationService.sendControlledCopyNotification(templateType, List.of(recipient), variables);
            }
        } catch (Exception ex) {
            log.warn("Failed to dispatch controlled copy email notification for copy {}: {}", copy == null ? null : copy.getControlledCopyNumber(), ex.getMessage(), ex);
        }
    }

    private String resolveControlledCopyNotificationTemplate(String action) {
        String normalized = normalize(action).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CANCEL" -> EmailTemplateTypeUtils.CONTROLLED_COPY_CANCELLATION_NOTIFICATION;
            case "RECALL" -> EmailTemplateTypeUtils.CONTROLLED_COPY_RECALL_NOTIFICATION;
            // Cascaded from the source Revision/Document being Obsoleted (manually or
            // automatically) -- see ControlledCopyLifecycleObsolescenceService. Distinct from
            // Recall so the recipient understands the copy became invalid because of its SOURCE,
            // not because someone recalled the copy itself.
            case "OBSOLETE" -> EmailTemplateTypeUtils.CONTROLLED_COPY_OBSOLETED_NOTIFICATION;
            default -> EmailTemplateTypeUtils.CONTROLLED_COPY_NOTIFICATION;
        };
    }

    private String resolveControlledCopyPolicyEvent(String action) {
        String normalized = normalize(action).toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "RECALL" -> "controlled_copy.recalled";
            case "DESTROY", "DESTROYED" -> "controlled_copy.destroyed";
            default -> null;
        };
    }

    private String buildControlledCopyRecordActionComment(ControlledCopyRecord copy, String action, String reason) {
        String scope = "Record";
        String copyNumber = copy == null ? "" : firstNonBlank(copy.getControlledCopyNumber(), copy.getId() == null ? null : copy.getId().toString());
        String document = copy == null ? "" : firstNonBlank(copy.getDocumentNumber(), copy.getDocumentTitle());
        String revision = copy == null ? "" : firstNonBlank(copy.getRevisionNumber(), "");
        return "Controlled Copy " + action + " (" + scope + "); Copy Number: " + copyNumber
                + "; Document: " + document
                + "; Revision: " + revision
                + "; Reason: " + normalize(reason);
    }

    private String buildControlledCopyBatchActionComment(ControlledCopyDistributionBatch batch, String action, String reason) {
        String scope = "Batch";
        String batchNumber = batch == null ? "" : firstNonBlank(batch.getBatchNumber(), batch.getId() == null ? null : batch.getId().toString());
        String document = batch == null ? "" : firstNonBlank(batch.getDocumentTitle(), batch.getDocumentNumber());
        String revision = batch == null ? "" : firstNonBlank(batch.getRevisionNumber(), "");
        String quantity = batch == null ? "" : String.valueOf(Math.max(batch.getQuantity(), 0));
        return "Controlled Copy " + action + " (" + scope + "); Batch Number: " + batchNumber
                + "; Quantity: " + quantity
                + "; Document: " + document
                + "; Revision: " + revision
                + "; Reason: " + normalize(reason);
    }

    private UUID requireValidSignatureToken(String signatureToken, UserAccount currentUser, String actionName) {
        if (!StringUtils.hasText(signatureToken)) {
            throw new IllegalArgumentException("Electronic signature is required for " + actionName);
        }
        return signatureTokenConsumptionService.requireAndConsume(signatureToken, currentUser);
    }
}


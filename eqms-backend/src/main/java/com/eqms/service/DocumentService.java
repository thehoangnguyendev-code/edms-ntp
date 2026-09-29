package com.eqms.service;

import com.eqms.auth.TokenService;
import com.eqms.auth.CurrentUserService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.eqms.exception.DocumentLifecycleConflictException;
import com.eqms.dto.security.FileAccessContext;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.dto.audittrail.AuditTrailRecordResponse;
import com.eqms.dto.document.DocumentFiltersResponse;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentActiveWorkflowConfigurationRequest;
import com.eqms.dto.document.DocumentDetailResponse;
import com.eqms.dto.document.DocumentCancelRequest;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.document.DocumentObsoleteRequest;
import com.eqms.dto.document.DocumentAuditTrailResponse;
import com.eqms.dto.document.DocumentAuditTrailUserResponse;
import com.eqms.dto.document.DocumentParticipantResponse;
import com.eqms.dto.document.DocumentRelationResponse;
import com.eqms.dto.document.DocumentRelationPageRequest;
import com.eqms.dto.document.DocumentRevisionSummaryResponse;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.dto.document.LegacyBatchImportResponse;
import com.eqms.dto.document.SignatureResponse;
import com.eqms.dto.document.StatusResponse;
import com.eqms.dto.document.KnowledgeBaseDocumentResponse;
import com.eqms.dto.document.KnowledgeBaseDepartmentResponse;
import com.eqms.dto.document.KnowledgeBaseFolderResponse;
import com.eqms.dto.document.KnowledgeBaseResponse;
import com.eqms.dto.user.LookupItemResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStakeholderHistory;
import com.eqms.entity.DocumentRelation;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.entity.AuditLog;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.DocumentWorkflowSetting;
import com.eqms.entity.DocumentWorkflowParticipant;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentSubType;
import com.eqms.entity.ReviewRequirement;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.RevisionWorkflowHistory;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStakeholderHistoryRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.DocumentSubTypeRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.DocumentWorkflowSettingRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import com.eqms.repository.RevisionWorkflowHistoryRepository;
import com.eqms.repository.RevisionPublishingMetadataRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.util.StatusMapper;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.util.Matrix;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.Arrays;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final DateTimeFormatter DMY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DMY_DATETIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final ZoneId SYSTEM_ZONE = ZoneId.systemDefault();

    // Field-injected (not added to the constructor below) -- same pattern already used elsewhere
    // in this codebase to add a dependency without churning a very large existing constructor.
    // Phase 2 of the Document Name Formats feature: generateDocumentNumber() below uses this
    // instead of a second hardcoded "%s.%04d" (the DictionaryManagementService preview copy of
    // that same literal had already drifted once before this was centralized).
    @org.springframework.beans.factory.annotation.Autowired
    private DocumentComponentResolver documentComponentResolver;
    @org.springframework.beans.factory.annotation.Autowired
    private com.eqms.repository.DocumentNameFormatRepository documentNameFormatRepository;

    private final DocumentRecordRepository documentRepository;
    private final DocumentStatusDefinitionRepository statusRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentSubTypeRepository documentSubTypeRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;
    private final UserAccountRepository userAccountRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    private final DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final DocumentRelationRepository documentRelationRepository;
    private final AuditLogRepository auditLogRepository;
    private final DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    private final AuditTrailService auditTrailService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final CurrentUserService currentUserService;
    private final TokenService tokenService;
    private final RevisionStatusDefinitionRepository revisionStatusRepository;
    private final RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final FileStorageService fileStorageService;
    private final SystemConfigurationService systemConfigurationService;
    private final RevisionPublishingMetadataRepository publishingMetadataRepository;
    private final ControlledCopyBatchStatusService controlledCopyBatchStatusService;

    // Field-injected (not constructor-injected) to avoid widening the already-large constructor
    // below; see TBR-DOC-013/014 -- canonical Controlled-Copy-obsolescence operation shared with
    // RevisionService's publish-supersede cascade.
    @org.springframework.beans.factory.annotation.Autowired
    private ControlledCopyLifecycleObsolescenceService controlledCopyLifecycleObsolescenceService;

    // TBR-DOC-016: publishes DocumentObsoletedEvent only after obsoleteDocument's own transaction
    // commits (Spring's default event-publish timing is immediate/synchronous within the current
    // transaction; the AFTER_COMMIT contract is enforced on the LISTENER side via
    // @TransactionalEventListener(phase = AFTER_COMMIT) in DocumentObsoleteNotificationService, not
    // here -- publishing here only queues the event for that listener).
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.context.ApplicationEventPublisher applicationEventPublisher;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuthorizationShadowEvaluationService shadowEvaluationService;
    private final com.eqms.service.authorization.AuthorizationEngineService authorizationEngineService;
    private final com.eqms.service.authorization.AuthorizationCutoverFlags cutoverFlags;
    private final ElectronicSignatureService electronicSignatureService;
    private final RevisionService revisionService;
    private final WorkflowParticipantEligibilityService workflowParticipantEligibilityService;
    private final SecureFileAccessService secureFileAccessService;
    private final SignatureTokenConsumptionService signatureTokenConsumptionService;

    // Field-injected for the same reason as RevisionService's own objectMapper field -- used only
    // by createLegacyImportDocumentAndRevisions to parse the "document" JSON multipart part.
    @org.springframework.beans.factory.annotation.Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public DocumentService(
            DocumentRecordRepository documentRepository,
            DocumentStatusDefinitionRepository statusRepository,
            DocumentTypeRepository documentTypeRepository,
            DocumentSubTypeRepository documentSubTypeRepository,
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            UserAccountRepository userAccountRepository,
            DocumentRevisionRepository documentRevisionRepository,
            DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository,
            DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            DocumentRelationRepository documentRelationRepository,
            AuditLogRepository auditLogRepository,
            DocumentWorkflowSettingRepository documentWorkflowSettingRepository,
            AuditTrailService auditTrailService,
            DocumentAuthorizationService documentAuthorizationService,
            CurrentUserService currentUserService,
            TokenService tokenService,
            RevisionStatusDefinitionRepository revisionStatusRepository,
            RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository,
            ControlledCopyRepository controlledCopyRepository,
            FileStorageService fileStorageService,
            SystemConfigurationService systemConfigurationService,
            RevisionPublishingMetadataRepository publishingMetadataRepository,
            ControlledCopyBatchStatusService controlledCopyBatchStatusService,
            PermissionEvaluationService permissionEvaluationService,
            AuthorizationShadowEvaluationService shadowEvaluationService,
            @org.springframework.context.annotation.Lazy com.eqms.service.authorization.AuthorizationEngineService authorizationEngineService,
            com.eqms.service.authorization.AuthorizationCutoverFlags cutoverFlags,
            ElectronicSignatureService electronicSignatureService,
            @org.springframework.context.annotation.Lazy RevisionService revisionService,
            WorkflowParticipantEligibilityService workflowParticipantEligibilityService,
            SecureFileAccessService secureFileAccessService,
            SignatureTokenConsumptionService signatureTokenConsumptionService
    ) {
        this.documentRepository = documentRepository;
        this.statusRepository = statusRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.documentSubTypeRepository = documentSubTypeRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.departmentRepository = departmentRepository;
        this.userAccountRepository = userAccountRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.documentWorkflowParticipantRepository = documentWorkflowParticipantRepository;
        this.documentStakeholderHistoryRepository = documentStakeholderHistoryRepository;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.documentRelationRepository = documentRelationRepository;
        this.auditLogRepository = auditLogRepository;
        this.documentWorkflowSettingRepository = documentWorkflowSettingRepository;
        this.auditTrailService = auditTrailService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.currentUserService = currentUserService;
        this.tokenService = tokenService;
        this.revisionStatusRepository = revisionStatusRepository;
        this.revisionWorkflowHistoryRepository = revisionWorkflowHistoryRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.fileStorageService = fileStorageService;
        this.systemConfigurationService = systemConfigurationService;
        this.publishingMetadataRepository = publishingMetadataRepository;
        this.controlledCopyBatchStatusService = controlledCopyBatchStatusService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.shadowEvaluationService = shadowEvaluationService;
        this.authorizationEngineService = authorizationEngineService;
        this.cutoverFlags = cutoverFlags;
        this.electronicSignatureService = electronicSignatureService;
        this.revisionService = revisionService;
        this.workflowParticipantEligibilityService = workflowParticipantEligibilityService;
        this.secureFileAccessService = secureFileAccessService;
        this.signatureTokenConsumptionService = signatureTokenConsumptionService;
    }

    /**
     * Runs the new hybrid engine alongside the direct permission check above for UPDATE_METADATA,
     * logs any disagreement, and -- once {@link AuthorizationCutoverFlags} enables DOCUMENT
     * (Phase 1-2.5 cutover rule 3) -- returns the engine's allowed/denied decision as the real
     * one instead of the legacy permission check. Mirrors the mechanism in
     * {@link RevisionWorkflowAuthorizationService#check} and
     * {@link DocumentMasterWorkflowAuthorizationService#check}.
     */
    private boolean evaluateUpdateMetadataAllowed(UserAccount user, DocumentRecord document, boolean legacyAllowed) {
        if (user == null || document == null || document.getId() == null) {
            return legacyAllowed;
        }
        try {
            var policyDecision = authorizationEngineService.authorize(
                    com.eqms.service.authorization.AuthorizationRequest.of(
                            user, "DOCUMENT", document.getId(), "UPDATE_METADATA"));
            shadowEvaluationService.recordMismatch(
                    user, "DOCUMENT", document.getId(), "UPDATE_METADATA",
                    policyDecision, legacyAllowed, legacyAllowed ? null : "MISSING_PERMISSION");
            if (cutoverFlags != null && cutoverFlags.isEnabled("DOCUMENT")) {
                return policyDecision.allowed();
            }
        } catch (Exception e) {
            log.warn("Shadow evaluation failed for document {} action UPDATE_METADATA: {}", document.getId(), e.getMessage());
        }
        return legacyAllowed;
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentListItemResponse> listDocuments(
            String scope,
            String search,
            String ids,
            String status,
            String documentType,
            String businessUnit,
            String department,
            String authorId,
            String author,
            String relatedDocument,
            String correlatedDocument,
            String isTemplate,
            String createdFrom,
            String createdTo,
            String effectiveFrom,
            String effectiveTo,
            String validFrom,
            String validTo,
            String sortBy,
            String sortDirection,
            int page,
            int limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;

        PageRequest pageable = PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, sortProperty));
        Page<DocumentRecord> result = documentRepository.findAll(buildSpecification(
                scope, search, ids, status, documentType, businessUnit, department, authorId, author,
                relatedDocument, correlatedDocument, isTemplate,
                createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                currentUser
        ), pageable);

        List<DocumentListItemResponse> items = result.getContent().stream()
                .map(this::toListItem)
                .toList();

        return new PageResponse<>(
                items,
                new PaginationResponse(
                        safePage,
                        safeLimit,
                        result.getTotalElements(),
                        result.getTotalPages()
                )
        );
    }

    @Transactional(readOnly = true)
    public List<DocumentListItemResponse> listSelectableTemplates(
            String search,
            String documentType,
            String subType,
            String sortBy,
            String sortDirection,
            int limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requireTemplateUse(currentUser);
        if (!StringUtils.hasText(documentType)) {
            throw new IllegalArgumentException("Document type is required to select a template");
        }
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        DocumentType requiredType = resolveDocumentType(documentType);
        String normalizedSearch = Optional.ofNullable(normalizeString(search)).orElse("").toLowerCase(Locale.ROOT);
        String normalizedSubType = normalizeString(subType);

        // Templates are authoring aids, not scoped document content.  The use permission is the
        // entitlement gate; Type is always exact and a template Sub-Type, when present, is exact.
        Specification<DocumentRecord> specification = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isTrue(root.get("template")));
            predicates.add(cb.equal(root.get("status").get("code"), "ACTIVE"));
            predicates.add(cb.equal(root.get("documentType").get("id"), requiredType.getId()));
            if (StringUtils.hasText(normalizedSubType)) {
                predicates.add(cb.or(
                        cb.isNull(root.get("subType")),
                        cb.equal(cb.lower(root.get("subType")), normalizedSubType.toLowerCase(Locale.ROOT))
                ));
            } else {
                predicates.add(cb.isNull(root.get("subType")));
            }
            if (StringUtils.hasText(normalizedSearch)) {
                String pattern = "%" + normalizedSearch + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("documentNumber")), pattern),
                        cb.like(cb.lower(root.get("documentName")), pattern),
                        cb.like(cb.lower(root.get("titleLocalLanguage")), pattern)
                ));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        List<DocumentListItemResponse> templates = new ArrayList<>();
        int page = 0;
        Page<DocumentRecord> candidates;
        do {
            candidates = documentRepository.findAll(
                    specification,
                    PageRequest.of(page++, safeLimit, Sort.by(direction, sortProperty))
            );
            for (DocumentRecord candidate : candidates.getContent()) {
                if (isSelectableTemplateDocument(candidate)) {
                    templates.add(toListItem(candidate));
                    if (templates.size() == safeLimit) {
                        return templates;
                    }
                }
            }
        } while (candidates.hasNext());

        return templates;
    }

    @Transactional(readOnly = true)
    public void writeDocumentsExport(
            String scope,
            String search,
            String ids,
            String status,
            String documentType,
            String businessUnit,
            String department,
            String authorId,
            String author,
            String relatedDocument,
            String correlatedDocument,
            String isTemplate,
            String createdFrom,
            String createdTo,
            String effectiveFrom,
            String effectiveTo,
            String validFrom,
            String validTo,
            String sortBy,
            String sortDirection,
            java.io.OutputStream outputStream
    ) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
            writer.println("Document Number,Document Name,Version,Status,Document Type,Business Unit,Department,Author,Opened By,Created Date,Effective Date,Valid Until,Has Related Documents,Has Correlated Documents,Is Template,Last Modified Date,Last Modified By");
            Specification<DocumentRecord> specification = buildSpecification(
                    scope, search, ids, status, documentType, businessUnit, department, authorId, author,
                    relatedDocument, correlatedDocument, isTemplate,
                    createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                    currentUser
            );
            int page = 0;
            Page<DocumentRecord> result;
            do {
                result = documentRepository.findAll(specification, PageRequest.of(page++, 500, Sort.by(direction, sortProperty)));
                for (DocumentRecord document : result.getContent()) {
                    DocumentListItemResponse item = toListItem(document);
                    writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                            csv(item.documentNumber()),
                            csv(item.documentName()),
                            csv(item.version()),
                            csv(item.status()),
                            csv(item.type()),
                            csv(item.businessUnit()),
                            csv(item.department()),
                            csv(item.author()),
                            csv(item.openedBy()),
                            csv(item.created()),
                            csv(item.effectiveDate()),
                            csv(item.validUntil()),
                            csv(Boolean.toString(item.hasRelatedDocuments())),
                            csv(Boolean.toString(item.hasCorrelatedDocuments())),
                            csv(Boolean.toString(item.isTemplate())),
                            csv(item.lastModifiedDate()),
                            csv(item.lastModifiedBy())
                    );
                }
                writer.flush();
            } while (result.hasNext());
        }
    }

    @Transactional
    public DocumentDetailResponse getDocumentDetail(UUID documentId) {
        return getDocumentDetailInternal(documentId, true);
    }

    @Transactional(readOnly = true)
    public DocumentDetailResponse getDocumentDetailForSnapshot(UUID documentId) {
        return getDocumentDetailInternal(documentId, false);
    }

    private DocumentDetailResponse getDocumentDetailInternal(UUID documentId, boolean markOpened) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        ensureCurrentUserCanViewDocument(document, currentUser);

        if (markOpened) {
            document.setOpenedBy(currentUser);
            documentRepository.save(document);
            auditTrailService.logAs(
                    currentUser,
                    "DOCUMENT",
                    document.getDocumentNumber() + " - " + document.getDocumentName(),
                    document.getId(),
                    "VIEW",
                    document.getStatus() == null ? null : document.getStatus().getCode(),
                    document.getStatus() == null ? null : document.getStatus().getCode(),
                    "Opened document detail"
            );
        }

        List<DocumentParticipantResponse> reviewers = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "REVIEWER")
                .stream()
                .map(participant -> toParticipantResponse(participant, participant.getSequenceOrder()))
                .toList();

        List<DocumentParticipantResponse> approvers = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "APPROVER")
                .stream()
                .map(participant -> toParticipantResponse(participant, participant.getSequenceOrder()))
                .toList();

        List<DocumentParticipantResponse> coAuthors = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "CO_AUTHOR")
                .stream()
                .map(participant -> toParticipantResponse(participant, participant.getSequenceOrder()))
                .toList();

        List<DocumentRelationResponse> relatedDocuments = documentRelationRepository
                .findAllBySourceDocument_IdAndRelationType(documentId, "RELATED")
                .stream()
                .map(relation -> toRelationResponse(relation, "RELATED"))
                .toList();

        List<DocumentRelationResponse> correlatedDocuments = documentRelationRepository
                .findAllBySourceDocument_IdAndRelationType(documentId, "CORRELATED")
                .stream()
                .map(relation -> toRelationResponse(relation, "CORRELATED"))
                .toList();

        List<DocumentRevisionRecord> revisionRecords = new ArrayList<>(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId));
        revisionRecords.sort(REVISION_COMPARATOR);
        DocumentRevisionRecord latestRevision = revisionRecords.isEmpty() ? null : revisionRecords.get(0);

        List<DocumentRevisionSummaryResponse> revisions = revisionRecords.stream()
                .map(this::toRevisionSummary)
                .toList();

        return new DocumentDetailResponse(
                document.getId().toString(),
                document.getDocumentNumber(),
                document.getDocumentName(),
                document.getTitleLocalLanguage(),
                document.getVersion(),
                document.getStatus() == null ? null : document.getStatus().getLabel(),
                new StatusResponse(document.getStatus() == null ? null : document.getStatus().getCode(), document.getStatus() == null ? null : document.getStatus().getLabel()),
                document.getDocumentType() == null ? null : document.getDocumentType().getName(),
                document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName(),
                document.getDepartment() == null ? null : document.getDepartment().getName(),
                document.getAuthor() == null ? null : document.getAuthor().getFullName(),
                document.getOwner() == null ? null : document.getOwner().getFullName(),
                document.getOpenedBy() == null ? null : document.getOpenedBy().getFullName(),
                DateTimeFormatUtils.formatDateTime(document.getCreatedAt()),
                DateTimeFormatUtils.formatDate(document.getEffectiveDate()),
                DateTimeFormatUtils.formatDate(document.getValidUntil()),
                DateTimeFormatUtils.formatDate(document.getReviewDate()),
                document.getDescription(),
                document.getKnowledgeBase(),
                document.getSubType(),
                resolveDocumentReviewRequirement(document).name(),
                resolvePeriodicReviewCycle(document),
                resolvePeriodicReviewNotification(document),
                document.getLanguage(),
                document.isRequiresTraining(),
                document.getTrainingPeriodDays(),
                document.getReasonForSkippingTraining(),
                document.isTemplate(),
                DateTimeFormatUtils.formatDateTime(document.getUpdatedAt()),
                document.getLastModifiedBy() == null ? null : document.getLastModifiedBy().getFullName(),
                document.isHasRelatedDocuments(),
                document.isHasCorrelatedDocuments(),
                reviewers.size(),
                approvers.size(),
                coAuthors,
                reviewers,
                approvers,
                relatedDocuments,
                correlatedDocuments,
                revisions,
                buildDocumentSignatures(document, latestRevision),
                documentAuthorizationService.canStartNewRevisionUpload(currentUser, document),
                canRequestControlledCopy(currentUser, document, revisionRecords),
                revisionService.resolveNextDraftRevisionNumberForDocument(documentId),
                document.getAuthor() == null ? null : document.getAuthor().getId().toString(),
                resolvePreviewVersionToken(revisionRecords)
        );
    }

    /** Same EFFECTIVE-revision resolution as {@link #resolveActiveRevision}, but null-safe (no
     *  revisions yet is a normal state for this read-only summary, not an error) and returning
     *  the published PDF's own storage path (MinIO URIs are version-scoped, e.g.
     *  {@code ...?versionId=...}) as a cheap, always-correct change-detection token -- avoids
     *  needing a dedicated version counter, since the storage path itself already changes on
     *  every regeneration. */
    private String resolvePreviewVersionToken(List<DocumentRevisionRecord> sortedRevisions) {
        DocumentRevisionRecord effective = sortedRevisions.stream()
                .filter(r -> r.getStatus() != null && "EFFECTIVE".equalsIgnoreCase(r.getStatus().getCode()))
                .findFirst()
                .orElse(sortedRevisions.isEmpty() ? null : sortedRevisions.get(0));
        if (effective == null) {
            return null;
        }
        return publishingMetadataRepository.findByRevision_Id(effective.getId())
                .map(RevisionPublishingMetadata::getPublishedPdfPath)
                .filter(StringUtils::hasText)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<SignatureResponse> getDocumentSignatures(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        ensureCurrentUserCanViewDocument(document, currentUser);
        List<DocumentRevisionRecord> revisionRecords = new ArrayList<>(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId));
        revisionRecords.sort(REVISION_COMPARATOR);
        DocumentRevisionRecord latestRevision = revisionRecords.isEmpty() ? null : revisionRecords.get(0);
        return buildDocumentSignatures(document, latestRevision);
    }

    @Transactional(readOnly = true)
    public List<DocumentRevisionSummaryResponse> getDocumentRevisions(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        ensureCurrentUserCanViewDocument(document, currentUser);

        List<DocumentRevisionRecord> revisionRecords = new ArrayList<>(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId));
        revisionRecords.sort(REVISION_COMPARATOR);
        List<DocumentRevisionSummaryResponse> revisions = revisionRecords.stream()
                .map(this::toRevisionSummary)
                .toList();

        return revisions;
    }

    /**
     * One page of a document's revisions, searched and sorted by the server. Same visibility rule as
     * {@link #getDocumentRevisions}; the set per document is small, so it is filtered in memory and only the requested page
     * is mapped to summaries (which include a per-revision capability check).
     */
    @Transactional(readOnly = true)
    public PageResponse<DocumentRevisionSummaryResponse> getDocumentRevisionsPage(
            UUID documentId, String search, String sortBy, String sortDirection, int page, int limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        ensureCurrentUserCanViewDocument(document, currentUser);

        String query = normalize(search);
        List<DocumentRevisionRecord> records = new ArrayList<>(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId));
        records.removeIf(r -> StringUtils.hasText(query) && !(
                containsIgnoreCase(r.getRevisionNumber(), query)
                        || containsIgnoreCase(r.getRevisionName(), query)
                        || containsIgnoreCase(r.getOpenedBy() == null ? null : r.getOpenedBy().getFullName(), query)));

        Comparator<String> text = Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
        boolean descending = !"asc".equalsIgnoreCase(sortDirection);
        Comparator<DocumentRevisionRecord> comparator;
        switch (sortBy == null ? "" : sortBy) {
            case "created" -> comparator = Comparator.comparing(DocumentRevisionRecord::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "openedBy" -> comparator = Comparator.comparing(r -> r.getOpenedBy() == null ? null : r.getOpenedBy().getFullName(), text);
            case "revisionName" -> comparator = Comparator.comparing(DocumentRevisionRecord::getRevisionName, text);
            case "status" -> comparator = Comparator.comparing(r -> StatusMapper.label(r.getStatus()), text);
            default -> {
                // Revision number. REVISION_COMPARATOR is newest first, i.e. already the descending order.
                comparator = descending ? REVISION_COMPARATOR : REVISION_COMPARATOR.reversed();
                descending = false;
            }
        }
        if (descending) {
            comparator = comparator.reversed();
        }
        records.sort(comparator.thenComparing(REVISION_COMPARATOR));

        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        int from = Math.min((safePage - 1) * safeLimit, records.size());
        List<DocumentRevisionSummaryResponse> data = records.subList(from, Math.min(from + safeLimit, records.size()))
                .stream().map(this::toRevisionSummary).toList();
        int totalPages = Math.max(1, (int) Math.ceil(records.size() / (double) safeLimit));
        return new PageResponse<>(data, new PaginationResponse(safePage, safeLimit, records.size(), totalPages));
    }

    /**
     * One page of the Related / Correlated documents a user has selected. Only documents the caller may view are ever
     * returned, so the endpoint cannot be used to read metadata of arbitrary document ids.
     */
    @Transactional(readOnly = true)
    public PageResponse<DocumentRelationResponse> getDocumentRelationsPage(DocumentRelationPageRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        String relationType = "CORRELATED".equalsIgnoreCase(request.relationType()) ? "CORRELATED" : "RELATED";
        List<UUID> ids = request.ids() == null ? List.of() : request.ids().stream()
                .map(this::tryParseUuid).filter(Objects::nonNull).distinct().limit(500).toList();
        String query = normalize(request.search());

        List<DocumentRecord> targets = new ArrayList<>(documentRepository.findAllById(ids));
        targets.removeIf(d -> !documentAuthorizationService.canViewDocument(currentUser, d));
        targets.removeIf(d -> StringUtils.hasText(query) && !(
                containsIgnoreCase(d.getDocumentNumber(), query)
                        || containsIgnoreCase(d.getDocumentName(), query)
                        || containsIgnoreCase(d.getOpenedBy() == null ? null : d.getOpenedBy().getFullName(), query)
                        || containsIgnoreCase(d.getAuthor() == null ? null : d.getAuthor().getFullName(), query)
                        || containsIgnoreCase(d.getDepartment() == null ? null : d.getDepartment().getName(), query)
                        || containsIgnoreCase(d.getDocumentType() == null ? null : d.getDocumentType().getName(), query)));

        Comparator<String> text = Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER);
        Comparator<DocumentRecord> comparator = switch (request.sortBy() == null ? "" : request.sortBy()) {
            case "documentName" -> Comparator.comparing(DocumentRecord::getDocumentName, text);
            case "created" -> Comparator.comparing(DocumentRecord::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "openedBy" -> Comparator.comparing(d -> d.getOpenedBy() == null ? null : d.getOpenedBy().getFullName(), text);
            case "status" -> Comparator.comparing(d -> d.getStatus() == null ? null : d.getStatus().getLabel(), text);
            case "type" -> Comparator.comparing(d -> d.getDocumentType() == null ? null : d.getDocumentType().getName(), text);
            case "department" -> Comparator.comparing(d -> d.getDepartment() == null ? null : d.getDepartment().getName(), text);
            case "author" -> Comparator.comparing(d -> d.getAuthor() == null ? null : d.getAuthor().getFullName(), text);
            case "effectiveDate" -> Comparator.comparing(DocumentRecord::getEffectiveDate, Comparator.nullsLast(Comparator.naturalOrder()));
            case "validUntil" -> Comparator.comparing(DocumentRecord::getValidUntil, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> Comparator.comparing(DocumentRecord::getDocumentNumber, text);
        };
        if ("desc".equalsIgnoreCase(request.sortDirection())) {
            comparator = comparator.reversed();
        }
        targets.sort(comparator.thenComparing(DocumentRecord::getDocumentNumber, text));

        int safeLimit = Math.min(Math.max(request.limit() == null ? 10 : request.limit(), 1), 100);
        int safePage = Math.max(request.page() == null ? 1 : request.page(), 1);
        int from = Math.min((safePage - 1) * safeLimit, targets.size());
        List<DocumentRelationResponse> data = targets.subList(from, Math.min(from + safeLimit, targets.size())).stream()
                .map(target -> {
                    DocumentRelation relation = new DocumentRelation();
                    relation.setTargetDocument(target);
                    return toRelationResponse(relation, relationType);
                }).toList();
        int totalPages = Math.max(1, (int) Math.ceil(targets.size() / (double) safeLimit));
        return new PageResponse<>(data, new PaginationResponse(safePage, safeLimit, targets.size(), totalPages));
    }

    private static boolean containsIgnoreCase(String value, String lowerCaseQuery) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(lowerCaseQuery);
    }

    @Transactional(readOnly = true)
    public List<AuditTrailRecordResponse> getDocumentAuditTrail(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        ensureCurrentUserCanViewDocument(document, currentUser);

        return auditTrailService.getByEntityForAuthorizedDocument("DOCUMENT", documentId);
    }

    private DocumentAuditTrailResponse safeToAuditTrailResponse(AuditLog auditLog) {
        try {
            return toAuditTrailResponse(auditLog);
        } catch (Exception ex) {
            log.warn("Failed to map document audit trail record {}: {}", auditLog == null ? null : auditLog.getId(), ex.getMessage());
            String actionType = auditLog == null || auditLog.getActionType() == null
                    ? null
                    : auditLog.getActionType().trim().toUpperCase(Locale.ROOT);
            return new DocumentAuditTrailResponse(
                    auditLog == null || auditLog.getId() == null ? null : auditLog.getId().toString(),
                    auditLog == null || auditLog.getCreatedAt() == null ? null : DateTimeFormatUtils.formatDateTime(auditLog.getCreatedAt()),
                    null,
                    resolveAuditActionLabel(actionType),
                    actionType,
                    List.of(),
                    auditLog == null ? null : auditLog.getComment(),
                    auditLog == null ? null : auditLog.getIpAddress(),
                    auditLog == null ? null : auditLog.getDeviceName()
            );
        }
    }

    private List<SignatureResponse> buildDocumentSignatures(DocumentRecord document, DocumentRevisionRecord latestRevision) {
        if (document == null || document.getId() == null) {
            return List.of();
        }

        if (latestRevision != null) {
            List<SignatureResponse> revisionSignatures = buildDocumentRevisionSignatures(latestRevision);
            if (!revisionSignatures.isEmpty()) {
                return revisionSignatures;
            }
        }

        List<AuditLog> records = auditLogRepository
                .findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", document.getId());
        if (records.isEmpty()) {
            return List.of();
        }

        Map<String, AuditLog> latestByAction = new LinkedHashMap<>();
        for (int i = records.size() - 1; i >= 0; i--) {
            AuditLog auditLog = records.get(i);
            String actionType = auditLog.getActionType() == null ? null : auditLog.getActionType().trim().toUpperCase(Locale.ROOT);
            if (StringUtils.hasText(actionType)) {
                latestByAction.put(actionType, auditLog);
            }
        }

        return java.util.stream.Stream.of(
                buildSignatureResponse(latestByAction, "SUBMIT_FOR_REVIEW", "SUBMIT", "SUBMITTED", "Submitted By", "Submitted On (Date - Time)"),
                buildSignatureResponse(latestByAction, "REVIEW_COMPLETE", "Reviewed By", "Reviewed On (Date - Time)"),
                buildSignatureResponse(latestByAction, "REVIEW_REJECT", "APPROVE_REJECT", null, "Rejected By", "Rejected On (Date - Time)"),
                buildSignatureResponse(latestByAction, "APPROVE_COMPLETE", "Approved By", "Approved On (Date - Time)"),
                buildSignatureResponse(latestByAction, "PUBLISH", "Published By", "Published On (Date - Time)"),
                buildSignatureResponse(latestByAction, "OBSOLETE", "Obsoleted By", "Obsoleted On (Date - Time)"),
                buildSignatureResponse(latestByAction, "CANCEL", "Cancelled By", "Cancelled On (Date - Time)")
        ).filter(Objects::nonNull).toList();
    }

    private List<SignatureResponse> buildDocumentRevisionSignatures(DocumentRevisionRecord revision) {
        List<SignatureResponse> list = new ArrayList<>();
        if (revision.getSubmittedBy() != null) {
            list.add(new SignatureResponse(
                    "Submitted By",
                    revision.getSubmittedBy().getFullName(),
                    "Submitted On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getSubmittedOn())
            ));
        }

        List<RevisionWorkflowParticipant> reviewerParticipants = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER");
        appendParticipantSignatures(list, reviewerParticipants, "Reviewed By", "Reviewed On (Date - Time)");

        List<RevisionWorkflowParticipant> approverParticipants = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER");
        appendParticipantSignatures(list, approverParticipants, "Approved By", "Approved On (Date - Time)");

        if (revision.getRejectedBy() != null) {
            list.add(new SignatureResponse(
                    "Rejected By",
                    revision.getRejectedBy().getFullName(),
                    "Rejected On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getRejectedAt())
            ));
        }
        if (revision.getPublishedBy() != null) {
            list.add(new SignatureResponse(
                    "Published By",
                    revision.getPublishedBy().getFullName(),
                    "Published On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getPublishedAt())
            ));
        }
        if (revision.getObsoletedBy() != null) {
            list.add(new SignatureResponse(
                    "Obsoleted By",
                    revision.getObsoletedBy().getFullName(),
                    "Obsoleted On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getObsoletedAt())
            ));
        }
        if (revision.getCancelledBy() != null) {
            list.add(new SignatureResponse(
                    "Cancelled By",
                    revision.getCancelledBy().getFullName(),
                    "Cancelled On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getCancelledAt())
            ));
        }
        return list;
    }

    private boolean isCompletedReviewParticipant(RevisionWorkflowParticipant participant) {
        if (participant == null || participant.getActedAt() == null) {
            return false;
        }
        String actionStatus = participant.getActionStatus();
        if (!StringUtils.hasText(actionStatus)) {
            return true;
        }
        String normalized = actionStatus.trim().toUpperCase(Locale.ROOT);
        return !"PENDING".equals(normalized) && !"REJECTED".equals(normalized);
    }

    private boolean isCompletedApproveParticipant(RevisionWorkflowParticipant participant) {
        if (participant == null || participant.getActedAt() == null) {
            return false;
        }
        String actionStatus = participant.getActionStatus();
        if (!StringUtils.hasText(actionStatus)) {
            return true;
        }
        String normalized = actionStatus.trim().toUpperCase(Locale.ROOT);
        return !"PENDING".equals(normalized) && !"REJECTED".equals(normalized);
    }

    private void appendParticipantSignatures(
            List<SignatureResponse> list,
            List<RevisionWorkflowParticipant> participants,
            String baseLabelBy,
            String labelOn
    ) {
        if (participants == null || participants.isEmpty()) {
            return;
        }
        boolean multiple = participants.size() > 1;
        for (int i = 0; i < participants.size(); i++) {
            RevisionWorkflowParticipant participant = participants.get(i);
            if (participant == null || participant.getUser() == null) {
                continue;
            }
            String labelBy = multiple ? baseLabelBy + " " + (i + 1) : baseLabelBy;
            boolean completed = isCompletedReviewParticipant(participant) || isCompletedApproveParticipant(participant);
            list.add(new SignatureResponse(
                    labelBy,
                    completed ? participant.getUser().getFullName() : "-",
                    labelOn,
                    completed ? DateTimeFormatUtils.formatDateTime(participant.getActedAt()) : "-"
            ));
        }
    }

    private SignatureResponse buildSignatureResponse(
            Map<String, AuditLog> latestByAction,
            String actionType,
            String labelBy,
            String labelOn
    ) {
        return buildSignatureResponse(latestByAction, actionType, null, null, labelBy, labelOn);
    }

    private SignatureResponse buildSignatureResponse(
            Map<String, AuditLog> latestByAction,
            String actionType,
            String fallbackActionType,
            String fallbackActionType2,
            String labelBy,
            String labelOn
    ) {
        AuditLog auditLog = latestByAction.get(actionType);
        if (auditLog == null && StringUtils.hasText(fallbackActionType)) {
            auditLog = latestByAction.get(fallbackActionType);
        }
        if (auditLog == null && StringUtils.hasText(fallbackActionType2)) {
            auditLog = latestByAction.get(fallbackActionType2);
        }
        if (auditLog == null) {
            return null;
        }
        String actionByName = auditLog.getUserFullName();
        if (!StringUtils.hasText(actionByName) && auditLog.getActedBy() != null) {
            actionByName = auditLog.getActedBy().getFullName();
        }
        Instant timestamp = auditLog.getEventTime() != null ? auditLog.getEventTime() : auditLog.getCreatedAt();
        return new SignatureResponse(
                labelBy,
                StringUtils.hasText(actionByName) ? actionByName : "-",
                labelOn,
                DateTimeFormatUtils.formatDateTime(timestamp)
        );
    }

    /**
     * Legacy Import only: realtime availability check as the user types the Document Number, so a
     * collision is caught before Submit instead of only surfacing as a create failure. Read-only,
     * gated on the same permission as the import itself -- it exists purely to back this one field.
     */
    @Transactional(readOnly = true)
    public boolean isLegacyDocumentNumberAvailable(String documentNumber) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(currentUser, "documents.legacy_import.manage")) {
            throw new AccessDeniedException("Only Legacy Import is permitted to check a document number this way.");
        }
        if (!StringUtils.hasText(documentNumber)) {
            return false;
        }
        return !documentRepository.existsByDocumentNumber(documentNumber.trim());
    }

    @Transactional
    public DocumentListItemResponse createDocumentDraft(DocumentDraftCreateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        documentAuthorizationService.requireCanCreateDocument(currentUser);
        // Marking a document as a Template rides on the same create permission -- a Template is a
        // Document like any other (same workflow, same file-upload step), just flagged for reuse.
        // No separate documents.template.manage gate any more (see requireTemplateManage removal).
        DocumentRecord document = new DocumentRecord();
        applyDraftFields(document, request, currentUser, true);
        documentRepository.save(document);
        // applyDraftFields' own recordStakeholderHistory call for the Author no-ops for a brand-new
        // Document: it runs before this save, while document.getId() is still null. Record it here
        // instead, now that the id is assigned (idempotent -- a no-op if already recorded).
        recordStakeholderHistory(document, document.getAuthor(), "AUTHOR");
        saveDraftAssignments(document, request);
        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                formatDocumentLabel(document),
                document.getId(),
                "CREATE",
                null,
                document.getStatus() == null ? null : document.getStatus().getCode(),
                buildDraftAuditComment(request, "Document draft created"),
                buildCreatedDocumentDraftAuditChanges(document, request)
        );
        return toListItem(document);
    }

    /**
     * Legacy Import: creates the Draft document record AND its historical revision batch in one
     * physical transaction. Previously the frontend called {@link #createDocumentDraft} and
     * {@link RevisionService#createLegacyImportRevisionsBatch} as two separate requests -- if the
     * second one failed (bad file, validation error, etc.) the already-committed Draft document
     * was left behind, permanently holding the legacy document number and blocking every retry
     * with "Document number already in use" even though nothing was actually imported. Calling
     * both from here means an exception from the revisions step (default REQUIRED propagation)
     * rolls back the document insert too, so a failed attempt leaves nothing behind.
     */
    @Transactional
    public LegacyBatchImportResponse createLegacyImportDocumentAndRevisions(
            String documentJson,
            String revisionsJson,
            List<MultipartFile> files,
            String legacyJustification,
            String signatureToken
    ) {
        DocumentDraftCreateRequest documentRequest = parseDocumentDraftCreateRequest(documentJson);
        // This request carries the regulatory justification TWICE -- once embedded in `document`
        // (persisted permanently on DocumentRecord.legacyJustification) and once as this top-level
        // field (the reason attached to every revision's signed audit trail entry via
        // RevisionService#createLegacyImportRevisionsBatch). They must be the same justification;
        // silently allowing them to differ would let the permanent record disagree with what the
        // signature actually attested to -- a real GMP traceability defect, not a cosmetic one.
        String documentJustification = documentRequest.legacyJustification() == null ? "" : documentRequest.legacyJustification().trim();
        String auditJustification = legacyJustification == null ? "" : legacyJustification.trim();
        if (!documentJustification.equals(auditJustification)) {
            throw new IllegalArgumentException(
                    "Migration Justification must be the same on the document and the signed import request."
            );
        }
        DocumentListItemResponse created = createDocumentDraft(documentRequest);
        return revisionService.createLegacyImportRevisionsBatch(
                UUID.fromString(created.id()), revisionsJson, files, legacyJustification, signatureToken
        );
    }

    /** Mirrors RevisionService#parseLegacyBatchSections -- a plain JSON string multipart part,
     *  deserialized here, is the proven pattern already used for the "revisions" part on this same
     *  endpoint; binding a part straight to a POJO via @RequestPart depends on the browser sending
     *  an exact Content-Type the multipart resolver accepts for that part, which is far more
     *  fragile than this. */
    private DocumentDraftCreateRequest parseDocumentDraftCreateRequest(String documentJson) {
        if (!StringUtils.hasText(documentJson)) {
            throw new IllegalArgumentException("Document details are required.");
        }
        try {
            return objectMapper.readValue(documentJson, DocumentDraftCreateRequest.class);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid document payload: " + ex.getMessage());
        }
    }

    @Transactional
    public DocumentListItemResponse updateDocumentDraft(UUID documentId, DocumentDraftCreateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        documentAuthorizationService.requireCanEditInitialDocumentDraft(currentUser, document);

        if (isDraftUnchanged(document, request)) {
            return toListItem(document);
        }
        String previousSubType = document.getSubType();
        DocumentDraftAuditSnapshot beforeSnapshot = captureDocumentDraftAuditSnapshot(document);
        applyDraftFields(document, request, currentUser, false);
        boolean subTypeChanged = !Objects.equals(previousSubType, document.getSubType());
        // saveDraftAssignments() below only re-validates Reviewers when reviewerUserIds is part
        // of THIS request -- a Sub-Type-only save (the normal "Save & Next" flow, which never
        // includes reviewerUserIds) would otherwise persist a Sub-Type whose review requirement
        // no longer matches the Reviewers already saved from an earlier step, with nothing
        // catching the mismatch until/unless Reviewers happen to be touched again. Fail this save
        // immediately and clearly instead, matching the same defensive re-check already done for
        // Author/Co-Author changes against existing Reviewers in updateActiveWorkflowConfiguration.
        if (subTypeChanged && request.reviewerUserIds() == null) {
            List<String> existingReviewerIds = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER")
                    .stream()
                    .map(participant -> participant.getUser().getId().toString())
                    .toList();
            if (!existingReviewerIds.isEmpty()) {
                List<String> existingCoAuthorIds = documentWorkflowParticipantRepository
                        .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "CO_AUTHOR")
                        .stream()
                        .map(participant -> participant.getUser().getId().toString())
                        .toList();
                validateReviewerRules(resolveDocumentReviewRequirement(document), document.getAuthor(), existingCoAuthorIds, existingReviewerIds);
            }
        }
        documentRepository.save(document);
        saveDraftAssignments(document, request);
        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                formatDocumentLabel(document),
                document.getId(),
                "UPDATE",
                "DRAFT",
                document.getStatus() == null ? null : document.getStatus().getCode(),
                buildDraftAuditComment(request, "Document draft updated"),
                buildDocumentDraftModificationChanges(beforeSnapshot, captureDocumentDraftAuditSnapshot(document))
        );
        return toListItem(document);
    }

    /**
     * Permission-controlled configuration of the participants and document
     * relationships that the next revision will inherit. It is intentionally
     * separate from editing an Active document's controlled metadata.
     */
    @Transactional
    public DocumentDetailResponse updateActiveWorkflowConfiguration(
            UUID documentId,
            DocumentActiveWorkflowConfigurationRequest request
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        if (document.getStatus() == null || !"ACTIVE".equalsIgnoreCase(document.getStatus().getCode())) {
            throw new IllegalArgumentException("Workflow configuration can only be changed for an Active document");
        }
        if (documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE").isEmpty()) {
            throw new IllegalArgumentException("An Effective revision is required before configuring the next revision");
        }
        requireNoRevisionBeyondConfigurableStage(document);

        List<String> coAuthorIds = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "CO_AUTHOR")
                .stream().map(item -> item.getUser().getId().toString()).toList();

        boolean reviewersChanged = !sameParticipantIds(document, "REVIEWER", request == null ? null : request.reviewerUserIds());
        boolean approversChanged = !sameParticipantIds(document, "APPROVER", request == null ? null : request.approverUserIds());
        boolean relatedDocumentsChanged = !sameRelationIds(document, "RELATED", request == null ? null : request.relatedDocumentIds());
        boolean correlatedDocumentsChanged = !sameRelationIds(document, "CORRELATED", request == null ? null : request.correlatedDocumentIds());
        LocalDate previousReviewDate = document.getReviewDate();
        LocalDate requestedReviewDate = request == null || !StringUtils.hasText(request.reviewDate())
                ? document.getReviewDate()
                : parseDate(request.reviewDate());
        // Review Date is required when configuring the next (upgrade) revision: it is entered manually and
        // never calculated, so a document without one cannot be prepared for upgrade.
        if (requestedReviewDate == null) {
            throw new IllegalArgumentException("Review Date is required");
        }
        boolean reviewDateChanged = !Objects.equals(document.getReviewDate(), requestedReviewDate);

        boolean previousRequiresTraining = document.isRequiresTraining();
        Integer previousTrainingPeriodDays = document.getTrainingPeriodDays();
        String previousReasonForSkippingTraining = document.getReasonForSkippingTraining();
        // Only apply training semantics when the caller actually sent at least one training
        // field -- otherwise (e.g. a request that only touches Periodic Review Cycle) leave
        // training completely untouched instead of misreading "field omitted" as "clear it",
        // which previously caused a false trainingChanged + spurious validation failure.
        boolean trainingFieldsProvided = request != null && (request.requiresTraining() != null
                || request.trainingPeriodDays() != null
                || StringUtils.hasText(request.reasonForSkippingTraining()));
        boolean requestedRequiresTraining = trainingFieldsProvided && request.requiresTraining() != null
                ? request.requiresTraining()
                : previousRequiresTraining;
        Integer requestedTrainingPeriodDays = !trainingFieldsProvided
                ? previousTrainingPeriodDays
                : (requestedRequiresTraining ? request.trainingPeriodDays() : null);
        String requestedReasonForSkippingTraining = !trainingFieldsProvided
                ? previousReasonForSkippingTraining
                : (requestedRequiresTraining ? null : request.reasonForSkippingTraining());
        // A controlled-document template follows the normal document lifecycle, but is never a
        // training trigger.  This guard is also needed for the Active-document configuration API:
        // without it, a direct request could re-enable training after the template was Effective.
        if (document.isTemplate()) {
            if (requestedRequiresTraining) {
                throw new IllegalArgumentException("Controlled document templates cannot require training");
            }
            requestedRequiresTraining = false;
            requestedTrainingPeriodDays = null;
            requestedReasonForSkippingTraining = null;
        }
        boolean trainingChanged = previousRequiresTraining != requestedRequiresTraining
                || !Objects.equals(previousTrainingPeriodDays, requestedTrainingPeriodDays)
                || !Objects.equals(previousReasonForSkippingTraining, requestedReasonForSkippingTraining);
        if (trainingChanged && requestedRequiresTraining
                && (requestedTrainingPeriodDays == null || requestedTrainingPeriodDays < 1)) {
            throw new IllegalArgumentException("Training Period (Days) is required when training is required");
        }
        if (trainingChanged && !document.isTemplate() && !requestedRequiresTraining
                && !StringUtils.hasText(requestedReasonForSkippingTraining)) {
            throw new IllegalArgumentException("Reason for skipping training is required");
        }

        UserAccount previousAuthor = document.getAuthor();
        UserAccount requestedAuthor = request == null || !StringUtils.hasText(request.authorUserId())
                ? previousAuthor
                : resolveUser(request.authorUserId());
        if (request != null && StringUtils.hasText(request.authorUserId()) && requestedAuthor == null) {
            throw new IllegalArgumentException("Author not found: " + request.authorUserId());
        }
        boolean authorChanged = !Objects.equals(
                previousAuthor == null ? null : previousAuthor.getId(),
                requestedAuthor == null ? null : requestedAuthor.getId());

        List<String> requestedCoAuthorIds = request == null || request.coAuthorUserIds() == null
                ? coAuthorIds
                : distinctNonBlank(request.coAuthorUserIds());
        boolean coAuthorsChanged = !areListsEqual(coAuthorIds, requestedCoAuthorIds);

        if (authorChanged || coAuthorsChanged) {
            validateCoAuthorRules(requestedAuthor, requestedCoAuthorIds);
            List<String> effectiveApproverIds = approversChanged
                    ? distinctNonBlank(request.approverUserIds())
                    : documentWorkflowParticipantRepository
                            .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "APPROVER")
                            .stream().map(item -> item.getUser().getId().toString()).toList();
            validateAuthorAndCoAuthorApprovalIndependence(requestedAuthor, requestedCoAuthorIds, effectiveApproverIds);
            // Reviewers aren't necessarily part of this same request -- if they're not being
            // touched here, re-validate the new Author/Co-Author set against the EXISTING
            // reviewer list too, or an author/co-author change alone could silently create an
            // Author==Reviewer (or Co-author==Reviewer) SoD violation that would otherwise only
            // ever be caught if/when Reviewers themselves happen to be edited in a later request.
            List<String> effectiveReviewerIds = reviewersChanged
                    ? distinctNonBlank(request.reviewerUserIds())
                    : documentWorkflowParticipantRepository
                            .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, "REVIEWER")
                            .stream().map(item -> item.getUser().getId().toString()).toList();
            validateReviewerRules(resolveDocumentReviewRequirement(document), requestedAuthor, requestedCoAuthorIds, effectiveReviewerIds);
        }

        Integer previousPeriodicReviewCycle = document.getPeriodicReviewCycle();
        Integer requestedPeriodicReviewCycle = request == null || request.periodicReviewCycle() == null
                ? previousPeriodicReviewCycle
                : request.periodicReviewCycle();
        boolean periodicReviewCycleChanged = !Objects.equals(previousPeriodicReviewCycle, requestedPeriodicReviewCycle);

        Integer previousPeriodicReviewNotification = document.getPeriodicReviewNotification();
        Integer requestedPeriodicReviewNotification = request == null || request.periodicReviewNotification() == null
                ? previousPeriodicReviewNotification
                : request.periodicReviewNotification();
        boolean periodicReviewNotificationChanged = !Objects.equals(previousPeriodicReviewNotification, requestedPeriodicReviewNotification);

        String previousDescription = document.getDescription();
        String requestedDescription = request == null || request.description() == null
                ? previousDescription
                : request.description();
        boolean descriptionChanged = !Objects.equals(normalizeString(previousDescription), normalizeString(requestedDescription));

        boolean metadataChanged = reviewDateChanged || trainingChanged || authorChanged || coAuthorsChanged
                || periodicReviewCycleChanged || periodicReviewNotificationChanged || descriptionChanged;

        // Saving this configuration -- even with nothing changed, i.e. the DCO confirms the existing
        // setup -- is what unlocks Upload Revision for the Author (cleared again by the upload itself).
        document.setNextRevisionConfiguredAt(Instant.now());
        if (!reviewersChanged && !approversChanged && !relatedDocumentsChanged && !correlatedDocumentsChanged
                && !metadataChanged) {
            documentRepository.save(document);
            auditTrailService.logAs(
                    currentUser, "DOCUMENT", formatDocumentLabel(document), document.getId(),
                    "UPDATE_WORKFLOW_CONFIGURATION", "ACTIVE", "ACTIVE",
                    "Confirmed the next-revision configuration without changes; the Author may now upload the revision.",
                    List.of()
            );
            notifyAuthorUpgradeReady(document, currentUser);
            return getDocumentDetail(documentId);
        }

        if (metadataChanged) {
            boolean legacyAllowed = permissionEvaluationService.hasPermission(currentUser, "documents.document.configure_next_metadata");
            boolean allowed = evaluateUpdateMetadataAllowed(currentUser, document, legacyAllowed);
            if (!allowed) {
                throw new AccessDeniedException("Current user cannot edit this document's metadata");
            }
        }

        requireNextRevisionConfigurationPermission(currentUser, reviewersChanged,
                "documents.revision.configure_next_reviewers", "reviewers");
        requireNextRevisionConfigurationPermission(currentUser, approversChanged,
                "documents.revision.configure_next_approvers", "approvers");
        requireNextRevisionConfigurationPermission(currentUser, relatedDocumentsChanged,
                "documents.revision.configure_next_related_documents", "related documents");
        requireNextRevisionConfigurationPermission(currentUser, correlatedDocumentsChanged,
                "documents.revision.configure_next_correlated_documents", "correlated documents");

        String previousReviewerNames = currentParticipantNames(documentId, "REVIEWER");
        String previousApproverNames = currentParticipantNames(documentId, "APPROVER");
        String previousRelatedNames = currentRelationLabels(documentId, "RELATED");
        String previousCorrelatedNames = currentRelationLabels(documentId, "CORRELATED");

        // Author/Co-Author are applied first so the reviewer/approver replacement below (and its
        // internal SoD validation) sees the up-to-date author/co-author set, not the stale one.
        if (authorChanged) {
            document.setAuthor(requestedAuthor);
            recordStakeholderHistory(document, requestedAuthor, "AUTHOR");
        }
        if (coAuthorsChanged) {
            replaceCoAuthors(document, requestedCoAuthorIds);
        }
        if (reviewersChanged) {
            replaceActiveWorkflowParticipants(document, "REVIEWER", request.reviewerUserIds(), requestedCoAuthorIds);
        }
        if (approversChanged) {
            replaceActiveWorkflowParticipants(document, "APPROVER", request.approverUserIds(), requestedCoAuthorIds);
        }
        if (relatedDocumentsChanged) {
            replaceActiveDocumentRelations(document, "RELATED", request.relatedDocumentIds());
        }
        if (correlatedDocumentsChanged) {
            replaceActiveDocumentRelations(document, "CORRELATED", request.correlatedDocumentIds());
        }
        if (reviewDateChanged) {
            document.setReviewDate(requestedReviewDate);
        }
        if (trainingChanged) {
            document.setRequiresTraining(requestedRequiresTraining);
            document.setTrainingPeriodDays(requestedTrainingPeriodDays);
            document.setReasonForSkippingTraining(requestedReasonForSkippingTraining);
        }
        if (periodicReviewCycleChanged) {
            document.setPeriodicReviewCycle(requestedPeriodicReviewCycle);
        }
        if (periodicReviewNotificationChanged) {
            document.setPeriodicReviewNotification(requestedPeriodicReviewNotification);
        }
        if (descriptionChanged) {
            document.setDescription(requestedDescription);
        }
        documentRepository.save(document);

        if (authorChanged || coAuthorsChanged || reviewersChanged || approversChanged
                || periodicReviewCycleChanged || periodicReviewNotificationChanged || trainingChanged
                || relatedDocumentsChanged || correlatedDocumentsChanged) {
            // Keep an already-open Draft revision's own snapshot (author/co-author/reviewer/approver/
            // periodic cycle/training) from silently going stale relative to the Document -- see
            // RevisionService.syncDraftRevisionWithDocument for why this can't just be read live.
            revisionService.syncDraftRevisionWithDocument(document);
        }

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        if (authorChanged) {
            changes.add(new AuditTrailChangeResponse("Author",
                    previousAuthor == null ? "-" : previousAuthor.getFullName(),
                    requestedAuthor == null ? "-" : requestedAuthor.getFullName()));
        }
        if (coAuthorsChanged) {
            changes.add(new AuditTrailChangeResponse("Co-Author(s)",
                    joinUserNames(coAuthorIds), joinUserNames(requestedCoAuthorIds)));
        }
        if (reviewersChanged) {
            changes.add(new AuditTrailChangeResponse("Reviewers (Next Revision)",
                    previousReviewerNames, currentParticipantNames(documentId, "REVIEWER")));
        }
        if (approversChanged) {
            changes.add(new AuditTrailChangeResponse("Approvers (Next Revision)",
                    previousApproverNames, currentParticipantNames(documentId, "APPROVER")));
        }
        if (relatedDocumentsChanged) {
            changes.add(new AuditTrailChangeResponse("Related Documents (Next Revision)",
                    previousRelatedNames, currentRelationLabels(documentId, "RELATED")));
        }
        if (correlatedDocumentsChanged) {
            changes.add(new AuditTrailChangeResponse("Correlated Documents (Next Revision)",
                    previousCorrelatedNames, currentRelationLabels(documentId, "CORRELATED")));
        }
        if (reviewDateChanged) {
            changes.add(new AuditTrailChangeResponse("Review Date",
                    DateTimeFormatUtils.formatDate(previousReviewDate), DateTimeFormatUtils.formatDate(requestedReviewDate)));
        }
        if (trainingChanged) {
            changes.add(new AuditTrailChangeResponse("Requires Training", String.valueOf(previousRequiresTraining), String.valueOf(requestedRequiresTraining)));
            changes.add(new AuditTrailChangeResponse("Training Period (Days)", String.valueOf(previousTrainingPeriodDays), String.valueOf(requestedTrainingPeriodDays)));
            changes.add(new AuditTrailChangeResponse("Reason For Skipping Training", previousReasonForSkippingTraining, requestedReasonForSkippingTraining));
        }
        if (periodicReviewCycleChanged) {
            changes.add(new AuditTrailChangeResponse("Periodic Review Cycle (Months)", String.valueOf(previousPeriodicReviewCycle), String.valueOf(requestedPeriodicReviewCycle)));
        }
        if (periodicReviewNotificationChanged) {
            changes.add(new AuditTrailChangeResponse("Periodic Review Notification (Days)", String.valueOf(previousPeriodicReviewNotification), String.valueOf(requestedPeriodicReviewNotification)));
        }
        if (descriptionChanged) {
            changes.add(new AuditTrailChangeResponse("Description", previousDescription, requestedDescription));
        }

        auditTrailService.logAs(
                currentUser, "DOCUMENT", formatDocumentLabel(document), document.getId(),
                "UPDATE_WORKFLOW_CONFIGURATION", "ACTIVE", "ACTIVE",
                "Updated the next-revision configuration.",
                changes
        );
        notifyAuthorUpgradeReady(document, currentUser);
        return getDocumentDetail(documentId);
    }

    // Optional: a missing dispatcher must never block saving the configuration.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private NotificationDispatcher upgradeNotificationDispatcher;

    /** Tells the document's Author that the DCO configured the upgrade, so Upload Revision is now open to them. */
    private void notifyAuthorUpgradeReady(DocumentRecord document, UserAccount configuredBy) {
        UserAccount author = document == null ? null : document.getAuthor();
        if (upgradeNotificationDispatcher == null || author == null || author.getStatus() != UserStatus.Active) {
            return;
        }
        if (configuredBy != null && Objects.equals(author.getId(), configuredBy.getId())) {
            return; // the person who just saved it does not need to be told
        }
        try {
            Map<String, String> variables = new java.util.HashMap<>();
            variables.put("documentNumber", Objects.toString(document.getDocumentNumber(), ""));
            variables.put("documentTitle", Objects.toString(document.getDocumentName(), ""));
            variables.put("revisionNumber", Objects.toString(document.getVersion(), ""));
            variables.put("actionUrl", "/documents/" + document.getId());
            upgradeNotificationDispatcher.dispatch("document.upgrade_ready", List.of(author), variables);
        } catch (Exception ex) {
            log.warn("Upgrade-ready notification failed for document {}", document.getId(), ex);
        }
    }

    /** Co-authors carry no reviewer/approver permission requirement, unlike
     *  {@link #replaceActiveWorkflowParticipants}, so they get their own replace helper instead of
     *  incorrectly running them through requirePoolMembership's reviewer/approver permission check. */
    private void replaceCoAuthors(DocumentRecord document, List<String> requestedIds) {
        documentWorkflowParticipantRepository.deleteAllByDocument_IdAndParticipantType(document.getId(), "CO_AUTHOR");
        documentWorkflowParticipantRepository.flush();
        int sequence = 1;
        for (String participantId : requestedIds) {
            UserAccount participant = resolveUser(participantId);
            if (participant == null) throw new IllegalArgumentException("Co-Author not found: " + participantId);
            saveParticipant(document, participant, "CO_AUTHOR", sequence++);
        }
    }

    private String currentParticipantNames(UUID documentId, String participantType) {
        List<String> names = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(documentId, participantType)
                .stream()
                .map(item -> item.getUser() == null ? null : item.getUser().getFullName())
                .filter(StringUtils::hasText)
                .toList();
        return names.isEmpty() ? "None" : String.join(", ", names);
    }

    private String currentRelationLabels(UUID documentId, String relationType) {
        List<String> labels = documentRelationRepository
                .findAllBySourceDocument_IdAndRelationType(documentId, relationType)
                .stream()
                .map(item -> formatDocumentLabel(item.getTargetDocument()))
                .filter(StringUtils::hasText)
                .toList();
        return labels.isEmpty() ? "None" : String.join(", ", labels);
    }

    private String joinUserNames(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return "None";
        }
        List<String> names = userIds.stream()
                .map(this::resolveUser)
                .filter(Objects::nonNull)
                .map(UserAccount::getFullName)
                .filter(StringUtils::hasText)
                .toList();
        return names.isEmpty() ? "None" : String.join(", ", names);
    }

    private boolean isActiveWorkflowConfigurationUnchanged(
            DocumentRecord document, DocumentActiveWorkflowConfigurationRequest request
    ) {
        if (request == null) return true;
        return sameParticipantIds(document, "REVIEWER", request.reviewerUserIds())
                && sameParticipantIds(document, "APPROVER", request.approverUserIds())
                && sameRelationIds(document, "RELATED", request.relatedDocumentIds())
                && sameRelationIds(document, "CORRELATED", request.correlatedDocumentIds());
    }

    private void requireNextRevisionConfigurationPermission(
            UserAccount user, boolean changed, String permissionCode, String label
    ) {
        if (changed && !permissionEvaluationService.hasPermission(user, permissionCode)) {
            throw new AccessDeniedException("Current user cannot configure next-revision " + label);
        }
    }

    private boolean sameParticipantIds(DocumentRecord document, String participantType, List<String> requestedIds) {
        if (requestedIds == null) return true;
        List<String> current = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), participantType)
                .stream().map(item -> item.getUser().getId().toString()).toList();
        return areListsEqual(current, distinctNonBlank(requestedIds));
    }

    private boolean sameRelationIds(DocumentRecord document, String relationType, List<String> requestedIds) {
        if (requestedIds == null) return true;
        List<String> current = documentRelationRepository
                .findAllBySourceDocument_IdAndRelationType(document.getId(), relationType)
                .stream().map(item -> item.getTargetDocument().getId().toString()).toList();
        // Deliberately NOT areListsEqual() here: that helper resolves each entry through
        // resolveUser(), which is meant for reviewer/approver USER ids. A related/correlated
        // document id run through resolveUser() always resolves to null (it isn't a user), so two
        // *different* target documents of the same list size were both silently "resolving" to
        // null == null -- i.e. treated as unchanged -- and the actual swap never got persisted, no
        // error surfaced. Plain set equality is correct here; unlike Reviewer/Approver sequence,
        // relation order carries no domain meaning, so reordering alone shouldn't count as a change.
        return areIdSetsEqual(current, distinctNonBlank(requestedIds));
    }

    private boolean areIdSetsEqual(List<String> list1, List<String> list2) {
        return new java.util.HashSet<>(list1).equals(new java.util.HashSet<>(list2));
    }

    /**
     * Reviewer/Approver/Related/Correlated/Author/Co-Author/Periodic Cycle-Notification/Training are
     * all framed as "configuration for the next revision" -- once that next revision is no longer at
     * a stage where those choices can still take effect, letting a DCO "successfully" edit and save
     * them is a false signal (200 OK + an audit entry, but nothing downstream ever reads it). Two
     * cases, both explicit product decisions:
     *   1. The in-progress revision has moved past Draft (Pending Review/Approval/Training/Ready for
     *      Publishing) -- its roster is already locked (see the isLocked note on ReviewersTab), so
     *      these fields can only ever apply to a future revision, not this one.
     *   2. The revision is still Draft, but the Author already uploaded it to Office Online
     *      (revision.storageItemId/storageDriveId populated) -- at that point the Author is actively
     *      editing the live working copy; changing who reviews/approves it underneath, or the
     *      training/periodic-review terms it was uploaded under, would silently diverge from what the
     *      Author is editing.
     */
    private static final List<String> REVISION_STAGES_BEYOND_DRAFT = List.of(
            "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING"
    );

    private void requireNoRevisionBeyondConfigurableStage(DocumentRecord document) {
        String reason = describeWhyNextRevisionIsNotConfigurable(document);
        if (reason != null) {
            throw new IllegalArgumentException(reason);
        }
    }

    /**
     * Non-throwing sibling of {@link #requireNoRevisionBeyondConfigurableStage} -- used by
     * {@link DocumentMasterActionCapabilityService} so the "Edit Revision for Upgrade" action (and
     * the Reviewer/Approver/Related/Correlated Documents actions gated with it) is reported as
     * NOT allowed, and the button never renders in the first place, instead of only being blocked
     * after the DCO has already clicked in and edited fields.
     */
    public boolean isNextRevisionConfigurable(DocumentRecord document) {
        return describeWhyNextRevisionIsNotConfigurable(document) == null;
    }

    private String describeWhyNextRevisionIsNotConfigurable(DocumentRecord document) {
        List<String> queryStatusCodes = new ArrayList<>(REVISION_STAGES_BEYOND_DRAFT);
        queryStatusCodes.add("DRAFT");
        DocumentRevisionRecord inProgress = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeInOrderByCreatedAtDesc(document.getId(), queryStatusCodes)
                .orElse(null);
        if (inProgress == null) {
            return null;
        }
        String statusCode = inProgress.getStatus() == null ? null : inProgress.getStatus().getCode();
        if (REVISION_STAGES_BEYOND_DRAFT.contains(statusCode)) {
            return "Cannot configure the next revision: revision " + inProgress.getRevisionNumber()
                    + " is already " + inProgress.getStatus().getLabel()
                    + ". These changes would no longer apply to it.";
        }
        if (StringUtils.hasText(inProgress.getStorageItemId()) && StringUtils.hasText(inProgress.getStorageDriveId())) {
            return "Cannot configure the next revision: revision " + inProgress.getRevisionNumber()
                    + " has already been uploaded to Office Online for editing.";
        }
        // completeEditing() locks the source and records the Author's PREPARED e-signature while the
        // revision status stays DRAFT, and it does NOT require an Office Online working copy (a
        // MinIO-only source revision reaches editingStatus=COMPLETED / sourceLocked=true with no
        // storageItemId). syncDraftRevisionWithDocument() then refuses to propagate later changes to
        // such a Draft, so allowing them here would silently diverge the Document from the revision
        // the Author already signed off.
        if ("COMPLETED".equals(inProgress.getEditingStatus()) || inProgress.isSourceLocked()) {
            return "Cannot configure the next revision: revision " + inProgress.getRevisionNumber()
                    + " has already completed authoring and its source is locked.";
        }
        return null;
    }

    private void replaceActiveWorkflowParticipants(
            DocumentRecord document, String participantType, List<String> requestedIds, List<String> coAuthorIds
    ) {
        if (requestedIds == null) return;
        List<String> participantIds = distinctNonBlank(requestedIds);
        if ("REVIEWER".equals(participantType)) {
            validateReviewerRules(resolveDocumentReviewRequirement(document), document.getAuthor(), coAuthorIds, participantIds);
        } else {
            List<String> reviewerIds = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER")
                    .stream().map(item -> item.getUser().getId().toString()).toList();
            validateApproverRules(document.getAuthor(), coAuthorIds, reviewerIds, participantIds);
        }
        documentWorkflowParticipantRepository.deleteAllByDocument_IdAndParticipantType(document.getId(), participantType);
        documentWorkflowParticipantRepository.flush();
        int sequence = 1;
        for (String participantId : participantIds) {
            UserAccount participant = resolveUser(participantId);
            if (participant == null) throw new IllegalArgumentException(participantType + " not found: " + participantId);
            requirePoolMembership(participantType, participant);
            saveParticipant(document, participant, participantType, sequence++);
        }
    }

    private void replaceActiveDocumentRelations(DocumentRecord document, String relationType, List<String> requestedIds) {
        if (requestedIds == null) return;
        documentRelationRepository.deleteAllBySourceDocument_IdAndRelationType(document.getId(), relationType);
        documentRelationRepository.flush();
        List<DocumentLookupResult> resolved = resolveDocumentReferences(distinctNonBlank(requestedIds), relationType);
        ensureNoDuplicateResolvedDocuments(resolved, relationType);
        for (DocumentLookupResult target : resolved) {
            saveRelation(document, target.document(), relationType);
        }
        // Keep the denormalised has_related_documents / has_correlated_documents flags on `documents`
        // (read by the document + revision list columns and the "Related Document = Yes/No" filter)
        // in step with the actual document_relations rows -- otherwise editing relations on an
        // already-Active document via the next-revision configuration path leaves the list showing
        // "No" while the expandable detail shows the relation.
        applyRelationPresenceFlag(document, relationType, !resolved.isEmpty());
    }

    /** Sets the matching has_*_documents flag for one relation type. */
    private void applyRelationPresenceFlag(DocumentRecord document, String relationType, boolean present) {
        if ("RELATED".equals(relationType)) {
            document.setHasRelatedDocuments(present);
        } else if ("CORRELATED".equals(relationType)) {
            document.setHasCorrelatedDocuments(present);
        }
    }

    private boolean isDraftUnchanged(DocumentRecord document, DocumentDraftCreateRequest request) {
        if (request.documentType() != null) {
            DocumentType documentType = resolveDocumentType(request.documentType());
            if (document.getDocumentType() == null || !Objects.equals(document.getDocumentType().getId(), documentType.getId())) return false;
        }
        if (request.businessUnit() != null) {
            BusinessUnit businessUnit = resolveBusinessUnit(request.businessUnit());
            if (document.getBusinessUnit() == null || !Objects.equals(document.getBusinessUnit().getId(), businessUnit.getId())) return false;
        }
        if (request.department() != null) {
            BusinessUnit businessUnit = request.businessUnit() != null ? resolveBusinessUnit(request.businessUnit()) : document.getBusinessUnit();
            Department department = resolveDepartment(request.department(), businessUnit);
            if (document.getDepartment() == null || !Objects.equals(document.getDepartment().getId(), department.getId())) return false;
        }
        if (request.author() != null) {
            UserAccount author = resolveUser(request.author());
            UUID authorId = author != null ? author.getId() : null;
            UUID currentAuthorId = document.getAuthor() != null ? document.getAuthor().getId() : null;
            if (!Objects.equals(currentAuthorId, authorId)) return false;
        }

        if (request.documentName() != null && !Objects.equals(normalizeString(document.getDocumentName()), normalizeString(request.documentName()))) return false;
        if (request.titleLocalLanguage() != null && !Objects.equals(normalizeString(document.getTitleLocalLanguage()), normalizeString(request.titleLocalLanguage()))) return false;
        if (request.description() != null && !Objects.equals(normalizeString(document.getDescription()), normalizeString(request.description()))) return false;
        if (request.knowledgeBase() != null && !Objects.equals(normalizeString(document.getKnowledgeBase()), normalizeString(request.knowledgeBase()))) return false;
        if (request.isTemplate() != null && document.isTemplate() != request.isTemplate()) return false;
        
        if (request.periodicReviewCycle() != null && !Objects.equals(document.getPeriodicReviewCycle(), request.periodicReviewCycle())) return false;
        if (request.periodicReviewNotification() != null && !Objects.equals(document.getPeriodicReviewNotification(), request.periodicReviewNotification())) return false;
        if (request.subType() != null && !Objects.equals(normalizeString(document.getSubType()), normalizeString(request.subType()))) return false;
        if (request.language() != null && !Objects.equals(normalizeString(document.getLanguage()), normalizeString(request.language()))) return false;
        if (request.requiresTraining() != null && document.isRequiresTraining() != request.requiresTraining()) return false;
        if (request.trainingPeriodDays() != null && !Objects.equals(document.getTrainingPeriodDays(), request.trainingPeriodDays())) return false;
        if (request.reasonForSkippingTraining() != null && !Objects.equals(normalizeString(document.getReasonForSkippingTraining()), normalizeString(request.reasonForSkippingTraining()))) return false;
        // Check co-authors
        if (request.coAuthorIds() != null) {
            List<String> incomingCoAuthors = distinctNonBlank(request.coAuthorIds());
            List<String> currentCoAuthors = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "CO_AUTHOR")
                    .stream()
                    .map(p -> p.getUser().getId().toString())
                    .toList();
            if (!areListsEqual(incomingCoAuthors, currentCoAuthors)) return false;
        }

        // Check reviewers
        if (request.reviewerUserIds() != null) {
            List<String> incomingReviewers = distinctNonBlank(request.reviewerUserIds());
            List<String> currentReviewers = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER")
                    .stream()
                    .map(p -> p.getUser().getId().toString())
                    .toList();
            if (!areListsEqual(incomingReviewers, currentReviewers)) return false;
        }

        // Check approvers
        if (request.approverUserIds() != null) {
            List<String> incomingApprovers = distinctNonBlank(request.approverUserIds());
            List<String> currentApprovers = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER")
                    .stream()
                    .map(p -> p.getUser().getId().toString())
                    .toList();
            if (!areListsEqual(incomingApprovers, currentApprovers)) return false;
        }

        // Check related
        if (request.relatedDocumentIds() != null) {
            List<String> incomingRelated = distinctNonBlank(request.relatedDocumentIds());
            List<String> currentRelated = documentRelationRepository
                    .findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED")
                    .stream()
                    .map(r -> r.getTargetDocument().getId().toString())
                    .toList();
            if (!areListsEqual(incomingRelated, currentRelated)) return false;
        }

        // Check correlated
        if (request.correlatedDocumentIds() != null) {
            List<String> incomingCorrelated = distinctNonBlank(request.correlatedDocumentIds());
            List<String> currentCorrelated = documentRelationRepository
                    .findAllBySourceDocument_IdAndRelationType(document.getId(), "CORRELATED")
                    .stream()
                    .map(r -> r.getTargetDocument().getId().toString())
                    .toList();
            if (!areListsEqual(incomingCorrelated, currentCorrelated)) return false;
        }

        return true;
    }

    private String normalizeString(String val) {
        if (val == null || val.trim().isEmpty()) {
            return null;
        }
        return val.trim();
    }

    private Integer resolvePeriodicReviewCycle(DocumentRecord document) {
        if (document.getPeriodicReviewCycle() != null) {
            return document.getPeriodicReviewCycle();
        }
        return resolveLatestRevisionValue(document, DocumentRevisionRecord::getPeriodicReviewCycle);
    }

    private Integer resolvePeriodicReviewNotification(DocumentRecord document) {
        if (document.getPeriodicReviewNotification() != null) {
            return document.getPeriodicReviewNotification();
        }
        return resolveLatestRevisionValue(document, DocumentRevisionRecord::getPeriodicReviewNotification);
    }

    private Integer resolveLatestRevisionValue(
            DocumentRecord document,
            java.util.function.Function<DocumentRevisionRecord, Integer> extractor
    ) {
        if (document == null || document.getId() == null) {
            return null;
        }
        List<DocumentRevisionRecord> revisions = new ArrayList<>(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()));
        revisions.sort(REVISION_COMPARATOR);
        return revisions.stream()
                .map(extractor)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private boolean areListsEqual(List<String> list1, List<String> list2) {
        if (list1.size() != list2.size()) {
            return false;
        }
        for (int i = 0; i < list1.size(); i++) {
            UserAccount u1 = resolveUser(list1.get(i));
            UserAccount u2 = resolveUser(list2.get(i));
            UUID u1Id = u1 != null ? u1.getId() : null;
            UUID u2Id = u2 != null ? u2.getId() : null;
            if (!Objects.equals(u1Id, u2Id)) {
                return false;
            }
        }
        return true;
    }

    private String buildDraftAuditComment(DocumentDraftCreateRequest request, String defaultComment) {
        if (request == null) {
            return defaultComment;
        }
        return defaultComment
                + " | Co-authors=" + distinctNonBlank(request.coAuthorIds()).size()
                + ", Reviewers=" + distinctNonBlank(request.reviewerUserIds()).size()
                + ", Approvers=" + distinctNonBlank(request.approverUserIds()).size()
                + ", PeriodicReviewCycleMonths=" + (request.periodicReviewCycle() == null ? "-" : request.periodicReviewCycle())
                + ", PeriodicReviewNotificationDays=" + (request.periodicReviewNotification() == null ? "-" : request.periodicReviewNotification())
                + ", TrainingRequired=" + request.requiresTraining()
                + ", TrainingPeriodDays=" + request.trainingPeriodDays()
                + ", TrainingReason=" + (StringUtils.hasText(request.reasonForSkippingTraining()) ? request.reasonForSkippingTraining().trim() : "-")
                + ", Related=" + distinctNonBlank(request.relatedDocumentIds()).size()
                + ", Correlated=" + distinctNonBlank(request.correlatedDocumentIds()).size();
    }

    /** Captures the values actually persisted for a New Document submission. */
    private List<AuditTrailChangeResponse> buildCreatedDocumentDraftAuditChanges(
            DocumentRecord document,
            DocumentDraftCreateRequest request
    ) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addCreatedAuditValue(changes, "Document Number", document.getDocumentNumber());
        addCreatedAuditValue(changes, "Document Name", document.getDocumentName());
        addCreatedAuditValue(changes, "Local Title", document.getTitleLocalLanguage());
        addCreatedAuditValue(changes, "Document Type", document.getDocumentType() == null ? null : document.getDocumentType().getName());
        addCreatedAuditValue(changes, "Business Unit", document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName());
        addCreatedAuditValue(changes, "Department", document.getDepartment() == null ? null : document.getDepartment().getName());
        addCreatedAuditValue(changes, "Author", document.getAuthor() == null ? null : document.getAuthor().getFullName());
        addCreatedAuditValue(changes, "Description", document.getDescription());
        addCreatedAuditValue(changes, "Knowledge Base", document.getKnowledgeBase());
        addCreatedAuditValue(changes, "Sub-Type", document.getSubType());
        addCreatedAuditValue(changes, "Language", document.getLanguage());
        addCreatedAuditValue(changes, "Template", document.isTemplate() ? "Yes" : "No");
        addCreatedAuditValue(changes, "Periodic Review Cycle (Months)", document.getPeriodicReviewCycle());
        addCreatedAuditValue(changes, "Periodic Review Notification (Days)", document.getPeriodicReviewNotification());
        addCreatedAuditValue(changes, "Requires Training", document.isRequiresTraining() ? "Yes" : "No");
        addCreatedAuditValue(changes, "Training Period (Days)", document.getTrainingPeriodDays());
        addCreatedAuditValue(changes, "Reason for Skipping Training", document.getReasonForSkippingTraining());
        addCreatedAuditValue(changes, "Co-Authors", participantNames(document, "CO_AUTHOR"));
        addCreatedAuditValue(changes, "Reviewers", participantNames(document, "REVIEWER"));
        addCreatedAuditValue(changes, "Approvers", participantNames(document, "APPROVER"));
        addCreatedAuditValue(changes, "Training Planned Date", request == null ? null : request.trainingPlannedDate());
        addCreatedAuditValue(changes, "Training Period End Date", request == null ? null : request.trainingPeriodEndDate());
        addCreatedAuditValue(changes, "Training Completion Date", request == null ? null : request.trainingCompletionDate());
        addCreatedAuditValue(changes, "Review Date", request == null ? null : request.reviewDate());
        addCreatedAuditValue(changes, "Status", document.getStatus() == null ? null : document.getStatus().getLabel());
        return changes;
    }

    /**
     * A creation snapshot: there is no real "before" (the document didn't exist), so the row only
     * has meaning when a value was actually set. Previously this unconditionally emitted a row even
     * when the field was left blank, producing a "Not specified -> Not specified" no-op for every
     * optional field skipped on creation (Training Period, Review Date, Reason for Skipping
     * Training, ...) -- every single Document creation was littered with several of these
     * meaningless rows in the Field Modifications table.
     */
    private void addCreatedAuditValue(List<AuditTrailChangeResponse> changes, String field, Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return;
        }
        changes.add(new AuditTrailChangeResponse(field, null, String.valueOf(value)));
    }

    private record DocumentDraftAuditSnapshot(Map<String, String> values) { }

    private DocumentDraftAuditSnapshot captureDocumentDraftAuditSnapshot(DocumentRecord document) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("Document Name", auditValue(document.getDocumentName()));
        values.put("Local Title", auditValue(document.getTitleLocalLanguage()));
        values.put("Document Type", auditValue(document.getDocumentType() == null ? null : document.getDocumentType().getName()));
        values.put("Business Unit", auditValue(document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName()));
        values.put("Department", auditValue(document.getDepartment() == null ? null : document.getDepartment().getName()));
        values.put("Author", auditValue(document.getAuthor() == null ? null : document.getAuthor().getFullName()));
        values.put("Description", auditValue(document.getDescription()));
        values.put("Knowledge Base", auditValue(document.getKnowledgeBase()));
        values.put("Sub-Type", auditValue(document.getSubType()));
        values.put("Language", auditValue(document.getLanguage()));
        values.put("Template", document.isTemplate() ? "Yes" : "No");
        values.put("Periodic Review Cycle (Months)", auditValue(document.getPeriodicReviewCycle()));
        values.put("Periodic Review Notification (Days)", auditValue(document.getPeriodicReviewNotification()));
        values.put("Requires Training", document.isRequiresTraining() ? "Yes" : "No");
        values.put("Training Period (Days)", auditValue(document.getTrainingPeriodDays()));
        values.put("Reason for Skipping Training", auditValue(document.getReasonForSkippingTraining()));
        values.put("Co-Authors", participantNames(document, "CO_AUTHOR"));
        values.put("Reviewers", participantNames(document, "REVIEWER"));
        values.put("Approvers", participantNames(document, "APPROVER"));
        return new DocumentDraftAuditSnapshot(values);
    }

    private List<AuditTrailChangeResponse> buildDocumentDraftModificationChanges(
            DocumentDraftAuditSnapshot before,
            DocumentDraftAuditSnapshot after
    ) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        Map<String, String> beforeValues = before == null ? Map.of() : before.values();
        Map<String, String> afterValues = after == null ? Map.of() : after.values();
        for (String field : afterValues.keySet()) {
            String oldValue = beforeValues.getOrDefault(field, "Not specified");
            String newValue = afterValues.getOrDefault(field, "Not specified");
            if (!Objects.equals(oldValue, newValue)) {
                changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
            }
        }
        return changes;
    }

    private String auditValue(Object value) {
        if (value == null || !StringUtils.hasText(String.valueOf(value))) return "Not specified";
        return String.valueOf(value).trim();
    }

    private String participantNames(DocumentRecord document, String participantType) {
        if (document == null || document.getId() == null) return "None";
        List<String> names = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), participantType)
                .stream()
                .map(participant -> participant.getUser() == null ? null : participant.getUser().getFullName())
                .filter(StringUtils::hasText)
                .toList();
        return names.isEmpty() ? "None" : String.join(", ", names);
    }

    @Transactional
    public DocumentDetailResponse cancelDocument(UUID documentId, DocumentCancelRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        documentAuthorizationService.requireDocumentMasterLifecycleAction(currentUser, document, "CANCEL");

        // Cancel Document Master is only meaningful for a Document that never had a real Revision --
        // once a Revision exists (Draft or otherwise), the Document is no longer a "never started"
        // record; obsoleting is the correct disposition for that case. Without this guard, a direct
        // API call (or a stale/racing request) could close the Document Master while its Revision(s)
        // remain live and still editable, leaving them orphaned.
        if (documentRevisionRepository.existsByDocument_Id(documentId)) {
            throw new DocumentLifecycleConflictException(
                    "DOCUMENT_CANCEL_NOT_ALLOWED",
                    "Document cannot be cancelled because it already has a Revision. Obsolete the Document instead."
            );
        }

        // TBR-DOC-007: Reason/Activity Summary is mandatory. The DTO's @NotBlank already rejects
        // null/empty/whitespace-only at the API boundary; trim here so the persisted value is the
        // actor-entered text with no leading/trailing whitespace and never a silently-substituted
        // default (previously firstNonBlank(..., "Document cancelled") could mask a blank reason).
        String activitySummary = request == null ? null : request.activitySummary();
        if (activitySummary == null || activitySummary.trim().isEmpty()) {
            throw new IllegalArgumentException("Activity summary is required");
        }
        String trimmedActivitySummary = activitySummary.trim();

        String fromStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        DocumentStatusDefinition closedCancelled = statusRepository.findById("CLOSED_CANCELLED")
                .orElseThrow(() -> new IllegalStateException("Closed cancelled status not configured"));
        Instant cancelledAt = Instant.now();
        document.setStatus(closedCancelled);
        document.setCancelledBy(currentUser);
        document.setCancelledAt(cancelledAt);
        document.setOpenedBy(currentUser);
        document.setLastModifiedBy(currentUser);
        documentRepository.save(document);

        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                document.getId(),
                "CANCEL",
                fromStatus,
                "CLOSED_CANCELLED",
                trimmedActivitySummary
        );

        return getDocumentDetail(documentId);
    }

    @Transactional
    public DocumentDetailResponse obsoleteDocument(UUID documentId, DocumentObsoleteRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        documentAuthorizationService.requireDocumentMasterLifecycleAction(currentUser, document, "OBSOLETE");
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser);

        // TBR-DOC-007 applies equally to Obsolete's reason: the DTO's @NotBlank already rejects
        // null/empty/whitespace-only at the API boundary; trim so the persisted value is exactly
        // what the actor entered, never a silently-substituted default.
        String reason = request == null ? null : request.reason();
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Obsolete reason is required");
        }
        String trimmedReason = reason.trim();

        String fromStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        if (!"ACTIVE".equalsIgnoreCase(fromStatus)) {
            throw new DocumentLifecycleConflictException(
                    "DOCUMENT_OBSOLETE_NOT_ACTIVE",
                    "Only active documents can be obsoleted"
            );
        }

        documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE")
                .orElseThrow(() -> new DocumentLifecycleConflictException(
                        "DOCUMENT_OBSOLETE_NO_EFFECTIVE_REVISION",
                        "Document cannot be obsoleted because no effective revision exists"
                ));

        List<String> inProgressRevisionStatuses = List.of(
                "DRAFT",
                "PENDING_REVIEW",
                "PENDING_APPROVAL",
                "PENDING_TRAINING",
                "READY_FOR_PUBLISHING"
        );
        requireNoRevisionInProgress(documentId, inProgressRevisionStatuses);

        DocumentStatusDefinition obsoletedStatus = statusRepository.findById("OBSOLETED")
                .orElseThrow(() -> new IllegalStateException("Obsoleted status not configured"));
        RevisionStatusDefinition obsoletedRevisionStatus = revisionStatusRepository.findById("OBSOLETED")
                .orElseThrow(() -> new IllegalStateException("Obsoleted revision status not configured"));
        Instant obsoletedAt = parseDateOrNow(request == null ? null : request.obsoleteDate());

        // TBR-DOC-015 concurrency mechanism: a plain re-query (even a fresh EXISTS) only closes the
        // window up to the moment it runs -- a concurrent upgradeRevision could still commit a new
        // in-progress Revision between this re-check and this transaction's own commit. Verified by
        // TC-DOC-051/052 (DocumentObsoleteConcurrencyTest): the double-EXISTS-check alone did NOT
        // fully close the race. The fix is a row-level PESSIMISTIC_WRITE lock on the Document
        // shared with RevisionService.upgradeRevision (the only Revision mutation that can
        // introduce a brand-new in-progress Revision when this method's initial check saw none) --
        // whichever transaction acquires the lock first serializes the other, without introducing
        // SERIALIZABLE isolation or locking any other table. The lock is held until commit/rollback.
        documentRepository.findByIdForUpdate(documentId);
        requireNoRevisionInProgress(documentId, inProgressRevisionStatuses);

        document.setStatus(obsoletedStatus);
        document.setObsoletedBy(currentUser);
        document.setObsoletedAt(obsoletedAt);
        document.setOpenedBy(currentUser);
        document.setLastModifiedBy(currentUser);
        documentRepository.save(document);

        // The signature TOKEN is validated above (requireValidSignatureToken), but that alone
        // never persisted an e-signature row into electronic_signatures -- this was the same gap
        // found and fixed in RevisionService.cancelRevision(). The Document Signatures tab itself
        // reads document.getObsoletedBy() directly (not electronic_signatures), so this wasn't
        // visibly wrong to users, but the electronic signature audit trail was still incomplete
        // for a GMP-significant action that requires one. Record it here to close that gap.
        electronicSignatureService.createEntitySignature(
                "documents",
                document.getId(),
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                currentUser,
                request == null ? null : request.signatureToken(),
                "OBSOLETED",
                request == null ? null : request.reason(),
                null,
                fromStatus,
                "OBSOLETED"
        );

        List<DocumentRevisionRecord> revisions = documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId);
        for (DocumentRevisionRecord revision : revisions) {
            String revisionStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
            if (!"OBSOLETED".equalsIgnoreCase(revisionStatus) && !"CLOSED_CANCELLED".equalsIgnoreCase(revisionStatus)) {
                // Delegates the full status-change + history + audit sequence to RevisionService so
                // each obsoleted Revision leaves the same GMP-traceable RevisionWorkflowHistory/audit
                // trail entry a direct Revision action would -- previously this loop only flipped
                // status fields with a plain save(), with no per-Revision history/audit at all.
                revisionService.obsoleteRevisionAsPartOfDocumentObsolete(
                        revision, obsoletedRevisionStatus, currentUser, obsoletedAt, signatureSessionId
                );
            }
            // TBR-DOC-013: Controlled-Copy cascade now goes through the canonical operation shared
            // with RevisionService's publish-supersede cascade (TBR-DOC-014), instead of an
            // independent inline loop over the whole document's copies. Called unconditionally per
            // revision (not gated on the terminal-status skip above) to match the AS-IS behavior of
            // scanning every revision's copies regardless of that revision's own status -- a
            // revision already terminal simply has no remaining Ready/Distributed copies left to
            // obsolete, so this is a no-op for it.
            controlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(
                    revision,
                    currentUser,
                    obsoletedAt,
                    ControlledCopyLifecycleObsolescenceService.REASON_DOCUMENT_OBSOLETED,
                    "Controlled Copy Auto Obsoleted By Document Obsolete; Reason: DOCUMENT_OBSOLETED; Document: "
                            + document.getDocumentNumber(),
                    signatureSessionId
            );
        }

        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                document.getId(),
                "OBSOLETE",
                fromStatus,
                "OBSOLETED",
                trimmedReason,
                List.of(
                        new AuditTrailChangeResponse("Reason", "-", trimmedReason)
                ),
                signatureSessionId
        );

        // TBR-DOC-016: queued for after-commit dispatch only -- see DocumentObsoleteNotificationService.
        applicationEventPublisher.publishEvent(new com.eqms.event.DocumentObsoletedEvent(document.getId(), currentUser.getId()));

        return getDocumentDetail(documentId);
    }

    /**
     * TBR-DOC-015: re-runs the "no Revision in an in-progress status" check via a derived
     * boolean-projection query (a genuine SQL EXISTS, not a cached managed-entity read), so it
     * reflects any Revision state committed by another transaction since the previous check.
     */
    private void requireNoRevisionInProgress(UUID documentId, List<String> inProgressRevisionStatuses) {
        if (documentRevisionRepository.existsByDocument_IdAndStatus_CodeIn(documentId, inProgressRevisionStatuses)) {
            throw new DocumentLifecycleConflictException(
                    "DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS",
                    "Document cannot be obsoleted while revisions are still in progress. Please complete or cancel all open revisions first."
            );
        }
    }

    private UUID requireValidSignatureToken(DocumentObsoleteRequest request, UserAccount currentUser) {
        if (request == null || !StringUtils.hasText(request.signatureToken())) {
            throw new IllegalArgumentException("Electronic signature is required to obsolete a document");
        }
        return signatureTokenConsumptionService.requireAndConsume(request.signatureToken(), currentUser);
    }

    // TBR-DOC-015: was missing @Transactional -- loading UserAccount here (for the Author filter
    // list) triggers Hibernate to stream UserAccount.avatar (@Lob) via Postgres's Large Object
    // API, which requires a real (non-autocommit) transaction. Without one, every call failed with
    // "Large Objects may not be used in auto-commit mode" (HTTP 500), which the frontend silently
    // downgraded to "every filter dropdown shows only All" instead of surfacing the error.
    @Transactional(readOnly = true)
    public DocumentFiltersResponse getFilters() {
        List<LookupItemResponse> statuses = statusRepository.findAllByOrderBySortOrderAsc().stream()
                .map(status -> new LookupItemResponse(
                        status.getCode(),
                        status.getLabel(),
                        status.getCode(),
                        status.getLabel(),
                        status.getCode()
                ))
                .toList();

        List<LookupItemResponse> documentTypes = documentTypeRepository.findAllByOrderByNameAsc().stream()
                .map(type -> new LookupItemResponse(
                        type.getId().toString(),
                        type.getName(),
                        type.getShortCode(),
                        type.getName(),
                        type.getId().toString()
                ))
                .toList();

        List<LookupItemResponse> businessUnits = businessUnitRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(unit -> new LookupItemResponse(
                        unit.getId().toString(),
                        unit.getName(),
                        unit.getCode(),
                        unit.getName(),
                        unit.getId().toString()
                ))
                .toList();

        List<LookupItemResponse> departments = departmentRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(department -> new LookupItemResponse(
                        department.getId().toString(),
                        department.getName(),
                        department.getCode(),
                        department.getName(),
                        department.getId().toString()
                ))
                .toList();

        List<LookupItemResponse> authors = userAccountRepository.findAllByStatusOrderByFullNameAsc(UserStatus.Active).stream()
                .map(user -> new LookupItemResponse(
                        user.getId().toString(),
                        user.getFullName(),
                        user.getUsername(),
                        user.getFullName(),
                        user.getId().toString()
                ))
                .toList();

        return new DocumentFiltersResponse(statuses, documentTypes, businessUnits, departments, authors);
    }

    /** A visible Effective document together with the revision that is Effective now. */
    public record KnowledgeEntry(DocumentRecord document, DocumentRevisionRecord revision) {
    }

    /**
     * The documents the current user may see in the Knowledge portal: Effective, non-template, scoped
     * to the user's own Department unless they may view every department (DC-XF-68).
     */
    @Transactional(readOnly = true)
    public List<KnowledgeEntry> visibleKnowledgeEntries() {
        // DC-XF-68: previously scoped by nothing -- any authenticated user could browse every
        // Department's Effective documents/folders, including passing an arbitrary {departmentId}
        // path param to the two methods below that derive from this result. Scope to the current
        // user's own Department (resolved to its stable id, not the mutable display name/code
        // string), same cross-department bypass every other object-access check in this codebase
        // already grants DCO/Document Admin.
        UserAccount currentUser = currentUserService.requireCurrentUser();
        boolean canViewAllDepartments = documentAuthorizationService.canViewAllDocuments(currentUser);
        UUID currentUserDepartmentId = canViewAllDepartments ? null : resolveUserDepartmentId(currentUser);

        List<DocumentRecord> activeDocuments = documentRepository.findAllByStatus_CodeOrderByDepartment_CodeAscDocumentNameAsc("ACTIVE")
                .stream()
                .filter(document -> !document.isTemplate())
                .filter(document -> canViewAllDepartments
                        || (currentUserDepartmentId != null
                                && document.getDepartment() != null
                                && currentUserDepartmentId.equals(document.getDepartment().getId())))
                .toList();
        if (activeDocuments.isEmpty()) {
            return List.of();
        }

        List<UUID> documentIds = activeDocuments.stream()
                .map(DocumentRecord::getId)
                .toList();

        List<DocumentRevisionRecord> revisions = documentRevisionRepository
                .findAllByDocument_IdInAndStatus_CodeInOrderByDocument_IdAscCreatedAtDesc(
                        documentIds,
                        List.of("EFFECTIVE")
                );

        Map<UUID, DocumentRevisionRecord> latestEffectiveRevisionByDocumentId = new LinkedHashMap<>();
        for (DocumentRevisionRecord revision : revisions) {
            UUID documentId = revision.getDocument() == null ? null : revision.getDocument().getId();
            if (documentId != null && !latestEffectiveRevisionByDocumentId.containsKey(documentId)) {
                latestEffectiveRevisionByDocumentId.put(documentId, revision);
            }
        }

        List<KnowledgeEntry> entries = new ArrayList<>();
        for (DocumentRecord document : activeDocuments) {
            DocumentRevisionRecord effectiveRevision = latestEffectiveRevisionByDocumentId.get(document.getId());
            if (effectiveRevision != null) {
                entries.add(new KnowledgeEntry(document, effectiveRevision));
            }
        }
        return entries;
    }

    @Transactional(readOnly = true)
    public KnowledgeBaseResponse getKnowledgeBase() {
        List<KnowledgeEntry> entries = visibleKnowledgeEntries();
        if (entries.isEmpty()) {
            return new KnowledgeBaseResponse(0, List.of());
        }
        List<DocumentRecord> activeDocuments = entries.stream().map(KnowledgeEntry::document).toList();
        Map<UUID, DocumentRevisionRecord> latestEffectiveRevisionByDocumentId = new LinkedHashMap<>();
        entries.forEach(entry -> latestEffectiveRevisionByDocumentId.put(entry.document().getId(), entry.revision()));

        Map<UUID, KnowledgeBaseFolderBuilder> folders = new LinkedHashMap<>();
        int totalDocuments = 0;

        for (DocumentRecord document : activeDocuments) {
            DocumentRevisionRecord effectiveRevision = latestEffectiveRevisionByDocumentId.get(document.getId());
            if (effectiveRevision == null || document.getDepartment() == null) {
                continue;
            }

            Department department = document.getDepartment();
            KnowledgeBaseFolderBuilder folder = folders.computeIfAbsent(department.getId(), key ->
                    new KnowledgeBaseFolderBuilder(department.getId().toString(), department.getCode(), department.getName())
            );

            folder.documents.add(new KnowledgeBaseDocumentResponse(
                    document.getId().toString(),
                    document.getDocumentNumber(),
                    document.getDocumentName(),
                    effectiveRevision.getRevisionNumber(),
                    effectiveRevision.getStatus() == null ? null : effectiveRevision.getStatus().getLabel(),
                    document.getStatus() == null ? null : document.getStatus().getLabel(),
                    document.getDocumentType() == null ? null : document.getDocumentType().getName(),
                    document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName(),
                    department.getName(),
                    document.getOpenedBy() == null ? null : document.getOpenedBy().getFullName(),
                    DateTimeFormatUtils.formatDateTime(effectiveRevision.getCreatedAt()),
                    DateTimeFormatUtils.formatDate(document.getEffectiveDate()),
                    DateTimeFormatUtils.formatDate(document.getValidUntil()),
                    document.isHasRelatedDocuments(),
                    document.isHasCorrelatedDocuments(),
                    document.isTemplate()
            ));
            totalDocuments++;
        }

        List<KnowledgeBaseFolderResponse> folderResponses = folders.values().stream()
                .map(KnowledgeBaseFolderBuilder::toResponse)
                .toList();

        return new KnowledgeBaseResponse(totalDocuments, folderResponses);
    }

    @Transactional(readOnly = true)
    public List<KnowledgeBaseDepartmentResponse> getKnowledgeBaseDepartments(String search, String sortDirection) {
        KnowledgeBaseResponse knowledgeBase = getKnowledgeBase();
        Map<UUID, Integer> documentCountsByDepartment = new LinkedHashMap<>();
        for (KnowledgeBaseFolderResponse folder : knowledgeBase.folders()) {
            if (folder.departmentId() != null) {
                try {
                    documentCountsByDepartment.put(UUID.fromString(folder.departmentId()), folder.documentCount());
                } catch (IllegalArgumentException ignored) {
                    // keep folder out if id is malformed
                }
            }
        }

        String normalizedSearch = Optional.ofNullable(normalizeString(search)).orElse("").toLowerCase(Locale.ROOT);
        Comparator<Department> comparator = Comparator
                .comparing((Department department) -> Optional.ofNullable(normalizeString(department.getName())).orElse(""), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(department -> Optional.ofNullable(normalizeString(department.getCode())).orElse(""), String.CASE_INSENSITIVE_ORDER);
        if ("desc".equalsIgnoreCase(sortDirection)) {
            comparator = comparator.reversed();
        }

        return departmentRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .filter(department -> normalizedSearch.isBlank()
                        || Optional.ofNullable(normalizeString(department.getName())).orElse("").toLowerCase(Locale.ROOT).contains(normalizedSearch)
                        || Optional.ofNullable(normalizeString(department.getCode())).orElse("").toLowerCase(Locale.ROOT).contains(normalizedSearch))
                .sorted(comparator)
                .map(department -> new KnowledgeBaseDepartmentResponse(
                        department.getId().toString(),
                        department.getCode(),
                        department.getName(),
                        documentCountsByDepartment.getOrDefault(department.getId(), 0)
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public KnowledgeBaseFolderResponse getKnowledgeBaseDepartment(UUID departmentId, String search, String sortField, String sortOrder) {
        KnowledgeBaseResponse knowledgeBase = getKnowledgeBase();
        String normalizedSearch = Optional.ofNullable(normalizeString(search)).orElse("").toLowerCase(Locale.ROOT);
        KnowledgeBaseFolderResponse folder = knowledgeBase.folders().stream()
                .filter(item -> departmentId.toString().equals(item.departmentId()))
                .findFirst()
                .orElse(new KnowledgeBaseFolderResponse(departmentId.toString(), null, null, 0, List.of()));

        List<KnowledgeBaseDocumentResponse> documents = folder.documents() == null ? List.of() : folder.documents().stream()
                .filter(doc -> normalizedSearch.isBlank()
                        || Optional.ofNullable(doc.documentNumber()).orElse("").toLowerCase(Locale.ROOT).contains(normalizedSearch)
                        || Optional.ofNullable(doc.documentName()).orElse("").toLowerCase(Locale.ROOT).contains(normalizedSearch)
                        || Optional.ofNullable(doc.documentType()).orElse("").toLowerCase(Locale.ROOT).contains(normalizedSearch))
                .sorted((left, right) -> {
                    int comparison = switch (Optional.ofNullable(sortField).orElse("name").toLowerCase(Locale.ROOT)) {
                        case "filetype" -> Optional.ofNullable(left.documentType()).orElse("").compareToIgnoreCase(Optional.ofNullable(right.documentType()).orElse(""));
                        case "lastopened" -> Optional.ofNullable(left.created()).orElse("").compareToIgnoreCase(Optional.ofNullable(right.created()).orElse(""));
                        case "filesize" -> 0;
                        default -> Optional.ofNullable(left.documentName()).orElse("").compareToIgnoreCase(Optional.ofNullable(right.documentName()).orElse(""));
                    };
                    return "desc".equalsIgnoreCase(sortOrder) ? -comparison : comparison;
                })
                .toList();

        return new KnowledgeBaseFolderResponse(folder.departmentId(), folder.departmentCode(), folder.departmentName(), documents.size(), documents);
    }

    private Specification<DocumentRecord> buildSpecification(
            String scope,
            String search,
            String ids,
            String status,
            String documentType,
            String businessUnit,
            String department,
            String authorId,
            String author,
            String relatedDocument,
            String correlatedDocument,
            String isTemplate,
            String createdFrom,
            String createdTo,
            String effectiveFrom,
            String effectiveTo,
            String validFrom,
            String validTo
            ,
            UserAccount currentUser
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<DocumentRecord, DocumentStatusDefinition> statusJoin = root.join("status", JoinType.LEFT);
            Join<DocumentRecord, DocumentType> typeJoin = root.join("documentType", JoinType.LEFT);
            Join<DocumentRecord, BusinessUnit> businessUnitJoin = root.join("businessUnit", JoinType.LEFT);
            Join<DocumentRecord, Department> departmentJoin = root.join("department", JoinType.LEFT);
            Join<DocumentRecord, UserAccount> authorJoin = root.join("author", JoinType.LEFT);
            Join<DocumentRecord, UserAccount> openedByJoin = root.join("openedBy", JoinType.LEFT);

            if (!documentAuthorizationService.canViewAllDocuments(currentUser)) {
                UUID currentUserId = currentUser.getId();
                Predicate authorPredicate = cb.equal(authorJoin.get("id"), currentUserId);
                var subquery = query.subquery(UUID.class);
                var participantRoot = subquery.from(DocumentWorkflowParticipant.class);
                subquery.select(participantRoot.get("document").get("id"));
                subquery.where(
                        cb.equal(participantRoot.get("document").get("id"), root.get("id")),
                        cb.equal(participantRoot.get("participantType"), "CO_AUTHOR"),
                        cb.equal(participantRoot.get("user").get("id"), currentUserId)
                );

                var revisionParticipantSubquery = query.subquery(UUID.class);
                var revisionParticipantRoot = revisionParticipantSubquery.from(RevisionWorkflowParticipant.class);
                revisionParticipantSubquery.select(revisionParticipantRoot.get("revision").get("document").get("id"));
                revisionParticipantSubquery.where(
                        cb.equal(revisionParticipantRoot.get("revision").get("document").get("id"), root.get("id")),
                        cb.equal(revisionParticipantRoot.get("user").get("id"), currentUserId)
                );

                predicates.add(cb.or(
                        authorPredicate,
                        cb.exists(subquery),
                        cb.exists(revisionParticipantSubquery)
                ));
                query.distinct(true);
            }

            if ("owned-by-me".equalsIgnoreCase(scope)) {
                UUID currentUserId = currentUserService.requireCurrentUser().getId();
                predicates.add(cb.equal(authorJoin.get("id"), currentUserId));
            } else if (StringUtils.hasText(authorId)) {
                UUID parsed = tryParseUuid(authorId);
                if (parsed != null) {
                    predicates.add(cb.equal(authorJoin.get("id"), parsed));
                }
            } else if (StringUtils.hasText(author)) {
                String normalized = normalize(author);
                predicates.add(cb.or(
                        cb.equal(cb.lower(authorJoin.get("fullName")), normalized),
                        cb.equal(cb.lower(authorJoin.get("username")), normalized)
                ));
            }

            if (StringUtils.hasText(ids)) {
                List<UUID> parsedIds = parseUuidList(ids);
                if (!parsedIds.isEmpty()) {
                    predicates.add(root.get("id").in(parsedIds));
                } else {
                    predicates.add(cb.disjunction());
                }
            }

            addBooleanPredicate(predicates, cb, root.get("hasRelatedDocuments"), relatedDocument);
            addBooleanPredicate(predicates, cb, root.get("hasCorrelatedDocuments"), correlatedDocument);
            addBooleanPredicate(predicates, cb, root.get("template"), isTemplate);

            if (StringUtils.hasText(search)) {
                String pattern = "%" + normalize(search) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("documentNumber")), pattern),
                        cb.like(cb.lower(root.get("documentName")), pattern),
                        cb.like(cb.lower(root.get("version")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern),
                        cb.like(cb.lower(typeJoin.get("name")), pattern),
                        cb.like(cb.lower(typeJoin.get("shortCode")), pattern),
                        cb.like(cb.lower(businessUnitJoin.get("name")), pattern),
                        cb.like(cb.lower(businessUnitJoin.get("code")), pattern),
                        cb.like(cb.lower(departmentJoin.get("name")), pattern),
                        cb.like(cb.lower(departmentJoin.get("code")), pattern),
                        cb.like(cb.lower(authorJoin.get("fullName")), pattern),
                        cb.like(cb.lower(authorJoin.get("username")), pattern),
                        cb.like(cb.lower(openedByJoin.get("fullName")), pattern)
                ));
            }

            addStatusPredicate(predicates, cb, statusJoin.get("code"), statusJoin.get("label"), status);
            addLookupPredicate(predicates, cb, typeJoin.get("id"), typeJoin.get("name"), documentType);
            addLookupPredicate(predicates, cb, businessUnitJoin.get("id"), businessUnitJoin.get("name"), businessUnit);
            addLookupPredicate(predicates, cb, departmentJoin.get("id"), departmentJoin.get("name"), department);

            addCreatedDateRangePredicate(predicates, cb, root.get("createdAt"), createdFrom, createdTo);
            addDateRangePredicate(predicates, cb, root.get("effectiveDate"), effectiveFrom, effectiveTo);
            addDateRangePredicate(predicates, cb, root.get("validUntil"), validFrom, validTo);

        return cb.and(predicates.toArray(Predicate[]::new));
    };
    }

    private void ensureCurrentUserCanViewDocument(DocumentRecord document, UserAccount currentUser) {
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
    }

    /** Resolves the current user's own Department to its stable id -- user.getDepartment() only
     *  stores the Department's code (a mutable display value), matching the resolution convention
     *  already used elsewhere in this codebase (DepartmentRepository.findByCodeIgnoreCase). */
    private UUID resolveUserDepartmentId(UserAccount user) {
        if (user == null || !StringUtils.hasText(user.getDepartment())) {
            return null;
        }
        // The user profile stores the department's display name (e.g. "Quality Assurance"); older data may
        // hold its code ("QA"). Resolve either, otherwise a scoped user silently sees no documents.
        String value = user.getDepartment().trim();
        return departmentRepository.findByCodeIgnoreCase(value)
                .or(() -> departmentRepository.findByNameIgnoreCase(value))
                .map(Department::getId)
                .orElse(null);
    }

    private void addLookupPredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<?> idPath,
            jakarta.persistence.criteria.Path<String> namePath,
            String value
    ) {
        if (!StringUtils.hasText(value) || "All".equalsIgnoreCase(value)) {
            return;
        }
        String normalized = normalize(value);
        UUID parsed = tryParseUuid(value);
        if (parsed != null) {
            predicates.add(cb.equal(idPath, parsed));
            return;
        }
        predicates.add(cb.or(
                cb.equal(cb.lower(idPath.as(String.class)), normalized),
                cb.equal(cb.lower(idPath.as(String.class)), normalized.replace("-", "_")),
                cb.equal(cb.lower(idPath.as(String.class)), normalized.replace("_", "-")),
                cb.equal(cb.lower(namePath), normalized),
                cb.equal(cb.lower(namePath), normalized.replace("-", " ")),
                cb.equal(cb.lower(namePath), normalized.replace("_", " "))
        ));
    }

    private void addStatusPredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<?> codePath,
            jakarta.persistence.criteria.Path<String> labelPath,
            String value
    ) {
        if (!StringUtils.hasText(value) || "All".equalsIgnoreCase(value)) {
            return;
        }
        List<String> statuses = Arrays.stream(value.split(","))
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList();
        if (statuses.size() <= 1) {
            addLookupPredicate(predicates, cb, codePath, labelPath, value);
            return;
        }

        List<Predicate> statusPredicates = new ArrayList<>();
        for (String status : statuses) {
            String normalized = normalize(status);
            statusPredicates.add(cb.or(
                    cb.equal(cb.lower(codePath.as(String.class)), normalized),
                    cb.equal(cb.lower(codePath.as(String.class)), normalized.replace("-", "_")),
                    cb.equal(cb.lower(codePath.as(String.class)), normalized.replace("_", "-")),
                    cb.equal(cb.lower(labelPath), normalized),
                    cb.equal(cb.lower(labelPath), normalized.replace("-", " ")),
                    cb.equal(cb.lower(labelPath), normalized.replace("_", " "))
            ));
        }
        predicates.add(cb.or(statusPredicates.toArray(Predicate[]::new)));
    }

    private void addCreatedDateRangePredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<Instant> path,
            String from,
            String to
    ) {
        LocalDate fromDate = parseDate(from);
        LocalDate toDate = parseDate(to);
        if (fromDate != null) {
            predicates.add(cb.greaterThanOrEqualTo(path, fromDate.atStartOfDay(SYSTEM_ZONE).toInstant()));
        }
        if (toDate != null) {
            predicates.add(cb.lessThanOrEqualTo(path, toDate.plusDays(1).atStartOfDay(SYSTEM_ZONE).minusNanos(1).toInstant()));
        }
    }

    private void addDateRangePredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<LocalDate> path,
            String from,
            String to
    ) {
        LocalDate fromDate = parseDate(from);
        LocalDate toDate = parseDate(to);
        if (fromDate != null) {
            predicates.add(cb.greaterThanOrEqualTo(path, fromDate));
        }
        if (toDate != null) {
            predicates.add(cb.lessThanOrEqualTo(path, toDate));
        }
    }

    private void addBooleanPredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<Boolean> path,
            String value
    ) {
        Boolean parsed = parseBooleanFilter(value);
        if (parsed == null) {
            return;
        }
        predicates.add(cb.equal(path, parsed));
    }

    private DocumentRevisionSummaryResponse toRevisionSummary(DocumentRevisionRecord revision) {
        StatusResponse statusInfo = StatusMapper.from(revision.getStatus());
        boolean canOpenAuthoringWorkspace = documentAuthorizationService
                .canEditDraftRevision(currentUserService.requireCurrentUser(), revision);
        return new DocumentRevisionSummaryResponse(
                revision.getId().toString(),
                revision.getDocument() == null ? null : revision.getDocument().getId() == null ? null : revision.getDocument().getId().toString(),
                revision.getRevisionNumber(),
                DateTimeFormatUtils.formatDateTime(revision.getCreatedAt()),
                revision.getOpenedBy() == null ? null : revision.getOpenedBy().getFullName(),
                revision.getRevisionName(),
                StatusMapper.label(revision.getStatus()),
                StatusMapper.code(revision.getStatus()),
                statusInfo,
                canOpenAuthoringWorkspace
        );
    }

    private boolean isSelectableTemplateDocument(DocumentRecord document) {
        if (document == null || !document.isTemplate()) {
            return false;
        }
        if (document.getStatus() == null || !"ACTIVE".equalsIgnoreCase(document.getStatus().getCode())) {
            return false;
        }
        DocumentRevisionRecord effectiveRevision = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")
                .orElse(null);
        if (effectiveRevision == null
                || !StringUtils.hasText(effectiveRevision.getFilePath())
                || !StringUtils.hasText(effectiveRevision.getSourceFileChecksum())) {
            return false;
        }
        String fileName = effectiveRevision.getFileName() == null
                ? ""
                : effectiveRevision.getFileName().trim().toLowerCase(Locale.ROOT);
        return fileName.endsWith(".docx")
                || (effectiveRevision.getFileType() != null
                && effectiveRevision.getFileType().toLowerCase(Locale.ROOT).contains("wordprocessingml.document"));
    }

    private void requireTemplateUse(UserAccount user) {
        // Selecting an existing template to start a revision from is just another way of supplying the revision's source
        // file, so it rides on the upload permission (documents.template.use was retired). Creating/marking a document
        // as a Template rides on the ordinary document-create permission (see DocumentService#createDocumentDraft).
        if (user == null || !permissionEvaluationService.hasPermission(user, "documents.revision.upload_source")) {
            throw new AccessDeniedException("Current user is not allowed to use controlled document templates");
        }
    }

    private DocumentListItemResponse toListItem(DocumentRecord document) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        boolean hasAnyRevision = documentRevisionRepository.existsByDocument_Id(document.getId());
        boolean canStartInitialAuthoring = documentAuthorizationService
                .canEditInitialDocumentDraft(currentUser, document);
        String created = DateTimeFormatUtils.formatDateTime(document.getCreatedAt());
        String modified = DateTimeFormatUtils.formatDateTime(document.getUpdatedAt());
        String effectiveDate = DateTimeFormatUtils.formatDate(document.getEffectiveDate());
        String validUntil = DateTimeFormatUtils.formatDate(document.getValidUntil());
        String reviewDate = DateTimeFormatUtils.formatDate(document.getReviewDate());
        Optional<DocumentRevisionRecord> currentEffectiveRevision = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE");
        String currentEffectiveRevisionId = currentEffectiveRevision
                .map(DocumentRevisionRecord::getId)
                .map(UUID::toString)
                .orElse(null);
        String currentEffectiveRevisionNumber = currentEffectiveRevision
                .map(DocumentRevisionRecord::getRevisionNumber)
                .orElse(null);

        List<DocumentRelationResponse> relatedDocuments = documentRelationRepository
                .findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED")
                .stream()
                .map(relation -> toRelationResponse(relation, "RELATED"))
                .toList();

        List<DocumentRelationResponse> correlatedDocuments = documentRelationRepository
                .findAllBySourceDocument_IdAndRelationType(document.getId(), "CORRELATED")
                .stream()
                .map(relation -> toRelationResponse(relation, "CORRELATED"))
                .toList();

        return new DocumentListItemResponse(
                document.getId().toString(),
                document.getDocumentNumber(),
                document.getDocumentName(),
                currentEffectiveRevisionNumber,
                currentEffectiveRevisionNumber,
                currentEffectiveRevisionId,
                currentEffectiveRevision.isPresent(),
                document.getStatus() == null ? null : document.getStatus().getLabel(),
                new StatusResponse(document.getStatus() == null ? null : document.getStatus().getCode(), document.getStatus() == null ? null : document.getStatus().getLabel()),
                document.getDocumentType() == null ? null : document.getDocumentType().getName(),
                document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName(),
                document.getDepartment() == null ? null : document.getDepartment().getName(),
                document.getAuthor() == null ? null : document.getAuthor().getFullName(),
                document.getOwner() == null ? null : document.getOwner().getFullName(),
                document.getOpenedBy() == null ? null : document.getOpenedBy().getFullName(),
                created,
                created,
                effectiveDate,
                validUntil,
                reviewDate,
                document.isHasRelatedDocuments(),
                document.isHasCorrelatedDocuments(),
                document.isTemplate(),
                modified,
                document.getLastModifiedBy() == null ? null : document.getLastModifiedBy().getFullName(),
                relatedDocuments,
                correlatedDocuments,
                hasAnyRevision,
                canStartInitialAuthoring,
                resolveDocumentReviewRequirement(document).name(),
                document.getStatus() != null && "ACTIVE".equalsIgnoreCase(document.getStatus().getCode())
                        && document.getNextRevisionConfiguredAt() != null
                        && documentAuthorizationService.canStartNewRevisionUpload(currentUser, document)
        );
    }

    private DocumentParticipantResponse toParticipantResponse(DocumentWorkflowParticipant participant, Integer sequenceOrder) {
        UserAccount user = participant.getUser();
        return new DocumentParticipantResponse(
                user == null ? null : user.getId().toString(),
                user == null ? null : user.getFullName(),
                user == null ? null : user.getUsername(),
                user == null ? null : user.getPosition(),
                user == null ? null : user.getEmail(),
                user == null ? null : user.getDepartment(),
                sequenceOrder,
                null,
                null,
                null,
                user == null || user.getStatus() == null ? null : user.getStatus().name()
        );
    }

    private DocumentRelationResponse toRelationResponse(DocumentRelation relation, String relationType) {
        DocumentRecord target = relation.getTargetDocument();
        String targetVersion = null;
        String targetStatus = target == null || target.getStatus() == null ? null : target.getStatus().getLabel();
        if (target != null) {
            var effectiveRevision = documentRevisionRepository
                    .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(target.getId(), "EFFECTIVE");
            if (effectiveRevision.isPresent()) {
                var revision = effectiveRevision.get();
                if (revision.getRevisionNumber() != null) {
                    targetVersion = revision.getRevisionNumber();
                }
                if (revision.getStatus() != null) {
                    targetStatus = revision.getStatus().getLabel();
                }
            }
        }
        return new DocumentRelationResponse(
                target == null ? null : target.getId().toString(),
                target == null ? null : target.getDocumentNumber(),
                target == null ? null : target.getDocumentName(),
                target == null ? null : formatDocumentLabel(target),
                targetVersion,
                targetStatus,
                target == null || target.getDocumentType() == null ? null : target.getDocumentType().getName(),
                target == null || target.getBusinessUnit() == null ? null : target.getBusinessUnit().getName(),
                target == null || target.getDepartment() == null ? null : target.getDepartment().getName(),
                target == null || target.getAuthor() == null ? null : target.getAuthor().getFullName(),
                target == null || target.getOpenedBy() == null ? null : target.getOpenedBy().getFullName(),
                target == null ? null : DateTimeFormatUtils.formatDateTime(target.getCreatedAt()),
                target == null ? null : DateTimeFormatUtils.formatDate(target.getEffectiveDate()),
                target == null ? null : DateTimeFormatUtils.formatDate(target.getValidUntil()),
                relationType,
                target != null && target.isHasRelatedDocuments(),
                target != null && target.isHasCorrelatedDocuments(),
                target != null && target.isTemplate()
        );
    }

    private String resolveSortProperty(String sortBy) {
        if (!StringUtils.hasText(sortBy)) {
            return "createdAt";
        }
        return switch (sortBy) {
            case "documentNumber" -> "documentNumber";
            case "documentId" -> "documentNumber";
            case "created" -> "createdAt";
            case "openedBy" -> "openedBy.fullName";
            case "title", "documentName" -> "documentName";
            case "status" -> "status.sortOrder";
            case "type" -> "documentType.name";
            case "businessUnit" -> "businessUnit.name";
            case "department" -> "department.name";
            case "author" -> "author.fullName";
            case "effectiveDate" -> "effectiveDate";
            case "validUntil" -> "validUntil";
            default -> "createdAt";
        };
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private List<UUID> parseUuidList(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of();
        }
        List<UUID> result = new ArrayList<>();
        for (String token : value.split(",")) {
            UUID parsed = tryParseUuid(token.trim());
            if (parsed != null) {
                result.add(parsed);
            }
        }
        return result;
    }

    private DocumentType resolveDocumentType(String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Document type is required");
        }
        UUID parsed = tryParseUuid(value);
        if (parsed != null) {
            return documentTypeRepository.findById(parsed)
                    .orElseThrow(() -> new IllegalArgumentException("Document type not found"));
        }
        return documentTypeRepository.findByShortCodeIgnoreCase(value)
                .or(() -> documentTypeRepository.findByNameIgnoreCase(value))
                .orElseThrow(() -> new IllegalArgumentException("Document type not found"));
    }

    private BusinessUnit resolveBusinessUnit(String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Business unit is required");
        }
        UUID parsed = tryParseUuid(value);
        if (parsed != null) {
            return businessUnitRepository.findById(parsed)
                    .orElseThrow(() -> new IllegalArgumentException("Business unit not found"));
        }
        return businessUnitRepository.findByCodeIgnoreCase(value)
                .or(() -> businessUnitRepository.findByNameIgnoreCase(value))
                .orElseThrow(() -> new IllegalArgumentException("Business unit not found"));
    }

    private Department resolveDepartment(String value, BusinessUnit businessUnit) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Department is required");
        }
        UUID parsed = tryParseUuid(value);
        Department department = parsed != null
                ? departmentRepository.findById(parsed)
                        .orElseThrow(() -> new IllegalArgumentException("Department not found"))
                : departmentRepository.findByCodeIgnoreCase(value)
                .or(() -> departmentRepository.findByNameIgnoreCase(value))
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        if (businessUnit != null && department.getBusinessUnit() != null
                && !Objects.equals(department.getBusinessUnit().getId(), businessUnit.getId())) {
            throw new IllegalArgumentException("Department does not belong to the selected business unit");
        }
        return department;
    }

    private UserAccount resolveUser(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        UUID parsed = tryParseUuid(value);
        if (parsed != null) {
            return userAccountRepository.findById(parsed).orElse(null);
        }
        return userAccountRepository.findByUsername(value)
                .or(() -> userAccountRepository.findByEmail(value))
                .orElseGet(() -> userAccountRepository.findByFullNameIgnoreCase(value).orElse(null));
    }

    private DocumentRecord resolveDocumentRecord(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        UUID parsed = tryParseUuid(value);
        if (parsed != null) {
            DocumentRecord document = documentRepository.findById(parsed).orElse(null);
            if (document != null) {
                return document;
            }
            return documentRevisionRepository.findById(parsed)
                    .map(DocumentRevisionRecord::getDocument)
                    .orElse(null);
        }
        return documentRepository.findByDocumentNumber(value)
                .or(() -> {
                    String parentDocumentNumber = resolveParentDocumentNumber(value);
                    return StringUtils.hasText(parentDocumentNumber)
                            ? documentRepository.findByDocumentNumber(parentDocumentNumber)
                            : java.util.Optional.empty();
                })
                .orElse(null);
    }

    private DocumentLookupResult resolveDocumentReference(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        UUID parsed = tryParseUuid(value);
        if (parsed != null) {
            DocumentRecord document = documentRepository.findById(parsed).orElse(null);
            if (document != null) {
                return new DocumentLookupResult(document, formatDocumentLabel(document));
            }
            return documentRevisionRepository.findById(parsed)
                    .map(revision -> {
                        DocumentRecord sourceDocument = revision.getDocument();
                        return sourceDocument == null ? null : new DocumentLookupResult(sourceDocument, formatDocumentLabel(sourceDocument));
                    })
                    .orElse(null);
        }

        DocumentRecord document = documentRepository.findByDocumentNumber(value)
                .or(() -> {
                    String parentDocumentNumber = resolveParentDocumentNumber(value);
                    return StringUtils.hasText(parentDocumentNumber)
                            ? documentRepository.findByDocumentNumber(parentDocumentNumber)
                            : java.util.Optional.empty();
                })
                .orElse(null);
        return document == null ? null : new DocumentLookupResult(document, formatDocumentLabel(document));
    }

    private String describeDocumentReference(String value) {
        if (!StringUtils.hasText(value)) {
            return "-";
        }
        DocumentLookupResult resolved = resolveDocumentReference(value);
        if (resolved != null && StringUtils.hasText(resolved.displayLabel())) {
            return resolved.displayLabel();
        }
        return value;
    }

    private List<DocumentLookupResult> resolveDocumentReferences(List<String> values, String relationLabel) {
        List<DocumentLookupResult> resolved = new ArrayList<>();
        for (String value : values) {
            DocumentLookupResult reference = resolveDocumentReference(value);
            if (reference == null || reference.document() == null) {
                throw new IllegalArgumentException(relationLabel + " document not found: " + describeDocumentReference(value));
            }
            String statusCode = reference.document().getStatus() == null
                    ? null
                    : reference.document().getStatus().getCode();
            if (!"DRAFT".equalsIgnoreCase(statusCode) && !"ACTIVE".equalsIgnoreCase(statusCode)) {
                throw new IllegalArgumentException(
                        relationLabel + " document must have Draft or Active status: " + reference.displayLabel()
                );
            }
            resolved.add(reference);
        }
        return resolved;
    }

    private void ensureNoDuplicateResolvedDocuments(List<DocumentLookupResult> documents, String relationLabel) {
        Map<UUID, String> seen = new LinkedHashMap<>();
        for (DocumentLookupResult reference : documents) {
            UUID documentId = reference.document().getId();
            String label = reference.displayLabel();
            String existing = seen.putIfAbsent(documentId, label);
            if (existing != null) {
                throw new IllegalArgumentException(relationLabel + " document list contains duplicated document: " + label);
            }
        }
    }

    private String formatDocumentLabel(DocumentRecord document) {
        if (document == null) {
            return "-";
        }
        String number = normalizeString(document.getDocumentNumber());
        String name = normalizeString(document.getDocumentName());
        if (number != null && name != null) {
            return number + " - " + name;
        }
        if (number != null) {
            return number;
        }
        if (name != null) {
            return name;
        }
        return document.getId() == null ? "-" : document.getId().toString();
    }

    // Optional so constructors used by unit tests stay valid; always injected in the application.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private KnowledgeHierarchyService knowledgeHierarchyService;

    private String resolveDerivedKnowledgeBase(DocumentRecord document) {
        if (knowledgeHierarchyService == null) {
            return null;
        }
        com.eqms.entity.KnowledgeCategoryHierarchy hierarchy = knowledgeHierarchyService.defaultHierarchyOrNull();
        if (hierarchy == null) {
            return null;
        }
        return com.eqms.enums.KnowledgeField.parse(hierarchy.getDeterminatorField())
                .map(field -> field.valueOf(document))
                .map(com.eqms.enums.KnowledgeField.Value::label)
                .orElse(null);
    }

    private void applyDraftFields(DocumentRecord document, DocumentDraftCreateRequest request, UserAccount currentUser, boolean isNew) {
        if (isNew) {
            if (!StringUtils.hasText(request.documentName())) {
                throw new IllegalArgumentException("Document name is required");
            }
            if (!StringUtils.hasText(request.documentType())) {
                throw new IllegalArgumentException("Document type is required");
            }
            if (!StringUtils.hasText(request.businessUnit())) {
                throw new IllegalArgumentException("Business unit is required");
            }
            if (!StringUtils.hasText(request.department())) {
                throw new IllegalArgumentException("Department is required");
            }
            if (!StringUtils.hasText(request.author())) {
                throw new IllegalArgumentException("Author is required");
            }
        }

        DocumentType documentType = null;
        if (request.documentType() != null) {
            documentType = resolveDocumentType(request.documentType());
            boolean documentTypeChanged = document.getDocumentType() == null
                    || !Objects.equals(document.getDocumentType().getId(), documentType.getId());
            if ((isNew || documentTypeChanged) && !documentType.isActive()) {
                throw new IllegalArgumentException("Document type is inactive and cannot be assigned to a document");
            }
            if (!isNew
                    && StringUtils.hasText(document.getDocumentNumber())
                    && document.getDocumentType() != null
                    && !Objects.equals(document.getDocumentType().getId(), documentType.getId())) {
                throw new IllegalArgumentException("Document Type cannot be changed after a document number has been issued");
            }
            document.setDocumentType(documentType);
        } else {
            documentType = document.getDocumentType();
        }

        BusinessUnit businessUnit = null;
        if (request.businessUnit() != null) {
            businessUnit = resolveBusinessUnit(request.businessUnit());
            boolean businessUnitChanged = document.getBusinessUnit() == null
                    || !Objects.equals(document.getBusinessUnit().getId(), businessUnit.getId());
            if ((isNew || businessUnitChanged) && !businessUnit.isActive()) {
                throw new IllegalArgumentException("Business unit is inactive and cannot be assigned to a document");
            }
            document.setBusinessUnit(businessUnit);
        } else {
            businessUnit = document.getBusinessUnit();
        }

        Department department = null;
        if (request.department() != null) {
            department = resolveDepartment(request.department(), businessUnit);
            boolean departmentChanged = document.getDepartment() == null
                    || !Objects.equals(document.getDepartment().getId(), department.getId());
            if ((isNew || departmentChanged) && !department.isActive()) {
                throw new IllegalArgumentException("Department is inactive and cannot be assigned to a document");
            }
            document.setDepartment(department);
        } else {
            department = document.getDepartment();
        }

        UserAccount author = null;
        if (request.author() != null) {
            author = resolveUser(request.author());
            if (author != null) {
                document.setAuthor(author);
                recordStakeholderHistory(document, author, "AUTHOR");
            }
        }

        DocumentStatusDefinition draftStatus = statusRepository.findById("DRAFT")
                .orElseThrow(() -> new IllegalStateException("Draft status not configured"));

        if (isNew && !StringUtils.hasText(document.getDocumentNumber())) {
            if (StringUtils.hasText(request.legacyDocumentNumber())) {
                // Legacy Import path: the caller supplies the document number that already
                // exists outside the system (e.g. on the paper original) instead of the
                // auto-generated sequence. Gated on its own permission so an ordinary Author can
                // never influence numbering, and validated for uniqueness the same as the normal
                // generator's own collision check.
                if (!permissionEvaluationService.hasPermission(currentUser, "documents.legacy_import.manage")) {
                    throw new AccessDeniedException("Only Legacy Import is permitted to set a document number directly.");
                }
                String legacyNumber = request.legacyDocumentNumber().trim();
                requireLegacyDocumentNumberFormat(legacyNumber, documentType);
                if (documentRepository.existsByDocumentNumber(legacyNumber)) {
                    throw new IllegalArgumentException("Document number '" + legacyNumber + "' is already in use.");
                }
                document.setDocumentNumber(legacyNumber);
                document.setLegacyImport(true);
                document.setLegacyImportedBy(currentUser);
                document.setLegacyImportedAt(Instant.now());
                if (StringUtils.hasText(request.legacyOriginalEffectiveDate())) {
                    document.setOriginalEffectiveDate(parseLegacyEffectiveInstant(request.legacyOriginalEffectiveDate()));
                }
                if (StringUtils.hasText(request.legacyJustification())) {
                    document.setLegacyJustification(request.legacyJustification().trim());
                }
                // The initial Revision number (e.g. the paper original's own "4.0.0") is set by
                // the Legacy Import screen's revision-creation step, not here -- this Document
                // draft alone stays fully valid at the configured seed even before that step runs.
                document.setVersion(systemConfigurationService.getRevisionNumberSeed());
            } else {
                document.setDocumentNumber(generateDocumentNumber(documentType, department));
                document.setVersion(systemConfigurationService.getRevisionNumberSeed());
            }
        }
        if (request.documentName() != null) {
            document.setDocumentName(request.documentName().trim());
        }
        if (request.titleLocalLanguage() != null) {
            document.setTitleLocalLanguage(StringUtils.hasText(request.titleLocalLanguage()) ? request.titleLocalLanguage().trim() : null);
        }
        if (isNew) {
            document.setStatus(draftStatus);
        }
        document.setOwner(currentUser);
        document.setOpenedBy(currentUser);
        document.setLastModifiedBy(currentUser);
        if (request.description() != null) {
            document.setDescription(StringUtils.hasText(request.description()) ? request.description().trim() : null);
        }
        // The Knowledge Base is derived from the default Knowledge Categories Hierarchy's determinator
        // field (for example the Business Unit) and is never typed by the user. Without a hierarchy the
        // legacy request value is kept so existing behaviour does not change.
        String derivedKnowledgeBase = resolveDerivedKnowledgeBase(document);
        if (derivedKnowledgeBase != null) {
            document.setKnowledgeBase(derivedKnowledgeBase);
        } else if (request.knowledgeBase() != null) {
            document.setKnowledgeBase(StringUtils.hasText(request.knowledgeBase()) ? request.knowledgeBase().trim() : null);
        }
        if (request.isTemplate() != null) {
            document.setTemplate(request.isTemplate());
        }
        if (request.relatedDocumentIds() != null) {
            document.setHasRelatedDocuments(!request.relatedDocumentIds().isEmpty());
        }
        if (request.correlatedDocumentIds() != null) {
            document.setHasCorrelatedDocuments(!request.correlatedDocumentIds().isEmpty());
        }
        if (request.periodicReviewCycle() != null) {
            document.setPeriodicReviewCycle(request.periodicReviewCycle());
        }
        if (request.periodicReviewNotification() != null) {
            document.setPeriodicReviewNotification(request.periodicReviewNotification());
        }
        if (request.subType() != null) {
            String normalizedSubType = StringUtils.hasText(request.subType()) ? request.subType().trim() : null;
            if (normalizedSubType == null) {
                // "No Sub-Type" selected. Review is still REQUIRED (see change record D1/D5): the
                // snapshot follows the current selection, so a Draft moving BACK to no-Sub-Type
                // re-freezes at REQUIRED. No reviewer guard needed -- REQUIRED never forbids them.
                document.setSubType(null);
                document.setSubTypeId(null);
                document.setReviewRequirement(ReviewRequirement.REQUIRED);
            } else {
                if (documentType == null) {
                    throw new IllegalArgumentException("Document type is required before selecting a sub-type");
                }
                DocumentSubType resolvedSubType = documentSubTypeRepository
                        .findByDocumentType_IdAndNameIgnoreCase(documentType.getId(), normalizedSubType)
                        .orElseThrow(() -> new IllegalArgumentException("Sub-Type is not valid for the selected document type"));
                if (!resolvedSubType.isActive()) {
                    throw new IllegalArgumentException("Sub-Type is not valid for the selected document type");
                }
                ReviewRequirement newRequirement = resolvedSubType.getReviewRequirement() != null
                        ? resolvedSubType.getReviewRequirement()
                        : ReviewRequirement.REQUIRED;
                // Decision D3: do NOT auto-remove reviewers. If the Draft already has SAVED
                // reviewers, refuse to switch it to a Sub-Type that does not use review -- the
                // reviewers must be removed first (that removal itself requires an e-signature).
                if (newRequirement == ReviewRequirement.NONE
                        && document.getId() != null
                        && documentWorkflowParticipantRepository
                                .countByDocument_IdAndParticipantType(document.getId(), "REVIEWER") > 0) {
                    throw new IllegalArgumentException(
                            "REVIEWERS_MUST_BE_REMOVED_FIRST: remove the saved reviewers (requires e-signature) "
                                    + "before switching to a Sub-Type that does not use review");
                }
                // Snapshot the Sub-Type reference (id -- rename-safe) and its review policy now.
                // Never recomputed from a later Sub-Type edit (decision D1/D2).
                document.setSubType(resolvedSubType.getName());
                document.setSubTypeId(resolvedSubType.getId());
                document.setReviewRequirement(newRequirement);
            }
        }
        // Legacy/new Drafts that never went through the Sub-Type block still need a frozen value.
        if (document.getReviewRequirement() == null) {
            document.setReviewRequirement(ReviewRequirement.REQUIRED);
        }
        if (request.language() != null) {
            document.setLanguage(StringUtils.hasText(request.language()) ? request.language().trim() : null);
        }
        if (document.isTemplate()) {
            if (Boolean.TRUE.equals(request.requiresTraining())) {
                throw new IllegalArgumentException("Controlled document templates cannot require training");
            }
            document.setRequiresTraining(false);
            document.setTrainingPeriodDays(null);
            document.setReasonForSkippingTraining(null);
            document.setEffectiveDate(null);
            document.setValidUntil(null);
            document.setReviewDate(null);
            return;
        }
        if (request.requiresTraining() != null) {
            document.setRequiresTraining(Boolean.TRUE.equals(request.requiresTraining()));
        }
        Integer trainingPeriodDays = request.trainingPeriodDays() != null ? request.trainingPeriodDays() : document.getTrainingPeriodDays();
        String reasonForSkippingTraining = request.reasonForSkippingTraining() != null
                ? (StringUtils.hasText(request.reasonForSkippingTraining()) ? request.reasonForSkippingTraining().trim() : null)
                : document.getReasonForSkippingTraining();
        boolean requiresTraining = request.requiresTraining() != null ? Boolean.TRUE.equals(request.requiresTraining()) : document.isRequiresTraining();
        if (requiresTraining) {
            if (trainingPeriodDays == null || trainingPeriodDays < 1) {
                throw new IllegalArgumentException("Training Period (Days) is required when training is required");
            }
        } else if (!StringUtils.hasText(reasonForSkippingTraining)) {
            throw new IllegalArgumentException("Reason for skipping training is required when training is not required");
        }
        document.setTrainingPeriodDays(trainingPeriodDays);
        document.setReasonForSkippingTraining(reasonForSkippingTraining);
        // System-generated on publish; keep null during draft lifecycle.
        document.setEffectiveDate(null);
        document.setValidUntil(null);
        document.setReviewDate(null);
    }

    private void saveDraftAssignments(DocumentRecord document, DocumentDraftCreateRequest request) {
        if (request.coAuthorIds() == null && request.reviewerUserIds() == null && request.approverUserIds() == null &&
            request.relatedDocumentIds() == null && request.correlatedDocumentIds() == null) {
            return;
        }

        if (request.reviewerUserIds() != null || request.approverUserIds() != null ||
                request.relatedDocumentIds() != null || request.correlatedDocumentIds() != null) {
            UserAccount currentUser = currentUserService.requireCurrentUser();
            if (!permissionEvaluationService.hasPermission(currentUser, "documents.document.configure_initial_workflow")) {
                throw new AccessDeniedException("Current user cannot configure the initial document workflow");
            }
            requireCurrentUserOwnsDocument(document);
        }

        if (request.coAuthorIds() != null) {
            validateCoAuthorRules(document == null ? null : document.getAuthor(), distinctNonBlank(request.coAuthorIds()));
            documentWorkflowParticipantRepository.deleteAllByDocument_IdAndParticipantType(document.getId(), "CO_AUTHOR");
            documentWorkflowParticipantRepository.flush();
            List<String> coAuthorIds = distinctNonBlank(request.coAuthorIds());
            int sequence = 1;
            for (String userId : coAuthorIds) {
                UserAccount user = resolveUser(userId);
                if (user == null) {
                    throw new IllegalArgumentException("Co-author not found: " + userId);
                }
                saveParticipant(document, user, "CO_AUTHOR", sequence++);
            }
        }

        if (request.reviewerUserIds() != null) {
            List<String> currentReviewerIds = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER")
                    .stream()
                    .map(participant -> participant.getUser().getId().toString())
                    .toList();
            List<String> incomingReviewerIds = distinctNonBlank(request.reviewerUserIds());
            if (!currentReviewerIds.isEmpty() && !areListsEqual(incomingReviewerIds, currentReviewerIds)) {
                throw new IllegalArgumentException("Saved reviewers cannot be removed or reordered");
            }
            validateReviewerRules(
                    resolveDocumentReviewRequirement(document),
                    document == null ? null : document.getAuthor(),
                    request.coAuthorIds() == null ? List.of() : distinctNonBlank(request.coAuthorIds()),
                    incomingReviewerIds
            );
            documentWorkflowParticipantRepository.deleteAllByDocument_IdAndParticipantType(document.getId(), "REVIEWER");
            documentWorkflowParticipantRepository.flush();
            int sequence = 1;
            for (String userId : incomingReviewerIds) {
                UserAccount user = resolveUser(userId);
                if (user == null) {
                    throw new IllegalArgumentException("Reviewer not found: " + userId);
                }
                requirePoolMembership("REVIEWER", user);
                saveParticipant(document, user, "REVIEWER", sequence++);
            }
        }

        List<String> approverUserIds = distinctNonBlank(request.approverUserIds());
        if (request.approverUserIds() != null && !approverUserIds.isEmpty()) {
            List<String> currentApproverIds = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER")
                    .stream()
                    .map(participant -> participant.getUser().getId().toString())
                    .toList();
            if (!currentApproverIds.isEmpty() && !areListsEqual(approverUserIds, currentApproverIds)) {
                throw new IllegalArgumentException("Saved approvers cannot be removed or replaced");
            }
            validateApproverRules(
                    document == null ? null : document.getAuthor(),
                    request.coAuthorIds() == null ? List.of() : distinctNonBlank(request.coAuthorIds()),
                    request.reviewerUserIds() == null ? List.of() : distinctNonBlank(request.reviewerUserIds()),
                    approverUserIds
            );
            documentWorkflowParticipantRepository.deleteAllByDocument_IdAndParticipantType(document.getId(), "APPROVER");
            documentWorkflowParticipantRepository.flush();
            int sequence = 1;
            for (String userId : approverUserIds) {
                UserAccount user = resolveUser(userId);
                if (user == null) {
                    throw new IllegalArgumentException("Approver not found: " + userId);
                }
                requirePoolMembership("APPROVER", user);
                saveParticipant(document, user, "APPROVER", sequence++);
            }
        }

        if (request.relatedDocumentIds() != null) {
            documentRelationRepository.deleteAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED");
            documentRelationRepository.flush();
            List<String> relatedDocumentIds = distinctNonBlank(request.relatedDocumentIds());
            List<DocumentLookupResult> resolvedRelatedDocuments = resolveDocumentReferences(relatedDocumentIds, "Related");
            ensureNoDuplicateResolvedDocuments(resolvedRelatedDocuments, "Related");
            for (DocumentLookupResult relatedDocument : resolvedRelatedDocuments) {
                saveRelation(document, relatedDocument.document(), "RELATED");
            }
            // Keep the denormalised flag consistent with the rows just written, regardless of
            // whether applyDraftFields also ran for this request.
            applyRelationPresenceFlag(document, "RELATED", !resolvedRelatedDocuments.isEmpty());
        }

        if (request.correlatedDocumentIds() != null) {
            documentRelationRepository.deleteAllBySourceDocument_IdAndRelationType(document.getId(), "CORRELATED");
            documentRelationRepository.flush();
            List<String> correlatedDocumentIds = distinctNonBlank(request.correlatedDocumentIds());
            List<DocumentLookupResult> resolvedCorrelatedDocuments = resolveDocumentReferences(correlatedDocumentIds, "Correlated");
            ensureNoDuplicateResolvedDocuments(resolvedCorrelatedDocuments, "Correlated");
            for (DocumentLookupResult correlatedDocument : resolvedCorrelatedDocuments) {
                saveRelation(document, correlatedDocument.document(), "CORRELATED");
            }
            applyRelationPresenceFlag(document, "CORRELATED", !resolvedCorrelatedDocuments.isEmpty());
        }
    }

    private List<String> distinctNonBlank(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

    private void saveRevisionAssignments(DocumentRevisionRecord revision, DocumentDraftCreateRequest request) {
        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(revision.getId());

        List<String> coAuthorIds = request.coAuthorIds() == null ? List.of() : request.coAuthorIds();
        List<String> reviewerUserIds = request.reviewerUserIds() == null ? List.of() : request.reviewerUserIds();
        List<String> approverUserIds = request.approverUserIds() == null ? List.of() : request.approverUserIds();

        validateSoD(revision.getAuthor(), coAuthorIds, reviewerUserIds, approverUserIds);

        int sequence = 1;
        for (String userId : coAuthorIds) {
            UserAccount user = resolveUser(userId);
            if (user == null) {
                throw new IllegalArgumentException("Co-author not found: " + userId);
            }
            saveRevisionParticipant(revision, user, "CO_AUTHOR", sequence++);
        }

        sequence = 1;
        for (String userId : reviewerUserIds) {
            UserAccount user = resolveUser(userId);
            if (user == null) {
                throw new IllegalArgumentException("Reviewer not found: " + userId);
            }
            saveRevisionParticipant(revision, user, "REVIEWER", sequence++);
        }

        sequence = 1;
        for (String userId : approverUserIds) {
            UserAccount user = resolveUser(userId);
            if (user == null) {
                throw new IllegalArgumentException("Approver not found: " + userId);
            }
            saveRevisionParticipant(revision, user, "APPROVER", sequence++);
        }
    }

    private void saveRevisionParticipant(DocumentRevisionRecord revision, UserAccount user, String participantType, int sequenceOrder) {
        com.eqms.entity.RevisionWorkflowParticipant participant = new com.eqms.entity.RevisionWorkflowParticipant();
        participant.setRevision(revision);
        participant.setUser(user);
        participant.setParticipantType(participantType);
        participant.setSequenceOrder(sequenceOrder);
        revisionWorkflowParticipantRepository.save(participant);
    }

    private void saveParticipant(DocumentRecord document, UserAccount user, String participantType, int sequenceOrder) {
        DocumentWorkflowParticipant participant = new DocumentWorkflowParticipant();
        participant.setDocument(document);
        participant.setUser(user);
        participant.setParticipantType(participantType);
        participant.setSequenceOrder(sequenceOrder);
        documentWorkflowParticipantRepository.save(participant);
        recordStakeholderHistory(document, user, participantType);
    }

    /**
     * Always writes a permanent {@code document_stakeholder_history} row (see V458) for this
     * Document/user/role combination, regardless of whether the "Retain visibility for removed
     * participants" setting is currently on -- so enabling the setting later still protects any
     * Author/Co-Author/Reviewer/Approver reassignment that happens from that point forward, not
     * only ones made after the setting was flipped. Only
     * {@link DocumentAuthorizationService#isDirectStakeholder} reading from it is gated by the
     * setting. Idempotent: a user reassigned back to a role they held before does not duplicate.
     */
    private void recordStakeholderHistory(DocumentRecord document, UserAccount user, String participantType) {
        if (document == null || document.getId() == null || user == null || user.getId() == null) {
            return;
        }
        if (documentStakeholderHistoryRepository.existsByDocument_IdAndUser_IdAndParticipantType(
                document.getId(), user.getId(), participantType)) {
            return;
        }
        DocumentStakeholderHistory history = new DocumentStakeholderHistory();
        history.setDocument(document);
        history.setUser(user);
        history.setParticipantType(participantType);
        documentStakeholderHistoryRepository.save(history);
    }

    private void saveRelation(DocumentRecord sourceDocument, DocumentRecord targetDocument, String relationType) {
        if (sourceDocument.getId() != null && sourceDocument.getId().equals(targetDocument.getId())) {
            return;
        }
        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(sourceDocument);
        relation.setTargetDocument(targetDocument);
        relation.setRelationType(relationType);
        documentRelationRepository.save(relation);
    }

    private record DocumentLookupResult(DocumentRecord document, String displayLabel) {
    }

    private boolean canRequestControlledCopy(
            UserAccount user,
            DocumentRecord document,
            List<DocumentRevisionRecord> revisions
    ) {
        if (document == null || document.isTemplate() || document.getStatus() == null || user == null) {
            return false;
        }
        boolean hasEffectiveRevision = revisions.stream().anyMatch(revision ->
                revision.getStatus() != null
                        && "EFFECTIVE".equalsIgnoreCase(revision.getStatus().getCode()));
        return "ACTIVE".equalsIgnoreCase(document.getStatus().getCode())
                && hasEffectiveRevision
                && permissionEvaluationService.hasPermission(user, "documents.controlled_copy.request");
    }

    /** Delegates to the single shared rule ({@link WorkflowParticipantEligibilityService}) so
     *  Document Master and Revision participant assignment can never silently diverge. */
    private void requirePoolMembership(String poolType, UserAccount user) {
        workflowParticipantEligibilityService.requirePoolMembership(poolType, user);
    }

    private void validateSoD(DocumentRecord document, DocumentDraftCreateRequest request) {
        UserAccount author = document == null ? null : document.getAuthor();
        validateSoD(author, request == null ? List.of() : distinctNonBlank(request.coAuthorIds()),
                request == null ? List.of() : distinctNonBlank(request.reviewerUserIds()),
                request == null ? List.of() : distinctNonBlank(request.approverUserIds()));
    }

    private void validateCoAuthorRules(UserAccount author, List<String> coAuthorIds) {
        if (author != null && author.getId() != null) {
            ensureNotContains(author.getId().toString(), coAuthorIds, "Author cannot be Co-author on the same document");
        }
    }

    /**
     * Approval is always independent from authoring.  Review participation is
     * deliberately governed by the configured workflow rule below, but an
     * Author or Co-author must never approve the same revision.
     */
    private void validateAuthorAndCoAuthorApprovalIndependence(UserAccount author, List<String> coAuthorIds, List<String> approverUserIds) {
        if (author != null && author.getId() != null) {
            String authorId = author.getId().toString();
            ensureNotContains(authorId, approverUserIds, "Author cannot be Approver on the same revision");
        }
        ensureNoOverlap(coAuthorIds, approverUserIds, "Co-author cannot be Approver on the same revision");
    }
    private void requireCurrentUserOwnsDocument(DocumentRecord document) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UUID ownerId = document == null || document.getOwner() == null ? null : document.getOwner().getId();
        if (ownerId == null || !ownerId.equals(currentUser.getId())) {
            throw new AccessDeniedException("Only the workflow coordinator who created the document can configure document workflow");
        }
    }

    private void validateReviewerRules(ReviewRequirement requirement, UserAccount author, List<String> coAuthorIds, List<String> reviewerUserIds) {
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        ReviewRequirement effectiveRequirement = requirement == null ? ReviewRequirement.REQUIRED : requirement;
        if (effectiveRequirement == ReviewRequirement.NONE && !reviewerUserIds.isEmpty()) {
            throw new IllegalArgumentException("REVIEW_NOT_REQUIRED: this Sub-Type does not allow Reviewer assignments");
        }
        if (effectiveRequirement == ReviewRequirement.REQUIRED && reviewerUserIds.isEmpty()) {
            throw new IllegalArgumentException("AT_LEAST_ONE_REVIEWER_REQUIRED: at least one Reviewer is required");
        }
        if (setting.isSameUserCannotHoldMultipleWorkflowRoles()) {
            ensureNoOverlap(coAuthorIds, reviewerUserIds, "Co-author and Reviewer cannot be the same user");
        }
        if (setting.isAuthorCannotBeReviewerOrApprover() && author != null && author.getId() != null) {
            ensureNotContains(author.getId().toString(), reviewerUserIds, "Author cannot be Reviewer on the same revision");
        }
        if (setting.isCoAuthorCannotBeReviewerOrApprover()) {
            ensureNoOverlap(coAuthorIds, reviewerUserIds, "Co-author cannot be Reviewer on the same revision");
        }
        if (setting.isWorkflowCoordinatorCannotBeReviewerOrApprover()) {
            ensureNoWorkflowCoordinatorInRoles(reviewerUserIds, "Reviewer");
        }
    }

    /**
     * The Draft's review requirement is a <em>snapshot</em> frozen on {@code documents.review_requirement}
     * when the Sub-Type is set/changed (see {@link #applyDraftFields} and change record
     * docs/decisions/review-requirement-snapshot-and-subtype-fk-change-record.md, decision D1).
     * It is never re-resolved live from the Sub-Type, so an admin editing a Sub-Type's policy does
     * not retroactively change the rules for Drafts already in progress. Null (legacy rows created
     * before V408, or unit-test fixtures) falls back to the safer REQUIRED -- "unclassified" must
     * never be read as "review waived".
     */
    private ReviewRequirement resolveDocumentReviewRequirement(DocumentRecord document) {
        if (document == null || document.getReviewRequirement() == null) {
            return ReviewRequirement.REQUIRED;
        }
        return document.getReviewRequirement();
    }

    private void validateApproverRules(UserAccount author, List<String> coAuthorIds, List<String> reviewerUserIds, List<String> approverUserIds) {
        validateAuthorAndCoAuthorApprovalIndependence(author, coAuthorIds, approverUserIds);
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        // Unconditional GMP floor, not a togglable SoD rule: the business always requires exactly
        // one Approver, and the FE never offers a way to select more than one (product decision,
        // 2026-09-03 -- see the removed DocumentWorkflowSetting.requireOneApprover toggle).
        if (approverUserIds.size() != 1) {
            throw new IllegalArgumentException("There is only one approver allowed in the document");
        }
        if (setting.isSameUserCannotHoldMultipleWorkflowRoles()) {
            ensureNoOverlap(coAuthorIds, approverUserIds, "Co-author and Approver cannot be the same user");
            ensureNoOverlap(reviewerUserIds, approverUserIds, "Reviewer and Approver cannot be the same user");
        }
        if (setting.isAuthorCannotBeReviewerOrApprover() && author != null && author.getId() != null) {
            ensureNotContains(author.getId().toString(), approverUserIds, "Author cannot be Approver on the same revision");
        }
        if (setting.isCoAuthorCannotBeReviewerOrApprover()) {
            ensureNoOverlap(coAuthorIds, approverUserIds, "Co-author cannot be Approver on the same revision");
        }
        if (setting.isWorkflowCoordinatorCannotBeReviewerOrApprover()) {
            ensureNoWorkflowCoordinatorInRoles(approverUserIds, "Approver");
        }
        if (setting.isReviewerAndApproverDifferentDepartments() && !reviewerUserIds.isEmpty()) {
            ensureReviewerAndApproverDifferentDepartments(reviewerUserIds, approverUserIds);
        }
    }

    private void validateSoD(UserAccount author, List<String> coAuthorIds, List<String> reviewerUserIds, List<String> approverUserIds) {
        validateAuthorAndCoAuthorApprovalIndependence(author, coAuthorIds, approverUserIds);
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        // Unconditional GMP floor, not a togglable SoD rule: the business always requires exactly
        // one Approver, and the FE never offers a way to select more than one (product decision,
        // 2026-09-03 -- see the removed DocumentWorkflowSetting.requireOneApprover toggle).
        if (approverUserIds.size() != 1) {
            throw new IllegalArgumentException("There is only one approver allowed in the document");
        }

        if (setting.isSameUserCannotHoldMultipleWorkflowRoles()) {
            ensureNoOverlap(coAuthorIds, reviewerUserIds, "Co-author and Reviewer cannot be the same user");
            ensureNoOverlap(coAuthorIds, approverUserIds, "Co-author and Approver cannot be the same user");
            ensureNoOverlap(reviewerUserIds, approverUserIds, "Reviewer and Approver cannot be the same user");
        }

        if (setting.isAuthorCannotBeReviewerOrApprover() && author != null && author.getId() != null) {
            ensureNotContains(author.getId().toString(), reviewerUserIds, "Author cannot be Reviewer on the same revision");
            ensureNotContains(author.getId().toString(), approverUserIds, "Author cannot be Approver on the same revision");
        }

        if (setting.isCoAuthorCannotBeReviewerOrApprover()) {
            ensureNoOverlap(coAuthorIds, reviewerUserIds, "Co-author cannot be Reviewer on the same revision");
            ensureNoOverlap(coAuthorIds, approverUserIds, "Co-author cannot be Approver on the same revision");
        }

        if (setting.isWorkflowCoordinatorCannotBeReviewerOrApprover()) {
            ensureNoWorkflowCoordinatorInRoles(reviewerUserIds, "Reviewer");
            ensureNoWorkflowCoordinatorInRoles(approverUserIds, "Approver");
        }

        if (setting.isReviewerAndApproverDifferentDepartments()) {
            ensureReviewerAndApproverDifferentDepartments(reviewerUserIds, approverUserIds);
        }
    }

    private DocumentWorkflowSetting requireDocumentWorkflowSetting() {
        return documentWorkflowSettingRepository.findFirstByOrderByIdAsc()
                .orElseGet(() -> {
                    DocumentWorkflowSetting setting = new DocumentWorkflowSetting();
                    return documentWorkflowSettingRepository.save(setting);
                });
    }

    private void ensureNoOverlap(List<String> left, List<String> right, String message) {
        for (String value : left) {
            if (right.contains(value)) {
                throw new IllegalArgumentException(message);
            }
        }
    }

    private void ensureNotContains(String userId, List<String> values, String message) {
        if (values.contains(userId)) {
            throw new IllegalArgumentException(message);
        }
    }

    /**
     * The coordinator restriction is an entitlement rule, not a workflow-pool
     * label rule. A tenant may rename or retire the DCO display role without
     * changing this result; the immutable workspace-management permission is
     * the coordinator identifier.
     */
    private void ensureNoWorkflowCoordinatorInRoles(List<String> userIds, String roleLabel) {
        for (String userId : userIds) {
            UserAccount candidate = resolveUser(userId);
            if (candidate != null && permissionEvaluationService.hasPermission(candidate, "documents.workspace.manage")) {
                throw new IllegalArgumentException(roleLabel + " cannot be a workflow coordinator on the same revision");
            }
        }
    }

    private void ensureReviewerAndApproverDifferentDepartments(List<String> reviewerUserIds, List<String> approverUserIds) {
        List<UserAccount> reviewers = reviewerUserIds.stream().map(this::resolveUser).filter(Objects::nonNull).toList();
        List<UserAccount> approvers = approverUserIds.stream().map(this::resolveUser).filter(Objects::nonNull).toList();
        for (UserAccount reviewer : reviewers) {
            for (UserAccount approver : approvers) {
                if (reviewer.getDepartment() != null && reviewer.getDepartment().equalsIgnoreCase(approver.getDepartment())) {
                    throw new IllegalArgumentException("Reviewer and Approver must belong to different departments");
                }
            }
        }
    }

    /**
     * Legacy Import only. The Document Number prefix is always forced to the selected Document
     * Type's short code (LegacyImportView.tsx never lets the user edit it), so the only free-form
     * part is the serial suffix -- which must still be exactly Document Properties > Digits of
     * the Serial Number numeric digits, the same width the normal auto-generator would have used
     * (see generateDocumentNumber's "%0Nd" formatting), so a Legacy Import number stays consistent
     * with the system's configured numbering even though it is typed in rather than generated.
     */
    private void requireLegacyDocumentNumberFormat(String legacyNumber, DocumentType documentType) {
        if (documentType == null) {
            throw new IllegalArgumentException("Document type is required before a legacy document number can be validated");
        }
        String typeCode = StringUtils.hasText(documentType.getShortCode())
                ? documentType.getShortCode().trim().toUpperCase(Locale.ROOT)
                : "DOC";
        int serialDigits = Math.max(systemConfigurationService.getSerialNumberDigits(), 1);
        String expectedPrefix = typeCode + ".";
        if (!legacyNumber.toUpperCase(Locale.ROOT).startsWith(expectedPrefix)) {
            throw new IllegalArgumentException(
                    "Document number must start with \"" + expectedPrefix + "\" for the selected Document Type.");
        }
        String suffix = legacyNumber.substring(expectedPrefix.length());
        if (!suffix.matches("\\d{" + serialDigits + "}")) {
            throw new IllegalArgumentException(
                    "Document number must have exactly " + serialDigits + " digit(s) after \"" + expectedPrefix
                            + "\" (Settings > Document Properties > Digits of the Serial Number), e.g. \""
                            + expectedPrefix + String.format("%0" + serialDigits + "d", 1) + "\".");
        }
    }

    private String generateDocumentNumber(DocumentType documentType, Department department) {
        if (documentType == null || documentType.getId() == null) {
            throw new IllegalArgumentException("Document type is required before a document number can be generated");
        }
        DocumentType lockedDocumentType = documentTypeRepository.findByIdForNumberAllocation(documentType.getId())
                .orElseThrow(() -> new IllegalArgumentException("Document type not found"));
        String typeCode = StringUtils.hasText(lockedDocumentType.getShortCode())
                ? lockedDocumentType.getShortCode().trim().toUpperCase(Locale.ROOT)
                : "DOC";
        int issuedSequence = documentRepository.findMaxDocumentSequenceByPrefix(typeCode);
        int nextSequence = Math.max(Math.max(lockedDocumentType.getCurrentSequence(), 0), issuedSequence) + 1;
        // Phase 2 of the Document Name Formats feature: compose through the Format/Component
        // engine instead of a hardcoded literal, when an eligible Format is available (see
        // DocumentComponentResolver#isEligibleAsDocumentNumberFormat for why only the legacy
        // 2-component "TYPE.NNNN" shape qualifies today). Preference order: this Document Type's
        // own assigned Format, then the system-wide default (Document Properties screen), then
        // the exact literal this always was -- so a mis-migrated or not-yet-configured Document
        // Type never blocks document creation.
        com.eqms.entity.DocumentNameFormat effectiveFormat = lockedDocumentType.getNameFormat();
        if (effectiveFormat == null) {
            java.util.UUID defaultFormatId = systemConfigurationService.getDefaultDocumentNameFormatId();
            if (defaultFormatId != null) {
                effectiveFormat = documentNameFormatRepository.findById(defaultFormatId).orElse(null);
            }
        }
        boolean useEngine = effectiveFormat != null
                && documentComponentResolver.isEligibleAsDocumentNumberFormat(effectiveFormat);
        com.eqms.entity.DocumentNameFormat resolvedFormat = effectiveFormat;
        String candidate;
        do {
            candidate = useEngine
                    ? documentComponentResolver.composeDocumentNumber(resolvedFormat, lockedDocumentType, department, nextSequence)
                    : String.format("%s.%04d", typeCode, nextSequence);
            nextSequence++;
        } while (documentRepository.existsByDocumentNumber(candidate));
        lockedDocumentType.setCurrentSequence(nextSequence - 1);
        documentTypeRepository.save(lockedDocumentType);
        return candidate;
    }

    private String resolveParentDocumentNumber(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        long dotCount = trimmed.chars().filter(ch -> ch == '.').count();
        if (dotCount < 2) {
            return null;
        }
        int lastDot = trimmed.lastIndexOf('.');
        if (lastDot <= 0) {
            return null;
        }
        String suffix = trimmed.substring(lastDot + 1);
        if (!suffix.matches("\\d{2,}")) {
            return null;
        }
        return trimmed.substring(0, lastDot);
    }

    /**
     * Legacy Import only. Accepts the DateTimePicker's own "dd/MM/yyyy" (no time) and
     * "dd/MM/yyyy HH:mm" (with time) output, plus a plain ISO instant, and always returns a
     * concrete instant -- the date-only form is midnight in the server's zone.
     */
    private Instant parseLegacyEffectiveInstant(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        try {
            if (trimmed.length() == 16 && trimmed.charAt(2) == '/' && trimmed.charAt(5) == '/' && trimmed.charAt(10) == ' ') {
                return java.time.LocalDateTime.parse(trimmed, DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                        .atZone(SYSTEM_ZONE).toInstant();
            }
            if (trimmed.length() == 10 && trimmed.charAt(2) == '/' && trimmed.charAt(5) == '/') {
                return LocalDate.parse(trimmed, DMY_DATE).atStartOfDay(SYSTEM_ZONE).toInstant();
            }
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        try {
            if (trimmed.length() >= 19 && trimmed.charAt(2) == '/' && trimmed.charAt(5) == '/') {
                return LocalDate.parse(trimmed.substring(0, 10), DMY_DATE);
            }
            if (trimmed.length() == 10 && trimmed.charAt(2) == '/' && trimmed.charAt(5) == '/') {
                return LocalDate.parse(trimmed, DMY_DATE);
            }
            return LocalDate.parse(trimmed);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    /**
     * Only used for obsoleteDate. Falls back to now() ONLY when the caller genuinely did not send a
     * value -- if a value IS sent but fails to parse, that must fail loudly (IllegalArgumentException)
     * rather than silently substituting the current time, which previously discarded whatever date
     * the user actually chose on the UI without any error. Tries ISO instant first: that is the
     * literal format the FE sends today (`Date.prototype.toISOString()`), which the shared
     * `parseDate()` date-only formats never matched -- explaining why the UI-selected date was being
     * silently ignored on every real call before this fix.
     */
    private Instant parseDateOrNow(String value) {
        if (!StringUtils.hasText(value)) {
            return Instant.now();
        }
        String trimmed = value.trim();
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ignored) {
            // Not an ISO instant -- fall through to the date-only formats below.
        }
        LocalDate parsed = parseDate(trimmed);
        if (parsed == null) {
            throw new IllegalArgumentException("Invalid obsolete date: " + value);
        }
        return parsed.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private Boolean parseBooleanFilter(String value) {
        if (!StringUtils.hasText(value) || "All".equalsIgnoreCase(value)) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "yes", "true", "1" -> true;
            case "no", "false", "0" -> false;
            default -> null;
        };
    }

    private static final class KnowledgeBaseFolderBuilder {
        private final String departmentId;
        private final String departmentCode;
        private final String departmentName;
        private final List<KnowledgeBaseDocumentResponse> documents = new ArrayList<>();

        private KnowledgeBaseFolderBuilder(String departmentId, String departmentCode, String departmentName) {
            this.departmentId = departmentId;
            this.departmentCode = departmentCode;
            this.departmentName = departmentName;
        }

        private KnowledgeBaseFolderResponse toResponse() {
            return new KnowledgeBaseFolderResponse(
                    departmentId,
                    departmentCode,
                    departmentName,
                    documents.size(),
                    List.copyOf(documents)
            );
        }
    }

    private String csv(String value) {
        return com.eqms.util.CsvSafety.escapeCell(value);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private DocumentAuditTrailResponse toAuditTrailResponse(AuditLog auditLog) {
        // Prefer the point-in-time snapshot stored on the row itself (audit fidelity: this must
        // show the actor's attributes AS THEY WERE when they acted, not drift if their profile
        // changes later) -- fall back to the live relation only for rows written before that
        // snapshot existed.
        UserAccount actedBy = auditLog.getActedBy();
        DocumentAuditTrailUserResponse user = new DocumentAuditTrailUserResponse(
                auditLog.getUserId() != null ? auditLog.getUserId().toString() : actedBy == null ? null : actedBy.getId().toString(),
                firstNonBlank(auditLog.getUserFullName(), actedBy == null ? null : actedBy.getFullName()),
                firstNonBlank(auditLog.getEmployeeCode(), actedBy == null ? null : actedBy.getEmployeeCode()),
                firstNonBlank(auditLog.getRoleName(), actedBy == null ? null : actedBy.getRoleName()),
                firstNonBlank(auditLog.getPositionName(), actedBy == null ? null : actedBy.getPosition()),
                firstNonBlank(auditLog.getDepartmentName(), actedBy == null ? null : actedBy.getDepartment()),
                auditLog.getAccessProfileNames() == null ? List.of() : List.of(auditLog.getAccessProfileNames())
        );

        String actionType = auditLog.getActionType() == null ? null : auditLog.getActionType().trim().toUpperCase(Locale.ROOT);
        return new DocumentAuditTrailResponse(
                auditLog.getId() == null ? null : auditLog.getId().toString(),
                DateTimeFormatUtils.formatDateTime(auditLog.getCreatedAt()),
                user,
                resolveAuditActionLabel(actionType),
                actionType,
                List.of(),
                auditLog.getComment(),
                "",
                ""
        );
    }

    private String resolveAuditActionLabel(String actionType) {
        if (!StringUtils.hasText(actionType)) {
            return "Updated Document";
        }
        return switch (actionType) {
            case "CREATE" -> "Created Draft";
            case "UPDATE" -> "Updated Draft";
            case "CREATE_DRAFT" -> "Created Draft";
            case "UPDATE_DRAFT" -> "Updated Draft";
            case "SUBMIT" -> "Submitted for Review";
            case "SUBMIT_FOR_REVIEW" -> "Submitted for Review";
            case "REVIEW_COMPLETE" -> "Reviewed Document";
            case "REVIEW_REJECT" -> "Rejected Review";
            case "APPROVE_COMPLETE" -> "Approved Document";
            case "APPROVE_REJECT" -> "Rejected Document";
            case "TRAINING_COMPLETE" -> "Completed Training";
            case "PUBLISH" -> "Published Document";
            case "CANCEL" -> "Closed - Cancelled Document";
            case "OBSOLETE" -> "Obsoleted Document";
            case "UPLOAD_FILE", "REVISION_SOURCE_FILE_UPLOADED" -> "Uploaded Revision File";
            case "UPGRADE" -> "Upgraded Revision";
            default -> "Updated Document";
        };
    }

    private final java.util.Comparator<DocumentRevisionRecord> REVISION_COMPARATOR = (r1, r2) -> {
        int cmp = compareRevisionNumbers(r2.getRevisionNumber(), r1.getRevisionNumber());
        if (cmp != 0) {
            return cmp;
        }
        if (r1.getCreatedAt() == null && r2.getCreatedAt() == null) return 0;
        if (r1.getCreatedAt() == null) return 1;
        if (r2.getCreatedAt() == null) return -1;
        return r2.getCreatedAt().compareTo(r1.getCreatedAt());
    };

    private int compareRevisionNumbers(String left, String right) {
        if (left == null && right == null) return 0;
        if (left == null) return -1;
        if (right == null) return 1;

        String normLeft = normalizeVersionFormat(left);
        String normRight = normalizeVersionFormat(right);

        int majorCompare = Integer.compare(parseVersionPart(normLeft, 0), parseVersionPart(normRight, 0));
        if (majorCompare != 0) {
            return majorCompare;
        }
        return Integer.compare(parseVersionPart(normLeft, 2), parseVersionPart(normRight, 2));
    }

    private String normalizeVersionFormat(String version) {
        if (!org.springframework.util.StringUtils.hasText(version)) {
            return "0.0.1";
        }
        String trimmed = version.trim();
        String[] parts = trimmed.split("\\.", -1);
        int major = parseSafePart(parts, 0);
        int patch;
        if (parts.length == 2) {
            int secondPart = parseSafePart(parts, 1);
            patch = secondPart;
        } else {
            int middle = parseSafePart(parts, 1);
            patch = parseSafePart(parts, 2);
            if (middle != 0 && patch == 0) {
                patch = middle;
            }
        }
        return String.format("%d.0.%d", major, patch);
    }

    private int parseSafePart(String[] parts, int index) {
        if (parts == null || index >= parts.length || !org.springframework.util.StringUtils.hasText(parts[index])) {
            return 0;
        }
        try {
            return Math.max(Integer.parseInt(parts[index].trim()), 0);
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private int parseVersionPart(String version, int index) {
        if (!org.springframework.util.StringUtils.hasText(version)) {
            return 0;
        }
        String[] parts = version.trim().split("\\.");
        if (index < 0 || index >= parts.length) {
            return 0;
        }
        try {
            return Integer.parseInt(parts[index]);
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private DocumentRevisionRecord resolveActiveRevision(DocumentRecord document) {
        List<DocumentRevisionRecord> revisions = new ArrayList<>(documentRevisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()));
        revisions.sort(REVISION_COMPARATOR);
        if (revisions.isEmpty()) {
            throw new IllegalArgumentException("No revisions found for this document");
        }
        // Try finding EFFECTIVE revision
        Optional<DocumentRevisionRecord> effective = revisions.stream()
                .filter(r -> r.getStatus() != null && "EFFECTIVE".equalsIgnoreCase(r.getStatus().getCode()))
                .findFirst();
        if (effective.isPresent()) {
            return effective.get();
        }
        // Try matching version number
        if (StringUtils.hasText(document.getVersion())) {
            Optional<DocumentRevisionRecord> versionMatch = revisions.stream()
                    .filter(r -> document.getVersion().trim().equals(r.getRevisionNumber()))
                    .findFirst();
            if (versionMatch.isPresent()) {
                return versionMatch.get();
            }
        }
        // Fallback to latest
        return revisions.get(0);
    }

    private boolean isPdfBytes(byte[] bytes) {
        return bytes != null
                && bytes.length >= 4
                && bytes[0] == 0x25
                && bytes[1] == 0x50
                && bytes[2] == 0x44
                && bytes[3] == 0x46;
    }

    /**
     * Produces the transient, policy-controlled watermark for Document Details preview.
     * This must stay equivalent to RevisionService's preview watermark: the stored published
     * PDF, its checksum, lifecycle, access check and audit event are not changed.
     */
    private byte[] applyPreviewWatermark(byte[] pdfBytes, UserAccount currentUser) throws IOException {
        JsonNode documentsConfig = systemConfigurationService.requireConfiguration().getDocumentsConfig();
        JsonNode previewPolicy = documentsConfig == null
                ? MissingNode.getInstance()
                : documentsConfig.path("pdfPreview");
        String mainText = previewPolicy.path("watermarkText").asText("FOR PREVIEW ONLY").trim();
        if (!StringUtils.hasText(mainText)) {
            mainText = "FOR PREVIEW ONLY";
        }
        List<String> watermarkLines = new ArrayList<>();
        watermarkLines.add(mainText);
        if (previewPolicy.path("watermarkShowViewerName").asBoolean(false)) {
            String viewerName = firstNonBlank(currentUser.getFullName(), currentUser.getUsername());
            if (StringUtils.hasText(viewerName)) {
                watermarkLines.add(viewerName);
            }
        }
        if (previewPolicy.path("watermarkShowOpenedAt").asBoolean(false)) {
            watermarkLines.add(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
                    .withZone(SYSTEM_ZONE)
                    .format(Instant.now()));
        }

        try (PDDocument pdf = Loader.loadPDF(pdfBytes); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDType1Font mainFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            for (PDPage page : pdf.getPages()) {
                PDRectangle pageSize = page.getMediaBox();
                float textX = pageSize.getWidth() / 2f;
                float textY = pageSize.getHeight() / 2f;
                float mainTextWidth = (mainFont.getStringWidth(mainText) / 1000f) * 76f;

                try (PDPageContentStream contentStream = new PDPageContentStream(
                        pdf,
                        page,
                        PDPageContentStream.AppendMode.APPEND,
                        true,
                        true
                )) {
                    PDExtendedGraphicsState graphicsState = new PDExtendedGraphicsState();
                    graphicsState.setNonStrokingAlphaConstant(0.18f);
                    graphicsState.setStrokingAlphaConstant(0.18f);
                    contentStream.setGraphicsStateParameters(graphicsState);
                    contentStream.beginText();
                    contentStream.setNonStrokingColor(0.70f, 0.70f, 0.96f);
                    contentStream.setFont(mainFont, 76);
                    contentStream.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(45), textX, textY));
                    contentStream.newLineAtOffset(-mainTextWidth / 2f, (watermarkLines.size() - 1) * 12f);
                    for (int line = 0; line < watermarkLines.size(); line++) {
                        if (line == 0) {
                            contentStream.setFont(mainFont, 76);
                        } else {
                            contentStream.setFont(mainFont, 18);
                            float lineWidth = (mainFont.getStringWidth(watermarkLines.get(line)) / 1000f) * 18f;
                            contentStream.newLineAtOffset((mainTextWidth - lineWidth) / 2f, -26f);
                        }
                        contentStream.showText(watermarkLines.get(line));
                    }
                    contentStream.endText();
                }
            }
            pdf.save(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public DocumentFileResult previewDocumentFile(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        ensureCurrentUserCanViewDocument(document, currentUser);

        DocumentRevisionRecord revision = resolveActiveRevision(document);
        // resolveActiveRevision() falls back to the latest-created revision (possibly Draft) when
        // no EFFECTIVE one exists. Gate the actual file serving through the dedicated file
        // authorization service -- its PUBLISHED_PDF business rule only allows EFFECTIVE/OBSOLETED,
        // so a Draft fallback is rejected here instead of silently serving unreviewed source.
        // GMP decision (HDR-AUTH-001): a direct stakeholder (already passed
        // ensureCurrentUserCanViewDocument above) bypasses the separate preview permission.
        boolean isDirectStakeholder = documentAuthorizationService.isDirectStakeholder(currentUser, revision);
        secureFileAccessService.require(
                currentUser,
                FileAccessAction.VIEW_PREVIEW,
                FileObjectType.PUBLISHED_PDF,
                revision.getId(),
                FileAccessContext.ofRevision(revision, isDirectStakeholder)
        );

        byte[] bytes;
        String fileName = "preview.pdf";
        String previewPath = publishingMetadataRepository.findByRevision_Id(revision.getId())
                .map(m -> m.getPublishedPdfPath())
                .filter(org.springframework.util.StringUtils::hasText)
                .orElse(null);
        if (previewPath == null) {
            throw new IllegalArgumentException("No effective published document available");
        }
        try {
            bytes = fileStorageService.readFile(previewPath);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read document preview file", ex);
        }

        if (isPdfBytes(bytes) && systemConfigurationService.isDocumentWatermarkEnabled()) {
            try {
                bytes = applyPreviewWatermark(bytes, currentUser);
            } catch (IOException ex) {
                log.warn("Failed to apply watermark to PDF preview for document {}: {}", documentId, ex.getMessage());
            }
        }

        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                document.getId(),
                "PREVIEW",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Viewed revision preview " + revision.getRevisionNumber()
        );

        return new DocumentFileResult(bytes, fileName, "application/pdf");
    }

    private void verifyRevisionChecksum(byte[] bytes, DocumentRevisionRecord revision) throws IOException {
        if (revision == null || !StringUtils.hasText(revision.getSourceFileChecksum()) || bytes == null) {
            return;
        }
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            String actual = java.util.HexFormat.of().formatHex(digest.digest(bytes));
            if (!revision.getSourceFileChecksum().trim().equalsIgnoreCase(actual)) {
                throw new IOException("Data integrity breach detected for " + revision.getRevisionName());
            }
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    public record DocumentFileResult(
            byte[] bytes,
            String fileName,
            String contentType
    ) {}
}


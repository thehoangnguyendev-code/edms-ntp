package com.eqms.service;

import com.eqms.auth.TokenService;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentFiltersResponse;
import com.eqms.dto.document.LegacyBatchImportResponse;
import com.eqms.dto.document.LegacyBatchRevisionSectionRequest;
import com.eqms.dto.document.DocumentParticipantResponse;
import com.eqms.dto.document.DocumentRelationResponse;
import com.eqms.dto.document.DocumentRevisionSummaryResponse;
import com.eqms.dto.document.OriginalDocumentResponse;
import com.eqms.dto.document.RevisionCreationRequest;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.document.TemplateLineageResponse;
import com.eqms.dto.document.RevisionHistoryResponse;
import com.eqms.dto.document.RevisionListItemResponse;
import com.eqms.dto.document.RevisionOfficeOnlineLinkResponse;
import com.eqms.dto.document.StatusResponse;
import com.eqms.dto.document.SignatureResponse;
import com.eqms.dto.document.RevisionWorkingNoteRequest;
import com.eqms.dto.document.RevisionWorkingNoteResponse;
import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.security.FileAccessContext;
import com.eqms.dto.user.LookupItemResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRelation;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentRevisionTemplateLineage;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.DocumentSubType;
import com.eqms.entity.ReviewRequirement;
import com.eqms.entity.DocumentWorkflowSetting;
import com.eqms.entity.DocumentWorkflowParticipant;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.entity.RevisionWorkflowHistory;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.RevisionWorkingNote;
import com.eqms.entity.UserAccount;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserStatus;
import com.eqms.dto.document.ReplaceWorkflowParticipantRequest;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.entity.WorkflowActionPolicyActor;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.enums.FileAccessAction;
import com.eqms.enums.FileObjectType;
import com.eqms.enums.WorkflowActorType;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentRevisionTemplateLineageRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.DocumentSubTypeRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.DocumentWorkflowSettingRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import com.eqms.repository.RevisionWorkflowHistoryRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkingNoteRepository;
import com.eqms.repository.RevisionPublishingMetadataRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.util.EmailTemplateTypeUtils;
import com.eqms.util.StatusMapper;
import com.eqms.exception.RelatedDocumentsNotEffectiveException;
import com.eqms.exception.ApiErrorResponse;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.exception.RevisionUploadValidationException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.annotation.Lazy;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.util.Matrix;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.FileTime;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.HashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import javax.imageio.ImageIO;

@Service
public class RevisionService {

    private static final Logger log = LoggerFactory.getLogger(RevisionService.class);

    private static final DateTimeFormatter DMY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId SYSTEM_ZONE = ZoneId.systemDefault();
    private static final Path REVISION_STORAGE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "revisions");
    private static final List<String> IN_PROGRESS_REVISION_STATUS_CODES = List.of(
            "DRAFT",
            "PENDING_REVIEW",
            "PENDING_APPROVAL",
            "PENDING_TRAINING",
            "READY_FOR_PUBLISHING"
    );
    private static final String REVISION_IN_PROGRESS_MESSAGE =
            "Document already has a revision in progress. Please complete, cancel, or publish the current revision before creating a new revision.";

    private final DocumentRevisionRepository revisionRepository;
    private final RevisionStatusDefinitionRepository revisionStatusRepository;
    private final DocumentRecordRepository documentRepository;
    private final DocumentStatusDefinitionRepository documentStatusRepository;
    private final DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository;
    private final DocumentRelationRepository documentRelationRepository;
    private final UserAccountRepository userAccountRepository;
    private final DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    private final AuditTrailService auditTrailService;
    private final EmailNotificationService emailNotificationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final TrainingAuthorizationService trainingAuthorizationService;
    private final CurrentUserService currentUserService;
    private final SystemConfigurationService systemConfigurationService;
    private final FileStorageService fileStorageService;
    private final TokenService tokenService;
    private final ControlledCopyRepository controlledCopyRepository;
    private final RevisionWorkingNoteRepository revisionWorkingNoteRepository;
    private final RevisionPublishingMetadataRepository publishingMetadataRepository;
    private final ElectronicSignatureService electronicSignatureService;
    private final PublishingPdfComposerService publishingPdfComposerService;
    private final ControlledCopyBatchStatusService controlledCopyBatchStatusService;
    private final NotificationRealtimeService notificationRealtimeService;
    private final RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SecureFileAccessService secureFileAccessService;
    private final WorkflowActionPolicyService workflowActionPolicyService;
    private final UserAccessProfileRepository userAccessProfileRepository;

    // Field-injected (not constructor-injected) to avoid widening the already-large constructor
    // above; see TBR-DOC-013/014 -- canonical Controlled-Copy-obsolescence operation shared with
    // DocumentService.obsoleteDocument.
    @org.springframework.beans.factory.annotation.Autowired
    private ControlledCopyLifecycleObsolescenceService controlledCopyLifecycleObsolescenceService;

    // TBR-DOC-015: forces a genuine DB reload of an already-managed entity after the Document lock
    // is acquired in upgradeRevision (see there). A plain repository re-fetch within the same
    // persistence context returns the cached, possibly-stale managed instance (Hibernate's
    // first-level cache) rather than hitting the database again -- entityManager.refresh(...) is
    // required to actually observe a concurrent commit that happened while this transaction was
    // blocked waiting for the row lock.
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    // Field-injected for the same reason as controlledCopyLifecycleObsolescenceService above --
    // publishes RevisionSnapshotEvent to trigger async review-snapshot (re)generation without
    // widening the constructor.
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

    // Field-injected for the same reason as above -- used only by createLegacyImportRevisionsBatch
    // to parse the "revisions" JSON array multipart part.
    @org.springframework.beans.factory.annotation.Autowired
    private ObjectMapper objectMapper;
    private final RevisionUploadFileValidator revisionUploadFileValidator;
    private final RevisionUploadSecurityAuditService revisionUploadSecurityAuditService;
    private final DocumentRevisionTemplateLineageRepository templateLineageRepository;
    private final WorkflowParticipantEligibilityService workflowParticipantEligibilityService;
    private final SignatureTokenConsumptionService signatureTokenConsumptionService;

    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentSubTypeRepository documentSubTypeRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;

    public RevisionService(
            DocumentRevisionRepository revisionRepository,
            RevisionStatusDefinitionRepository revisionStatusRepository,
            DocumentRecordRepository documentRepository,
            DocumentStatusDefinitionRepository documentStatusRepository,
            DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            RevisionWorkflowHistoryRepository revisionWorkflowHistoryRepository,
            DocumentRelationRepository documentRelationRepository,
            UserAccountRepository userAccountRepository,
            DocumentWorkflowSettingRepository documentWorkflowSettingRepository,
            AuditTrailService auditTrailService,
            EmailNotificationService emailNotificationService,
            DocumentAuthorizationService documentAuthorizationService,
            TrainingAuthorizationService trainingAuthorizationService,
            CurrentUserService currentUserService,
            SystemConfigurationService systemConfigurationService,
            FileStorageService fileStorageService,
            TokenService tokenService,
            ControlledCopyRepository controlledCopyRepository,
            RevisionWorkingNoteRepository revisionWorkingNoteRepository,
            RevisionPublishingMetadataRepository publishingMetadataRepository,
            ElectronicSignatureService electronicSignatureService,
            @Lazy PublishingPdfComposerService publishingPdfComposerService,
            DocumentTypeRepository documentTypeRepository,
            DocumentSubTypeRepository documentSubTypeRepository,
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            ControlledCopyBatchStatusService controlledCopyBatchStatusService,
            NotificationRealtimeService notificationRealtimeService,
            RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService,
            PermissionEvaluationService permissionEvaluationService,
            SecureFileAccessService secureFileAccessService,
            WorkflowActionPolicyService workflowActionPolicyService,
            UserAccessProfileRepository userAccessProfileRepository,
            RevisionUploadFileValidator revisionUploadFileValidator,
            RevisionUploadSecurityAuditService revisionUploadSecurityAuditService,
            DocumentRevisionTemplateLineageRepository templateLineageRepository,
            WorkflowParticipantEligibilityService workflowParticipantEligibilityService,
            SignatureTokenConsumptionService signatureTokenConsumptionService
    ) {
        this.revisionRepository = revisionRepository;
        this.revisionStatusRepository = revisionStatusRepository;
        this.documentRepository = documentRepository;
        this.documentStatusRepository = documentStatusRepository;
        this.documentWorkflowParticipantRepository = documentWorkflowParticipantRepository;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.revisionWorkflowHistoryRepository = revisionWorkflowHistoryRepository;
        this.documentRelationRepository = documentRelationRepository;
        this.userAccountRepository = userAccountRepository;
        this.documentWorkflowSettingRepository = documentWorkflowSettingRepository;
        this.auditTrailService = auditTrailService;
        this.emailNotificationService = emailNotificationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.trainingAuthorizationService = trainingAuthorizationService;
        this.currentUserService = currentUserService;
        this.systemConfigurationService = systemConfigurationService;
        this.fileStorageService = fileStorageService;
        this.tokenService = tokenService;
        this.controlledCopyRepository = controlledCopyRepository;
        this.revisionWorkingNoteRepository = revisionWorkingNoteRepository;
        this.publishingMetadataRepository = publishingMetadataRepository;
        this.electronicSignatureService = electronicSignatureService;
        this.publishingPdfComposerService = publishingPdfComposerService;
        this.documentTypeRepository = documentTypeRepository;
        this.documentSubTypeRepository = documentSubTypeRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.departmentRepository = departmentRepository;
        this.controlledCopyBatchStatusService = controlledCopyBatchStatusService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.revisionWorkflowAuthorizationService = revisionWorkflowAuthorizationService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.secureFileAccessService = secureFileAccessService;
        this.workflowActionPolicyService = workflowActionPolicyService;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.revisionUploadFileValidator = revisionUploadFileValidator;
        this.revisionUploadSecurityAuditService = revisionUploadSecurityAuditService;
        this.templateLineageRepository = templateLineageRepository;
        this.workflowParticipantEligibilityService = workflowParticipantEligibilityService;
        this.signatureTokenConsumptionService = signatureTokenConsumptionService;
    }

    @Transactional(readOnly = true)
    public DocumentFiltersResponse getFilters() {
        List<LookupItemResponse> statuses = revisionStatusRepository.findAllByOrderBySortOrderAsc().stream()
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

    @Transactional(readOnly = true)
    public PageResponse<RevisionListItemResponse> listRevisions(
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
            boolean ownedByMe,
            boolean pending,
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
        Page<DocumentRevisionRecord> result = revisionRepository.findAll(buildSpecification(
                search, ids, status, documentType, businessUnit, department, authorId, author,
                relatedDocument, correlatedDocument, isTemplate,
                createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                ownedByMe, pending, currentUser
        ), pageable);

        List<RevisionListItemResponse> items = result.getContent().stream()
                .map(this::toListItem)
                .toList();

        return new PageResponse<>(
                items,
                new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages())
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getPendingCounts() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UUID currentUserId = currentUser.getId();
        long pendingReview = revisionWorkflowParticipantRepository.countByRevision_Status_CodeAndParticipantTypeAndUser_Id(
                "PENDING_REVIEW", "REVIEWER", currentUserId
        );
        long pendingApproval = revisionWorkflowParticipantRepository.countByRevision_Status_CodeAndParticipantTypeAndUser_Id(
                "PENDING_APPROVAL", "APPROVER", currentUserId
        );
        Map<String, Long> counts = new HashMap<>();
        counts.put("pendingReview", pendingReview);
        counts.put("pendingApproval", pendingApproval);
        return counts;
    }

    @Transactional(readOnly = true)
    public void writeRevisionsExport(
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
            boolean ownedByMe,
            boolean pending,
            String sortBy,
            String sortDirection,
            java.io.OutputStream outputStream
    ) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8))) {
            writer.println("Document Number,Revision Number,Created,Opened By,Revision Name,Status,Document Name,Document Type,Department,Business Unit,Author,Effective Date,Valid Until,Has Related Documents,Has Correlated Documents,Is Template");
            Specification<DocumentRevisionRecord> specification = buildSpecification(
                    search, ids, status, documentType, businessUnit, department, authorId, author,
                    relatedDocument, correlatedDocument, isTemplate,
                    createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                    ownedByMe, pending, currentUser
            );
            int page = 0;
            Page<DocumentRevisionRecord> result;
            do {
                result = revisionRepository.findAll(specification, PageRequest.of(page++, 500, Sort.by(direction, sortProperty)));
                for (DocumentRevisionRecord revision : result.getContent()) {
                    RevisionListItemResponse item = toListItem(revision);
                    writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                            csv(item.documentNumber()),
                            csv(item.revisionNumber()),
                            csv(item.created()),
                            csv(item.openedBy()),
                            csv(item.revisionName()),
                            csv(item.state()),
                            csv(item.documentName()),
                            csv(item.type()),
                            csv(item.department()),
                            csv(item.businessUnit()),
                            csv(item.author()),
                            csv(item.effectiveDate()),
                            csv(item.validUntil()),
                            csv(Boolean.toString(item.hasRelatedDocuments())),
                            csv(Boolean.toString(item.hasCorrelatedDocuments())),
                            csv(Boolean.toString(item.isTemplate()))
                    );
                }
                writer.flush();
            } while (result.hasNext());
        }
    }

    @Transactional
    public RevisionDetailResponse getRevision(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        ensureCurrentUserCanViewRevision(revision, currentUser);

        revision.setOpenedBy(currentUser);
        revisionRepository.save(revision);

        DocumentRecord document = revision.getDocument();
        if (document != null) {
            document.setOpenedBy(currentUser);
            documentRepository.save(document);
        }

        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionNumber() + " - " + revision.getDocumentName(),
                revision.getId(),
                "VIEW",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Opened revision detail"
        );

        return toDetailResponse(revision);
    }

    @Transactional(readOnly = true)
    public RevisionDetailResponse getRevisionForSnapshot(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        ensureCurrentUserCanViewRevision(revision, currentUser);
        return toDetailResponse(revision);
    }

    @Transactional(readOnly = true)
    public List<SignatureResponse> getRevisionSignatures(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        ensureCurrentUserCanViewRevision(revision, currentUser);
        return buildRevisionSignatures(revision);
    }

    /**
     * Returns immutable template provenance only after the caller has passed the normal
     * revision-view authorization check. This endpoint never exposes the source file.
     */
    @Transactional(readOnly = true)
    public TemplateLineageResponse getTemplateLineage(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        ensureCurrentUserCanViewRevision(revision, currentUser);
        return templateLineageRepository.findByTargetRevision_Id(revisionId)
                .map(lineage -> new TemplateLineageResponse(
                        lineage.getSourceTemplateDocument().getId().toString(),
                        lineage.getSourceTemplateDocument().getDocumentNumber(),
                        lineage.getSourceTemplateDocument().getDocumentName(),
                        lineage.getSourceTemplateRevision().getId().toString(),
                        lineage.getSourceTemplateRevisionNumber(),
                        lineage.getSourceFileChecksum(),
                        lineage.getTargetFileChecksum(),
                        lineage.getSelectedBy() == null ? null : lineage.getSelectedBy().getFullName(),
                        DateTimeFormatUtils.formatDateTime(lineage.getSelectedAt()),
                        Map.copyOf(lineage.getPlaceholderSnapshot())
                ))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<RevisionWorkingNoteResponse> listWorkingNotes(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        ensureCurrentUserCanViewRevision(revision, currentUser);
        return revisionWorkingNoteRepository.findAllByRevision_IdAndDeletedAtIsNullOrderByCreatedAtDesc(revisionId)
                .stream()
                .map(note -> toWorkingNoteResponse(note, currentUser))
                .toList();
    }

    @Transactional
    public RevisionWorkingNoteResponse addWorkingNote(UUID revisionId, RevisionWorkingNoteRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        String workflowStage = requireWorkingNoteWriteAccess(revision, currentUser);

        RevisionWorkingNote note = new RevisionWorkingNote();
        note.setId(UUID.randomUUID());
        note.setRevision(revision);
        note.setNoteText(request.content().trim());
        note.setWorkflowStage(workflowStage);
        note.setCreatedBy(currentUser);
        note.setCreatedAt(Instant.now());
        revisionWorkingNoteRepository.save(note);

        auditTrailService.logAs(
                currentUser,
                "Revision",
                revision.getRevisionNumber() + " - " + revision.getDocumentName(),
                revision.getId(),
                "ADD_WORKING_NOTE",
                null,
                workflowStage,
                request.content().trim(),
                List.of(
                        new AuditTrailChangeResponse("Workflow Stage", "-", workflowStage),
                        new AuditTrailChangeResponse("Working Note", "-", request.content().trim())
                )
        );

        return toWorkingNoteResponse(note, currentUser);
    }

    @Transactional
    public void deleteWorkingNote(UUID revisionId, UUID noteId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        String workflowStage = requireWorkingNoteWriteAccess(revision, currentUser);

        RevisionWorkingNote note = revisionWorkingNoteRepository
                .findByIdAndRevision_IdAndDeletedAtIsNull(noteId, revisionId)
                .orElseThrow(() -> new IllegalArgumentException("Working note not found"));
        if (note.getCreatedBy() == null
                || !Objects.equals(note.getCreatedBy().getId(), currentUser.getId())
                || !workflowStage.equalsIgnoreCase(note.getWorkflowStage())) {
            throw new AccessDeniedException("Only your own note from the current workflow stage can be deleted");
        }
        note.setDeletedBy(currentUser);
        note.setDeletedAt(Instant.now());
        revisionWorkingNoteRepository.save(note);

        auditTrailService.logAs(
                currentUser,
                "Revision",
                revision.getRevisionNumber() + " - " + revision.getDocumentName(),
                revision.getId(),
                "DELETE_WORKING_NOTE",
                workflowStage,
                null,
                note.getNoteText(),
                List.of(
                        new AuditTrailChangeResponse("Workflow Stage", workflowStage, "-"),
                        new AuditTrailChangeResponse("Working Note", note.getNoteText(), "-")
                )
        );
    }

    @Transactional(readOnly = true)
    public List<DocumentRevisionSummaryResponse> getDocumentRevisionSummaries(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = requireDocument(documentId);
        ensureCurrentUserCanViewDocumentRevisions(document, currentUser);
        List<DocumentRevisionRecord> revisions = new ArrayList<>(revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId));
        revisions.sort(REVISION_COMPARATOR);
        return revisions.stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public RevisionDetailResponse createRevisionFromDocument(UUID documentId, RevisionCreationRequest request) {
        DocumentRecord document = requireDocument(documentId);
        UserAccount currentUser = currentUserService.requireCurrentUser();
        documentAuthorizationService.requireCanManageRevisionWorkspace(currentUser);
        requireDocumentWorkflowParticipantsAssigned(document);
        ensureNoRevisionInProgress(documentId, null);
        DocumentRevisionRecord latestRevision = revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(documentId).orElse(null);
        requireDocumentAllowsRevisionCreation(document, latestRevision);
        DocumentRevisionRecord templateRevision = null;
        String templateSelectionComment = null;
        if (request != null && StringUtils.hasText(request.templateRevisionId())) {
            templateRevision = requireTemplateRevision(UUID.fromString(request.templateRevisionId()), document, currentUser);
            templateSelectionComment = "Created from template " + safeDocumentLabel(templateRevision.getDocument());
        }
        String revisionComment = request == null ? null : request.changeDescription();
        if (StringUtils.hasText(templateSelectionComment)) {
            revisionComment = StringUtils.hasText(revisionComment)
                    ? revisionComment + " | " + templateSelectionComment
                    : templateSelectionComment;
        }

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        applyRevisionSnapshot(
                revision,
                document,
                currentUser,
                latestRevision,
                request == null ? null : request.changeDescription(),
                resolveNextDraftRevisionNumber(documentId)
        );
        revision.setDocumentNumber(document.getDocumentNumber());
        revision.setParentRevision(latestRevision);
        revisionRepository.save(revision);

        if (templateRevision != null) {
            cloneRevisionFile(templateRevision, revision);
            recordTemplateLineage(templateRevision, revision, currentUser);
        }

        copyWorkflowParticipantsFromDocument(document, revision);

        recordRevisionHistory(
                revision,
                "CREATE",
                latestRevision == null ? null : latestRevision.getStatus() == null ? null : latestRevision.getStatus().getCode(),
                revision.getStatus().getCode(),
                revisionComment,
                currentUser
        );
        return toDetailResponse(revision);
    }

    /**
     * Legacy Import only. Rejects anything that is not purely numeric segments in the same
     * "family" (two-part vs three-part) as the system's configured Revision Number Seed (Settings
     * > Document Properties) -- e.g. a system configured for "0.0.1" three-part numbering only
     * accepts "4.0.0", never "4.0". Returns the canonicalised value via normalizeVersionFormat.
     */
    private String requireLegacyRevisionNumberFormat(String raw) {
        if (!StringUtils.hasText(raw)) {
            throw new IllegalArgumentException("Initial revision number is required.");
        }
        String trimmed = raw.trim();
        String[] parts = trimmed.split("\\.", -1);
        boolean seedIsTwoPart = isTwoPartRevisionNumber(defaultRevisionSeed());
        boolean formatMatches = seedIsTwoPart ? parts.length == 2 : parts.length == 3;
        if (!formatMatches) {
            throw new IllegalArgumentException("Initial revision number must have the format "
                    + (seedIsTwoPart ? "X.Y (e.g. 4.0)" : "X.Y.Z (e.g. 4.0.0)")
                    + " to match the system's configured revision numbering.");
        }
        for (String part : parts) {
            if (!part.matches("\\d+")) {
                throw new IllegalArgumentException("Initial revision number must contain only numeric segments, e.g. "
                        + (seedIsTwoPart ? "4.0" : "4.0.0") + ".");
            }
        }
        return normalizeVersionFormat(trimmed);
    }

    private String normalizeToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    /**
     * Shared core of "promote a Legacy Import DRAFT revision straight to Effective", used by
     * {@link #createLegacyImportRevisionsBatch} for the last revision of a batch (single-revision
     * Legacy Import is just a batch of one -- see that method's javadoc). Caller is responsible for
     * every precondition check (status is DRAFT, not already promoted, etc.) -- this method only
     * does the actual promotion work.
     */
    /**
     * Renders the revision's source file to PDF and stores it as that revision's OWN permanent
     * published record ({@link RevisionPublishingMetadata} + revision.storagePdfUrl/
     * previewFilePath) -- independent of whether the revision ends up Effective or (superseded)
     * Obsoleted. Every OTHER document lifecycle keeps a real published PDF for every revision that
     * was ever Effective, even after a newer one supersedes it (Controlled Copy of an old revision,
     * "view this historical revision's PDF", etc. all rely on that). Legacy Import's earlier,
     * directly-Obsoleted sections would otherwise never get one at all -- they never pass through
     * {@link #promoteLegacyImportRevisionCore}, which used to be the only place this ran.
     */
    private DocumentRevisionRecord generateAndStoreLegacyImportPublishedPdf(
            DocumentRevisionRecord revision,
            UserAccount currentUser,
            Instant publishedAt,
            List<String> storedObjectKeysForRollbackCleanup
    ) throws IOException {
        byte[] publishedPdf = renderReviewSnapshotSource(revision.getId());
        if (publishedPdf == null || publishedPdf.length == 0) {
            throw new IllegalStateException("Published PDF is not available");
        }
        try (ByteArrayInputStream input = new ByteArrayInputStream(publishedPdf)) {
            FileStorageService.StorageWriteResult stored = fileStorageService.storeRevisionPublishedPdf(
                    revision.getId(), "published.pdf", input, revision.getDocumentNumber(), revision.getRevisionNumber()
            );
            RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
            metadata.setRevision(revision);
            metadata.setPublishedPdfPath(stored.storedPath());
            metadata.setPublishedPdfChecksum(stored.checksum());
            metadata.setPublishedPdfVersionId(stored.versionId());
            metadata.setPublishedAt(publishedAt);
            metadata.setPublishedBy(currentUser);
            metadata.setConversionEngine("LEGACY_IMPORT_DIRECT");
            publishingMetadataRepository.save(metadata);
            revision.setStoragePdfUrl(stored.storedPath());
            // Controlled Copy creation (ControlledCopyService#requirePublishedPdfBytes) and other
            // features read the published PDF from revision.previewFilePath, not storagePdfUrl --
            // the normal publish flow (PublishingWorkspaceService) always populates both to the
            // same path by the time a revision reaches Effective. Legacy Import skips Publishing
            // Workspace entirely, so without this it would leave previewFilePath permanently null
            // and every such feature would report "Published PDF is not available" despite a real
            // one existing in MinIO.
            revision.setPreviewFilePath(stored.storedPath());
            revision = revisionRepository.save(revision);
            if (storedObjectKeysForRollbackCleanup != null) {
                storedObjectKeysForRollbackCleanup.add(stored.storedPath());
            }
            return revision;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store the published PDF", ex);
        }
    }

    private void promoteLegacyImportRevisionCore(
            DocumentRevisionRecord revision,
            DocumentRecord document,
            UserAccount currentUser,
            LocalDate effectiveDate,
            UUID signatureSessionId,
            String auditComment,
            List<String> storedObjectKeysForRollbackCleanup
    ) throws IOException {
        Instant publishedAt = Instant.now();
        Integer periodicReviewCycle = revision.getPeriodicReviewCycle() != null
                ? revision.getPeriodicReviewCycle()
                : document.getPeriodicReviewCycle();
        LocalDate validUntil = calculateValidUntil(effectiveDate, periodicReviewCycle, revision.getValidUntil());

        // Same immutable-source invariant Complete Editing normally establishes -- Legacy Import
        // skips Complete Editing entirely, so it must set this itself before the revision becomes
        // Effective.
        revision.setEditingStatus("COMPLETED");
        revision.setSourceLocked(true);
        revision.setStatus(requireRevisionStatus("EFFECTIVE"));
        revision.setPublishedBy(currentUser);
        revision.setPublishedAt(publishedAt);
        revision.setEffectiveDate(effectiveDate);
        revision.setValidUntil(validUntil);
        revision.setOpenedBy(currentUser);
        // Reassign to the merged/managed return value -- see the matching comment in
        // createLegacyImportRevisionsBatch for why this entity's manually-assigned id makes every
        // save() route through entityManager.merge(), whose return value (not the passed-in
        // reference) is the one that carries the correct @Version going into the next save below.
        revision = revisionRepository.save(revision);

        document.setVersion(revision.getRevisionNumber());
        document.setEffectiveDate(effectiveDate);
        document.setValidUntil(validUntil);
        document.setStatus(requireDocumentStatus("ACTIVE"));
        document.setOpenedBy(currentUser);
        documentRepository.save(document);

        // A controlled document template is never converted to PDF; its Word file stays the working copy.
        if (!document.isTemplate()) {
            revision = generateAndStoreLegacyImportPublishedPdf(revision, currentUser, publishedAt, storedObjectKeysForRollbackCleanup);
        }

        String revisionLabel = revision.getDocumentNumber() + " Rev " + revision.getRevisionNumber();
        recordRevisionHistory(
                revision,
                "LEGACY_IMPORT_EFFECTIVE",
                "DRAFT",
                "EFFECTIVE",
                "Legacy import promoted directly to Effective (Review, Approval, Training and Publishing Template steps were not used).",
                currentUser,
                signatureSessionId
        );
        auditTrailService.logAs(
                currentUser,
                "DOCUMENT_REVISION",
                revisionLabel,
                revision.getId(),
                "DOCUMENT_LEGACY_IMPORT_EFFECTIVE",
                "DRAFT",
                "EFFECTIVE",
                auditComment,
                List.of(),
                signatureSessionId
        );
    }

    /**
     * Legacy Import: creates the entire revision chain for a document from an existing (e.g.
     * paper-based) original in one atomic transaction -- a single revision (N=1, the ordinary case)
     * is just a batch of one, so there is deliberately no separate single-revision method or
     * endpoint any more. For N>1 (e.g. 1.0 -> 4.0), every revision but the last is created directly
     * in OBSOLETED status ("superseded by a newer legacy revision"); the last one is promoted
     * straight to Effective via {@link #promoteLegacyImportRevisionCore}, all as one all-or-nothing
     * transaction with revisions properly parent-chained.
     *
     * <p>Exactly one signature token authorizes the whole batch. {@link ElectronicSignatureService
     * #createEntitySignature} is called once per created revision with the SAME token -- safe
     * because {@link SignatureTokenConsumptionService#requireAndConsume} tracks consumption
     * per-transaction (first call durably consumes it, later calls within the same transaction are
     * idempotent), not a replay. This gives every revision its own signature record (own
     * signatureId, own entityId) while the user only authenticates once.</p>
     *
     * <p>Deliberately does NOT impersonate the paper document's original historical Reviewer/
     * Approver with a real electronic signature -- legacyHistoricalReviewers/Approver/ReviewDate/
     * ApprovalDate remain reference-only text fields, exactly as in the single-revision Legacy
     * Import. The only real signature event on every revision is the current user attesting "this
     * reflects the paper original", not an impersonation of who reviewed/approved it on paper.
     * See the field-level javadoc on {@link com.eqms.entity.DocumentRevisionRecord
     * #legacyHistoricalReviewers} for the resulting constraint on any feature that reads revision
     * participants.</p>
     */
    @Transactional
    public LegacyBatchImportResponse createLegacyImportRevisionsBatch(
            UUID documentId,
            String revisionsJson,
            List<MultipartFile> files,
            String legacyJustification,
            String signatureToken
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(currentUser, "documents.legacy_import.manage")) {
            throw new AccessDeniedException("Only Legacy Import is permitted to create revisions this way.");
        }
        DocumentRecord document = requireDocument(documentId);
        if (!document.isLegacyImport()) {
            throw new IllegalArgumentException("This document was not created through Legacy Import.");
        }
        if (revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(documentId).isPresent()) {
            throw new IllegalStateException("This document already has a revision; Legacy Batch Import only creates the initial revision history.");
        }
        if (!StringUtils.hasText(legacyJustification)) {
            throw new IllegalArgumentException("Migration Justification is required.");
        }

        List<LegacyBatchRevisionSectionRequest> sections = parseLegacyBatchSections(revisionsJson);
        if (sections.isEmpty()) {
            throw new IllegalArgumentException("At least one revision section is required.");
        }
        if (sections.size() > 100) {
            throw new IllegalArgumentException("A single Legacy Batch Import cannot exceed 100 revisions.");
        }

        // Validate every section up front (format, strictly increasing revision number, strictly
        // increasing Effective Date, file-or-justification present) before creating anything, so a
        // mistake anywhere in the batch fails the whole transaction cleanly.
        List<String> normalizedNumbers = new ArrayList<>();
        List<LocalDate> effectiveDates = new ArrayList<>();
        for (int i = 0; i < sections.size(); i++) {
            LegacyBatchRevisionSectionRequest section = sections.get(i);
            String normalized = requireLegacyRevisionNumberFormat(section.revisionNumber());
            if (i > 0 && compareRevisionNumbers(normalized, normalizedNumbers.get(i - 1)) <= 0) {
                throw new IllegalArgumentException("Revision numbers must be strictly increasing (section "
                        + (i + 1) + ": " + section.revisionNumber() + " must be greater than "
                        + sections.get(i - 1).revisionNumber() + ").");
            }
            normalizedNumbers.add(normalized);

            LocalDate effectiveDate = parseDate(section.effectiveDate());
            if (effectiveDate == null) {
                throw new IllegalArgumentException("A valid Effective Date is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (i > 0 && !effectiveDate.isAfter(effectiveDates.get(i - 1))) {
                throw new IllegalArgumentException("Effective Date must be strictly increasing across revisions (section "
                        + (i + 1) + ": " + section.effectiveDate() + " must be after "
                        + sections.get(i - 1).effectiveDate() + ").");
            }
            effectiveDates.add(effectiveDate);

            if (document.isRequiresTraining() && !StringUtils.hasText(section.trainingCompletionDate())) {
                throw new IllegalArgumentException("Historical Training Completion Date is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (StringUtils.hasText(section.trainingCompletionDate())) {
                LocalDate trainingCompletionDate = parseDate(section.trainingCompletionDate());
                if (trainingCompletionDate != null && trainingCompletionDate.isAfter(effectiveDate)) {
                    throw new IllegalArgumentException("Historical Training Completion Date for revision "
                            + section.revisionNumber() + " must be on or before this revision's Effective Date ("
                            + section.effectiveDate() + ").");
                }
            }

            if (document.isTemplate() && !section.hasFile()) {
                // A template is used directly as its Word file at every revision, so a "no file"
                // justification cannot stand in for it the way it can for an ordinary historical revision.
                throw new IllegalArgumentException("Revision " + section.revisionNumber()
                        + " needs a DOCX file: every revision of a controlled document template must have its Word file.");
            }
            if (!section.hasFile() && !StringUtils.hasText(section.noFileJustification())) {
                throw new IllegalArgumentException("Revision " + section.revisionNumber()
                        + " has no file attached; a justification is required when no source file is available.");
            }
            if (!StringUtils.hasText(section.authorId())) {
                throw new IllegalArgumentException("Author is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (!StringUtils.hasText(section.legacyHistoricalAuthoredDate())) {
                throw new IllegalArgumentException("Authored Date is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (!StringUtils.hasText(section.legacyHistoricalReviewers())) {
                throw new IllegalArgumentException("Historical Reviewer(s) is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (!StringUtils.hasText(section.legacyHistoricalReviewDate())) {
                throw new IllegalArgumentException("Historical Review Date is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (!StringUtils.hasText(section.legacyHistoricalApprover())) {
                throw new IllegalArgumentException("Historical Approver is required for revision "
                        + section.revisionNumber() + ".");
            }
            if (!StringUtils.hasText(section.legacyHistoricalApprovalDate())) {
                throw new IllegalArgumentException("Historical Approval Date is required for revision "
                        + section.revisionNumber() + ".");
            }

            // Chronology of the paper process itself (drafted -> reviewed -> approved -> [trained
            // if required] -> effective), and no historical date may be in the future -- the
            // frontend already enforces this, but this endpoint accepts direct API calls too, and
            // every accepted revision here gets a REAL electronic signature attesting to these
            // dates, so the same rule must hold independent of the caller.
            LocalDate authoredDate = parseDate(section.legacyHistoricalAuthoredDate());
            if (authoredDate == null) {
                throw new IllegalArgumentException("Authored Date for revision " + section.revisionNumber() + " is not a valid date.");
            }
            LocalDate reviewDate = parseDate(section.legacyHistoricalReviewDate());
            if (reviewDate == null) {
                throw new IllegalArgumentException("Historical Review Date for revision " + section.revisionNumber() + " is not a valid date.");
            }
            LocalDate approvalDate = parseDate(section.legacyHistoricalApprovalDate());
            if (approvalDate == null) {
                throw new IllegalArgumentException("Historical Approval Date for revision " + section.revisionNumber() + " is not a valid date.");
            }
            LocalDate today = LocalDate.now(SYSTEM_ZONE);
            if (authoredDate.isAfter(today) || reviewDate.isAfter(today) || approvalDate.isAfter(today) || effectiveDate.isAfter(today)) {
                throw new IllegalArgumentException("Historical dates for revision " + section.revisionNumber() + " cannot be in the future.");
            }
            if (reviewDate.isBefore(authoredDate)) {
                throw new IllegalArgumentException("Historical Review Date for revision " + section.revisionNumber()
                        + " must be on or after the Authored Date.");
            }
            if (approvalDate.isBefore(reviewDate)) {
                throw new IllegalArgumentException("Historical Approval Date for revision " + section.revisionNumber()
                        + " must be on or after the Historical Review Date.");
            }
            if (StringUtils.hasText(section.trainingCompletionDate())) {
                LocalDate trainingCompletionDate = parseDate(section.trainingCompletionDate());
                if (trainingCompletionDate != null) {
                    if (trainingCompletionDate.isAfter(today)) {
                        throw new IllegalArgumentException("Historical Training Completion Date for revision "
                                + section.revisionNumber() + " cannot be in the future.");
                    }
                    if (trainingCompletionDate.isBefore(approvalDate)) {
                        throw new IllegalArgumentException("Historical Training Completion Date for revision "
                                + section.revisionNumber() + " must be on or after the Historical Approval Date.");
                    }
                }
            } else if (effectiveDate.isBefore(approvalDate)) {
                throw new IllegalArgumentException("Effective Date for revision " + section.revisionNumber()
                        + " must be on or after the Historical Approval Date.");
            }
        }
        if (!sections.get(sections.size() - 1).hasFile()) {
            throw new IllegalArgumentException("The most recent revision (the one becoming Effective) must include a source file.");
        }

        // Validate every attached file (structure + ClamAV, same as the single-revision flow)
        // before any DB write -- a bad file anywhere in the batch fails fast.
        List<MultipartFile> safeFiles = files == null ? List.of() : files;
        long expectedFileCount = sections.stream().filter(LegacyBatchRevisionSectionRequest::hasFile).count();
        if (safeFiles.size() != expectedFileCount) {
            throw new IllegalArgumentException("Expected " + expectedFileCount
                    + " file(s) for the sections marked as having a file, got " + safeFiles.size() + ".");
        }
        List<RevisionUploadFileValidator.ValidatedRevisionFile> validatedFiles = new ArrayList<>();
        for (MultipartFile file : safeFiles) {
            if (file == null || file.isEmpty()) {
                throw new RevisionUploadValidationException("REVISION_FILE_REQUIRED", "A source file is required for every attached file slot.");
            }
            // A template is kept and used as its Word file (never converted to PDF), so only DOCX is accepted.
            validatedFiles.add(validateRevisionUpload(currentUser, document, null, file, !document.isTemplate()));
        }

        // Object storage (MinIO) is NOT transactional with the DB: storeRevisionFile/the published
        // PDF write below happen mid-loop, immediately as each section is processed, so a later
        // section's failure rolls back every DB row already created here but leaves any
        // already-uploaded objects sitting in MinIO with no DB row pointing at them. Track every
        // key written in this batch and delete them if the transaction ends up NOT committing.
        List<String> storedObjectKeysForRollbackCleanup = new ArrayList<>();
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == TransactionSynchronization.STATUS_COMMITTED) return;
                    for (String key : storedObjectKeysForRollbackCleanup) {
                        deleteInvalidStoredFile(key);
                    }
                }
            });
        }

        List<RevisionDetailResponse> createdRevisions = new ArrayList<>();
        DocumentRevisionRecord parent = null;
        int fileCursor = 0;
        for (int i = 0; i < sections.size(); i++) {
            LegacyBatchRevisionSectionRequest section = sections.get(i);
            boolean isLast = i == sections.size() - 1;

            DocumentRevisionRecord revision = new DocumentRevisionRecord();
            revision.setId(UUID.randomUUID());
            applyRevisionSnapshot(revision, document, currentUser, parent, section.changeDescription(), normalizedNumbers.get(i));
            revision.setDocumentNumber(document.getDocumentNumber());
            revision.setParentRevision(parent);
            if (StringUtils.hasText(section.authorId())) {
                userAccountRepository.findById(UUID.fromString(section.authorId()))
                        .ifPresent(revision::setAuthor);
            }
            revision.setLegacyHistoricalReviewers(normalizeToNull(section.legacyHistoricalReviewers()));
            revision.setLegacyHistoricalApprover(normalizeToNull(section.legacyHistoricalApprover()));
            if (StringUtils.hasText(section.legacyHistoricalAuthoredDate())) {
                revision.setLegacyHistoricalAuthoredDate(parseDate(section.legacyHistoricalAuthoredDate()));
            }
            if (StringUtils.hasText(section.legacyHistoricalReviewDate())) {
                revision.setLegacyHistoricalReviewDate(parseDate(section.legacyHistoricalReviewDate()));
            }
            if (StringUtils.hasText(section.legacyHistoricalApprovalDate())) {
                revision.setLegacyHistoricalApprovalDate(parseDate(section.legacyHistoricalApprovalDate()));
            }
            // Same field the ordinary Pending Training workflow step sets on any other revision --
            // NOT a legacy-only shadow field, so this is already wired into whatever the Training
            // module reads from a revision today.
            if (!document.isTemplate() && StringUtils.hasText(section.trainingCompletionDate())) {
                revision.setTrainingCompletionDate(parseDate(section.trainingCompletionDate()));
            }
            // Reassign to the returned (managed/merged) instance on every save -- this entity has
            // a manually-assigned id, so Spring Data JPA's isNew() falls back to "id != null" (a
            // primitive @Version field can't distinguish new from persisted) and therefore always
            // routes save() through entityManager.merge(), never persist(). merge() does NOT attach
            // the object you pass in -- it returns a *different* managed copy. Continuing to mutate
            // and re-save the original, ignored reference leaves its @Version stuck at its initial
            // value while the real row's version keeps incrementing, which throws
            // ObjectOptimisticLockingFailureException on a later save in this same revision's
            // multi-save sequence (reproduced by a 3-section LegacyBatchImportFullFlowTest run).
            revision = revisionRepository.save(revision);

            if (section.hasFile()) {
                MultipartFile file = safeFiles.get(fileCursor);
                RevisionUploadFileValidator.ValidatedRevisionFile validatedFile = validatedFiles.get(fileCursor);
                fileCursor++;
                try {
                    storeRevisionFile(revision, file, validatedFile);
                    revision = revisionRepository.saveAndFlush(revision);
                    storedObjectKeysForRollbackCleanup.add(revision.getFilePath());
                } catch (IOException ex) {
                    throw new IllegalStateException("Failed to upload the source file for revision " + section.revisionNumber(), ex);
                }
            }

            if (parent == null) {
                activateDocumentAfterInitialSourceStored(document, revision, currentUser);
            }

            String revisionLabel = revision.getDocumentNumber() + " Rev " + revision.getRevisionNumber();
            ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                    "DOCUMENT_REVISION", revision.getId(), revisionLabel, currentUser,
                    signatureToken, "LEGACY_DOCUMENT_IMPORT", legacyJustification, null, null, null
            );

            String createComment = section.hasFile()
                    ? "Revision imported as part of a Legacy Batch Import (historical revision "
                            + (i + 1) + " of " + sections.size() + ")."
                    : "Revision imported as part of a Legacy Batch Import without a source file: "
                            + section.noFileJustification();
            recordRevisionHistory(revision, "LEGACY_IMPORT", null,
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    createComment, currentUser, signature.getId());
            auditTrailService.logAs(currentUser, "DOCUMENT_REVISION", revisionLabel, revision.getId(),
                    "DOCUMENT_LEGACY_IMPORTED", null,
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    legacyJustification, List.of(), signature.getId());

            if (isLast) {
                try {
                    promoteLegacyImportRevisionCore(revision, document, currentUser, effectiveDates.get(i),
                            signature.getId(), "Legacy Batch Import completed.", storedObjectKeysForRollbackCleanup);
                } catch (IOException ex) {
                    throw new IllegalStateException("Failed to generate the published PDF for revision " + section.revisionNumber(), ex);
                }
            } else {
                LocalDate obsoleteEffectiveDate = effectiveDates.get(i);
                LocalDate obsoleteValidUntil = effectiveDates.get(i + 1);
                String previousStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
                revision.setEffectiveDate(obsoleteEffectiveDate);
                revision.setValidUntil(obsoleteValidUntil);
                revision.setStatus(requireRevisionStatus("OBSOLETED"));
                revision.setObsoletedBy(currentUser);
                revision.setObsoletedAt(obsoleteValidUntil.atStartOfDay(SYSTEM_ZONE).toInstant());
                revision = revisionRepository.save(revision);

                // Give this superseded historical revision its own permanent published PDF too --
                // otherwise only the batch's last (Effective) revision would ever have one, and
                // every other section (Preview, Controlled Copy, ...) would report it unavailable
                // despite a real source file existing for it. Sections without a file
                // (noFileJustification used instead) have nothing to render, so are skipped.
                if (section.hasFile() && !document.isTemplate()) {
                    try {
                        revision = generateAndStoreLegacyImportPublishedPdf(revision, currentUser, Instant.now(), storedObjectKeysForRollbackCleanup);
                    } catch (IOException ex) {
                        throw new IllegalStateException("Failed to generate the published PDF for revision " + section.revisionNumber(), ex);
                    }
                }

                recordRevisionHistory(revision, "LEGACY_BATCH_SUPERSEDED", previousStatus, "OBSOLETED",
                        "Historical revision superseded by revision " + sections.get(i + 1).revisionNumber()
                                + " (Legacy Batch Import).",
                        currentUser, signature.getId());
                auditTrailService.logAs(currentUser, "DOCUMENT_REVISION", revisionLabel, revision.getId(),
                        "DOCUMENT_LEGACY_BATCH_SUPERSEDED", previousStatus, "OBSOLETED",
                        legacyJustification, List.of(), signature.getId());
            }

            createdRevisions.add(toDetailResponse(revision));
            parent = revision;
        }

        return new LegacyBatchImportResponse(document.getId(), createdRevisions);
    }

    private List<LegacyBatchRevisionSectionRequest> parseLegacyBatchSections(String revisionsJson) {
        if (!StringUtils.hasText(revisionsJson)) {
            throw new IllegalArgumentException("At least one revision section is required.");
        }
        try {
            return objectMapper.readValue(revisionsJson, new TypeReference<List<LegacyBatchRevisionSectionRequest>>() {
            });
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid revisions payload: " + ex.getMessage());
        }
    }


    @Transactional
    public RevisionDetailResponse updateRevision(UUID revisionId, DocumentDraftCreateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.UPDATE_DRAFT_METADATA,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "DRAFT");
        requireRevisionNotCompletedEditing(revision);
        DocumentRecord document = requireDocument(revision.getDocument().getId());

        applyRevisionSnapshot(
                revision,
                document,
                currentUser,
                revision.getParentRevision(),
                request.description(),
                revision.getRevisionNumber()
        );
        applyTrainingSchedule(revision, request);
        revisionRepository.save(revision);
        saveRevisionParticipantsFromRequest(revision, request);
        recordRevisionHistory(revision, "UPDATE", revision.getStatus() == null ? null : revision.getStatus().getCode(), revision.getStatus() == null ? null : revision.getStatus().getCode(), "Revision draft updated", currentUser);
        return toDetailResponse(revision);
    }

    /**
     * Guarantees MinIO holds the latest OnlyOffice edits (Author before the source lock; Reviewer/Approver before they complete or reject) so the next stage never reads a stale file.
     * OnlyOffice only pushes a save after the last editor disconnects (plus a delay), so without
     * this the lock could land first and the trailing save would be dropped -- the file every
     * later stage (snapshot PDF, reviewers) reads would silently miss the Author's work. Runs
     * OUTSIDE any transaction on purpose: the save-callback needs the revision row that
     * {@link #completeEditing} locks. Fails closed if edits cannot be confirmed saved.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public void flushOnlyOfficeEditsBeforeLock(UUID revisionId) {
        DocumentRevisionRecord before = requireRevision(revisionId);
        String stage = before.getStatus() == null ? null : before.getStatus().getCode();
        boolean draftOpen = "DRAFT".equalsIgnoreCase(stage) && !before.isSourceLocked();
        boolean reviewStage = "PENDING_REVIEW".equalsIgnoreCase(stage) || "PENDING_APPROVAL".equalsIgnoreCase(stage);
        if (!draftOpen && !reviewStage) {
            return;
        }
        String checksumBefore = before.getSourceFileChecksum();
        int code = onlyOfficeDocumentEditService.sendForceSave(before);
        if (code == 1 || code == 4) {
            return; // no open session / nothing changed since the last save
        }
        if (code != 0) {
            throw new RevisionLifecycleConflictException("ONLYOFFICE_SAVE_NOT_CONFIRMED",
                    "Your latest edits could not be confirmed as saved (OnlyOffice code " + code + "). Close the editor, wait a few seconds and try again.");
        }
        long deadline = System.currentTimeMillis() + 20_000L;
        while (System.currentTimeMillis() < deadline) {
            DocumentRevisionRecord current = revisionRepository.findById(revisionId).orElse(before);
            if (!java.util.Objects.equals(checksumBefore, current.getSourceFileChecksum())) {
                return;
            }
            try {
                Thread.sleep(500);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new RevisionLifecycleConflictException("ONLYOFFICE_SAVE_NOT_CONFIRMED",
                "Your latest edits are still being saved. Wait a few seconds and try Complete Editing again.");
    }

    public OnlyOfficeDocumentEditService.Capacity getOnlyOfficeCapacity() {
        currentUserService.requireCurrentUser();
        return onlyOfficeDocumentEditService.getCapacity();
    }

    /** Direct publish (no Publishing Workspace) exists only for controlled-document templates. */
    @Transactional(readOnly = true)
    public void requireDirectPublishAllowed(UUID revisionId) {
        DocumentRevisionRecord revision = requireRevision(revisionId);
        if (revision.getDocument() == null || !revision.getDocument().isTemplate()) {
            throw new RevisionLifecycleConflictException("PUBLISH_VIA_WORKSPACE_REQUIRED",
                    "This revision is published from the Publishing Workspace; only controlled document templates are published directly.");
        }
    }

    /** Document keys of the editor sessions that may currently be open on this revision. */
    @Transactional(readOnly = true)
    public String onlyOfficeSessionKey(UUID revisionId) {
        return onlyOfficeDocumentEditService.currentDocumentKey(requireRevision(revisionId));
    }

    /**
     * Closes any open OnlyOffice editor on this revision right after a workflow transition
     * succeeded, so nobody keeps working in a session the new stage no longer allows.
     * Best-effort: the transition is already committed, so failures are only logged.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public void dropOnlyOfficeSessions(java.util.Collection<String> keys) {
        for (String key : new java.util.LinkedHashSet<>(keys)) {
            try {
                int code = onlyOfficeDocumentEditService.dropSession(key);
                log.info("OnlyOffice drop for key {} -> code {}", key, code);
            } catch (Exception ex) {
                log.warn("Could not close OnlyOffice session {}: {}", key, ex.toString());
            }
        }
    }

    @Transactional
    public RevisionDetailResponse completeEditing(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Row-locked: races getOfficeOnlineEditLink() for the same revision -- see
        // requireRevisionForUpdate's javadoc.
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        // Author-only + documents.revision.complete_authoring, per the COMPLETE_AUTHORING
        // workflow_action_policy and explicit product decision (Co-Author does not complete
        // editing) â€” replaces the old Author/Co-Author, no-permission-required check.
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.COMPLETE_AUTHORING,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "DRAFT");
        requireRevisionSourceFile(revision);
        requireValidSignatureToken(request, currentUser, "complete editing");

        // OnlyOffice keeps MinIO current on every save via its push callback (see
        // RevisionService#applyOnlyOfficeCallback) -- there is no separate "pull the latest edit"
        // or "revoke remote access" step needed here the way Graph's pull model required; status
        // alone (no longer DRAFT once sourceLocked below) is what stops further OnlyOffice edits,
        // enforced by RevisionActionCapabilityService#hasOfficeWorkspace / getOnlyOfficeEditConfig.
        revision.setEditingStatus("COMPLETED");
        revision.setSourceLocked(true);
        revisionRepository.save(revision);

        recordElectronicSignature(revision, currentUser, request, "PREPARED", "DRAFT", "DRAFT");
        recordRevisionHistory(
                revision,
                "COMPLETE_EDITING",
                "DRAFT",
                "DRAFT",
                "Author completed editing and locked the revision for publishing preparation",
                currentUser
        );
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "COMPLETE_EDITING",
                "DRAFT",
                "DRAFT",
                "Author completed editing, recorded the PREPARED signature, and revoked Office Online edit access.",
                List.of(
                        new AuditTrailChangeResponse("Prepared Signature", "-", "Recorded"),
                        new AuditTrailChangeResponse("Source Editing", "Unlocked", "Locked"),
                        new AuditTrailChangeResponse("SharePoint Edit Link", "Active", "Revoked")
                )
        );
        publishRevisionWorkflowUpdateAfterCommit(revision, "COMPLETE_EDITING");
        notifyDcoRevisionReadyForSubmission(revision, currentUser);
        return toDetailResponse(revision);
    }

    /**
     * T-P1-4 (F-08/Q1): recipients are resolved from the live SUBMIT_FOR_REVIEW policy actors
     * (DCO/DOCUMENT_CONTROLLER access profiles as of V345), not hard-coded, so this notification
     * automatically stays correct if the actor is reconfigured later via the Workflow
     * Authorization admin UI.
     */
    private void notifyDcoRevisionReadyForSubmission(DocumentRevisionRecord revision, UserAccount actor) {
        List<UserAccount> recipients = resolvePolicyAccessProfileRecipients(
                RevisionWorkflowAction.SUBMIT_FOR_REVIEW,
                revision.getStatus() == null ? "DRAFT" : revision.getStatus().getCode(),
                revision.getDocument() == null || revision.getDocument().getDocumentType() == null
                        ? null
                        : revision.getDocument().getDocumentType().getId()
        );
        sendRevisionHandoverNotification(
                EmailTemplateTypeUtils.DOCUMENT_READY_FOR_SUBMISSION_NOTIFICATION,
                revision,
                actor,
                recipients,
                "COMPLETE_EDITING",
                null
        );
    }

    /**
     * T-P1-4 (F-08/Q1): DCO cancelling a revision is now the only way back to the Author per D-5,
     * so the Author and Co-Author(s) are notified with the mandatory cancellation reason.
     */
    private void notifyAuthorRevisionCancelled(DocumentRevisionRecord revision, UserAccount actor, String cancelReason) {
        List<UserAccount> recipients = new ArrayList<>();
        UserAccount author = revision.getDocument() == null ? null : revision.getDocument().getAuthor();
        if (author != null) {
            recipients.add(author);
        }
        recipients.addAll(
                revisionWorkflowParticipantRepository
                        .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                        .stream()
                        .map(RevisionWorkflowParticipant::getUser)
                        .filter(Objects::nonNull)
                        .toList()
        );
        sendRevisionHandoverNotification(
                EmailTemplateTypeUtils.DOCUMENT_REVISION_CANCELLED_NOTIFICATION,
                revision,
                actor,
                recipients,
                "CANCEL",
                cancelReason
        );
    }

    private void sendRevisionHandoverNotification(
            String templateType,
            DocumentRevisionRecord revision,
            UserAccount actor,
            List<UserAccount> recipients,
            String actionType,
            String comment
    ) {
        DocumentRecord document = revision.getDocument();
        List<UserAccount> distinctRecipients = recipients.stream()
                .filter(Objects::nonNull)
                .filter(recipient -> actor == null || !recipient.getId().equals(actor.getId()))
                .distinct()
                .toList();
        if (document == null || distinctRecipients.isEmpty()) {
            return;
        }
        for (UserAccount recipient : distinctRecipients) {
            Map<String, String> overrides = new HashMap<>();
            overrides.put("documentTitle", document.getDocumentName() == null ? "" : document.getDocumentName());
            overrides.put("documentNumber", document.getDocumentNumber() == null ? "" : document.getDocumentNumber());
            overrides.put("relatedEntityType", "revision");
            overrides.put("relatedEntityId", revision.getId() == null ? "" : revision.getId().toString());
            overrides.put("relatedEntityTitle", firstNonBlank(revision.getRevisionName(), revision.getDocumentName(), document.getDocumentName(), ""));
            Map<String, String> variables = emailNotificationService.buildDocumentVariables(
                    document, revision, actor, recipient, actionType, comment, overrides
            );
            emailNotificationService.sendDocumentWorkflowNotification(templateType, List.of(recipient), variables);
        }
    }

    /**
     * Resolves the runtime actors of the given workflow action, when they are ACCESS_PROFILE
     * actors, to the Active users currently holding one of those profiles. Deliberately does not
     * hard-code any profile code so recipients follow the DB policy configuration.
     */
    private List<UserAccount> resolvePolicyAccessProfileRecipients(
            RevisionWorkflowAction action, String fromStatus, UUID documentTypeId
    ) {
        Optional<WorkflowActionPolicy> policyOpt = workflowActionPolicyService.resolvePolicy(action, fromStatus, documentTypeId);
        if (policyOpt.isEmpty()) {
            return List.of();
        }
        List<WorkflowActionPolicyActor> actors = policyOpt.get().getActors();
        if (actors == null || actors.isEmpty()) {
            return List.of();
        }
        List<String> profileCodes = actors.stream()
                .filter(a -> a.getActorType() == WorkflowActorType.ACCESS_PROFILE)
                .map(WorkflowActionPolicyActor::getActorCode)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        if (profileCodes.isEmpty()) {
            return List.of();
        }
        List<UUID> userIds = userAccessProfileRepository.findUserIdsByProfileCodes(profileCodes);
        if (userIds.isEmpty()) {
            return List.of();
        }
        return userAccountRepository.findAllById(userIds).stream()
                .filter(u -> u.getStatus() == UserStatus.Active)
                .toList();
    }

    @Transactional
    public RevisionDetailResponse submitForReview(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Row-locked: races completeEditing()/syncEditedFileFromOfficeOnline() for the same
        // revision -- both also call syncEditedFileFromOfficeOnlineToMinio(), which downloads the
        // current Office Online content and overwrites revision.filePath/sourceFileChecksum. Two
        // such calls interleaving without a lock (e.g. a double-submit, or Submit racing an
        // in-flight Complete Editing) is a lost-update race on our own DB writes -- the same class
        // of issue already fixed for the Reviewer/Approver actions earlier this session.
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        // documents.workspace.manage specifically (DCO), matching the SUBMIT_FOR_REVIEW
        // workflow_action_policy already used by the submitForReview capability flag â€” replaces
        // the old requireCanManageRevisionWorkspace (broader document-admin-view group) check,
        // which disagreed with what the FE "Submit for Review" button actually asked.
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.SUBMIT_FOR_REVIEW,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "DRAFT");
        // S6: the Revision's review_requirement is frozen at Revision-creation time; the Document's
        // is frozen when its Sub-Type is last changed. If someone changed the Draft's Sub-Type
        // after this Revision was snapshotted, the two disagree and the reviewer/approver set that
        // was assembled under the old rule may now be invalid. Refuse rather than submit a package
        // built against a stale requirement -- the caller must re-open the Revision so it re-syncs.
        if (revision.getDocument() != null) {
            ReviewRequirement documentRequirement = revision.getDocument().getReviewRequirement();
            if (documentRequirement == null) {
                documentRequirement = ReviewRequirement.REQUIRED;
            }
            ReviewRequirement revisionRequirement = revision.getReviewRequirement() == null
                    ? ReviewRequirement.REQUIRED
                    : revision.getReviewRequirement();
            if (documentRequirement != revisionRequirement) {
                throw new IllegalStateException(
                        "REVIEW_REQUIREMENT_CHANGED: the document's review requirement changed after this "
                                + "revision was created; re-open the revision to re-sync before submitting for review");
            }
        }
        if (!electronicSignatureService.hasRevisionSignatureMeaning(revision, "PREPARED")) {
            throw new IllegalStateException("Revision editing must be completed before submitting for review");
        }
        requireValidSignatureToken(request, currentUser, "submit for review");

        // No review PDF snapshot any more: reviewers/approvers view the working file directly in the
        // read-only OnlyOffice viewer (see getOnlyOfficeViewConfig), so submitting triggers no conversion.
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "REVIEW_PACKAGE_GENERATED",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Review snapshot PDF generated from the latest source file and stored back in MinIO"
        );

        validateSoD(
                revision.getReviewRequirement(),
                revision.getDocument() == null ? null : revision.getDocument().getAuthor(),
                revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                        .stream()
                        .map(participant -> participant.getUser() == null ? null : participant.getUser().getId().toString())
                        .filter(StringUtils::hasText)
                        .distinct()
                        .toList(),
                revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER")
                        .stream()
                        .map(participant -> participant.getUser() == null ? null : participant.getUser().getId().toString())
                        .filter(StringUtils::hasText)
                        .distinct()
                        .toList(),
                revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER")
                        .stream()
                        .map(participant -> participant.getUser() == null ? null : participant.getUser().getId().toString())
                        .filter(StringUtils::hasText)
                        .distinct()
                        .toList()
        );

        resetParticipantActions(revision, "REVIEWER");
        resetParticipantActions(revision, "APPROVER");
        revision.setReviewFlowMode(ReviewFlowMode.of(systemConfigurationService.isParallelReviewEnabled()));

        ReviewRequirement reviewRequirement = revision.getReviewRequirement();
        validateReviewersForRequirement(revision, reviewRequirement);
        boolean hasReviewers = reviewRequirement != ReviewRequirement.NONE;
        boolean hasApprovers = hasParticipants(revision, "APPROVER");
        String targetStatus = hasReviewers
                ? "PENDING_REVIEW"
                : hasApprovers
                ? "PENDING_APPROVAL"
                : revision.isRequiresTraining() ? "PENDING_TRAINING" : "READY_FOR_PUBLISHING";


        revision.setSubmittedBy(currentUser);
        revision.setSubmittedOn(Instant.now());
        revisionRepository.save(revision);

        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "SUBMIT_FOR_REVIEW",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Revision submitted for review, source editing locked, and SharePoint edit link revoked.",
                List.of(
                        new AuditTrailChangeResponse("Source Editing", "Unlocked", "Locked"),
                        new AuditTrailChangeResponse("SharePoint Edit Link", "Active", "Revoked"),
                        new AuditTrailChangeResponse("Review Snapshot PDF", "-", firstNonBlank(revision.getPreviewFilePath(), "-"))
                )
        );

        recordElectronicSignature(revision, currentUser, request, "SUBMITTED_FOR_REVIEW", "DRAFT", targetStatus);
        RevisionDetailResponse updated = updateRevisionStatus(revision, "SUBMIT_FOR_REVIEW", targetStatus, request, currentUser);
        regeneratePublishingSnapshotIfConfigured(revision, currentUser, "REVIEW_SNAPSHOT_REGENERATED");
        return updated;
    }

    // The workflow policy is the single authorization source for every revision action.
    // The participant lookup below remains a domain invariant: it prevents a reviewer or
    // approver from acting twice and records the action against the correct assignment.
    @Transactional
    public RevisionDetailResponse completeReview(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Row-locked: two Reviewers (common in Parallel Review mode, where more than one
        // participant can be pending at once) submitting COMPLETE_REVIEW for the last two
        // remaining participants at nearly the same instant would otherwise both read
        // "not all reviewed yet" under READ_COMMITTED and neither would drive the revision
        // forward, stranding it in PENDING_REVIEW with no pending reviewer left to retry.
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.COMPLETE_REVIEW,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_REVIEW");
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "review completion");
        RevisionWorkflowParticipant participant = requirePendingParticipant(revision, "REVIEWER", currentUser);

        markParticipantAction(participant, "REVIEWED", request, signatureSessionId);
        revisionWorkflowParticipantRepository.save(participant);

        boolean allReviewersReviewed = countParticipantsByStatus(revision, "REVIEWER", "REVIEWED")
                == countParticipants(revision, "REVIEWER");
        String targetStatus = allReviewersReviewed
                ? hasParticipants(revision, "APPROVER")
                    ? "PENDING_APPROVAL"
                    : revision.isRequiresTraining() ? "PENDING_TRAINING" : "READY_FOR_PUBLISHING"
                : "PENDING_REVIEW";

        recordElectronicSignature(revision, currentUser, request, "REVIEWED", "PENDING_REVIEW", targetStatus);
        RevisionDetailResponse updated = updateRevisionStatus(revision, "REVIEW_COMPLETE", targetStatus, request, currentUser);
        // OnlyOffice needs no explicit access revoke: once this reviewer's participant action is
        // no longer PENDING, getOnlyOfficeEditConfig's own participant-status check already
        // refuses to open a new REVIEW-mode session for them.
        regeneratePublishingSnapshotIfConfigured(revision, currentUser, "REVIEW_SNAPSHOT_REGENERATED");
        return updated;
    }

    @Transactional
    public RevisionDetailResponse rejectReview(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Row-locked: same revision, same race window as completeReview() above -- a Reject
        // racing a concurrent Complete on the last participant must not interleave.
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.REJECT_REVIEW,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_REVIEW");
        String rejectReviewReason = firstNonBlank(request == null ? null : request.comment(), request == null ? null : request.reason());
        if (!StringUtils.hasText(rejectReviewReason)) {
            throw new IllegalArgumentException("Activity summary is required");
        }
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "review rejection");
        RevisionWorkflowParticipant participant = requirePendingParticipant(revision, "REVIEWER", currentUser);

        markParticipantAction(participant, "REJECTED", request, signatureSessionId);
        revisionWorkflowParticipantRepository.save(participant);
        resetParticipantActions(revision, "REVIEWER");
        resetParticipantActions(revision, "APPROVER");

        revision.setRejectedBy(currentUser);
        revision.setRejectedAt(Instant.now());
        revision.setEditingStatus("IN_PROGRESS");
        revision.setSourceLocked(false);
        clearDraftReviewSnapshot(revision);
        revisionRepository.save(revision);

        // sourceLocked=false above already re-enables OnlyOffice editing (status/lock-based
        // gating) -- no separate "reopen" action is needed the way Graph's working copy required.
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "SOURCE_UNLOCKED",
                "PENDING_REVIEW",
                "DRAFT",
                "Source editing unlocked after review rejection.",
                List.of(
                        new AuditTrailChangeResponse("Source Editing", "Locked", "Unlocked"),
                        new AuditTrailChangeResponse("SharePoint Working File", "Review comments retained", "Author editing reopened")
                )
        );

        recordElectronicSignature(revision, currentUser, request, "REJECTED", "PENDING_REVIEW", "DRAFT");
        return updateRevisionStatus(revision, "REVIEW_REJECT", "DRAFT", request, currentUser);
    }

    @Transactional
    public RevisionDetailResponse completeApproval(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Row-locked: same race as completeReview() above, for Approvers (Parallel Approval mode).
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.COMPLETE_APPROVAL,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_APPROVAL");

        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        if (setting.isReviewerNoApprove()) {
            long reviewerCount = revisionWorkflowParticipantRepository.countByRevision_IdAndParticipantTypeAndUser_Id(
                    revision.getId(),
                    "REVIEWER",
                    currentUser.getId()
            );
            if (reviewerCount > 0) {
                throw new IllegalArgumentException("Reviewer cannot approve the same document");
            }
        }

        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "approval");
        RevisionWorkflowParticipant participant = requirePendingParticipant(revision, "APPROVER", currentUser);
        markParticipantAction(participant, "APPROVED", request, signatureSessionId);
        revisionWorkflowParticipantRepository.save(participant);

        boolean allApproversApproved = countParticipantsByStatus(revision, "APPROVER", "APPROVED")
                == countParticipants(revision, "APPROVER");
        String targetStatus = allApproversApproved
                ? revision.isRequiresTraining() ? "PENDING_TRAINING" : "READY_FOR_PUBLISHING"
                : "PENDING_APPROVAL";
        recordElectronicSignature(revision, currentUser, request, "APPROVED", "PENDING_APPROVAL", targetStatus);
        RevisionDetailResponse updated = updateRevisionStatus(revision, "APPROVE_COMPLETE", targetStatus, request, currentUser);
        regeneratePublishingSnapshotIfConfigured(revision, currentUser, "REVIEW_SNAPSHOT_REGENERATED");
        return updated;
    }

    @Transactional
    public RevisionDetailResponse rejectApproval(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        // Row-locked: same race window as rejectReview() above, for Approvers.
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.REJECT_APPROVAL,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_APPROVAL");
        String rejectApprovalReason = firstNonBlank(request == null ? null : request.comment(), request == null ? null : request.reason());
        if (!StringUtils.hasText(rejectApprovalReason)) {
            throw new IllegalArgumentException("Activity summary is required");
        }
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "approval rejection");
        RevisionWorkflowParticipant participant = requirePendingParticipant(revision, "APPROVER", currentUser);

        markParticipantAction(participant, "REJECTED", request, signatureSessionId);
        revisionWorkflowParticipantRepository.save(participant);
        resetParticipantActions(revision, "REVIEWER");
        resetParticipantActions(revision, "APPROVER");

        revision.setRejectedBy(currentUser);
        revision.setRejectedAt(Instant.now());
        revision.setEditingStatus("IN_PROGRESS");
        revision.setSourceLocked(false);
        clearDraftReviewSnapshot(revision);
        revisionRepository.save(revision);

        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "SOURCE_UNLOCKED",
                "PENDING_APPROVAL",
                "DRAFT",
                "Source editing unlocked after approval rejection.",
                List.of(
                        new AuditTrailChangeResponse("Source Editing", "Locked", "Unlocked"),
                        new AuditTrailChangeResponse("SharePoint Working File", "Approval comments retained", "Author editing reopened")
                )
        );

        recordElectronicSignature(revision, currentUser, request, "REJECTED", "PENDING_APPROVAL", "DRAFT");
        return updateRevisionStatus(revision, "APPROVE_REJECT", "DRAFT", request, currentUser);
    }

    @Transactional
    public RevisionDetailResponse completeTraining(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.COMPLETE_TRAINING,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_TRAINING");
        trainingAuthorizationService.requireCanCompleteRevisionTraining(currentUser, revision);
        if (!revision.isRequiresTraining()) {
            throw new IllegalStateException("Training is not required for this revision");
        }
        requireValidSignatureToken(request, currentUser, "training completion");
        LocalDate plannedDate = revision.getTrainingPlannedDate();
        if (request != null && StringUtils.hasText(request.trainingPlannedDate())) {
            plannedDate = parseDate(request.trainingPlannedDate());
        }
        if (plannedDate == null) {
            throw new IllegalStateException("Training Planned Date is required");
        }

        Integer trainingPeriodDays = revision.getTrainingPeriodDays();
        if ((trainingPeriodDays == null || trainingPeriodDays < 1) && revision.getDocument() != null) {
            trainingPeriodDays = revision.getDocument().getTrainingPeriodDays();
        }

        LocalDate periodEndDate = plannedDate;
        if (trainingPeriodDays != null && trainingPeriodDays > 0) {
            periodEndDate = plannedDate.plusDays(trainingPeriodDays.longValue());
        }

        LocalDate completionDate = revision.getTrainingCompletionDate();
        if (request != null && StringUtils.hasText(request.trainingCompletionDate())) {
            completionDate = parseDate(request.trainingCompletionDate());
        }
        if (completionDate == null) {
            completionDate = LocalDate.now(SYSTEM_ZONE);
        }

        if (completionDate.isBefore(plannedDate)) {
            throw new IllegalStateException("Training Completion Date cannot be earlier than Training Planned Date");
        }
        revision.setTrainingPlannedDate(plannedDate);
        revision.setTrainingPeriodEndDate(periodEndDate);
        revision.setTrainingCompletionDate(completionDate);
        revisionRepository.save(revision);
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "TRAINING_COMPLETE",
                "PENDING_TRAINING",
                "READY_FOR_PUBLISHING",
                "Training completed and revision moved to Ready For Publishing.",
                List.of(
                        new AuditTrailChangeResponse("trainingPlannedDate", "-", DateTimeFormatUtils.formatDate(plannedDate)),
                        new AuditTrailChangeResponse("trainingPeriodEndDate", "-", DateTimeFormatUtils.formatDate(periodEndDate)),
                        new AuditTrailChangeResponse("trainingCompletionDate", "-", DateTimeFormatUtils.formatDate(completionDate))
                )
        );
        recordElectronicSignature(revision, currentUser, request, "TRAINING_CONFIRMED", "PENDING_TRAINING", "READY_FOR_PUBLISHING");
        RevisionDetailResponse updated = updateRevisionStatus(revision, "TRAINING_COMPLETE", "READY_FOR_PUBLISHING", request, currentUser);
        regeneratePublishingSnapshotIfConfigured(revision, currentUser, "REVIEW_SNAPSHOT_REGENERATED");
        return updated;
    }

    @Transactional
    public RevisionDetailResponse publishRevision(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        return publishRevision(revisionId, request, currentUser);
    }

    @Transactional
    public RevisionDetailResponse publishRevision(UUID revisionId, RevisionWorkflowActionRequest request, UserAccount currentUser) {
        if (currentUser == null) {
            currentUser = currentUserService.requireCurrentUser();
        }
        // Row-locked: publish has irreversible external side effects (Graph PDF composition,
        // WORM MinIO writes, superseding the previous EFFECTIVE revision and obsoleting its
        // Controlled Copies, e-mails). @Version alone only rejects the loser at commit -- after
        // those effects already ran twice for a double-submit or a Publish racing a Cancel.
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.PUBLISH,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        DocumentRecord document = requireDocument(revision.getDocument().getId());
        requireDocumentActiveForPublish(document);
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "publish");
        validatePublishableRevision(revision, false);
        List<DocumentRelation> relatedRelations = documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED");

        List<ApiErrorResponse.ErrorDetail> nonEffectiveDetails = new java.util.ArrayList<>();
        StringBuilder warningBuilder = new StringBuilder();

        for (DocumentRelation relation : relatedRelations) {
            DocumentRecord relatedDoc = relation.getTargetDocument();
            if (relatedDoc == null || relatedDoc.getId() == null) {
                continue;
            }

            DocumentRevisionRecord latestRelatedRev = revisionRepository
                    .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(relatedDoc.getId(), "EFFECTIVE")
                    .orElse(null);
            String statusLabel = "No Effective Revision";
            String statusCode = "NOT_EFFECTIVE";
            if (latestRelatedRev != null && latestRelatedRev.getStatus() != null) {
                statusLabel = latestRelatedRev.getStatus().getLabel();
                statusCode = latestRelatedRev.getStatus().getCode();
            }

            boolean isEffective = "EFFECTIVE".equals(statusCode);
            if (!isEffective) {
                nonEffectiveDetails.add(new ApiErrorResponse.ErrorDetail(relatedDoc.getDocumentNumber(), statusLabel));
                warningBuilder.append(relatedDoc.getDocumentNumber()).append(" - ").append(statusLabel).append("\n");
            }
        }

        if (!nonEffectiveDetails.isEmpty()) {
            boolean forcePublish = request != null && Boolean.TRUE.equals(request.forcePublish());
            if (!forcePublish) {
                String warningMsg = "One or more Related Documents are not currently Effective.\n\n"
                        + warningBuilder.toString()
                        + "\nPlease verify the document package before publishing.";
                throw new RelatedDocumentsNotEffectiveException(warningMsg, nonEffectiveDetails);
            } else {
                // Force Publish is a GMP exception/deviation: requires its own dedicated
                // permission (granted to nobody by default) and a mandatory, non-blank reason --
                // never inferred from documents.revision.publish/documents.workspace.manage.
                if (!permissionEvaluationService.hasPermission(currentUser, "documents.revision.force_publish")) {
                    throw new IllegalArgumentException("You do not have permission to force publish over non-effective Related Documents");
                }
                String forcePublishReason = request == null ? null : firstNonBlank(request.reason(), request.comment());
                if (!StringUtils.hasText(forcePublishReason)) {
                    throw new IllegalArgumentException("A reason is required to force publish over non-effective Related Documents");
                }
                // Log warning override decision in audit trail
                String overrideDetail = "Revision published with non-effective Related Documents. Reason: " + forcePublishReason.trim()
                        + "\n\n" + warningBuilder.toString();
                auditTrailService.logAs(
                        currentUser,
                        "REVISION",
                        revision.getRevisionName(),
                        revision.getId(),
                        "WARNING_OVERRIDE",
                        revision.getStatus() == null ? null : revision.getStatus().getCode(),
                        "EFFECTIVE",
                        overrideDetail
                );
            }
        }

        Instant publishedAt = Instant.now();
        String comment = request == null ? null : firstNonBlank(request.comment(), request.reason());
        
        // Remove batch publish behavior: only publish the primary revision
        publishRevisionRecord(revision, currentUser, publishedAt, comment, signatureSessionId, request == null ? null : request.signatureToken());
        notifyKnowledgeSubscribers(revision);

        return toDetailResponse(revision);
    }

    @Transactional
    public RevisionDetailResponse cancelRevision(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.CANCEL,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "revision cancellation");

        // Draft-only, matching the REVISION/CANCEL workflow_action_policy state invariant and
        // the explicit product decision â€” cancelling a revision already in review/approval/
        // training/ready-for-publishing is no longer allowed via this action.
        String currentStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (currentStatus == null || !"DRAFT".equalsIgnoreCase(currentStatus)) {
            throw new RevisionLifecycleConflictException(
                    "REVISION_CANCEL_DRAFT_ONLY",
                    "Only Draft revisions can be cancelled"
            );
        }

        String cancelReason = firstNonBlank(request == null ? null : request.comment(), request == null ? null : request.reason());
        if (!StringUtils.hasText(cancelReason)) {
            throw new IllegalArgumentException("Activity summary is required");
        }

        revision.setStatus(requireRevisionStatus("CLOSED_CANCELLED"));
        revision.setCancelledBy(currentUser);
        revision.setCancelledAt(Instant.now());
        revision.setOpenedBy(currentUser);
        revisionRepository.save(revision);

        recordRevisionHistory(
                revision,
                "CANCEL",
                currentStatus,
                "CLOSED_CANCELLED",
                cancelReason,
                currentUser,
                signatureSessionId
        );
        // The signature TOKEN is validated above (requireValidSignatureToken), but that alone
        // never persisted an e-signature row -- so buildRevisionSignatures() had nothing to
        // return for a genuine cancellation once the revision already had any other signature
        // (Prepared/Submitted, etc.), which is virtually always true for a Draft that reached
        // Cancel. Record it here so "Cancelled By" on the Signatures tab is actually populated.
        recordElectronicSignature(revision, currentUser, request, "CANCELLED", currentStatus, "CLOSED_CANCELLED");

        boolean documentClosed = syncDocumentStatusAfterRevisionCancellation(
                revision, currentUser, cancelReason, signatureSessionId
        );
        notifyAuthorRevisionCancelled(revision, currentUser, cancelReason);

        String responseMessage = documentClosed
                ? "Revision cancelled. The document was automatically closed because no revisions remain."
                : "Revision cancelled.";
        return toDetailResponse(revision, responseMessage);
    }

    @Transactional
    public RevisionDetailResponse upgradeDocumentRevision(UUID documentId) {
        return upgradeDocumentRevision(documentId, null);
    }

    @Transactional
    public RevisionDetailResponse upgradeDocumentRevision(UUID documentId, UUID impactAnalysisId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = requireDocument(documentId);
        String documentStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        if (!"ACTIVE".equals(documentStatus)) {
            throw new IllegalArgumentException("Only active documents can be upgraded");
        }

        DocumentRevisionRecord source = revisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE")
                .orElseThrow(() -> new IllegalArgumentException("Document has no effective revision"));
        revisionWorkflowAuthorizationService.require(
                currentUser,
                source,
                RevisionWorkflowAction.UPGRADE_REVISION,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(source)
        );

        // TBR-DOC-015 concurrency mechanism: acquire the same PESSIMISTIC_WRITE Document-row lock
        // DocumentService.obsoleteDocument takes before its own final precondition re-check. This
        // is the only Revision mutation that can introduce a brand-new in-progress Revision when a
        // concurrent Obsolete's initial check saw none -- serializing the two here (rather than a
        // wider lock/SERIALIZABLE isolation) closes that race. See DocumentObsoleteConcurrencyTest.
        //
        // Bug fixed here (found by TC-DOC-051/052 production-path test, "Obsolete wins lock"
        // ordering): the ACTIVE check above runs BEFORE this lock is acquired. If a concurrent
        // Document Obsolete commits while this transaction is blocked waiting for the lock, the
        // pre-lock `document`/`documentStatus` read is stale by the time the lock is granted. The
        // lock alone only serializes the WRITES; it does not retroactively make an earlier READ
        // fresh. The status must therefore be re-checked against the entity the lock query itself
        // returns, not the one fetched before waiting for the lock.
        DocumentRecord lockedDocument = documentRepository.findByIdForUpdate(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        String lockedDocumentStatus = lockedDocument.getStatus() == null ? null : lockedDocument.getStatus().getCode();
        if (!"ACTIVE".equals(lockedDocumentStatus)) {
            throw new IllegalArgumentException("Only active documents can be upgraded");
        }
        ensureNoRevisionInProgress(documentId, null);

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        applyRevisionSnapshot(
                revision,
                lockedDocument,
                currentUser,
                source,
                "Upgraded from revision " + source.getRevisionNumber(),
                resolveNextDraftRevisionNumberFromEffective(source.getRevisionNumber())
        );
        revision.setImpactAnalysisId(impactAnalysisId);
        revision.setDocumentNumber(lockedDocument.getDocumentNumber());
        revision.setParentRevision(source);
        revisionRepository.save(revision);

        copyWorkflowParticipantsFromDocument(lockedDocument, revision);
        // Upgrade creates a NEW, independent revision -- it does not transition an existing one.
        // This audit row belongs to that new revision, whose only prior state is "did not exist",
        // so there is no from-status (recording "Effective -> Draft" here was wrong: the new
        // revision was never Effective; the source revision -- which stays Effective -- is named in
        // the comment instead). recordRevisionHistory() already writes the audit_logs entry, so
        // there is no separate logAs() call -- that produced a duplicate row.
        recordRevisionHistory(revision, "UPGRADE", null,
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Draft revision " + revision.getRevisionNumber() + " created by upgrading effective revision "
                        + source.getRevisionNumber() + ". Training configuration copied from Document Master.",
                currentUser, buildUpgradeTrainingAuditChanges(lockedDocument));
        return toDetailResponse(revision);
    }

    @Transactional
    public RevisionDetailResponse upgradeRevision(UUID revisionId) {
        return upgradeRevision(revisionId, null);
    }

    @Transactional
    public RevisionDetailResponse upgradeRevision(UUID revisionId, UUID impactAnalysisId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord source = requireRevision(revisionId);
        String sourceStatus = source.getStatus() == null ? null : source.getStatus().getCode();
        if (!"EFFECTIVE".equals(sourceStatus)) {
            throw new IllegalArgumentException("Only effective revisions can be upgraded");
        }
        revisionWorkflowAuthorizationService.require(
                currentUser,
                source,
                RevisionWorkflowAction.UPGRADE_REVISION,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(source)
        );

        DocumentRecord document = requireDocument(source.getDocument().getId());
        // TBR-DOC-015 concurrency mechanism -- see upgradeDocumentRevision's identical comment.
        // Bug fixed here (same class as upgradeDocumentRevision's fix): the EFFECTIVE check above
        // reads `source` before waiting for this lock. A concurrent Document Obsolete cascades this
        // same Revision to OBSOLETED (obsoleteRevisionAsPartOfDocumentObsolete does not exempt an
        // EFFECTIVE revision from the cascade). If that commits while this transaction is blocked
        // on the lock, the pre-lock `sourceStatus` read is stale once the lock is granted -- the
        // lock only serializes writes, it does not retroactively refresh an earlier read. Re-fetch
        // and re-check the Revision's status against the entity read after lock acquisition.
        DocumentRecord lockedDocument = documentRepository.findByIdForUpdate(document.getId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        // `source` was already loaded (and is therefore already managed in this persistence
        // context) before the lock was acquired -- a plain findById here would return that same
        // cached instance without a new SQL round-trip, silently masking a concurrent commit made
        // while this transaction was blocked on the lock above. entityManager.refresh forces an
        // actual re-read from the database.
        DocumentRevisionRecord lockedSource = source;
        entityManager.refresh(lockedSource);
        String lockedSourceStatus = lockedSource.getStatus() == null ? null : lockedSource.getStatus().getCode();
        if (!"EFFECTIVE".equals(lockedSourceStatus)) {
            throw new IllegalArgumentException("Only effective revisions can be upgraded");
        }
        ensureNoRevisionInProgress(lockedDocument.getId(), null);

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        applyRevisionSnapshot(
                revision,
                lockedDocument,
                currentUser,
                lockedSource,
                "Upgraded from revision " + lockedSource.getRevisionNumber(),
                resolveNextDraftRevisionNumber(lockedDocument.getId())
        );
        revision.setImpactAnalysisId(impactAnalysisId);
        revision.setParentRevision(lockedSource);
        revisionRepository.save(revision);

        copyWorkflowParticipantsFromDocument(lockedDocument, revision);
        // See upgradeDocumentRevision(): one audit row on the NEW revision, no from-status (it is a
        // creation, not a transition; the source revision stays Effective and is named in the
        // comment), and recordRevisionHistory() is the single writer -- no duplicate logAs().
        recordRevisionHistory(revision, "UPGRADE", null,
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Draft revision " + revision.getRevisionNumber() + " created by upgrading effective revision "
                        + lockedSource.getRevisionNumber() + ". Training configuration copied from Document Master.",
                currentUser, buildUpgradeTrainingAuditChanges(lockedDocument));
        return toDetailResponse(revision);
    }

    public void validateUpgradeableRevision(UUID revisionId) {
        DocumentRevisionRecord source = requireRevision(revisionId);
        String sourceStatus = source.getStatus() == null ? null : source.getStatus().getCode();
        if (!"EFFECTIVE".equals(sourceStatus)) {
            throw new IllegalArgumentException("Only effective revisions can be upgraded");
        }

        if (source.getDocument() == null || source.getDocument().getId() == null) {
            throw new IllegalArgumentException("Source revision is missing its document");
        }

        ensureNoRevisionInProgress(source.getDocument().getId(), null);
    }

    @Transactional(readOnly = true)
    public void validateUpgradeableDocument(UUID documentId) {
        DocumentRecord document = requireDocument(documentId);
        String documentStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        if (!"ACTIVE".equals(documentStatus)) {
            throw new IllegalArgumentException("Only active documents can be upgraded");
        }

        requireCurrentEffectiveRevisionForSnapshot(documentId);
        ensureNoRevisionInProgress(documentId, null);
    }

    @Transactional(readOnly = true)
    public DocumentRevisionRecord requireCurrentEffectiveRevisionForSnapshot(UUID documentId) {
        return revisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE")
                .orElseThrow(() -> new IllegalArgumentException("Document has no effective revision"));
    }

    @Transactional(readOnly = true)
    public RevisionDetailResponse getCurrentEffectiveRevision(UUID documentId) {
        return toDetailResponse(requireCurrentEffectiveRevisionForSnapshot(documentId));
    }

    public String resolveNextDraftRevisionNumberForDocument(UUID documentId) {
        return resolveNextDraftRevisionNumber(documentId);
    }

    public String resolveNextDraftRevisionNumberFromEffectiveValue(String effectiveRevisionNumber) {
        return resolveNextDraftRevisionNumberFromEffective(effectiveRevisionNumber);
    }

    private List<DocumentRevisionRecord> resolvePublishBatch(DocumentRevisionRecord primaryRevision) {
        validatePublishableRevision(primaryRevision, false);

        DocumentRecord document = requireDocument(primaryRevision.getDocument().getId());
        List<DocumentRelation> relatedRelations = documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED");
        if (relatedRelations.isEmpty()) {
            return List.of(primaryRevision);
        }

        List<DocumentRevisionRecord> revisionsToPublish = new ArrayList<>();
        revisionsToPublish.add(primaryRevision);

        for (DocumentRelation relation : relatedRelations) {
            DocumentRecord relatedDocument = relation.getTargetDocument();
            if (relatedDocument == null || relatedDocument.getId() == null) {
                continue;
            }

            DocumentRevisionRecord relatedRevision = revisionRepository
                    .findFirstByDocument_IdOrderByCreatedAtDesc(relatedDocument.getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Related document " + safeDocumentLabel(relatedDocument) + " has no revision to publish"
                    ));

            String relatedStatus = relatedRevision.getStatus() == null ? null : relatedRevision.getStatus().getCode();
            if (Objects.equals(relatedStatus, "DRAFT")) {
                throw new IllegalStateException(
                        "Cannot publish because related document " + safeDocumentLabel(relatedDocument) + " is still Draft"
                );
            }

            validatePublishableRevision(relatedRevision, true);
            revisionsToPublish.add(relatedRevision);
        }

        return revisionsToPublish;
    }

    private void validatePublishableRevision(DocumentRevisionRecord revision, boolean relatedDocument) {
        String currentStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (currentStatus != null && !"READY_FOR_PUBLISHING".equals(currentStatus)) {
            if (relatedDocument) {
                throw new IllegalStateException(
                        "Related document " + safeDocumentLabel(revision.getDocument()) + " must be Ready for Publishing before publishing together"
                );
            }
            throw new IllegalStateException("Revision must be in READY_FOR_PUBLISHING state");
        }
        if (revision.isRequiresTraining() && revision.getTrainingCompletionDate() == null) {
            if (relatedDocument) {
                throw new IllegalStateException(
                        "Related document " + safeDocumentLabel(revision.getDocument()) + " requires training completion before publishing"
                );
            }
            throw new IllegalStateException("Training completion is required before publishing");
        }
    }

    /**
     * A Document Master remains Draft until its first Revision source file is stored successfully.
     * After that first file, later revisions are allowed only while the Master is Active. Terminal
     * states must never be reopened by a Revision creation request.
     */
    private void requireDocumentAllowsRevisionCreation(DocumentRecord document, DocumentRevisionRecord latestRevision) {
        String documentStatus = document == null || document.getStatus() == null
                ? null
                : document.getStatus().getCode();
        if (latestRevision == null) {
            if (!"DRAFT".equals(documentStatus)) {
                throw new IllegalStateException("The first revision can only be created while the document is Draft");
            }
            return;
        }
        if (!"ACTIVE".equals(documentStatus)) {
            throw new IllegalStateException("Revisions can only be created for an active document");
        }
    }

    /**
     * An initial Draft revision may receive its first source file while its Document is still Draft.
     * Any other file upload requires an Active Document, including direct/stale API calls.
     */
    private void requireDocumentAllowsRevisionFileUpload(DocumentRecord document, DocumentRevisionRecord revision) {
        String documentStatus = document == null || document.getStatus() == null
                ? null
                : document.getStatus().getCode();
        if ("ACTIVE".equals(documentStatus)) {
            return;
        }
        if ("DRAFT".equals(documentStatus) && revision != null && revision.getParentRevision() == null) {
            return;
        }
        throw new IllegalStateException("Revision source files can only be uploaded for an active document");
    }

    private void activateDocumentAfterInitialSourceStored(DocumentRecord document, DocumentRevisionRecord revision, UserAccount actor) {
        if (document == null || revision == null || revision.getParentRevision() != null
                || document.getStatus() == null || !"DRAFT".equals(document.getStatus().getCode())) {
            return;
        }
        document.setStatus(requireDocumentStatus("ACTIVE"));
        documentRepository.save(document);
        // TBR-DOC-004: DRAFT->ACTIVE activation previously had no dedicated audit entry -- only the
        // upload's own REVISION_SOURCE_FILE_UPLOADED history/audit existed, with no record that the
        // Document itself changed status as a side effect. Same transaction as the status flip above.
        auditTrailService.logAs(
                actor,
                "DOCUMENT",
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                document.getId(),
                "ACTIVATE",
                "DRAFT",
                "ACTIVE",
                "Document activated: initial revision source uploaded (Revision " + revision.getId() + ")"
        );
    }

    private void requireDocumentActiveForPublish(DocumentRecord document) {
        String documentStatus = document == null || document.getStatus() == null
                ? null
                : document.getStatus().getCode();
        if (!"ACTIVE".equals(documentStatus)) {
            throw new IllegalStateException("A revision can only be published for an active document");
        }
    }

    private boolean syncDocumentStatusAfterRevisionCancellation(
            DocumentRevisionRecord cancelledRevision,
            UserAccount currentUser,
            String cancelReason,
            UUID signatureSessionId
    ) {
        if (cancelledRevision.getDocument() == null || cancelledRevision.getDocument().getId() == null) {
            return false;
        }

        UUID documentId = cancelledRevision.getDocument().getId();
        List<String> remainingLifecycleStatuses = List.of(
                "DRAFT",
                "PENDING_REVIEW",
                "PENDING_APPROVAL",
                "PENDING_TRAINING",
                "READY_FOR_PUBLISHING",
                "EFFECTIVE"
        );
        boolean hasRemainingRevision = revisionRepository.existsByDocument_IdAndStatus_CodeInAndIdNot(
                documentId,
                remainingLifecycleStatuses,
                cancelledRevision.getId()
        );
        if (hasRemainingRevision) {
            return false;
        }

        DocumentRecord document = requireDocument(documentId);
        String fromStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        if ("CLOSED_CANCELLED".equalsIgnoreCase(fromStatus)) {
            return false;
        }

        DocumentStatusDefinition closedCancelledStatus = requireDocumentStatus("CLOSED_CANCELLED");
        Instant cancelledAt = Instant.now();
        document.setStatus(closedCancelledStatus);
        document.setCancelledBy(currentUser);
        document.setCancelledAt(cancelledAt);
        document.setOpenedBy(currentUser);
        document.setLastModifiedBy(currentUser);
        documentRepository.save(document);

        String cancelledAtText = DateTimeFormatUtils.formatDateTime(cancelledAt);
        String reasonText = firstNonBlank(cancelReason, "Last revision cancelled; document closed.");
        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                document.getId(),
                "CANCEL",
                fromStatus,
                "CLOSED_CANCELLED",
                "Last revision cancelled; document automatically closed because no revisions remain. Reason: " + reasonText,
                List.of(
                        new AuditTrailChangeResponse("status", firstNonBlank(fromStatus, "-"), "CLOSED_CANCELLED"),
                        new AuditTrailChangeResponse("cancelledBy", "-", currentUser.getFullName()),
                        new AuditTrailChangeResponse("cancelledAt", "-", cancelledAtText),
                        new AuditTrailChangeResponse("openedBy", "-", currentUser.getFullName()),
                        new AuditTrailChangeResponse("lastModifiedBy", "-", currentUser.getFullName()),
                        new AuditTrailChangeResponse("reason", "-", reasonText),
                        new AuditTrailChangeResponse("remainingRevisionCount", String.valueOf(1), "0")
                ),
                signatureSessionId
        );
        return true;
    }

    private void publishRevisionRecord(
            DocumentRevisionRecord revision,
            UserAccount currentUser,
            Instant publishedAt,
            String comment,
            UUID signatureSessionId,
            String signatureToken
    ) {
        String fromStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        String promotedVersion = promoteToNextMajorVersion(revision.getRevisionNumber());
        LocalDate effectiveDate = calculateEffectiveDate(revision, publishedAt);
        Integer periodicReviewCycle = revision.getPeriodicReviewCycle() != null
                ? revision.getPeriodicReviewCycle()
                : (revision.getDocument() == null ? null : revision.getDocument().getPeriodicReviewCycle());
        LocalDate validUntil = calculateValidUntil(effectiveDate, periodicReviewCycle, revision.getValidUntil());
        LocalDate reviewDate = revision.getDocument() == null ? null : revision.getDocument().getReviewDate();
        revision.setRevisionNumber(promotedVersion);
        revision.setRevisionName(buildRevisionName(
                revision.getDocument() == null ? revision.getDocumentName() : revision.getDocument().getDocumentName(),
                promotedVersion
        ));
        revision.setStatus(requireRevisionStatus("EFFECTIVE"));
        revision.setPublishedBy(currentUser);
        revision.setPublishedAt(publishedAt);
        revision.setEffectiveDate(effectiveDate);
        revision.setValidUntil(validUntil);
        revision.setOpenedBy(currentUser);
        revisionRepository.save(revision);

        DocumentRecord document = requireDocument(revision.getDocument().getId());
        String documentFromStatus = document.getStatus() == null ? null : document.getStatus().getCode();
        document.setVersion(promotedVersion);
        document.setEffectiveDate(effectiveDate);
        document.setValidUntil(validUntil);
        document.setReviewDate(reviewDate);
        document.setStatus(requireDocumentStatus("ACTIVE"));
        document.setOpenedBy(currentUser);
        documentRepository.save(document);
        auditTrailService.logAs(
                currentUser,
                "DOCUMENT",
                document.getDocumentNumber() + " - " + document.getDocumentName(),
                document.getId(),
                "PUBLISH",
                documentFromStatus,
                "ACTIVE",
                "Document Master updated after revision publish.",
                List.of(
                        new AuditTrailChangeResponse("effectiveDate", "-", DateTimeFormatUtils.formatDate(effectiveDate)),
                        new AuditTrailChangeResponse("effectiveDateRule", "-", describeEffectiveDateRule(revision, publishedAt)),
                        new AuditTrailChangeResponse("validUntil", "-", DateTimeFormatUtils.formatDate(validUntil)),
                        new AuditTrailChangeResponse("reviewDate", "-", DateTimeFormatUtils.formatDate(reviewDate)),
                        new AuditTrailChangeResponse("currentRevision", "-", promotedVersion)
                ),
                signatureSessionId
        );

        List<DocumentRevisionRecord> supersededRevisions = revisionRepository.findAllByDocument_IdAndStatus_Code(document.getId(), "EFFECTIVE")
                .stream()
                .filter(item -> !Objects.equals(item.getId(), revision.getId()))
                .toList();
        for (DocumentRevisionRecord supersededRevision : supersededRevisions) {
            String previousStatus = supersededRevision.getStatus() == null ? null : supersededRevision.getStatus().getCode();
            supersededRevision.setStatus(requireRevisionStatus("OBSOLETED"));
            supersededRevision.setObsoletedBy(currentUser);
            supersededRevision.setObsoletedAt(publishedAt);
            revisionRepository.save(supersededRevision);

            controlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(
                    supersededRevision,
                    currentUser,
                    publishedAt,
                    ControlledCopyLifecycleObsolescenceService.REASON_NEW_REVISION_PUBLISHED,
                    "Controlled Copy Auto Obsoleted By New Revision; Reason: NEW_REVISION_PUBLISHED; Superseded by published revision " + promotedVersion,
                    signatureSessionId
            );

            recordRevisionHistory(
                    supersededRevision,
                    "OBSOLETE",
                    previousStatus,
                    "OBSOLETED",
                    "Superseded by published revision " + promotedVersion,
                    currentUser,
                    signatureSessionId
            );
        }

        recordRevisionHistory(
                revision,
                "PUBLISH",
                fromStatus,
                "EFFECTIVE",
                comment,
                currentUser,
                signatureSessionId
        );
        electronicSignatureService.createRevisionSignature(
                revision,
                currentUser,
                signatureToken,
                "PUBLISHED",
                comment,
                comment,
                fromStatus,
                "EFFECTIVE",
                revision.getSourceFileChecksum(),
                revision.getSourceFileChecksum()
        );
    }

    private void ensureRelatedDocumentsEffectiveForUpgrade(DocumentRecord document) {
        List<DocumentRelation> relatedRelations = documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "RELATED");
        for (DocumentRelation relation : relatedRelations) {
            DocumentRecord relatedDocument = relation.getTargetDocument();
            if (relatedDocument == null || relatedDocument.getId() == null) {
                continue;
            }
            DocumentRevisionRecord latestRelatedRevision = revisionRepository
                    .findFirstByDocument_IdOrderByCreatedAtDesc(relatedDocument.getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Related document " + safeDocumentLabel(relatedDocument) + " has no revision"
                    ));
            String relatedStatus = latestRelatedRevision.getStatus() == null ? null : latestRelatedRevision.getStatus().getCode();
            if (!Objects.equals(relatedStatus, "EFFECTIVE")) {
                throw new IllegalStateException(
                        "Revision can only be upgraded when all related documents are Effective. Related document "
                                + safeDocumentLabel(relatedDocument)
                                + " is currently "
                                + (latestRelatedRevision.getStatus() == null ? "unknown" : latestRelatedRevision.getStatus().getLabel())
                );
            }
        }
    }

    private String safeDocumentLabel(DocumentRecord document) {
        if (document == null) {
            return "Unknown document";
        }
        if (StringUtils.hasText(document.getDocumentNumber()) && StringUtils.hasText(document.getDocumentName())) {
            return document.getDocumentNumber() + " - " + document.getDocumentName();
        }
        if (StringUtils.hasText(document.getDocumentNumber())) {
            return document.getDocumentNumber();
        }
        if (StringUtils.hasText(document.getDocumentName())) {
            return document.getDocumentName();
        }
        return "Unknown document";
    }

    private void requireRevisionStatus(DocumentRevisionRecord revision, String expectedStatus) {
        String currentStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (!Objects.equals(expectedStatus, currentStatus)) {
            throw new RevisionLifecycleConflictException(
                    "REVISION_WRONG_STATUS",
                    "Revision must be in " + expectedStatus + " state"
            );
        }
    }

    /**
     * A Draft revision whose Author already signed COMPLETE_AUTHORING (editingStatus=="COMPLETED")
     * must not have its metadata/participants silently mutated anymore -- status alone stays "DRAFT"
     * at that point (completeEditing() never advances it), so requireRevisionStatus(revision,
     * "DRAFT") alone is not sufficient to block edits after authoring is complete.
     */
    private void requireRevisionNotCompletedEditing(DocumentRevisionRecord revision) {
        if ("COMPLETED".equals(revision.getEditingStatus())) {
            throw new RevisionLifecycleConflictException(
                    "REVISION_EDITING_ALREADY_COMPLETED",
                    "Revision editing has already been completed and can no longer be modified"
            );
        }
    }

    /**
     * storageItemId/storageDriveId/etc. are Office-Online/Microsoft-Graph-specific -- present only
     * when the revision was opened via Edit Online, null for a source file uploaded directly. A
     * non-blank sourceStorageObjectKey/filePath alone is not proof the object still exists and is
     * readable (deleted object, corrupted path, storage outage) -- so this reuses
     * {@link #resolveRevisionSourceFile}, the same helper {@code refreshPreviewFromUploadedFile}
     * relies on, which actually materializes the object from storage and confirms it exists on
     * disk before Complete Editing is allowed to proceed.
     */
    private void requireRevisionSourceFile(DocumentRevisionRecord revision) {
        requireRevisionSourceFile(revision, "Complete Editing");
    }

    /**
     * {@code action} names what the user was trying to do so the message tells them what to fix, rather than a
     * generic "Complete Editing ..." text that is wrong when the check is used for viewing.
     */
    private void requireRevisionSourceFile(DocumentRevisionRecord revision, String action) {
        Path sourcePath = resolveRevisionSourceFile(revision);
        if (sourcePath == null || !Files.exists(sourcePath)) {
            String revisionLabel = revision == null || !StringUtils.hasText(revision.getRevisionNumber())
                    ? "This revision" : "Revision " + revision.getRevisionNumber();
            throw new RevisionLifecycleConflictException("REVISION_SOURCE_FILE_REQUIRED",
                    "Cannot " + action.toLowerCase() + ": " + revisionLabel + " has no Word (.docx) file yet. "
                            + "Upload the file to this revision first (Edit Revision > Upload / Replace file), then try again.");
        }
    }

    /**
     * Effective Date = basis event + N calendar days, both set in Settings > Document Properties.
     * Basis: the last Approver's approval (default), the training completion date, or the DCO
     * publishing. The DCO being away therefore never has to delay a document that the configuration
     * says becomes effective at approval. When the configured basis has no value for this revision
     * (e.g. no training, or an imported revision without approvals) it falls back approval -> publish.
     */
    private LocalDate calculateEffectiveDate(DocumentRevisionRecord revision, Instant publishedAt) {
        return resolveEffectiveDate(revision, publishedAt).date();
    }

    private String describeEffectiveDateRule(DocumentRevisionRecord revision, Instant publishedAt) {
        EffectiveDateResolution resolution = resolveEffectiveDate(revision, publishedAt);
        String basis = switch (resolution.basis()) {
            case SystemConfigurationService.EFFECTIVE_DATE_AFTER_TRAINING -> "training completion";
            case SystemConfigurationService.EFFECTIVE_DATE_AFTER_PUBLISH -> "publish";
            default -> "approval";
        };
        return resolution.offsetDays() + " day(s) after " + basis;
    }

    private record EffectiveDateResolution(LocalDate date, String basis, int offsetDays) {}

    private EffectiveDateResolution resolveEffectiveDate(DocumentRevisionRecord revision, Instant publishedAt) {
        String configuredBasis = systemConfigurationService.getEffectiveDateBasis();
        int offsetDays = systemConfigurationService.getEffectiveDateOffsetDays();

        LocalDate approvalDate = null;
        if (revision != null && revision.getId() != null) {
            approvalDate = revisionWorkflowParticipantRepository
                    .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER")
                    .stream()
                    .filter(participant -> "APPROVED".equalsIgnoreCase(participant.getActionStatus()))
                    .map(RevisionWorkflowParticipant::getActedAt)
                    .filter(java.util.Objects::nonNull)
                    .max(java.util.Comparator.naturalOrder())
                    .map(instant -> instant.atZone(SYSTEM_ZONE).toLocalDate())
                    .orElse(null);
        }
        LocalDate trainingDate = revision != null && revision.isRequiresTraining() ? revision.getTrainingCompletionDate() : null;
        LocalDate publishDate = (publishedAt == null ? Instant.now() : publishedAt).atZone(SYSTEM_ZONE).toLocalDate();

        LocalDate base = null;
        String usedBasis = null;
        if (SystemConfigurationService.EFFECTIVE_DATE_AFTER_PUBLISH.equals(configuredBasis)) {
            base = publishDate;
            usedBasis = configuredBasis;
        } else if (SystemConfigurationService.EFFECTIVE_DATE_AFTER_TRAINING.equals(configuredBasis) && trainingDate != null) {
            base = trainingDate;
            usedBasis = configuredBasis;
        }
        if (base == null && approvalDate != null) {
            base = approvalDate;
            usedBasis = SystemConfigurationService.EFFECTIVE_DATE_AFTER_APPROVAL;
        }
        if (base == null) {
            base = publishDate;
            usedBasis = SystemConfigurationService.EFFECTIVE_DATE_AFTER_PUBLISH;
        }
        return new EffectiveDateResolution(base.plusDays(offsetDays), usedBasis, offsetDays);
    }

    private LocalDate calculateValidUntil(LocalDate effectiveDate, Integer periodicReviewCycleMonths, LocalDate fallbackValidUntil) {
        if (effectiveDate == null) {
            return fallbackValidUntil;
        }
        if (periodicReviewCycleMonths != null && periodicReviewCycleMonths > 0) {
            return effectiveDate.plusMonths(periodicReviewCycleMonths.longValue());
        }
        return fallbackValidUntil;
    }

    private boolean hasParticipants(DocumentRevisionRecord revision, String participantType) {
        return countParticipants(revision, participantType) > 0;
    }

    private long countParticipants(DocumentRevisionRecord revision, String participantType) {
        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType)
                .size();
    }

    private long countParticipantsByStatus(DocumentRevisionRecord revision, String participantType, String status) {
        return revisionWorkflowParticipantRepository.countByRevision_IdAndParticipantTypeAndActionStatus(
                revision.getId(),
                participantType,
                status
        );
    }

    private UUID requireValidSignatureToken(RevisionWorkflowActionRequest request, UserAccount currentUser, String actionName) {
        if (request == null || !StringUtils.hasText(request.signatureToken())) {
            throw new IllegalArgumentException("Electronic signature is required for " + actionName);
        }
        return signatureTokenConsumptionService.requireAndConsume(request.signatureToken(), currentUser);
    }

    private UUID resolveSignatureSessionId(RevisionWorkflowActionRequest request, UserAccount currentUser) {
        if (request == null || !StringUtils.hasText(request.signatureToken())) {
            return null;
        }
        return tokenService.parseSignatureToken(request.signatureToken())
                .filter(parsed -> Objects.equals(parsed.principal().userId(), currentUser.getId()))
                .map(parsed -> parsed.principal().sessionId())
                .orElse(null);
    }

    private void recordElectronicSignature(
            DocumentRevisionRecord revision,
            UserAccount currentUser,
            RevisionWorkflowActionRequest request,
            String meaning,
            String fromStatus,
            String toStatus
    ) {
        electronicSignatureService.createRevisionSignature(
                revision,
                currentUser,
                request == null ? null : request.signatureToken(),
                meaning,
                request == null ? null : request.reason(),
                request == null ? null : request.comment(),
                fromStatus,
                toStatus,
                revision == null ? null : revision.getSourceFileChecksum(),
                revision == null ? null : revision.getSourceFileChecksum()
        );
    }

    private RevisionWorkflowParticipant requirePendingParticipant(DocumentRevisionRecord revision, String participantType, UserAccount currentUser) {
        RevisionWorkflowParticipant participant = revisionWorkflowParticipantRepository
                .findByRevision_IdAndParticipantTypeAndUser_Id(revision.getId(), participantType, currentUser.getId())
                .orElseThrow(() -> new AccessDeniedException("Current user is not assigned as " + participantType.toLowerCase(Locale.ROOT)));
        if (!"PENDING".equalsIgnoreCase(participant.getActionStatus())) {
            throw new RevisionLifecycleConflictException(
                    "REVISION_ACTION_ALREADY_COMPLETED",
                    "This workflow action has already been completed"
            );
        }
        // Separation of duties at action time (assignment already forbids it): the person who wrote a
        // revision must never approve it, even if the Author was changed after the Approver was set.
        if ("APPROVER".equalsIgnoreCase(participantType)) {
            boolean isAuthor = revision.getAuthor() != null && Objects.equals(revision.getAuthor().getId(), currentUser.getId());
            boolean isCoAuthor = revisionWorkflowParticipantRepository
                    .findByRevision_IdAndParticipantTypeAndUser_Id(revision.getId(), "CO_AUTHOR", currentUser.getId())
                    .isPresent();
            if (isAuthor || isCoAuthor) {
                throw new AccessDeniedException("The Author or a Co-Author of a revision cannot approve it");
            }
        }
        // Mutation-time re-check mirroring RevisionWorkflowAuthorizationService#isPendingReviewer/
        // isPendingApprover's read-time gate -- skipped entirely when Document Properties'
        // Parallel Review/Approval is enabled, letting any PENDING participant of that type act in
        // any order. Shared rule: SystemConfigurationService#isSequenceEnforcedForParticipantType --
        // unless the revision froze its own mode when it was submitted, which then wins so a
        // later change of that setting cannot alter a review already in flight.
        Boolean frozenSequence = ReviewFlowMode.sequenceEnforcedOrNull(participantType, revision.getReviewFlowMode());
        boolean sequenceEnforced = frozenSequence != null
                ? frozenSequence
                : systemConfigurationService.isSequenceEnforcedForParticipantType(participantType);
        if (sequenceEnforced) {
            RevisionWorkflowParticipant nextPending = nextPendingParticipant(revision, participantType).orElse(null);
            if (nextPending != null && !Objects.equals(nextPending.getId(), participant.getId())) {
                throw new IllegalStateException(participantTypeLabel(participantType) + " action must be completed according to the configured sequence");
            }
        }
        return participant;
    }

    private Optional<RevisionWorkflowParticipant> nextPendingParticipant(DocumentRevisionRecord revision, String participantType) {
        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType)
                .stream()
                .filter(participant -> "PENDING".equalsIgnoreCase(participant.getActionStatus()))
                .findFirst();
    }

    private String participantTypeLabel(String participantType) {
        if ("APPROVER".equalsIgnoreCase(participantType)) {
            return "Approval";
        }
        if ("REVIEWER".equalsIgnoreCase(participantType)) {
            return "Review";
        }
        return "Workflow";
    }

    private void markParticipantAction(
            RevisionWorkflowParticipant participant,
            String actionStatus,
            RevisionWorkflowActionRequest request,
            UUID signatureSessionId
    ) {
        participant.setActionStatus(actionStatus);
        participant.setActionComment(firstNonBlank(
                request == null ? null : request.comment(),
                request == null ? null : request.reason()
        ));
        participant.setActedAt(Instant.now());
        participant.setSignatureSessionId(signatureSessionId);
    }

    private void resetParticipantActions(DocumentRevisionRecord revision, String participantType) {
        List<RevisionWorkflowParticipant> participants = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType);
        if (participants.isEmpty()) {
            return;
        }
        participants.forEach(participant -> {
            participant.setActionStatus("PENDING");
            participant.setActionComment(null);
            participant.setActedAt(null);
            participant.setSignatureSessionId(null);
            participant.setLastRemindedAt(null);
            participant.setEscalatedAt(null);
        });
        revisionWorkflowParticipantRepository.saveAll(participants);
    }

    private void clearDraftReviewSnapshot(DocumentRevisionRecord revision) {
        if (revision == null) {
            return;
        }
        revision.setPreviewFilePath(null);
        revision.setStoragePdfUrl(null);
    }

    private RevisionDetailResponse updateRevisionStatus(
            DocumentRevisionRecord revision,
            String actionType,
            String targetStatus,
            RevisionWorkflowActionRequest request,
            UserAccount currentUser
    ) {
        String fromStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        revision.setStatus(requireRevisionStatus(targetStatus));
        revision.setOpenedBy(currentUser);
        DocumentRecord document = revision.getDocument();
        if (document != null) {
            document.setOpenedBy(currentUser);
            documentRepository.save(document);
        }
        revisionRepository.save(revision);
        UUID signatureSessionId = resolveSignatureSessionId(request, currentUser);
        if ("OBSOLETED".equalsIgnoreCase(targetStatus)) {
            controlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(
                    revision,
                    currentUser,
                    Instant.now(),
                    ControlledCopyLifecycleObsolescenceService.REASON_REVISION_OBSOLETED,
                    "Controlled Copy Auto Obsoleted By Revision Obsolete; Reason: REVISION_OBSOLETED",
                    signatureSessionId
            );
        }
        recordRevisionHistory(
                revision,
                actionType,
                fromStatus,
                targetStatus,
                request == null ? null : firstNonBlank(request.comment(), request.reason()),
                currentUser,
                signatureSessionId
        );
        dispatchRevisionNotification(revision, actionType, targetStatus, request, currentUser);
        return toDetailResponse(revision);
    }

    // Optional: never blocks a publish, and keeps constructors used by unit tests valid.
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private KnowledgePortalService knowledgePortalService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private NotificationDispatcher knowledgeNotificationDispatcher;

    /** Tells the people subscribed to the document's Knowledge Base that a new Effective version exists. */
    private void notifyKnowledgeSubscribers(DocumentRevisionRecord revision) {
        if (knowledgePortalService == null || knowledgeNotificationDispatcher == null
                || revision == null || revision.getDocument() == null) {
            return;
        }
        try {
            DocumentRecord document = revision.getDocument();
            List<UserAccount> recipients = knowledgePortalService.subscribersOf(document).stream()
                    .map(userAccountRepository::findById)
                    .flatMap(Optional::stream)
                    .filter(user -> user.getStatus() == UserStatus.Active)
                    .toList();
            if (recipients.isEmpty()) {
                return;
            }
            Map<String, String> variables = new HashMap<>();
            variables.put("documentNumber", Objects.toString(document.getDocumentNumber(), ""));
            variables.put("documentTitle", Objects.toString(document.getDocumentName(), ""));
            variables.put("revisionNumber", Objects.toString(revision.getRevisionNumber(), ""));
            variables.put("knowledgeBase", Objects.toString(document.getKnowledgeBase(), ""));
            variables.put("actionUrl", "/self-service/knowledge");
            knowledgeNotificationDispatcher.dispatch("knowledge.document_published", recipients, variables);
        } catch (Exception ex) {
            log.warn("Knowledge subscriber notification failed for revision {}", revision.getId(), ex);
        }
    }

    // obsoleteDistributedControlledCopies(...) retired per TBR-DOC-014: both call sites above now
    // invoke the canonical ControlledCopyLifecycleObsolescenceService.obsoleteControlledCopiesForRevision(...)
    // instead of this (formerly duplicated) private implementation.

    private void dispatchRevisionNotification(
            DocumentRevisionRecord revision,
            String actionType,
            String targetStatus,
            RevisionWorkflowActionRequest request,
            UserAccount actor
    ) {
        if (revision == null || revision.getDocument() == null) {
            return;
        }

        List<UserAccount> recipients = new ArrayList<>();
        String templateType = null;
        String comment = firstNonBlank(request == null ? null : request.comment(), request == null ? null : request.reason());

        if ("SUBMIT_FOR_REVIEW".equalsIgnoreCase(actionType)) {
            if ("PENDING_REVIEW".equalsIgnoreCase(targetStatus)) {
                templateType = "document-review";
                recipients.addAll(reviewersToNotify(revision, true));
            } else if ("PENDING_APPROVAL".equalsIgnoreCase(targetStatus)) {
                templateType = "document-approval";
                nextPendingParticipant(revision, "APPROVER")
                        .map(RevisionWorkflowParticipant::getUser)
                        .ifPresent(recipients::add);
            } else if ("PENDING_TRAINING".equalsIgnoreCase(targetStatus) || "READY_FOR_PUBLISHING".equalsIgnoreCase(targetStatus)) {
                templateType = "training-notification";
                recipients.addAll(getRevisionStakeholders(revision));
            }
        } else if ("REVIEW_COMPLETE".equalsIgnoreCase(actionType) && "PENDING_REVIEW".equalsIgnoreCase(targetStatus)) {
            templateType = "document-review";
            recipients.addAll(reviewersToNotify(revision, false));
        } else if ("REVIEW_COMPLETE".equalsIgnoreCase(actionType) && "PENDING_APPROVAL".equalsIgnoreCase(targetStatus)) {
            templateType = "document-approval";
            nextPendingParticipant(revision, "APPROVER")
                    .map(RevisionWorkflowParticipant::getUser)
                    .ifPresent(recipients::add);
        } else if ("APPROVE_COMPLETE".equalsIgnoreCase(actionType) && "PENDING_APPROVAL".equalsIgnoreCase(targetStatus)) {
            templateType = "document-approval";
            nextPendingParticipant(revision, "APPROVER")
                    .map(RevisionWorkflowParticipant::getUser)
                    .ifPresent(recipients::add);
        } else if ("REVIEW_REJECT".equalsIgnoreCase(actionType) || "APPROVE_REJECT".equalsIgnoreCase(actionType)) {
            templateType = "REVIEW_REJECT".equalsIgnoreCase(actionType)
                    ? EmailTemplateTypeUtils.DOCUMENT_REVIEW_REJECTED_NOTIFICATION
                    : EmailTemplateTypeUtils.DOCUMENT_APPROVAL_REJECTED_NOTIFICATION;
            recipients.addAll(rejectionRecipients(revision, actor));
        } else if ("APPROVE_COMPLETE".equalsIgnoreCase(actionType)) {
            if ("PENDING_TRAINING".equalsIgnoreCase(targetStatus)) {
                templateType = "training-notification";
                recipients.addAll(getRevisionStakeholders(revision));
            } else if ("READY_FOR_PUBLISHING".equalsIgnoreCase(targetStatus)) {
                templateType = EmailTemplateTypeUtils.DOCUMENT_READY_FOR_PUBLISHING_NOTIFICATION;
                recipients.addAll(getWorkflowCoordinatorRecipients(revision));
            }
        } else if ("TRAINING_COMPLETE".equalsIgnoreCase(actionType)) {
            if ("READY_FOR_PUBLISHING".equalsIgnoreCase(targetStatus)) {
                templateType = EmailTemplateTypeUtils.DOCUMENT_READY_FOR_PUBLISHING_NOTIFICATION;
                recipients.addAll(getWorkflowCoordinatorRecipients(revision));
            }
        } else if ("PUBLISH".equalsIgnoreCase(actionType)) {
            templateType = "document-publish";
            recipients.addAll(getRevisionStakeholders(revision));
        }

        if (!StringUtils.hasText(templateType) || recipients.isEmpty()) {
            return;
        }

        DocumentRecord document = revision.getDocument();
        recipients = recipients.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        for (UserAccount recipient : recipients) {
            sendRevisionNotification(revision, document, recipient, templateType, actionType, targetStatus, actor, comment);
        }
    }

    private void sendRevisionNotification(
            DocumentRevisionRecord revision,
            DocumentRecord document,
            UserAccount recipient,
            String templateType,
            String actionType,
            String targetStatus,
            UserAccount actor,
            String comment
    ) {
        {
            Map<String, String> overrides = new HashMap<>();
            overrides.put("documentTitle", document.getDocumentName() == null ? "" : document.getDocumentName());
            overrides.put("documentNumber", document.getDocumentNumber() == null ? "" : document.getDocumentNumber());
            overrides.put("documentStatus", revision.getStatus() == null ? "" : revision.getStatus().getCode());
            overrides.put("revisionNumber", revision.getRevisionNumber() == null ? "" : revision.getRevisionNumber());
            overrides.put("revisionStatus", revision.getStatus() == null ? "" : revision.getStatus().getCode());
            overrides.put("relatedEntityType", "revision");
            overrides.put("relatedEntityId", revision.getId() == null ? "" : revision.getId().toString());
            overrides.put("relatedEntityTitle", firstNonBlank(revision.getRevisionName(), revision.getDocumentName(), document.getDocumentName(), ""));
            overrides.put("actionUrl", resolveRevisionWorkflowActionUrl(templateType, revision));
            String notificationEventCode = resolveDocumentNotificationPolicyEvent(actionType, targetStatus);
            if (notificationEventCode != null) {
                overrides.put("notificationEventCode", notificationEventCode);
            }
            if (isAssignmentOrRejectionNotification(templateType)) {
                // Someone has to act, or must learn their work was sent back -- a personal
                // preference must not be able to silence that (see NotificationEventCatalogBootstrap).
                overrides.put("notificationMandatory", "true");
            }
            Map<String, String> variables = emailNotificationService.buildDocumentVariables(
                    document,
                    revision,
                    actor,
                    recipient,
                    actionType,
                    comment,
                    overrides
            );
            emailNotificationService.sendDocumentWorkflowNotification(templateType, List.of(recipient), variables);
        }
    }

    /**
     * Document Control reassigns a pending Reviewer/Approver whose account is no longer usable
     * (Suspended/Terminated/Inactive). Only that situation is allowed: swapping an available
     * assignee would let Document Control steer a review. Requires the DCO permission and a valid
     * e-signature session; the change is audited and the new assignee is notified.
     */
    @Transactional
    public RevisionDetailResponse replaceWorkflowParticipant(UUID revisionId, ReplaceWorkflowParticipantRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(actor, "documents.workspace.manage")) {
            throw new AccessDeniedException("Only Document Control can replace a workflow participant");
        }
        if (request == null || request.fromUserId() == null || request.toUserId() == null
                || !StringUtils.hasText(request.participantType()) || !StringUtils.hasText(request.reason())) {
            throw new IllegalArgumentException("Participant type, current user, new user and a reason are required");
        }
        String type = request.participantType().trim().toUpperCase(Locale.ROOT);
        if (!"REVIEWER".equals(type) && !"APPROVER".equals(type)) {
            throw new IllegalArgumentException("Only a Reviewer or an Approver can be replaced");
        }
        DocumentRevisionRecord revision = requireRevisionForUpdate(revisionId);
        String status = revision.getStatus() == null ? "" : revision.getStatus().getCode();
        String expectedStatus = "REVIEWER".equals(type) ? "PENDING_REVIEW" : "PENDING_APPROVAL";
        if (!expectedStatus.equals(status)) {
            throw new RevisionLifecycleConflictException("REVISION_STATE_CHANGED",
                    "This revision is now '" + status + "', so the " + type.toLowerCase(Locale.ROOT) + " can no longer be replaced.");
        }
        requireValidSignatureToken(new RevisionWorkflowActionRequest(request.reason(), request.reason(), request.signatureToken()), actor, "participant replacement");

        RevisionWorkflowParticipant participant = revisionWorkflowParticipantRepository
                .findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, type, request.fromUserId())
                .orElseThrow(() -> new IllegalArgumentException("The selected user is not assigned as " + type.toLowerCase(Locale.ROOT) + " on this revision"));
        if (!"PENDING".equalsIgnoreCase(participant.getActionStatus())) {
            throw new RevisionLifecycleConflictException("REVISION_ACTION_ALREADY_COMPLETED",
                    "This assignment has already been completed and cannot be replaced");
        }
        UserAccount from = participant.getUser();
        if (from != null && from.getStatus() == UserStatus.Active) {
            throw new RevisionLifecycleConflictException("ASSIGNEE_STILL_ACTIVE", "The current " + type.toLowerCase(Locale.ROOT)
                    + " is still an active user. Only an assignee who is suspended, terminated or inactive can be replaced.");
        }
        UserAccount to = userAccountRepository.findById(request.toUserId())
                .orElseThrow(() -> new IllegalArgumentException("Replacement user not found"));
        if (to.getStatus() != UserStatus.Active) {
            throw new IllegalArgumentException("The replacement user must be an active user");
        }
        workflowParticipantEligibilityService.requirePoolMembership(type, to);
        for (String existingType : List.of("CO_AUTHOR", "REVIEWER", "APPROVER")) {
            if (revisionWorkflowParticipantRepository
                    .findByRevision_IdAndParticipantTypeAndUser_Id(revisionId, existingType, to.getId()).isPresent()) {
                throw new IllegalArgumentException("The replacement user already has a role on this revision");
            }
        }
        UserAccount author = revision.getAuthor() != null ? revision.getAuthor()
                : (revision.getDocument() == null ? null : revision.getDocument().getAuthor());
        if (author != null && Objects.equals(author.getId(), to.getId())) {
            throw new IllegalArgumentException("The Author cannot be a " + type.toLowerCase(Locale.ROOT) + " of the same revision");
        }

        participant.setUser(to);
        revisionWorkflowParticipantRepository.save(participant);

        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                "revision_workflow_participants", participant.getId(), revision.getRevisionName(),
                actor, request.signatureToken(), "WORKFLOW_AUTHORIZATION_CHANGE", request.reason(), null,
                from == null ? null : from.getUsername(), to.getUsername());
        auditTrailService.logAs(actor, "REVISION", revision.getRevisionName(), revision.getId(),
                "WORKFLOW_PARTICIPANT_REPLACED", status, status,
                type + " " + (from == null ? "?" : from.getUsername()) + " replaced by " + to.getUsername()
                        + ". Reason: " + request.reason(),
                List.of(new AuditTrailChangeResponse(participantTypeLabel(type),
                        from == null ? "-" : firstNonBlank(from.getFullName(), from.getUsername()),
                        firstNonBlank(to.getFullName(), to.getUsername()))),
                signature == null ? null : signature.getId());

        DocumentRecord document = revision.getDocument();
        if (document != null) {
            sendRevisionNotification(revision, document, to,
                    "REVIEWER".equals(type) ? "document-review" : "document-approval",
                    "REVIEWER".equals(type) ? "REVIEWER_REPLACED" : "APPROVER_REPLACED", status, actor, request.reason());
        }
        return getRevision(revisionId);
    }

    private String resolveRevisionWorkflowActionUrl(String templateType, DocumentRevisionRecord revision) {
        if (revision == null || revision.getId() == null) {
            return "";
        }
        String id = revision.getId().toString();
        String normalizedType = templateType == null ? "" : templateType.trim().toLowerCase(Locale.ROOT);
        if ("document-review".equals(normalizedType)) {
            return "/documents/revisions/review/" + id;
        }
        if ("document-approval".equals(normalizedType)) {
            return "/documents/revisions/approval/" + id;
        }
        if ("training-notification".equals(normalizedType)) {
            return "/documents/revisions/training/" + id;
        }
        return "/documents/revisions/" + id;
    }

    private String resolveDocumentNotificationPolicyEvent(String actionType, String targetStatus) {
        String action = actionType == null ? "" : actionType.trim().toUpperCase(Locale.ROOT);
        String status = targetStatus == null ? "" : targetStatus.trim().toUpperCase(Locale.ROOT);
        if ("SUBMIT_FOR_REVIEW".equals(action) && "PENDING_REVIEW".equals(status)) {
            return "document.submitted_for_review";
        }
        if ("REVIEW_COMPLETE".equals(action) && "PENDING_APPROVAL".equals(status)) {
            return "document.review_completed";
        }
        if ("APPROVE_COMPLETE".equals(action)
                && ("PENDING_TRAINING".equals(status) || "READY_FOR_PUBLISHING".equals(status))) {
            return "document.approved";
        }
        if ("PUBLISH".equals(action)) {
            return "document.published";
        }
        if ("REVIEWER_REPLACED".equals(action)) {
            return "document.submitted_for_review";
        }
        if ("REVIEW_REJECT".equals(action)) {
            return "document.review_rejected";
        }
        if ("APPROVE_REJECT".equals(action)) {
            return "document.approval_rejected";
        }
        return null;
    }

    private static boolean isAssignmentOrRejectionNotification(String templateType) {
        return "document-review".equals(templateType)
                || "document-approval".equals(templateType)
                || EmailTemplateTypeUtils.DOCUMENT_REVIEW_REJECTED_NOTIFICATION.equals(templateType)
                || EmailTemplateTypeUtils.DOCUMENT_APPROVAL_REJECTED_NOTIFICATION.equals(templateType);
    }

    /** True when this revision's Reviewers may act in any order (frozen at submit; falls back to
     *  the live Document Properties switch for revisions submitted before the mode was recorded). */
    private boolean isParallelReview(DocumentRevisionRecord revision) {
        Boolean sequenceEnforced = ReviewFlowMode.sequenceEnforcedOrNull("REVIEWER", revision.getReviewFlowMode());
        return sequenceEnforced != null ? !sequenceEnforced : systemConfigurationService.isParallelReviewEnabled();
    }

    /**
     * Who must be told a review step is now open. Sequential: only the next Reviewer in line.
     * Parallel: every Reviewer can act from the moment of submission, so all of them are told then
     * -- and nobody is re-notified as their peers finish, since they are already free to act.
     */
    private List<UserAccount> reviewersToNotify(DocumentRevisionRecord revision, boolean justSubmitted) {
        if (!isParallelReview(revision)) {
            return nextPendingParticipant(revision, "REVIEWER")
                    .map(RevisionWorkflowParticipant::getUser)
                    .map(List::of)
                    .orElse(List.of());
        }
        if (!justSubmitted) {
            return List.of();
        }
        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER")
                .stream()
                .filter(participant -> "PENDING".equalsIgnoreCase(participant.getActionStatus()))
                .map(RevisionWorkflowParticipant::getUser)
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * A Reject sends the revision back to Draft and closes the round for everyone: the Author and
     * Co-Authors must fix it, every Reviewer must know their round ended (they may be mid-review in
     * Word Online, which is being revoked), and Document Control follows up. The rejecting user
     * already knows and is left out.
     */
    private List<UserAccount> rejectionRecipients(DocumentRevisionRecord revision, UserAccount actor) {
        java.util.LinkedHashMap<UUID, UserAccount> byId = new java.util.LinkedHashMap<>();
        java.util.function.Consumer<UserAccount> add = user -> {
            if (user != null && user.getId() != null && (user.getStatus() == null || user.getStatus() == UserStatus.Active)
                    && (actor == null || !user.getId().equals(actor.getId()))) {
                byId.putIfAbsent(user.getId(), user);
            }
        };
        add.accept(revision.getAuthor());
        if (revision.getDocument() != null) {
            add.accept(revision.getDocument().getAuthor());
        }
        getRevisionParticipants(revision, "CO_AUTHOR").forEach(add);
        getRevisionParticipants(revision, "REVIEWER").forEach(add);
        getWorkflowCoordinatorRecipients(revision).forEach(add);
        return new ArrayList<>(byId.values());
    }

    private List<UserAccount> getRevisionParticipants(DocumentRevisionRecord revision, String participantType) {
        return revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType)
                .stream()
                .map(RevisionWorkflowParticipant::getUser)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private List<UserAccount> getWorkflowCoordinatorRecipients(DocumentRevisionRecord revision) {
        if (revision == null || revision.getDocument() == null
                || userAccountRepository == null || permissionEvaluationService == null) {
            return List.of();
        }
        // A workflow coordinator is identified by the canonical entitlement, not a
        // tenant-editable role name or a legacy document participant code. This keeps
        // workflow notifications and live UI updates aligned with the same RBAC rule
        // that authorizes workspace actions.
        return userAccountRepository.findAllByStatus(UserStatus.Active)
                .stream()
                .filter(user -> permissionEvaluationService.hasPermission(user, "documents.workspace.manage"))
                .distinct()
                .toList();
    }

    /**
     * Sends a lightweight SSE event only after the workflow transaction commits.  Clients use
     * the revision id to fetch their own authorised snapshot, so no document data is exposed on
     * the stream and a DCO with the workspace open sees the next action without manually reload.
     */
    private void publishRevisionWorkflowUpdateAfterCommit(DocumentRevisionRecord revision, String workflowAction) {
        if (revision == null || revision.getId() == null) {
            return;
        }
        UUID revisionId = revision.getId();
        List<UUID> recipientIds = getWorkflowCoordinatorRecipients(revision).stream()
                .map(UserAccount::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (recipientIds.isEmpty()) {
            return;
        }

        Runnable publish = () -> recipientIds.forEach(userId -> notificationRealtimeService.publishUserEvent(
                userId,
                "revision-workflow-updated",
                Map.of(
                        "revisionId", revisionId.toString(),
                        "workflowAction", workflowAction,
                        "occurredAt", Instant.now().toString()
                )
        ));
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish.run();
                }
            });
        } else {
            publish.run();
        }
    }

    private List<UserAccount> getRevisionStakeholders(DocumentRevisionRecord revision) {
        List<UserAccount> stakeholders = new ArrayList<>();
        if (revision.getDocument() != null) {
            if (revision.getDocument().getAuthor() != null) {
                stakeholders.add(revision.getDocument().getAuthor());
            }
            stakeholders.addAll(documentWorkflowParticipantRepository.findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getDocument().getId(), "CO_AUTHOR")
                    .stream()
                    .map(DocumentWorkflowParticipant::getUser)
                    .filter(Objects::nonNull)
                    .toList());
            stakeholders.addAll(getRevisionParticipants(revision, "REVIEWER"));
            stakeholders.addAll(getRevisionParticipants(revision, "APPROVER"));
        }
        stakeholders.addAll(getWorkflowCoordinatorRecipients(revision));
        return stakeholders.stream().filter(Objects::nonNull).distinct().toList();
    }

    private void requireCurrentUserCanUploadRevision(DocumentRecord document, UserAccount user) {
        documentAuthorizationService.requireCanUploadRevision(user, document);
    }

    /**
     * Keeps mutation endpoints aligned with the Revision Action Capability API.
     * UI capability responses are advisory; this server-side check is authoritative.
     */
    private void requireRevisionFileAccess(
            UserAccount user,
            DocumentRevisionRecord revision,
            FileAccessAction action
    ) {
        secureFileAccessService.require(
                user,
                action,
                FileObjectType.SOURCE_DOCX,
                revision.getId(),
                FileAccessContext.ofRevision(revision)
        );
    }

    private boolean canCurrentUserEditRevision(DocumentRevisionRecord revision) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        return documentAuthorizationService.canEditDraftRevision(currentUser, revision);
    }

    private boolean canCurrentUserPerformWorkflowAction(
            UserAccount currentUser,
            DocumentRevisionRecord revision,
            RevisionWorkflowAction action
    ) {
        return revisionWorkflowAuthorizationService.check(
                currentUser,
                revision,
                action,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        ).allowed();
    }

    private String csv(String value) {
        return com.eqms.util.CsvSafety.escapeCell(value);
    }

    private Specification<DocumentRevisionRecord> buildSpecification(
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
            boolean ownedByMe,
            boolean pending,
            UserAccount currentUser
    ) {
        return (root, query, cb) -> {
            query.distinct(true);
            List<Predicate> predicates = new ArrayList<>();
            Join<DocumentRevisionRecord, RevisionStatusDefinition> statusJoin = root.join("status", JoinType.LEFT);
            Join<DocumentRevisionRecord, DocumentType> typeJoin = root.join("documentType", JoinType.LEFT);
            Join<DocumentRevisionRecord, BusinessUnit> businessUnitJoin = root.join("businessUnit", JoinType.LEFT);
            Join<DocumentRevisionRecord, Department> departmentJoin = root.join("department", JoinType.LEFT);
            Join<DocumentRevisionRecord, UserAccount> authorJoin = root.join("author", JoinType.LEFT);
            Join<DocumentRevisionRecord, UserAccount> openedByJoin = root.join("openedBy", JoinType.LEFT);
            boolean canViewAll = documentAuthorizationService.canViewAllDocuments(currentUser);

            if (StringUtils.hasText(ids)) {
                List<UUID> parsedIds = parseUuidList(ids);
                if (!parsedIds.isEmpty()) {
                    predicates.add(root.get("id").in(parsedIds));
                }
            }

            if (ownedByMe) {
                UUID currentUserId = currentUser.getId();
                Predicate authorPredicate = cb.equal(authorJoin.get("id"), currentUserId);
                var subquery = query.subquery(UUID.class);
                var participantRoot = subquery.from(RevisionWorkflowParticipant.class);
                subquery.select(participantRoot.get("revision").get("id"));
                subquery.where(
                        cb.equal(participantRoot.get("revision").get("id"), root.get("id")),
                        cb.equal(participantRoot.get("participantType"), "CO_AUTHOR"),
                        cb.equal(participantRoot.get("user").get("id"), currentUserId)
                );
                Predicate coAuthorPredicate = cb.exists(subquery);
                predicates.add(cb.or(authorPredicate, coAuthorPredicate));
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

            if (!pending && !canViewAll) {
                UUID currentUserId = currentUser.getId();
                Predicate authorPredicate = cb.equal(authorJoin.get("id"), currentUserId);
                var coAuthorSubquery = query.subquery(UUID.class);
                var coAuthorRoot = coAuthorSubquery.from(RevisionWorkflowParticipant.class);
                coAuthorSubquery.select(coAuthorRoot.get("revision").get("id"));
                coAuthorSubquery.where(
                        cb.equal(coAuthorRoot.get("revision").get("id"), root.get("id")),
                        cb.equal(coAuthorRoot.get("participantType"), "CO_AUTHOR"),
                        cb.equal(coAuthorRoot.get("user").get("id"), currentUserId)
                );

                var reviewerSubquery = query.subquery(UUID.class);
                var reviewerRoot = reviewerSubquery.from(RevisionWorkflowParticipant.class);
                reviewerSubquery.select(reviewerRoot.get("revision").get("id"));
                reviewerSubquery.where(
                        cb.equal(reviewerRoot.get("revision").get("id"), root.get("id")),
                        cb.equal(reviewerRoot.get("participantType"), "REVIEWER"),
                        cb.equal(reviewerRoot.get("user").get("id"), currentUserId)
                );

                var approverSubquery = query.subquery(UUID.class);
                var approverRoot = approverSubquery.from(RevisionWorkflowParticipant.class);
                approverSubquery.select(approverRoot.get("revision").get("id"));
                approverSubquery.where(
                        cb.equal(approverRoot.get("revision").get("id"), root.get("id")),
                        cb.equal(approverRoot.get("participantType"), "APPROVER"),
                        cb.equal(approverRoot.get("user").get("id"), currentUserId)
                );

                Predicate coAuthorPredicate = cb.exists(coAuthorSubquery);
                Predicate reviewerPredicate = cb.exists(reviewerSubquery);
                Predicate approverPredicate = cb.exists(approverSubquery);
                predicates.add(cb.or(authorPredicate, coAuthorPredicate, reviewerPredicate, approverPredicate));
            }

            if (pending) {
                UUID currentUserId = currentUser.getId();
                predicates.add(statusJoin.get("code").in(List.of("PENDING_REVIEW", "PENDING_APPROVAL")));
                var subquery = query.subquery(UUID.class);
                var participantRoot = subquery.from(RevisionWorkflowParticipant.class);
                subquery.select(participantRoot.get("revision").get("id"));
                subquery.where(
                        cb.equal(participantRoot.get("revision").get("id"), root.get("id")),
                        cb.equal(participantRoot.get("user").get("id"), currentUserId),
                        cb.or(
                                cb.and(
                                        cb.equal(statusJoin.get("code"), "PENDING_REVIEW"),
                                        cb.equal(participantRoot.get("participantType"), "REVIEWER")
                                ),
                                cb.and(
                                        cb.equal(statusJoin.get("code"), "PENDING_APPROVAL"),
                                        cb.equal(participantRoot.get("participantType"), "APPROVER")
                                )
                        )
                );
                predicates.add(cb.exists(subquery));
            }

            addBooleanPredicate(predicates, cb, root.get("hasRelatedDocuments"), relatedDocument);
            addBooleanPredicate(predicates, cb, root.get("hasCorrelatedDocuments"), correlatedDocument);
            addBooleanPredicate(predicates, cb, root.get("template"), isTemplate);
            if (StringUtils.hasText(search)) {
                String pattern = "%" + normalize(search) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("documentNumber")), pattern),
                        cb.like(cb.lower(root.get("documentName")), pattern),
                        cb.like(cb.lower(root.get("revisionName")), pattern),
                        cb.like(cb.lower(root.get("revisionNumber")), pattern),
                        cb.like(cb.lower(typeJoin.get("name")), pattern),
                        cb.like(cb.lower(typeJoin.get("shortCode")), pattern),
                        cb.like(cb.lower(businessUnitJoin.get("name")), pattern),
                        cb.like(cb.lower(businessUnitJoin.get("code")), pattern),
                        cb.like(cb.lower(departmentJoin.get("name")), pattern),
                        cb.like(cb.lower(departmentJoin.get("code")), pattern),
                        cb.like(cb.lower(authorJoin.get("fullName")), pattern),
                        cb.like(cb.lower(authorJoin.get("username")), pattern),
                        cb.like(cb.lower(openedByJoin.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern)
                ));
            }

            addLookupPredicate(predicates, cb, statusJoin.get("code"), statusJoin.get("label"), statusJoin.get("label"), status);
            addLookupPredicate(predicates, cb, typeJoin.get("id"), typeJoin.get("name"), typeJoin.get("shortCode"), documentType);
            addLookupPredicate(predicates, cb, businessUnitJoin.get("id"), businessUnitJoin.get("name"), businessUnitJoin.get("code"), businessUnit);
            addLookupPredicate(predicates, cb, departmentJoin.get("id"), departmentJoin.get("name"), departmentJoin.get("code"), department);

            addCreatedDateRangePredicate(predicates, cb, root.get("createdAt"), createdFrom, createdTo);
            addDateRangePredicate(predicates, cb, root.get("effectiveDate"), effectiveFrom, effectiveTo);
            addDateRangePredicate(predicates, cb, root.get("validUntil"), validFrom, validTo);

        return cb.and(predicates.toArray(Predicate[]::new));
    };
    }

    private void ensureCurrentUserCanViewDocumentRevisions(DocumentRecord document, UserAccount currentUser) {
        documentAuthorizationService.requireCanViewDocumentRevisions(currentUser, document);
    }

    private void ensureCurrentUserCanViewRevision(DocumentRevisionRecord revision, UserAccount currentUser) {
        documentAuthorizationService.requireCanViewRevision(currentUser, revision);
    }

    private boolean canPreviewControlledDocumentTemplate(UserAccount user, DocumentRevisionRecord revision) {
        if (user == null || revision == null || revision.getDocument() == null) {
            return false;
        }
        DocumentRecord document = revision.getDocument();
        if (!document.isTemplate() || document.getStatus() == null
                || !"ACTIVE".equalsIgnoreCase(document.getStatus().getCode())) {
            return false;
        }
        boolean mayUseTemplates = permissionEvaluationService.hasPermission(user, "documents.revision.upload_source");
        if (!mayUseTemplates || !isDocxTemplate(revision)) {
            return false;
        }
        return revisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")
                .map(effective -> Objects.equals(effective.getId(), revision.getId()))
                .orElse(false);
    }

    private List<UUID> parseUuidList(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of();
        }
        List<UUID> result = new ArrayList<>();
        for (String part : value.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                try {
                    result.add(UUID.fromString(trimmed));
                } catch (IllegalArgumentException ignored) {
                    // Skip invalid ids silently; the query still works for valid ones.
                }
            }
        }
        return result;
    }

      private String resolvePreviewType(DocumentRevisionRecord revision) {
          String code = revision.getStatus() == null ? "" : revision.getStatus().getCode();
          return switch (code) {
              case "DRAFT", "CLOSED_CANCELLED", "CANCELLED", "REJECTED" -> "NONE";
              case "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING" ->
                  StringUtils.hasText(revision.getPreviewFilePath()) ? "REVIEW_PDF" : "NONE";
              case "EFFECTIVE", "PUBLISHED", "ACTIVE" -> {
                  boolean hasPublished = publishingMetadataRepository.findByRevision_Id(revision.getId())
                          .map(m -> StringUtils.hasText(m.getPublishedPdfPath()))
                          .orElse(false);
                  yield hasPublished ? "PUBLISHED_PDF" : "NONE";
              }
              case "OBSOLETE", "OBSOLETED" -> {
                  boolean hasPublished = publishingMetadataRepository.findByRevision_Id(revision.getId())
                          .map(m -> StringUtils.hasText(m.getPublishedPdfPath()))
                          .orElse(false);
                  yield hasPublished ? "PUBLISHED_PDF" : "NONE";
              }
              default -> StringUtils.hasText(revision.getPreviewFilePath()) ? "REVIEW_PDF" : "NONE";
          };
      }

      /** #4: Publishing preview regeneration status for the FE's pollSnapshotInBackground helper
       *  (see RevisionDetailResponse.previewStatus javadoc). "READY" (the entity default) when no
       *  Publishing metadata exists yet -- nothing is generating, so there's nothing to poll for. */
      private String resolvePreviewGenerationStatus(DocumentRevisionRecord revision) {
          return publishingMetadataRepository.findByRevision_Id(revision.getId())
                  .map(RevisionPublishingMetadata::getPreviewGenerationStatus)
                  .orElse("READY");
      }

      /**
       * Builds the same response shape as {@link #getRevision(UUID)}, but from an already-loaded
       * entity and with none of that method's request-facing side effects (no requireCurrentUser
       * authorization gate, no "openedBy"/VIEW-audit bookkeeping). For internal callers that
       * already have the entity and only need the DTO's field data -- most notably
       * PublishingPdfComposerService#composePreview, which needs placeholder values (document
       * number, dates, participant names, ...) and must also work when invoked from a background
       * thread with no authenticated HTTP request/current-user context at all (see
       * RevisionPublishingSnapshotAsyncService, #4's async snapshot regeneration).
       */
      public RevisionDetailResponse buildDetailResponse(DocumentRevisionRecord revision) {
          return toDetailResponse(revision);
      }

      /**
       * Detail response used to fill the publishing header/footer/cover placeholders. While a revision is
       * still Ready for Publishing, publishing will change its revision number (next major version) and set
       * its Effective Date; rendering the preview with today's values would show "Code: SOP.10110.1" and
       * "Effective date: -" for a document that will read ".2" and a real date once published. So for that
       * stage the response carries the values publishing WILL produce (nothing is persisted). Any other
       * stage is rendered as stored.
       */
      public RevisionDetailResponse buildDetailResponseForRendering(DocumentRevisionRecord revision) {
          String status = revision == null || revision.getStatus() == null ? null : revision.getStatus().getCode();
          if (revision == null || !"READY_FOR_PUBLISHING".equalsIgnoreCase(status)) {
              return toDetailResponse(revision);
          }
          Instant projectedPublishedAt = Instant.now();
          LocalDate projectedEffectiveDate = calculateEffectiveDate(revision, projectedPublishedAt);
          Integer periodicReviewCycle = revision.getPeriodicReviewCycle() != null
                  ? revision.getPeriodicReviewCycle()
                  : (revision.getDocument() == null ? null : revision.getDocument().getPeriodicReviewCycle());
          return toDetailResponse(
                  revision,
                  null,
                  promoteToNextMajorVersion(revision.getRevisionNumber()),
                  projectedEffectiveDate,
                  calculateValidUntil(projectedEffectiveDate, periodicReviewCycle, revision.getValidUntil()));
      }

      private RevisionDetailResponse toDetailResponse(DocumentRevisionRecord revision) {
          return toDetailResponse(revision, null);
      }

      private RevisionDetailResponse toDetailResponse(DocumentRevisionRecord revision, String message) {
          return toDetailResponse(revision, message, null, null, null);
      }

      private RevisionDetailResponse toDetailResponse(
              DocumentRevisionRecord revision, String message,
              String projectedRevisionNumber, LocalDate projectedEffectiveDate, LocalDate projectedValidUntil
      ) {
          DocumentRecord sourceDocument = revision.getDocument();
          String shownRevisionNumber = projectedRevisionNumber != null ? projectedRevisionNumber : revision.getRevisionNumber();
          LocalDate shownEffectiveDate = projectedEffectiveDate != null ? projectedEffectiveDate : revision.getEffectiveDate();
          LocalDate shownValidUntil = projectedValidUntil != null ? projectedValidUntil : revision.getValidUntil();
          String resolvedRevisionName = buildRevisionName(revision.getDocument() == null ? null : revision.getDocument().getDocumentName(), shownRevisionNumber);
        OriginalDocumentResponse originalDocument = sourceDocument == null ? null : new OriginalDocumentResponse(
                sourceDocument.getId() == null ? null : sourceDocument.getId().toString(),
                sourceDocument.getDocumentNumber(),
                sourceDocument.getDocumentName(),
                buildDocumentDisplayName(sourceDocument.getDocumentNumber(), sourceDocument.getDocumentName()),
                buildDocumentDisplayName(sourceDocument.getDocumentNumber(), sourceDocument.getDocumentName()),
                DateTimeFormatUtils.formatDateTime(sourceDocument.getCreatedAt()),
                sourceDocument.getOpenedBy() == null ? null : sourceDocument.getOpenedBy().getFullName(),
                sourceDocument.getAuthor() == null ? null : sourceDocument.getAuthor().getFullName(),
                sourceDocument.getOwner() == null ? null : sourceDocument.getOwner().getFullName(),
                StatusMapper.label(sourceDocument.getStatus()),
                StatusMapper.code(sourceDocument.getStatus()),
                StatusMapper.from(sourceDocument.getStatus()),
                DateTimeFormatUtils.formatDate(sourceDocument.getValidUntil()),
                DateTimeFormatUtils.formatDate(sourceDocument.getReviewDate())
        );
        List<DocumentParticipantResponse> coAuthors = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "CO_AUTHOR")
                .stream()
                .map(this::toParticipantResponse)
                .toList();
        List<DocumentParticipantResponse> reviewers = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER")
                .stream()
                .map(this::toParticipantResponse)
                .toList();
        List<DocumentParticipantResponse> approvers = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER")
                .stream()
                .map(this::toParticipantResponse)
                .toList();
        List<DocumentRelationResponse> relatedDocuments = sourceDocument == null ? List.of() :
                documentRelationRepository.findAllBySourceDocument_IdAndRelationType(sourceDocument.getId(), "RELATED")
                        .stream()
                        .map(relation -> toRelationResponse(relation, "RELATED"))
                        .toList();
        List<DocumentRelationResponse> correlatedDocuments = sourceDocument == null ? List.of() :
                documentRelationRepository.findAllBySourceDocument_IdAndRelationType(sourceDocument.getId(), "CORRELATED")
                        .stream()
                        .map(relation -> toRelationResponse(relation, "CORRELATED"))
                        .toList();
        List<RevisionHistoryResponse> history = revisionWorkflowHistoryRepository
                .findAllByRevision_IdOrderByCreatedAtAsc(revision.getId())
                .stream()
                .map(item -> new RevisionHistoryResponse(
                        item.getId().toString(),
                        item.getActionType(),
                        item.getFromStatus(),
                        item.getToStatus(),
                        item.getComment(),
                        item.getActedBy() == null ? null : item.getActedBy().getFullName(),
                        DateTimeFormatUtils.formatDateTime(item.getCreatedAt())
                ))
                .toList();
        UserAccount currentUser = currentUserService.requireCurrentUser();
        List<RevisionWorkingNoteResponse> workingNotes = revisionWorkingNoteRepository
                .findAllByRevision_IdAndDeletedAtIsNullOrderByCreatedAtDesc(revision.getId())
                .stream()
                .map(note -> toWorkingNoteResponse(note, currentUser))
                .toList();
        String workingNotesStage = resolveWorkingNoteStage(revision);
        boolean workingNotesEditable = canWriteWorkingNotes(revision, currentUser);
        boolean canEditFileOnline = documentAuthorizationService.canEditRevisionFileOnline(currentUser, revision);
        boolean canCompleteEditing = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_AUTHORING);
        boolean canOpenPublishingWorkspace = documentAuthorizationService.canOpenPublishingWorkspace(currentUser, revision);
        boolean canReviewRevision = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_REVIEW);
        boolean canApproveRevision = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_APPROVAL);
        boolean canCompleteTraining = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_TRAINING);
        boolean canPublishRevision = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.PUBLISH);

        boolean hasLegacyImportInfo = sourceDocument != null && sourceDocument.isLegacyImport()
                && (StringUtils.hasText(revision.getLegacyHistoricalReviewers())
                        || StringUtils.hasText(revision.getLegacyHistoricalApprover())
                        || revision.getLegacyHistoricalReviewDate() != null
                        || revision.getLegacyHistoricalApprovalDate() != null
                        || revision.getLegacyHistoricalAuthoredDate() != null
                        || StringUtils.hasText(sourceDocument.getLegacyJustification()));
        com.eqms.dto.document.LegacyImportInfoResponse legacyImportInfo = !hasLegacyImportInfo ? null
                : new com.eqms.dto.document.LegacyImportInfoResponse(
                        sourceDocument.getLegacyJustification(),
                        DateTimeFormatUtils.formatDate(revision.getLegacyHistoricalAuthoredDate()),
                        revision.getLegacyHistoricalReviewers(),
                        DateTimeFormatUtils.formatDate(revision.getLegacyHistoricalReviewDate()),
                        revision.getLegacyHistoricalApprover(),
                        DateTimeFormatUtils.formatDate(revision.getLegacyHistoricalApprovalDate())
                );

        return new RevisionDetailResponse(
                revision.getId().toString(),
                sourceDocument == null ? null : sourceDocument.getId().toString(),
                originalDocument,
                revision.getDocumentNumber(),
                sourceDocument == null ? revision.getDocumentName() : sourceDocument.getDocumentName(),
                buildDocumentDisplayName(revision.getDocumentNumber(), sourceDocument == null ? revision.getDocumentName() : sourceDocument.getDocumentName()),
                revision.getTitleLocalLanguage(),
                resolvedRevisionName,
                  shownRevisionNumber,
                revision.getStatus() == null ? null : revision.getStatus().getLabel(),
                new StatusResponse(revision.getStatus() == null ? null : revision.getStatus().getCode(), revision.getStatus() == null ? null : revision.getStatus().getLabel()),
                revision.getDocumentType() == null ? null : revision.getDocumentType().getName(),
                revision.getBusinessUnit() == null ? null : revision.getBusinessUnit().getName(),
                revision.getDepartment() == null ? null : revision.getDepartment().getName(),
                revision.getAuthor() == null ? null : revision.getAuthor().getFullName(),
                revision.getAuthor() == null ? null : revision.getAuthor().getUsername(),
                revision.getAuthor() == null ? null : revision.getAuthor().getPosition(),
                revision.getOwner() == null ? null : revision.getOwner().getFullName(),
                revision.getOpenedBy() == null ? null : revision.getOpenedBy().getFullName(),
                revision.getOpenedBy() == null ? null : revision.getOpenedBy().getUsername(),
                revision.getSubmittedBy() == null ? null : revision.getSubmittedBy().getFullName(),
                revision.getSubmittedBy() == null ? null : revision.getSubmittedBy().getUsername(),
                DateTimeFormatUtils.formatDateTime(revision.getSubmittedOn()),
                DateTimeFormatUtils.formatDateTime(revision.getCreatedAt()),
                DateTimeFormatUtils.formatDate(shownEffectiveDate),
                DateTimeFormatUtils.formatDate(shownValidUntil),
                DateTimeFormatUtils.formatDate(
                        revision.getDocument() == null ? null : revision.getDocument().getReviewDate()
                ),
                revision.getDescription(),
                revision.getKnowledgeBase(),
                revision.getSubType(),
                revision.getReviewRequirement().name(),
                revision.getPeriodicReviewCycle(),
                revision.getPeriodicReviewNotification(),
                revision.getLanguage(),
                revision.isRequiresTraining(),
                revision.getTrainingPeriodDays(),
                revision.getReasonForSkippingTraining(),
                DateTimeFormatUtils.formatDate(revision.getTrainingPlannedDate()),
                DateTimeFormatUtils.formatDate(revision.getTrainingPeriodEndDate()),
                DateTimeFormatUtils.formatDate(revision.getTrainingCompletionDate()),
                revision.isTemplate(),
                DateTimeFormatUtils.formatDateTime(revision.getUpdatedAt()),
                revision.getLastModifiedBy() == null ? null : revision.getLastModifiedBy().getFullName(),
                revision.isHasRelatedDocuments(),
                revision.isHasCorrelatedDocuments(),
                revision.getFileName(),
                revision.getFileType(),
                revision.getFileSize(),
                StringUtils.hasText(revision.getPreviewFilePath()),
                resolvePreviewType(revision),
                revision.getSnapshotStatus(),
                resolvePreviewGenerationStatus(revision),
                revision.getEditingStatus(),
                revision.isSourceLocked(),
                revision.getSourceStorageProvider(),
                revision.getSourceStorageBucket(),
                revision.getSourceStorageObjectKey(),
                revision.getSourceStorageVersionId(),
                revision.getSourceFileChecksum(),
                revision.getSourceUploadedAt() == null ? null : DateTimeFormatUtils.formatDateTime(revision.getSourceUploadedAt()),
                revision.getStorageProvider(),
                revision.getStorageSiteId(),
                revision.getStorageDriveId(),
                revision.getStorageItemId(),
                revision.getStorageWebUrl(),
                revision.getStorageEditUrl(),
                revision.getStorageViewUrl(),
                revision.getStoragePdfUrl(),
                revision.getStorageSyncStatus(),
                revision.getStorageLastSyncedAt() == null ? null : DateTimeFormatUtils.formatDateTime(revision.getStorageLastSyncedAt()),
                revision.getPublishedBy() == null ? null : revision.getPublishedBy().getFullName(),
                revision.getPublishedAt() == null ? null : DateTimeFormatUtils.formatDateTime(revision.getPublishedAt()),
                coAuthors,
                reviewers,
                approvers,
                relatedDocuments,
                correlatedDocuments,
                workingNotes,
                workingNotesEditable,
                workingNotesStage,
                history,
                buildRevisionSignatures(revision),
                canEditFileOnline,
                canCompleteEditing,
                canOpenPublishingWorkspace,
                canReviewRevision,
                canApproveRevision,
                canCompleteTraining,
                canPublishRevision,
                message,
                legacyImportInfo
        );
    }

    private List<SignatureResponse> buildRevisionSignatures(DocumentRevisionRecord revision) {
        var electronicSignatures = electronicSignatureService.getRevisionSignatures(revision.getId());
        if (!electronicSignatures.isEmpty()) {
            return electronicSignatures.stream()
                    .map(signature -> new SignatureResponse(
                            signature.displayMeaning(),
                            signature.fullName(),
                            "Signed On (Date - Time)",
                            DateTimeFormatUtils.formatDateTime(signature.signedAt())
                    ))
                    .toList();
        }
        List<SignatureResponse> list = new java.util.ArrayList<>();
        if (revision.getAuthor() != null) {
            list.add(new SignatureResponse(
                    "Prepared By",
                    revision.getAuthor().getFullName(),
                    "Prepared On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getSubmittedOn())
            ));
        }
        if (revision.getSubmittedBy() != null) {
            list.add(new SignatureResponse(
                    "Submitted By",
                    revision.getSubmittedBy().getFullName(),
                    "Submitted On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getSubmittedOn())
            ));
        }
        if (revision.getRejectedBy() != null) {
            list.add(new SignatureResponse(
                    "Rejected By",
                    revision.getRejectedBy().getFullName(),
                    "Rejected On (Date - Time)",
                    DateTimeFormatUtils.formatDateTime(revision.getRejectedAt())
            ));
        }

        List<RevisionWorkflowParticipant> reviewerParticipants = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER");
        appendParticipantSignatures(list, reviewerParticipants, "Reviewed By", "Reviewed On (Date - Time)");

        List<RevisionWorkflowParticipant> approverParticipants = revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER");
        appendParticipantSignatures(list, approverParticipants, "Approved By", "Approved On (Date - Time)");

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

    private RevisionListItemResponse toListItem(DocumentRevisionRecord revision) {
          DocumentRecord sourceDocument = revision.getDocument();
          String sourceDocumentTitle = sourceDocument == null ? null : sourceDocument.getDocumentName();
          String resolvedRevisionName = buildRevisionName(sourceDocumentTitle, revision.getRevisionNumber());
          boolean canEditRevision = canCurrentUserEditRevision(revision);
          UserAccount currentUser = currentUserService.requireCurrentUser();
          boolean canReviewRevision = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_REVIEW);
          boolean canApproveRevision = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_APPROVAL);
          boolean canCompleteTraining = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_TRAINING);
          boolean canPublishRevision = canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.PUBLISH);
          // Mirrors the FE's canSubmitForReview gate exactly (RevisionCreateView: editingCompleted
          // && resolveRevisionCapability("submitForReview")) -- without editingStatus == COMPLETED
          // here too, a DCO with the permission would see "Submit for Review" on a Draft the Author
          // hasn't finished editing yet.
          boolean canSubmitForReview = "COMPLETED".equalsIgnoreCase(revision.getEditingStatus())
                  && canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.SUBMIT_FOR_REVIEW);
          List<DocumentRelationResponse> relatedDocuments = sourceDocument == null ? List.of() :
                  documentRelationRepository.findAllBySourceDocument_IdAndRelationType(sourceDocument.getId(), "RELATED")
                          .stream()
                          .map(relation -> toRelationResponse(relation, "RELATED"))
                          .toList();
          List<DocumentRelationResponse> correlatedDocuments = sourceDocument == null ? List.of() :
                  documentRelationRepository.findAllBySourceDocument_IdAndRelationType(sourceDocument.getId(), "CORRELATED")
                          .stream()
                          .map(relation -> toRelationResponse(relation, "CORRELATED"))
                          .toList();
        return new RevisionListItemResponse(
                revision.getId().toString(),
                revision.getDocument() == null || revision.getDocument().getId() == null ? null : revision.getDocument().getId().toString(),
                revision.getDocumentNumber(),
                sourceDocumentTitle,
                revision.getDocumentName(),
                revision.getRevisionNumber(),
                DateTimeFormatUtils.formatDateTime(revision.getCreatedAt()),
                revision.getOpenedBy() == null ? null : revision.getOpenedBy().getFullName(),
                  resolvedRevisionName,
                  StatusMapper.label(revision.getStatus()),
                  StatusMapper.label(revision.getStatus()),
                  StatusMapper.code(revision.getStatus()),
                  StatusMapper.from(revision.getStatus()),
                revision.getAuthor() == null ? null : revision.getAuthor().getFullName(),
                DateTimeFormatUtils.formatDate(revision.getEffectiveDate()),
                DateTimeFormatUtils.formatDate(revision.getValidUntil()),
                sourceDocumentTitle,
                revision.getDocumentType() == null ? null : revision.getDocumentType().getName(),
                revision.getDepartment() == null ? null : revision.getDepartment().getName(),
                revision.getBusinessUnit() == null ? null : revision.getBusinessUnit().getName(),
                revision.isHasRelatedDocuments(),
                revision.isHasCorrelatedDocuments(),
                revision.isTemplate(),
                canEditRevision,
                canReviewRevision,
                canApproveRevision,
                canCompleteTraining,
                canPublishRevision,
                canSubmitForReview,
                relatedDocuments,
                correlatedDocuments
        );
    }

      private DocumentRevisionSummaryResponse toSummary(DocumentRevisionRecord revision) {
          String resolvedRevisionName = buildRevisionName(revision.getDocument() == null ? null : revision.getDocument().getDocumentName(), revision.getRevisionNumber());
          StatusResponse statusInfo = StatusMapper.from(revision.getStatus());
          boolean canOpenAuthoringWorkspace = documentAuthorizationService
                  .canEditDraftRevision(currentUserService.requireCurrentUser(), revision);
          return new DocumentRevisionSummaryResponse(
                  revision.getId().toString(),
                  revision.getDocument() == null || revision.getDocument().getId() == null ? null : revision.getDocument().getId().toString(),
                  revision.getRevisionNumber(),
                  DateTimeFormatUtils.formatDateTime(revision.getCreatedAt()),
                  revision.getOpenedBy() == null ? null : revision.getOpenedBy().getFullName(),
                  resolvedRevisionName,
                  StatusMapper.label(revision.getStatus()),
                  StatusMapper.code(revision.getStatus()),
                  statusInfo,
                  canOpenAuthoringWorkspace
          );
      }

    private void applyRevisionSnapshot(
            DocumentRevisionRecord revision,
            DocumentRecord document,
            UserAccount currentUser,
            DocumentRevisionRecord parentRevision,
            String changeDescription,
            String version
      ) {
          revision.setDocument(document);
          revision.setDocumentNumber(document.getDocumentNumber());
          revision.setDocumentName(document.getDocumentName());
          revision.setTitleLocalLanguage(document.getTitleLocalLanguage());
          revision.setRevisionNumber(normalizeVersionFormat(version));
          revision.setRevisionName(buildRevisionName(document.getDocumentName(), revision.getRevisionNumber()));
          revision.setStatus(requireRevisionStatus("DRAFT"));
          if (!StringUtils.hasText(revision.getEditingStatus())) {
              revision.setEditingStatus("IN_PROGRESS");
          }
        revision.setDocumentType(document.getDocumentType());
        revision.setBusinessUnit(document.getBusinessUnit());
        revision.setDepartment(document.getDepartment());
        revision.setAuthor(document.getAuthor());
        revision.setOwner(currentUser);
        revision.setOpenedBy(currentUser);
        revision.setLastModifiedBy(currentUser);
        document.setOpenedBy(currentUser);
        documentRepository.save(document);
        revision.setDescription(StringUtils.hasText(changeDescription) ? changeDescription.trim() : document.getDescription());
        revision.setKnowledgeBase(document.getKnowledgeBase());
        revision.setTemplate(document.isTemplate());
        revision.setHasRelatedDocuments(document.isHasRelatedDocuments());
        revision.setHasCorrelatedDocuments(document.isHasCorrelatedDocuments());
        revision.setEffectiveDate(null);
        revision.setValidUntil(null);
          revision.setPeriodicReviewCycle(document.getPeriodicReviewCycle());
          revision.setPeriodicReviewNotification(document.getPeriodicReviewNotification());
          revision.setSubType(document.getSubType());
          revision.setReviewRequirement(resolveReviewRequirement(document));
          revision.setLanguage(document.getLanguage());
          revision.setRequiresTraining(document.isRequiresTraining());
          revision.setTrainingPeriodDays(document.getTrainingPeriodDays());
          revision.setReasonForSkippingTraining(document.getReasonForSkippingTraining());
          revision.setPublishedAt(null);
          revision.setPublishedBy(null);
      }

    /**
     * Author/Co-Author/Reviewer/Approver/Periodic Review Cycle-Notification/Training are snapshotted
     * onto a Draft revision only once, at creation time ({@link #applyRevisionSnapshot}). If a DCO
     * later reconfigures those same fields on the Document (DocumentService.
     * updateActiveWorkflowConfiguration) while that Draft revision is still open, the revision's own
     * copies silently went stale -- e.g. the revision kept showing the old Author/Reviewer/Approver,
     * and {@link com.eqms.service.DocumentAuthorizationService#canEditDraftRevision} (which reads
     * revision.getAuthor(), not the Document's) kept granting edit access to the person who was no
     * longer the Author. Re-sync here whenever such a Draft exists. Deliberately excludes
     * `description`: that field is dual-purpose (an explicit revision Note overrides it at creation
     * time), so resyncing it here would silently clobber a user-entered Note with the Document's
     * Description. The Related/Correlated Document *list* is queried live against the Document, but
     * the denormalised has_*_documents Yes/No flag is snapshotted onto the revision, so that flag is
     * resynced below.
     */
    public void syncDraftRevisionWithDocument(DocumentRecord document) {
        if (document == null || document.getId() == null) {
            return;
        }
        DocumentRevisionRecord draft = revisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT")
                .orElse(null);
        if (draft == null || "COMPLETED".equals(draft.getEditingStatus())) {
            // A Draft whose Author already signed COMPLETE_AUTHORING must not be silently
            // re-synced from later Document Master workflow-configuration changes -- see
            // requireRevisionNotCompletedEditing() for the equivalent guard on the direct
            // updateRevision() edit path.
            return;
        }
        draft.setAuthor(document.getAuthor());
        // Keep the Draft revision's Sub-Type + frozen review requirement in step with the Document
        // so a Sub-Type change on the Draft is reconciled here (see S6 REVIEW_REQUIREMENT_CHANGED
        // guard in submitForReview).
        draft.setSubType(document.getSubType());
        draft.setReviewRequirement(document.getReviewRequirement() == null
                ? ReviewRequirement.REQUIRED
                : document.getReviewRequirement());
        draft.setPeriodicReviewCycle(document.getPeriodicReviewCycle());
        draft.setPeriodicReviewNotification(document.getPeriodicReviewNotification());
        draft.setRequiresTraining(document.isRequiresTraining());
        draft.setTrainingPeriodDays(document.getTrainingPeriodDays());
        draft.setReasonForSkippingTraining(document.getReasonForSkippingTraining());
        // The related/correlated list is queried live against the Document, but the denormalised
        // has_*_documents Yes/No flag IS snapshotted onto the revision (applyRevisionSnapshot) and
        // is read by the revision list column -- keep it in step when the Document's relations change.
        draft.setHasRelatedDocuments(document.isHasRelatedDocuments());
        draft.setHasCorrelatedDocuments(document.isHasCorrelatedDocuments());
        revisionRepository.save(draft);
        copyWorkflowParticipantsFromDocument(document, draft);
    }

    /**
     * Reads the review-requirement <em>snapshot</em> frozen on the Document (documents.review_requirement)
     * when its Sub-Type was last set -- see DocumentService.applyDraftFields and change record
     * docs/decisions/review-requirement-snapshot-and-subtype-fk-change-record.md (D1). This is the
     * single source; the Sub-Type table is no longer re-read live here, so an admin editing a
     * Sub-Type's policy cannot retroactively change an in-flight Draft/Revision. When a new
     * Revision is created its own review_requirement is snapshotted from this value (applyRevisionSnapshot).
     * Null (legacy rows before V408) falls back to the safer REQUIRED.
     */
    private ReviewRequirement resolveReviewRequirement(DocumentRecord document) {
        if (document == null || document.getReviewRequirement() == null) {
            return ReviewRequirement.REQUIRED;
        }
        return document.getReviewRequirement();
    }

    /**
     * Server-side mirror of the FE's isWorkflowSaved gate (NewDocumentView.tsx) that decides
     * when the "Upload Revision" action becomes available -- must not be FE-only, or a direct
     * API call could attach a source file before anyone is assigned to review/approve it.
     * Deliberately a looser "at least one" check (not the exact SINGLE=1/MULTIPLE>=2 count),
     * matching the FE gate's intent; the strict count is enforced later at Submit-for-Review via
     * {@link #validateReviewersForRequirement}.
     */
    private void requireDocumentWorkflowParticipantsAssigned(DocumentRecord document) {
        String reason = describeWhyDocumentWorkflowParticipantsAreMissing(document);
        if (reason != null) {
            throw new IllegalStateException(reason);
        }
    }

    /**
     * Non-throwing sibling of {@link #requireDocumentWorkflowParticipantsAssigned} -- used by
     * {@link DocumentMasterActionCapabilityService} so the "Upload Revision" action is reported as
     * NOT allowed (with a clear reason) when no Approver/required Reviewer is assigned yet, instead
     * of the button appearing clickable and only failing once the DCO has already picked a file and
     * submitted. Same "at least one" check, same two error codes, just returned instead of thrown.
     */
    public String describeWhyDocumentWorkflowParticipantsAreMissing(DocumentRecord document) {
        long approverCount = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER")
                .size();
        if (approverCount == 0) {
            return "APPROVER_REQUIRED: Assign and save an Approver before uploading a revision.";
        }
        ReviewRequirement requirement = resolveReviewRequirement(document);
        if (requirement != ReviewRequirement.NONE) {
            long reviewerCount = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER")
                    .size();
            if (reviewerCount == 0) {
                return "REVIEWER_REQUIRED: Assign and save a Reviewer before uploading a revision.";
            }
        }
        return null;
    }

    /**
     * Domain invariant evaluated before SoD.  Authorization only decides who
     * may submit; it must never allow a caller to bypass the subtype workflow.
     */
    private void validateReviewersForRequirement(DocumentRevisionRecord revision, ReviewRequirement requirement) {
        long reviewerCount = countParticipants(revision, "REVIEWER");
        switch (requirement == null ? ReviewRequirement.REQUIRED : requirement) {
            case NONE -> {
                if (reviewerCount != 0) {
                    throw new IllegalStateException("REVIEW_NOT_REQUIRED: this Sub-Type must not have Reviewers");
                }
            }
            case REQUIRED -> {
                if (reviewerCount < 1) {
                    throw new IllegalStateException("AT_LEAST_ONE_REVIEWER_REQUIRED: at least one Reviewer is required");
                }
            }
        }
    }

    private void applyTrainingSchedule(DocumentRevisionRecord revision, DocumentDraftCreateRequest request) {
        if (request == null) {
            return;
        }

        LocalDate plannedDate = revision.getTrainingPlannedDate();
        LocalDate completionDate = revision.getTrainingCompletionDate();

        if (request.trainingPlannedDate() != null) {
            plannedDate = parseDate(request.trainingPlannedDate());
        }
        if (request.trainingCompletionDate() != null) {
            completionDate = parseDate(request.trainingCompletionDate());
        }

        Integer trainingPeriodDays = revision.getTrainingPeriodDays();
        if ((trainingPeriodDays == null || trainingPeriodDays < 1) && revision.getDocument() != null) {
            trainingPeriodDays = revision.getDocument().getTrainingPeriodDays();
        }

        LocalDate periodEndDate = plannedDate;
        if (plannedDate != null && trainingPeriodDays != null && trainingPeriodDays > 0) {
            periodEndDate = plannedDate.plusDays(trainingPeriodDays.longValue());
        }

        if (plannedDate != null && periodEndDate != null && plannedDate.isAfter(periodEndDate)) {
            throw new IllegalArgumentException("Training Planned Date must be on or before Training Period End Date");
        }
        if (completionDate != null && plannedDate != null && completionDate.isBefore(plannedDate)) {
            throw new IllegalArgumentException("Training Completion Date cannot be earlier than Training Planned Date");
        }

        revision.setTrainingPlannedDate(plannedDate);
        revision.setTrainingPeriodEndDate(periodEndDate);
        revision.setTrainingCompletionDate(completionDate);
    }

    /**
     * The training configuration the new draft revision inherited from the Document Master at the
     * moment of upgrade. This is a creation snapshot, not a user edit, so there is no meaningful
     * "before" value -- the old side is left null. Rows whose value is absent are omitted entirely
     * rather than recorded as "- -> -", which told an inspector nothing.
     */
    private List<AuditTrailChangeResponse> buildUpgradeTrainingAuditChanges(DocumentRecord document) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        boolean requiresTraining = document != null && document.isRequiresTraining();
        changes.add(new AuditTrailChangeResponse("requiresTraining", null, requiresTraining ? "Yes" : "No"));
        if (requiresTraining) {
            if (document != null && document.getTrainingPeriodDays() != null) {
                changes.add(new AuditTrailChangeResponse(
                        "trainingPeriodDays", null, String.valueOf(document.getTrainingPeriodDays())));
            }
        } else if (document != null && StringUtils.hasText(document.getReasonForSkippingTraining())) {
            changes.add(new AuditTrailChangeResponse(
                    "reasonForSkippingTraining", null, document.getReasonForSkippingTraining().trim()));
        }
        return changes;
    }

      private String buildRevisionName(String documentTitle, String version) {
          String safeTitle = StringUtils.hasText(documentTitle) ? documentTitle.trim() : "";
          String safeVersion = StringUtils.hasText(version) ? version.trim() : defaultRevisionSeed();
          if (!StringUtils.hasText(safeTitle)) {
              return safeVersion;
          }
          return safeTitle + "_" + safeVersion;
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

    /**
     * #13: re-validates SoD against the roster being copied in, rather than trusting it purely by
     * construction. Two invariants happen to make that safe today (Author identity can't drift
     * within the same applyRevisionSnapshot() call, and DocumentService re-validates existing
     * Reviewers/Approvers whenever Author/Co-Author changes) -- but those are two independently
     * maintained call sites, not one enforcement point, so this is defense-in-depth against either
     * one silently breaking later, consistent with saveRevisionParticipantsFromRequest's own
     * "always validate the combined effective roster" rule.
     */
    private void copyWorkflowParticipantsFromDocument(DocumentRecord document, DocumentRevisionRecord revision) {
        List<DocumentWorkflowParticipant> participants = documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(document.getId());
        validateSoD(
                revision.getReviewRequirement(),
                document.getAuthor(),
                participantIdsByType(participants, DocumentWorkflowParticipant::getParticipantType, DocumentWorkflowParticipant::getUser, "CO_AUTHOR"),
                participantIdsByType(participants, DocumentWorkflowParticipant::getParticipantType, DocumentWorkflowParticipant::getUser, "REVIEWER"),
                participantIdsByType(participants, DocumentWorkflowParticipant::getParticipantType, DocumentWorkflowParticipant::getUser, "APPROVER")
        );

        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(revision.getId());
        // Flush before re-inserting -- previously harmless because every prior caller only ever ran
        // this against a brand-new revision (nothing to delete), so the missing flush never
        // surfaced. syncDraftRevisionWithDocument is the first caller to re-run this against a
        // revision that already has participant rows; without the flush the delete and the
        // re-inserts can race, tripping uq_revision_workflow_participant.
        revisionWorkflowParticipantRepository.flush();
        for (DocumentWorkflowParticipant participant : participants) {
            saveRevisionParticipant(revision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
    }

    private <T> List<String> participantIdsByType(
            List<T> participants,
            java.util.function.Function<T, String> typeGetter,
            java.util.function.Function<T, UserAccount> userGetter,
            String wantedType
    ) {
        return participants.stream()
                .filter(p -> wantedType.equalsIgnoreCase(typeGetter.apply(p)))
                .map(p -> { UserAccount u = userGetter.apply(p); return u == null || u.getId() == null ? null : u.getId().toString(); })
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
    }

    private void copyWorkflowParticipantsFromRevision(DocumentRevisionRecord sourceRevision, DocumentRevisionRecord targetRevision) {
        List<RevisionWorkflowParticipant> coAuthors = revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(sourceRevision.getId(), "CO_AUTHOR");
        List<RevisionWorkflowParticipant> reviewers = revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(sourceRevision.getId(), "REVIEWER");
        List<RevisionWorkflowParticipant> approvers = revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(sourceRevision.getId(), "APPROVER");
        // #13: same defense-in-depth re-validation as copyWorkflowParticipantsFromDocument above.
        validateSoD(
                targetRevision.getReviewRequirement(),
                targetRevision.getDocument() == null ? null : targetRevision.getDocument().getAuthor(),
                participantIdsByType(coAuthors, RevisionWorkflowParticipant::getParticipantType, RevisionWorkflowParticipant::getUser, "CO_AUTHOR"),
                participantIdsByType(reviewers, RevisionWorkflowParticipant::getParticipantType, RevisionWorkflowParticipant::getUser, "REVIEWER"),
                participantIdsByType(approvers, RevisionWorkflowParticipant::getParticipantType, RevisionWorkflowParticipant::getUser, "APPROVER")
        );

        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(targetRevision.getId());
        for (RevisionWorkflowParticipant participant : coAuthors) {
            saveRevisionParticipant(targetRevision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
        for (RevisionWorkflowParticipant participant : reviewers) {
            saveRevisionParticipant(targetRevision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
        for (RevisionWorkflowParticipant participant : approvers) {
            saveRevisionParticipant(targetRevision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
    }

    /**
     * Partial-update semantics: a {@code null} field in the request means "keep the currently
     * persisted roster for that participant type"; a non-null (possibly empty) field means
     * "replace it with exactly this list". The combined, effective roster (mix of request-supplied
     * and carried-over-from-DB lists) is what gets validated as a whole via {@link #validateSoD}
     * and {@link #validateReviewerIdsForRequirement} -- never field-by-field -- so that omitting one
     * field can never silently invalidate an already-valid roster for another type.
     */
    private void saveRevisionParticipantsFromRequest(DocumentRevisionRecord revision, DocumentDraftCreateRequest request) {
        List<String> existingCoAuthorIds = existingParticipantUserIds(revision.getId(), "CO_AUTHOR");
        List<String> existingReviewerIds = existingParticipantUserIds(revision.getId(), "REVIEWER");
        List<String> existingApproverIds = existingParticipantUserIds(revision.getId(), "APPROVER");

        List<String> coAuthorIds = request.coAuthorIds() == null ? existingCoAuthorIds : distinctNonBlank(request.coAuthorIds());
        List<String> reviewerUserIds = request.reviewerUserIds() == null ? existingReviewerIds : distinctNonBlank(request.reviewerUserIds());
        List<String> approverUserIds = request.approverUserIds() == null ? existingApproverIds : distinctNonBlank(request.approverUserIds());

        UserAccount author = revision.getDocument() == null ? null : revision.getDocument().getAuthor();
        validateReviewerIdsForRequirement(revision.getReviewRequirement(), reviewerUserIds.size());
        // Independent of DocumentWorkflowSetting.isRequireOneApprover() (which only pins the count
        // to exactly one when enabled) -- at least one Approver is a GMP floor that must always
        // hold, whether the caller omitted approverUserIds or explicitly sent [] to clear it.
        if (approverUserIds.isEmpty()) {
            throw new IllegalArgumentException("AT_LEAST_ONE_APPROVER_REQUIRED: at least one Approver is required");
        }
        validateSoD(revision.getReviewRequirement(), author, coAuthorIds, reviewerUserIds, approverUserIds);

        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(revision.getId());
        revisionWorkflowParticipantRepository.flush();

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
            workflowParticipantEligibilityService.requirePoolMembership("REVIEWER", user);
            saveRevisionParticipant(revision, user, "REVIEWER", sequence++);
        }

        sequence = 1;
        for (String userId : approverUserIds) {
            UserAccount user = resolveUser(userId);
            if (user == null) {
                throw new IllegalArgumentException("Approver not found: " + userId);
            }
            workflowParticipantEligibilityService.requirePoolMembership("APPROVER", user);
            saveRevisionParticipant(revision, user, "APPROVER", sequence++);
        }
    }


    private List<String> existingParticipantUserIds(UUID revisionId, String participantType) {
        return revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, participantType)
                .stream()
                .map(p -> p.getUser() == null || p.getUser().getId() == null ? null : p.getUser().getId().toString())
                .filter(Objects::nonNull)
                .toList();
    }

    private void saveRevisionParticipant(DocumentRevisionRecord revision, UserAccount user, String participantType, int sequenceOrder) {
        RevisionWorkflowParticipant participant = new RevisionWorkflowParticipant();
        participant.setRevision(revision);
        participant.setUser(user);
        participant.setParticipantType(participantType);
        participant.setSequenceOrder(sequenceOrder);
        participant.setActionStatus("PENDING");
        participant.setActionComment(null);
        participant.setActedAt(null);
        participant.setSignatureSessionId(null);
        revisionWorkflowParticipantRepository.save(participant);
    }

    private void validateReviewerIdsForRequirement(ReviewRequirement requirement, int reviewerCount) {
        switch (requirement == null ? ReviewRequirement.REQUIRED : requirement) {
            case NONE -> {
                if (reviewerCount != 0) {
                    throw new IllegalArgumentException("REVIEW_NOT_REQUIRED: this Sub-Type does not allow Reviewer assignments");
                }
            }
            case REQUIRED -> {
                if (reviewerCount < 1) {
                    throw new IllegalArgumentException("AT_LEAST_ONE_REVIEWER_REQUIRED: at least one Reviewer is required");
                }
            }
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

    /** Uses the canonical coordinator permission, never a tenant-editable role label. */
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

    @Transactional
    public RevisionDetailResponse uploadRevisionFile(UUID revisionId, MultipartFile file) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        DocumentRecord document = requireDocument(revision.getDocument().getId());
        requireDocumentAllowsRevisionFileUpload(document, revision);
        requireCurrentUserCanUploadRevision(document, currentUser);
        requireRevisionFileAccess(currentUser, revision, FileAccessAction.UPLOAD);
        requireRevisionStatus(revision, "DRAFT");
        requireRevisionNotCompletedEditing(revision);
        ensureNoRevisionInProgress(document.getId(), revision.getId());
        RevisionUploadFileValidator.ValidatedRevisionFile validatedFile = validateRevisionUpload(
                currentUser, document, revision, file
        );

        try {
            storeRevisionFile(revision, file, validatedFile);
            applyRevisionSnapshot(
                    revision,
                    document,
                    currentUser,
                    revision.getParentRevision(),
                    revision.getDescription(),
                    revision.getRevisionNumber()
            );
            revisionRepository.save(revision);
            activateDocumentAfterInitialSourceStored(document, revision, currentUser);
            recordRevisionHistory(
                    revision,
                    "REVISION_SOURCE_FILE_UPLOADED",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Revision file uploaded",
                    currentUser,
                    revisionFileAuditChanges(file, revision, validatedFile)
            );
            return toDetailResponse(revision);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to upload revision file", ex);
        }
    }

    @Transactional
    public RevisionDetailResponse createRevisionAndUploadFile(UUID documentId, MultipartFile file, RevisionCreationRequest request) {
        if ((file == null || file.isEmpty()) && (request == null || !StringUtils.hasText(request.templateRevisionId()))) {
            throw new RevisionUploadValidationException("REVISION_FILE_REQUIRED", "A DOCX source file is required.");
        }

        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = requireDocument(documentId);
        requireCurrentUserCanUploadRevision(document, currentUser);
        requireDocumentWorkflowParticipantsAssigned(document);
        ensureNoRevisionInProgress(documentId, null);
        if (!documentAuthorizationService.isNextRevisionConfiguredForUpload(document)) {
            throw new RevisionLifecycleConflictException("UPGRADE_NOT_CONFIGURED",
                    "The DCO must configure the next revision (Edit Revision for Upgrade) and save before a new revision can be uploaded.");
        }
        RevisionUploadFileValidator.ValidatedRevisionFile validatedFile = file == null || file.isEmpty()
                ? null
                : validateRevisionUpload(currentUser, document, null, file);
        DocumentRevisionRecord latestRevision = revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(documentId).orElse(null);
        requireDocumentAllowsRevisionCreation(document, latestRevision);
        DocumentRevisionRecord templateRevision = null;
        String templateSelectionComment = null;
        if (request != null && StringUtils.hasText(request.templateRevisionId())) {
            templateRevision = requireTemplateRevision(UUID.fromString(request.templateRevisionId()), document, currentUser);
            templateSelectionComment = "Created from template " + safeDocumentLabel(templateRevision.getDocument());
        }
        String revisionComment = request == null ? null : request.changeDescription();
        if (StringUtils.hasText(templateSelectionComment)) {
            revisionComment = StringUtils.hasText(revisionComment)
                    ? revisionComment + " | " + templateSelectionComment
                    : templateSelectionComment;
        }

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        applyRevisionSnapshot(
                revision,
                document,
                currentUser,
                latestRevision,
                request == null ? null : request.changeDescription(),
                resolveNextDraftRevisionNumber(documentId)
        );
        revision.setDocumentNumber(document.getDocumentNumber());
        revision.setParentRevision(latestRevision);
        revisionRepository.save(revision);

        try {
            if (templateRevision != null) {
                try {
                    validatedFile = cloneRevisionFile(templateRevision, revision);
                    recordTemplateLineage(templateRevision, revision, currentUser);
                } catch (RevisionUploadValidationException ex) {
                    revisionUploadSecurityAuditService.recordRejected(
                            currentUser, document, revision, file, ex.getCode(), ex.getMessage()
                    );
                    throw ex;
                } catch (ClamAvScanService.VirusScanUnavailableException ex) {
                    revisionUploadSecurityAuditService.recordRejected(
                            currentUser, document, revision, file, "VIRUS_SCAN_UNAVAILABLE", ex.getMessage()
                    );
                    throw ex;
                }
            } else if (file != null && !file.isEmpty()) {
                storeRevisionFile(revision, file, validatedFile);
            }
            revisionRepository.saveAndFlush(revision);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to upload revision file", ex);
        }

        activateDocumentAfterInitialSourceStored(document, revision, currentUser);
        // The upgrade configuration has now been consumed by this revision; the next upgrade needs a fresh
        // "Edit Revision for Upgrade" save before the Author may upload again.
        if (document.getNextRevisionConfiguredAt() != null) {
            document.setNextRevisionConfiguredAt(null);
            documentRepository.save(document);
        }

        copyWorkflowParticipantsFromDocument(document, revision);

        recordRevisionHistory(
                revision,
                "CREATE",
                latestRevision == null ? null : latestRevision.getStatus() == null ? null : latestRevision.getStatus().getCode(),
                revision.getStatus().getCode(),
                revisionComment,
                currentUser
        );
        if (StringUtils.hasText(revision.getFilePath())) {
            recordRevisionHistory(
                    revision,
                    "REVISION_SOURCE_FILE_UPLOADED",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    templateRevision != null ? "Revision file cloned from template" : "Revision file uploaded",
                    currentUser,
                    revisionFileAuditChanges(file, revision, validatedFile)
            );
        }
        return toDetailResponse(revision);
    }

    @Transactional(readOnly = true)
    public byte[] previewRevisionFile(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        // A template is an approved authoring aid. Its preview may be opened by a
        // template user outside the source document's ordinary BU/department scope.
        if (!canPreviewControlledDocumentTemplate(currentUser, revision)) {
            ensureCurrentUserCanViewRevision(revision, currentUser);
        }

        String previewType = resolvePreviewType(revision);
        String previewPath;

        if ("PUBLISHED_PDF".equals(previewType)) {
            previewPath = publishingMetadataRepository.findByRevision_Id(revision.getId())
                    .map(m -> m.getPublishedPdfPath())
                    .orElse(null);
        } else if ("REVIEW_PDF".equals(previewType)) {
            previewPath = revision.getPreviewFilePath();
        } else {
            throw new IllegalArgumentException("PDF preview is not available for this revision status");
        }

        if (!StringUtils.hasText(previewPath)) {
            throw new IllegalArgumentException("Revision PDF preview is not available");
        }

        try {
            byte[] pdfBytes = fileStorageService.readFile(previewPath);
            String statusCode = revision.getStatus() == null ? null : revision.getStatus().getCode();
            if (isPdfBytes(pdfBytes) && systemConfigurationService.isDocumentWatermarkEnabled()) {
                auditTrailService.logAs(currentUser, "REVISION",
                        revision.getRevisionNumber() + " - " + revision.getDocumentName(),
                        revision.getId(), "PREVIEW", statusCode, statusCode,
                        "Viewed revision preview " + revision.getRevisionNumber());
                return applyPreviewWatermark(pdfBytes, currentUser);
            }
            auditTrailService.logAs(currentUser, "REVISION",
                    revision.getRevisionNumber() + " - " + revision.getDocumentName(),
                    revision.getId(), "PREVIEW", statusCode, statusCode,
                    "Viewed revision preview " + revision.getRevisionNumber());
            return pdfBytes;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to preview revision file", ex);
        }
    }

    private void validateCoAuthorRules(UserAccount author, List<String> coAuthorIds) {
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        if (setting.isAuthorCannotBeReviewerOrApprover() && author != null && author.getId() != null) {
            ensureNotContains(author.getId().toString(), coAuthorIds, "Author cannot be Co-author on the same revision");
        }
    }

    /**
     * Approval must be independent from authoring.  Reviewer overlap remains
     * configurable; Author/Co-author approval never is.
     */
    private void validateAuthorAndCoAuthorApprovalIndependence(UserAccount author, List<String> coAuthorIds, List<String> approverUserIds) {
        if (author != null && author.getId() != null) {
            String authorId = author.getId().toString();
            ensureNotContains(authorId, approverUserIds, "Author cannot be Approver on the same revision");
        }
        ensureNoOverlap(coAuthorIds, approverUserIds, "Co-author cannot be Approver on the same revision");
    }

    private void validateReviewerRules(ReviewRequirement requirement, UserAccount author, List<String> coAuthorIds, List<String> reviewerUserIds) {
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        // Reviewer cardinality (none/exactly one/at least two) is the Sub-Type's
        // ReviewRequirement snapshot alone -- validateReviewersForRequirement enforces it
        // unconditionally *before* this method runs (see its javadoc), so a global toggle here
        // could never fire without duplicating -- or worse, contradicting -- that source of truth.
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

    private void validateSoD(
            ReviewRequirement reviewRequirement,
            UserAccount author,
            List<String> coAuthorIds,
            List<String> reviewerUserIds,
            List<String> approverUserIds
    ) {
        List<String> normalizedCoAuthors = distinctNonBlank(coAuthorIds);
        List<String> normalizedReviewers = distinctNonBlank(reviewerUserIds);
        List<String> normalizedApprovers = distinctNonBlank(approverUserIds);
        validateCoAuthorRules(author, normalizedCoAuthors);
        validateReviewerRules(reviewRequirement, author, normalizedCoAuthors, normalizedReviewers);
        validateApproverRules(author, normalizedCoAuthors, normalizedReviewers, normalizedApprovers);
    }


    /**
     * OnlyOffice Document Server calls its save webhook with the finished file's bytes directly
     * (push model), so this method takes the content as a parameter rather than downloading it
     * itself. {@code @Transactional} here since this is invoked directly by
     * {@code OnlyOfficeController}'s webhook, a plain request thread with no surrounding
     * transaction of its own.
     */
    @Transactional
    public void applyOnlyOfficeEditedContent(DocumentRevisionRecord revision, byte[] fileBytes, UserAccount currentUser) {
        if (revision == null || fileBytes == null || fileBytes.length == 0) {
            throw new IllegalArgumentException("Revision and file content are required");
        }
        String currentStatusCode = revision.getStatus() == null ? null : revision.getStatus().getCode();
        // Reviewer/Approver comments and tracked changes are made while the source is locked
        // (PENDING_REVIEW / PENDING_APPROVAL); they must still be persisted or the Author never
        // sees them after a reject. Any other locked state keeps ignoring late saves.
        boolean reviewStage = "PENDING_REVIEW".equalsIgnoreCase(currentStatusCode)
                || "PENDING_APPROVAL".equalsIgnoreCase(currentStatusCode);
        if (revision.isSourceLocked() && !reviewStage) {
            log.warn("DROPPING OnlyOffice save for revision {} -- source is locked (edits after lock are not persisted)", revision.getId());
            return;
        }
        try {
            String previousFilePath = revision.getFilePath();
            String previousStorageProvider = revision.getStorageProvider();
            String previousStorageSyncStatus = revision.getStorageSyncStatus();
            String previousSourceChecksum = revision.getSourceFileChecksum();

            String fileName = StringUtils.hasText(revision.getFileName()) ? revision.getFileName() : "revision.bin";
            RevisionUploadFileValidator.ValidatedRevisionFile validatedFile = validateOfficeOnlineSyncedFile(
                    currentUser, revision, fileName, fileBytes
            );
            FileStorageService.StorageWriteResult stored;
            try (InputStream inputStream = new ByteArrayInputStream(fileBytes)) {
                stored = fileStorageService.storeRevisionSourceFile(revision.getId(), sanitizeFileName(fileName), inputStream, revision.getDocumentNumber(), revision.getRevisionNumber());
            }
            if (!validatedFile.sha256().equalsIgnoreCase(stored.checksum())) {
                deleteInvalidStoredFile(stored.storedPath());
                throw new RevisionUploadValidationException(
                        "REVISION_FILE_INTEGRITY_MISMATCH",
                        "The DOCX file changed while it was being stored. Please sync it again."
                );
            }
            revision.setFilePath(stored.storedPath());
            revision.setFileType(validatedFile.detectedContentType());
            revision.setFileSize((long) fileBytes.length);
            revision.setSourceStorageProvider(stored.provider());
            revision.setSourceStorageBucket(stored.bucket());
            revision.setSourceStorageObjectKey(stored.objectKey());
            revision.setSourceStorageVersionId(stored.versionId());
            revision.setSourceFileChecksum(stored.checksum());
            revision.setSourceUploadedAt(Instant.now());
            revision.setStorageProvider("onlyoffice");
            revision.setStoragePdfUrl(null);
            revision.setStorageSyncStatus("synced");
            revision.setStorageLastSyncedAt(Instant.now());
            revisionRepository.save(revision);

            recordRevisionHistory(
                    revision,
                    "EDIT_ONLINE_SYNCED_BACK_TO_MINIO",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Edited file synced back from OnlyOffice to MinIO",
                    currentUser,
                    List.of(
                            new AuditTrailChangeResponse("filePath", firstNonBlank(previousFilePath, "-"), firstNonBlank(stored.storedPath(), "-")),
                            new AuditTrailChangeResponse("storageProvider", firstNonBlank(previousStorageProvider, "-"), "onlyoffice"),
                            new AuditTrailChangeResponse("storageSyncStatus", firstNonBlank(previousStorageSyncStatus, "-"), "synced"),
                            new AuditTrailChangeResponse("sourceFileChecksum", firstNonBlank(previousSourceChecksum, "-"), firstNonBlank(stored.checksum(), "-")),
                            new AuditTrailChangeResponse("serverDetectedContentType", "-", validatedFile.detectedContentType()),
                            new AuditTrailChangeResponse("docxOoxmlValidation", "-", "PASSED"),
                            new AuditTrailChangeResponse("malwareScan", "-", validatedFile.malwareScanPerformed() ? "CLEAN" : "DISABLED_BY_CONFIGURATION")
                    )
            );

            deleteReplacedStoredFile(previousFilePath, stored.storedPath());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to sync OnlyOffice-edited revision file back to MinIO", ex);
        }
    }

    /** Reads the current source file bytes for a revision -- used to serve OnlyOffice's initial file fetch. */
    public byte[] readCurrentSourceFileBytes(DocumentRevisionRecord revision) throws IOException {
        return fileStorageService.readFile(revision.getFilePath());
    }

    @org.springframework.beans.factory.annotation.Autowired
    private OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;

    /**
     * Resolves the caller's edit permission/mode exactly like the Graph edit/review link methods
     * above (Draft -> full edit for Author/Co-Author via {@code canEditRevisionFileOnline};
     * Pending Review/Pending Approval -> comment-only for the assigned Reviewer/Approver via
     * {@code canCurrentUserPerformWorkflowAction}) and, once permitted, builds the OnlyOffice
     * editor config for that mode. Kept as a single entry point so both providers stay gated by
     * the same lifecycle rules instead of each provider re-implementing its own check.
     */
    @Transactional
    public com.fasterxml.jackson.databind.node.ObjectNode getOnlyOfficeEditConfig(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        String status = revision.getStatus() == null ? null : revision.getStatus().getCode();

        com.eqms.service.editprovider.EditMode mode;
        if ("DRAFT".equalsIgnoreCase(status) && documentAuthorizationService.canEditRevisionFileOnline(currentUser, revision)) {
            mode = com.eqms.service.editprovider.EditMode.EDIT;
        } else if ("PENDING_REVIEW".equalsIgnoreCase(status)
                && (canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_REVIEW)
                || canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.REJECT_REVIEW))) {
            mode = com.eqms.service.editprovider.EditMode.REVIEW;
        } else if ("PENDING_APPROVAL".equalsIgnoreCase(status)
                && (canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_APPROVAL)
                || canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.REJECT_APPROVAL))) {
            mode = com.eqms.service.editprovider.EditMode.COMMENT_ONLY;
        } else {
            throw new AccessDeniedException("Online editing is not available for this revision at its current stage for this user");
        }

        recordRevisionHistory(
                revision,
                "OPEN_ONLYOFFICE_SESSION",
                status,
                status,
                "Opened OnlyOffice " + mode.name() + " session",
                currentUser,
                List.of(new AuditTrailChangeResponse("OnlyOffice Session", "-", mode.name() + " session opened"))
        );
        return onlyOfficeDocumentEditService.buildEditorConfig(revision, mode, currentUser);
    }

    /**
     * Read-only OnlyOffice viewer config for the revision's Document tab while it is still a working
     * file (Draft / Pending Review / Pending Approval). Later stages keep the PDF preview. Anyone who may
     * view the revision may open it; the viewer cannot edit, comment, download or print.
     */
    @Transactional(readOnly = true)
    public com.fasterxml.jackson.databind.node.ObjectNode getOnlyOfficeViewConfig(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        // An active template's effective revision may be opened by any user who may upload a revision (documents.revision.upload_source), like the
        // preview offered when choosing "Select file from template", even outside the source document's BU/department scope.
        if (!canPreviewControlledDocumentTemplate(currentUser, revision)) {
            ensureCurrentUserCanViewRevision(revision, currentUser);
        }
        String status = revision.getStatus() == null ? null : revision.getStatus().getCode();
        // A controlled-document template is never converted to PDF at any stage (it is kept and used as its
        // Word file), so its Document tab views the Word file directly at every stage, even after it is Effective.
        boolean isTemplate = revision.getDocument() != null && revision.getDocument().isTemplate();
        boolean workingStage = isTemplate
                || "DRAFT".equalsIgnoreCase(status)
                || "PENDING_REVIEW".equalsIgnoreCase(status)
                || "PENDING_APPROVAL".equalsIgnoreCase(status)
                || "PENDING_TRAINING".equalsIgnoreCase(status)
                || "READY_FOR_PUBLISHING".equalsIgnoreCase(status);
        if (!workingStage) {
            throw new IllegalArgumentException("Live document view is only available while the revision is a working file");
        }
        requireRevisionSourceFile(revision, "Show the document");
        return onlyOfficeDocumentEditService.buildEditorConfig(revision, com.eqms.service.editprovider.EditMode.VIEW, currentUser);
    }

    /** Verifies an OnlyOffice-minted access token and returns the revision it authorizes, for the public source-file endpoint. */
    @Transactional
    public DocumentRevisionRecord requireRevisionForOnlyOfficeToken(UUID revisionId, String token) {
        onlyOfficeDocumentEditService.verifyAccessToken(revisionId, token);
        return requireRevision(revisionId);
    }

    /**
     * Verifies the callback's token, re-fetches the revision and actor fresh (rather than trusting
     * entities handed across a request boundary, which would be detached Hibernate proxies by the
     * time this runs) and applies the edited content -- all within one transaction, since the
     * calling controller is a plain request thread with no transaction of its own.
     */
    @Transactional
    public void applyOnlyOfficeCallback(UUID revisionId, String token, byte[] fileBytes) {
        applyOnlyOfficeCallback(revisionId, token, fileBytes, null);
    }

    /**
     * {@code editingUserId} is the user OnlyOffice reports as the editor whose changes are being saved;
     * when it names a known user it is the actor of the sync-back, otherwise the token's user is (the
     * token only identifies whoever opened the shared session first).
     */
    @Transactional
    public void applyOnlyOfficeCallback(UUID revisionId, String token, byte[] fileBytes, UUID editingUserId) {
        UUID userId = onlyOfficeDocumentEditService.verifyAccessToken(revisionId, token);
        DocumentRevisionRecord revision = requireRevision(revisionId);
        UserAccount actor = (editingUserId == null ? java.util.Optional.<UserAccount>empty() : userAccountRepository.findById(editingUserId))
                .or(() -> userAccountRepository.findById(userId))
                .orElseThrow(() -> new IllegalStateException("OnlyOffice access token references an unknown user"));
        applyOnlyOfficeEditedContent(revision, fileBytes, actor);
    }


    /**
     * Applies the single, policy-controlled watermark to the transient preview response.
     * The underlying published/review PDF is never changed.  Keeping the rendering here also
     * prevents the browser from becoming a second, independently configured watermark source.
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

    private boolean isPdfBytes(byte[] bytes) {
        return bytes != null
                && bytes.length >= 4
                && bytes[0] == 0x25
                && bytes[1] == 0x50
                && bytes[2] == 0x44
                && bytes[3] == 0x46;
    }

    /**
     * Obsoletes 1 Revision as part of its parent Document Master's Obsolete action
     * ({@code DocumentService.obsoleteDocument()}). Deliberately public: recordRevisionHistory is
     * private, so this is the one entry point DocumentService can call, and it does the full job in
     * a single call -- status change + obsoletedBy/obsoletedAt + history + audit -- so the caller can
     * never end up half-updating a Revision (status changed but no audit, or vice versa) if something
     * fails partway. Joins the caller's existing transaction (DocumentService.obsoleteDocument() is
     * itself @Transactional) rather than opening a new one.
     */
    @Transactional
    public void obsoleteRevisionAsPartOfDocumentObsolete(
            DocumentRevisionRecord revision,
            RevisionStatusDefinition obsoletedStatus,
            UserAccount currentUser,
            Instant obsoletedAt,
            UUID signatureSessionId
    ) {
        String fromStatus = revision.getStatus() == null ? null : revision.getStatus().getCode();
        revision.setStatus(obsoletedStatus);
        revision.setObsoletedBy(currentUser);
        revision.setObsoletedAt(obsoletedAt);
        revision.setOpenedBy(currentUser);
        revision.setLastModifiedBy(currentUser);
        revisionRepository.save(revision);
        recordRevisionHistory(
                revision,
                "OBSOLETE",
                fromStatus,
                "OBSOLETED",
                "Obsoleted as part of parent Document obsolete action",
                currentUser,
                signatureSessionId
        );
    }

    private void recordRevisionHistory(DocumentRevisionRecord revision, String actionType, String fromStatus, String toStatus, String comment, UserAccount currentUser) {
        recordRevisionHistory(revision, actionType, fromStatus, toStatus, comment, currentUser, (List<AuditTrailChangeResponse>) null);
    }

    private void recordRevisionHistory(
            DocumentRevisionRecord revision,
            String actionType,
            String fromStatus,
            String toStatus,
            String comment,
            UserAccount currentUser,
            List<AuditTrailChangeResponse> changes
    ) {
        recordRevisionHistory(revision, actionType, fromStatus, toStatus, comment, currentUser, changes, null);
    }

    private void recordRevisionHistory(
            DocumentRevisionRecord revision,
            String actionType,
            String fromStatus,
            String toStatus,
            String comment,
            UserAccount currentUser,
            UUID signatureSessionId
    ) {
        recordRevisionHistory(revision, actionType, fromStatus, toStatus, comment, currentUser, List.of(), signatureSessionId);
    }

    private void recordRevisionHistory(
            DocumentRevisionRecord revision,
            String actionType,
            String fromStatus,
            String toStatus,
            String comment,
            UserAccount currentUser,
            List<AuditTrailChangeResponse> changes,
            UUID signatureSessionId
    ) {
        RevisionWorkflowHistory history = new RevisionWorkflowHistory();
        history.setRevision(revision);
        history.setActionType(actionType);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setComment(comment);
        history.setActedBy(currentUser);
        revisionWorkflowHistoryRepository.save(history);
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                actionType,
                fromStatus,
                toStatus,
                comment,
                changes == null ? List.of() : changes,
                signatureSessionId
        );
    }

    private List<AuditTrailChangeResponse> revisionFileAuditChanges(
            MultipartFile uploadedFile,
            DocumentRevisionRecord revision,
            RevisionUploadFileValidator.ValidatedRevisionFile validatedFile
    ) {
        String uploadedName = uploadedFile == null ? null : uploadedFile.getOriginalFilename();
        long uploadedSize = uploadedFile == null ? -1 : uploadedFile.getSize();
        return List.of(
                new AuditTrailChangeResponse("fileName", "-", firstNonBlank(revision == null ? null : revision.getFileName(), uploadedName, "-")),
                new AuditTrailChangeResponse("fileType", "-", firstNonBlank(revision == null ? null : revision.getFileType(), "-")),
                new AuditTrailChangeResponse("fileSizeBytes", "-", uploadedSize >= 0 ? String.valueOf(uploadedSize) : String.valueOf(revision == null ? 0 : revision.getFileSize())),
                new AuditTrailChangeResponse("serverDetectedContentType", "-", validatedFile == null ? "DOCX template" : validatedFile.detectedContentType()),
                new AuditTrailChangeResponse("docxOoxmlValidation", "-", "PASSED"),
                new AuditTrailChangeResponse("malwareScan", "-", validatedFile == null
                        ? "Previously validated template source"
                        : validatedFile.malwareScanPerformed() ? "CLEAN" : "DISABLED_BY_CONFIGURATION"),
                new AuditTrailChangeResponse("sourceStorageProvider", "-", firstNonBlank(revision == null ? null : revision.getSourceStorageProvider(), "-")),
                new AuditTrailChangeResponse("Source Storage Reference", "-", revisionStorageReference(revision)),
                new AuditTrailChangeResponse("sourceFileChecksum", "-", firstNonBlank(revision == null ? null : revision.getSourceFileChecksum(), "-")),
                new AuditTrailChangeResponse("previewFilePath", firstNonBlank(revision == null ? null : revision.getPreviewFilePath(), "-"), "-")
        );
    }


    /**
     * Audit views are business-facing. Keep object-key UUIDs in persisted storage metadata for
     * retrieval and traceability, but present the stable document/revision reference to users.
     */
    private String revisionStorageReference(DocumentRevisionRecord revision) {
        if (revision == null) {
            return "-";
        }
        String documentNumber = firstNonBlank(revision.getDocumentNumber(), "Document");
        String revisionNumber = firstNonBlank(revision.getRevisionNumber(), "-");
        String provider = firstNonBlank(revision.getSourceStorageProvider(), "storage");
        return provider + " Â· " + documentNumber + " Â· Rev. " + revisionNumber;
    }

    private void storeRevisionFile(
            DocumentRevisionRecord revision,
            MultipartFile file,
            RevisionUploadFileValidator.ValidatedRevisionFile validatedFile
    ) throws IOException {
        String previousFilePath = revision.getFilePath();
        String previousPreviewPath = revision.getPreviewFilePath();
        String safeOriginalName = sanitizeFileName(file.getOriginalFilename());
        FileStorageService.StorageWriteResult target = fileStorageService.storeRevisionSourceFile(
                revision.getId(),
                safeOriginalName,
                file.getInputStream(),
                revision.getDocumentNumber(),
                revision.getRevisionNumber()
        );

        revision.setFileName(safeOriginalName);
        revision.setFilePath(target.storedPath());
        revision.setPreviewFilePath(null);
        if (!validatedFile.sha256().equalsIgnoreCase(target.checksum())) {
            deleteInvalidStoredFile(target.storedPath());
            throw new RevisionUploadValidationException(
                    "REVISION_FILE_INTEGRITY_MISMATCH",
                    "The DOCX file changed while it was being stored. Please upload it again."
            );
        }

        revision.setFileType(validatedFile.detectedContentType());
        revision.setFileSize(file.getSize());
        revision.setSourceStorageProvider(target.provider());
        revision.setSourceStorageBucket(target.bucket());
        revision.setSourceStorageObjectKey(target.objectKey());
        revision.setSourceStorageVersionId(target.versionId());
        revision.setSourceFileChecksum(target.checksum());
        revision.setSourceUploadedAt(Instant.now());
        cleanupNasStagingArtifacts(target, null);
        deleteReplacedStoredFile(previousFilePath, target.storedPath());
        deleteReplacedStoredFile(previousPreviewPath, null);
    }

    private RevisionUploadFileValidator.ValidatedRevisionFile validateRevisionUpload(
            UserAccount currentUser,
            DocumentRecord document,
            DocumentRevisionRecord revision,
            MultipartFile file
    ) {
        return validateRevisionUpload(currentUser, document, revision, file, false);
    }

    private RevisionUploadFileValidator.ValidatedRevisionFile validateRevisionUpload(
            UserAccount currentUser,
            DocumentRecord document,
            DocumentRevisionRecord revision,
            MultipartFile file,
            boolean allowPdf
    ) {
        try {
            return revisionUploadFileValidator.validate(file, allowPdf);
        } catch (RevisionUploadValidationException ex) {
            revisionUploadSecurityAuditService.recordRejected(
                            currentUser, document, null, file, ex.getCode(), ex.getMessage()
            );
            throw ex;
        } catch (ClamAvScanService.VirusScanUnavailableException ex) {
            revisionUploadSecurityAuditService.recordRejected(
                            currentUser, document, null, file, "VIRUS_SCAN_UNAVAILABLE", ex.getMessage()
            );
            throw ex;
        }
    }

    /** Office Online is an external storage boundary; downloaded bytes are never trusted implicitly. */
    private RevisionUploadFileValidator.ValidatedRevisionFile validateOfficeOnlineSyncedFile(
            UserAccount currentUser,
            DocumentRevisionRecord revision,
            String fileName,
            byte[] content
    ) {
        try {
            return revisionUploadFileValidator.validateStoredDocx(fileName, content);
        } catch (RevisionUploadValidationException ex) {
            revisionUploadSecurityAuditService.recordRejected(
                    currentUser,
                    revision.getDocument(),
                    revision,
                    fileName,
                    "application/octet-stream",
                    content == null ? 0L : content.length,
                    ex.getCode(),
                    ex.getMessage()
            );
            throw ex;
        } catch (ClamAvScanService.VirusScanUnavailableException ex) {
            revisionUploadSecurityAuditService.recordRejected(
                    currentUser,
                    revision.getDocument(),
                    revision,
                    fileName,
                    "application/octet-stream",
                    content == null ? 0L : content.length,
                    "VIRUS_SCAN_UNAVAILABLE",
                    ex.getMessage()
            );
            throw ex;
        }
    }

    private void validateRevisionSourceForOfficeOnline(
            DocumentRevisionRecord revision,
            UserAccount currentUser,
            Path sourcePath
    ) {
        try {
            String fileName = StringUtils.hasText(revision.getFileName())
                    ? revision.getFileName()
                    : sourcePath.getFileName().toString();
            validateOfficeOnlineSyncedFile(currentUser, revision, fileName, Files.readAllBytes(sourcePath));
        } catch (IOException ex) {
            throw new IllegalStateException("Revision source file could not be validated for Office Online", ex);
        }
    }

    /**
     * Re-composes the published PDF from the revision's stored publishing template/layout.
     * Restores the "Refresh Published PDF" button (FE: DetailRevisionView.tsx handleRegeneratePdf),
     * whose endpoint (POST /revisions/{id}/regenerate-snapshot) previously did not exist on the
     * backend and always failed with 404 regardless of the caller's permissions.
     *
     * #4: queues the actual composition asynchronously (see regeneratePublishingSnapshotIfConfigured)
     * instead of running the multi-minute-capable Graph round trip inline on this request thread.
     * The response carries previewStatus="GENERATING" when queued; FE polls it via the same
     * pollSnapshotInBackground helper already used for the review-snapshot pipeline.
     */
    @Transactional
    public RevisionDetailResponse regenerateSnapshot(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.REGENERATE_SNAPSHOT,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        regeneratePublishingSnapshotIfConfigured(revision, currentUser, "REVIEW_SNAPSHOT_REGENERATED");
        return toDetailResponse(revision);
    }

    /**
     * No-ops if no Publishing template is configured for this revision (nothing to regenerate).
     * Otherwise marks the metadata GENERATING and publishes {@link PublishingSnapshotRegenerationEvent}
     * -- {@link RevisionPublishingSnapshotAsyncService} does the actual Graph composition + storage
     * + audit trail (success or failure) off the request thread, AFTER this transaction commits.
     * Safe to call from every workflow-transition call site unconditionally: queuing is cheap and
     * synchronous, so none of them need to change to stay best-effort/non-blocking.
     */
    private void regeneratePublishingSnapshotIfConfigured(DocumentRevisionRecord revision, UserAccount currentUser, String actionLabel) {
        if (revision == null || revision.getId() == null) {
            return;
        }
        RevisionPublishingMetadata metadata = publishingMetadataRepository.findByRevision_Id(revision.getId()).orElse(null);
        if (metadata == null
                || metadata.getPublishingTemplate() == null
                || !StringUtils.hasText(metadata.getSelectedPublishingLayout())) {
            return;
        }
        UUID requestId = UUID.randomUUID();
        metadata.setPreviewGenerationStatus("GENERATING");
        metadata.setPreviewGenerationRequestId(requestId);
        metadata.setPreviewGenerationError(null);
        publishingMetadataRepository.save(metadata);
        eventPublisher.publishEvent(new PublishingSnapshotRegenerationEvent(
                revision.getId(),
                currentUser == null ? null : currentUser.getId(),
                actionLabel,
                requestId
        ));
    }

    /**
     * Renders the immutable, source-only PDF used by the Review/Approval workflow from the
     * revision's currently-locked source file. Used by {@link RevisionSnapshotAsyncService} to
     * generate the review snapshot asynchronously after "Complete Editing".
     */
    public byte[] renderReviewSnapshotSource(UUID revisionId) throws IOException {
        DocumentRevisionRecord revision = requireRevisionForSnapshot(revisionId);
        Path sourcePath = resolveRevisionSourceFile(revision);
        if (sourcePath == null) {
            throw new IllegalArgumentException("Revision source file not found for review snapshot rendering");
        }
        String displayName = StringUtils.hasText(revision.getFileName())
                ? revision.getFileName()
                : sourcePath.getFileName().toString();
        String normalizedName = displayName.toLowerCase(Locale.ROOT);
        if (normalizedName.endsWith(".pdf") || "application/pdf".equalsIgnoreCase(revision.getFileType())) {
            return Files.readAllBytes(sourcePath);
        }
        if (isImageFile(displayName, revision.getFileType())) {
            Path tempPreview = Files.createTempFile("review-snapshot-", ".pdf");
            try {
                createPdfPreviewFromImage(sourcePath, tempPreview);
                return Files.readAllBytes(tempPreview);
            } finally {
                Files.deleteIfExists(tempPreview);
            }
        }
        return convertOfficeDocumentToPdf(revision, sourcePath, displayName);
    }

    private Path resolveRevisionSourceFile(DocumentRevisionRecord revision) {
        if (revision == null) {
            return null;
        }

        Path directPath = resolveStoredRevisionPath(revision.getFilePath());
        if (directPath != null) {
            return directPath;
        }

        Path previewPath = resolveStoredRevisionPath(revision.getPreviewFilePath());
        if (previewPath != null) {
            return previewPath;
        }

        Path revisionDir = REVISION_STORAGE_ROOT.resolve(revision.getId().toString());
        if (!Files.isDirectory(revisionDir)) {
            return null;
        }

        try (var stream = Files.list(revisionDir)) {
            List<Path> candidates = stream
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
                        return !name.equals("preview.pdf") && !name.equals("preview.png") && !name.equals("preview.jpg");
                    })
                    .sorted((left, right) -> {
                        try {
                            FileTime leftTime = Files.getLastModifiedTime(left);
                            FileTime rightTime = Files.getLastModifiedTime(right);
                            return rightTime.compareTo(leftTime);
                        } catch (IOException ex) {
                            return right.getFileName().toString().compareToIgnoreCase(left.getFileName().toString());
                        }
                    })
                    .toList();

            if (candidates.isEmpty()) {
                return null;
            }

            Path resolved = candidates.get(0);
            revision.setFilePath(resolved.toAbsolutePath().toString());
            if (!StringUtils.hasText(revision.getFileName())) {
                revision.setFileName(resolved.getFileName().toString());
            }
            return resolved;
        } catch (IOException ex) {
            log.warn("Failed to resolve revision source file from storage folder for revision {}", revision.getId(), ex);
            return null;
        }
    }

    private DocumentRevisionRecord requireTemplateRevision(
            UUID templateRevisionId,
            DocumentRecord targetDocument,
            UserAccount currentUser
    ) {
        // documents.template.manage and documents.template.use were retired: creating/marking a Template rides on the
        // document-create permission (see DocumentService#createDocumentDraft), selecting one rides on the upload permission.
        if (currentUser == null || !permissionEvaluationService.hasPermission(currentUser, "documents.revision.upload_source")) {
            throw new AccessDeniedException("TEMPLATE_USE_DENIED: Current user is not allowed to use controlled document templates");
        }
        DocumentRevisionRecord templateRevision = requireRevision(templateRevisionId);
        DocumentRecord templateDocument = templateRevision.getDocument();
        if (templateDocument == null) {
            throw new IllegalStateException("Template revision is not linked to a document");
        }
        if (!templateDocument.isTemplate()) {
            throw new IllegalArgumentException("Selected document is not marked as a template");
        }
        if (templateDocument.getStatus() == null || !"ACTIVE".equalsIgnoreCase(templateDocument.getStatus().getCode())) {
            throw new IllegalArgumentException("Template document must be active");
        }
        if (targetDocument == null || targetDocument.getDocumentType() == null || templateDocument.getDocumentType() == null) {
            throw new IllegalArgumentException("Document type is required to use a template");
        }
        if (!Objects.equals(targetDocument.getDocumentType().getId(), templateDocument.getDocumentType().getId())) {
            throw new IllegalArgumentException("TEMPLATE_TYPE_MISMATCH: Selected template must have the same document type as the target document");
        }
        String templateSubType = normalize(templateDocument.getSubType());
        String targetSubType = normalize(targetDocument.getSubType());
        if (StringUtils.hasText(templateSubType) && !Objects.equals(templateSubType.toLowerCase(Locale.ROOT),
                targetSubType == null ? null : targetSubType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("TEMPLATE_SUBTYPE_MISMATCH: Selected template must have the same sub-type as the target document");
        }
        DocumentRevisionRecord currentEffectiveRevision = revisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(templateDocument.getId(), "EFFECTIVE")
                .orElse(null);
        if (currentEffectiveRevision == null || !Objects.equals(currentEffectiveRevision.getId(), templateRevision.getId())) {
            throw new IllegalArgumentException("Selected template must use the current effective revision");
        }
        if (!StringUtils.hasText(templateRevision.getFilePath())) {
            throw new IllegalArgumentException("Selected template revision does not have a file");
        }
        if (!isDocxTemplate(templateRevision)) {
            throw new IllegalArgumentException("Selected template must be a DOCX file to support online editing");
        }
        if (!StringUtils.hasText(templateRevision.getSourceFileChecksum())) {
            throw new IllegalStateException("TEMPLATE_SOURCE_INVALID: Selected template does not have a verified source checksum");
        }
        return templateRevision;
    }

    private void recordTemplateLineage(
            DocumentRevisionRecord source,
            DocumentRevisionRecord target,
            UserAccount selectedBy
    ) {
        if (source == null || target == null || target.getSourceFileChecksum() == null) {
            throw new IllegalStateException("TEMPLATE_SOURCE_INVALID: Template clone provenance is incomplete");
        }
        DocumentRevisionTemplateLineage lineage = new DocumentRevisionTemplateLineage();
        // `target` was created with a pre-assigned id and a primitive @Version, so revisionRepository.save() merged it
        // and returned a different managed copy; the FK must point at that managed copy, not this detached instance.
        lineage.setTargetRevision(revisionRepository.getReferenceById(target.getId()));
        lineage.setSourceTemplateDocument(source.getDocument());
        lineage.setSourceTemplateRevision(source);
        lineage.setSourceTemplateRevisionNumber(source.getRevisionNumber());
        lineage.setSourceFileChecksum(source.getSourceFileChecksum());
        lineage.setSourceStorageProvider(source.getSourceStorageProvider());
        lineage.setSourceStorageBucket(source.getSourceStorageBucket());
        lineage.setSourceStorageObjectKey(source.getSourceStorageObjectKey());
        lineage.setSourceStorageVersionId(source.getSourceStorageVersionId());
        lineage.setTargetFileChecksum(target.getSourceFileChecksum());
        lineage.setSelectedBy(selectedBy);
        lineage.setPlaceholderSnapshot(new LinkedHashMap<>(buildTemplatePlaceholders(source, target)));
        templateLineageRepository.save(lineage);
        auditTrailService.logAs(
                selectedBy,
                "REVISION",
                target.getRevisionNumber() + " - " + target.getDocumentName(),
                target.getId(),
                "CREATE_FROM_TEMPLATE",
                null,
                target.getStatus() == null ? null : target.getStatus().getCode(),
                "Created from controlled document template " + safeDocumentLabel(source.getDocument()),
                List.of(
                        new AuditTrailChangeResponse("Template Revision", null, source.getRevisionNumber()),
                        new AuditTrailChangeResponse("Template Source Checksum", null, source.getSourceFileChecksum()),
                        new AuditTrailChangeResponse("Generated Source Checksum", null, target.getSourceFileChecksum())
                )
        );
    }

    private RevisionUploadFileValidator.ValidatedRevisionFile cloneRevisionFile(
            DocumentRevisionRecord source,
            DocumentRevisionRecord target
    ) {
        if (source == null || !StringUtils.hasText(source.getFilePath())) {
            throw new RevisionUploadValidationException("REVISION_FILE_REQUIRED", "Template revision does not have a DOCX source file.");
        }
        Path sourcePath = null;
        Path preparedSourcePath = null;
        try {
            sourcePath = fileStorageService.materializeStoredFile(source.getFilePath());
            if (sourcePath == null || !Files.exists(sourcePath)) {
                throw new RevisionUploadValidationException("REVISION_FILE_NOT_FOUND", "Template DOCX source file was not found.");
            }
            String sourceName = StringUtils.hasText(source.getFileName()) ? source.getFileName() : sourcePath.getFileName().toString();
            preparedSourcePath = prepareTemplateSourceFile(source, target, sourcePath);
            RevisionUploadFileValidator.ValidatedRevisionFile validatedFile = revisionUploadFileValidator.validateStoredDocx(
                    sourceName,
                    Files.readAllBytes(preparedSourcePath)
            );
            FileStorageService.StorageWriteResult targetFile;
            try (InputStream inputStream = Files.newInputStream(preparedSourcePath)) {
                targetFile = fileStorageService.storeRevisionSourceFile(target.getId(), sanitizeFileName(sourceName), inputStream, target.getDocumentNumber(), target.getRevisionNumber());
            }
            if (!validatedFile.sha256().equalsIgnoreCase(targetFile.checksum())) {
                deleteInvalidStoredFile(targetFile.storedPath());
                throw new RevisionUploadValidationException(
                        "REVISION_FILE_INTEGRITY_MISMATCH",
                        "The DOCX template changed while it was being stored. Please try again."
                );
            }
            target.setFilePath(targetFile.storedPath());
            target.setPreviewFilePath(null);

            target.setFileName(sourceName);
            target.setFileType(validatedFile.detectedContentType());
            target.setFileSize(Files.size(preparedSourcePath));
            target.setSourceStorageProvider(targetFile.provider());
            target.setSourceStorageBucket(targetFile.bucket());
            target.setSourceStorageObjectKey(targetFile.objectKey());
            target.setSourceStorageVersionId(targetFile.versionId());
            target.setSourceFileChecksum(targetFile.checksum());
            target.setSourceUploadedAt(Instant.now());
            revisionRepository.save(target);
            return validatedFile;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to clone template file", ex);
        } finally {
            cleanupTemporaryTemplateFile(preparedSourcePath, sourcePath);
        }
    }

    private Path prepareTemplateSourceFile(DocumentRevisionRecord source, DocumentRevisionRecord target, Path sourcePath) throws IOException {
        if (!isDocxTemplate(source)) {
            return sourcePath;
        }
        Path temporaryTarget = Files.createTempFile("template-revision-", ".docx");
        Map<String, String> replacements = buildTemplatePlaceholders(source, target);
        try (ZipInputStream zipInputStream = new ZipInputStream(Files.newInputStream(sourcePath));
             ZipOutputStream zipOutputStream = new ZipOutputStream(Files.newOutputStream(temporaryTarget))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                ZipEntry nextEntry = new ZipEntry(entry.getName());
                zipOutputStream.putNextEntry(nextEntry);
                byte[] bytes = zipInputStream.readAllBytes();
                if (entry.getName().endsWith(".xml") || entry.getName().endsWith(".rels")) {
                    String content = new String(bytes, StandardCharsets.UTF_8);
                    for (Map.Entry<String, String> replacement : replacements.entrySet()) {
                        content = content.replace(replacement.getKey(), replacement.getValue());
                    }
                    zipOutputStream.write(content.getBytes(StandardCharsets.UTF_8));
                } else {
                    zipOutputStream.write(bytes);
                }
                zipOutputStream.closeEntry();
                zipInputStream.closeEntry();
            }
        } catch (IOException ex) {
            Files.deleteIfExists(temporaryTarget);
            throw ex;
        }
        return temporaryTarget;
    }

    private boolean isDocxTemplate(DocumentRevisionRecord revision) {
        String fileName = revision == null ? null : revision.getFileName();
        String fileType = revision == null ? null : revision.getFileType();
        String normalizedName = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        String normalizedType = fileType == null ? "" : fileType.toLowerCase(Locale.ROOT);
        return normalizedName.endsWith(".docx")
                || normalizedType.contains("wordprocessingml.document");
    }

    private Map<String, String> buildTemplatePlaceholders(DocumentRevisionRecord source, DocumentRevisionRecord target) {
        Map<String, String> replacements = new LinkedHashMap<>();
        replacements.put("{{DOCUMENT_NUMBER}}", safeTemplateValue(target == null ? null : target.getDocumentNumber()));
        replacements.put("{{DOCUMENT_NAME}}", safeTemplateValue(target == null ? null : target.getDocumentName()));
        replacements.put("{{REVISION_NUMBER}}", safeTemplateValue(target == null ? null : target.getRevisionNumber()));
        replacements.put("{{AUTHOR}}", safeTemplateValue(target == null || target.getAuthor() == null ? null : target.getAuthor().getFullName()));
        replacements.put("{{CREATED_DATE}}", DateTimeFormatUtils.formatDateTime(Instant.now()));
        return replacements;
    }

    private String safeTemplateValue(String value) {
        return StringUtils.hasText(value) ? value : "";
    }

    private void cleanupTemporaryTemplateFile(Path preparedSourcePath, Path originalSourcePath) {
        if (preparedSourcePath != null && !Objects.equals(preparedSourcePath, originalSourcePath)) {
            try {
                Files.deleteIfExists(preparedSourcePath);
            } catch (IOException ex) {
                log.debug("Failed to delete temporary template file {}", preparedSourcePath, ex);
            }
        }
    }

    private Path buildPreviewFile(DocumentRevisionRecord revision, MultipartFile file, Path sourcePath, Path revisionDir, String displayName) throws IOException {
        String originalName = sanitizeFileName(file.getOriginalFilename());
        return buildPreviewFileFromPath(revision, sourcePath, revisionDir, StringUtils.hasText(displayName) ? displayName : originalName, file.getContentType());
    }

    private Path buildPreviewFileFromPath(DocumentRevisionRecord revision, Path sourcePath, Path revisionDir, String displayName, String contentType) throws IOException {
        String originalName = sanitizeFileName(displayName);
        String normalizedName = originalName.toLowerCase(Locale.ROOT);
        Path previewTarget = revisionDir.resolve("preview.pdf");

        if (normalizedName.endsWith(".pdf") || "application/pdf".equalsIgnoreCase(contentType)) {
            Files.copy(sourcePath, previewTarget, StandardCopyOption.REPLACE_EXISTING);
            return previewTarget;
        }

        if (isImageFile(originalName, contentType)) {
            createPdfPreviewFromImage(sourcePath, previewTarget);
            return previewTarget;
        }

        byte[] converted = convertOfficeDocumentToPdf(revision, sourcePath, displayName);
        if (converted != null && converted.length > 0) {
            Files.write(previewTarget, converted, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            return previewTarget;
        }

        throw new IllegalStateException("Unable to convert the uploaded file to PDF preview.");
    }

    private boolean isImageFile(String fileName, String contentType) {
        String normalizedName = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        String normalizedType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        return normalizedType.startsWith("image/") || normalizedName.matches(".*\\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff)$");
    }

    private void createPdfPreviewFromImage(Path sourcePath, Path previewTarget) throws IOException {
        BufferedImage image = ImageIO.read(sourcePath.toFile());
        if (image == null) {
            throw new IllegalArgumentException("Unable to read image for PDF conversion");
        }

        try (PDDocument pdf = new PDDocument()) {
            PDRectangle pageSize = new PDRectangle(image.getWidth(), image.getHeight());
            PDPage page = new PDPage(pageSize);
            pdf.addPage(page);

            PDImageXObject pdImage = LosslessFactory.createFromImage(pdf, image);
            try (PDPageContentStream contentStream = new PDPageContentStream(pdf, page)) {
                contentStream.drawImage(pdImage, 0, 0, pageSize.getWidth(), pageSize.getHeight());
            }

            pdf.save(previewTarget.toFile());
        }
    }

    /**
     * Converts via OnlyOffice's ConvertService, which reads {@code revision}'s current
     * MinIO-stored file directly ({@code revision.getFilePath()}) rather than the passed
     * {@code sourcePath}/{@code displayName} -- fine for every live caller (they always pass the
     * revision's own already-stored source file), which is why those parameters are otherwise
     * unused here now that Graph (which needed an explicit upload-then-convert step) is gone.
     */
    private byte[] convertOfficeDocumentToPdf(DocumentRevisionRecord revision, Path sourcePath, String displayName) throws IOException {
        try {
            // Convert from the already-materialized file, not from the revision's own source-file URL:
            // OnlyOffice fetches that URL over HTTP in a separate transaction, so it cannot see a
            // revision created (and not yet committed) by the caller -- e.g. Legacy Import, which
            // renders each published PDF inside the same transaction that creates the revision.
            return onlyOfficeDocumentEditService.convertLocalFileToPdf(sourcePath, displayName);
        } catch (RuntimeException ex) {
            throw new IOException("Failed to convert revision file to PDF via OnlyOffice", ex);
        }
    }

    private String sanitizeFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "revision-file";
        }
        return fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private RevisionStatusDefinition requireRevisionStatus(String code) {
        return revisionStatusRepository.findById(code)
                .orElseThrow(() -> new IllegalStateException("Revision status not configured: " + code));
    }

    private void ensureNoRevisionInProgress(UUID documentId, UUID allowedRevisionId) {
        boolean exists = allowedRevisionId == null
                ? revisionRepository.existsByDocument_IdAndStatus_CodeIn(documentId, IN_PROGRESS_REVISION_STATUS_CODES)
                : revisionRepository.existsByDocument_IdAndStatus_CodeInAndIdNot(documentId, IN_PROGRESS_REVISION_STATUS_CODES, allowedRevisionId);
        if (exists) {
            throw new IllegalStateException(REVISION_IN_PROGRESS_MESSAGE);
        }
    }

    private String resolveNextDraftRevisionNumber(UUID documentId) {
        return revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(documentId)
                .stream()
                .map(DocumentRevisionRecord::getRevisionNumber)
                .filter(StringUtils::hasText)
                .map(this::normalizeVersionFormat)
                .max(this::compareRevisionNumbers)
                .map(this::incrementPatchVersion)
                .orElseGet(this::defaultRevisionSeed);
    }

    private String resolveNextDraftRevisionNumberFromEffective(String effectiveRevisionNumber) {
        String normalized = normalizeVersionFormat(effectiveRevisionNumber);
        int major = parseVersionPart(normalized, 0);
        int patch = lastNumericPart(normalized);
        return isTwoPartRevisionNumber(normalized)
                ? major + "." + (patch + 1)
                : major + ".0." + (patch + 1);
    }

    private int compareRevisionNumbers(String left, String right) {
        int majorCompare = Integer.compare(parseVersionPart(left, 0), parseVersionPart(right, 0));
        if (majorCompare != 0) {
            return majorCompare;
        }
        // Patch is the LAST segment in both families ("1.0.2" and "1.2").
        return Integer.compare(lastNumericPart(left), lastNumericPart(right));
    }

    private DocumentStatusDefinition requireDocumentStatus(String code) {
        return documentStatusRepository.findById(code)
                .orElseThrow(() -> new IllegalStateException("Document status not configured: " + code));
    }

    private DocumentRevisionRecord requireRevision(UUID id) {
        return revisionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
    }

    /** Same lookup, but row-locked (PESSIMISTIC_WRITE) for the two call sites that race each
     *  other over the same "is this revision's source still editable" decision:
     *  {@link #completeEditing} (locks the source + revokes Office Online edit access) and
     *  {@link #getOfficeOnlineEditLink} (grants it). Holding the row lock for the duration of
     *  each transaction means whichever commits first is guaranteed the other sees its result
     *  before deciding, instead of both reading the pre-lock state concurrently. */
    private DocumentRevisionRecord requireRevisionForUpdate(UUID id) {
        return revisionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
    }

    public DocumentRevisionRecord requireRevisionForSnapshot(UUID id) {
        return requireRevision(id);
    }

    public RevisionStoragePaths getRevisionStoragePaths(UUID id) {
        DocumentRevisionRecord revision = requireRevision(id);
        return new RevisionStoragePaths(revision.getFilePath(), revision.getPreviewFilePath());
    }

    public record RevisionStoragePaths(String filePath, String previewFilePath) {}

    public DocumentRecord requireDocumentForSnapshot(UUID id) {
        return requireDocument(id);
    }

    private DocumentRecord requireDocument(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
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

    private String resolveSortProperty(String sortBy) {
        if (!StringUtils.hasText(sortBy)) {
            return "revisionName";
        }
        return switch (sortBy) {
            case "documentNumber" -> "documentNumber";
            case "revisionNumber", "version" -> "revisionNumber";
            case "created" -> "createdAt";
            case "openedBy" -> "openedBy.fullName";
            case "revisionName" -> "revisionName";
            case "state", "status" -> "status.sortOrder";
            case "documentName" -> "documentName";
            case "type" -> "documentType.name";
            case "businessUnit" -> "businessUnit.name";
            case "department" -> "department.name";
            case "author" -> "author.fullName";
            case "effectiveDate" -> "effectiveDate";
            case "validUntil" -> "validUntil";
            default -> "revisionName";
        };
    }

    private void addLookupPredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<?> idPath,
            jakarta.persistence.criteria.Path<String> namePath,
            jakarta.persistence.criteria.Path<String> shortCodePath,
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
                cb.equal(cb.lower(namePath), normalized.replace("_", " ")),
                cb.equal(cb.lower(shortCodePath), normalized),
                cb.equal(cb.lower(shortCodePath), normalized.replace("-", "")),
                cb.equal(cb.lower(shortCodePath), normalized.replace("_", ""))
        ));
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

    private UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private String incrementVersion(String version) {
        if (!StringUtils.hasText(version)) {
            return "0.0.1";
        }
        String[] parts = version.split("\\.");
        if (parts.length == 0) {
            return version;
        }
        try {
            int last = Integer.parseInt(parts[parts.length - 1]);
            parts[parts.length - 1] = String.valueOf(last + 1);
            return String.join(".", parts);
        } catch (NumberFormatException ex) {
            return version + ".1";
        }
    }

    private String promoteToNextMajorVersion(String version) {
        String normalized = normalizeVersionFormat(version);
        int nextMajor = parseVersionPart(normalized, 0) + 1;
        if (nextMajor <= 0) {
            nextMajor = 1;
        }
        return isTwoPartRevisionNumber(normalized)
                ? nextMajor + ".0"
                : String.format("%d.0.0", nextMajor);
    }

    private String incrementPatchVersion(String version) {
        // Three-part family: A.0.B (middle always 0). Two-part family: A.B. Patch increments,
        // major is preserved; the incoming string's part-count determines the family.
        String normalized = normalizeVersionFormat(version);
        int major = parseVersionPart(normalized, 0);
        int patch = lastNumericPart(normalized) + 1;
        return isTwoPartRevisionNumber(normalized)
                ? major + "." + patch
                : String.format("%d.0.%d", major, patch);
    }

    /** True when a revision number belongs to the two-part family (e.g. "1.2" vs "1.0.2"). */
    private boolean isTwoPartRevisionNumber(String version) {
        return StringUtils.hasText(version) && version.trim().split("\\.", -1).length <= 2;
    }

    /** Numeric value of the final dot-separated segment ("1.0.2" -> 2, "1.3" -> 3). */
    private int lastNumericPart(String version) {
        if (!StringUtils.hasText(version)) {
            return 0;
        }
        String[] parts = version.trim().split("\\.");
        return parseVersionPart(version, parts.length - 1);
    }

    private int parseVersionPart(String version, int index) {
        if (!StringUtils.hasText(version)) {
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

    /**
     * Canonicalises a revision number while PRESERVING its format family (part count):
     *   two-part  "0.1"  -> "0.1",   "1.0"   -> "1.0"
     *   three-part "0.0.1" -> "0.0.1", "1.0.0" -> "1.0.0", "0.1.0" -> "0.0.1"
     * A blank value resolves to the admin-configured seed ("0.0.1" or "0.1").
     */
    /** Admin-configured first-revision seed ("0.0.1" or "0.1"); "0.0.1" when config is unavailable. */
    private String defaultRevisionSeed() {
        return systemConfigurationService == null ? "0.0.1" : systemConfigurationService.getRevisionNumberSeed();
    }

    private String normalizeVersionFormat(String version) {
        if (!StringUtils.hasText(version)) {
            return defaultRevisionSeed();
        }
        String trimmed = version.trim();
        String[] parts = trimmed.split("\\.", -1);
        int major = parseSafePart(parts, 0);
        if (parts.length <= 2) {
            // Two-part family: "major.patch" kept as-is (patch = 2nd segment).
            return major + "." + parseSafePart(parts, 1);
        }
        // Three-part family: middle part is always 0. If the middle was non-zero and the
        // last part is 0 (e.g. "0.1.0"), treat the middle as the patch.
        int middle = parseSafePart(parts, 1);
        int patch = parseSafePart(parts, 2);
        if (middle != 0 && patch == 0) {
            patch = middle;
        }
        return String.format("%d.0.%d", major, patch);
    }

    private DocumentParticipantResponse toParticipantResponse(RevisionWorkflowParticipant participant) {
        UserAccount user = participant == null ? null : participant.getUser();
        return new DocumentParticipantResponse(
                user == null ? null : user.getId().toString(),
                user == null ? null : user.getFullName(),
                user == null ? null : user.getUsername(),
                user == null ? null : user.getPosition(),
                user == null ? null : user.getEmail(),
                user == null ? null : user.getDepartment(),
                participant == null ? null : participant.getSequenceOrder(),
                participant == null ? null : participant.getActionStatus(),
                participant == null || participant.getActedAt() == null ? null : DateTimeFormatUtils.formatDateTime(participant.getActedAt()),
                participant == null ? null : participant.getActionComment(),
                user == null || user.getStatus() == null ? null : user.getStatus().name()
        );
    }

    private RevisionWorkingNoteResponse toWorkingNoteResponse(RevisionWorkingNote note, UserAccount currentUser) {
        UserAccount author = note == null ? null : note.getCreatedBy();
        DocumentRevisionRecord revision = note == null ? null : note.getRevision();
        String activeStage = resolveWorkingNoteStage(revision);
        boolean canDelete = currentUser != null
                  && currentUser.getId() != null
                  && author != null
                  && author.getId() != null
                  && Objects.equals(currentUser.getId(), author.getId())
                  && note.getWorkflowStage() != null
                  && note.getWorkflowStage().equalsIgnoreCase(activeStage)
                  && canWriteWorkingNotes(revision, currentUser);
        return new RevisionWorkingNoteResponse(
                note == null || note.getId() == null ? null : note.getId().toString(),
                author == null ? null : author.getFullName(),
                author == null ? null : author.getUsername(),
                  note == null || note.getCreatedAt() == null ? null : DateTimeFormatUtils.formatDateTime(note.getCreatedAt()),
                  note == null ? null : note.getNoteText(),
                  note == null ? null : note.getWorkflowStage(),
                  workingNoteStageLabel(note == null ? null : note.getWorkflowStage()),
                  canDelete
          );
      }

    private String requireWorkingNoteWriteAccess(DocumentRevisionRecord revision, UserAccount currentUser) {
        String stage = resolveWorkingNoteStage(revision);
        if (stage == null || !canWriteWorkingNotes(revision, currentUser)) {
            throw new AccessDeniedException("Working notes are read-only for the current workflow stage");
        }
        return stage;
    }

    /** Public wrapper so RevisionActionCapabilityService can expose addWorkingNote/deleteWorkingNote
     *  in the unified capability contract, backed by the same check requireWorkingNoteWriteAccess
     *  already enforces on the mutation. */
    public boolean canCurrentUserWriteWorkingNotes(DocumentRevisionRecord revision, UserAccount currentUser) {
        return canWriteWorkingNotes(revision, currentUser);
    }

    private boolean canWriteWorkingNotes(DocumentRevisionRecord revision, UserAccount currentUser) {
        if (revision == null || currentUser == null || currentUser.getId() == null) {
            return false;
        }
        String stage = resolveWorkingNoteStage(revision);
        String participantType = "REVIEW".equals(stage)
                ? "REVIEWER"
                : "APPROVAL".equals(stage) ? "APPROVER" : null;
        if (participantType == null) {
            return false;
        }
        return revisionWorkflowParticipantRepository
                .findByRevision_IdAndParticipantTypeAndUser_Id(
                        revision.getId(),
                        participantType,
                        currentUser.getId()
                )
                .filter(participant -> "PENDING".equalsIgnoreCase(participant.getActionStatus()))
                .isPresent();
    }

    private String resolveWorkingNoteStage(DocumentRevisionRecord revision) {
        String status = revision == null || revision.getStatus() == null
                ? null
                : revision.getStatus().getCode();
        if ("PENDING_REVIEW".equalsIgnoreCase(status)) {
            return "REVIEW";
        }
        if ("PENDING_APPROVAL".equalsIgnoreCase(status)) {
            return "APPROVAL";
        }
        return null;
    }

    private String workingNoteStageLabel(String stage) {
        if ("REVIEW".equalsIgnoreCase(stage)) {
            return "Review";
        }
        if ("APPROVAL".equalsIgnoreCase(stage)) {
            return "Approval";
        }
        return "Previous Stage";
    }

    private DocumentRelationResponse toRelationResponse(DocumentRelation relation, String relationType) {
        DocumentRecord target = relation.getTargetDocument();
        String targetVersion = null;
        String targetStatus = target == null || target.getStatus() == null ? null : target.getStatus().getLabel();
        if (target != null) {
            var effectiveRevision = revisionRepository
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
                target == null ? null : buildDocumentDisplayName(target.getDocumentNumber(), target.getDocumentName()),
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

    private void cleanupNasStagingArtifacts(FileStorageService.StorageWriteResult... results) {
        if (results == null || results.length == 0) {
            return;
        }
        for (FileStorageService.StorageWriteResult result : results) {
            if (result == null || result.localPath() == null || result.storedPath() == null) {
                continue;
            }
            String localPath = result.localPath().toAbsolutePath().toString();
            if (localPath.equals(result.storedPath())) {
                continue;
            }
            try {
                Files.deleteIfExists(result.localPath());
            } catch (IOException ex) {
                log.debug("Failed to delete NAS staging file {}", result.localPath(), ex);
            }
        }
    }

    private void deleteReplacedStoredFile(String previousPath, String currentPath) {
        if (!StringUtils.hasText(previousPath) || Objects.equals(previousPath, currentPath)) {
            return;
        }
        if (fileStorageService.isMinioReference(previousPath)) {
            return;
        }
        try {
            fileStorageService.deleteStoredFile(previousPath);
        } catch (IOException ex) {
            log.warn("Failed to delete replaced revision object {}", previousPath, ex);
        }
    }

    /** Invalid content must be removed regardless of whether the configured provider is local, NAS, or MinIO. */
    private void deleteInvalidStoredFile(String storedPath) {
        if (!StringUtils.hasText(storedPath)) {
            return;
        }
        try {
            fileStorageService.deleteStoredFile(storedPath);
        } catch (IOException ex) {
            log.warn("Failed to delete rejected revision object {}", storedPath, ex);
        }
    }

    private void cleanupTemporaryPreview(
            Path previewPath,
            FileStorageService.StorageWriteResult source,
            FileStorageService.StorageWriteResult storedPreview
    ) {
        if (previewPath == null
                || (source != null && previewPath.equals(source.localPath()))
                || (storedPreview != null && previewPath.equals(storedPreview.localPath()))) {
            return;
        }
        try {
            Files.deleteIfExists(previewPath);
        } catch (IOException ex) {
            log.debug("Failed to delete temporary revision preview {}", previewPath, ex);
        }
    }

    private Path resolveStoredRevisionPath(String storedPath) {
        if (!StringUtils.hasText(storedPath)) {
            return null;
        }
        try {
            Path resolvedPath = fileStorageService.materializeStoredFile(storedPath);
            if (Files.exists(resolvedPath)) {
                return resolvedPath;
            }
        } catch (Exception ignored) {
            // Fall through to the revision storage folder or the next candidate.
        }
        return null;
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
}

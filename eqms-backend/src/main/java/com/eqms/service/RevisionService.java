package com.eqms.service;

import com.eqms.auth.TokenService;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentFiltersResponse;
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
import com.eqms.entity.UserStatus;
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
import com.eqms.repository.DocumentWorkflowPoolMemberRepository;
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
import com.eqms.exception.RevisionUploadValidationException;
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
    private final DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository;
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
    private final OfficeOnlineConfigurationService officeOnlineConfigurationService;
    private final MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;
    private final SharePointPathBuilder sharePointPathBuilder;
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
    private final RevisionUploadFileValidator revisionUploadFileValidator;
    private final RevisionUploadSecurityAuditService revisionUploadSecurityAuditService;
    private final DocumentRevisionTemplateLineageRepository templateLineageRepository;

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
            DocumentWorkflowPoolMemberRepository documentWorkflowPoolMemberRepository,
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
            OfficeOnlineConfigurationService officeOnlineConfigurationService,
            MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService,
            SharePointPathBuilder sharePointPathBuilder,
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
            DocumentRevisionTemplateLineageRepository templateLineageRepository
    ) {
        this.revisionRepository = revisionRepository;
        this.revisionStatusRepository = revisionStatusRepository;
        this.documentRepository = documentRepository;
        this.documentStatusRepository = documentStatusRepository;
        this.documentWorkflowParticipantRepository = documentWorkflowParticipantRepository;
        this.documentWorkflowPoolMemberRepository = documentWorkflowPoolMemberRepository;
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
        this.officeOnlineConfigurationService = officeOnlineConfigurationService;
        this.microsoftGraphOfficeOnlineService = microsoftGraphOfficeOnlineService;
        this.sharePointPathBuilder = sharePointPathBuilder;
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

        if (latestRevision == null) {
            document.setStatus(requireDocumentStatus("ACTIVE"));
            documentRepository.save(document);
        }

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

    @Transactional
    public RevisionDetailResponse completeEditing(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
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
        requireValidSignatureToken(request, currentUser, "complete editing");

        if (StringUtils.hasText(revision.getStorageItemId()) && StringUtils.hasText(revision.getStorageDriveId())) {
            syncEditedFileFromOfficeOnlineToMinio(revision, currentUser);
        }
        lockOfficeOnlineEditing(revision, currentUser);
        // This workflow state is required even when no Office Online working copy exists.
        // The lock routine only revokes remote resources; it must not be the source of truth
        // for whether Author editing has been completed.
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
        DocumentRevisionRecord revision = requireRevision(revisionId);
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
        if (!electronicSignatureService.hasRevisionSignatureMeaning(revision, "PREPARED")) {
            throw new IllegalStateException("Revision editing must be completed before submitting for review");
        }
        requireValidSignatureToken(request, currentUser, "submit for review");

        if (StringUtils.hasText(revision.getStorageItemId()) && StringUtils.hasText(revision.getStorageDriveId())) {
            syncEditedFileFromOfficeOnlineToMinio(revision, currentUser);
        }
        refreshPreviewFromUploadedFile(revision);
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

        ReviewRequirement reviewRequirement = revision.getReviewRequirement();
        validateReviewersForRequirement(revision, reviewRequirement);
        boolean hasReviewers = reviewRequirement != ReviewRequirement.NONE;
        boolean hasApprovers = hasParticipants(revision, "APPROVER");
        String targetStatus = hasReviewers
                ? "PENDING_REVIEW"
                : hasApprovers
                ? "PENDING_APPROVAL"
                : revision.isRequiresTraining() ? "PENDING_TRAINING" : "READY_FOR_PUBLISHING";

        if (Objects.equals(targetStatus, "PENDING_APPROVAL")) {
            requirePdfPreviewReady(revision);
        }

        revision.setSubmittedBy(currentUser);
        revision.setSubmittedOn(Instant.now());
        revisionRepository.save(revision);

        lockOfficeOnlineEditing(revision, currentUser);

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
        DocumentRevisionRecord revision = requireRevision(revisionId);
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

        if (Objects.equals(targetStatus, "PENDING_APPROVAL")) {
            requirePdfPreviewReady(revision);
        }

        recordElectronicSignature(revision, currentUser, request, "REVIEWED", "PENDING_REVIEW", targetStatus);
        RevisionDetailResponse updated = updateRevisionStatus(revision, "REVIEW_COMPLETE", targetStatus, request, currentUser);
        regeneratePublishingSnapshotIfConfigured(revision, currentUser, "REVIEW_SNAPSHOT_REGENERATED");
        return updated;
    }

    @Transactional
    public RevisionDetailResponse rejectReview(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.REJECT_REVIEW,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_REVIEW");
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

        reopenOfficeOnlineWorkingCopy(revision, currentUser);
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
        DocumentRevisionRecord revision = requireRevision(revisionId);
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
        DocumentRevisionRecord revision = requireRevision(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.REJECT_APPROVAL,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        requireRevisionStatus(revision, "PENDING_APPROVAL");
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

        reopenOfficeOnlineWorkingCopy(revision, currentUser);
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
        DocumentRevisionRecord revision = requireRevision(revisionId);
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
        DocumentRevisionRecord revision = requireRevision(revisionId);
        revisionWorkflowAuthorizationService.require(
                currentUser,
                revision,
                RevisionWorkflowAction.PUBLISH,
                com.eqms.dto.security.RevisionWorkflowAuthorizationContext.of(revision)
        );
        UUID signatureSessionId = requireValidSignatureToken(request, currentUser, "publish");
        validatePublishableRevision(revision, false);

        DocumentRecord document = requireDocument(revision.getDocument().getId());
        List<DocumentRelation> relatedRelations = documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "Related");

        List<ApiErrorResponse.ErrorDetail> nonEffectiveDetails = new java.util.ArrayList<>();
        StringBuilder warningBuilder = new StringBuilder();

        for (DocumentRelation relation : relatedRelations) {
            DocumentRecord relatedDoc = relation.getTargetDocument();
            if (relatedDoc == null || relatedDoc.getId() == null) {
                continue;
            }

            DocumentRevisionRecord latestRelatedRev = revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(relatedDoc.getId()).orElse(null);
            String statusLabel = "Unknown";
            String statusCode = "UNKNOWN";
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
                // Log warning override decision in audit trail
                String overrideDetail = "Revision published with non-effective Related Documents.\n\n" + warningBuilder.toString();
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

        return toDetailResponse(revision);
    }

    @Transactional
    public RevisionDetailResponse cancelRevision(UUID revisionId, RevisionWorkflowActionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
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
            throw new IllegalStateException("Only Draft revisions can be cancelled");
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

        boolean documentClosed = syncDocumentStatusAfterRevisionCancellation(revision, currentUser, cancelReason);
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

        ensureNoRevisionInProgress(documentId, null);

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        applyRevisionSnapshot(
                revision,
                document,
                currentUser,
                source,
                "Upgraded from revision " + source.getRevisionNumber(),
                resolveNextDraftRevisionNumberFromEffective(source.getRevisionNumber())
        );
        revision.setImpactAnalysisId(impactAnalysisId);
        revision.setDocumentNumber(document.getDocumentNumber());
        revision.setParentRevision(source);
        revisionRepository.save(revision);

        copyWorkflowParticipantsFromDocument(document, revision);
        recordRevisionHistory(revision, "UPGRADE", "EFFECTIVE", revision.getStatus().getCode(), "Upgraded from " + source.getRevisionNumber(), currentUser);
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "UPGRADE",
                "EFFECTIVE",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Upgrade Revision created new Draft Revision. Training configuration copied from Document Master.",
                buildUpgradeTrainingAuditChanges(document)
        );
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
        ensureNoRevisionInProgress(document.getId(), null);
        DocumentRevisionRecord latestRevision = revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(document.getId()).orElse(source);

        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        applyRevisionSnapshot(
                revision,
                document,
                currentUser,
                latestRevision,
                "Upgraded from revision " + source.getRevisionNumber(),
                resolveNextDraftRevisionNumber(document.getId())
        );
        revision.setImpactAnalysisId(impactAnalysisId);
        revision.setParentRevision(source);
        revisionRepository.save(revision);

        copyWorkflowParticipantsFromDocument(document, revision);
        recordRevisionHistory(revision, "UPGRADE", sourceStatus, revision.getStatus().getCode(), "Upgraded from " + source.getRevisionNumber(), currentUser);
        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "UPGRADE",
                sourceStatus,
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Upgrade Revision created new Draft Revision. Training configuration copied from Document Master.",
                buildUpgradeTrainingAuditChanges(document)
        );
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
        List<DocumentRelation> relatedRelations = documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "Related");
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

    private boolean syncDocumentStatusAfterRevisionCancellation(
            DocumentRevisionRecord cancelledRevision,
            UserAccount currentUser,
            String cancelReason
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
                )
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

            obsoleteDistributedControlledCopies(
                    supersededRevision,
                    currentUser,
                    publishedAt,
                    "NEW_REVISION_PUBLISHED",
                    "Controlled Copy Auto Obsoleted By New Revision; Reason: NEW_REVISION_PUBLISHED; Superseded by published revision " + promotedVersion
            );

            recordRevisionHistory(
                    supersededRevision,
                    "OBSOLETE",
                    previousStatus,
                    "OBSOLETED",
                    "Superseded by published revision " + promotedVersion,
                    currentUser
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
        List<DocumentRelation> relatedRelations = documentRelationRepository.findAllBySourceDocument_IdAndRelationType(document.getId(), "Related");
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
            throw new IllegalStateException("Revision must be in " + expectedStatus + " state");
        }
    }

    private LocalDate calculateEffectiveDate(DocumentRevisionRecord revision, Instant publishedAt) {
        if (publishedAt == null) {
            return LocalDate.now(SYSTEM_ZONE);
        }
        return publishedAt.atZone(SYSTEM_ZONE).toLocalDate();
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

    private void requirePdfPreviewReady(DocumentRevisionRecord revision) {
        if (!StringUtils.hasText(revision.getPreviewFilePath())) {
            throw new IllegalStateException("A PDF preview must be generated before the revision can move to Pending Approval");
        }
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
        var parsed = tokenService.parseSignatureToken(request.signatureToken())
                .orElseThrow(() -> new IllegalArgumentException("Electronic signature is invalid or expired"));
        if (!Objects.equals(parsed.principal().userId(), currentUser.getId())) {
            throw new IllegalArgumentException("Electronic signature must belong to the current user");
        }
        return parsed.principal().sessionId();
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
            throw new IllegalStateException("This workflow action has already been completed");
        }
        if ("REVIEWER".equalsIgnoreCase(participantType) || "APPROVER".equalsIgnoreCase(participantType)) {
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
            obsoleteDistributedControlledCopies(
                    revision,
                    currentUser,
                    Instant.now(),
                    "REVISION_OBSOLETED",
                    "Controlled Copy Auto Obsoleted By Revision Obsolete; Reason: REVISION_OBSOLETED"
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

    /**
     * A source revision can be obsoleted by publishing a successor or by a manual workflow
     * action. In either case, only copies still issued to users are invalidated. Closed/Cancelled
     * records are intentionally untouched because their terminal state is part of the GMP trail.
     */
    private void obsoleteDistributedControlledCopies(
            DocumentRevisionRecord sourceRevision,
            UserAccount actor,
            Instant obsoletedAt,
            String obsoleteReason,
            String auditComment
    ) {
        if (sourceRevision == null || sourceRevision.getId() == null) {
            return;
        }
        for (ControlledCopyRecord copy : controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(sourceRevision.getId())) {
            boolean distributed = "DISTRIBUTED".equalsIgnoreCase(copy.getStatusCode())
                    || "DISTRIBUTED".equalsIgnoreCase(copy.getCurrentStage());
            if (!distributed) {
                continue;
            }
            String copyFromStatus = copy.getStatusCode();
            copy.setStatus("Obsoleted");
            copy.setStatusCode("OBSOLETED");
            copy.setCurrentStage("Obsoleted");
            copy.setObsoleteReason(obsoleteReason);
            copy.setObsoletedBy(actor);
            copy.setObsoletedAt(obsoletedAt);
            controlledCopyRepository.save(copy);
            auditTrailService.logAs(
                    actor,
                    "Controlled Copy",
                    copy.getControlledCopyNumber(),
                    copy.getId(),
                    "OBSOLETE",
                    copyFromStatus,
                    "Obsoleted",
                    auditComment
            );
        }
        controlledCopyBatchStatusService.synchronize(
                controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(sourceRevision.getId())
        );
    }

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
                nextPendingParticipant(revision, "REVIEWER")
                        .map(RevisionWorkflowParticipant::getUser)
                        .ifPresent(recipients::add);
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
            nextPendingParticipant(revision, "REVIEWER")
                    .map(RevisionWorkflowParticipant::getUser)
                    .ifPresent(recipients::add);
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
        } else if ("REVIEW_REJECT".equalsIgnoreCase(actionType)) {
            templateType = "document-review";
            recipients.addAll(getWorkflowCoordinatorRecipients(revision));
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
        return null;
    }

    private List<UserAccount> getRevisionParticipants(DocumentRevisionRecord revision, String participantType) {
        return revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType)
                .stream()
                .map(RevisionWorkflowParticipant::getUser)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private List<UserAccount> getRevisionEditParticipants(DocumentRevisionRecord revision) {
        if (revision == null) {
            return List.of();
        }
        List<UserAccount> recipients = new ArrayList<>();
        if (revision.getAuthor() != null) {
            recipients.add(revision.getAuthor());
        } else if (revision.getDocument() != null && revision.getDocument().getAuthor() != null) {
            recipients.add(revision.getDocument().getAuthor());
        }
        recipients.addAll(getRevisionParticipants(revision, "CO_AUTHOR"));
        return recipients.stream()
                .filter(Objects::nonNull)
                .filter(user -> user.getId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        UserAccount::getId,
                        user -> user,
                        (left, right) -> left,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .toList();
    }

    private void notifyRevisionEditParticipants(DocumentRevisionRecord revision, UserAccount actor, String comment) {
        if (revision == null || revision.getDocument() == null) {
            return;
        }
        List<UserAccount> recipients = getRevisionEditParticipants(revision);
        if (recipients.isEmpty()) {
            return;
        }
        for (UserAccount recipient : recipients) {
            Map<String, String> overrides = new HashMap<>();
            overrides.put("documentTitle", firstNonBlank(revision.getDocumentName(), revision.getDocument().getDocumentName(), ""));
            overrides.put("documentNumber", firstNonBlank(revision.getDocumentNumber(), revision.getDocument().getDocumentNumber(), ""));
            overrides.put("revisionTitle", firstNonBlank(revision.getRevisionName(), revision.getDocumentName(), ""));
            overrides.put("revisionName", firstNonBlank(revision.getRevisionName(), revision.getDocumentName(), ""));
            overrides.put("revisionNumber", firstNonBlank(revision.getRevisionNumber(), ""));
            overrides.put("revisionStatus", revision.getStatus() == null ? "" : firstNonBlank(revision.getStatus().getCode(), ""));
            overrides.put("officeEditUrl", firstNonBlank(revision.getStorageEditUrl(), ""));
            overrides.put("officeViewUrl", firstNonBlank(revision.getStorageViewUrl(), revision.getStorageWebUrl(), ""));
            overrides.put("workflowAction", "UPLOAD_TO_OFFICE_ONLINE");
            overrides.put("workflowComment", firstNonBlank(comment, ""));
            Map<String, String> variables = emailNotificationService.buildDocumentVariables(
                    revision.getDocument(),
                    revision,
                    actor,
                    recipient,
                    "UPLOAD_TO_OFFICE_ONLINE",
                    comment,
                    overrides
            );
            emailNotificationService.sendByTypeToRecipients(
                    EmailTemplateTypeUtils.DOCUMENT_EDIT_ONLINE_NOTIFICATION,
                    List.of(recipient),
                    variables
            );
        }
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
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
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
        boolean mayUseTemplates = permissionEvaluationService.hasPermission(user, "documents.template.use")
                || permissionEvaluationService.hasPermission(user, "documents.template.manage");
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

      private RevisionDetailResponse toDetailResponse(DocumentRevisionRecord revision) {
          return toDetailResponse(revision, null);
      }

      private RevisionDetailResponse toDetailResponse(DocumentRevisionRecord revision, String message) {
          DocumentRecord sourceDocument = revision.getDocument();
          String resolvedRevisionName = buildRevisionName(revision.getDocument() == null ? null : revision.getDocument().getDocumentName(), revision.getRevisionNumber());
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

        return new RevisionDetailResponse(
                revision.getId().toString(),
                sourceDocument == null ? null : sourceDocument.getId().toString(),
                originalDocument,
                revision.getDocumentNumber(),
                sourceDocument == null ? revision.getDocumentName() : sourceDocument.getDocumentName(),
                buildDocumentDisplayName(revision.getDocumentNumber(), sourceDocument == null ? revision.getDocumentName() : sourceDocument.getDocumentName()),
                revision.getTitleLocalLanguage(),
                resolvedRevisionName,
                  revision.getRevisionNumber(),
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
                DateTimeFormatUtils.formatDate(revision.getEffectiveDate()),
                DateTimeFormatUtils.formatDate(revision.getValidUntil()),
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
                message
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
          revision.setRevisionNumber(normalizeVersionFormat(StringUtils.hasText(version) ? version.trim() : "0.0.1"));
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
          revision.setTrainingPlannedDate(null);
          revision.setTrainingPeriodEndDate(null);
          revision.setPublishedAt(null);
          revision.setPublishedBy(null);
          revision.setTrainingCompletionDate(null);
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
     * Description. Related/Correlated Documents need no resync -- they are queried live against the
     * Document, never snapshotted onto the revision.
     */
    public void syncDraftRevisionWithDocument(DocumentRecord document) {
        if (document == null || document.getId() == null) {
            return;
        }
        DocumentRevisionRecord draft = revisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT")
                .orElse(null);
        if (draft == null) {
            return;
        }
        draft.setAuthor(document.getAuthor());
        draft.setPeriodicReviewCycle(document.getPeriodicReviewCycle());
        draft.setPeriodicReviewNotification(document.getPeriodicReviewNotification());
        draft.setRequiresTraining(document.isRequiresTraining());
        draft.setTrainingPeriodDays(document.getTrainingPeriodDays());
        draft.setReasonForSkippingTraining(document.getReasonForSkippingTraining());
        revisionRepository.save(draft);
        copyWorkflowParticipantsFromDocument(document, draft);
    }

    private ReviewRequirement resolveReviewRequirement(DocumentRecord document) {
        if (document == null || document.getDocumentType() == null || !StringUtils.hasText(document.getSubType())) {
            // No Sub-Type chosen ("None") -- at least one Reviewer required, but not pinned to an
            // exact count the way a configured Sub-Type would be.
            return ReviewRequirement.FLEXIBLE;
        }
        return documentSubTypeRepository
                .findByDocumentType_IdAndNameIgnoreCase(document.getDocumentType().getId(), document.getSubType().trim())
                .filter(DocumentSubType::isActive)
                .map(DocumentSubType::getReviewRequirement)
                .orElse(ReviewRequirement.SINGLE);
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
        long approverCount = documentWorkflowParticipantRepository
                .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER")
                .size();
        if (approverCount == 0) {
            throw new IllegalStateException("APPROVER_REQUIRED: Assign and save an Approver before uploading a revision.");
        }
        ReviewRequirement requirement = resolveReviewRequirement(document);
        if (requirement != ReviewRequirement.NONE) {
            long reviewerCount = documentWorkflowParticipantRepository
                    .findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "REVIEWER")
                    .size();
            if (reviewerCount == 0) {
                throw new IllegalStateException("REVIEWER_REQUIRED: Assign and save a Reviewer before uploading a revision.");
            }
        }
    }

    /**
     * Domain invariant evaluated before SoD.  Authorization only decides who
     * may submit; it must never allow a caller to bypass the subtype workflow.
     */
    private void validateReviewersForRequirement(DocumentRevisionRecord revision, ReviewRequirement requirement) {
        long reviewerCount = countParticipants(revision, "REVIEWER");
        switch (requirement == null ? ReviewRequirement.SINGLE : requirement) {
            case NONE -> {
                if (reviewerCount != 0) {
                    throw new IllegalStateException("REVIEW_NOT_REQUIRED: this Sub-Type must not have Reviewers");
                }
            }
            case SINGLE -> {
                if (reviewerCount != 1) {
                    throw new IllegalStateException("EXACTLY_ONE_REVIEWER_REQUIRED: this Sub-Type requires exactly one Reviewer");
                }
            }
            case MULTIPLE -> {
                if (reviewerCount < 2) {
                    throw new IllegalStateException("MULTIPLE_REVIEWERS_REQUIRED: this Sub-Type requires at least two Reviewers");
                }
            }
            case FLEXIBLE -> {
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

    private List<AuditTrailChangeResponse> buildUpgradeTrainingAuditChanges(DocumentRecord document) {
        return List.of(
                new AuditTrailChangeResponse(
                        "requiresTraining",
                        "-",
                        document != null && document.isRequiresTraining() ? "true" : "false"
                ),
                new AuditTrailChangeResponse(
                        "trainingPeriodDays",
                        "-",
                        document != null && document.getTrainingPeriodDays() != null
                                ? String.valueOf(document.getTrainingPeriodDays())
                                : "-"
                ),
                new AuditTrailChangeResponse(
                        "reasonForSkippingTraining",
                        "-",
                        document != null && StringUtils.hasText(document.getReasonForSkippingTraining())
                                ? document.getReasonForSkippingTraining().trim()
                                : "-"
                )
        );
    }

      private String buildRevisionName(String documentTitle, String version) {
          String safeTitle = StringUtils.hasText(documentTitle) ? documentTitle.trim() : "";
          String safeVersion = StringUtils.hasText(version) ? version.trim() : "0.0.1";
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

    private void copyWorkflowParticipantsFromDocument(DocumentRecord document, DocumentRevisionRecord revision) {
        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(revision.getId());
        // Flush before re-inserting -- previously harmless because every prior caller only ever ran
        // this against a brand-new revision (nothing to delete), so the missing flush never
        // surfaced. syncDraftRevisionWithDocument is the first caller to re-run this against a
        // revision that already has participant rows; without the flush the delete and the
        // re-inserts can race, tripping uq_revision_workflow_participant.
        revisionWorkflowParticipantRepository.flush();
        List<DocumentWorkflowParticipant> participants = documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(document.getId());
        for (DocumentWorkflowParticipant participant : participants) {
            saveRevisionParticipant(revision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
    }

    private void copyWorkflowParticipantsFromRevision(DocumentRevisionRecord sourceRevision, DocumentRevisionRecord targetRevision) {
        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(targetRevision.getId());
        List<RevisionWorkflowParticipant> participants = revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(sourceRevision.getId(), "CO_AUTHOR");
        for (RevisionWorkflowParticipant participant : participants) {
            saveRevisionParticipant(targetRevision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
        participants = revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(sourceRevision.getId(), "REVIEWER");
        for (RevisionWorkflowParticipant participant : participants) {
            saveRevisionParticipant(targetRevision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
        participants = revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(sourceRevision.getId(), "APPROVER");
        for (RevisionWorkflowParticipant participant : participants) {
            saveRevisionParticipant(targetRevision, participant.getUser(), participant.getParticipantType(), participant.getSequenceOrder());
        }
    }

    private void saveRevisionParticipantsFromRequest(DocumentRevisionRecord revision, DocumentDraftCreateRequest request) {
        revisionWorkflowParticipantRepository.deleteAllByRevision_Id(revision.getId());
        revisionWorkflowParticipantRepository.flush();

        List<String> coAuthorIds = request.coAuthorIds() == null ? List.of() : distinctNonBlank(request.coAuthorIds());
        List<String> reviewerUserIds = request.reviewerUserIds() == null ? List.of() : distinctNonBlank(request.reviewerUserIds());
        List<String> approverUserIds = request.approverUserIds() == null ? List.of() : distinctNonBlank(request.approverUserIds());

        validateReviewerIdsForRequirement(revision.getReviewRequirement(), reviewerUserIds.size());

        if (request != null && request.coAuthorIds() != null) {
            validateCoAuthorRules(revision.getDocument() == null ? null : revision.getDocument().getAuthor(), distinctNonBlank(request.coAuthorIds()));
        }
        if (request != null && request.reviewerUserIds() != null) {
            validateReviewerRules(
                    revision.getReviewRequirement(),
                    revision.getDocument() == null ? null : revision.getDocument().getAuthor(),
                    request.coAuthorIds() == null ? List.of() : distinctNonBlank(request.coAuthorIds()),
                    distinctNonBlank(request.reviewerUserIds())
            );
        }
        if (request != null && request.approverUserIds() != null && !approverUserIds.isEmpty()) {
            validateApproverRules(
                    revision.getDocument() == null ? null : revision.getDocument().getAuthor(),
                    request.coAuthorIds() == null ? List.of() : distinctNonBlank(request.coAuthorIds()),
                    request.reviewerUserIds() == null ? List.of() : distinctNonBlank(request.reviewerUserIds()),
                    approverUserIds
            );
        }

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
        switch (requirement == null ? ReviewRequirement.SINGLE : requirement) {
            case NONE -> {
                if (reviewerCount != 0) {
                    throw new IllegalArgumentException("REVIEW_NOT_REQUIRED: this Sub-Type does not allow Reviewer assignments");
                }
            }
            case SINGLE -> {
                if (reviewerCount != 1) {
                    throw new IllegalArgumentException("EXACTLY_ONE_REVIEWER_REQUIRED: this Sub-Type requires exactly one Reviewer");
                }
            }
            case MULTIPLE -> {
                if (reviewerCount < 2) {
                    throw new IllegalArgumentException("MULTIPLE_REVIEWERS_REQUIRED: this Sub-Type requires at least two Reviewers");
                }
            }
            case FLEXIBLE -> {
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
        requireCurrentUserCanUploadRevision(document, currentUser);
        requireRevisionFileAccess(currentUser, revision, FileAccessAction.UPLOAD);
        requireRevisionStatus(revision, "DRAFT");
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
        RevisionUploadFileValidator.ValidatedRevisionFile validatedFile = file == null || file.isEmpty()
                ? null
                : validateRevisionUpload(currentUser, document, null, file);
        DocumentRevisionRecord latestRevision = revisionRepository.findFirstByDocument_IdOrderByCreatedAtDesc(documentId).orElse(null);
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

        if (latestRevision == null) {
            document.setStatus(requireDocumentStatus("ACTIVE"));
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
                return applyPreviewWatermark(pdfBytes);
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
        // The subtype snapshot is the precise workflow cardinality.  The
        // legacy global setting can strengthen MULTIPLE, but never contradict
        // a configured NONE or SINGLE subtype.
        if ((requirement == null || requirement == ReviewRequirement.MULTIPLE)
                && setting.isRequireTwoReviewers() && reviewerUserIds.size() < 2) {
            throw new IllegalArgumentException("At least two reviewers are required for controlled documents");
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

    private void validateApproverRules(UserAccount author, List<String> coAuthorIds, List<String> reviewerUserIds, List<String> approverUserIds) {
        validateAuthorAndCoAuthorApprovalIndependence(author, coAuthorIds, approverUserIds);
        DocumentWorkflowSetting setting = requireDocumentWorkflowSetting();
        if (setting.isRequireOneApprover() && approverUserIds.size() != 1) {
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

    @Transactional
    public RevisionDetailResponse syncRevisionToOfficeOnline(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        DocumentRecord document = requireDocument(revision.getDocument().getId());
        requireCurrentUserCanUploadRevision(document, currentUser);
        requireRevisionStatus(revision, "DRAFT");
        documentAuthorizationService.requireCanEditRevisionFileOnline(currentUser, revision);
        requireRevisionFileAccess(currentUser, revision, FileAccessAction.SYNC_TO_OFFICE);

        if (StringUtils.hasText(revision.getStorageItemId()) && StringUtils.hasText(revision.getStorageDriveId())) {
            ensureOfficeOnlineEditLink(revision);
            if (!"synced".equalsIgnoreCase(revision.getStorageSyncStatus())) {
                revision.setStorageSyncStatus("synced");
                revision.setStorageLastSyncedAt(Instant.now());
                revisionRepository.save(revision);
            }
            return toDetailResponse(revision);
        }

        Path sourcePath = resolveRevisionSourceFile(revision);
        if (sourcePath == null) {
            throw new IllegalArgumentException("Revision file not found");
        }
        validateRevisionSourceForOfficeOnline(revision, currentUser, sourcePath);

        if (!microsoftGraphOfficeOnlineService.isConfigured()) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }

        boolean temporarySource = fileStorageService.isMinioReference(revision.getFilePath())
                || (!StringUtils.hasText(revision.getFilePath())
                && fileStorageService.isMinioReference(revision.getPreviewFilePath()));
        try {
            String previousStorageProvider = revision.getStorageProvider();
            String previousStorageSyncStatus = revision.getStorageSyncStatus();
            String previousStorageSiteId = revision.getStorageSiteId();
            String previousStorageDriveId = revision.getStorageDriveId();
            String previousStorageItemId = revision.getStorageItemId();
            String previousStorageWebUrl = revision.getStorageWebUrl();
            String previousStorageEditUrl = revision.getStorageEditUrl();
            String spFolder = sharePointPathBuilder.editOnlineFolderV2(
                    officeOnlineConfigurationService.getEffectiveConfiguration(),
                    revision.getDocumentNumber(),
                    revision.getId()
            );
            MicrosoftGraphOfficeOnlineService.GraphUploadResult result = microsoftGraphOfficeOnlineService.uploadOfficeFile(
                    sourcePath,
                    revision.getFileName(),
                    spFolder
            );
            revision.setStorageProvider("microsoft-graph");
            revision.setStorageSiteId(result.siteId());
            revision.setStorageDriveId(result.driveId());
            revision.setStorageItemId(result.itemId());
            revision.setStorageWebUrl(result.webUrl());
            revision.setStorageEditUrl(result.editUrl());
            revision.setStorageEditPermissionId(result.editPermissionId());
            revision.setStorageViewUrl(result.viewUrl());
            revision.setStorageViewPermissionId(result.viewPermissionId());
            revision.setStoragePdfUrl(null);
            revision.setStorageSyncStatus("synced");
            revision.setStorageLastSyncedAt(Instant.now());
            revisionRepository.save(revision);
            recordRevisionHistory(
                    revision,
                    "UPLOAD_TO_OFFICE_ONLINE",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Revision file uploaded to Office Online",
                    currentUser,
                    List.of(
                            new AuditTrailChangeResponse("storageProvider", firstNonBlank(previousStorageProvider, "-"), "microsoft-graph"),
                            new AuditTrailChangeResponse("storageSyncStatus", firstNonBlank(previousStorageSyncStatus, "-"), "synced"),
                            new AuditTrailChangeResponse("storageSiteId", firstNonBlank(previousStorageSiteId, "-"), firstNonBlank(result.siteId(), "-")),
                            new AuditTrailChangeResponse("storageDriveId", firstNonBlank(previousStorageDriveId, "-"), firstNonBlank(result.driveId(), "-")),
                            new AuditTrailChangeResponse("storageItemId", firstNonBlank(previousStorageItemId, "-"), firstNonBlank(result.itemId(), "-")),
                            new AuditTrailChangeResponse("storageWebUrl", firstNonBlank(previousStorageWebUrl, "-"), firstNonBlank(result.viewUrl(), "-")),
                            new AuditTrailChangeResponse("storageEditUrl", firstNonBlank(previousStorageEditUrl, "-"), firstNonBlank(result.editUrl(), "-"))
                    )
            );
            notifyRevisionEditParticipants(revision, currentUser, "Revision file is ready for Office Online editing");
            // This is the actual "Upload to Office Online" action (distinct from the "Edit File
            // Online" open-editor flow, which can fail independently on an Entra invitation issue
            // without affecting whether the file itself made it to SharePoint). The DCO's Document
            // Details page gates "Edit Revision for Upgrade" on this exact transition.
            publishRevisionWorkflowUpdateAfterCommit(revision, "UPLOAD_TO_OFFICE_ONLINE");
            return toDetailResponse(revision);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to upload revision file to Office Online", ex);
        } finally {
            if (temporarySource) {
                try {
                    Files.deleteIfExists(sourcePath);
                } catch (IOException ex) {
                    log.debug("Failed to delete temporary MinIO file {}", sourcePath, ex);
                }
            }
        }
    }

    @Transactional
    public RevisionDetailResponse syncEditedFileFromOfficeOnline(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        DocumentRecord document = requireDocument(revision.getDocument().getId());
        requireCurrentUserCanUploadRevision(document, currentUser);
        requireRevisionFileAccess(currentUser, revision, FileAccessAction.SYNC_FROM_OFFICE);
        requireRevisionStatus(revision, "DRAFT");

        if (StringUtils.hasText(revision.getStorageItemId()) && StringUtils.hasText(revision.getStorageDriveId())) {
            syncEditedFileFromOfficeOnlineToMinio(revision, currentUser);
        }

        return toDetailResponse(revision);
    }

    @Transactional
    public RevisionOfficeOnlineLinkResponse getOfficeOnlineEditLink(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireRevision(revisionId);
        documentAuthorizationService.requireCanEditRevisionFileOnline(currentUser, revision);
        requireRevisionFileAccess(currentUser, revision, FileAccessAction.EDIT_ONLINE);
        if (!StringUtils.hasText(revision.getStorageItemId()) || !StringUtils.hasText(revision.getStorageDriveId())) {
            restoreOfficeOnlineWorkingCopy(revision, currentUser);
        }
        grantCurrentUserOfficeOnlineEditAccess(revision, currentUser);
        String editUrl = resolveDirectOfficeOnlineEditUrl(revision);
        if (!StringUtils.hasText(editUrl)) {
            throw new IllegalStateException("Revision file has not been uploaded to Office Online");
        }
        String configuredScope = officeOnlineConfigurationService.getEffectiveConfiguration().shareLinkScope();
        String effectiveScope = "direct-item-permission";
        String fetchedAt = Instant.now().toString();
        recordRevisionHistory(
                revision,
                "OPEN_EDIT_ONLINE",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Opened Office Online edit link",
                currentUser,
                List.of(
                        new AuditTrailChangeResponse("Edit Session", "-", "Office Online edit link opened"),
                        new AuditTrailChangeResponse("configuredScope", "-", firstNonBlank(configuredScope, "-")),
                        new AuditTrailChangeResponse("effectiveScope", "-", effectiveScope),
                        new AuditTrailChangeResponse("storageEditUrl", "-", editUrl),
                        new AuditTrailChangeResponse("fetchedAt", "-", fetchedAt)
                )
        );
        return new RevisionOfficeOnlineLinkResponse(editUrl, configuredScope, effectiveScope, fetchedAt);
    }

    /**
     * Opens an item-scoped Word Online session for the assigned reviewer or approver. This is
     * deliberately separate from author editing: it is available only while the revision is in
     * the matching review stage and never enables source-file upload/sync operations in EQMS.
     */
    @Transactional
    public RevisionOfficeOnlineLinkResponse getOfficeOnlineReviewLink(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (!officeOnlineConfigurationService.getEffectiveConfiguration().reviewLinksEnabled()) {
            throw new IllegalStateException("Word Online comment-only review links are disabled by system configuration.");
        }
        DocumentRevisionRecord revision = requireRevision(revisionId);
        String status = revision.getStatus() == null ? null : revision.getStatus().getCode();
        boolean isReviewer = "PENDING_REVIEW".equalsIgnoreCase(status)
                && (canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_REVIEW)
                || canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.REJECT_REVIEW));
        boolean isApprover = "PENDING_APPROVAL".equalsIgnoreCase(status)
                && (canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.COMPLETE_APPROVAL)
                || canCurrentUserPerformWorkflowAction(currentUser, revision, RevisionWorkflowAction.REJECT_APPROVAL));
        if (!isReviewer && !isApprover) {
            throw new AccessDeniedException("Only the assigned Reviewer or Approver can open this file to comment at the current workflow stage.");
        }
        if (!isOfficeOnlineReviewableFile(revision)) {
            throw new IllegalStateException("Word Online comments are available only for DOC or DOCX revision files");
        }
        if (!StringUtils.hasText(revision.getStorageItemId()) || !StringUtils.hasText(revision.getStorageDriveId())) {
            restoreOfficeOnlineWorkingCopy(revision, currentUser);
        }
        String reviewUrl = createCurrentUserOfficeOnlineReviewLink(revision, currentUser);
        if (!StringUtils.hasText(reviewUrl)) {
            throw new IllegalStateException("Revision file is not available for Word Online review");
        }
        String configuredScope = officeOnlineConfigurationService.getEffectiveConfiguration().shareLinkScope();
        String effectiveScope = "direct-item-permission";
        String fetchedAt = Instant.now().toString();
        recordRevisionHistory(
                revision,
                "OPEN_REVIEW_ONLINE",
                status,
                status,
                "Opened Word Online review/comment session",
                currentUser,
                List.of(new AuditTrailChangeResponse("Review Session", "-", "Word Online comment session opened"))
        );
        return new RevisionOfficeOnlineLinkResponse(reviewUrl, configuredScope, effectiveScope, fetchedAt);
    }

    private void grantCurrentUserOfficeOnlineEditAccess(DocumentRevisionRecord revision, UserAccount currentUser) {
        try {
            microsoftGraphOfficeOnlineService.grantItemWriteAccess(
                    revision.getStorageDriveId(),
                    revision.getStorageItemId(),
                    currentUser == null ? null : currentUser.getEmail()
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to grant the current user Office Online access", ex);
        }
    }

    private String createCurrentUserOfficeOnlineReviewLink(DocumentRevisionRecord revision, UserAccount currentUser) {
        try {
            return microsoftGraphOfficeOnlineService.createItemReviewLink(
                    revision.getStorageDriveId(),
                    revision.getStorageItemId(),
                    currentUser == null ? null : currentUser.getEmail()
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to create the Office Online review link for the current Reviewer/Approver", ex);
        }
    }

    private boolean isOfficeOnlineReviewableFile(DocumentRevisionRecord revision) {
        String fileName = revision == null ? null : revision.getFileName();
        if (!StringUtils.hasText(fileName)) {
            return false;
        }
        String normalized = fileName.trim().toLowerCase(Locale.ROOT);
        return normalized.endsWith(".doc") || normalized.endsWith(".docx");
    }

    private String resolveDirectOfficeOnlineEditUrl(DocumentRevisionRecord revision) {
        try {
            String directUrl = microsoftGraphOfficeOnlineService.getItemWebUrl(
                    revision.getStorageDriveId(),
                    revision.getStorageItemId()
            );
            revision.setStorageWebUrl(directUrl);
            revision.setStorageEditUrl(directUrl);
            revision.setStorageEditPermissionId(null);
            revisionRepository.save(revision);
            return directUrl;
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to resolve the Office Online file URL", ex);
        }
    }

    private void restoreOfficeOnlineWorkingCopy(DocumentRevisionRecord revision, UserAccount currentUser) {
        if (revision == null) {
            return;
        }
        if (!microsoftGraphOfficeOnlineService.isConfigured()) {
            // Rejecting a review must still return the revision to Draft when the
            // optional Office Online integration is disabled. There is no remote
            // working copy to restore in that case; the normal source file remains
            // authoritative and the workflow transition must not be blocked.
            log.info("Office Online is not configured; skipping working-copy restore for revision {}", revision.getId());
            return;
        }

        Path resolvedSourcePath = resolveRevisionSourceFile(revision);
        if (resolvedSourcePath == null) {
            throw new IllegalStateException("Revision source file is not available for Office Online editing");
        }
        validateRevisionSourceForOfficeOnline(revision, currentUser, resolvedSourcePath);

        boolean temporarySource = fileStorageService.isMinioReference(revision.getFilePath())
                || (!StringUtils.hasText(revision.getFilePath())
                && fileStorageService.isMinioReference(revision.getPreviewFilePath()));
        try {
            String previousStorageProvider = revision.getStorageProvider();
            String previousStorageSyncStatus = revision.getStorageSyncStatus();
            String previousStorageSiteId = revision.getStorageSiteId();
            String previousStorageDriveId = revision.getStorageDriveId();
            String previousStorageItemId = revision.getStorageItemId();
            String previousStorageWebUrl = revision.getStorageWebUrl();
            String previousStorageEditUrl = revision.getStorageEditUrl();
            String spFolder = sharePointPathBuilder.editOnlineFolderV2(
                    officeOnlineConfigurationService.getEffectiveConfiguration(),
                    revision.getDocumentNumber(),
                    revision.getId()
            );
            MicrosoftGraphOfficeOnlineService.GraphUploadResult result = microsoftGraphOfficeOnlineService.uploadOfficeFile(
                    resolvedSourcePath,
                    revision.getFileName(),
                    spFolder
            );
            revision.setStorageProvider("microsoft-graph");
            revision.setStorageSiteId(result.siteId());
            revision.setStorageDriveId(result.driveId());
            revision.setStorageItemId(result.itemId());
            revision.setStorageWebUrl(result.webUrl());
            revision.setStorageEditUrl(result.editUrl());
            revision.setStorageEditPermissionId(result.editPermissionId());
            revision.setStorageViewUrl(result.viewUrl());
            revision.setStorageViewPermissionId(result.viewPermissionId());
            revision.setStoragePdfUrl(null);
            revision.setStorageSyncStatus("synced");
            revision.setStorageLastSyncedAt(Instant.now());
            revisionRepository.save(revision);
            recordRevisionHistory(
                    revision,
                    "SHAREPOINT_LINK_RECREATED",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Office Online working copy restored from latest MinIO source file",
                    currentUser,
                    List.of(
                            new AuditTrailChangeResponse("storageProvider", firstNonBlank(previousStorageProvider, "-"), "microsoft-graph"),
                            new AuditTrailChangeResponse("storageSyncStatus", firstNonBlank(previousStorageSyncStatus, "-"), "synced"),
                            new AuditTrailChangeResponse("storageSiteId", firstNonBlank(previousStorageSiteId, "-"), firstNonBlank(result.siteId(), "-")),
                            new AuditTrailChangeResponse("storageDriveId", firstNonBlank(previousStorageDriveId, "-"), firstNonBlank(result.driveId(), "-")),
                            new AuditTrailChangeResponse("storageItemId", firstNonBlank(previousStorageItemId, "-"), firstNonBlank(result.itemId(), "-")),
                            new AuditTrailChangeResponse("storageWebUrl", firstNonBlank(previousStorageWebUrl, "-"), firstNonBlank(result.viewUrl(), "-")),
                            new AuditTrailChangeResponse("storageEditUrl", firstNonBlank(previousStorageEditUrl, "-"), firstNonBlank(result.editUrl(), "-"))
                    )
            );
            // The DCO's Document Details page (a different view entirely) gates "Edit Revision for
            // Upgrade" on this exact transition -- push it so an already-open page updates without
            // requiring a manual reload, matching the poll+realtime pattern already used for
            // revision workflow updates.
            publishRevisionWorkflowUpdateAfterCommit(revision, "UPLOAD_TO_OFFICE_ONLINE");
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to restore Office Online working copy", ex);
        } finally {
            if (temporarySource) {
                try {
                    Files.deleteIfExists(resolvedSourcePath);
                } catch (IOException ex) {
                    log.debug("Failed to delete temporary MinIO file {}", resolvedSourcePath, ex);
                }
            }
        }
    }

    /**
     * Returns a rejected revision to Draft without replacing its SharePoint file. This preserves
     * Reviewer/Approver comments and tracked changes for the Author and Co-Author to resolve.
     */
    private void reopenOfficeOnlineWorkingCopy(DocumentRevisionRecord revision, UserAccount currentUser) {
        boolean hasOfficeItem = revision != null
                && StringUtils.hasText(revision.getStorageItemId())
                && StringUtils.hasText(revision.getStorageDriveId());
        if (!hasOfficeItem) {
            restoreOfficeOnlineWorkingCopy(revision, currentUser);
            return;
        }
        syncEditedFileFromOfficeOnlineToMinio(revision, currentUser);
        lockOfficeOnlineEditing(revision, currentUser);
    }

    private String ensureOfficeOnlineEditLink(DocumentRevisionRecord revision) {
        if (revision == null) {
            return null;
        }
        String editUrl = revision.getStorageEditUrl();
        if (StringUtils.hasText(editUrl)) {
            return editUrl;
        }
        if (!StringUtils.hasText(revision.getStorageItemId()) || !StringUtils.hasText(revision.getStorageDriveId())) {
            return editUrl;
        }
        try {
            MicrosoftGraphOfficeOnlineService.SharingLinkResult editLink = microsoftGraphOfficeOnlineService.createSharingLink(
                    officeOnlineConfigurationService.getEffectiveConfiguration(),
                    revision.getStorageItemId(),
                    "edit"
            );
            editUrl = editLink.webUrl();
            revision.setStorageEditUrl(editUrl);
            revision.setStorageEditPermissionId(editLink.permissionId());
            revisionRepository.save(revision);
            return editUrl;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to create Office Online edit link", ex);
        } catch (IllegalStateException ex) {
            if (isSharePointSharingDisabled(ex) && StringUtils.hasText(revision.getStorageWebUrl())) {
                editUrl = revision.getStorageWebUrl();
                revision.setStorageEditUrl(editUrl);
                revision.setStorageEditPermissionId(null);
                revisionRepository.save(revision);
                log.warn("SharePoint sharing is disabled for revision {}; using its direct web URL. "
                        + "The user must have access to the SharePoint site.", revision.getId());
                return editUrl;
            }
            throw ex;
        }
    }

    private boolean isSharePointSharingDisabled(IllegalStateException exception) {
        String message = exception.getMessage();
        return StringUtils.hasText(message)
                && (message.contains("\"sharingDisabled\"") || message.contains("sharingDisabled"));
    }

    public void lockOfficeOnlineEditing(DocumentRevisionRecord revision, UserAccount currentUser) {
        if (revision == null || !StringUtils.hasText(revision.getStorageItemId()) || !StringUtils.hasText(revision.getStorageDriveId())) {
            return;
        }

        String previousStorageProvider = revision.getStorageProvider();
        String previousStorageSyncStatus = revision.getStorageSyncStatus();
        String previousStorageSiteId = revision.getStorageSiteId();
        String previousStorageDriveId = revision.getStorageDriveId();
        String previousStorageItemId = revision.getStorageItemId();
        String previousStorageWebUrl = revision.getStorageWebUrl();
        String previousStorageEditUrl = revision.getStorageEditUrl();

        String storageDriveId = revision.getStorageDriveId();
        String storageItemId = revision.getStorageItemId();
        java.util.Set<String> permissionIds = new java.util.LinkedHashSet<>();
        if (StringUtils.hasText(revision.getStorageEditPermissionId())) {
            permissionIds.add(revision.getStorageEditPermissionId());
        }

        if (StringUtils.hasText(storageDriveId) && StringUtils.hasText(storageItemId)) {
            try {
                microsoftGraphOfficeOnlineService.listSharingPermissions(
                                storageDriveId,
                                storageItemId
                        )
                        .stream()
                        .filter(permission -> permission != null)
                        .filter(permission -> StringUtils.hasText(permission.type()))
                        .filter(permission -> java.util.Arrays.stream(permission.type().split(","))
                                .anyMatch(role -> "edit".equalsIgnoreCase(role)
                                        || "write".equalsIgnoreCase(role)
                                        || "review".equalsIgnoreCase(role)))
                        .filter(permission -> !StringUtils.hasText(permission.inheritedFrom()))
                        .map(MicrosoftGraphOfficeOnlineService.SharingPermissionResult::id)
                        .filter(StringUtils::hasText)
                        .forEach(permissionIds::add);
            } catch (Exception ex) {
                log.warn("Failed to inspect Office Online sharing permissions for revision {}", revision.getId(), ex);
            }
        }

        for (String permissionId : permissionIds) {
            if (!StringUtils.hasText(permissionId)) {
                continue;
            }
            try {
                microsoftGraphOfficeOnlineService.revokeSharingPermission(
                        storageDriveId,
                        storageItemId,
                        permissionId
                );
            } catch (Exception ex) {
                log.warn("Failed to revoke Office Online permission {} for revision {}", permissionId, revision.getId(), ex);
            }
        }

        // Keep the same SharePoint item across the workflow. A rejection must return the
        // Author/Co-Author to this exact file so Word comments and tracked changes remain visible.
        revision.setStorageEditPermissionId(null);
        revision.setStorageSyncStatus("access-revoked");
        revision.setStorageLastSyncedAt(Instant.now());
        revisionRepository.save(revision);

        if (currentUser != null) {
            auditTrailService.logAs(
                    currentUser,
                    "REVISION",
                    revision.getRevisionName(),
                    revision.getId(),
                    "SHAREPOINT_LINK_REVOKED",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Revoked Office Online edit access while retaining the working file.",
                    List.of(
                            new AuditTrailChangeResponse("Edit Session", "Opened", "Closed"),
                            new AuditTrailChangeResponse("storageProvider", firstNonBlank(previousStorageProvider, "-"), firstNonBlank(revision.getStorageProvider(), "-")),
                            new AuditTrailChangeResponse("storageSyncStatus", firstNonBlank(previousStorageSyncStatus, "-"), "access-revoked"),
                            new AuditTrailChangeResponse("storageSiteId", firstNonBlank(previousStorageSiteId, "-"), firstNonBlank(revision.getStorageSiteId(), "-")),
                            new AuditTrailChangeResponse("storageDriveId", firstNonBlank(previousStorageDriveId, "-"), firstNonBlank(revision.getStorageDriveId(), "-")),
                            new AuditTrailChangeResponse("storageItemId", firstNonBlank(previousStorageItemId, "-"), firstNonBlank(revision.getStorageItemId(), "-")),
                            new AuditTrailChangeResponse("storageWebUrl", firstNonBlank(previousStorageWebUrl, "-"), firstNonBlank(revision.getStorageWebUrl(), "-")),
                            new AuditTrailChangeResponse("storageEditUrl", firstNonBlank(previousStorageEditUrl, "-"), firstNonBlank(revision.getStorageEditUrl(), "-"))
                    )
            );
            auditTrailService.logAs(
                    currentUser,
                    "REVISION",
                    revision.getRevisionName(),
                    revision.getId(),
                    "EDITING_LOCKED",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Source DOCX editing access revoked while its SharePoint working file was retained.",
                    List.of(
                            new AuditTrailChangeResponse("Source Editing", "Unlocked", "Locked"),
                            new AuditTrailChangeResponse("storageProvider", firstNonBlank(previousStorageProvider, "-"), firstNonBlank(revision.getStorageProvider(), "-")),
                            new AuditTrailChangeResponse("storageSyncStatus", firstNonBlank(previousStorageSyncStatus, "-"), "access-revoked")
                    )
            );
        }
    }

    public void syncEditedFileFromOfficeOnlineToMinio(DocumentRevisionRecord revision, UserAccount currentUser) {
        if (revision == null || !StringUtils.hasText(revision.getStorageItemId())) {
            return;
        }
        if (!microsoftGraphOfficeOnlineService.isConfigured()) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }

        try {
            String previousFilePath = revision.getFilePath();
            String previousStorageProvider = revision.getStorageProvider();
            String previousStorageSyncStatus = revision.getStorageSyncStatus();
            String previousSourceChecksum = revision.getSourceFileChecksum();
            String previousStorageSiteId = revision.getStorageSiteId();
            String previousStorageDriveId = revision.getStorageDriveId();
            String previousStorageItemId = revision.getStorageItemId();
            String previousStorageEditUrl = revision.getStorageEditUrl();
            byte[] fileBytes = microsoftGraphOfficeOnlineService.downloadFile(revision.getStorageItemId());
            if (fileBytes == null || fileBytes.length == 0) {
                throw new IOException("Office Online returned an empty file");
            }

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
            revision.setStorageProvider("minio");
            revision.setStoragePdfUrl(null);
            revision.setStorageSyncStatus("synced");
            revision.setStorageLastSyncedAt(Instant.now());
            revisionRepository.save(revision);

            recordRevisionHistory(
                    revision,
                    "EDIT_ONLINE_SYNCED_BACK_TO_MINIO",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Edited file synced back from Office Online to MinIO",
                    currentUser,
                    List.of(
                            new AuditTrailChangeResponse("filePath", firstNonBlank(previousFilePath, "-"), firstNonBlank(stored.storedPath(), "-")),
                            new AuditTrailChangeResponse("storageProvider", firstNonBlank(previousStorageProvider, "-"), "minio"),
                            new AuditTrailChangeResponse("storageSyncStatus", firstNonBlank(previousStorageSyncStatus, "-"), "synced"),
                            new AuditTrailChangeResponse("sourceFileChecksum", firstNonBlank(previousSourceChecksum, "-"), firstNonBlank(stored.checksum(), "-")),
                            new AuditTrailChangeResponse("serverDetectedContentType", "-", validatedFile.detectedContentType()),
                            new AuditTrailChangeResponse("docxOoxmlValidation", "-", "PASSED"),
                            new AuditTrailChangeResponse("malwareScan", "-", validatedFile.malwareScanPerformed() ? "CLEAN" : "DISABLED_BY_CONFIGURATION"),
                            new AuditTrailChangeResponse("storageSiteId", firstNonBlank(previousStorageSiteId, "-"), "-"),
                            new AuditTrailChangeResponse("storageDriveId", firstNonBlank(previousStorageDriveId, "-"), "-"),
                            new AuditTrailChangeResponse("storageItemId", firstNonBlank(previousStorageItemId, "-"), "-"),
                            new AuditTrailChangeResponse("storageEditUrl", firstNonBlank(previousStorageEditUrl, "-"), "-")
                    )
            );

            deleteReplacedStoredFile(previousFilePath, stored.storedPath());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to sync edited revision file back to MinIO", ex);
        }
    }

    private byte[] applyPreviewWatermark(byte[] pdfBytes) throws IOException {
        try (PDDocument pdf = Loader.loadPDF(pdfBytes); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDType1Font mainFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            String mainText = "FOR PREVIEW ONLY";
            for (PDPage page : pdf.getPages()) {
                PDRectangle pageSize = page.getMediaBox();
                float textX = pageSize.getWidth() / 2f;
                float textY = pageSize.getHeight() / 2f;
                float mainTextWidth = (mainFont.getStringWidth(mainText) / 1000f) * 90f;

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
                    contentStream.setFont(mainFont, 90);
                    contentStream.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(45), textX, textY));
                    contentStream.newLineAtOffset(-mainTextWidth / 2f, 0f);
                    contentStream.showText(mainText);
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
        try {
            return revisionUploadFileValidator.validate(file);
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

    private void refreshPreviewFromUploadedFile(DocumentRevisionRecord revision) {
        if (revision == null || !StringUtils.hasText(revision.getFilePath())) {
            return;
        }
        try {
            Path sourcePath = fileStorageService.materializeStoredFile(revision.getFilePath());
            if (sourcePath == null || !Files.exists(sourcePath)) {
                sourcePath = resolveRevisionSourceFile(revision);
            }
            if (sourcePath == null || !Files.exists(sourcePath)) {
                return;
            }
            Path revisionDir = sourcePath.getParent();
            String displayName = StringUtils.hasText(revision.getFileName())
                    ? revision.getFileName()
                    : sourcePath.getFileName().toString();
            Path previewTarget = buildPreviewFileFromPath(
                    revision,
                    sourcePath,
                    revisionDir,
                    displayName,
                    revision.getFileType()
            );
            try (InputStream previewInput = Files.newInputStream(previewTarget)) {
                FileStorageService.StorageWriteResult previewStored = fileStorageService.storeRevisionPreviewFile(revision.getId(), "preview.pdf", previewInput, revision.getDocumentNumber(), revision.getRevisionNumber());
                revision.setPreviewFilePath(previewStored.storedPath());
                revisionRepository.save(revision);
            }
        } catch (Exception ex) {
            log.warn("Failed to generate PDF preview for revision {} during submit", revision.getId(), ex);
        }
    }

    /**
     * Re-composes the published PDF from the revision's stored publishing template/layout.
     * Restores the "Refresh Published PDF" button (FE: DetailRevisionView.tsx handleRegeneratePdf),
     * whose endpoint (POST /revisions/{id}/regenerate-snapshot) previously did not exist on the
     * backend and always failed with 404 regardless of the caller's permissions.
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
        try {
            PublishingPdfComposerService.PublishingCompositionResult composition =
                    publishingPdfComposerService.composePreview(revision, metadata.getPublishingTemplate(), metadata.getSelectedPublishingLayout());
            byte[] previewBytes = composition.pdfBytes();
            if (previewBytes == null || previewBytes.length == 0) {
                return;
            }
            String storedPreviewPath = null;
            try (InputStream previewInput = new ByteArrayInputStream(previewBytes)) {
                FileStorageService.StorageWriteResult previewStored = fileStorageService.storeRevisionPublishingPreviewFile(
                        revision.getId(),
                        "preview.pdf",
                        previewInput,
                        revision.getDocumentNumber(),
                        revision.getRevisionNumber()
                );
                storedPreviewPath = previewStored.storedPath();
                metadata.setPublishingPreviewPdfPath(previewStored.storedPath());
                metadata.setPublishingPreviewChecksum(previewStored.checksum());
                metadata.setPublishingPreviewVersionId(previewStored.versionId());
                metadata.setConversionEngine("MICROSOFT_GRAPH");
                metadata.setPreviewGeneratedAt(Instant.now());
                metadata.setPreviewGeneratedBy(currentUser);
                publishingMetadataRepository.save(metadata);

                revision.setPreviewFilePath(storedPreviewPath);
                revision.setStoragePdfUrl(storedPreviewPath);
                revisionRepository.save(revision);
            }
            auditTrailService.logAs(
                    currentUser,
                    "REVISION",
                    revision.getRevisionName(),
                    revision.getId(),
                    StringUtils.hasText(actionLabel) ? actionLabel : "REVIEW_SNAPSHOT_REGENERATED",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Review snapshot PDF regenerated from the latest workflow state.",
                    List.of(
                            new AuditTrailChangeResponse("Selected Template ID", "-", metadata.getPublishingTemplate().getId() == null ? "-" : metadata.getPublishingTemplate().getId().toString()),
                            new AuditTrailChangeResponse("Selected Layout", "-", metadata.getSelectedPublishingLayout()),
                            new AuditTrailChangeResponse("Review Snapshot PDF", "-", metadata.getPublishingPreviewPdfPath() == null ? "-" : metadata.getPublishingPreviewPdfPath())
                    )
            );
        } catch (Exception ex) {
            log.warn("Failed to regenerate publishing snapshot for revision {}", revision.getId(), ex);
        }
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
        if (currentUser == null || !(
                permissionEvaluationService.hasPermission(currentUser, "documents.template.use")
                        || permissionEvaluationService.hasPermission(currentUser, "documents.template.manage")
        )) {
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
        lineage.setTargetRevision(target);
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

    private byte[] convertOfficeDocumentToPdf(DocumentRevisionRecord revision, Path sourcePath, String displayName) throws IOException {
        if (!microsoftGraphOfficeOnlineService.isConfigured()) {
            throw new IllegalStateException("Microsoft Graph Office Online is not configured");
        }
        try {
            return microsoftGraphOfficeOnlineService.convertSourceFileToPdf(
                    sourcePath,
                    displayName,
                    sharePointPathBuilder.conversionFolder(
                            officeOnlineConfigurationService.getEffectiveConfiguration(),
                            "revisions",
                            revision == null || revision.getId() == null ? "preview" : revision.getId().toString()
                    )
            );
        } catch (IOException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw ex;
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
                .orElse("0.0.1");
    }

    private String resolveNextDraftRevisionNumberFromEffective(String effectiveRevisionNumber) {
        String normalized = normalizeVersionFormat(effectiveRevisionNumber);
        int major = parseVersionPart(normalized, 0);
        int patch = parseVersionPart(normalized, 2);
        return major + ".0." + (patch + 1);
    }

    private int compareRevisionNumbers(String left, String right) {
        int majorCompare = Integer.compare(parseVersionPart(left, 0), parseVersionPart(right, 0));
        if (majorCompare != 0) {
            return majorCompare;
        }
        return Integer.compare(parseVersionPart(left, 2), parseVersionPart(right, 2));
    }

    private DocumentStatusDefinition requireDocumentStatus(String code) {
        return documentStatusRepository.findById(code)
                .orElseThrow(() -> new IllegalStateException("Document status not configured: " + code));
    }

    private DocumentRevisionRecord requireRevision(UUID id) {
        return revisionRepository.findById(id)
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
        int nextMajor = parseVersionPart(version, 0) + 1;
        if (nextMajor <= 0) {
            nextMajor = 1;
        }
        return String.format("%d.0.0", nextMajor);
    }

    private String incrementPatchVersion(String version) {
        // Format is A.0.B: major stays, middle always 0, patch increments
        String normalized = normalizeVersionFormat(version);
        String[] parts = normalized.split("\\.", -1);
        int major = parseSafePart(parts, 0);
        int patch = parseSafePart(parts, 2) + 1;
        return String.format("%d.0.%d", major, patch);
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
     * Normalises any version string to the canonical A.0.B format.
     * The middle part is always 0. Examples:
     *   "0.0.1" â†’ "0.0.1" (unchanged)
     *   "1.0" â†’ "1.0.0", "0.1" â†’ "0.0.1"
     *   "0.1.0" â†’ "0.0.1" (middle non-zero, patch=0 â†’ treat middle as patch)
     *   "1.0.0" â†’ "1.0.0"
     */
    private String normalizeVersionFormat(String version) {
        if (!StringUtils.hasText(version)) {
            return "0.0.1";
        }
        String trimmed = version.trim();
        String[] parts = trimmed.split("\\.", -1);
        int major = parseSafePart(parts, 0);
        int patch;
        if (parts.length == 2) {
            int secondPart = parseSafePart(parts, 1);
            patch = secondPart; // "0.1" â†’ patch=1 â†’ "0.0.1"; "1.0" â†’ patch=0 â†’ "1.0.0"
        } else {
            // 3-part: ignore middle part (index 1), use major and patch (index 2)
            // But if middle was non-zero and patch is 0 (like "0.1.0"), treat middle as patch
            int middle = parseSafePart(parts, 1);
            patch = parseSafePart(parts, 2);
            if (middle != 0 && patch == 0) {
                patch = middle; // "0.1.0" â†’ patch=1 â†’ "0.0.1"
            }
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
                participant == null ? null : participant.getActionComment()
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

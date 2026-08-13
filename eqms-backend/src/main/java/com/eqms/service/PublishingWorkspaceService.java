package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.DocumentParticipantResponse;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.esignature.ElectronicSignatureRecordResponse;
import com.eqms.dto.publishing.PublishingTemplateComponentResponse;
import com.eqms.dto.publishing.PublishingTemplateResponse;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.dto.publishing.PublishingWorkspaceResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.PublishingTemplate;
import com.eqms.entity.PublishingTemplateComponent;
import com.eqms.entity.PublishingWorkspaceJob;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.entity.UserAccount;
import com.eqms.event.PublishingWorkspaceOpenedEvent;
import com.eqms.i18n.LocalizedMessageResolver;
import com.eqms.repository.PublishingTemplateRepository;
import com.eqms.repository.PublishingTemplateComponentRepository;
import com.eqms.repository.PublishingWorkspaceJobRepository;
import com.eqms.repository.RevisionPublishingMetadataRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.context.ApplicationEventPublisher;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Locale;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class PublishingWorkspaceService {

    private final RevisionService revisionService;
    private final DocumentRevisionRepository revisionRepository;
    private final RevisionPublishingMetadataRepository metadataRepository;
    private final PublishingTemplateRepository publishingTemplateRepository;
    private final PublishingTemplateComponentRepository publishingTemplateComponentRepository;
    private final PublishingWorkspaceJobRepository publishingWorkspaceJobRepository;
    private final PublishingWorkspaceJobService publishingWorkspaceJobService;
    private final FileStorageService fileStorageService;
    private final MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;
    private final PublishingPdfComposerService publishingPdfComposerService;
    private final PublishingTemplatePreviewService publishingTemplatePreviewService;
    private final CurrentUserService currentUserService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final AuditTrailService auditTrailService;
    private final StoragePathBuilder storagePathBuilder;
    private final ElectronicSignatureService electronicSignatureService;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher applicationEventPublisher;

    public PublishingWorkspaceService(
            RevisionService revisionService,
            DocumentRevisionRepository revisionRepository,
            RevisionPublishingMetadataRepository metadataRepository,
            PublishingTemplateRepository publishingTemplateRepository,
            PublishingTemplateComponentRepository publishingTemplateComponentRepository,
            PublishingWorkspaceJobRepository publishingWorkspaceJobRepository,
            PublishingWorkspaceJobService publishingWorkspaceJobService,
            FileStorageService fileStorageService,
            MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService,
            PublishingPdfComposerService publishingPdfComposerService,
            PublishingTemplatePreviewService publishingTemplatePreviewService,
            CurrentUserService currentUserService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            StoragePathBuilder storagePathBuilder,
            ElectronicSignatureService electronicSignatureService,
            ObjectMapper objectMapper,
            ApplicationEventPublisher applicationEventPublisher
    ) {
        this.revisionService = revisionService;
        this.revisionRepository = revisionRepository;
        this.metadataRepository = metadataRepository;
        this.publishingTemplateRepository = publishingTemplateRepository;
        this.publishingTemplateComponentRepository = publishingTemplateComponentRepository;
        this.publishingWorkspaceJobRepository = publishingWorkspaceJobRepository;
        this.publishingWorkspaceJobService = publishingWorkspaceJobService;
        this.fileStorageService = fileStorageService;
        this.microsoftGraphOfficeOnlineService = microsoftGraphOfficeOnlineService;
        this.publishingPdfComposerService = publishingPdfComposerService;
        this.publishingTemplatePreviewService = publishingTemplatePreviewService;
        this.currentUserService = currentUserService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.auditTrailService = auditTrailService;
        this.storagePathBuilder = storagePathBuilder;
        this.electronicSignatureService = electronicSignatureService;
        this.objectMapper = objectMapper;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    @Transactional(readOnly = true)
    public PublishingWorkspaceResponse getWorkspace(UUID revisionId) {
        RevisionDetailResponse revision = revisionService.getRevision(revisionId);
        RevisionPublishingMetadata metadata = metadataRepository.findByRevision_Id(revisionId).orElse(null);
        PublishingWorkspaceJob latestJob = publishingWorkspaceJobRepository.findTopByRevisionIdOrderByCreatedAtDesc(revisionId).orElse(null);
        String workspacePreviewPath = resolveWorkspacePreviewPath(revisionId, metadata);
        return toWorkspaceResponse(
                revision,
                metadata,
                countPages(workspacePreviewPath),
                metadata == null || metadata.getPreviewGeneratedBy() == null ? null : metadata.getPreviewGeneratedBy().getFullName(),
                latestJob
        );
    }

    /**
     * Returns a rendered component preview through the publishing-workspace authority.
     * DCOs may publish a revision without having Settings/Configuration permission, so
     * component previews must not be fetched through the settings-only API.
     */
    @Transactional(readOnly = true)
    public byte[] getComponentPreviewPdf(UUID revisionId, UUID templateId, String componentType, String layout) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireReadyRevision(revisionId);
        documentAuthorizationService.requireCanOpenPublishingWorkspace(currentUser, revision);
        if (!publishingTemplateRepository.existsById(templateId)) {
            throw new IllegalArgumentException("Publishing template not found");
        }
        return publishingTemplatePreviewService.getComponentPreviewPdf(templateId, componentType, layout, revisionId);
    }

    @Transactional
    public PublishingWorkspaceResponse openWorkspace(UUID revisionId, PublishingWorkspaceRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireReadyRevision(revisionId);
        documentAuthorizationService.requireCanOpenPublishingWorkspace(currentUser, revision);
        if (StringUtils.hasText(revision.getStorageItemId()) && StringUtils.hasText(revision.getStorageDriveId())) {
            revisionService.syncEditedFileFromOfficeOnlineToMinio(revision, currentUser);
            revisionService.lockOfficeOnlineEditing(revision, currentUser);
        }
        RevisionPublishingMetadata metadata = metadataRepository.findByRevision_Id(revisionId).orElseGet(RevisionPublishingMetadata::new);
        PublishingTemplate template = prepareWorkspaceMetadata(revisionId, request, currentUser, revision, metadata);
        PublishingWorkspaceJob job = publishingWorkspaceJobService.createOpenWorkspaceJob(revisionId, currentUser.getId(), request);
        applicationEventPublisher.publishEvent(new PublishingWorkspaceOpenedEvent(job.getId(), revisionId, currentUser.getId(), request));

        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "OPEN_PUBLISHING_WORKSPACE",
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                revision.getStatus() == null ? null : revision.getStatus().getCode(),
                "Publishing workspace opened and preview generation queued.",
                List.of(
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Selected Template ID", "-", template == null ? "-" : template.getId().toString()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Publishing Template", "-", template == null ? "-" : template.getTemplateName()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Selected Layout", "-", metadata.getSelectedPublishingLayout() == null ? "-" : metadata.getSelectedPublishingLayout())
                )
        );

        return toWorkspaceResponse(
                revisionService.getRevision(revisionId),
                metadata,
                countPages(resolveWorkspacePreviewPath(revisionId, metadata)),
                metadata.getPreviewGeneratedBy() == null ? null : metadata.getPreviewGeneratedBy().getFullName(),
                job
        );
    }

    @Transactional
    public PublishingWorkspaceResponse generatePreview(UUID revisionId, PublishingWorkspaceRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        return generatePreview(revisionId, request, currentUser);
    }

    @Transactional
    public PublishingWorkspaceResponse generatePreview(UUID revisionId, PublishingWorkspaceRequest request, UserAccount currentUser) {
        DocumentRevisionRecord revision = requireReadyRevision(revisionId);
        documentAuthorizationService.requireCanOpenPublishingWorkspace(currentUser, revision);
        RevisionPublishingMetadata metadata = metadataRepository.findByRevision_Id(revisionId).orElseGet(RevisionPublishingMetadata::new);
        PublishingTemplate template = prepareWorkspaceMetadata(revisionId, request, currentUser, revision, metadata);
        String selectedLayout = metadata.getSelectedPublishingLayout();

        try {
            PublishingPdfComposerService.PublishingCompositionResult composition = publishingPdfComposerService.composePreview(
                    revision, template, selectedLayout,
                    request == null ? null : request.enableCover(),
                    request == null ? null : request.enableHeader(),
                    request == null ? null : request.enableFooter()
            );
            byte[] previewBytes = composition.pdfBytes();
            if (previewBytes == null || previewBytes.length == 0) {
                throw new IllegalStateException("Microsoft Graph returned an empty PDF preview");
            }
            try (ByteArrayInputStream input = new ByteArrayInputStream(previewBytes)) {
                FileStorageService.StorageWriteResult stored = fileStorageService.storeRevisionPublishingPreviewFile(
                        revision.getId(),
                        "preview.pdf",
                        input,
                        revision.getDocumentNumber(),
                        revision.getRevisionNumber()
                );
                metadata.setPublishingPreviewPdfPath(stored.storedPath());
                metadata.setPublishingPreviewChecksum(stored.checksum());
                metadata.setPublishingPreviewVersionId(stored.versionId());
                metadata.setConversionEngine("MICROSOFT_GRAPH");
                metadata.setPreviewGeneratedAt(Instant.now());
                metadata.setPreviewGeneratedBy(currentUser);
                metadataRepository.save(metadata);

                revision.setPreviewFilePath(stored.storedPath());
                revision.setStoragePdfUrl(stored.storedPath());
                revisionRepository.save(revision);
            }
            auditTrailService.logAs(
                    currentUser,
                    "REVISION",
                    revision.getRevisionName(),
                    revision.getId(),
                    "GENERATE_PUBLISHING_PREVIEW",
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    revision.getStatus() == null ? null : revision.getStatus().getCode(),
                    "Generated publishing preview for the selected layout.",
                    List.of(
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Selected Template ID", "-", template == null ? "-" : template.getId().toString()),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Publishing Template", "-", template == null ? "-" : template.getTemplateName()),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Selected Layout", "-", selectedLayout == null ? "-" : selectedLayout),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Cover Page Range", "-", pageRangeLabel(template == null ? null : template.getCoverSourcePageFrom(), template == null ? null : template.getCoverSourcePageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Body Page Range", "-", pageRangeLabel(template == null ? null : template.getBodySourcePageFrom(), template == null ? null : template.getBodySourcePageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Header Page Range", "-", pageRangeLabel(template == null ? null : template.getHeaderPageFrom(), template == null ? null : template.getHeaderPageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Footer Page Range", "-", pageRangeLabel(template == null ? null : template.getFooterPageFrom(), template == null ? null : template.getFooterPageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Preview PDF", "-", metadata.getPublishingPreviewPdfPath() == null ? "-" : metadata.getPublishingPreviewPdfPath())
                    )
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to generate publishing preview", ex);
        }

        RevisionDetailResponse refreshedRevision = revisionService.getRevision(revisionId);
        return toWorkspaceResponse(
                refreshedRevision,
                metadata,
                countPages(metadata.getPublishingPreviewPdfPath()),
                currentUser.getFullName(),
                publishingWorkspaceJobRepository.findTopByRevisionIdOrderByCreatedAtDesc(revisionId).orElse(null)
        );
    }

    private PublishingTemplate prepareWorkspaceMetadata(
            UUID revisionId,
            PublishingWorkspaceRequest request,
            UserAccount currentUser,
            DocumentRevisionRecord revision,
            RevisionPublishingMetadata metadata
    ) {
        PublishingTemplate template = resolveTemplate(request == null ? null : request.publishingTemplateId());
        template = applyWorkspacePageRanges(template, request, currentUser);
        metadata.setRevision(revision);
        metadata.setPublishingTemplate(template);
        metadata.setPublishingTemplateVersion(template == null ? null : template.getVersionNumber());
        String selectedLayout = resolveSelectedLayout(template, request == null ? null : request.selectedLayout(), metadata);
        metadata.setSelectedPublishingLayout(selectedLayout);
        metadataRepository.save(metadata);
        return template;
    }

    @Transactional
    public PublishingWorkspaceResponse publish(UUID revisionId, PublishingWorkspaceRequest request) {
        return completePublish(revisionId, request, currentUserService.requireCurrentUser().getId());
    }

    @Transactional
    public PublishingWorkspaceResponse completePublish(UUID revisionId, PublishingWorkspaceRequest request, UUID requestedByUserId) {
        UserAccount currentUser = currentUserService.requireCurrentUser(requestedByUserId);
        DocumentRevisionRecord revision = requireReadyRevision(revisionId);
        if (!electronicSignatureService.hasRevisionSignatureMeaning(revisionId, "PREPARED")) {
            throw new IllegalStateException("Revision editing must be completed before publishing");
        }
        RevisionPublishingMetadata metadata = metadataRepository.findByRevision_Id(revisionId)
                .orElseThrow(() -> new IllegalStateException("Publishing preview has not been generated yet"));
        if (metadata.getPreviewGeneratedAt() == null
                && !StringUtils.hasText(firstNonBlank(metadata.getPublishingPreviewPdfPath(), revision.getPreviewFilePath()))) {
            throw new IllegalStateException("Publishing preview has not been generated yet");
        }
        PublishingTemplate template = metadata.getPublishingTemplate();
        String selectedLayout = resolveSelectedLayout(template, request == null ? null : request.selectedLayout(), metadata);
        if (StringUtils.hasText(metadata.getSelectedPublishingLayout()) && !metadata.getSelectedPublishingLayout().equalsIgnoreCase(selectedLayout)) {
            throw new IllegalStateException("Selected layout does not match the generated preview. Regenerate preview first.");
        }
        template = applyWorkspacePageRanges(template, request, currentUser);
        metadata.setSelectedPublishingLayout(selectedLayout);
        validateSignaturePlaceholders(template, selectedLayout, revisionId, true);
        revisionService.publishRevision(revisionId, new com.eqms.dto.document.RevisionWorkflowActionRequest(
                request == null ? null : request.changeSummary(),
                request == null || request.reason() == null ? (request == null ? null : request.changeSummary()) : request.reason(),
                request == null ? null : request.signatureToken(),
                false
        ), currentUser);

        // Recompose from the current template/placeholder-style state instead of trusting the
        // last-generated preview file — a placeholder style saved after that preview was
        // generated must still be reflected in the published PDF.
        String publishedSourcePath;
        try {
            DocumentRevisionRecord publishedRevision = revisionRepository.findById(revisionId)
                    .orElseThrow(() -> new IllegalStateException("Published revision not found"));
            PublishingPdfComposerService.PublishingCompositionResult composition = publishingPdfComposerService.composePreview(
                    publishedRevision, template, selectedLayout, null, null, null
            );
            byte[] publishedBytes = composition.pdfBytes();
            if (publishedBytes == null || publishedBytes.length == 0) {
                throw new IllegalStateException("Published PDF is not available");
            }
            try (ByteArrayInputStream input = new ByteArrayInputStream(publishedBytes)) {
                FileStorageService.StorageWriteResult published = fileStorageService.storeRevisionPublishedPdf(
                        publishedRevision.getId(),
                        "published.pdf",
                        input,
                        publishedRevision.getDocumentNumber(),
                        publishedRevision.getRevisionNumber()
                );
                metadata.setPublishedPdfPath(published.storedPath());
                metadata.setPublishedPdfChecksum(published.checksum());
                metadata.setPublishedPdfVersionId(published.versionId());
                metadata.setPublishedAt(Instant.now());
                metadata.setPublishedBy(currentUser);
                metadataRepository.save(metadata);

                publishedRevision.setStoragePdfUrl(published.storedPath());
                revisionRepository.save(publishedRevision);
                publishedSourcePath = published.storedPath();
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store published PDF", ex);
        }

        auditTrailService.logAs(
                currentUser,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "PUBLISH_TO_EFFECTIVE",
                "READY_FOR_PUBLISHING",
                "EFFECTIVE",
                "Promoted the latest review snapshot PDF to the official published PDF and marked the revision Effective.",
                List.of(
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Selected Template ID", "-", template == null ? "-" : template.getId().toString()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Publishing Template", "-", template == null ? "-" : template.getTemplateName()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Selected Layout", "-", selectedLayout == null ? "-" : selectedLayout),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Cover Page Range", "-", pageRangeLabel(template == null ? null : template.getCoverSourcePageFrom(), template == null ? null : template.getCoverSourcePageTo())),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Body Page Range", "-", pageRangeLabel(template == null ? null : template.getBodySourcePageFrom(), template == null ? null : template.getBodySourcePageTo())),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Header Page Range", "-", pageRangeLabel(template == null ? null : template.getHeaderPageFrom(), template == null ? null : template.getHeaderPageTo())),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Footer Page Range", "-", pageRangeLabel(template == null ? null : template.getFooterPageFrom(), template == null ? null : template.getFooterPageTo())),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Review Snapshot PDF", "-", publishedSourcePath),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Published PDF", "-", metadata.getPublishedPdfPath() == null ? "-" : metadata.getPublishedPdfPath())
                )
        );
        return toWorkspaceResponse(
                revisionService.getRevision(revisionId),
                metadata,
                countPages(metadata.getPublishedPdfPath()),
                metadata.getPreviewGeneratedBy() == null ? currentUser.getFullName() : metadata.getPreviewGeneratedBy().getFullName(),
                publishingWorkspaceJobRepository.findTopByRevisionIdOrderByCreatedAtDesc(revisionId).orElse(null)
        );
    }

    @Transactional(readOnly = true)
    public byte[] getPreviewPdf(UUID revisionId) {
        RevisionPublishingMetadata metadata = metadataRepository.findByRevision_Id(revisionId)
                .orElseThrow(() -> new IllegalStateException("Publishing preview has not been generated yet"));
        String previewPath = resolveWorkspacePreviewPath(revisionId, metadata);
        if (!StringUtils.hasText(previewPath)) {
            throw new IllegalStateException("Publishing preview has not been generated yet");
        }
        try {
            return fileStorageService.readFile(previewPath);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load publishing preview PDF", ex);
        }
    }

    private DocumentRevisionRecord requireReadyRevision(UUID revisionId) {
        DocumentRevisionRecord revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
        String status = revision.getStatus() == null ? null : revision.getStatus().getCode();
        if (!"READY_FOR_PUBLISHING".equalsIgnoreCase(status)) {
            throw new IllegalStateException("Revision must be Ready For Publishing");
        }
        return revision;
    }

    private PublishingTemplate resolveTemplate(String templateId) {
        if (!StringUtils.hasText(templateId)) {
            return publishingTemplateRepository.findByStatusOrderByTemplateNameAsc("ACTIVE").stream().findFirst().orElse(null);
        }
        return publishingTemplateRepository.findById(UUID.fromString(templateId))
                .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
    }

    private PublishingWorkspaceResponse toWorkspaceResponse(RevisionDetailResponse revision, RevisionPublishingMetadata metadata, Integer pageCount, String generatedBy) {
        return toWorkspaceResponse(revision, metadata, pageCount, generatedBy, null);
    }

    private PublishingWorkspaceResponse toWorkspaceResponse(RevisionDetailResponse revision, RevisionPublishingMetadata metadata, Integer pageCount, String generatedBy, PublishingWorkspaceJob job) {
        PublishingTemplate selectedTemplate = metadata == null ? null : metadata.getPublishingTemplate();
        String workspacePreviewPath = resolveWorkspacePreviewPath(revision == null ? null : UUID.fromString(revision.id()), metadata);
        List<PublishingTemplateResponse> templates = publishingTemplateRepository.findAll().stream().map(template -> new PublishingTemplateResponse(
                template.getId(),
                template.getTemplateName(),
                template.getDocumentType(),
                template.getVersionNumber(),
                template.getStatus(),
                template.getDescription(),
                template.getCoverTemplatePath(),
                template.getBodyTemplatePath(),
                template.getHeaderTemplatePath(),
                template.getFooterTemplatePath(),
                template.getLogoTemplatePath(),
                template.getCoverFileName(),
                template.getBodyFileName(),
                template.getHeaderFileName(),
                template.getFooterFileName(),
                template.getLogoFileName(),
                template.getPublishingMode(),
                template.getCoverOrientation(),
                template.getBodyOrientation(),
                template.isEnableHeader(),
                template.isEnableFooter(),
                template.isShowLogo(),
                template.isShowQrCode(),
                template.isShowBarcode(),
                template.isShowConfidentiality(),
                template.isShowElectronicSignatureInformation(),
                template.getWatermarkMode(),
                template.getCoverSourcePageFrom(),
                template.getCoverSourcePageTo(),
                template.getBodySourcePageFrom(),
                template.getBodySourcePageTo(),
                template.getHeaderPageFrom(),
                template.getHeaderPageTo(),
                template.getFooterPageFrom(),
                template.getFooterPageTo(),
                template.getWatermarkPageFrom(),
                template.getWatermarkPageTo(),
                template.getCreatedAt(),
                template.getUpdatedAt(),
                template.getCreatedBy(),
                template.getUpdatedBy(),
                template.getPublishedAt(),
                template.getPublishedBy(),
                templateComponents(template.getId())
        )).toList();

        return new PublishingWorkspaceResponse(
                revision == null ? null : UUID.fromString(revision.id()),
                revision == null ? null : revision.statusInfo() == null ? revision.status() : revision.statusInfo().code(),
                revision,
                templates,
                metadata == null || metadata.getPublishingTemplate() == null ? null : metadata.getPublishingTemplate().getId(),
                metadata == null ? null : metadata.getPublishingTemplateVersion(),
                workspacePreviewPath,
                metadata == null ? null : metadata.getPublishingPreviewChecksum(),
                metadata == null ? null : metadata.getPublishedPdfPath(),
                metadata == null ? null : metadata.getConversionEngine(),
                metadata != null && StringUtils.hasText(workspacePreviewPath),
                metadata != null && StringUtils.hasText(workspacePreviewPath),
                selectedTemplate == null ? null : selectedTemplate.getTemplateName(),
                selectedTemplate == null ? null : selectedTemplate.getStatus(),
                revision == null ? null : revision.fileName(),
                pageCount,
                metadata == null ? null : metadata.getPreviewGeneratedAt(),
                generatedBy,
                metadata == null || metadata.getPublishedBy() == null ? null : metadata.getPublishedBy().getFullName(),
                metadata == null ? null : metadata.getPublishingPreviewChecksum(),
                metadata == null ? null : metadata.getSelectedPublishingLayout(),
                templateLayouts(selectedTemplate),
                availablePreviewComponents(selectedTemplate),
                job == null ? null : job.getId(),
                job == null ? null : job.getStatus(),
                job == null ? null : localizeJobMessage(job),
                job == null ? null : localizeJobError(job)
        );
    }

    /**
     * Jobs are persisted once and may be polled later in a different locale.
     * Translate known lifecycle messages at response time instead of leaking
     * the original English text stored by older workers.
     */
    private String localizeJobMessage(PublishingWorkspaceJob job) {
        String message = job.getMessage();
        if (message == null || message.isBlank()) {
            return message;
        }
        String code = switch (message) {
            case "Publishing job queued" -> "job_queued";
            case "Publishing workspace preview queued" -> "preview_queued";
            case "Processing publishing package and electronic signature." -> "job_processing";
            case "Generating publishing workspace preview." -> "preview_processing";
            case "Publishing completed successfully." -> "job_completed";
            case "Publishing workspace preview generated successfully." -> "preview_completed";
            case "Publishing failed" -> "job_failed";
            default -> null;
        };
        return code == null ? message : LocalizedMessageResolver.resolve("publishing", code, message);
    }

    private String localizeJobError(PublishingWorkspaceJob job) {
        String errorMessage = job.getErrorMessage();
        if (errorMessage == null || errorMessage.isBlank()) {
            return errorMessage;
        }
        return "FAILED".equalsIgnoreCase(job.getStatus())
                ? LocalizedMessageResolver.resolve("publishing", "job_failed_detail", errorMessage)
                : errorMessage;
    }

    private Integer countPages(String path) {
        if (!StringUtils.hasText(path)) {
            return null;
        }
        try {
            byte[] bytes = fileStorageService.readFile(path);
            try (var document = org.apache.pdfbox.Loader.loadPDF(bytes)) {
                return document.getNumberOfPages();
            }
        } catch (Exception ex) {
            return null;
        }
    }

    private String resolveWorkspacePreviewPath(UUID revisionId, RevisionPublishingMetadata metadata) {
        if (metadata == null) {
            return null;
        }
        if (StringUtils.hasText(metadata.getPublishedPdfPath())) {
            return metadata.getPublishedPdfPath();
        }
        if (StringUtils.hasText(metadata.getPublishingPreviewPdfPath())) {
            return metadata.getPublishingPreviewPdfPath();
        }
        if (revisionId == null) {
            return null;
        }
        return metadataRepository.findByRevision_Id(revisionId)
                .map(RevisionPublishingMetadata::getPublishingPreviewPdfPath)
                .filter(StringUtils::hasText)
                .orElse(null);
    }

    private String resolveSelectedLayout(PublishingTemplate template, String requestedLayout, RevisionPublishingMetadata metadata) {
        List<String> availableLayouts = templateLayouts(template);
        String normalizedRequest = normalizeLayout(requestedLayout);
        if (StringUtils.hasText(normalizedRequest)) {
            if (!availableLayouts.contains(normalizedRequest)) {
                throw new IllegalStateException(normalizedRequest + " layout is not configured for this Publishing Template.");
            }
            return normalizedRequest;
        }
        if (metadata != null && StringUtils.hasText(metadata.getSelectedPublishingLayout()) && availableLayouts.contains(metadata.getSelectedPublishingLayout())) {
            return metadata.getSelectedPublishingLayout();
        }
        if (availableLayouts.size() == 1) {
            return availableLayouts.get(0);
        }
        if (availableLayouts.isEmpty()) {
            throw new IllegalStateException("No publishing layout is configured for this Publishing Template.");
        }
        throw new IllegalStateException("Publishing Layout is required.");
    }

    private List<String> templateLayouts(PublishingTemplate template) {
        if (template == null) {
            return List.of();
        }
        return resolveAvailableLayouts(template);
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

    private List<String> availablePreviewComponents(PublishingTemplate template) {
        if (template == null) {
            return List.of();
        }
        LinkedHashSet<String> components = new LinkedHashSet<>();
        List<PublishingTemplateComponent> templateComponents = publishingTemplateComponentRepository.findByTemplate_IdOrderByComponentTypeAscLayoutAsc(template.getId());
        for (PublishingTemplateComponent component : templateComponents) {
            if (component == null || !StringUtils.hasText(component.getComponentType())) {
                continue;
            }
            if (!StringUtils.hasText(component.getObjectKey()) && !StringUtils.hasText(component.getFileName())) {
                continue;
            }
            String normalized = component.getComponentType().trim().toLowerCase();
            if (List.of("cover", "header", "footer").contains(normalized)) {
                components.add(normalized);
            }
        }
        return new ArrayList<>(components);
    }

    private List<PublishingTemplateComponentResponse> templateComponents(UUID templateId) {
        return publishingTemplateComponentRepository.findByTemplate_IdOrderByComponentTypeAscLayoutAsc(templateId).stream()
                .map(component -> new PublishingTemplateComponentResponse(
                        component.getId(),
                        component.getComponentType(),
                        component.getLayout(),
                        component.getObjectKey(),
                        component.getFileName(),
                        component.getChecksum(),
                        component.getVersionNumber(),
                        component.getStatus(),
                        List.of(),
                        StringUtils.hasText(component.getObjectKey()),
                        component.getUploadedAt(),
                        component.getUploadedBy() == null ? null : component.getUploadedBy().getFullName()
                ))
                .toList();
    }

    private String normalizeLayout(String layout) {
        if (!StringUtils.hasText(layout)) {
            return null;
        }
        String normalized = layout.trim().toUpperCase();
        return "LANDSCAPE".equals(normalized) ? "LANDSCAPE" : "PORTRAIT";
    }

    private PublishingTemplate applyWorkspacePageRanges(PublishingTemplate template, PublishingWorkspaceRequest request, UserAccount currentUser) {
        if (template == null) {
            return null;
        }

        Integer previousCoverFrom = template.getCoverSourcePageFrom();
        Integer previousCoverTo = template.getCoverSourcePageTo();
        Integer previousBodyFrom = template.getBodySourcePageFrom();
        Integer previousBodyTo = template.getBodySourcePageTo();
        Integer previousHeaderFrom = template.getHeaderPageFrom();
        Integer previousHeaderTo = template.getHeaderPageTo();
        Integer previousFooterFrom = template.getFooterPageFrom();
        Integer previousFooterTo = template.getFooterPageTo();
        Integer previousWatermarkFrom = template.getWatermarkPageFrom();
        Integer previousWatermarkTo = template.getWatermarkPageTo();

        Integer headerFrom = normalizePageStart(request == null ? null : request.headerPageFrom(), previousHeaderFrom, 2);
        Integer headerTo = normalizePageEnd(request == null ? null : request.headerPageTo(), previousHeaderTo, headerFrom);
        Integer footerFrom = normalizePageStart(request == null ? null : request.footerPageFrom(), previousFooterFrom, 2);
        Integer footerTo = normalizePageEnd(request == null ? null : request.footerPageTo(), previousFooterTo, footerFrom);

        template.setCoverSourcePageFrom(1);
        template.setCoverSourcePageTo(1);
        template.setBodySourcePageFrom(2);
        template.setBodySourcePageTo(null);
        template.setHeaderPageFrom(headerFrom);
        template.setHeaderPageTo(headerTo);
        template.setFooterPageFrom(footerFrom);
        template.setFooterPageTo(footerTo);

        if (request != null && (request.watermarkPageFrom() != null || request.watermarkPageTo() != null)) {
            template.setWatermarkPageFrom(request.watermarkPageFrom());
            template.setWatermarkPageTo(request.watermarkPageTo());
        }

        if (hasPageRangeChanges(
                template,
                previousCoverFrom,
                previousCoverTo,
                previousBodyFrom,
                previousBodyTo,
                previousHeaderFrom,
                previousHeaderTo,
                previousFooterFrom,
                previousFooterTo,
                previousWatermarkFrom,
                previousWatermarkTo
        )) {
            template.setUpdatedBy(currentUser == null ? template.getUpdatedBy() : currentUser.getFullName());
            publishingTemplateRepository.save(template);
            auditTrailService.logAs(
                    currentUser,
                    "PUBLISHING_TEMPLATE",
                    template.getTemplateName(),
                    template.getId(),
                    "PUBLISHING_TEMPLATE_PAGE_RANGE_UPDATED",
                    "DRAFT",
                    "DRAFT",
                    "Updated page range rules for publishing workspace.",
                    List.of(
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Cover Page Range", pageRangeLabel(previousCoverFrom, previousCoverTo), pageRangeLabel(template.getCoverSourcePageFrom(), template.getCoverSourcePageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Body Page Range", pageRangeLabel(previousBodyFrom, previousBodyTo), pageRangeLabel(template.getBodySourcePageFrom(), template.getBodySourcePageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Header Page Range", pageRangeLabel(previousHeaderFrom, previousHeaderTo), pageRangeLabel(template.getHeaderPageFrom(), template.getHeaderPageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Footer Page Range", pageRangeLabel(previousFooterFrom, previousFooterTo), pageRangeLabel(template.getFooterPageFrom(), template.getFooterPageTo())),
                            new com.eqms.dto.audittrail.AuditTrailChangeResponse("Watermark Page Range", pageRangeLabel(previousWatermarkFrom, previousWatermarkTo), pageRangeLabel(template.getWatermarkPageFrom(), template.getWatermarkPageTo()))
                    )
            );
        }

        return template;
    }

    private Integer normalizePageStart(Integer requested, Integer existing, int minimum) {
        Integer candidate = requested != null ? requested : existing;
        if (candidate == null || candidate < minimum) {
            return minimum;
        }
        return candidate;
    }

    private Integer normalizePageEnd(Integer requested, Integer existing, Integer from) {
        Integer candidate = requested != null ? requested : existing;
        if (candidate == null) {
            return null;
        }
        if (candidate < 1) {
            throw new IllegalArgumentException("Page range end must be greater than 0");
        }
        if (from != null && candidate < from) {
            throw new IllegalArgumentException("Page range end must be greater than or equal to start");
        }
        return candidate;
    }

    private boolean hasPageRangeChanges(
            PublishingTemplate template,
            Integer previousCoverFrom,
            Integer previousCoverTo,
            Integer previousBodyFrom,
            Integer previousBodyTo,
            Integer previousHeaderFrom,
            Integer previousHeaderTo,
            Integer previousFooterFrom,
            Integer previousFooterTo,
            Integer previousWatermarkFrom,
            Integer previousWatermarkTo
    ) {
        return !Objects.equals(previousCoverFrom, template.getCoverSourcePageFrom())
                || !Objects.equals(previousCoverTo, template.getCoverSourcePageTo())
                || !Objects.equals(previousBodyFrom, template.getBodySourcePageFrom())
                || !Objects.equals(previousBodyTo, template.getBodySourcePageTo())
                || !Objects.equals(previousHeaderFrom, template.getHeaderPageFrom())
                || !Objects.equals(previousHeaderTo, template.getHeaderPageTo())
                || !Objects.equals(previousFooterFrom, template.getFooterPageFrom())
                || !Objects.equals(previousFooterTo, template.getFooterPageTo())
                || !Objects.equals(previousWatermarkFrom, template.getWatermarkPageFrom())
                || !Objects.equals(previousWatermarkTo, template.getWatermarkPageTo());
    }

    private String pageRangeLabel(Integer from, Integer to) {
        if (from == null && to == null) {
            return "All pages";
        }
        if (from == null) {
            return "1 - " + to;
        }
        if (to == null) {
            return from + " - end";
        }
        return from + " - " + to;
    }

    private void validateSignaturePlaceholders(PublishingTemplate template, String selectedLayout, UUID revisionId, boolean allowPublishedSignature) {
        if (template == null || revisionId == null || !StringUtils.hasText(selectedLayout)) {
            return;
        }
        RevisionDetailResponse revision = revisionService.getRevision(revisionId);

        List<PublishingTemplateComponent> matchingComponents = publishingTemplateComponentRepository
                .findByTemplate_IdOrderByComponentTypeAscLayoutAsc(template.getId())
                .stream()
                .filter(component -> component != null
                        && requiredComponentTypes(template).contains(component.getComponentType() == null ? null : component.getComponentType().trim().toLowerCase())
                        && selectedLayout.equalsIgnoreCase(normalizeLayout(component.getLayout())))
                .toList();

        LinkedHashSet<String> placeholderKeys = new LinkedHashSet<>();
        for (PublishingTemplateComponent component : matchingComponents) {
            placeholderKeys.addAll(parseDetectedPlaceholders(component.getDetectedPlaceholders()));
        }
        if (placeholderKeys.isEmpty()) {
            return;
        }

        LinkedHashSet<String> signedMeanings = electronicSignatureService.getRevisionSignatures(revisionId).stream()
                .map(ElectronicSignatureRecordResponse::meaning)
                .filter(StringUtils::hasText)
                .map(this::normalizeMeaning)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        LinkedHashSet<String> missingMeanings = new LinkedHashSet<>();
        boolean hasPublishedSignature = false;
        for (String placeholderKey : placeholderKeys) {
            String meaning = signatureMeaningFromPlaceholder(placeholderKey);
            if (!StringUtils.hasText(meaning)) {
                continue;
            }
            if (isReviewerSignaturePlaceholder(placeholderKey)) {
                List<DocumentParticipantResponse> reviewers = revision == null ? null : revision.reviewers();
                long completedReviewers = countCompletedParticipants(reviewers);
                if (completedReviewers == 0L || hasIncompleteParticipants(reviewers) || countSignedMeanings(revisionId, "REVIEWED") < completedReviewers) {
                    missingMeanings.add("REVIEWED");
                }
                continue;
            }
            if (isApproverSignaturePlaceholder(placeholderKey)) {
                List<DocumentParticipantResponse> approvers = revision == null ? null : revision.approvers();
                long completedApprovers = countCompletedParticipants(approvers);
                if (completedApprovers == 0L || hasIncompleteParticipants(approvers) || countSignedMeanings(revisionId, "APPROVED") < completedApprovers) {
                    missingMeanings.add("APPROVED");
                }
                continue;
            }
            if ("PUBLISHED".equalsIgnoreCase(meaning)) {
                hasPublishedSignature = true;
                continue;
            }
            if (!signedMeanings.contains(normalizeMeaning(meaning))) {
                missingMeanings.add(normalizeMeaning(meaning));
            }
        }

        if (!missingMeanings.isEmpty()) {
            throw new IllegalStateException("Cannot generate publishing preview. Missing required electronic signature(s): " + String.join(", ", missingMeanings));
        }
        if (!allowPublishedSignature && hasPublishedSignature) {
            throw new IllegalStateException("Cannot generate publishing preview. PUBLISHED_SIGNATURE is only available after publishing.");
        }
    }

    private List<String> parseDetectedPlaceholders(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String signatureMeaningFromPlaceholder(String placeholder) {
        PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(placeholder);
        if (token == null || !StringUtils.hasText(token.name())) {
            return null;
        }
        String normalized = token.name().trim().toUpperCase();
        String stripped = normalized
                .replaceAll("([_\\-\\s]?SIGNATURE)$", "")
                .replaceAll("([_\\-\\s]?BLOCK)$", "")
                .replaceAll("([_\\-\\s]?DISPLAY)$", "")
                .trim();
        String collapsed = stripped.replaceAll("[_\\-\\s]+", "");
        if (collapsed.startsWith("REVIEWERSIGNATURE")) {
            return "REVIEWED";
        }
        if (collapsed.startsWith("APPROVERSIGNATURE")) {
            return "APPROVED";
        }
        if ("REVIEWERSIGNATURES".equals(collapsed)) {
            return "REVIEWED";
        }
        if ("APPROVERSIGNATURES".equals(collapsed)) {
            return "APPROVED";
        }
        return switch (collapsed) {
            case "PREPARED", "AUTHOR", "AUTHORNAME", "PREPAREDBY", "PREPAREDBYNAME" ->
                    "PREPARED";
            case "DCO", "SUBMITTED", "SUBMITTEDFORREVIEW", "SUBMITTEDBY", "SUBMITTEDBYUSERNAME" ->
                    "SUBMITTED_FOR_REVIEW";
            case "REVIEWED", "CHECKEDBY", "REVIEWEDBY" -> "REVIEWED";
            case "APPROVED" -> "APPROVED";
            case "TRAININGCONFIRMED" -> "TRAINING_CONFIRMED";
            case "PUBLISHED" -> "PUBLISHED";
            case "OBSOLETED" -> "OBSOLETED";
            case "CANCELLED" -> "CANCELLED";
            default -> null;
        };
    }

    private boolean isReviewerSignaturePlaceholder(String placeholder) {
        return normalizeSignaturePlaceholderKey(placeholder).startsWith("REVIEWERSIGNATURE");
    }

    private boolean isApproverSignaturePlaceholder(String placeholder) {
        return normalizeSignaturePlaceholderKey(placeholder).startsWith("APPROVERSIGNATURE");
    }

    private String normalizeSignaturePlaceholderKey(String placeholder) {
        PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(placeholder);
        if (token == null || !StringUtils.hasText(token.name())) {
            return "";
        }
        return token.name().trim().toUpperCase(Locale.ROOT).replaceAll("[_\\-\\s]+", "");
    }

    private boolean hasIncompleteParticipants(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return false;
        }
        return participants.stream().anyMatch(participant -> !isParticipantComplete(participant));
    }

    private long countCompletedParticipants(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return 0L;
        }
        return participants.stream().filter(this::isParticipantComplete).count();
    }

    private long countSignedMeanings(UUID revisionId, String meaning) {
        if (revisionId == null || !StringUtils.hasText(meaning)) {
            return 0L;
        }
        String normalized = normalizeMeaning(meaning);
        return electronicSignatureService.getRevisionSignatures(revisionId).stream()
                .map(ElectronicSignatureRecordResponse::meaning)
                .filter(StringUtils::hasText)
                .map(this::normalizeMeaning)
                .filter(normalized::equals)
                .count();
    }

    private boolean isParticipantComplete(DocumentParticipantResponse participant) {
        if (participant == null || !StringUtils.hasText(participant.actionStatus())) {
            return false;
        }
        String normalized = participant.actionStatus().trim().toUpperCase(Locale.ROOT);
        return !"PENDING".equals(normalized) && !"REJECTED".equals(normalized);
    }

    private String normalizeMeaning(String meaning) {
        if (!StringUtils.hasText(meaning)) {
            return null;
        }
        return meaning.trim().toUpperCase().replace('-', '_').replace(' ', '_');
    }

    private List<String> resolveAvailableLayouts(PublishingTemplate template) {
        List<String> requiredComponents = requiredComponentTypes(template);
        if (requiredComponents.isEmpty()) {
            return List.of();
        }

        List<PublishingTemplateComponent> allComponents = publishingTemplateComponentRepository.findByTemplate_IdOrderByComponentTypeAscLayoutAsc(template.getId());
        LinkedHashSet<String> availableLayouts = new LinkedHashSet<>();

        for (String candidateLayout : List.of("PORTRAIT", "LANDSCAPE")) {
            boolean supported = true;
            for (String requiredComponent : requiredComponents) {
                if (!hasComponentForLayout(template, allComponents, requiredComponent, candidateLayout)) {
                    supported = false;
                    break;
                }
            }
            if (supported) {
                availableLayouts.add(candidateLayout);
            }
        }

        return new ArrayList<>(availableLayouts);
    }

    private List<String> requiredComponentTypes(PublishingTemplate template) {
        String mode = template == null ? null : template.getPublishingMode();
        String normalizedMode = StringUtils.hasText(mode) ? mode.trim().toUpperCase() : "COVER_ONLY";
        return switch (normalizedMode) {
            case "COVER_HEADER_FOOTER", "COVER_AND_HEADER_FOOTER" -> List.of("cover", "header", "footer");
            case "HEADER_FOOTER_ONLY", "BODY_HEADER_FOOTER_ONLY" -> List.of("header", "footer");
            default -> List.of("cover");
        };
    }

    private boolean hasComponentForLayout(PublishingTemplate template, List<PublishingTemplateComponent> components, String componentType, String layout) {
        boolean hasStoredComponent = components.stream().anyMatch(component ->
                componentType.equalsIgnoreCase(component.getComponentType())
                        && layout.equalsIgnoreCase(component.getLayout())
                        && StringUtils.hasText(component.getObjectKey())
        );
        if (hasStoredComponent) {
            return true;
        }
        if ("PORTRAIT".equalsIgnoreCase(layout)) {
            return switch (componentType.toLowerCase()) {
                case "cover" -> StringUtils.hasText(template.getCoverTemplatePath());
                case "header" -> StringUtils.hasText(template.getHeaderTemplatePath());
                case "footer" -> StringUtils.hasText(template.getFooterTemplatePath());
                default -> false;
            };
        }
        return false;
    }
}

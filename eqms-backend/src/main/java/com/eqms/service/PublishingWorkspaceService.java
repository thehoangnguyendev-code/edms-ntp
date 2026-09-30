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
        // OnlyOffice keeps MinIO current on every save via its push callback -- there is no
        // separate "pull the latest edit"/"lock remote access" step needed here anymore.
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
        PublishingTemplate storedTemplate = resolveTemplate(request == null ? null : request.publishingTemplateId());
        metadata.setRevision(revision);
        metadata.setPublishingTemplate(storedTemplate);
        metadata.setPublishingTemplateVersion(storedTemplate == null ? null : storedTemplate.getVersionNumber());
        // Page ranges are this revision's choice: recorded on its metadata and applied to a detached copy of the
        // template. The shared template row is never modified by a publishing action.
        PublishingTemplate template = applyWorkspacePageRanges(storedTemplate, metadata, request, currentUser);
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
        PublishingTemplate storedTemplate = metadata.getPublishingTemplate();
        if (storedTemplate != null && !isLiveTemplate(storedTemplate)) {
            throw new com.eqms.exception.RevisionLifecycleConflictException("PUBLISHING_TEMPLATE_NOT_ACTIVE",
                    "The Publishing Template used for this preview is no longer the active template. Regenerate the preview before publishing.");
        }
        PublishingTemplate template = storedTemplate;
        String selectedLayout = resolveSelectedLayout(template, request == null ? null : request.selectedLayout(), metadata);
        if (StringUtils.hasText(metadata.getSelectedPublishingLayout()) && !metadata.getSelectedPublishingLayout().equalsIgnoreCase(selectedLayout)) {
            throw new IllegalStateException("Selected layout does not match the generated preview. Regenerate preview first.");
        }
        template = applyWorkspacePageRanges(storedTemplate, metadata, request, currentUser);
        metadata.setSelectedPublishingLayout(selectedLayout);
        validateSignaturePlaceholders(template, selectedLayout, revisionId, true);
        revisionService.publishRevision(revisionId, new com.eqms.dto.document.RevisionWorkflowActionRequest(
                request == null ? null : request.changeSummary(),
                request == null || request.reason() == null ? (request == null ? null : request.changeSummary()) : request.reason(),
                request == null ? null : request.signatureToken()
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

    /** Only the single active Publishing Template may be used; a client-supplied id can only confirm it. */
    private PublishingTemplate resolveTemplate(String templateId) {
        PublishingTemplate active = publishingTemplateRepository.findAll().stream()
                .filter(this::isLiveTemplate)
                .findFirst()
                .orElse(null);
        if (StringUtils.hasText(templateId)) {
            UUID requested;
            try {
                requested = UUID.fromString(templateId.trim());
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Publishing template not found");
            }
            if (active == null || !active.getId().equals(requested)) {
                throw new com.eqms.exception.RevisionLifecycleConflictException("PUBLISHING_TEMPLATE_NOT_ACTIVE",
                        "Only the active Publishing Template can be used. Reload the workspace to use it.");
            }
        }
        return active;
    }

    private boolean isLiveTemplate(PublishingTemplate template) {
        return template != null && ("ACTIVE".equalsIgnoreCase(template.getStatus()) || "PUBLISHED".equalsIgnoreCase(template.getStatus()));
    }

    private PublishingWorkspaceResponse toWorkspaceResponse(RevisionDetailResponse revision, RevisionPublishingMetadata metadata, Integer pageCount, String generatedBy) {
        return toWorkspaceResponse(revision, metadata, pageCount, generatedBy, null);
    }

    private PublishingWorkspaceResponse toWorkspaceResponse(RevisionDetailResponse revision, RevisionPublishingMetadata metadata, Integer pageCount, String generatedBy, PublishingWorkspaceJob job) {
        PublishingTemplate selectedTemplate = metadata == null ? null : metadata.getPublishingTemplate();
        String workspacePreviewPath = resolveWorkspacePreviewPath(revision == null ? null : UUID.fromString(revision.id()), metadata);
        boolean useRevisionRanges = metadata != null && metadata.isPageRangesRecorded();
        List<PublishingTemplateResponse> templates = publishingTemplateRepository.findAll().stream().filter(this::isLiveTemplate).map(template -> new PublishingTemplateResponse(
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
                useRevisionRanges ? metadata.getHeaderPageFrom() : template.getHeaderPageFrom(),
                useRevisionRanges ? metadata.getHeaderPageTo() : template.getHeaderPageTo(),
                useRevisionRanges ? metadata.getFooterPageFrom() : template.getFooterPageFrom(),
                useRevisionRanges ? metadata.getFooterPageTo() : template.getFooterPageTo(),
                useRevisionRanges ? metadata.getWatermarkPageFrom() : template.getWatermarkPageFrom(),
                useRevisionRanges ? metadata.getWatermarkPageTo() : template.getWatermarkPageTo(),
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
                job == null ? null : job.getMessage(),
                job == null ? null : job.getErrorMessage()
        );
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

    /**
     * Records this revision's page ranges on its publishing metadata and returns a DETACHED copy of the template with
     * them applied, for composing only. The shared template row is left untouched.
     */
    private PublishingTemplate applyWorkspacePageRanges(
            PublishingTemplate template,
            RevisionPublishingMetadata metadata,
            PublishingWorkspaceRequest request,
            UserAccount currentUser
    ) {
        if (template == null) {
            return null;
        }
        boolean recorded = metadata != null && metadata.isPageRangesRecorded();
        Integer previousHeaderFrom = recorded ? metadata.getHeaderPageFrom() : template.getHeaderPageFrom();
        Integer previousHeaderTo = recorded ? metadata.getHeaderPageTo() : template.getHeaderPageTo();
        Integer previousFooterFrom = recorded ? metadata.getFooterPageFrom() : template.getFooterPageFrom();
        Integer previousFooterTo = recorded ? metadata.getFooterPageTo() : template.getFooterPageTo();
        Integer previousWatermarkFrom = recorded ? metadata.getWatermarkPageFrom() : template.getWatermarkPageFrom();
        Integer previousWatermarkTo = recorded ? metadata.getWatermarkPageTo() : template.getWatermarkPageTo();

        Integer headerFrom = normalizePageStart(request == null ? null : request.headerPageFrom(), previousHeaderFrom, 2);
        // The workspace always posts the full range set (From is always present), so a blank "To" then
        // means "to end" -- falling back to the previously saved "To" made it impossible to clear.
        boolean fullRangeSet = request != null && request.headerPageFrom() != null && request.footerPageFrom() != null;
        Integer headerTo = normalizePageEnd(request == null ? null : request.headerPageTo(), fullRangeSet ? null : previousHeaderTo, headerFrom);
        Integer footerFrom = normalizePageStart(request == null ? null : request.footerPageFrom(), previousFooterFrom, 2);
        Integer footerTo = normalizePageEnd(request == null ? null : request.footerPageTo(), fullRangeSet ? null : previousFooterTo, footerFrom);
        Integer watermarkFrom = previousWatermarkFrom;
        Integer watermarkTo = previousWatermarkTo;
        if (request != null && (request.watermarkPageFrom() != null || request.watermarkPageTo() != null)) {
            watermarkFrom = request.watermarkPageFrom();
            watermarkTo = request.watermarkPageTo();
        }

        boolean changed = !recorded
                || !Objects.equals(previousHeaderFrom, headerFrom) || !Objects.equals(previousHeaderTo, headerTo)
                || !Objects.equals(previousFooterFrom, footerFrom) || !Objects.equals(previousFooterTo, footerTo)
                || !Objects.equals(previousWatermarkFrom, watermarkFrom) || !Objects.equals(previousWatermarkTo, watermarkTo);
        if (metadata != null) {
            metadata.setPageRanges(headerFrom, headerTo, footerFrom, footerTo, watermarkFrom, watermarkTo);
            if (changed && recorded && metadata.getRevision() != null && currentUser != null) {
                auditTrailService.logAs(
                        currentUser,
                        "DOCUMENT_REVISION",
                        metadata.getRevision().getDocumentNumber() + " Rev " + metadata.getRevision().getRevisionNumber(),
                        metadata.getRevision().getId(),
                        "PUBLISHING_PAGE_RANGE_UPDATED",
                        null,
                        null,
                        "Updated header/footer/watermark page ranges for this revision's publication.",
                        List.of(
                                new com.eqms.dto.audittrail.AuditTrailChangeResponse("Header Page Range", pageRangeLabel(previousHeaderFrom, previousHeaderTo), pageRangeLabel(headerFrom, headerTo)),
                                new com.eqms.dto.audittrail.AuditTrailChangeResponse("Footer Page Range", pageRangeLabel(previousFooterFrom, previousFooterTo), pageRangeLabel(footerFrom, footerTo)),
                                new com.eqms.dto.audittrail.AuditTrailChangeResponse("Watermark Page Range", pageRangeLabel(previousWatermarkFrom, previousWatermarkTo), pageRangeLabel(watermarkFrom, watermarkTo))
                        )
                );
            }
        }
        return detachedCopy(template, headerFrom, headerTo, footerFrom, footerTo, watermarkFrom, watermarkTo);
    }

    /**
     * The template as it applies to one revision: the stored template with that revision's recorded page ranges (a
     * detached copy, never persisted), or the template itself for rows written before ranges moved to the revision.
     */
    public static PublishingTemplate effectiveTemplate(RevisionPublishingMetadata metadata) {
        PublishingTemplate template = metadata == null ? null : metadata.getPublishingTemplate();
        if (template == null || !metadata.isPageRangesRecorded()) {
            return template;
        }
        return detachedCopy(template, metadata.getHeaderPageFrom(), metadata.getHeaderPageTo(),
                metadata.getFooterPageFrom(), metadata.getFooterPageTo(),
                metadata.getWatermarkPageFrom(), metadata.getWatermarkPageTo());
    }

    /** A copy for composing only (same id so components and styles resolve); it is never persisted. */
    static PublishingTemplate detachedCopy(PublishingTemplate source, Integer headerFrom, Integer headerTo,
                                           Integer footerFrom, Integer footerTo, Integer watermarkFrom, Integer watermarkTo) {
        PublishingTemplate copy = new PublishingTemplate();
        org.springframework.beans.BeanUtils.copyProperties(source, copy);
        copy.setCoverSourcePageFrom(1);
        copy.setCoverSourcePageTo(1);
        copy.setBodySourcePageFrom(2);
        copy.setBodySourcePageTo(null);
        copy.setHeaderPageFrom(headerFrom);
        copy.setHeaderPageTo(headerTo);
        copy.setFooterPageFrom(footerFrom);
        copy.setFooterPageTo(footerTo);
        copy.setWatermarkPageFrom(watermarkFrom);
        copy.setWatermarkPageTo(watermarkTo);
        return copy;
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

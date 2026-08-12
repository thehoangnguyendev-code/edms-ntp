package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.publishing.PublishingTemplateRequest;
import com.eqms.dto.publishing.PublishingTemplateComponentResponse;
import com.eqms.dto.publishing.PublishingTemplateResponse;
import com.eqms.dto.publishing.PublishingTemplateVersionResponse;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.PublishingTemplate;
import com.eqms.entity.PublishingTemplateComponent;
import com.eqms.entity.PublishingTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.PublishingTemplateRepository;
import com.eqms.repository.PublishingTemplateComponentRepository;
import com.eqms.repository.PublishingTemplateVersionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;

@Service
public class PublishingTemplateService {

    private static final Logger log = LoggerFactory.getLogger(PublishingTemplateService.class);

    private final PublishingTemplateRepository templateRepository;
    private final PublishingTemplateComponentRepository componentRepository;
    private final PublishingTemplateVersionRepository versionRepository;
    private final FileStorageService fileStorageService;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final PublishingTemplateInspectionService inspectionService;
    private final PublishingTemplatePreviewService previewService;
    private final PublishingPlaceholderStyleService placeholderStyleService;
    private final ObjectMapper objectMapper;
    private final ClamAvScanService clamAvScanService;

    public PublishingTemplateService(
            PublishingTemplateRepository templateRepository,
            PublishingTemplateComponentRepository componentRepository,
            PublishingTemplateVersionRepository versionRepository,
            FileStorageService fileStorageService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            PublishingTemplateInspectionService inspectionService,
            PublishingTemplatePreviewService previewService,
            PublishingPlaceholderStyleService placeholderStyleService,
            ObjectMapper objectMapper,
            ClamAvScanService clamAvScanService
    ) {
        this.templateRepository = templateRepository;
        this.componentRepository = componentRepository;
        this.versionRepository = versionRepository;
        this.fileStorageService = fileStorageService;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.inspectionService = inspectionService;
        this.previewService = previewService;
        this.placeholderStyleService = placeholderStyleService;
        this.objectMapper = objectMapper;
        this.clamAvScanService = clamAvScanService;
    }

    @Transactional(readOnly = true)
    public List<PublishingTemplateResponse> listTemplates() {
        return templateRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<PublishingTemplateResponse> listTemplates(
            String search,
            String status,
            String publishingMode,
            String documentType,
            String createdBy,
            String sortBy,
            String sortDirection,
            int page,
            int limit
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;

        Page<PublishingTemplate> result = templateRepository.findAll(
                buildSpecification(search, status, publishingMode, documentType, createdBy),
                PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, sortProperty))
        );

        return new PageResponse<>(
                result.getContent().stream().map(this::toResponse).toList(),
                new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages())
        );
    }

    @Transactional(readOnly = true)
    public PublishingTemplateResponse getTemplate(UUID id) {
        return toResponse(requireTemplate(id));
    }

    @Transactional(readOnly = true)
    public List<PublishingTemplateVersionResponse> getVersionHistory(UUID id) {
        requireTemplate(id);
        return versionRepository.findByTemplate_IdOrderByVersionNumberDesc(id).stream().map(this::toVersionResponse).toList();
    }

    @Transactional
    public PublishingTemplateResponse createTemplate(PublishingTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = new PublishingTemplate();
        template.setTemplateName(normalizeName(request.templateName()));
        template.setDocumentType(normalizeOptional(request.documentType()));
        template.setDescription(normalizeOptional(request.description()));
        template.setStatus(normalizeTemplateStatus(request.status()));
        template.setPublishingMode(normalizePublishingMode(request.publishingMode()));
        template.setCoverOrientation(normalizeOrientation(request.coverOrientation()));
        template.setBodyOrientation(normalizeOrientation(request.bodyOrientation()));
        applyTemplateSettings(template, request);
        template.setVersionNumber(1);
        template.setCreatedBy(currentUser.getFullName());
        template.setUpdatedBy(currentUser.getFullName());
        PublishingTemplate saved = templateRepository.save(template);
        createVersionSnapshot(saved, "Initial template version", currentUser, false);
        return toResponse(saved);
    }

    @Transactional
    public PublishingTemplateResponse updateTemplate(UUID id, PublishingTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = requireTemplate(id);
        template.setTemplateName(normalizeName(request.templateName()));
        template.setDocumentType(normalizeOptional(request.documentType()));
        template.setDescription(normalizeOptional(request.description()));
        template.setStatus(normalizeTemplateStatus(request.status()));
        template.setPublishingMode(normalizePublishingMode(request.publishingMode()));
        template.setCoverOrientation(normalizeOrientation(request.coverOrientation()));
        template.setBodyOrientation(normalizeOrientation(request.bodyOrientation()));
        applyTemplateSettings(template, request);
        template.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(template);
        return toResponse(template);
    }

    @Transactional
    public PublishingTemplateResponse duplicateTemplate(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate source = requireTemplate(id);
        PublishingTemplate duplicate = new PublishingTemplate();
        duplicate.setTemplateName(uniqueTemplateName(source.getTemplateName() + " Copy"));
        duplicate.setDocumentType(source.getDocumentType());
        duplicate.setVersionNumber(1);
        duplicate.setStatus("DRAFT");
        duplicate.setDescription(source.getDescription());
        duplicate.setCoverTemplatePath(source.getCoverTemplatePath());
        duplicate.setBodyTemplatePath(source.getBodyTemplatePath());
        duplicate.setHeaderTemplatePath(source.getHeaderTemplatePath());
        duplicate.setFooterTemplatePath(source.getFooterTemplatePath());
        duplicate.setLogoTemplatePath(source.getLogoTemplatePath());
        duplicate.setCoverFileName(source.getCoverFileName());
        duplicate.setBodyFileName(source.getBodyFileName());
        duplicate.setHeaderFileName(source.getHeaderFileName());
        duplicate.setFooterFileName(source.getFooterFileName());
        duplicate.setLogoFileName(source.getLogoFileName());
        duplicate.setPublishingMode(source.getPublishingMode());
        duplicate.setCoverOrientation(source.getCoverOrientation());
        duplicate.setBodyOrientation(source.getBodyOrientation());
        duplicate.setEnableHeader(source.isEnableHeader());
        duplicate.setEnableFooter(source.isEnableFooter());
        duplicate.setShowLogo(source.isShowLogo());
        duplicate.setShowQrCode(source.isShowQrCode());
        duplicate.setShowBarcode(source.isShowBarcode());
        duplicate.setShowConfidentiality(source.isShowConfidentiality());
        duplicate.setShowElectronicSignatureInformation(source.isShowElectronicSignatureInformation());
        duplicate.setWatermarkMode(source.getWatermarkMode());
        duplicate.setCoverSourcePageFrom(source.getCoverSourcePageFrom());
        duplicate.setCoverSourcePageTo(source.getCoverSourcePageTo());
        duplicate.setBodySourcePageFrom(source.getBodySourcePageFrom());
        duplicate.setBodySourcePageTo(source.getBodySourcePageTo());
        duplicate.setHeaderPageFrom(source.getHeaderPageFrom());
        duplicate.setHeaderPageTo(source.getHeaderPageTo());
        duplicate.setFooterPageFrom(source.getFooterPageFrom());
        duplicate.setFooterPageTo(source.getFooterPageTo());
        duplicate.setWatermarkPageFrom(source.getWatermarkPageFrom());
        duplicate.setWatermarkPageTo(source.getWatermarkPageTo());
        duplicate.setCreatedBy(currentUser.getFullName());
        duplicate.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(duplicate);
        cloneComponents(source.getId(), duplicate, currentUser);
        placeholderStyleService.cloneStylesForTemplate(source.getId(), duplicate, duplicate.getVersionNumber());
        createVersionSnapshot(duplicate, "Duplicated from " + source.getTemplateName(), currentUser, false);
        return toResponse(duplicate);
    }

    @Transactional
    public PublishingTemplateResponse toggleStatus(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = requireTemplate(id);
        template.setStatus("ACTIVE".equalsIgnoreCase(template.getStatus()) ? "INACTIVE" : "ACTIVE");
        template.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(template);
        return toResponse(template);
    }

    @Transactional
    public void deleteTemplate(UUID id) {
        PublishingTemplate template = requireTemplate(id);
        templateRepository.delete(template);
    }

    @Transactional
    public PublishingTemplateResponse publishTemplate(UUID id, String changeSummary) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = requireTemplate(id);
        String previousStatus = template.getStatus();
        int previousVersion = template.getVersionNumber();
        String previousPublishingMode = template.getPublishingMode();
        String previousPublishedAt = template.getPublishedAt() == null ? null : template.getPublishedAt().toString();
        PublishingTemplateVersion snapshot = createVersionSnapshot(template, changeSummary, currentUser, true);
        int sourceVersionNumber = template.getVersionNumber();
        template.setVersionNumber(template.getVersionNumber() + 1);
        template.setStatus("ACTIVE");
        template.setPublishedAt(java.time.Instant.now());
        template.setPublishedBy(currentUser.getFullName());
        template.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(template);
        placeholderStyleService.copyStylesToNextVersion(template.getId(), sourceVersionNumber, template.getVersionNumber(), snapshot == null ? null : snapshot.getId());
        auditTrailService.logAs(
                currentUser,
                "PUBLISHING_TEMPLATE",
                template.getTemplateName(),
                template.getId(),
                "PUBLISHING_TEMPLATE_PUBLISHED",
                previousStatus,
                template.getStatus(),
                StringUtils.hasText(changeSummary) ? changeSummary : "Published publishing template from editor.",
                List.of(
                        new AuditTrailChangeResponse("Change Summary", "-", StringUtils.hasText(changeSummary) ? changeSummary : "Published publishing template from editor."),
                        new AuditTrailChangeResponse("Version", String.valueOf(previousVersion), String.valueOf(template.getVersionNumber())),
                        new AuditTrailChangeResponse("Publishing Mode", previousPublishingMode, template.getPublishingMode()),
                        new AuditTrailChangeResponse("Published At", previousPublishedAt == null ? "-" : previousPublishedAt, template.getPublishedAt() == null ? "-" : template.getPublishedAt().toString()),
                        new AuditTrailChangeResponse("Published By", "-", template.getPublishedBy() == null ? "-" : template.getPublishedBy())
                )
        );
        return toResponse(template);
    }

    @Transactional
    public PublishingTemplateResponse updateTemplateComponent(UUID id, String componentType, String layout, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Template file is required");
        }
        validateDocxTemplateFile(file);
        scanTemplateFileOrThrow(file);
        PublishingTemplate template = requireTemplate(id);
        String component = normalizeComponentType(componentType);
        String normalizedLayout = normalizeLayout(layout);
        try (InputStream input = file.getInputStream()) {
            FileStorageService.StorageWriteResult stored = fileStorageService.storePublishingTemplateAsset(
                    template.getId(),
                    template.getVersionNumber(),
                    component,
                    normalizedLayout,
                    input,
                    file.getOriginalFilename()
            );
            if ("logo".equals(component)) {
                template.setLogoTemplatePath(stored.storedPath());
                template.setLogoFileName(file.getOriginalFilename());
            } else if ("body".equals(component)) {
                template.setBodyTemplatePath(stored.storedPath());
                template.setBodyFileName(file.getOriginalFilename());
            } else {
                upsertTemplateComponent(template, component, normalizedLayout, stored.storedPath(), file.getOriginalFilename(), currentUserService.requireCurrentUser());
                if ("cover".equals(component) && "portrait".equalsIgnoreCase(normalizedLayout)) {
                    template.setCoverTemplatePath(stored.storedPath());
                    template.setCoverFileName(file.getOriginalFilename());
                }
                if ("header".equals(component) && "portrait".equalsIgnoreCase(normalizedLayout)) {
                    template.setHeaderTemplatePath(stored.storedPath());
                    template.setHeaderFileName(file.getOriginalFilename());
                }
                if ("footer".equals(component) && "portrait".equalsIgnoreCase(normalizedLayout)) {
                    template.setFooterTemplatePath(stored.storedPath());
                    template.setFooterFileName(file.getOriginalFilename());
                }
            }
            templateRepository.save(template);
            if (!"logo".equals(component) && !"body".equals(component)) {
                try {
                    previewService.getComponentPreviewPdf(template.getId(), component, normalizedLayout, null);
                } catch (Exception previewError) {
                    log.warn(
                            "Unable to warm preview cache for publishing template {} component {} layout {}: {}",
                            template.getId(),
                            component,
                            normalizedLayout,
                            previewError.getMessage()
                    );
                }
            }
            return toResponse(template);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store publishing template component", ex);
        }
    }

    private void validateDocxTemplateFile(MultipartFile file) {
        String originalName = file == null ? null : file.getOriginalFilename();
        String lowerName = originalName == null ? "" : originalName.toLowerCase(Locale.ROOT);
        String contentType = file == null ? null : file.getContentType();
        boolean docxExtension = lowerName.endsWith(".docx");
        boolean docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equalsIgnoreCase(contentType);
        if (!docxExtension && !docxMime) {
            throw new IllegalArgumentException("Only DOCX files are allowed for publishing templates");
        }
    }

    /**
     * Browser-supplied extension/MIME type (checked above) is not a trust boundary -- a renamed
     * or spoofed upload would sail through it. Verify the bytes are actually a ZIP/OOXML archive
     * (the format DOCX is built on) before it is malware-scanned and stored, then fail closed if
     * the scanner is enabled but rejects or can't be reached (see {@link ClamAvScanService}).
     */
    private void scanTemplateFileOrThrow(MultipartFile file) {
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException ex) {
            throw new IllegalArgumentException("The selected template file could not be read.");
        }
        if (content.length < 4
                || content[0] != 0x50
                || content[1] != 0x4B
                || content[2] != 0x03
                || content[3] != 0x04) {
            throw new IllegalArgumentException("The selected file is not a valid DOCX document.");
        }
        if (!clamAvScanService.isEnabled()) {
            return;
        }
        ClamAvScanService.ScanResult result = clamAvScanService.scan(content);
        if (!result.clean()) {
            throw new IllegalArgumentException("Template file " + file.getOriginalFilename()
                    + " was rejected by the virus scanner"
                    + (StringUtils.hasText(result.signatureName()) ? " (" + result.signatureName() + ")" : ""));
        }
    }

    @Transactional
    public PublishingTemplateResponse deleteTemplateComponent(UUID id, String componentType, String layout) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = requireTemplate(id);
        String normalizedComponent = normalizeComponentType(componentType);
        String normalizedLayout = normalizeLayout(layout);
        PublishingTemplateComponent component = componentRepository
                .findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(template.getId(), normalizedComponent, normalizedLayout)
                .orElse(null);
        String storedPath = component != null && StringUtils.hasText(component.getObjectKey())
                ? component.getObjectKey()
                : resolveTemplateComponentPath(template, normalizedComponent);

        if ("logo".equals(normalizedComponent) || "body".equals(normalizedComponent) || "portrait".equalsIgnoreCase(normalizedLayout)) {
            clearFallbackComponentFields(template, normalizedComponent, normalizedLayout);
        }

        if (StringUtils.hasText(storedPath)) {
            try {
                fileStorageService.deleteStoredFile(storedPath);
            } catch (IOException ex) {
                log.warn("Failed to delete publishing template component file for template {} component {} layout {}: {}",
                        id, normalizedComponent, normalizedLayout, ex.getMessage());
            }
        }

        if (component != null) {
            componentRepository.delete(component);
        }

        template.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(template);
        return toResponse(template);
    }

    private PublishingTemplateVersion createVersionSnapshot(PublishingTemplate template, String changeSummary, UserAccount currentUser, boolean published) {
        PublishingTemplateVersion version = new PublishingTemplateVersion();
        version.setTemplate(template);
        version.setVersionNumber(findNextVersionNumber(template.getId()));
        version.setTemplateName(template.getTemplateName());
        version.setDocumentType(template.getDocumentType());
        version.setStatus(template.getStatus());
        version.setDescription(template.getDescription());
        version.setCoverTemplatePath(template.getCoverTemplatePath());
        version.setBodyTemplatePath(template.getBodyTemplatePath());
        version.setHeaderTemplatePath(template.getHeaderTemplatePath());
        version.setFooterTemplatePath(template.getFooterTemplatePath());
        version.setLogoTemplatePath(template.getLogoTemplatePath());
        version.setLogoFileName(template.getLogoFileName());
        version.setBodyFileName(template.getBodyFileName());
        version.setChangeSummary(normalizeOptional(changeSummary));
        version.setPublishingMode(template.getPublishingMode());
        version.setCoverOrientation(template.getCoverOrientation());
        version.setBodyOrientation(template.getBodyOrientation());
        version.setEnableHeader(template.isEnableHeader());
        version.setEnableFooter(template.isEnableFooter());
        version.setShowLogo(template.isShowLogo());
        version.setShowQrCode(template.isShowQrCode());
        version.setShowBarcode(template.isShowBarcode());
        version.setShowConfidentiality(template.isShowConfidentiality());
        version.setShowElectronicSignatureInformation(template.isShowElectronicSignatureInformation());
        version.setWatermarkMode(template.getWatermarkMode());
        version.setCoverSourcePageFrom(template.getCoverSourcePageFrom());
        version.setCoverSourcePageTo(template.getCoverSourcePageTo());
        version.setBodySourcePageFrom(template.getBodySourcePageFrom());
        version.setBodySourcePageTo(template.getBodySourcePageTo());
        version.setHeaderPageFrom(template.getHeaderPageFrom());
        version.setHeaderPageTo(template.getHeaderPageTo());
        version.setFooterPageFrom(template.getFooterPageFrom());
        version.setFooterPageTo(template.getFooterPageTo());
        version.setWatermarkPageFrom(template.getWatermarkPageFrom());
        version.setWatermarkPageTo(template.getWatermarkPageTo());
        version.setCreatedBy(currentUser.getFullName());
        if (published) {
            version.setPublishedAt(java.time.Instant.now());
            version.setPublishedBy(currentUser.getFullName());
        }
        return versionRepository.save(version);
    }

    private int findNextVersionNumber(UUID templateId) {
        return versionRepository.findTopByTemplate_IdOrderByVersionNumberDesc(templateId)
                .map(existing -> existing.getVersionNumber() + 1)
                .orElse(1);
    }

    private PublishingTemplate requireTemplate(UUID id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
    }

    private String normalizeName(String value) {
        String normalized = normalizeOptional(value);
        if (!StringUtils.hasText(normalized)) {
            throw new IllegalArgumentException("Template name is required");
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeTemplateStatus(String value) {
        String normalized = normalizeOptional(value);
        return StringUtils.hasText(normalized) ? normalized.toUpperCase(Locale.ROOT) : "DRAFT";
    }

    private String normalizePublishingMode(String value) {
        String normalized = normalizeOptional(value);
        if (!StringUtils.hasText(normalized)) {
            return "COVER_ONLY";
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if ("COVER_AND_HEADER_FOOTER".equals(upper)) {
            return "COVER_HEADER_FOOTER";
        }
        if ("BODY_HEADER_FOOTER_ONLY".equals(upper)) {
            return "HEADER_FOOTER_ONLY";
        }
        if (!List.of("COVER_ONLY", "COVER_HEADER_FOOTER", "HEADER_FOOTER_ONLY").contains(upper)) {
            throw new IllegalArgumentException("Invalid publishing mode");
        }
        return upper;
    }

    private String normalizeOrientation(String value) {
        String normalized = normalizeOptional(value);
        if (!StringUtils.hasText(normalized)) {
            return "USE_SOURCE";
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (!List.of("USE_SOURCE", "PORTRAIT", "LANDSCAPE").contains(upper)) {
            throw new IllegalArgumentException("Invalid orientation");
        }
        return upper;
    }

    private String normalizeComponentType(String value) {
        String normalized = normalizeOptional(value);
        if (!StringUtils.hasText(normalized)) {
            throw new IllegalArgumentException("Template component type is required");
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (!List.of("cover", "body", "header", "footer", "logo").contains(lower)) {
            throw new IllegalArgumentException("Invalid template component type");
        }
        return lower;
    }

    private String normalizeLayout(String value) {
        String normalized = normalizeOptional(value);
        if (!StringUtils.hasText(normalized)) {
            return "PORTRAIT";
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (!List.of("portrait", "landscape").contains(lower)) {
            throw new IllegalArgumentException("Invalid layout");
        }
        return lower;
    }

    private String uniqueTemplateName(String base) {
        String normalized = normalizeName(base);
        if (templateRepository.findByTemplateNameIgnoreCase(normalized).isEmpty()) {
            return normalized;
        }
        int suffix = 2;
        while (templateRepository.findByTemplateNameIgnoreCase(normalized + " (" + suffix + ")").isPresent()) {
            suffix++;
        }
        return normalized + " (" + suffix + ")";
    }

    private PublishingTemplateResponse toResponse(PublishingTemplate template) {
        return new PublishingTemplateResponse(
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
                mapComponents(template.getId())
        );
    }

    private Specification<PublishingTemplate> buildSpecification(
            String search,
            String status,
            String publishingMode,
            String documentType,
            String createdBy
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            String normalizedSearch = normalizeOptional(search);
            if (StringUtils.hasText(normalizedSearch)) {
                String like = "%" + normalizedSearch.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("templateName")), like),
                        cb.like(cb.lower(root.get("description")), like),
                        cb.like(cb.lower(root.get("documentType")), like),
                        cb.like(cb.lower(root.get("createdBy")), like),
                        cb.like(cb.lower(root.get("updatedBy")), like)
                ));
            }
            if (StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(cb.upper(root.get("status")), status.trim().toUpperCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(publishingMode) && !"ALL".equalsIgnoreCase(publishingMode)) {
                predicates.add(cb.equal(cb.upper(root.get("publishingMode")), normalizePublishingMode(publishingMode)));
            }
            if (StringUtils.hasText(documentType) && !"ALL".equalsIgnoreCase(documentType)) {
                predicates.add(cb.equal(cb.lower(root.get("documentType")), documentType.trim().toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(createdBy)) {
                predicates.add(cb.like(cb.lower(root.get("createdBy")), "%" + createdBy.trim().toLowerCase(Locale.ROOT) + "%"));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private String resolveSortProperty(String sortBy) {
        String normalized = normalizeOptional(sortBy);
        if (!StringUtils.hasText(normalized)) {
            return "updatedAt";
        }
        return switch (normalized) {
            case "templateName" -> "templateName";
            case "documentType" -> "documentType";
            case "versionNumber" -> "versionNumber";
            case "status" -> "status";
            case "publishingMode" -> "publishingMode";
            case "createdBy" -> "createdBy";
            case "createdAt" -> "createdAt";
            case "publishedAt" -> "publishedAt";
            default -> "updatedAt";
        };
    }

    private void applyTemplateSettings(PublishingTemplate template, PublishingTemplateRequest request) {
        if (request == null) {
            return;
        }
        if (request.enableHeader() != null) {
            template.setEnableHeader(request.enableHeader());
        }
        if (request.enableFooter() != null) {
            template.setEnableFooter(request.enableFooter());
        }
        if (request.showLogo() != null) {
            template.setShowLogo(request.showLogo());
        }
        if (request.showQrCode() != null) {
            template.setShowQrCode(request.showQrCode());
        }
        if (request.showBarcode() != null) {
            template.setShowBarcode(request.showBarcode());
        }
        if (request.showConfidentiality() != null) {
            template.setShowConfidentiality(request.showConfidentiality());
        }
        if (request.showElectronicSignatureInformation() != null) {
            template.setShowElectronicSignatureInformation(request.showElectronicSignatureInformation());
        }
        if (StringUtils.hasText(request.watermarkMode())) {
            template.setWatermarkMode(request.watermarkMode().trim().toUpperCase(Locale.ROOT));
        } else if (request.watermarkMode() != null) {
            template.setWatermarkMode(null);
        }
        template.setCoverSourcePageFrom(request.coverSourcePageFrom());
        template.setCoverSourcePageTo(request.coverSourcePageTo());
        template.setBodySourcePageFrom(request.bodySourcePageFrom());
        template.setBodySourcePageTo(request.bodySourcePageTo());
        template.setHeaderPageFrom(request.headerPageFrom());
        template.setHeaderPageTo(request.headerPageTo());
        template.setFooterPageFrom(request.footerPageFrom());
        template.setFooterPageTo(request.footerPageTo());
        template.setWatermarkPageFrom(request.watermarkPageFrom());
        template.setWatermarkPageTo(request.watermarkPageTo());
        validatePageRange("cover source", request.coverSourcePageFrom(), request.coverSourcePageTo());
        validatePageRange("body source", request.bodySourcePageFrom(), request.bodySourcePageTo());
        validatePageRange("header", request.headerPageFrom(), request.headerPageTo());
        validatePageRange("footer", request.footerPageFrom(), request.footerPageTo());
        validatePageRange("watermark", request.watermarkPageFrom(), request.watermarkPageTo());
    }

    private void validatePageRange(String label, Integer from, Integer to) {
        if (from != null && from < 1) {
            throw new IllegalArgumentException(label + " page range start must be greater than 0");
        }
        if (to != null && to < 1) {
            throw new IllegalArgumentException(label + " page range end must be greater than 0");
        }
        if (from != null && to != null && to < from) {
            throw new IllegalArgumentException(label + " page range end must be greater than or equal to start");
        }
    }

    private PublishingTemplateVersionResponse toVersionResponse(PublishingTemplateVersion version) {
        return new PublishingTemplateVersionResponse(
                version.getId(),
                version.getVersionNumber(),
                version.getTemplateName(),
                version.getDocumentType(),
                version.getStatus(),
                version.getDescription(),
                version.getCoverTemplatePath(),
                version.getBodyTemplatePath(),
                version.getHeaderTemplatePath(),
                version.getFooterTemplatePath(),
                version.getLogoTemplatePath(),
                version.getLogoFileName(),
                version.getBodyFileName(),
                version.getChangeSummary(),
                version.getPublishingMode(),
                version.getCoverOrientation(),
                version.getBodyOrientation(),
                version.isEnableHeader(),
                version.isEnableFooter(),
                version.isShowLogo(),
                version.isShowQrCode(),
                version.isShowBarcode(),
                version.isShowConfidentiality(),
                version.isShowElectronicSignatureInformation(),
                version.getWatermarkMode(),
                version.getCoverSourcePageFrom(),
                version.getCoverSourcePageTo(),
                version.getBodySourcePageFrom(),
                version.getBodySourcePageTo(),
                version.getHeaderPageFrom(),
                version.getHeaderPageTo(),
                version.getFooterPageFrom(),
                version.getFooterPageTo(),
                version.getWatermarkPageFrom(),
                version.getWatermarkPageTo(),
                version.getCreatedAt(),
                version.getCreatedBy(),
                version.getPublishedAt(),
                version.getPublishedBy()
        );
    }

    private List<PublishingTemplateComponentResponse> mapComponents(UUID templateId) {
        return componentRepository.findByTemplate_IdOrderByComponentTypeAscLayoutAsc(templateId).stream()
                .map(component -> new PublishingTemplateComponentResponse(
                        component.getId(),
                        component.getComponentType(),
                        component.getLayout(),
                        component.getObjectKey(),
                        component.getFileName(),
                        component.getChecksum(),
                        component.getVersionNumber(),
                        component.getStatus(),
                        parsePlaceholders(component.getDetectedPlaceholders()),
                        StringUtils.hasText(component.getObjectKey()),
                        component.getUploadedAt(),
                        component.getUploadedBy() == null ? null : component.getUploadedBy().getFullName()
                ))
                .toList();
    }

    private List<String> parsePlaceholders(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private void upsertTemplateComponent(PublishingTemplate template, String componentType, String layout, String objectKey, String fileName, UserAccount currentUser) {
        PublishingTemplateComponent component = componentRepository
                .findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(template.getId(), componentType, layout)
                .orElseGet(PublishingTemplateComponent::new);
        component.setTemplate(template);
        component.setComponentType(componentType.toUpperCase(Locale.ROOT));
        component.setLayout(layout.toUpperCase(Locale.ROOT));
        component.setObjectKey(objectKey);
        component.setFileName(fileName);
        component.setChecksum(null);
        component.setDetectedPlaceholders(detectPlaceholdersForFile(objectKey, fileName, componentType));
        component.setVersionNumber(component.getVersionNumber() <= 0 ? 1 : component.getVersionNumber() + 1);
        component.setStatus("ACTIVE");
        component.setUploadedAt(java.time.Instant.now());
        component.setUploadedBy(currentUser);
        componentRepository.save(component);
    }

    private void clearFallbackComponentFields(PublishingTemplate template, String componentType, String layout) {
        if ("logo".equals(componentType)) {
            if (isPortrait(layout)) {
                template.setLogoTemplatePath(null);
                template.setLogoFileName(null);
            }
            return;
        }

        if ("body".equals(componentType)) {
            template.setBodyTemplatePath(null);
            template.setBodyFileName(null);
            return;
        }

        if (!isPortrait(layout)) {
            return;
        }

        switch (componentType) {
            case "cover" -> {
                template.setCoverTemplatePath(null);
                template.setCoverFileName(null);
            }
            case "header" -> {
                template.setHeaderTemplatePath(null);
                template.setHeaderFileName(null);
            }
            case "footer" -> {
                template.setFooterTemplatePath(null);
                template.setFooterFileName(null);
            }
            default -> {
            }
        }
    }

    private boolean isPortrait(String layout) {
        return "portrait".equalsIgnoreCase(layout);
    }

    private String resolveTemplateComponentPath(PublishingTemplate template, String componentType) {
        return switch (componentType) {
            case "cover" -> template.getCoverTemplatePath();
            case "body" -> template.getBodyTemplatePath();
            case "header" -> template.getHeaderTemplatePath();
            case "footer" -> template.getFooterTemplatePath();
            case "logo" -> template.getLogoTemplatePath();
            default -> null;
        };
    }

    private void cloneComponents(UUID sourceTemplateId, PublishingTemplate duplicate, UserAccount currentUser) {
        componentRepository.findByTemplate_IdOrderByComponentTypeAscLayoutAsc(sourceTemplateId).forEach(source -> {
            PublishingTemplateComponent copied = new PublishingTemplateComponent();
            copied.setTemplate(duplicate);
            copied.setComponentType(source.getComponentType());
            copied.setLayout(source.getLayout());
            copied.setObjectKey(source.getObjectKey());
            copied.setFileName(source.getFileName());
            copied.setChecksum(source.getChecksum());
            copied.setDetectedPlaceholders(source.getDetectedPlaceholders());
            copied.setVersionNumber(source.getVersionNumber());
            copied.setStatus(source.getStatus());
            copied.setUploadedAt(source.getUploadedAt());
            copied.setUploadedBy(currentUser);
            componentRepository.save(copied);
        });
    }

    private String detectPlaceholdersForFile(String objectKey, String fileName, String componentType) {
        if (!StringUtils.hasText(objectKey) || !StringUtils.hasText(fileName) || !fileName.toLowerCase(Locale.ROOT).endsWith(".docx")) {
            return "[]";
        }
        try {
            Path materialized = fileStorageService.materializeStoredFile(objectKey);
            if (materialized == null || !Files.exists(materialized)) {
                return "[]";
            }
            LinkedHashSet<String> values = new LinkedHashSet<>();
            try (var input = Files.newInputStream(materialized); var document = new org.apache.poi.xwpf.usermodel.XWPFDocument(input)) {
                String normalizedComponent = StringUtils.hasText(componentType) ? componentType.trim().toLowerCase(Locale.ROOT) : "";
                if ("header".equals(normalizedComponent) || "footer".equals(normalizedComponent)) {
                    document.getHeaderList().forEach(header -> {
                        header.getParagraphs().forEach(paragraph -> collectPlaceholders(paragraph.getText(), values));
                        header.getTables().forEach(table -> collectTablePlaceholders(table, values));
                    });
                    document.getFooterList().forEach(footer -> {
                        footer.getParagraphs().forEach(paragraph -> collectPlaceholders(paragraph.getText(), values));
                        footer.getTables().forEach(table -> collectTablePlaceholders(table, values));
                    });
                    document.getHeaderList().forEach(header -> collectRawXmlPlaceholders(header._getHdrFtr().xmlText(), values));
                    document.getFooterList().forEach(footer -> collectRawXmlPlaceholders(footer._getHdrFtr().xmlText(), values));
                } else {
                    document.getParagraphs().forEach(paragraph -> collectPlaceholders(paragraph.getText(), values));
                    document.getTables().forEach(table -> collectTablePlaceholders(table, values));
                    document.getHeaderList().forEach(header -> {
                        header.getParagraphs().forEach(paragraph -> collectPlaceholders(paragraph.getText(), values));
                        header.getTables().forEach(table -> collectTablePlaceholders(table, values));
                    });
                    document.getFooterList().forEach(footer -> {
                        footer.getParagraphs().forEach(paragraph -> collectPlaceholders(paragraph.getText(), values));
                        footer.getTables().forEach(table -> collectTablePlaceholders(table, values));
                    });
                    collectRawXmlPlaceholders(document.getDocument().xmlText(), values);
                    document.getHeaderList().forEach(header -> collectRawXmlPlaceholders(header._getHdrFtr().xmlText(), values));
                    document.getFooterList().forEach(footer -> collectRawXmlPlaceholders(footer._getHdrFtr().xmlText(), values));
                }
            }
            return objectMapper.writeValueAsString(new ArrayList<>(values));
        } catch (Exception ex) {
            return "[]";
        }
    }

    private void collectPlaceholders(String text, LinkedHashSet<String> values) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
        }
    }

    private void collectTablePlaceholders(XWPFTable table, LinkedHashSet<String> values) {
        table.getRows().forEach(row -> row.getTableCells().forEach(cell -> {
            cell.getParagraphs().forEach(paragraph -> collectPlaceholders(paragraph.getText(), values));
            cell.getTables().forEach(nested -> collectTablePlaceholders(nested, values));
        }));
    }

    private void collectRawXmlPlaceholders(String rawXml, LinkedHashSet<String> values) {
        if (!StringUtils.hasText(rawXml)) {
            return;
        }
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(rawXml);
        while (matcher.find()) {
            values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
        }
    }
}

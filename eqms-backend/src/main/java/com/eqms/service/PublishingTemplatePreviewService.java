package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.entity.PublishingTemplateComponent;
import com.eqms.entity.PublishingTemplate;
import com.eqms.repository.PublishingTemplateRepository;
import com.eqms.repository.PublishingTemplateComponentRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PublishingTemplatePreviewService {

    private final PublishingTemplateRepository templateRepository;
    private final PublishingTemplateComponentRepository componentRepository;
    private final PublishingPlaceholderStyleService placeholderStyleService;
    private final FileStorageService fileStorageService;
    private final MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;
    private final PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService;
    private final RevisionService revisionService;
    private final StoragePathBuilder storagePathBuilder;

    public PublishingTemplatePreviewService(
            PublishingTemplateRepository templateRepository,
            PublishingTemplateComponentRepository componentRepository,
            PublishingPlaceholderStyleService placeholderStyleService,
            FileStorageService fileStorageService,
            MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService,
            PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService,
            RevisionService revisionService,
            StoragePathBuilder storagePathBuilder
    ) {
        this.templateRepository = templateRepository;
        this.componentRepository = componentRepository;
        this.placeholderStyleService = placeholderStyleService;
        this.fileStorageService = fileStorageService;
        this.microsoftGraphOfficeOnlineService = microsoftGraphOfficeOnlineService;
        this.openXmlTemplateRenderService = openXmlTemplateRenderService;
        this.revisionService = revisionService;
        this.storagePathBuilder = storagePathBuilder;
    }

    public byte[] getComponentPreviewPdf(UUID templateId, String componentType) throws IOException {
        return getComponentPreviewPdf(templateId, componentType, null, null, null, null, null, false);
    }

    public byte[] getComponentPreviewPdf(UUID templateId, String componentType, String layout, UUID revisionId) throws IOException {
        return getComponentPreviewPdf(templateId, componentType, layout, revisionId, null, null, null, false);
    }

    public byte[] getComponentPreviewPdf(
            UUID templateId,
            String componentType,
            String layout,
            UUID revisionId,
            String previewPlaceholderKey,
            String previewText,
            Double previewFontSize,
            boolean exactPreview
    ) throws IOException {
        PublishingTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
        ComponentFileDescriptor descriptor = resolveDescriptor(template, normalizeComponentType(componentType), normalizeLayout(layout));
        if (descriptor == null || !StringUtils.hasText(descriptor.storedPath())) {
            throw new IllegalStateException("Component file has not been uploaded yet");
        }
        String normalizedComponent = normalizeComponentType(componentType);
        String normalizedLayout = normalizeLayout(layout);
        Map<String, PublishingPlaceholderStyleConfig> placeholderStyles = placeholderStyleService.resolveStyleMap(templateId, normalizedComponent, normalizedLayout);
        // Always render component previews from the current template and style records.
        // The old disk cache key contained only template/component/layout, so a style
        // update could return an earlier PDF even though saving had succeeded.
        Path materialized = fileStorageService.materializeStoredFile(descriptor.storedPath());
        if (materialized == null || !Files.exists(materialized)) {
            throw new IllegalStateException("Component file is not available");
        }
        if (descriptor.fileName() != null && descriptor.fileName().toLowerCase().endsWith(".pdf")) {
            return Files.readAllBytes(materialized);
        }
        RevisionDetailResponse revision = revisionId == null ? null : revisionService.getRevision(revisionId);
        Map<String, String> extraValues = new LinkedHashMap<>();
        extraValues.put("pageLabel", "1/1");
        boolean keepBodyContent = !List.of("header", "footer").contains(normalizedComponent);
        Path rendered = openXmlTemplateRenderService.renderDocxTemplate(
                materialized,
                descriptor.fileName(),
                revision,
                extraValues,
                keepBodyContent,
                false,
                previewPlaceholderKey,
                previewText,
                previewFontSize,
                exactPreview,
                placeholderStyles
        );
        byte[] pdfBytes = microsoftGraphOfficeOnlineService.convertSourceFileToPdf(rendered, descriptor.fileName());
        return pdfBytes;
    }

    public FilePreviewResult getLogoPreview(UUID templateId) throws IOException {
        PublishingTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
        ComponentFileDescriptor descriptor = new ComponentFileDescriptor(template.getLogoTemplatePath(), template.getLogoFileName());
        if (descriptor == null || !StringUtils.hasText(descriptor.storedPath())) {
            throw new IllegalStateException("Logo file has not been uploaded yet");
        }
        Path materialized = fileStorageService.materializeStoredFile(descriptor.storedPath());
        if (materialized == null || !Files.exists(materialized)) {
            throw new IllegalStateException("Logo file is not available");
        }
        return new FilePreviewResult(Files.readAllBytes(materialized), resolveContentType(descriptor.fileName()));
    }

    private String normalizeComponentType(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toLowerCase() : "";
        if (!List.of("cover", "body", "header", "footer", "logo").contains(normalized)) {
            throw new IllegalArgumentException("Invalid template component type");
        }
        return normalized;
    }

    private String normalizeLayout(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toLowerCase() : "portrait";
        if (!List.of("portrait", "landscape").contains(normalized)) {
            throw new IllegalArgumentException("Invalid layout");
        }
        return normalized;
    }

    private ComponentFileDescriptor resolveDescriptor(PublishingTemplate template, String componentType, String layout) {
        PublishingTemplateComponent component = componentRepository
                .findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(template.getId(), componentType, layout)
                .orElse(null);
        if (component != null && StringUtils.hasText(component.getObjectKey())) {
            return new ComponentFileDescriptor(component.getObjectKey(), component.getFileName());
        }
        return switch (componentType) {
            case "cover" -> new ComponentFileDescriptor(template.getCoverTemplatePath(), template.getCoverFileName());
            case "body" -> new ComponentFileDescriptor(template.getBodyTemplatePath(), template.getBodyFileName());
            case "header" -> new ComponentFileDescriptor(template.getHeaderTemplatePath(), template.getHeaderFileName());
            case "footer" -> new ComponentFileDescriptor(template.getFooterTemplatePath(), template.getFooterFileName());
            case "logo" -> new ComponentFileDescriptor(template.getLogoTemplatePath(), template.getLogoFileName());
            default -> null;
        };
    }

    private String resolveCachedPreviewPath(PublishingTemplate template, String componentType, String layout) {
        if (template == null || !StringUtils.hasText(template.getTemplateName())) {
            return null;
        }
        if (!List.of("cover", "header", "footer").contains(componentType)) {
            return null;
        }
        return storagePathBuilder.publishingComponentPreviewTemplateV2(
                null, template.getId(), template.getVersionNumber(), componentType, layout);
    }

    private void cachePreviewPdf(PublishingTemplate template, String componentType, String layout, byte[] pdfBytes) throws IOException {
        if (pdfBytes == null || pdfBytes.length == 0) {
            return;
        }
        if (template == null || !StringUtils.hasText(template.getTemplateName())) {
            return;
        }
        if (!List.of("cover", "header", "footer").contains(componentType)) {
            return;
        }
        try (java.io.InputStream input = new java.io.ByteArrayInputStream(pdfBytes)) {
            fileStorageService.storePublishingTemplatePreviewAsset(
                    template.getId(), template.getVersionNumber(), componentType, layout, input);
        }
    }

    private String resolveContentType(String fileName) {
        String lower = fileName == null ? "" : fileName.toLowerCase();
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (lower.endsWith(".pdf")) {
            return "application/pdf";
        }
        return "application/octet-stream";
    }

    private record ComponentFileDescriptor(String storedPath, String fileName) {
    }

    public record FilePreviewResult(byte[] bytes, String contentType) {
    }
}

package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.publishing.PublishingPlaceholderStyleRequest;
import com.eqms.dto.publishing.PublishingPlaceholderStyleResponse;
import com.eqms.entity.PublishingTemplate;
import com.eqms.entity.PublishingTemplatePlaceholderStyle;
import com.eqms.entity.PublishingTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.PublishingTemplatePlaceholderStyleRepository;
import com.eqms.repository.PublishingTemplateRepository;
import com.eqms.repository.PublishingTemplateVersionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class PublishingPlaceholderStyleService {

    private final PublishingTemplateRepository templateRepository;
    private final PublishingTemplateVersionRepository versionRepository;
    private final PublishingTemplatePlaceholderStyleRepository styleRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final ObjectMapper objectMapper;

    public PublishingPlaceholderStyleService(
            PublishingTemplateRepository templateRepository,
            PublishingTemplateVersionRepository versionRepository,
            PublishingTemplatePlaceholderStyleRepository styleRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            ObjectMapper objectMapper
    ) {
        this.templateRepository = templateRepository;
        this.versionRepository = versionRepository;
        this.styleRepository = styleRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<PublishingPlaceholderStyleResponse> listStyles(UUID templateId, String componentType, String layout) {
        PublishingTemplate template = requireTemplate(templateId);
        int versionNumber = template.getVersionNumber();
        List<PublishingTemplatePlaceholderStyle> styles;
        if (StringUtils.hasText(componentType) || StringUtils.hasText(layout)) {
            styles = styleRepository.findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                    template.getId(),
                    versionNumber,
                    normalizeComponentType(componentType),
                    normalizeLayout(layout)
            );
        } else {
            styles = styleRepository.findByTemplate_IdAndTemplateVersionNumberOrderByComponentTypeAscLayoutAscPlaceholderKeyAsc(template.getId(), versionNumber);
        }
        return styles.stream().map(this::toResponse).toList();
    }

    @Transactional
    public List<PublishingPlaceholderStyleResponse> upsertStyles(UUID templateId, List<PublishingPlaceholderStyleRequest> requests) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = requireTemplate(templateId);
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }
        int versionNumber = template.getVersionNumber();
        List<PublishingPlaceholderStyleResponse> responses = new java.util.ArrayList<>();
        for (PublishingPlaceholderStyleRequest request : requests) {
            if (request == null || !StringUtils.hasText(request.placeholderKey())) {
                continue;
            }
            var style = styleRepository
                    .findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCaseAndPlaceholderKeyIgnoreCase(
                            template.getId(),
                            versionNumber,
                            normalizeComponentType(request.componentType()),
                            normalizeLayout(request.layout()),
                            normalizePlaceholderKey(request.placeholderKey())
                    )
                    .orElseGet(com.eqms.entity.PublishingTemplatePlaceholderStyle::new);
            String previousStyle = style.getStyleJson();
            style.setTemplate(template);
            style.setTemplateVersionNumber(versionNumber);
            style.setComponentType(normalizeComponentType(request.componentType()));
            style.setLayout(normalizeLayout(request.layout()));
            style.setPlaceholderKey(normalizePlaceholderKey(request.placeholderKey()));
            style.setPlaceholderToken(StringUtils.hasText(request.placeholderToken()) ? request.placeholderToken().trim() : buildToken(style.getPlaceholderKey()));
            style.setPlaceholderType(normalizePlaceholderType(request.placeholderType(), style.getPlaceholderKey()));
            style.setStyleJson(serializeStyle(sanitiseStyle(style.getPlaceholderType(), request.style())));
            style.setCreatedBy(style.getCreatedBy() == null ? currentUser.getFullName() : style.getCreatedBy());
            style.setUpdatedBy(currentUser.getFullName());
            PublishingTemplatePlaceholderStyle saved = styleRepository.save(style);
            auditTrailService.logAs(
                    currentUser,
                    "PUBLISHING_TEMPLATE",
                    template.getTemplateName(),
                    template.getId(),
                    "PLACEHOLDER_STYLE_UPDATED",
                    null,
                    null,
                    "Updated placeholder style for " + saved.getPlaceholderKey(),
                    List.of(
                            new AuditTrailChangeResponse("Template Version", "-", String.valueOf(versionNumber)),
                            new AuditTrailChangeResponse("Component Type", "-", saved.getComponentType()),
                            new AuditTrailChangeResponse("Layout", "-", saved.getLayout()),
                            new AuditTrailChangeResponse("Placeholder Key", "-", saved.getPlaceholderKey()),
                            new AuditTrailChangeResponse("Old Style", previousStyle == null ? "-" : previousStyle, saved.getStyleJson())
                    )
            );
            responses.add(toResponse(saved));
        }
        // A workspace uses the template timestamp as part of its preview identity.
        // Touching the template makes a style-only edit observable to every workspace.
        template.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(template);
        return responses;
    }

    @Transactional
    public void deleteStyle(UUID templateId, String componentType, String layout, String placeholderKey) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        PublishingTemplate template = requireTemplate(templateId);
        int versionNumber = template.getVersionNumber();
        String normalizedComponent = normalizeComponentType(componentType);
        String normalizedLayout = normalizeLayout(layout);
        String normalizedPlaceholder = normalizePlaceholderKey(placeholderKey);
        styleRepository.findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCaseAndPlaceholderKeyIgnoreCase(
                template.getId(),
                versionNumber,
                normalizedComponent,
                normalizedLayout,
                normalizedPlaceholder
        ).ifPresent(style -> {
            String previousStyle = style.getStyleJson();
            styleRepository.delete(style);
            auditTrailService.logAs(
                    currentUser,
                    "PUBLISHING_TEMPLATE",
                    template.getTemplateName(),
                    template.getId(),
                    "PLACEHOLDER_STYLE_DELETED",
                    null,
                    null,
                    "Deleted placeholder style for " + normalizedPlaceholder,
                    List.of(
                            new AuditTrailChangeResponse("Template Version", "-", String.valueOf(versionNumber)),
                            new AuditTrailChangeResponse("Component Type", "-", normalizedComponent),
                            new AuditTrailChangeResponse("Layout", "-", normalizedLayout),
                            new AuditTrailChangeResponse("Placeholder Key", "-", normalizedPlaceholder),
                            new AuditTrailChangeResponse("Style", previousStyle == null ? "-" : previousStyle, "-")
                    )
            );
        });
        template.setUpdatedBy(currentUser.getFullName());
        templateRepository.save(template);
    }

    @Transactional(readOnly = true)
    public Map<String, PublishingPlaceholderStyleConfig> resolveStyleMap(UUID templateId, String componentType, String layout) {
        PublishingTemplate template = requireTemplate(templateId);
        int versionNumber = template.getVersionNumber();
        List<PublishingTemplatePlaceholderStyle> styles = styleRepository.findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                versionNumber,
                normalizeComponentType(componentType),
                normalizeLayout(layout)
        );
        Map<String, PublishingPlaceholderStyleConfig> resolved = new LinkedHashMap<>();
        for (PublishingTemplatePlaceholderStyle style : styles) {
            // Multiple alias tokens (e.g. {{author}}, {{authorName}}, {{preparedBy}}) resolve
            // to the same field — style them as one canonical key so the actual token used in
            // the DOCX (which may differ from the alias the style was saved under) still matches.
            resolved.put(PublishingPlaceholderSyntax.canonicalName(style.getPlaceholderKey()), parseStyle(style.getStyleJson()));
        }
        return resolved;
    }

    @Transactional
    public void copyStylesToNextVersion(UUID templateId, int fromVersionNumber, int toVersionNumber, UUID versionSnapshotId) {
        if (templateId == null) {
            return;
        }
        PublishingTemplate template = requireTemplate(templateId);
        List<PublishingTemplatePlaceholderStyle> styles = styleRepository.findByTemplate_IdAndTemplateVersionNumberOrderByComponentTypeAscLayoutAscPlaceholderKeyAsc(templateId, fromVersionNumber);
        if (styles.isEmpty()) {
            return;
        }
        UserAccount currentUser = currentUserService.requireCurrentUser();
        for (PublishingTemplatePlaceholderStyle source : styles) {
            PublishingTemplatePlaceholderStyle copy = new PublishingTemplatePlaceholderStyle();
            copy.setTemplate(template);
            copy.setTemplateVersionId(versionSnapshotId);
            copy.setTemplateVersionNumber(toVersionNumber);
            copy.setComponentType(source.getComponentType());
            copy.setLayout(source.getLayout());
            copy.setPlaceholderKey(source.getPlaceholderKey());
            copy.setPlaceholderToken(source.getPlaceholderToken());
            copy.setPlaceholderType(source.getPlaceholderType());
            copy.setStyleJson(source.getStyleJson());
            copy.setCreatedBy(currentUser.getFullName());
            copy.setUpdatedBy(currentUser.getFullName());
            styleRepository.save(copy);
        }
        auditTrailService.logAs(
                currentUser,
                "PUBLISHING_TEMPLATE",
                template.getTemplateName(),
                template.getId(),
                "PLACEHOLDER_STYLE_COPIED_TO_NEW_VERSION",
                null,
                null,
                "Copied placeholder styles to template version " + toVersionNumber,
                List.of(
                        new AuditTrailChangeResponse("From Version", "-", String.valueOf(fromVersionNumber)),
                        new AuditTrailChangeResponse("To Version", "-", String.valueOf(toVersionNumber))
                )
        );
    }

    @Transactional
    public void cloneStylesForTemplate(UUID sourceTemplateId, PublishingTemplate targetTemplate, int targetVersionNumber) {
        if (sourceTemplateId == null || targetTemplate == null) {
            return;
        }
        int sourceVersionNumber = templateRepository.findById(sourceTemplateId).map(PublishingTemplate::getVersionNumber).orElse(1);
        List<PublishingTemplatePlaceholderStyle> styles = styleRepository.findByTemplate_IdAndTemplateVersionNumberOrderByComponentTypeAscLayoutAscPlaceholderKeyAsc(sourceTemplateId, sourceVersionNumber);
        if (styles.isEmpty()) {
            return;
        }
        UserAccount currentUser = currentUserService.requireCurrentUser();
        for (PublishingTemplatePlaceholderStyle source : styles) {
            PublishingTemplatePlaceholderStyle copy = new PublishingTemplatePlaceholderStyle();
            copy.setTemplate(targetTemplate);
            copy.setTemplateVersionNumber(targetVersionNumber);
            copy.setComponentType(source.getComponentType());
            copy.setLayout(source.getLayout());
            copy.setPlaceholderKey(source.getPlaceholderKey());
            copy.setPlaceholderToken(source.getPlaceholderToken());
            copy.setPlaceholderType(source.getPlaceholderType());
            copy.setStyleJson(source.getStyleJson());
            copy.setCreatedBy(currentUser.getFullName());
            copy.setUpdatedBy(currentUser.getFullName());
            styleRepository.save(copy);
        }
    }

    private PublishingTemplate requireTemplate(UUID templateId) {
        return templateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
    }

    private PublishingPlaceholderStyleResponse toResponse(PublishingTemplatePlaceholderStyle style) {
        return new PublishingPlaceholderStyleResponse(
                style.getId(),
                style.getTemplate() == null ? null : style.getTemplate().getId(),
                style.getTemplateVersionId(),
                style.getTemplateVersionNumber(),
                style.getComponentType(),
                style.getLayout(),
                style.getPlaceholderKey(),
                style.getPlaceholderToken(),
                style.getPlaceholderType(),
                parseStyle(style.getStyleJson()),
                style.getCreatedAt(),
                style.getUpdatedAt(),
                style.getCreatedBy(),
                style.getUpdatedBy()
        );
    }

    private PublishingPlaceholderStyleConfig parseStyle(String styleJson) {
        if (!StringUtils.hasText(styleJson)) {
            return new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null);
        }
        try {
            PublishingPlaceholderStyleConfig config = objectMapper.readValue(styleJson, PublishingPlaceholderStyleConfig.class);
            return config == null ? new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null) : config;
        } catch (Exception ex) {
            return new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null);
        }
    }

    private String serializeStyle(PublishingPlaceholderStyleConfig style) {
        try {
            return objectMapper.writeValueAsString(style == null ? new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null) : style);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize placeholder style", ex);
        }
    }

    private PublishingPlaceholderStyleConfig sanitiseStyle(String placeholderType, PublishingPlaceholderStyleConfig style) {
        PublishingPlaceholderStyleConfig safe = style == null
                ? new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null)
                : style;
        boolean signature = "SIGNATURE".equalsIgnoreCase(placeholderType);
        List<String> transforms = signature ? List.of() : safe.transforms();
        String fontFamily = StringUtils.hasText(safe.fontFamily()) ? safe.fontFamily().trim() : null;
        Double fontSizePt = safe.fontSizePt() != null && safe.fontSizePt() > 0 ? safe.fontSizePt() : null;
        Boolean bold = safe.bold();
        Boolean italic = signature ? safe.italic() : safe.italic();
        Boolean underline = signature ? safe.underline() : safe.underline();
        String color = StringUtils.hasText(safe.color()) ? safe.color().trim() : null;
        String alignment = StringUtils.hasText(safe.alignment()) ? safe.alignment().trim().toUpperCase(Locale.ROOT) : null;
        String dateFormat = signature ? null : safe.dateFormat();
        String numberFormat = signature ? null : safe.numberFormat();
        Boolean preserveLineBreaks = safe.preserveLineBreaks() == null || safe.preserveLineBreaks();
        Integer maxLines = safe.maxLines() != null && safe.maxLines() > 0 ? safe.maxLines() : null;
        return new PublishingPlaceholderStyleConfig(transforms, fontFamily, fontSizePt, bold, italic, underline, color, alignment, dateFormat, numberFormat, preserveLineBreaks, maxLines);
    }

    private String normalizeComponentType(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
        if (!List.of("cover", "header", "footer").contains(normalized)) {
            throw new IllegalArgumentException("Invalid component type");
        }
        return normalized;
    }

    private String normalizeLayout(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "portrait";
        if (!List.of("portrait", "landscape").contains(normalized)) {
            throw new IllegalArgumentException("Invalid layout");
        }
        return normalized;
    }

    private String normalizePlaceholderKey(String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Placeholder key is required");
        }
        String normalized = value.trim();
        if (normalized.startsWith("{{") && normalized.endsWith("}}")) {
            normalized = normalized.substring(2, normalized.length() - 2).trim();
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    private String normalizePlaceholderType(String value, String placeholderKey) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
        if (StringUtils.hasText(normalized)) {
            return normalized;
        }
        String key = normalizePlaceholderKey(placeholderKey);
        if (key.contains("signature")) return "SIGNATURE";
        if (key.contains("date") || key.contains("time")) return "DATE";
        if (key.contains("number") || key.contains("count")) return "NUMBER";
        if (key.contains("barcode")) return "BARCODE";
        if (key.contains("qr")) return "QR_CODE";
        if (key.contains("list") || key.contains("reviewer") || key.contains("approver") || key.contains("author") || key.contains("coauthor")) return "COLLECTION";
        return "TEXT";
    }

    private String buildToken(String placeholderKey) {
        return "{{" + placeholderKey + "}}";
    }
}

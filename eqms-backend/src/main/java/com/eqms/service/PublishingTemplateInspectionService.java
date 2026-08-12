package com.eqms.service;

import com.eqms.dto.publishing.PublishingTemplateComponentInspectionResponse;
import com.eqms.dto.publishing.PublishingTemplatePlaceholderMappingResponse;
import com.eqms.dto.document.DocumentParticipantResponse;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.entity.PublishingTemplateComponent;
import com.eqms.entity.PublishingTemplate;
import com.eqms.repository.PublishingTemplateRepository;
import com.eqms.repository.PublishingTemplateComponentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;

@Service
public class PublishingTemplateInspectionService {

    private final PublishingTemplateRepository templateRepository;
    private final PublishingTemplateComponentRepository componentRepository;
    private final FileStorageService fileStorageService;
    private final RevisionService revisionService;
    private final PublishingTemplatePlaceholderMapperService placeholderMapperService;
    private final ElectronicSignatureService electronicSignatureService;
    private final ObjectMapper objectMapper;

    public PublishingTemplateInspectionService(
            PublishingTemplateRepository templateRepository,
            PublishingTemplateComponentRepository componentRepository,
            FileStorageService fileStorageService,
            RevisionService revisionService,
            PublishingTemplatePlaceholderMapperService placeholderMapperService,
            ElectronicSignatureService electronicSignatureService,
            ObjectMapper objectMapper
    ) {
        this.templateRepository = templateRepository;
        this.componentRepository = componentRepository;
        this.fileStorageService = fileStorageService;
        this.revisionService = revisionService;
        this.placeholderMapperService = placeholderMapperService;
        this.electronicSignatureService = electronicSignatureService;
        this.objectMapper = objectMapper;
    }

    public PublishingTemplateComponentInspectionResponse inspectComponent(UUID templateId, String componentType) {
        return inspectComponent(templateId, componentType, null, null);
    }

    public PublishingTemplateComponentInspectionResponse inspectComponent(UUID templateId, String componentType, String layout, UUID revisionId) {
        PublishingTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Publishing template not found"));
        String normalizedComponent = normalizeComponentType(componentType);
        String normalizedLayout = normalizeLayout(layout);
        ComponentFileDescriptor descriptor = resolveDescriptor(template, normalizedComponent, normalizedLayout);
        if (descriptor == null || !StringUtils.hasText(descriptor.storedPath())) {
            return emptyInspection(normalizedComponent, normalizedLayout, "Component file has not been uploaded yet");
        }

        try {
            Path materialized = fileStorageService.materializeStoredFile(descriptor.storedPath());
            boolean previewAvailable = materialized != null && Files.exists(materialized);
            List<String> variables = List.of();
            Integer paragraphCount = null;
            Integer tableCount = null;
            Integer headerSectionCount = null;
            Integer footerSectionCount = null;
            String notes = null;
            RevisionDetailResponse revision = revisionId == null ? null : revisionService.getRevision(revisionId);
            String sampleRevisionId = revision == null ? null : revision.id();
            String sampleDocumentNumber = revision == null ? null : revision.documentNumber();
            String sampleRevisionNumber = revision == null ? null : revision.revisionNumber();
            String sampleCode = buildRevisionCode(sampleDocumentNumber, sampleRevisionNumber);
            String samplePageLabel = revision == null ? null : "1/1";
            String sampleDocumentName = revision == null ? null : revision.documentName();
            String sampleTitleLocalLanguage = revision == null ? null : revision.titleLocalLanguage();
            String sampleRevisionName = revision == null ? null : revision.revisionName();
            String sampleDocumentType = revision == null ? null : revision.type();
            String sampleEffectiveDate = revision == null ? null : revision.effectiveDate();
            String sampleValidUntil = revision == null ? null : revision.validUntil();
            String sampleReviewDate = revision == null ? null : revision.reviewDate();
            String sampleStatus = revision == null ? null : revision.statusInfo() == null ? revision.status() : revision.statusInfo().label();
            String samplePreparedDate = revision == null ? null : revision.submittedOn();
            String samplePreparedDesignation = revision == null ? null : revision.authorPosition();
            String samplePreparedSign = revision == null ? null : revision.authorUsername();
            String samplePreparedName = revision == null ? null : revision.author();

            DocumentParticipantResponse checkedParticipant = lastCompletedParticipant(revision == null ? null : revision.reviewers());
            String sampleCheckedDate = checkedParticipant == null ? null : checkedParticipant.actedAt();
            String sampleCheckedDesignation = checkedParticipant == null ? null : checkedParticipant.position();
            String sampleCheckedSign = checkedParticipant == null ? null : checkedParticipant.username();
            String sampleCheckedName = checkedParticipant == null ? null : checkedParticipant.fullName();

            DocumentParticipantResponse approvedParticipant = lastCompletedParticipant(revision == null ? null : revision.approvers());
            String sampleApprovedDate = approvedParticipant == null ? null : approvedParticipant.actedAt();
            String sampleApprovedDesignation = approvedParticipant == null ? null : approvedParticipant.position();
            String sampleApprovedSign = approvedParticipant == null ? null : approvedParticipant.username();
            String sampleApprovedName = approvedParticipant == null ? null : approvedParticipant.fullName();

            if (previewAvailable && isDocx(materialized, descriptor.fileName())) {
                try (InputStream input = Files.newInputStream(materialized); XWPFDocument document = new XWPFDocument(input)) {
                    paragraphCount = document.getParagraphs().size();
                    tableCount = document.getTables().size();
                    headerSectionCount = document.getHeaderList().size();
                    footerSectionCount = document.getFooterList().size();
                    variables = extractVariables(document);
                    notes = "OpenXML structure inspected successfully";
                }
            } else if (previewAvailable) {
                notes = "Binary component preview available";
            }

            PublishingTemplateComponent component = componentRepository
                    .findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(templateId, normalizedComponent, normalizedLayout)
                    .orElse(null);
            if (component != null && variables.isEmpty()) {
                variables = parsePlaceholders(component.getDetectedPlaceholders());
            }
            List<PublishingTemplatePlaceholderMappingResponse> mappings = placeholderMapperService.mapPlaceholders(variables, revision);
            if (revisionId != null) {
                Map<String, String> signatureBlocks = electronicSignatureService.signaturePlaceholderValues(revision, variables);
                if (!signatureBlocks.isEmpty()) {
                    mappings = mappings.stream()
                            .map(mapping -> {
                                String key = mapping.placeholder() == null ? null : mapping.placeholder().toLowerCase();
                                String block = key == null ? null : signatureBlocks.get(key);
                                if (!StringUtils.hasText(block)) {
                                    return mapping;
                                }
                                return new PublishingTemplatePlaceholderMappingResponse(
                                        mapping.placeholder(),
                                        mapping.revisionField(),
                                        mapping.label(),
                                        block,
                                        mapping.sourceSection()
                                );
                            })
                            .toList();
                }
            }

            return new PublishingTemplateComponentInspectionResponse(
                    normalizedComponent,
                    normalizedLayout,
                    descriptor.fileName(),
                    descriptor.storedPath(),
                    previewAvailable ? guessContentType(descriptor.fileName()) : null,
                    previewAvailable,
                    variables,
                    paragraphCount,
                    tableCount,
                    headerSectionCount,
                    footerSectionCount,
                    sampleRevisionId,
                    sampleDocumentNumber,
                    sampleRevisionNumber,
                    sampleCode,
                    samplePageLabel,
                    sampleDocumentName,
                    sampleTitleLocalLanguage,
                    sampleRevisionName,
                    sampleDocumentType,
                    sampleEffectiveDate,
                    sampleValidUntil,
                    sampleReviewDate,
                    sampleStatus,
                    samplePreparedDate,
                    samplePreparedDesignation,
                    samplePreparedSign,
                    samplePreparedName,
                    sampleCheckedDate,
                    sampleCheckedDesignation,
                    sampleCheckedSign,
                    sampleCheckedName,
                    sampleApprovedDate,
                    sampleApprovedDesignation,
                    sampleApprovedSign,
                    sampleApprovedName,
                    notes,
                    mappings
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to inspect publishing template component", ex);
        }
    }

    private List<String> extractVariables(XWPFDocument document) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (var paragraph : document.getParagraphs()) {
            Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraph.getText() == null ? "" : paragraph.getText());
            while (matcher.find()) {
                values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
            }
        }
        document.getTables().forEach(table -> collectTableVariables(table, values));
        document.getHeaderList().forEach(header -> {
            header.getParagraphs().forEach(paragraph -> {
                Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraph.getText() == null ? "" : paragraph.getText());
                while (matcher.find()) {
                    values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
                }
            });
            header.getTables().forEach(table -> collectTableVariables(table, values));
        });
        document.getFooterList().forEach(footer -> {
            footer.getParagraphs().forEach(paragraph -> {
                Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraph.getText() == null ? "" : paragraph.getText());
                while (matcher.find()) {
                    values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
                }
            });
            footer.getTables().forEach(table -> collectTableVariables(table, values));
        });
        collectRawXmlVariables(document.getDocument().xmlText(), values);
        document.getHeaderList().forEach(header -> collectRawXmlVariables(header._getHdrFtr().xmlText(), values));
        document.getFooterList().forEach(footer -> collectRawXmlVariables(footer._getHdrFtr().xmlText(), values));
        return values.stream().toList();
    }

    private void collectTableVariables(XWPFTable table, LinkedHashSet<String> values) {
        table.getRows().forEach(row -> row.getTableCells().forEach(cell -> {
            cell.getParagraphs().forEach(paragraph -> {
                Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraph.getText() == null ? "" : paragraph.getText());
                while (matcher.find()) {
                    values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
                }
            });
            cell.getTables().forEach(nested -> collectTableVariables(nested, values));
        }));
    }

    private void collectRawXmlVariables(String rawXml, LinkedHashSet<String> values) {
        if (!StringUtils.hasText(rawXml)) {
            return;
        }
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(rawXml);
        while (matcher.find()) {
            values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
        }
    }

    private PublishingTemplateComponentInspectionResponse emptyInspection(String componentType, String layout, String notes) {
        return new PublishingTemplateComponentInspectionResponse(
                componentType,
                layout,
                null,
                null,
                null,
                false,
                List.of(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                notes,
                List.of()
        );
    }

    private DocumentParticipantResponse lastCompletedParticipant(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return null;
        }
        for (int i = participants.size() - 1; i >= 0; i--) {
            DocumentParticipantResponse participant = participants.get(i);
            if (participant != null && StringUtils.hasText(participant.actedAt())) {
                return participant;
            }
        }
        return participants.get(participants.size() - 1);
    }

    private String buildRevisionCode(String documentNumber, String revisionNumber) {
        String safeDocumentNumber = StringUtils.hasText(documentNumber) ? documentNumber.trim() : "";
        String safeRevisionNumber = StringUtils.hasText(revisionNumber) ? revisionNumber.trim() : "";
        if (!StringUtils.hasText(safeDocumentNumber) && !StringUtils.hasText(safeRevisionNumber)) {
            return "-";
        }
        String major = safeRevisionNumber;
        if (StringUtils.hasText(safeRevisionNumber)) {
            String[] parts = safeRevisionNumber.split("\\.");
            major = parts.length > 0 ? parts[0] : safeRevisionNumber;
        }
        if (!StringUtils.hasText(safeDocumentNumber)) {
            return StringUtils.hasText(major) ? major : "-";
        }
        if (!StringUtils.hasText(major)) {
            return safeDocumentNumber;
        }
        return safeDocumentNumber + "." + major;
    }

    private String guessContentType(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "application/octet-stream";
        }
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".doc")) return "application/msword";
        return "application/octet-stream";
    }

    private boolean isDocx(Path path, String fileName) {
        if (path != null) {
            return com.eqms.util.DocxSignature.isDocx(path);
        }
        return StringUtils.hasText(fileName) && fileName.toLowerCase().endsWith(".docx");
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

    private record ComponentFileDescriptor(String storedPath, String fileName) {
    }
}

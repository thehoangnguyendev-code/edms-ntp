package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.entity.PublishingTemplateComponent;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.PublishingTemplate;
import com.eqms.repository.PublishingTemplateComponentRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class PublishingPdfComposerService {

    public record PublishingCompositionResult(byte[] pdfBytes, int pageCount) {
    }

    private final FileStorageService fileStorageService;
    private final MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;
    private final PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService;
    private final RevisionService revisionService;
    private final PublishingTemplateComponentRepository componentRepository;
    private final PublishingPlaceholderStyleService placeholderStyleService;

    public PublishingPdfComposerService(
            FileStorageService fileStorageService,
            MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService,
            PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService,
            RevisionService revisionService,
            PublishingTemplateComponentRepository componentRepository,
            PublishingPlaceholderStyleService placeholderStyleService
    ) {
        this.fileStorageService = fileStorageService;
        this.microsoftGraphOfficeOnlineService = microsoftGraphOfficeOnlineService;
        this.openXmlTemplateRenderService = openXmlTemplateRenderService;
        this.revisionService = revisionService;
        this.componentRepository = componentRepository;
        this.placeholderStyleService = placeholderStyleService;
    }

    public PublishingCompositionResult composePreview(DocumentRevisionRecord revision, PublishingTemplate template, String layout) throws IOException {
        return composePreview(revision, template, layout, null, null, null, null);
    }

    public PublishingCompositionResult composePreview(
            DocumentRevisionRecord revision,
            PublishingTemplate template,
            String layout,
            Boolean enableCover,
            Boolean enableHeader,
            Boolean enableFooter
    ) throws IOException {
        return composePreview(revision, template, layout, enableCover, enableHeader, enableFooter, null);
    }

    /**
     * @param callerExtraValues additional placeholder values (e.g. controlled-copy-specific
     *                          {{copyNo}}/{{distributionList}}) merged in before rendering, on
     *                          top of the standard revision-derived values.
     */
    public PublishingCompositionResult composePreview(
            DocumentRevisionRecord revision,
            PublishingTemplate template,
            String layout,
            Boolean enableCover,
            Boolean enableHeader,
            Boolean enableFooter,
            Map<String, String> callerExtraValues
    ) throws IOException {
        Path sourcePath = requireSourcePath(revision);
        RevisionDetailResponse revisionDetail = revision == null ? null : revisionService.getRevision(revision.getId());
        String normalizedLayout = normalizeLayout(layout);
        String sourceFileName = safeName(revision);
        Map<String, String> extraValues = new LinkedHashMap<>();
        if (callerExtraValues != null) {
            extraValues.putAll(callerExtraValues);
        }
        boolean hasCover = resolveEnabled(enableCover, includeCover(template, normalizedLayout));
        boolean applyHeader = resolveEnabled(enableHeader, includeHeader(template, normalizedLayout));
        boolean applyFooter = resolveEnabled(enableFooter, includeFooter(template, normalizedLayout));
        extraValues.put("pageOffset", hasCover ? "1" : "0");
        Path publishingSourcePath = prepareSourceWithHeaderFooter(sourcePath, sourceFileName, template, normalizedLayout, revisionDetail, extraValues, applyHeader, applyFooter);
        byte[] sourcePdf = convertToPdf(publishingSourcePath, sourceFileName);
        int bodyPageCount = countPages(sourcePdf);
        extraValues.putAll(buildExtraValues(bodyPageCount, hasCover));
        publishingSourcePath = prepareSourceWithHeaderFooter(sourcePath, sourceFileName, template, normalizedLayout, revisionDetail, extraValues, applyHeader, applyFooter);
        sourcePdf = convertToPdf(publishingSourcePath, sourceFileName);
        byte[] coverPdf = hasCover
                ? firstPageOnly(resolveTemplateComponentPdf(
                        resolveCoverPath(template, normalizedLayout),
                        resolveCoverFileName(template, normalizedLayout),
                        revisionDetail,
                        extraValues,
                        resolveComponentStyles(template, "cover", normalizedLayout)
                ))
                : null;
        byte[] merged = mergePdfParts(coverPdf, sourcePdf);
        return new PublishingCompositionResult(merged, countPages(merged));
    }

    private boolean resolveEnabled(Boolean override, boolean templateDefault) {
        return override != null ? (override && templateDefault) : templateDefault;
    }

    public byte[] composePublishedPdf(byte[] previewBytes) {
        return previewBytes == null ? new byte[0] : previewBytes.clone();
    }

    private byte[] mergePdfParts(byte[] coverPdf, byte[] sourcePdf) throws IOException {
        try (PDDocument bodyDocument = Loader.loadPDF(sourcePdf);
             PDDocument coverDocument = coverPdf == null || coverPdf.length == 0 ? null : Loader.loadPDF(coverPdf);
             PDDocument output = new PDDocument()) {
            boolean hasCover = coverDocument != null && coverDocument.getNumberOfPages() > 0;

            if (hasCover) {
                output.importPage(coverDocument.getPage(0));
            }
            for (PDPage page : bodyDocument.getPages()) {
                output.importPage(page);
            }

            try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
                output.save(outputStream);
                return outputStream.toByteArray();
            }
        }
    }

    private byte[] firstPageOnly(byte[] pdfBytes) throws IOException {
        if (pdfBytes == null || pdfBytes.length == 0) {
            return pdfBytes;
        }
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            if (document.getNumberOfPages() <= 1) {
                return pdfBytes;
            }
            try (PDDocument singlePage = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                singlePage.importPage(document.getPage(0));
                singlePage.save(output);
                return output.toByteArray();
            }
        }
    }

    private byte[] resolveTemplateComponentPdf(String storedPath, String fileName, RevisionDetailResponse revision, Map<String, String> extraValues) throws IOException {
        return resolveTemplateComponentPdf(storedPath, fileName, revision, extraValues, Map.of());
    }

    private byte[] resolveTemplateComponentPdf(String storedPath, String fileName, RevisionDetailResponse revision, Map<String, String> extraValues, Map<String, PublishingPlaceholderStyleConfig> placeholderStyles) throws IOException {
        if (!StringUtils.hasText(storedPath)) {
            return null;
        }
        Path materialized = fileStorageService.materializeStoredFile(storedPath);
        if (materialized == null || !Files.exists(materialized)) {
            return null;
        }
        Path rendered = openXmlTemplateRenderService.renderDocxTemplate(materialized, fileName, revision, extraValues, true, false, null, null, null, false, placeholderStyles);
        return convertToPdf(rendered, fileName);
    }

    private Path prepareSourceWithHeaderFooter(
            Path sourcePath,
            String sourceFileName,
            PublishingTemplate template,
            String layout,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            boolean applyHeader,
            boolean applyFooter
    ) throws IOException {
        if (template == null || !isDocx(sourcePath, sourceFileName)) {
            return sourcePath;
        }
        String headerPath = applyHeader ? resolveHeaderPath(template, layout) : null;
        String footerPath = applyFooter ? resolveFooterPath(template, layout) : null;
        if (!StringUtils.hasText(headerPath) && !StringUtils.hasText(footerPath)) {
            return sourcePath;
        }
        Path materializedHeader = materializeOptional(headerPath);
        Path materializedFooter = materializeOptional(footerPath);
        return openXmlTemplateRenderService.renderSourceWithHeaderFooter(
                sourcePath,
                sourceFileName,
                materializedHeader,
                resolveHeaderFileName(template, layout),
                materializedFooter,
                resolveFooterFileName(template, layout),
                revision,
                extraValues == null ? Map.of() : extraValues,
                resolveComponentStyles(template, "header", layout),
                resolveComponentStyles(template, "footer", layout)
        );
    }

    private Map<String, PublishingPlaceholderStyleConfig> resolveComponentStyles(PublishingTemplate template, String componentType, String layout) {
        if (template == null) {
            return Map.of();
        }
        try {
            return placeholderStyleService.resolveStyleMap(template.getId(), componentType, layout);
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private Path materializeOptional(String storedPath) throws IOException {
        if (!StringUtils.hasText(storedPath)) {
            return null;
        }
        Path materialized = fileStorageService.materializeStoredFile(storedPath);
        return materialized != null && Files.exists(materialized) ? materialized : null;
    }

    private boolean includeCover(PublishingTemplate template, String layout) {
        if (template == null) {
            return false;
        }
        String mode = template.getPublishingMode();
        if (!StringUtils.hasText(mode)) {
            return StringUtils.hasText(resolveCoverPath(template, layout));
        }
        String normalized = mode.trim().toUpperCase();
        return !"HEADER_FOOTER_ONLY".equals(normalized)
                && !"BODY_HEADER_FOOTER_ONLY".equals(normalized)
                && StringUtils.hasText(resolveCoverPath(template, layout));
    }

    private boolean includeHeader(PublishingTemplate template, String layout) {
        if (template == null || !template.isEnableHeader()) {
            return false;
        }
        String mode = template.getPublishingMode();
        if (!StringUtils.hasText(mode)) {
            return StringUtils.hasText(resolveHeaderPath(template, layout));
        }
        String normalized = mode.trim().toUpperCase();
        return ("COVER_HEADER_FOOTER".equals(normalized)
                || "COVER_AND_HEADER_FOOTER".equals(normalized)
                || "HEADER_FOOTER_ONLY".equals(normalized)
                || "BODY_HEADER_FOOTER_ONLY".equals(normalized))
                && StringUtils.hasText(resolveHeaderPath(template, layout));
    }

    private boolean includeFooter(PublishingTemplate template, String layout) {
        if (template == null || !template.isEnableFooter()) {
            return false;
        }
        String mode = template.getPublishingMode();
        if (!StringUtils.hasText(mode)) {
            return StringUtils.hasText(resolveFooterPath(template, layout));
        }
        String normalized = mode.trim().toUpperCase();
        return ("COVER_HEADER_FOOTER".equals(normalized)
                || "COVER_AND_HEADER_FOOTER".equals(normalized)
                || "HEADER_FOOTER_ONLY".equals(normalized)
                || "BODY_HEADER_FOOTER_ONLY".equals(normalized))
                && StringUtils.hasText(resolveFooterPath(template, layout));
    }

    private String resolveCoverPath(PublishingTemplate template, String layout) {
        PublishingTemplateComponent component = componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                "cover",
                layout
        ).orElse(null);
        if (component != null && StringUtils.hasText(component.getObjectKey())) {
            return component.getObjectKey();
        }
        return template.getCoverTemplatePath();
    }

    private String resolveCoverFileName(PublishingTemplate template, String layout) {
        PublishingTemplateComponent component = componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                "cover",
                layout
        ).orElse(null);
        if (component != null && StringUtils.hasText(component.getFileName())) {
            return component.getFileName();
        }
        return template.getCoverFileName();
    }

    private String resolveHeaderPath(PublishingTemplate template, String layout) {
        PublishingTemplateComponent component = componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                "header",
                layout
        ).orElse(null);
        if (component != null && StringUtils.hasText(component.getObjectKey())) {
            return component.getObjectKey();
        }
        return template.getHeaderTemplatePath();
    }

    private String resolveHeaderFileName(PublishingTemplate template, String layout) {
        PublishingTemplateComponent component = componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                "header",
                layout
        ).orElse(null);
        if (component != null && StringUtils.hasText(component.getFileName())) {
            return component.getFileName();
        }
        return template.getHeaderFileName();
    }

    private String resolveFooterPath(PublishingTemplate template, String layout) {
        PublishingTemplateComponent component = componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                "footer",
                layout
        ).orElse(null);
        if (component != null && StringUtils.hasText(component.getObjectKey())) {
            return component.getObjectKey();
        }
        return template.getFooterTemplatePath();
    }

    private String resolveFooterFileName(PublishingTemplate template, String layout) {
        PublishingTemplateComponent component = componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                template.getId(),
                "footer",
                layout
        ).orElse(null);
        if (component != null && StringUtils.hasText(component.getFileName())) {
            return component.getFileName();
        }
        return template.getFooterFileName();
    }

    private Map<String, String> buildExtraValues(int bodyPageCount, boolean hasCover) {
        Map<String, String> extraValues = new LinkedHashMap<>();
        int totalPageCount = Math.max(1, bodyPageCount + (hasCover ? 1 : 0));
        extraValues.put("pageLabel", "1/" + totalPageCount);
        return extraValues;
    }

    private String normalizeLayout(String layout) {
        String normalized = StringUtils.hasText(layout) ? layout.trim().toUpperCase() : "PORTRAIT";
        return "LANDSCAPE".equals(normalized) ? "LANDSCAPE" : "PORTRAIT";
    }

    private byte[] convertToPdf(Path path, String fileName) throws IOException {
        if (isPdf(path, fileName)) {
            return Files.readAllBytes(path);
        }
        return microsoftGraphOfficeOnlineService.convertSourceFileToPdf(path, fileName);
    }

    private boolean isPdf(Path path, String fileName) {
        String candidate = StringUtils.hasText(fileName) ? fileName : (path == null ? null : path.getFileName().toString());
        return candidate != null && candidate.toLowerCase().endsWith(".pdf");
    }

    private boolean isDocx(Path path, String fileName) {
        if (path != null) {
            return com.eqms.util.DocxSignature.isDocx(path);
        }
        return StringUtils.hasText(fileName) && fileName.toLowerCase(java.util.Locale.ROOT).endsWith(".docx");
    }

    private Path requireSourcePath(DocumentRevisionRecord revision) {
        if (revision == null || !StringUtils.hasText(revision.getFilePath())) {
            throw new IllegalStateException("Revision source file is not available");
        }
        try {
            return fileStorageService.materializeStoredFile(revision.getFilePath());
        } catch (IOException ex) {
            throw new IllegalStateException("Revision source file is not available", ex);
        }
    }

    private String safeName(DocumentRevisionRecord revision) {
        String documentNumber = revision == null ? null : revision.getDocumentNumber();
        String revisionNumber = revision == null ? null : revision.getRevisionNumber();
        if (StringUtils.hasText(documentNumber) && StringUtils.hasText(revisionNumber)) {
            return documentNumber + "_" + revisionNumber + ".docx";
        }
        return "revision.docx";
    }

    private int countPages(byte[] pdfBytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            return document.getNumberOfPages();
        }
    }
}

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
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PublishingPdfComposerService.class);


    public record PublishingCompositionResult(byte[] pdfBytes, int pageCount) {
    }

    private final FileStorageService fileStorageService;
    private final OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;
    private final PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService;
    private final RevisionService revisionService;
    private final PublishingTemplateComponentRepository componentRepository;
    private final PublishingPlaceholderStyleService placeholderStyleService;

    public PublishingPdfComposerService(
            FileStorageService fileStorageService,
            OnlyOfficeDocumentEditService onlyOfficeDocumentEditService,
            PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService,
            RevisionService revisionService,
            PublishingTemplateComponentRepository componentRepository,
            PublishingPlaceholderStyleService placeholderStyleService
    ) {
        this.fileStorageService = fileStorageService;
        this.onlyOfficeDocumentEditService = onlyOfficeDocumentEditService;
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
        // buildDetailResponse(), not getRevision(id): this already has the loaded entity, and
        // getRevision() requires an authenticated current user + writes its own "opened"/VIEW
        // audit bookkeeping -- both wrong here, and getRevision() throws outright when this runs
        // on a background thread with no HTTP request/current-user context (e.g. the async
        // snapshot regeneration in RevisionPublishingSnapshotAsyncService).
        RevisionDetailResponse revisionDetail = revision == null ? null : revisionService.buildDetailResponseForRendering(revision);
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
        log.info("Publishing compose: template={} hasCover={} header={}[{}-{}] footer={}[{}-{}]",
                template == null ? null : template.getId(), hasCover,
                applyHeader, template == null ? null : template.getHeaderPageFrom(), template == null ? null : template.getHeaderPageTo(),
                applyFooter, template == null ? null : template.getFooterPageFrom(), template == null ? null : template.getFooterPageTo());
        byte[] bodyPdf = sourcePdf;
        if ((applyHeader || applyFooter) && rangesRestrictHeaderFooter(template, hasCover, applyHeader, applyFooter)) {
            try {
                bodyPdf = composeWithPageRanges(sourcePath, sourceFileName, template, normalizedLayout, revisionDetail,
                        extraValues, applyHeader, applyFooter, hasCover, sourcePdf, bodyPageCount);
            } catch (Exception ex) {
                log.warn("Header/footer page ranges could not be applied; using header/footer on every page", ex);
                bodyPdf = sourcePdf;
            }
        }
        byte[] merged = mergePdfParts(coverPdf, bodyPdf);
        return new PublishingCompositionResult(merged, countPages(merged));
    }

    /** First page of the FINAL pdf on which header/footer may appear when no explicit "From" is set. */
    private int defaultHeaderFooterStart(boolean hasCover) {
        return hasCover ? 2 : 1;
    }

    private boolean inPageRange(int finalPage, Integer from, Integer to, int defaultFrom) {
        int start = from == null ? defaultFrom : Math.max(from, defaultFrom);
        return finalPage >= start && (to == null || finalPage <= to);
    }

    private boolean rangesRestrictHeaderFooter(PublishingTemplate template, boolean hasCover, boolean applyHeader, boolean applyFooter) {
        if (template == null) {
            return false;
        }
        int start = defaultHeaderFooterStart(hasCover);
        boolean header = applyHeader && (template.getHeaderPageTo() != null
                || (template.getHeaderPageFrom() != null && template.getHeaderPageFrom() > start));
        boolean footer = applyFooter && (template.getFooterPageTo() != null
                || (template.getFooterPageFrom() != null && template.getFooterPageFrom() > start));
        return header || footer;
    }

    private record Cut(int elementIndex, boolean header, boolean footer) {}

    private static final String HDR_MARK = "ZZHDRMARKZZ";
    private static final String FTR_MARK = "ZZFTRMARKZZ";

    /**
     * Honours the workspace's Header/Footer page ranges by giving the body real Word sections: pages inside
     * a range keep the header/footer, pages outside get empty ones, so the body reclaims the freed space
     * and re-flows (no blank bands). Section breaks are placed by probing: for each state change, binary
     * search the paragraph after which a break makes the new section begin on the wanted page, detecting
     * which pages carry the header/footer through invisible probe markers that never reach the final PDF.
     */
    private byte[] composeWithPageRanges(
            Path sourcePath, String sourceFileName, PublishingTemplate template, String layout,
            RevisionDetailResponse revisionDetail, Map<String, String> extraValues,
            boolean applyHeader, boolean applyFooter, boolean hasCover, byte[] fullPdf, int bodyPages
    ) throws IOException {
        int offset = hasCover ? 1 : 0;
        int defaultFrom = defaultHeaderFooterStart(hasCover);
        java.util.List<boolean[]> states = new java.util.ArrayList<>();
        java.util.List<Integer> boundaryPages = new java.util.ArrayList<>();
        boolean[] previous = null;
        for (int bp = 1; bp <= bodyPages; bp++) {
            int finalPage = bp + offset;
            boolean[] current = {
                    applyHeader && inPageRange(finalPage, template.getHeaderPageFrom(), template.getHeaderPageTo(), defaultFrom),
                    applyFooter && inPageRange(finalPage, template.getFooterPageFrom(), template.getFooterPageTo(), defaultFrom)};
            if (previous == null) {
                states.add(current);
            } else if (previous[0] != current[0] || previous[1] != current[1]) {
                states.add(current);
                boundaryPages.add(bp);
            }
            previous = current;
        }
        boolean[] lastState = states.get(states.size() - 1);
        if (boundaryPages.isEmpty() && states.get(0)[0] == applyHeader && states.get(0)[1] == applyFooter) {
            return fullPdf; // every page has exactly what the full render has
        }

        Path base = prepareSourceWithHeaderFooter(sourcePath, sourceFileName, template, layout, revisionDetail, extraValues, applyHeader, applyFooter);
        if (base.equals(sourcePath)) {
            return fullPdf;
        }
        Path probeBase = withProbeMarkers(base);
        java.util.List<Integer> candidates = paragraphCandidates(base);
        java.util.List<Cut> cuts = new java.util.ArrayList<>();
        int searchFrom = 0;
        int previousBoundary = 1;
        for (int j = 1; j < states.size(); j++) {
            boolean[] before = states.get(j - 1);
            boolean[] after = states.get(j);
            int target = boundaryPages.get(j - 1);
            int lo = searchFrom;
            int hi = candidates.size() - 1;
            int best = -1;
            while (lo <= hi) {
                int mid = (lo + hi) >>> 1;
                java.util.List<Cut> trial = new java.util.ArrayList<>(cuts);
                trial.add(new Cut(candidates.get(mid), before[0], before[1]));
                int start = firstPageMatching(convertToPdf(buildSectioned(probeBase, trial, after[0], after[1]), sourceFileName),
                        after, previousBoundary);
                if (start <= target) {
                    best = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            if (best < 0) {
                throw new IllegalStateException("No section break position found for page " + target);
            }
            cuts.add(new Cut(candidates.get(best), before[0], before[1]));
            searchFrom = best + 1;
            previousBoundary = target;
        }

        byte[] result = convertToPdf(buildSectioned(base, cuts, lastState[0], lastState[1]), sourceFileName);
        int newCount = countPages(result);
        if (newCount != bodyPages) {
            // "Page x of N" placeholders were filled from the full render's page count; refresh them.
            extraValues.putAll(buildExtraValues(newCount, hasCover));
            Path rebased = prepareSourceWithHeaderFooter(sourcePath, sourceFileName, template, layout, revisionDetail, extraValues, applyHeader, applyFooter);
            result = convertToPdf(buildSectioned(rebased, cuts, lastState[0], lastState[1]), sourceFileName);
        }
        return result;
    }

    /** First body page (1-based, at or after {@code from}) whose header/footer presence equals the state. */
    private int firstPageMatching(byte[] pdf, boolean[] state, int from) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
            int pages = document.getNumberOfPages();
            for (int p = Math.max(1, from); p <= pages; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                String text = stripper.getText(document);
                if (text.contains(HDR_MARK) == state[0] && text.contains(FTR_MARK) == state[1]) {
                    return p;
                }
            }
            return pages + 1;
        }
    }

    /** Indexes (within the body element list) of top-level paragraphs after which a section break may go. */
    private java.util.List<Integer> paragraphCandidates(Path docx) throws IOException {
        try (java.io.InputStream in = Files.newInputStream(docx);
             org.apache.poi.xwpf.usermodel.XWPFDocument doc = new org.apache.poi.xwpf.usermodel.XWPFDocument(in)) {
            java.util.List<Integer> result = new java.util.ArrayList<>();
            var elements = doc.getBodyElements();
            for (int i = 0; i < elements.size() - 1; i++) {
                if (elements.get(i) instanceof org.apache.poi.xwpf.usermodel.XWPFParagraph paragraph
                        && !(paragraph.getCTP().isSetPPr() && paragraph.getCTP().getPPr().isSetSectPr())) {
                    result.add(i);
                }
            }
            return result;
        }
    }

    /** Copy of the docx whose header/footer each end with an invisible 1pt marker so probes can see them. */
    private Path withProbeMarkers(Path docx) throws IOException {
        Path out = Files.createTempFile("publishing-probe-", ".docx");
        out.toFile().deleteOnExit();
        try (java.io.InputStream in = Files.newInputStream(docx);
             org.apache.poi.xwpf.usermodel.XWPFDocument doc = new org.apache.poi.xwpf.usermodel.XWPFDocument(in);
             java.io.OutputStream os = Files.newOutputStream(out)) {
            for (var header : doc.getHeaderList()) {
                appendMarker(header.getParagraphs().isEmpty() ? header.createParagraph() : header.getParagraphs().get(header.getParagraphs().size() - 1), HDR_MARK);
            }
            for (var footer : doc.getFooterList()) {
                appendMarker(footer.getParagraphs().isEmpty() ? footer.createParagraph() : footer.getParagraphs().get(footer.getParagraphs().size() - 1), FTR_MARK);
            }
            doc.write(os);
        }
        return out;
    }

    private void appendMarker(org.apache.poi.xwpf.usermodel.XWPFParagraph paragraph, String marker) {
        var run = paragraph.createRun();
        run.setText(marker);
        run.setFontSize(1);
        run.setColor("FFFFFF");
    }

    /**
     * Copy of {@code base} split into sections: each cut ends a section (after that paragraph) that shows
     * the header/footer per the cut's state; the trailing section uses the final state. "Off" sections
     * point at empty header/footer parts instead of the full ones.
     */
    private Path buildSectioned(Path base, java.util.List<Cut> cuts, boolean finalHeader, boolean finalFooter) throws IOException {
        Path out = Files.createTempFile("publishing-sectioned-", ".docx");
        out.toFile().deleteOnExit();
        try (java.io.InputStream in = Files.newInputStream(base);
             org.apache.poi.xwpf.usermodel.XWPFDocument doc = new org.apache.poi.xwpf.usermodel.XWPFDocument(in);
             java.io.OutputStream os = Files.newOutputStream(out)) {
            var body = doc.getDocument().getBody();
            var bodySect = body.isSetSectPr() ? body.getSectPr() : body.addNewSectPr();
            String fullHeaderId = bodySect.sizeOfHeaderReferenceArray() > 0 ? bodySect.getHeaderReferenceArray(0).getId() : null;
            String fullFooterId = bodySect.sizeOfFooterReferenceArray() > 0 ? bodySect.getFooterReferenceArray(0).getId() : null;
            // Fresh, empty header/footer parts. Created through a policy bound to a detached sectPr so POI
            // neither reuses nor overwrites the full parts already referenced by the document.
            var detached = org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr.Factory.newInstance();
            var detachedPolicy = new org.apache.poi.xwpf.model.XWPFHeaderFooterPolicy(doc, detached);
            String emptyHeaderId = doc.getRelationId(detachedPolicy.createHeader(org.apache.poi.xwpf.model.XWPFHeaderFooterPolicy.DEFAULT));
            String emptyFooterId = doc.getRelationId(detachedPolicy.createFooter(org.apache.poi.xwpf.model.XWPFHeaderFooterPolicy.DEFAULT));
            var template = (org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr) bodySect.copy();
            var elements = doc.getBodyElements();
            for (Cut cut : cuts) {
                var paragraph = (org.apache.poi.xwpf.usermodel.XWPFParagraph) elements.get(cut.elementIndex());
                var pPr = paragraph.getCTP().isSetPPr() ? paragraph.getCTP().getPPr() : paragraph.getCTP().addNewPPr();
                var sectPr = pPr.isSetSectPr() ? pPr.getSectPr() : pPr.addNewSectPr();
                sectPr.set(template.copy());
                setHeaderFooterRefs(sectPr,
                        cut.header() ? fullHeaderId : emptyHeaderId, cut.footer() ? fullFooterId : emptyFooterId);
            }
            setHeaderFooterRefs(bodySect,
                    finalHeader ? fullHeaderId : emptyHeaderId, finalFooter ? fullFooterId : emptyFooterId);
            doc.write(os);
        }
        return out;
    }

    private void setHeaderFooterRefs(org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr sectPr, String headerId, String footerId) {
        while (sectPr.sizeOfHeaderReferenceArray() > 0) {
            sectPr.removeHeaderReference(0);
        }
        while (sectPr.sizeOfFooterReferenceArray() > 0) {
            sectPr.removeFooterReference(0);
        }
        if (headerId != null) {
            var ref = sectPr.addNewHeaderReference();
            ref.setType(org.openxmlformats.schemas.wordprocessingml.x2006.main.STHdrFtr.DEFAULT);
            ref.setId(headerId);
        }
        if (footerId != null) {
            var ref = sectPr.addNewFooterReference();
            ref.setType(org.openxmlformats.schemas.wordprocessingml.x2006.main.STHdrFtr.DEFAULT);
            ref.setId(footerId);
        }
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
        return onlyOfficeDocumentEditService.convertLocalFileToPdf(path, fileName);
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

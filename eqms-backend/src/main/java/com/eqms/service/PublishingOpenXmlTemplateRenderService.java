package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.publishing.PublishingTemplatePlaceholderMappingResponse;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFHeaderFooter;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPictureData;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.apache.xmlbeans.impl.xb.xmlschema.SpaceAttribute;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTHdrFtr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTShd;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblBorders;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTText;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STFldCharType;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STShd;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.stream.Collectors;

@Service
public class PublishingOpenXmlTemplateRenderService {

    private final PublishingTemplatePlaceholderMapperService placeholderMapperService;
    private final ElectronicSignatureService electronicSignatureService;
    private static final String SIGNATURE_FONT_FAMILY = "Arial";

    private record RunSnapshot(String text, CTRPr style) {
    }

    public PublishingOpenXmlTemplateRenderService(
            PublishingTemplatePlaceholderMapperService placeholderMapperService,
            ElectronicSignatureService electronicSignatureService
    ) {
        this.placeholderMapperService = placeholderMapperService;
        this.electronicSignatureService = electronicSignatureService;
    }

    public Path renderDocxTemplate(Path sourcePath, String fileName, RevisionDetailResponse revision) throws IOException {
        return renderDocxTemplate(sourcePath, fileName, revision, Map.of());
    }

    public Path renderDocxTemplate(Path sourcePath, String fileName, RevisionDetailResponse revision, Map<String, String> extraValues) throws IOException {
        return renderDocxTemplate(sourcePath, fileName, revision, extraValues, true);
    }

    public Path renderDocxTemplate(
            Path sourcePath,
            String fileName,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            boolean keepBodyContent
    ) throws IOException {
        return renderDocxTemplate(sourcePath, fileName, revision, extraValues, keepBodyContent, false);
    }

    public Path renderDocxTemplate(
            Path sourcePath,
            String fileName,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            boolean keepBodyContent,
            boolean dynamicPageLabel
    ) throws IOException {
        return renderDocxTemplate(sourcePath, fileName, revision, extraValues, keepBodyContent, dynamicPageLabel, null, null, null);
    }

    public Path renderDocxTemplate(
            Path sourcePath,
            String fileName,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            boolean keepBodyContent,
            boolean dynamicPageLabel,
            String previewPlaceholderKey,
            String previewText,
            Double previewFontSize
    ) throws IOException {
        return renderDocxTemplate(
                sourcePath,
                fileName,
                revision,
                extraValues,
                keepBodyContent,
                dynamicPageLabel,
                previewPlaceholderKey,
                previewText,
                previewFontSize,
                false
        );
    }

    public Path renderDocxTemplate(
            Path sourcePath,
            String fileName,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            boolean keepBodyContent,
            boolean dynamicPageLabel,
            String previewPlaceholderKey,
            String previewText,
            Double previewFontSize,
            boolean exactPreview
    ) throws IOException {
        return renderDocxTemplate(
                sourcePath,
                fileName,
                revision,
                extraValues,
                keepBodyContent,
                dynamicPageLabel,
                previewPlaceholderKey,
                previewText,
                previewFontSize,
                exactPreview,
                Map.of()
        );
    }

    public Path renderDocxTemplate(
            Path sourcePath,
            String fileName,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            boolean keepBodyContent,
            boolean dynamicPageLabel,
            String previewPlaceholderKey,
            String previewText,
            Double previewFontSize,
            boolean exactPreview,
            Map<String, PublishingPlaceholderStyleConfig> placeholderStyles
    ) throws IOException {
        if (sourcePath == null || !Files.exists(sourcePath) || !isDocx(sourcePath, fileName)) {
            return sourcePath;
        }

        try (InputStream input = Files.newInputStream(sourcePath); XWPFDocument document = new XWPFDocument(input)) {
            Map<String, String> values = resolveValues(document, revision, extraValues);
            PublishingPlaceholderSyntax.PlaceholderToken previewToken = PublishingPlaceholderSyntax.parse(previewPlaceholderKey);
            String normalizedPreviewPlaceholderKey = previewToken == null ? null : previewToken.key();
            if (StringUtils.hasText(normalizedPreviewPlaceholderKey) && StringUtils.hasText(previewText)) {
                values.put(
                        normalizedPreviewPlaceholderKey,
                        PublishingPlaceholderSyntax.applyTransform(previewText, previewToken == null ? null : previewToken.transform())
                );
            }
            if (values.isEmpty()) {
                if (!keepBodyContent) {
                    stripBodyContent(document);
                    Path rendered = Files.createTempFile("publishing-template-rendered-", ".docx");
                    rendered.toFile().deleteOnExit();
                    try (OutputStream output = Files.newOutputStream(rendered)) {
                        document.write(output);
                    }
                    return rendered;
                }
                return sourcePath;
            }

            replaceDocumentText(
                    document,
                    values,
                    dynamicPageLabel,
                    pageOffset(extraValues),
                    !keepBodyContent,
                    normalizedPreviewPlaceholderKey,
                    previewFontSize,
                    exactPreview,
                    placeholderStyles == null ? Map.of() : placeholderStyles
            );
            if (!keepBodyContent) {
                stripBodyContent(document);
            }
            Path rendered = Files.createTempFile("publishing-template-rendered-", ".docx");
            rendered.toFile().deleteOnExit();
            try (OutputStream output = Files.newOutputStream(rendered)) {
                document.write(output);
            }
            return rendered;
        }
    }

    public Path renderSourceWithHeaderFooter(
            Path sourcePath,
            String sourceFileName,
            Path headerTemplatePath,
            String headerFileName,
            Path footerTemplatePath,
            String footerFileName,
            RevisionDetailResponse revision,
            Map<String, String> extraValues,
            Map<String, PublishingPlaceholderStyleConfig> headerStyles,
            Map<String, PublishingPlaceholderStyleConfig> footerStyles
    ) throws IOException {
        if (sourcePath == null || !Files.exists(sourcePath) || !isDocx(sourcePath, sourceFileName)) {
            return sourcePath;
        }

        Path renderedHeaderPath = renderDocxTemplate(headerTemplatePath, headerFileName, revision, extraValues == null ? Map.of() : extraValues, false, true, null, null, null, false, headerStyles == null ? Map.of() : headerStyles);
        Path renderedFooterPath = renderDocxTemplate(footerTemplatePath, footerFileName, revision, extraValues == null ? Map.of() : extraValues, false, true, null, null, null, false, footerStyles == null ? Map.of() : footerStyles);

        try (InputStream input = Files.newInputStream(sourcePath);
             XWPFDocument document = new XWPFDocument(input)) {
            if (renderedHeaderPath != null && Files.exists(renderedHeaderPath) && isDocx(renderedHeaderPath, headerFileName)) {
                try (InputStream headerInput = Files.newInputStream(renderedHeaderPath);
                     XWPFDocument headerDocument = new XWPFDocument(headerInput)) {
                    XWPFHeader sourceHeader = firstHeader(headerDocument);
                    if (sourceHeader != null) {
                        applyHeader(document, sourceHeader);
                    }
                }
            }

            if (renderedFooterPath != null && Files.exists(renderedFooterPath) && isDocx(renderedFooterPath, footerFileName)) {
                try (InputStream footerInput = Files.newInputStream(renderedFooterPath);
                     XWPFDocument footerDocument = new XWPFDocument(footerInput)) {
                    XWPFFooter sourceFooter = firstFooter(footerDocument);
                    if (sourceFooter != null) {
                        applyFooter(document, sourceFooter);
                    }
                }
            }

            Path rendered = Files.createTempFile("publishing-source-with-header-footer-", ".docx");
            rendered.toFile().deleteOnExit();
            try (OutputStream output = Files.newOutputStream(rendered)) {
                document.write(output);
            }
            return rendered;
        }
    }

    private Map<String, String> resolveValues(XWPFDocument document, RevisionDetailResponse revision, Map<String, String> extraValues) {
        List<String> placeholders = extractVariables(document);
        Map<String, String> mapped = placeholderMapperService.mapPlaceholders(placeholders, revision).stream()
                .collect(Collectors.toMap(
                        item -> item.placeholder().toLowerCase(Locale.ROOT),
                        PublishingTemplatePlaceholderMappingResponse::sampleValue,
                        (first, second) -> first
                ));
        if (extraValues != null && !extraValues.isEmpty()) {
            extraValues.forEach((key, value) -> {
                if (StringUtils.hasText(key)) {
                    mapped.put(key.toLowerCase(Locale.ROOT), value == null ? "-" : value);
                }
            });
        }
        if (revision != null && StringUtils.hasText(revision.id())) {
            try {
                mapped.putAll(electronicSignatureService.signaturePlaceholderValues(revision, placeholders));
            } catch (IllegalArgumentException ex) {
                throw new IllegalStateException("Invalid revision id while resolving electronic signature placeholders", ex);
            }
        }
        return mapped;
    }

    private List<String> extractVariables(XWPFDocument document) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        document.getParagraphs().forEach(paragraph -> collectVariables(paragraph.getText(), values));
        document.getTables().forEach(table -> collectTableVariables(table, values));
        document.getHeaderList().forEach(header -> {
            header.getParagraphs().forEach(paragraph -> collectVariables(paragraph.getText(), values));
            header.getTables().forEach(table -> collectTableVariables(table, values));
        });
        document.getFooterList().forEach(footer -> {
            footer.getParagraphs().forEach(paragraph -> collectVariables(paragraph.getText(), values));
            footer.getTables().forEach(table -> collectTableVariables(table, values));
        });
        return values.stream().toList();
    }

    private void collectTableVariables(XWPFTable table, LinkedHashSet<String> values) {
        table.getRows().forEach(row -> row.getTableCells().forEach(cell -> {
            cell.getParagraphs().forEach(paragraph -> collectVariables(paragraph.getText(), values));
            cell.getTables().forEach(nested -> collectTableVariables(nested, values));
        }));
    }

    private void collectVariables(String text, LinkedHashSet<String> values) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            values.add(PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2)));
        }
    }

    private void replaceDocumentText(
            XWPFDocument document,
            Map<String, String> values,
            boolean dynamicPageLabel,
            int pageOffset,
            boolean autoFitLongText,
            String previewPlaceholderKey,
            Double previewFontSize,
            boolean exactPreview,
            Map<String, PublishingPlaceholderStyleConfig> placeholderStyles
    ) {
        document.getParagraphs().forEach(paragraph -> replaceParagraphText(paragraph, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
        document.getTables().forEach(table -> replaceTableText(table, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
        document.getHeaderList().forEach(header -> {
            header.getParagraphs().forEach(paragraph -> replaceParagraphText(paragraph, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
            header.getTables().forEach(table -> replaceTableText(table, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
        });
        document.getFooterList().forEach(footer -> {
            footer.getParagraphs().forEach(paragraph -> replaceParagraphText(paragraph, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
            footer.getTables().forEach(table -> replaceTableText(table, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
        });
        replaceXmlText(document.getDocument(), values);
        document.getHeaderList().forEach(header -> replaceXmlText(header._getHdrFtr(), values));
        document.getFooterList().forEach(footer -> replaceXmlText(footer._getHdrFtr(), values));
    }

    private void replaceTableText(
            XWPFTable table,
            Map<String, String> values,
            boolean dynamicPageLabel,
            int pageOffset,
            boolean autoFitLongText,
            String previewPlaceholderKey,
            Double previewFontSize,
            boolean exactPreview,
            Map<String, PublishingPlaceholderStyleConfig> placeholderStyles
    ) {
        table.getRows().forEach(row -> row.getTableCells().forEach(cell -> {
            cell.getParagraphs().forEach(paragraph -> replaceParagraphText(paragraph, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
            cell.getTables().forEach(nested -> replaceTableText(nested, values, dynamicPageLabel, pageOffset, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles));
        }));
    }

    private void replaceParagraphText(
            XWPFParagraph paragraph,
            Map<String, String> values,
            boolean dynamicPageLabel,
            int pageOffset,
            boolean autoFitLongText,
            String previewPlaceholderKey,
            Double previewFontSize,
            boolean exactPreview,
            Map<String, PublishingPlaceholderStyleConfig> placeholderStyles
    ) {
        String paragraphText = paragraph.getText();
        if (!StringUtils.hasText(paragraphText) || !PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraphText).find()) {
            return;
        }
        List<RunSnapshot> sourceRuns = snapshotRuns(paragraph);

        if (dynamicPageLabel && containsPageLabel(paragraphText)) {
            replaceParagraphWithDynamicPageLabel(paragraph, paragraphText, values, pageOffset, sourceRuns, autoFitLongText, placeholderStyles);
            return;
        }

        boolean requiresSizingAwareRebuild =
                containsFontSizeInstruction(paragraphText)
                        || containsSignaturePlaceholder(paragraphText)
                        || containsStyledPlaceholder(paragraphText, placeholderStyles)
                        || (!exactPreview && StringUtils.hasText(previewPlaceholderKey) && previewFontSize != null && containsPlaceholderKey(paragraphText, previewPlaceholderKey));
        boolean replacedInRuns = false;
        if (!requiresSizingAwareRebuild) {
            for (XWPFRun run : paragraph.getRuns()) {
                String text = run.getText(0);
                if (text == null) {
                    continue;
                }
                String replaced = replacePlaceholders(text, values);
                if (!text.equals(replaced)) {
                    run.setText(replaced, 0);
                    replacedInRuns = true;
                }
            }
        }

        if (replacedInRuns && !PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraph.getText()).find()) {
            return;
        }

        String replacedParagraph = replacePlaceholders(paragraphText, values);
        if (rebuildParagraphPreservingStyles(paragraph, paragraphText, values, sourceRuns, autoFitLongText, previewPlaceholderKey, previewFontSize, exactPreview, placeholderStyles)) {
            return;
        }
        int runCount = paragraph.getRuns().size();
        for (int i = runCount - 1; i >= 0; i--) {
            paragraph.removeRun(i);
        }
        appendStyledText(paragraph, replacedParagraph, firstStyle(sourceRuns), autoFitLongText, null, null, exactPreview, null);
    }

    private boolean containsPageLabel(String text) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            String key = PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2));
            if ("pagelabel".equals(key)) {
                return true;
            }
        }
        return false;
    }

    private void replaceParagraphWithDynamicPageLabel(XWPFParagraph paragraph, String paragraphText, Map<String, String> values, int pageOffset, List<RunSnapshot> sourceRuns, boolean autoFitLongText, Map<String, PublishingPlaceholderStyleConfig> placeholderStyles) {
        int runCount = paragraph.getRuns().size();
        for (int i = runCount - 1; i >= 0; i--) {
            paragraph.removeRun(i);
        }

        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraphText == null ? "" : paragraphText);
        int cursor = 0;
        while (matcher.find()) {
            appendOriginalRange(paragraph, sourceRuns, cursor, matcher.start());
            String key = PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2));
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(matcher.group(1), matcher.group(2));
            String transform = token == null ? null : token.transform();
            CTRPr style = styleAt(sourceRuns, matcher.start(), matcher.end());
            if ("pagelabel".equals(key)) {
                appendDynamicPageLabel(paragraph, pageOffset, style, autoFitLongText, transform);
            } else {
                appendStyledText(paragraph, values.getOrDefault(key, "-"), style, autoFitLongText, transform, null, false, resolveStyle(placeholderStyles, key));
            }
            cursor = matcher.end();
        }
        appendOriginalRange(paragraph, sourceRuns, cursor, paragraphText == null ? 0 : paragraphText.length());
    }

    private boolean rebuildParagraphPreservingStyles(
            XWPFParagraph paragraph,
            String paragraphText,
            Map<String, String> values,
            List<RunSnapshot> sourceRuns,
            boolean autoFitLongText,
            String previewPlaceholderKey,
            Double previewFontSize,
            boolean exactPreview,
            Map<String, PublishingPlaceholderStyleConfig> placeholderStyles
    ) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(paragraphText == null ? "" : paragraphText);
        if (!matcher.find()) {
            return false;
        }

        int runCount = paragraph.getRuns().size();
        for (int i = runCount - 1; i >= 0; i--) {
            paragraph.removeRun(i);
        }

        matcher.reset();
        int cursor = 0;
        while (matcher.find()) {
            appendOriginalRange(paragraph, sourceRuns, cursor, matcher.start());
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(matcher.group(1), matcher.group(2));
            String key = token == null ? null : token.key();
            String transform = token == null ? null : token.transform();
            boolean isPreviewTarget = StringUtils.hasText(previewPlaceholderKey) && previewPlaceholderKey.equalsIgnoreCase(key);
            Double explicitFontSize = PublishingPlaceholderSyntax.extractFontSize(transform);
            PublishingPlaceholderStyleConfig styleConfig = resolveStyle(placeholderStyles, key);
            Double styledFontSize = styleConfig == null ? null : styleConfig.fontSizePt();
            String styledFontFamily = styleConfig == null ? null : styleConfig.fontFamily();
            if (styleConfig != null && styleConfig.fontSizePt() != null) {
                explicitFontSize = styleConfig.fontSizePt();
            }
            Double effectivePreviewFontSize = (!exactPreview && isPreviewTarget && explicitFontSize == null) ? previewFontSize : null;
            if (effectivePreviewFontSize == null && explicitFontSize == null && key != null && key.toLowerCase(Locale.ROOT).contains("signature")) {
                effectivePreviewFontSize = electronicSignatureService.getDisplayFontSizePt();
            }
            String replacementValue = values.getOrDefault(key, "-");
            CTRPr replacementStyle = styleAt(sourceRuns, matcher.start(), matcher.end());
            if (isSignatureKey(key) && insertSignatureBlocks(paragraph, replacementValue, transform, effectivePreviewFontSize, exactPreview, styleConfig)) {
                // Signature placeholders render as Word tables so Graph/PDF output is the visual source of truth.
            } else {
                String textValue = isSignatureKey(key) ? stripSignatureMeaningLine(replacementValue) : replacementValue;
                appendStyledText(
                        paragraph,
                        textValue,
                        replacementStyle,
                        autoFitLongText,
                        transform,
                        effectivePreviewFontSize,
                        exactPreview,
                        styleConfig
                );
            }
            cursor = matcher.end();
        }
        appendOriginalRange(paragraph, sourceRuns, cursor, paragraphText == null ? 0 : paragraphText.length());
        return true;
    }

    private boolean isSignatureKey(String key) {
        return key != null && key.toLowerCase(Locale.ROOT).contains("signature");
    }

    /**
     * When a signature placeholder falls back to compact plain text inside a table cell (see
     * insertSignatureBlocks), the "Meaning: ..." line is redundant with the table's own
     * row/column label (e.g. a "Prepared by" column) and the fixed cell height often can't fit
     * the full multi-line block, causing it to overflow into the next row. Drop it; keep
     * "Reason" since it carries the actual GMP audit-trail content and appears nowhere else.
     */
    private String stripSignatureMeaningLine(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value.lines()
                .filter(line -> !line.trim().toLowerCase(Locale.ROOT).startsWith("meaning:"))
                .collect(Collectors.joining("\n"));
    }

    private boolean insertSignatureBlocks(XWPFParagraph anchorParagraph, String value, String transform, Double previewFontSize, boolean exactPreview, PublishingPlaceholderStyleConfig styleConfig) {
        if (!StringUtils.hasText(value) || "-".equals(value.trim())) {
            return false;
        }
        // Status tables in controlled cover templates already provide the visual grid.
        // Adding a nested table inside one of their cells changes the OpenXML cursor and
        // can spill the first signature into the following "Name" row.  Preserve the
        // canonical multiline signature text in that cell instead.
        if (anchorParagraph.getBody() instanceof XWPFTableCell) {
            return false;
        }
        Double explicitFontSize = PublishingPlaceholderSyntax.extractFontSize(transform);
        if (styleConfig != null && styleConfig.fontSizePt() != null) {
            explicitFontSize = styleConfig.fontSizePt();
        }
        double fontSize = normalizeSignatureFontSize(explicitFontSize != null ? explicitFontSize : previewFontSize);
        List<String> blocks = splitSignatureBlocks(value);
        if (blocks.isEmpty()) {
            return false;
        }
        try {
            clearParagraph(anchorParagraph);
            for (int i = 0; i < blocks.size(); i++) {
                if (i > 0) {
                    insertSignatureSpacer(anchorParagraph);
                }
                insertSignatureTable(anchorParagraph, blocks.get(i), fontSize, exactPreview, styleConfig);
            }
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private List<String> splitSignatureBlocks(String value) {
        String normalized = value == null ? "" : value.replace("\r\n", "\n").replace('\r', '\n').trim();
        if (!StringUtils.hasText(normalized)) {
            return List.of();
        }
        List<String> blocks = new ArrayList<>();
        for (String block : normalized.split("\\n\\s*\\n")) {
            if (StringUtils.hasText(block)) {
                blocks.add(block.trim());
            }
        }
        return blocks;
    }

    private void clearParagraph(XWPFParagraph paragraph) {
        int runCount = paragraph.getRuns().size();
        for (int i = runCount - 1; i >= 0; i--) {
            paragraph.removeRun(i);
        }
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
    }

    private void insertSignatureSpacer(XWPFParagraph anchorParagraph) {
        XWPFParagraph spacer = anchorParagraph.getBody().insertNewParagraph(cursorAfter(anchorParagraph));
        if (spacer != null) {
            spacer.setSpacingBefore(0);
            spacer.setSpacingAfter(80);
        }
    }

    private void insertSignatureTable(XWPFParagraph anchorParagraph, String block, double fontSize, boolean exactPreview, PublishingPlaceholderStyleConfig styleConfig) {
        XWPFTable table = anchorParagraph.getBody().insertNewTbl(cursorAfter(anchorParagraph));
        if (table == null) {
            throw new IllegalStateException("Unable to insert signature table");
        }
        table.setWidth("100%");
        table.setCellMargins(80, 100, 80, 100);
        applyTableBorders(table, "94A3B8");

        String style = normalizeSignatureTableStyle(electronicSignatureService.getDisplayStyle());
        SignatureBlockParts parts = parseSignatureBlock(block);
        String fontFamily = styleConfig != null && StringUtils.hasText(styleConfig.fontFamily())
                ? styleConfig.fontFamily()
                : SIGNATURE_FONT_FAMILY;
        boolean bold = styleConfig != null && Boolean.TRUE.equals(styleConfig.bold());
        boolean italic = styleConfig != null && Boolean.TRUE.equals(styleConfig.italic());
        boolean underline = styleConfig != null && Boolean.TRUE.equals(styleConfig.underline());
        String alignment = styleConfig == null ? null : styleConfig.alignment();
        if ("TABLE_CELL".equals(style)) {
            buildSignatureKeyValueTable(table, parts, fontSize, fontFamily, bold, italic, underline, alignment);
        } else {
            buildSignatureCardTable(table, parts, fontSize, "COMPACT_TABLE".equals(style), fontFamily, bold, italic, underline, alignment);
        }
    }

    private XmlCursor cursorAfter(XWPFParagraph paragraph) {
        XmlCursor cursor = paragraph.getCTP().newCursor();
        cursor.toEndToken();
        return cursor;
    }

    private SignatureBlockParts parseSignatureBlock(String block) {
        List<String> rawLines = block == null ? List.of() : block.lines()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
        String statusLine = rawLines.stream()
                .filter(this::isSignatureStatusLine)
                .findFirst()
                .orElse("");
        String normalizedStatus = normalizeSignatureStatus(statusLine);
        List<String> bodyLines = rawLines.stream()
                .filter(line -> !line.equals(statusLine))
                .toList();
        return new SignatureBlockParts(normalizedStatus, statusLabel(normalizedStatus), statusIcon(normalizedStatus), bodyLines);
    }

    private boolean isSignatureStatusLine(String line) {
        String normalized = line == null ? "" : line.toLowerCase(Locale.ROOT);
        return normalized.contains("electronically signed")
                || normalized.contains("pending signature")
                || normalized.contains("awaiting")
                || normalized.contains("signature invalid");
    }

    private String normalizeSignatureStatus(String statusLine) {
        String normalized = statusLine == null ? "" : statusLine.toLowerCase(Locale.ROOT);
        if (normalized.contains("invalid")) {
            return "INVALID";
        }
        if (normalized.contains("pending") || normalized.contains("awaiting")) {
            return "PENDING";
        }
        return "SIGNED";
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "PENDING" -> "AWAITING SIGNATURE";
            case "INVALID" -> "SIGNATURE INVALID";
            default -> "ELECTRONICALLY SIGNED";
        };
    }

    private String statusIcon(String status) {
        return switch (status) {
            case "PENDING" -> "!";
            case "INVALID" -> "X";
            default -> "\u2713";
        };
    }

    private String statusBackground(String status) {
        return switch (status) {
            case "PENDING" -> "FFFBEB";
            case "INVALID" -> "FEF2F2";
            default -> "ECFDF5";
        };
    }

    private String statusColor(String status) {
        return switch (status) {
            case "PENDING" -> "B45309";
            case "INVALID" -> "DC2626";
            default -> "047857";
        };
    }

    private void buildSignatureCardTable(XWPFTable table, SignatureBlockParts parts, double fontSize, boolean compact, String fontFamily, boolean forceBold, boolean italic, boolean underline, String alignment) {
        XWPFTableRow statusRow = table.getRow(0);
        XWPFTableCell statusCell = statusRow.getCell(0);
        styleCell(statusCell, statusBackground(parts.status()));
        writeCellLine(statusCell, parts.icon() + " " + parts.label(), fontSize, true, statusColor(parts.status()), true, fontFamily, italic, underline, alignment);

        List<String> lines = compact ? compactLines(parts.lines()) : parts.lines();
        for (String line : lines) {
            XWPFTableRow row = table.createRow();
            XWPFTableCell cell = row.getCell(0);
            styleCell(cell, "FFFFFF");
            boolean primaryLine = isPrimarySignerLine(line);
            writeCellLine(cell, line, fontSize, primaryLine || forceBold, primaryLine ? "0F172A" : "334155", false, fontFamily, italic, underline, alignment);
        }
    }

    private void buildSignatureKeyValueTable(XWPFTable table, SignatureBlockParts parts, double fontSize, String fontFamily, boolean bold, boolean italic, boolean underline, String alignment) {
        XWPFTableRow statusRow = table.getRow(0);
        XWPFTableCell statusLabelCell = statusRow.getCell(0);
        XWPFTableCell statusValueCell = statusRow.addNewTableCell();
        styleCell(statusLabelCell, statusBackground(parts.status()));
        styleCell(statusValueCell, statusBackground(parts.status()));
        writeCellLine(statusLabelCell, parts.icon(), fontSize, true, statusColor(parts.status()), true, fontFamily, italic, underline, alignment);
        writeCellLine(statusValueCell, parts.label(), fontSize, true, statusColor(parts.status()), true, fontFamily, italic, underline, alignment);

        for (String line : parts.lines()) {
            String[] pair = splitSignatureLine(line);
            XWPFTableRow row = table.createRow();
            XWPFTableCell labelCell = row.getCell(0);
            XWPFTableCell valueCell = row.getCell(1);
            styleCell(labelCell, "F8FAFC");
            styleCell(valueCell, "FFFFFF");
            writeCellLine(labelCell, pair[0], fontSize, true, "475569", false, fontFamily, italic, underline, alignment);
            writeCellLine(valueCell, pair[1], fontSize, false, "334155", false, fontFamily, italic, underline, alignment);
        }
    }

    private List<String> compactLines(List<String> lines) {
        if (lines == null || lines.size() <= 5) {
            return lines == null ? List.of() : lines;
        }
        return lines.stream()
                .filter(line -> isPrimarySignerLine(line)
                        || line.toLowerCase(Locale.ROOT).contains("signed")
                        || line.toLowerCase(Locale.ROOT).contains("meaning")
                        || line.toLowerCase(Locale.ROOT).contains("signature id"))
                .toList();
    }

    private boolean isPrimarySignerLine(String line) {
        if (!StringUtils.hasText(line)) {
            return false;
        }
        String normalized = line.toLowerCase(Locale.ROOT);
        return !normalized.contains(":")
                && !normalized.contains("@")
                && !normalized.contains("pending")
                && !normalized.contains("signature")
                && !normalized.contains("signed at");
    }

    private String[] splitSignatureLine(String line) {
        if (!StringUtils.hasText(line)) {
            return new String[]{"Field", "-"};
        }
        int separator = line.indexOf(':');
        if (separator > 0) {
            return new String[]{line.substring(0, separator).trim(), line.substring(separator + 1).trim()};
        }
        return isPrimarySignerLine(line) ? new String[]{"Name", line} : new String[]{"Info", line};
    }

    private void styleCell(XWPFTableCell cell, String fill) {
        if (cell == null) {
            return;
        }
        cell.setColor(fill);
        if (cell.getCTTc().isSetTcPr()) {
            CTShd shd = cell.getCTTc().getTcPr().isSetShd() ? cell.getCTTc().getTcPr().getShd() : cell.getCTTc().getTcPr().addNewShd();
            shd.setVal(STShd.CLEAR);
            shd.setFill(fill);
        }
    }

    private void writeCellLine(XWPFTableCell cell, String text, double fontSize, boolean bold, String color, boolean uppercase, String fontFamily, boolean italic, boolean underline, String alignment) {
        clearCellParagraphs(cell);
        XWPFParagraph paragraph = cell.addParagraph();
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
        applyAlignment(paragraph, alignment);
        XWPFRun run = paragraph.createRun();
        run.setFontFamily(StringUtils.hasText(fontFamily) ? fontFamily : SIGNATURE_FONT_FAMILY);
        run.setFontSize(fontSize);
        run.setBold(bold);
        run.setItalic(italic);
        run.setUnderline(underline ? org.apache.poi.xwpf.usermodel.UnderlinePatterns.SINGLE : org.apache.poi.xwpf.usermodel.UnderlinePatterns.NONE);
        run.setColor(color);
        run.setText(uppercase ? valueOrDash(text).toUpperCase(Locale.ROOT) : valueOrDash(text));
    }

    private void clearCellParagraphs(XWPFTableCell cell) {
        if (cell == null) {
            return;
        }
        for (int i = cell.getParagraphs().size() - 1; i >= 0; i--) {
            cell.removeParagraph(i);
        }
    }

    private void applyTableBorders(XWPFTable table, String color) {
        CTTblPr tblPr = table.getCTTbl().getTblPr() == null ? table.getCTTbl().addNewTblPr() : table.getCTTbl().getTblPr();
        CTTblBorders borders = tblPr.isSetTblBorders() ? tblPr.getTblBorders() : tblPr.addNewTblBorders();
        setBorder(borders.isSetTop() ? borders.getTop() : borders.addNewTop(), color);
        setBorder(borders.isSetBottom() ? borders.getBottom() : borders.addNewBottom(), color);
        setBorder(borders.isSetLeft() ? borders.getLeft() : borders.addNewLeft(), color);
        setBorder(borders.isSetRight() ? borders.getRight() : borders.addNewRight(), color);
        setBorder(borders.isSetInsideH() ? borders.getInsideH() : borders.addNewInsideH(), "E2E8F0");
        setBorder(borders.isSetInsideV() ? borders.getInsideV() : borders.addNewInsideV(), "E2E8F0");
    }

    private void setBorder(org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBorder border, String color) {
        border.setVal(STBorder.SINGLE);
        border.setSz(BigInteger.valueOf(6));
        border.setColor(color);
    }

    private double normalizeSignatureFontSize(Double value) {
        if (value == null || value.isNaN() || value.isInfinite()) {
            return 8.5;
        }
        return Math.max(8.0, Math.min(10.0, value));
    }

    private String normalizeSignatureTableStyle(String style) {
        String normalized = StringUtils.hasText(style) ? style.trim().toUpperCase(Locale.ROOT) : "DETAILED_TABLE";
        return switch (normalized) {
            case "COMPACT", "COMPACT_TABLE" -> "COMPACT_TABLE";
            case "TABLE_CELL" -> "TABLE_CELL";
            default -> "DETAILED_TABLE";
        };
    }

    private String valueOrDash(String value) {
        return StringUtils.hasText(value) ? value : "-";
    }

    private record SignatureBlockParts(String status, String label, String icon, List<String> lines) {
    }

    private void appendDynamicPageLabel(XWPFParagraph paragraph, int pageOffset, CTRPr style, boolean autoFitLongText, String transform) {
        appendPageNumberField(paragraph, "PAGE", pageOffset, style, transform);
        appendStyledText(paragraph, "/", style, autoFitLongText, transform, null, false, null);
        appendPageNumberField(paragraph, "NUMPAGES", pageOffset, style, transform);
    }

    private void appendPageNumberField(XWPFParagraph paragraph, String fieldName, int pageOffset, CTRPr style, String transform) {
        if (pageOffset <= 0) {
            appendSimpleField(paragraph, fieldName, style, transform);
            return;
        }
        appendFormulaField(paragraph, fieldName, pageOffset, style, transform);
    }

    private void appendSimpleField(XWPFParagraph paragraph, String instruction, CTRPr style, String transform) {
        XWPFRun beginRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(beginRun, transform);
        beginRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.BEGIN);
        appendInstructionText(paragraph, instruction, style, transform);
        XWPFRun separateRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(separateRun, transform);
        separateRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.SEPARATE);
        appendStyledText(paragraph, "-", style, false, transform, null, false, null);
        XWPFRun endRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(endRun, transform);
        endRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.END);
    }

    private void appendFormulaField(XWPFParagraph paragraph, String nestedFieldName, int offset, CTRPr style, String transform) {
        XWPFRun beginRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(beginRun, transform);
        beginRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.BEGIN);
        appendInstructionText(paragraph, "= ", style, transform);
        XWPFRun nestedBeginRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(nestedBeginRun, transform);
        nestedBeginRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.BEGIN);
        appendInstructionText(paragraph, nestedFieldName, style, transform);
        XWPFRun nestedSeparateRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(nestedSeparateRun, transform);
        nestedSeparateRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.SEPARATE);
        appendStyledText(paragraph, "-", style, false, transform, null, false, null);
        XWPFRun nestedEndRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(nestedEndRun, transform);
        nestedEndRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.END);
        appendInstructionText(paragraph, " + " + offset, style, transform);
        XWPFRun outerSeparateRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(outerSeparateRun, transform);
        outerSeparateRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.SEPARATE);
        appendStyledText(paragraph, "-", style, false, transform, null, false, null);
        XWPFRun outerEndRun = createStyledRun(paragraph, style);
        applyExplicitFontSize(outerEndRun, transform);
        outerEndRun.getCTR().addNewFldChar().setFldCharType(STFldCharType.END);
    }

    private void appendInstructionText(XWPFParagraph paragraph, String text, CTRPr style, String transform) {
        XWPFRun run = createStyledRun(paragraph, style);
        applyExplicitFontSize(run, transform);
        CTText instruction = run.getCTR().addNewInstrText();
        instruction.setStringValue(text == null ? "" : text);
        instruction.setSpace(SpaceAttribute.Space.PRESERVE);
    }

    private void appendPlainText(XWPFParagraph paragraph, String text) {
        if (text == null || text.isEmpty()) {
            return;
        }
        paragraph.createRun().setText(text);
    }

    private void appendStyledText(XWPFParagraph paragraph, String text, CTRPr style, boolean autoFitLongText, String transform, Double previewFontSize, boolean exactPreview, PublishingPlaceholderStyleConfig styleConfig) {
        if (text == null || text.isEmpty()) {
            return;
        }
        String normalizedText = text.replace("\r\n", "\n").replace('\r', '\n');
        normalizedText = applyStyleTransform(normalizedText, transform, styleConfig);
        if (styleConfig != null && Boolean.FALSE.equals(styleConfig.preserveLineBreaks())) {
            normalizedText = normalizedText.replace("\n", " ");
        }
        String[] lines = normalizedText.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) {
                appendStyledBreak(paragraph, style, transform, previewFontSize, exactPreview, styleConfig);
            }
            String line = lines[i];
            if (!StringUtils.hasText(line)) {
                continue;
            }
            XWPFRun run = createStyledRun(paragraph, style);
            applyRunStyleOverrides(run, paragraph, styleConfig, transform);
            run.setText(line);
            Double effectiveFontSize = resolveFontSize(previewFontSize, exactPreview, styleConfig, transform, line);
            if (effectiveFontSize != null) {
                run.setFontSize(effectiveFontSize);
                continue;
            }
            applyTextSizingRules(run, line, autoFitLongText, transform, exactPreview);
        }
    }

    private void appendStyledBreak(XWPFParagraph paragraph, CTRPr style, String transform, Double previewFontSize, boolean exactPreview, PublishingPlaceholderStyleConfig styleConfig) {
        XWPFRun breakRun = createStyledRun(paragraph, style);
        applyRunStyleOverrides(breakRun, paragraph, styleConfig, transform);
        Double effectiveFontSize = resolveFontSize(previewFontSize, exactPreview, styleConfig, transform, "");
        if (effectiveFontSize != null) {
            breakRun.setFontSize(effectiveFontSize);
        }
        breakRun.addBreak();
    }

    private XWPFRun createStyledRun(XWPFParagraph paragraph, CTRPr style) {
        XWPFRun run = paragraph.createRun();
        if (style != null) {
            CTRPr copied = (CTRPr) style.copy();
            run.getCTR().setRPr(copied);
            preserveFontFamily(run, copied);
        }
        return run;
    }

    private List<RunSnapshot> snapshotRuns(XWPFParagraph paragraph) {
        return paragraph.getRuns().stream()
                .map(run -> new RunSnapshot(run.getText(0) == null ? "" : run.getText(0), run.getCTR().isSetRPr() ? (CTRPr) run.getCTR().getRPr().copy() : null))
                .toList();
    }

    private void appendOriginalRange(XWPFParagraph paragraph, List<RunSnapshot> sourceRuns, int start, int end) {
        if (sourceRuns == null || sourceRuns.isEmpty() || end <= start) {
            return;
        }
        int cursor = 0;
        for (RunSnapshot sourceRun : sourceRuns) {
            String text = sourceRun.text();
            int runStart = cursor;
            int runEnd = cursor + text.length();
            int from = Math.max(start, runStart);
            int to = Math.min(end, runEnd);
            if (to > from) {
                appendStyledText(paragraph, text.substring(from - runStart, to - runStart), sourceRun.style(), false, null, null, false, null);
            }
            cursor = runEnd;
            if (cursor >= end) {
                break;
            }
        }
    }

    private CTRPr styleAt(List<RunSnapshot> sourceRuns, int start, int end) {
        if (sourceRuns == null || sourceRuns.isEmpty()) {
            return null;
        }
        int cursor = 0;
        CTRPr firstOverlappingStyle = null;
        for (RunSnapshot sourceRun : sourceRuns) {
            int runStart = cursor;
            int runEnd = cursor + sourceRun.text().length();
            if (runEnd > start && runStart < end) {
                CTRPr style = sourceRun.style();
                if (style != null && firstOverlappingStyle == null) {
                    firstOverlappingStyle = style;
                }
                if (hasBoldStyle(style)) {
                    return style;
                }
            }
            cursor = runEnd;
        }
        return firstOverlappingStyle != null ? firstOverlappingStyle : firstStyle(sourceRuns);
    }

    private boolean hasBoldStyle(CTRPr style) {
        return style != null && style.xmlText().matches("(?s).*<[^>]*:b(\\s|/|>).*");
    }

    private void applyTextSizingRules(XWPFRun run, String text, boolean autoFitLongText, String transform, boolean exactPreview) {
        if (run == null || !StringUtils.hasText(text)) {
            return;
        }
        Double explicitFontSize = PublishingPlaceholderSyntax.extractFontSize(transform);
        if (explicitFontSize != null) {
            run.setFontSize(explicitFontSize);
            return;
        }
        applyAutoFitToRun(run, text, autoFitLongText, exactPreview);
    }

    private boolean containsPlaceholderKey(String text, String previewPlaceholderKey) {
        if (!StringUtils.hasText(text) || !StringUtils.hasText(previewPlaceholderKey)) {
            return false;
        }
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text);
        while (matcher.find()) {
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(matcher.group(1), matcher.group(2));
            if (token != null && previewPlaceholderKey.equalsIgnoreCase(token.key())) {
                return true;
            }
        }
        return false;
    }

    private String normalizePreviewPlaceholderKey(String previewPlaceholderKey) {
        PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(previewPlaceholderKey);
        return token == null ? null : token.key();
    }

    private void applyExplicitFontSize(XWPFRun run, String transform) {
        if (run == null) {
            return;
        }
        Double explicitFontSize = PublishingPlaceholderSyntax.extractFontSize(transform);
        if (explicitFontSize != null) {
            run.setFontSize(explicitFontSize);
        }
    }

    private void applyExplicitFontFamily(XWPFRun run, String transform) {
        if (run == null) {
            return;
        }
        String explicitFontFamily = PublishingPlaceholderSyntax.extractFontFamily(transform);
        if (StringUtils.hasText(explicitFontFamily)) {
            run.setFontFamily(explicitFontFamily);
        }
    }

    private void applyRunStyleOverrides(XWPFRun run, XWPFParagraph paragraph, PublishingPlaceholderStyleConfig styleConfig, String transform) {
        if (run == null) {
            return;
        }
        String fontFamily = styleConfig != null && StringUtils.hasText(styleConfig.fontFamily())
                ? styleConfig.fontFamily().trim()
                : PublishingPlaceholderSyntax.extractFontFamily(transform);
        if (StringUtils.hasText(fontFamily)) {
            run.setFontFamily(fontFamily);
        }
        if (styleConfig != null && styleConfig.bold() != null) {
            run.setBold(Boolean.TRUE.equals(styleConfig.bold()));
        }
        if (styleConfig != null && styleConfig.italic() != null) {
            run.setItalic(Boolean.TRUE.equals(styleConfig.italic()));
        }
        if (styleConfig != null && styleConfig.underline() != null) {
            run.setUnderline(Boolean.TRUE.equals(styleConfig.underline())
                    ? org.apache.poi.xwpf.usermodel.UnderlinePatterns.SINGLE
                    : org.apache.poi.xwpf.usermodel.UnderlinePatterns.NONE);
        }
        if (styleConfig != null && StringUtils.hasText(styleConfig.color())) {
            String color = normalizeHexColor(styleConfig.color());
            if (StringUtils.hasText(color)) {
                run.setColor(color);
            }
        }
        if (styleConfig != null && StringUtils.hasText(styleConfig.alignment()) && paragraph != null) {
            applyAlignment(paragraph, styleConfig.alignment());
        }
    }

    private String applyStyleTransform(String value, String transform, PublishingPlaceholderStyleConfig styleConfig) {
        String transformed = value == null ? "" : value;
        if (styleConfig != null && styleConfig.transforms() != null && !styleConfig.transforms().isEmpty()) {
            transformed = applyTransforms(transformed, styleConfig.transforms());
        } else {
            transformed = PublishingPlaceholderSyntax.applyTransform(transformed, transform);
        }
        if (styleConfig != null) {
            if (StringUtils.hasText(styleConfig.dateFormat())) {
                transformed = formatDateValue(transformed, styleConfig.dateFormat());
            }
            if (StringUtils.hasText(styleConfig.numberFormat())) {
                transformed = formatNumberValue(transformed, styleConfig.numberFormat());
            }
        }
        return transformed;
    }

    private String applyTransforms(String value, List<String> transforms) {
        String result = value == null ? "" : value;
        if (transforms == null || transforms.isEmpty()) {
            return result;
        }
        for (String transform : transforms) {
            result = PublishingPlaceholderSyntax.applyTransform(result, transform);
        }
        return result;
    }

    private Double resolveFontSize(Double previewFontSize, boolean exactPreview, PublishingPlaceholderStyleConfig styleConfig, String transform, String text) {
        Double explicitFontSize = styleConfig != null && styleConfig.fontSizePt() != null ? styleConfig.fontSizePt() : PublishingPlaceholderSyntax.extractFontSize(transform);
        if (explicitFontSize != null && explicitFontSize > 0) {
            return explicitFontSize;
        }
        if (!exactPreview && previewFontSize != null && previewFontSize > 0) {
            return previewFontSize;
        }
        return null;
    }

    private String formatDateValue(String value, String format) {
        if (!StringUtils.hasText(value) || !StringUtils.hasText(format)) {
            return value;
        }
        try {
            java.time.LocalDate date = java.time.LocalDate.parse(value.trim(), java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            return date.format(java.time.format.DateTimeFormatter.ofPattern(format, Locale.ENGLISH));
        } catch (Exception ignored) {
        }
        try {
            java.time.LocalDate date = java.time.LocalDate.parse(value.trim(), java.time.format.DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH));
            return date.format(java.time.format.DateTimeFormatter.ofPattern(format, Locale.ENGLISH));
        } catch (Exception ignored) {
        }
        try {
            java.time.LocalDateTime dateTime = java.time.LocalDateTime.parse(value.trim(), java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
            return dateTime.format(java.time.format.DateTimeFormatter.ofPattern(format, Locale.ENGLISH));
        } catch (Exception ignored) {
        }
        return value;
    }

    private String formatNumberValue(String value, String format) {
        if (!StringUtils.hasText(value) || !StringUtils.hasText(format)) {
            return value;
        }
        try {
            java.math.BigDecimal number = new java.math.BigDecimal(value.trim());
            java.text.DecimalFormat decimalFormat = new java.text.DecimalFormat(format);
            return decimalFormat.format(number);
        } catch (Exception ignored) {
            return value;
        }
    }

    private void applyAlignment(XWPFParagraph paragraph, String alignment) {
        if (paragraph == null || !StringUtils.hasText(alignment)) {
            return;
        }
        try {
            paragraph.setAlignment(org.apache.poi.xwpf.usermodel.ParagraphAlignment.valueOf(alignment.trim().toUpperCase(Locale.ROOT)));
        } catch (Exception ignored) {
        }
    }

    private String normalizeHexColor(String color) {
        if (!StringUtils.hasText(color)) {
            return null;
        }
        String normalized = color.trim().replace("#", "");
        return normalized.matches("(?i)^[0-9a-f]{6}$") ? normalized.toUpperCase(Locale.ROOT) : null;
    }

    private PublishingPlaceholderStyleConfig resolveStyle(Map<String, PublishingPlaceholderStyleConfig> placeholderStyles, String key) {
        if (placeholderStyles == null || placeholderStyles.isEmpty() || !StringUtils.hasText(key)) {
            return null;
        }
        // Look up by canonical alias name — the token actually present in the DOCX may be a
        // different alias (e.g. {{author}} vs {{authorName}}) than the one the style was saved
        // under; resolveStyleMap() already keys its entries canonically to match.
        return placeholderStyles.get(PublishingPlaceholderSyntax.canonicalName(key));
    }

    private boolean containsFontSizeInstruction(String text) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(matcher.group(1), matcher.group(2));
            if (token != null && PublishingPlaceholderSyntax.extractFontSize(token.transform()) != null) {
                return true;
            }
        }
        return false;
    }

    private boolean containsSignaturePlaceholder(String text) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(matcher.group(1), matcher.group(2));
            if (token != null && token.key().toLowerCase(Locale.ROOT).contains("signature")) {
                return true;
            }
        }
        return false;
    }

    /**
     * The simple run-text-swap fast path in replaceParagraphText() never consults
     * placeholderStyles, so any placeholder with an admin-configured style (font, size, color,
     * alignment, transform...) must be routed through the full rebuildParagraphPreservingStyles
     * path instead — otherwise the style is silently ignored no matter how it was saved.
     */
    private boolean containsStyledPlaceholder(String text, Map<String, PublishingPlaceholderStyleConfig> placeholderStyles) {
        if (placeholderStyles == null || placeholderStyles.isEmpty()) {
            return false;
        }
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(matcher.group(1), matcher.group(2));
            if (token != null && resolveStyle(placeholderStyles, token.key()) != null) {
                return true;
            }
        }
        return false;
    }

    private void applyAutoFitToRun(XWPFRun run, String text, boolean autoFitLongText, boolean exactPreview) {
        if (exactPreview || !autoFitLongText || run == null || !StringUtils.hasText(text)) {
            return;
        }
        String normalized = text.replace("\r", "").trim();
        if (normalized.length() <= 24) {
            return;
        }

        int baseFontSize = run.getFontSize();
        if (baseFontSize <= 0) {
            baseFontSize = 10;
        }

        int length = normalized.length();
        int lineCount = Math.max(1, normalized.split("\\n").length);
        int shrinkSteps = Math.max(1, (length - 24 + 9) / 10);
        if (lineCount > 1) {
            shrinkSteps += lineCount - 1;
        }
        int targetFontSize = Math.max(7, baseFontSize - shrinkSteps);
        if (targetFontSize < baseFontSize) {
            run.setFontSize(targetFontSize);
        }
    }

    private void preserveFontFamily(XWPFRun run, CTRPr style) {
        // Run properties are copied from the template paragraph. Keep this helper as a
        // dedicated hook so we can extend font-family normalization later if the POI
        // schema version exposes the necessary accessors.
        if (run == null || style == null) {
            return;
        }
    }

    private CTRPr firstStyle(List<RunSnapshot> sourceRuns) {
        if (sourceRuns == null) {
            return null;
        }
        return sourceRuns.stream()
                .map(RunSnapshot::style)
                .filter(style -> style != null)
                .findFirst()
                .orElse(null);
    }

    private int pageOffset(Map<String, String> extraValues) {
        if (extraValues == null || !StringUtils.hasText(extraValues.get("pageOffset"))) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(extraValues.get("pageOffset")));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String replacePlaceholders(String text, Map<String, String> values) {
        Matcher matcher = PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text == null ? "" : text);
        StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String key = PublishingPlaceholderSyntax.normalizeKey(matcher.group(1), matcher.group(2));
            String replacement = values.getOrDefault(key, "-");
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private void replaceXmlText(XmlObject xmlObject, Map<String, String> values) {
        if (xmlObject == null || values == null || values.isEmpty()) {
            return;
        }
        XmlCursor cursor = xmlObject.newCursor();
        try {
            while (!cursor.isEnddoc()) {
                if (cursor.currentTokenType() == XmlCursor.TokenType.TEXT) {
                    String text = cursor.getTextValue();
                    if (StringUtils.hasText(text) && PublishingPlaceholderSyntax.PLACEHOLDER_PATTERN.matcher(text).find()) {
                        cursor.setTextValue(replacePlaceholders(text, values));
                    }
                }
                cursor.toNextToken();
            }
        } finally {
            cursor.dispose();
        }
    }

    private void stripBodyContent(XWPFDocument document) {
        if (document == null) {
            return;
        }
        for (int i = document.getBodyElements().size() - 1; i >= 0; i--) {
            document.removeBodyElement(i);
        }
    }

    private XWPFHeader firstHeader(XWPFDocument document) {
        if (document == null || document.getHeaderList().isEmpty()) {
            return null;
        }
        return document.getHeaderList().stream()
                .filter(header -> StringUtils.hasText(header.getText()) || hasTables(header) || !header.getAllPictures().isEmpty())
                .findFirst()
                .orElse(document.getHeaderList().get(0));
    }

    private XWPFFooter firstFooter(XWPFDocument document) {
        if (document == null || document.getFooterList().isEmpty()) {
            return null;
        }
        return document.getFooterList().stream()
                .filter(footer -> StringUtils.hasText(footer.getText()) || hasTables(footer) || !footer.getAllPictures().isEmpty())
                .findFirst()
                .orElse(document.getFooterList().get(0));
    }

    private boolean hasTables(XWPFHeaderFooter headerFooter) {
        try {
            return headerFooter != null && !headerFooter.getTables().isEmpty();
        } catch (Exception ex) {
            return false;
        }
    }

    private void applyHeader(XWPFDocument targetDocument, XWPFHeader sourceHeader) {
        if (targetDocument == null || sourceHeader == null) {
            return;
        }
        if (!targetDocument.getHeaderList().isEmpty()) {
            targetDocument.getHeaderList().forEach(targetHeader -> copyHeaderFooterContent(sourceHeader, targetHeader));
            return;
        }
        XWPFHeader targetHeader = targetDocument.createHeader(HeaderFooterType.DEFAULT);
        copyHeaderFooterContent(sourceHeader, targetHeader);
    }

    private void applyFooter(XWPFDocument targetDocument, XWPFFooter sourceFooter) {
        if (targetDocument == null || sourceFooter == null) {
            return;
        }
        if (!targetDocument.getFooterList().isEmpty()) {
            targetDocument.getFooterList().forEach(targetFooter -> copyHeaderFooterContent(sourceFooter, targetFooter));
            return;
        }
        XWPFFooter targetFooter = targetDocument.createFooter(HeaderFooterType.DEFAULT);
        copyHeaderFooterContent(sourceFooter, targetFooter);
    }

    private void copyHeaderFooterContent(XWPFHeaderFooter source, XWPFHeaderFooter target) {
        if (source == null || target == null) {
            return;
        }

        CTHdrFtr copied = (CTHdrFtr) source._getHdrFtr().copy();
        Map<String, String> relationshipIdMap = copyPictures(source, target);
        String xml = copied.xmlText();
        boolean xmlChanged = false;
        if (!relationshipIdMap.isEmpty()) {
            for (Map.Entry<String, String> entry : relationshipIdMap.entrySet()) {
                xml = xml.replace("\"" + entry.getKey() + "\"", "\"" + entry.getValue() + "\"");
                xml = xml.replace("'" + entry.getKey() + "'", "'" + entry.getValue() + "'");
            }
            xmlChanged = true;
        }
        // Paragraphs inside header/footer content are commonly tagged with the built-in
        // "Header"/"Footer" paragraph style (w:pStyle), which only resolves against the source
        // template's OWN styles.xml -- that definition is never carried over when the raw XML is
        // transplanted into the target document, so Word/Graph silently falls back to whatever
        // "Header"/"Footer" happens to mean in the target's styles.xml (often a different default
        // font). Strip that dangling reference so the text inherits the target's own Normal style
        // instead, keeping header/footer typography consistent with the rest of the published doc.
        String withoutStyleRefs = xml
                .replaceAll("<w:pStyle w:val=\"Header\"\\s*/>", "")
                .replaceAll("<w:pStyle w:val=\"Footer\"\\s*/>", "");
        if (!withoutStyleRefs.equals(xml)) {
            xml = withoutStyleRefs;
            xmlChanged = true;
        }
        if (xmlChanged) {
            try {
                copied = CTHdrFtr.Factory.parse(xml);
            } catch (Exception ignored) {
                // If XML replacement fails, keep the text/table content rather than failing publishing.
            }
        }
        target.setHeaderFooter(copied);
    }

    private Map<String, String> copyPictures(XWPFHeaderFooter source, XWPFHeaderFooter target) {
        Map<String, String> idMap = new LinkedHashMap<>();
        for (XWPFPictureData picture : source.getAllPictures()) {
            String oldRelationId = source.getRelationId(picture);
            if (!StringUtils.hasText(oldRelationId)) {
                continue;
            }
            try {
                String newRelationId = target.addPictureData(picture.getData(), picture.getPictureType());
                if (StringUtils.hasText(newRelationId)) {
                    idMap.put(oldRelationId, newRelationId);
                }
            } catch (Exception ignored) {
                // A missing decorative image must not block publishing text placeholders.
            }
        }
        return idMap;
    }

    private boolean isDocx(Path path, String fileName) {
        if (path != null) {
            return com.eqms.util.DocxSignature.isDocx(path);
        }
        return StringUtils.hasText(fileName) && fileName.toLowerCase(Locale.ROOT).endsWith(".docx");
    }
}

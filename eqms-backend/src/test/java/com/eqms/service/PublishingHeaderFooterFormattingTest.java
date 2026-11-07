package com.eqms.service;

import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTStyle;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTStyles;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STStyleType;

import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

/**
 * Regression: a header/footer template that leaves its font and size to its own styles (document defaults, the Header style)
 * looked different once its XML was moved into the body document, because those styles did not move with it.
 */
class PublishingHeaderFooterFormattingTest {

    private final PublishingOpenXmlTemplateRenderService service =
            new PublishingOpenXmlTemplateRenderService(mock(PublishingTemplatePlaceholderMapperService.class), mock(ElectronicSignatureService.class));

    @Test
    void headerKeepsTheFontAndSizeItsTemplateStylesGive(@TempDir Path tempDir) throws Exception {
        Path source = tempDir.resolve("source.docx");
        try (XWPFDocument body = new XWPFDocument()) {
            body.createParagraph().createRun().setText("Body");
            CTStyles bodyStyles = CTStyles.Factory.newInstance();
            var bodyDefaults = bodyStyles.addNewDocDefaults().addNewRPrDefault().addNewRPr();
            bodyDefaults.addNewRFonts().setAscii("Calibri");
            bodyDefaults.addNewSz().setVal(BigInteger.valueOf(22));
            body.createStyles().setStyles(bodyStyles);
            write(body, source);
        }

        Path header = tempDir.resolve("header.docx");
        try (XWPFDocument template = new XWPFDocument()) {
            CTStyles styles = CTStyles.Factory.newInstance();
            var defaults = styles.addNewDocDefaults().addNewRPrDefault().addNewRPr();
            defaults.addNewRFonts().setAscii("Arial");
            defaults.addNewSz().setVal(BigInteger.valueOf(18));
            CTStyle headerStyle = styles.addNewStyle();
            headerStyle.setType(STStyleType.PARAGRAPH);
            headerStyle.setStyleId("Header");
            headerStyle.addNewRPr().addNewSz().setVal(BigInteger.valueOf(14));
            template.createStyles().setStyles(styles);

            XWPFHeader templateHeader = template.createHeader(HeaderFooterType.DEFAULT);
            XWPFParagraph styled = templateHeader.createParagraph();
            styled.setStyle("Header");
            styled.createRun().setText("Inherits from the Header style");
            XWPFParagraph explicit = templateHeader.createParagraph();
            XWPFRun explicitRun = explicit.createRun();
            explicitRun.setText("Says its own size");
            explicitRun.setFontSize(20);
            write(template, header);
        }

        Path merged = service.renderSourceWithHeaderFooter(source, "source.docx", header, "header.docx", null, null, null, Map.of(), Map.of(), Map.of());

        try (var input = Files.newInputStream(merged); XWPFDocument result = new XWPFDocument(input)) {
            var paragraphs = result.getHeaderList().get(0).getParagraphs();
            var inherited = paragraphs.get(0).getRuns().get(0).getCTR().getRPr();
            assertEquals("Arial", inherited.getRFontsArray(0).getAscii());
            assertEquals(BigInteger.valueOf(14), inherited.getSzArray(0).getVal());
            var own = paragraphs.get(1).getRuns().get(0).getCTR().getRPr();
            assertEquals("Arial", own.getRFontsArray(0).getAscii());
            assertEquals(BigInteger.valueOf(40), own.getSzArray(0).getVal());
        }
    }

    @Test
    void bodyTakesThePageSizeAndWidthOfTheHeaderTemplate_landscapeSectionStaysLandscape(@TempDir Path tempDir) throws Exception {
        Path source = tempDir.resolve("body-letter.docx");
        try (XWPFDocument body = new XWPFDocument()) {
            body.createParagraph().createRun().setText("Body");
            var section = body.getDocument().getBody().addNewSectPr();
            var size = section.addNewPgSz();
            size.setW(BigInteger.valueOf(12240)); // Letter
            size.setH(BigInteger.valueOf(15840));
            var margin = section.addNewPgMar();
            margin.setLeft(BigInteger.valueOf(1440));
            margin.setRight(BigInteger.valueOf(1440));
            var landscape = body.createParagraph().getCTP().addNewPPr().addNewSectPr();
            landscape.addNewPgSz().setW(BigInteger.valueOf(15840));
            landscape.getPgSz().setH(BigInteger.valueOf(12240));
            landscape.addNewPgMar().setLeft(BigInteger.valueOf(1440));
            write(body, source);
        }
        Path header = tempDir.resolve("header-a4.docx");
        try (XWPFDocument template = new XWPFDocument()) {
            var section = template.getDocument().getBody().addNewSectPr();
            section.addNewPgSz().setW(BigInteger.valueOf(11907)); // A4
            section.getPgSz().setH(BigInteger.valueOf(16840));
            var margin = section.addNewPgMar();
            margin.setLeft(BigInteger.valueOf(1418));
            margin.setRight(BigInteger.valueOf(851));
            template.createHeader(HeaderFooterType.DEFAULT).createParagraph().createRun().setText("Header");
            write(template, header);
        }

        Path merged = service.renderSourceWithHeaderFooter(source, "body-letter.docx", header, "header-a4.docx", null, null, null, Map.of(), Map.of(), Map.of());

        try (var input = Files.newInputStream(merged); XWPFDocument result = new XWPFDocument(input)) {
            var last = result.getDocument().getBody().getSectPr();
            assertEquals(BigInteger.valueOf(11907), last.getPgSz().getW());
            assertEquals(BigInteger.valueOf(16840), last.getPgSz().getH());
            assertEquals(BigInteger.valueOf(1418), last.getPgMar().getLeft());
            assertEquals(BigInteger.valueOf(851), last.getPgMar().getRight());
            var landscapeSection = result.getParagraphs().get(1).getCTP().getPPr().getSectPr();
            assertEquals(BigInteger.valueOf(16840), landscapeSection.getPgSz().getW());
            assertEquals(BigInteger.valueOf(11907), landscapeSection.getPgSz().getH());
            assertEquals(BigInteger.valueOf(1440), landscapeSection.getPgMar().getLeft());
        }
    }

    private void write(XWPFDocument document, Path path) throws Exception {
        try (var output = Files.newOutputStream(path)) {
            document.write(output);
        }
    }
}

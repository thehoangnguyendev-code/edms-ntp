package com.eqms.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;

import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

/**
 * Regression: composing a source (body) document with a separately-designed header/footer
 * template file only copied the header/footer paragraph CONTENT, leaving the body document's own
 * (unrelated) page-margin header/footer distance untouched. Whenever the body document's own
 * distance was larger than what the footer template was actually designed against, the merged
 * footer ended up sitting with a large, unintended gap above it -- reported as "footer position
 * looks off / too much white space" on content pages vs. the cover page (a separate, whole-page
 * template that isn't affected by this).
 */
class PublishingOpenXmlTemplateRenderServiceFooterDistanceTest {

    private final PublishingOpenXmlTemplateRenderService service =
            new PublishingOpenXmlTemplateRenderService(mock(PublishingTemplatePlaceholderMapperService.class), mock(ElectronicSignatureService.class));

    @Test
    void footerDistanceIsTakenFromFooterTemplateNotFromSourceDocument(@TempDir Path tempDir) throws Exception {
        Path sourcePath = tempDir.resolve("source.docx");
        writeDocxWithPageMargin(sourcePath, BigInteger.valueOf(1440), null); // large, unrelated footer distance

        Path footerPath = tempDir.resolve("footer.docx");
        writeDocxWithPageMargin(footerPath, null, BigInteger.valueOf(200)); // tight, as designed by the footer template

        Path result = service.renderSourceWithHeaderFooter(
                sourcePath, "source.docx",
                null, null,
                footerPath, "footer.docx",
                null, java.util.Map.of(), java.util.Map.of(), java.util.Map.of()
        );

        try (var input = Files.newInputStream(result);
             XWPFDocument merged = new XWPFDocument(input)) {
            CTSectPr sectPr = merged.getDocument().getBody().getSectPr();
            assertEquals(BigInteger.valueOf(200), sectPr.getPgMar().getFooter());
        }
    }

    private void writeDocxWithPageMargin(Path path, BigInteger headerDistance, BigInteger footerDistance) throws Exception {
        try (XWPFDocument document = new XWPFDocument()) {
            document.createParagraph().createRun().setText("Body text");
            XWPFHeader header = document.createHeader(HeaderFooterType.DEFAULT);
            header.createParagraph().createRun().setText("Header text");
            XWPFFooter footer = document.createFooter(HeaderFooterType.DEFAULT);
            footer.createParagraph().createRun().setText("Footer text");

            CTSectPr sectPr = document.getDocument().getBody().isSetSectPr()
                    ? document.getDocument().getBody().getSectPr()
                    : document.getDocument().getBody().addNewSectPr();
            var pgMar = sectPr.isSetPgMar() ? sectPr.getPgMar() : sectPr.addNewPgMar();
            if (headerDistance != null) {
                pgMar.setHeader(headerDistance);
            }
            if (footerDistance != null) {
                pgMar.setFooter(footerDistance);
            }

            try (var output = Files.newOutputStream(path)) {
                document.write(output);
            }
        }
    }
}

package com.eqms.service.training;

import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/** The tokenized Word files made from the real APD files (docs/training_docs/annex-tokenized): each one agrees with its contract, fills with the sample data and reads back clean. */
class TrainingAnnexTemplatesTest {
    private static byte[] file(String code) throws Exception {
        for (Path root : new Path[] {Path.of("../docs/training_docs/annex-tokenized"), Path.of("docs/training_docs/annex-tokenized")}) {
            Path p = root.resolve(code + ".docx");
            if (Files.exists(p)) return Files.readAllBytes(p);
        }
        throw new IllegalStateException("template file not found: " + code);
    }

    @ParameterizedTest
    @ValueSource(strings = {"APD.0117", "APD.0108", "APD.0118", "APD.0011", "APD.0024", "APD.0014"})
    void theTemplateAgreesWithItsContract(String code) throws Exception {
        TrainingAnnexEngine.Scan scan = TrainingAnnexEngine.scan(file(code));
        assertThat(TrainingAnnexContract.of(code).check(scan)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"APD.0117", "APD.0108", "APD.0118", "APD.0011", "APD.0024", "APD.0014"})
    void theTemplateFillsWithTheSampleDataAndReadsBackClean(String code) throws Exception {
        TrainingAnnexEngine.Filled filled = TrainingAnnexEngine.fill(file(code), TrainingAnnexSamples.of(code));
        assertThat(TrainingAnnexEngine.verify(filled)).isEmpty();
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(filled.bytes())); XWPFWordExtractor e = new XWPFWordExtractor(doc)) {
            String text = e.getText();
            assertThat(text).doesNotContain("{{").doesNotContain("LỊCH SỬ SỬA ĐỔI").doesNotContain("Document template complies");
            doc.getHeaderList().forEach(h -> assertThat(h.getText()).doesNotContain("{{"));
            doc.getFooterList().forEach(f -> assertThat(f.getText().trim()).as("no footer line").isEmpty());
        }
        Files.write(Path.of("target", code + "-sample.docx"), filled.bytes());
    }

    @ParameterizedTest
    @ValueSource(strings = {"APD.0117", "APD.0108", "APD.0118", "APD.0011", "APD.0024", "APD.0014"})
    void theSampleHoldsEveryTokenOfTheTemplate(String code) throws Exception {
        assertThat(TrainingAnnexEngine.fill(file(code), TrainingAnnexSamples.of(code)).unresolved()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"APD.0117", "APD.0108", "APD.0118", "APD.0011", "APD.0024", "APD.0014"})
    void everythingInTheFilledFormIsInTimesNewRoman(String code) throws Exception {
        TrainingAnnexEngine.Filled filled = TrainingAnnexEngine.fill(file(code), TrainingAnnexSamples.of(code));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(filled.bytes()))) {
            java.util.List<org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR> runs = new java.util.ArrayList<>();
            String ns = "declare namespace w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; ";
            for (var o : doc.getDocument().getBody().selectPath(ns + ".//w:r")) runs.add((org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR) o);
            doc.getHeaderList().forEach(h -> { for (var o : h._getHdrFtr().selectPath(ns + ".//w:r")) runs.add((org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR) o); });
            doc.getFooterList().forEach(f -> { for (var o : f._getHdrFtr().selectPath(ns + ".//w:r")) runs.add((org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR) o); });
            org.assertj.core.api.Assertions.assertThat(runs).isNotEmpty();
            for (var r : runs) {
                org.assertj.core.api.Assertions.assertThat(r.isSetRPr() && r.getRPr().sizeOfRFontsArray() > 0).as(code).isTrue();
                var f = r.getRPr().getRFontsArray(0);
                org.assertj.core.api.Assertions.assertThat(java.util.List.of(f.getAscii(), f.getHAnsi(), f.getCs(), f.getEastAsia())).as(code).containsOnly("Times New Roman");
                org.assertj.core.api.Assertions.assertThat(f.isSetAsciiTheme() || f.isSetHAnsiTheme() || f.isSetCstheme() || f.isSetEastAsiaTheme()).as(code).isFalse();
            }
            var defaults = doc.getStyle().getDocDefaults().getRPrDefault().getRPr().getRFontsArray(0);
            org.assertj.core.api.Assertions.assertThat(java.util.List.of(defaults.getAscii(), defaults.getHAnsi(), defaults.getCs(), defaults.getEastAsia())).containsOnly("Times New Roman");
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"APD.0117", "APD.0108", "APD.0118", "APD.0011", "APD.0024", "APD.0014"})
    void theFilledFormHasNoEmptySectionAtTheEnd(String code) throws Exception {
        TrainingAnnexEngine.Filled filled = TrainingAnnexEngine.fill(file(code), TrainingAnnexSamples.of(code));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(filled.bytes()))) {
            var body = doc.getDocument().getBody();
            var paragraphs = body.getPList();
            // the last section has content: nothing but empty lines follows the last end of a section
            boolean onlyEmptyAfter = false;
            for (int i = paragraphs.size() - 1; i >= 0; i--) {
                if (paragraphs.get(i).isSetPPr() && paragraphs.get(i).getPPr().isSetSectPr()) {
                    onlyEmptyAfter = true;
                    try (var c = paragraphs.get(i).newCursor()) {
                        while (c.toNextSibling() && !"sectPr".equals(c.getName().getLocalPart())) {
                            var o = c.getObject();
                            if (!(o instanceof org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP q) || !TrainingAnnexEngine.text(q).isBlank()) onlyEmptyAfter = false;
                        }
                    }
                    break;
                }
            }
            org.assertj.core.api.Assertions.assertThat(onlyEmptyAfter).as(code + " ends with an empty section").isFalse();
        }
    }
}

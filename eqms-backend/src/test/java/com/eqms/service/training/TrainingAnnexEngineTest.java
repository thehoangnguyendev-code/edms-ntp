package com.eqms.service.training;

import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The token engine of the Training Annex on a synthetic Word file: scalars, split runs, row repeat, block repeat, cases, omitted notes, boxes, signatures, and the read-back check. */
class TrainingAnnexEngineTest {

    private static void para(XWPFDocument doc, String text) {
        doc.createParagraph().createRun().setText(text);
    }

    private static byte[] sample() throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            para(doc, "{{#OMIT}}");
            para(doc, "Note: this describes the form");
            para(doc, "{{/OMIT}}");
            XWPFParagraph split = doc.createParagraph();
            for (String part : new String[] {"Code: {", "{TRAINING", "_CODE}", "} end"}) split.createRun().setText(part);
            para(doc, "{{#CASE:EXTERNAL}}");
            para(doc, "External trainer: {{TRAINER_NAME}}");
            para(doc, "{{/CASE:EXTERNAL}}");
            para(doc, "{{#CASE:INTERNAL}}");
            para(doc, "Internal trainer");
            para(doc, "{{/CASE:INTERNAL}}");
            XWPFTable table = doc.createTable(2, 2);
            table.getRow(0).getCell(0).setText("Name");
            table.getRow(0).getCell(1).setText("Result");
            table.getRow(1).getCell(0).setText("{{ATTENDEE.NAME}}");
            table.getRow(1).getCell(1).setText("{{ATTENDEE.RESULT}}");
            para(doc, "{{#EACH:SESSION}}");
            para(doc, "Session {{SESSION.NO}}");
            para(doc, "{{/EACH:SESSION}}");
            para(doc, "Done {{CHECK:DONE}} Open {{CHECK:OPEN}}");
            para(doc, "Prepared:");
            para(doc, "{{SIGNATURE:PREPARER}}");
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static TrainingAnnexData data() {
        return new TrainingAnnexData()
                .scalar("TRAINING_CODE", "TRN-0001").scalar("TRAINER_NAME", "Ms Trainer")
                .caseOn("EXTERNAL", true).caseOn("INTERNAL", false)
                .group("ATTENDEE", List.of(new TrainingAnnexData.Item().field("NAME", "An").field("RESULT", "PASSED"),
                        new TrainingAnnexData.Item().field("NAME", "Binh").field("RESULT", "FAILED")))
                .group("SESSION", List.of(new TrainingAnnexData.Item().field("NO", "1"), new TrainingAnnexData.Item().field("NO", "2")))
                .check("DONE", true).check("OPEN", false)
                .signature("PREPARER", List.of("Signed by: A. Nguyen", "2026-10-28 09:00"));
    }

    private static String text(byte[] bytes) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes)); XWPFWordExtractor e = new XWPFWordExtractor(doc)) {
            return e.getText();
        }
    }

    @Test
    void scanReportsTheTokensByKind() throws Exception {
        TrainingAnnexEngine.Scan scan = TrainingAnnexEngine.scan(sample());
        assertThat(scan.scalars()).contains("TRAINER_NAME");
        assertThat(scan.groupFields().get("ATTENDEE")).containsExactly("NAME", "RESULT");
        assertThat(scan.eachGroups()).containsExactly("SESSION");
        assertThat(scan.cases()).containsExactlyInAnyOrder("EXTERNAL", "INTERNAL");
        assertThat(scan.checks()).containsExactlyInAnyOrder("DONE", "OPEN");
        assertThat(scan.signatures()).containsExactly("PREPARER");
        assertThat(scan.omitBlocks()).isEqualTo(1);
        assertThat(scan.errors()).isEmpty();
    }

    @Test
    void anUnclosedMarkerIsAnError() throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            para(doc, "{{#CASE:X}}");
            para(doc, "text");
            doc.write(out);
            assertThat(TrainingAnnexEngine.scan(out.toByteArray()).errors()).hasSize(1);
        }
    }

    @Test
    void fillWritesEveryValueAndTheReadBackCheckPasses() throws Exception {
        TrainingAnnexEngine.Filled filled = TrainingAnnexEngine.fill(sample(), data());
        String text = text(filled.bytes());

        assertThat(text).contains("Code: TRN-0001 end").contains("External trainer: Ms Trainer").doesNotContain("Internal trainer").doesNotContain("Note: this describes");
        assertThat(text).contains("An").contains("PASSED").contains("Binh").contains("FAILED");
        assertThat(text).contains("Session 1").contains("Session 2");
        assertThat(text).contains("Done ☒ Open ☐");
        assertThat(text).contains("Signed by: A. Nguyen").contains("2026-10-28 09:00");
        assertThat(text).doesNotContain("{{").doesNotContain("#ITEM");
        assertThat(TrainingAnnexEngine.verify(filled)).isEmpty();
    }

    @Test
    void aListOfNoItemsRemovesTheRowAndTheBlock() throws Exception {
        TrainingAnnexData empty = data().group("ATTENDEE", List.of()).group("SESSION", List.of());
        String text = text(TrainingAnnexEngine.fill(sample(), empty).bytes());
        assertThat(text).doesNotContain("An").doesNotContain("Session 1").doesNotContain("{{");
    }

    @Test
    void aTokenTheDataDoesNotKnowIsReportedAndFailsTheCheck() throws Exception {
        TrainingAnnexData missing = new TrainingAnnexData().caseOn("EXTERNAL", false).caseOn("INTERNAL", false)
                .group("ATTENDEE", List.of()).group("SESSION", List.of()).check("DONE", false).check("OPEN", false).signature("PREPARER", List.of());
        TrainingAnnexEngine.Filled filled = TrainingAnnexEngine.fill(sample(), missing);
        assertThat(filled.unresolved()).contains("TRAINING_CODE");
        assertThat(TrainingAnnexEngine.verify(filled)).anyMatch(p -> p.contains("TRAINING_CODE"));
    }

    @Test
    void aPendingSignatureSlotShowsWhatItWaitsFor() throws Exception {
        TrainingAnnexData d = data().signature("PREPARER", List.of()).pending("PREPARER", "Waiting for: the list preparer");
        assertThat(text(TrainingAnnexEngine.fill(sample(), d).bytes())).contains("Waiting for: the list preparer");
    }

    @Test
    void withFontPutsEveryRunOfAnyFileInTimesNewRomanAndLeavesTheSizeAlone() throws Exception {
        byte[] bytes;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFRun a = doc.createParagraph().createRun();
            a.setFontFamily("Arial");
            a.setFontSize(9);
            a.setText("sans");
            doc.createParagraph().createRun().setText("no font of its own");
            doc.write(out);
            bytes = out.toByteArray();
        }
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAnnexEngine.withFont(bytes)))) {
            for (XWPFParagraph p : doc.getParagraphs()) {
                XWPFRun r = p.getRuns().get(0);
                assertThat(r.getFontFamily()).isEqualTo("Times New Roman");
            }
            assertThat(doc.getParagraphs().get(0).getRuns().get(0).getFontSizeAsDouble()).isEqualTo(9.0);
        }
        assertThat(TrainingAnnexEngine.withFont(new byte[] {1, 2})).containsExactly(1, 2);
    }

    @Test
    void aRunsLookIsKept() throws Exception {
        byte[] bytes;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFRun r = doc.createParagraph().createRun();
            r.setBold(true);
            r.setText("{{TRAINING_CODE}}");
            doc.write(out);
            bytes = out.toByteArray();
        }
        TrainingAnnexEngine.Filled filled = TrainingAnnexEngine.fill(bytes, new TrainingAnnexData().scalar("TRAINING_CODE", "TRN-9"));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(filled.bytes()))) {
            XWPFRun run = doc.getParagraphs().get(0).getRuns().get(0);
            assertThat(run.isBold()).isTrue();
            assertThat(run.text()).isEqualTo("TRN-9");
        }
    }
}

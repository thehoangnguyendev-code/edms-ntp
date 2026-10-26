package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.junit.jupiter.api.Test;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STVerticalJc;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** What the Word forms of Training have in common: what is written is Times New Roman 12, a block of signature is at the top of its cell and at the size of the configuration. */
class TrainingWordFormsTest {
    private static XWPFDocument reload(XWPFDocument doc) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.write(out);
        return new XWPFDocument(new ByteArrayInputStream(out.toByteArray()));
    }

    private static XWPFTableCell cell(XWPFDocument doc) {
        XWPFTable table = doc.createTable(1, 1);
        return table.getRow(0).getCell(0);
    }

    @Test
    void whatIsWrittenInACellIsTimesNewRomanTwelve() throws Exception {
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFTableCell cell = cell(doc);
            TrainingWordForms.setText(cell, "Nguyễn Văn An");
            XWPFDocument back = reload(doc);
            var run = back.getTables().get(0).getRow(0).getCell(0).getParagraphs().get(0).getRuns().get(0);
            assertEquals("Times New Roman", run.getFontFamily());
            assertEquals(12, run.getFontSize());
            assertEquals("Nguyễn Văn An", run.text());
        }
    }

    @Test
    void aBlockOfSignatureStartsAtTheTopOfTheCellAtTheSizeOfTheConfigurationAndTakesTheEmptyLines() throws Exception {
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFTableCell cell = cell(doc);
            TrainingWordForms.setText(cell, "Sign & date");
            cell.getCTTc().addNewP();
            cell.getCTTc().addNewP();
            TrainingWordForms.appendBlock(cell, List.of("Nguyen The Hoang", "Electronically Signed", "16/10/2026 13:19:37 (UTC+7)"), 8.5);
            XWPFDocument back = reload(doc);
            XWPFTableCell c = back.getTables().get(0).getRow(0).getCell(0);
            assertEquals(STVerticalJc.TOP, c.getCTTc().getTcPr().getVAlign().getVal());
            assertEquals(4, c.getParagraphs().size(), "the role and the three lines: the empty lines left for a hand signature are taken by the block");
            var run = c.getParagraphs().get(1).getRuns().get(0);
            assertEquals(8.5, run.getFontSizeAsDouble());
            assertEquals("Times New Roman", run.getFontFamily());
            assertEquals("Electronically Signed", c.getParagraphs().get(2).getText());
        }
    }

    @Test
    void severalLinesInACellAreOneParagraphEach() throws Exception {
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFTableCell cell = cell(doc);
            TrainingWordForms.setLines(cell, List.of("a", "b", "c"));
            XWPFDocument back = reload(doc);
            assertEquals("a|b|c", String.join("|", back.getTables().get(0).getRow(0).getCell(0).getParagraphs().stream().map(p -> p.getText()).toList()));
        }
    }

    @Test
    void theNotesThatDescribeTheFormAreRecognised() {
        assertTrue(TrainingWordForms.describesTheForm("- Đầu trang/ Header:"));
        assertTrue(TrainingWordForms.describesTheForm("1. Đầu trang/ Header"));
        assertTrue(TrainingWordForms.describesTheForm("2. Chân trang/ Footer:"));
        assertTrue(TrainingWordForms.describesTheForm("LỊCH SỬ SỬA ĐỔI BỔ SUNG/ HISTORY REVISION"));
        assertTrue(TrainingWordForms.describesTheForm("Danh mục này được tạo lập dưới dạng file excel"));
        assertEquals(false, TrainingWordForms.describesTheForm("Họ và tên/ Full name:"));
        assertEquals(false, TrainingWordForms.describesTheForm("Đã hoàn thiện đào tạo theo ma trận"));
    }
}

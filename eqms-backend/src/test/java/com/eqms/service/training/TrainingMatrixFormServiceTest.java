package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The matrix of a department written in the real form APD.0011 (version 2.0.0). */
class TrainingMatrixFormServiceTest {
    private static byte[] template() throws IOException {
        try (InputStream in = TrainingMatrixFormServiceTest.class.getResourceAsStream("/forms/APD.0011.02.docx")) {
            return in.readAllBytes();
        }
    }

    private static Map<String, Object> position(String id, String name) { return Map.of("id", id, "name", name); }

    private static Map<String, Object> row(String group, String topicCode, String topicName, String documentNumber, String documentName, boolean annual, List<String> positions) {
        Map<String, Object> r = new java.util.HashMap<>();
        r.put("rowGroup", group);
        r.put("topicId", topicCode == null ? null : "t-" + topicCode);
        r.put("topicCode", topicCode);
        r.put("topicName", topicName);
        r.put("documentNumber", documentNumber);
        r.put("documentName", documentName);
        r.put("annualRequired", annual);
        r.put("positionIds", positions);
        return r;
    }

    private static Map<String, Object> version(int positions) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 1; i <= positions; i++) list.add(position("p" + i, "Position " + i));
        Map<String, Object> v = new java.util.HashMap<>();
        v.put("matrixCode", "TRM-QA");
        v.put("versionNo", 3);
        v.put("status", "EFFECTIVE");
        v.put("departmentName", "Quality Assurance");
        v.put("positions", list);
        v.put("rows", List.of(
                row("FACTORY_GENERAL", "GMP", "Tổng quan về GMP", null, null, true, List.of("p1", "p2")),
                row("DEPARTMENT_GENERAL", "QA-1", "Kỹ năng đánh giá", null, null, false, List.of("p1")),
                row("SOP", null, null, "SOP.0003", "Training", true, List.of("p2"))));
        v.put("approvers", List.of(Map.of("status", "DONE", "assigneeName", "Nguyễn Văn An", "completedAt", "2026-10-20T08:00:00Z")));
        return v;
    }

    private static String text(XWPFTable t) {
        StringBuilder sb = new StringBuilder();
        t.getRows().forEach(r -> r.getTableCells().forEach(c -> sb.append(c.getText().replace('\n', ' ')).append('|')));
        return sb.toString();
    }

    @Test
    void theDepartmentTheVersionAndTheRowsAreWritten() throws Exception {
        byte[] out = TrainingMatrixFormService.fill(template(), version(2));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            String paragraphs = String.join("\n", doc.getParagraphs().stream().map(XWPFParagraph::getText).toList());
            assertTrue(paragraphs.contains("Ma trận đào tạo – Quality Assurance"), paragraphs);
            assertTrue(paragraphs.contains("Training matrix - Quality Assurance"));
            assertTrue(paragraphs.contains("Department: Quality Assurance"));
            assertTrue(paragraphs.contains("Matrix code: TRM-QA") && paragraphs.contains("Version: 3 (Effective)"));
            assertTrue(paragraphs.contains("Approved by: Nguyễn Văn An"));
            // what describes the form is not in the file
            assertFalse(paragraphs.contains("Ghi chú:") || paragraphs.contains("This file shall be created") || paragraphs.contains("LỊCH SỬ SỬA ĐỔI") || paragraphs.contains("Management Personnel"));
            assertEquals(1, doc.getTables().size(), "the history of revisions is taken out");
            String t = text(doc.getTables().get(0));
            assertTrue(t.contains("Position 1") && t.contains("Position 2"));
            assertTrue(t.contains("GMP") && t.contains("Tổng quan về GMP") && t.contains("SOP.0003") && t.contains("Training"));
            assertTrue(t.contains("factory") && t.contains("per department"), "a heading for each group");
        }
    }

    @Test
    void anXMarksTheCellsOfTheRightPositionsAndTheAnnualColumnSaysYesOrNo() throws Exception {
        byte[] out = TrainingMatrixFormService.fill(template(), version(2));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            XWPFTable t = doc.getTables().get(0);
            // heading (2 rows), group heading, row 1
            var gmp = t.getRows().stream().filter(r -> r.getCell(1) != null && r.getCell(1).getText().equals("GMP")).findFirst().orElseThrow();
            assertEquals(List.of("1", "GMP", "Tổng quan về GMP", "X", "X", "Yes"), gmp.getTableCells().stream().map(c -> c.getText().trim()).toList());
            var qa = t.getRows().stream().filter(r -> r.getCell(1) != null && r.getCell(1).getText().equals("QA-1")).findFirst().orElseThrow();
            assertEquals(List.of("2", "QA-1", "Kỹ năng đánh giá", "X", "", "No"), qa.getTableCells().stream().map(c -> c.getText().trim()).toList());
            var sop = t.getRows().stream().filter(r -> r.getCell(1) != null && r.getCell(1).getText().equals("SOP.0003")).findFirst().orElseThrow();
            assertEquals(List.of("3", "SOP.0003", "Training", "", "X", "Yes"), sop.getTableCells().stream().map(c -> c.getText().trim()).toList());
        }
    }

    @Test
    void manyPositionsAreWrittenUpwardsAndTheColumnsKeepTheWidthOfThePage() throws Exception {
        byte[] out = TrainingMatrixFormService.fill(template(), version(12));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            XWPFTable t = doc.getTables().get(0);
            String xml = t.getCTTbl().xmlText();
            assertTrue(xml.contains("btLr"), "the names of the positions are written upwards");
            assertEquals(12 + 4, t.getCTTbl().getTblGrid().sizeOfGridColArray());
            int sum = 0;
            for (var c : t.getCTTbl().getTblGrid().getGridColArray()) sum += ((Number) c.getW()).intValue();
            assertTrue(Math.abs(sum - 9628) <= 16, "the grid is as wide as the table of the form: " + sum);
        }
    }

    @Test
    void aDepartmentWithoutPositionsStillGivesAForm() throws Exception {
        byte[] out = TrainingMatrixFormService.fill(template(), version(0));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            assertEquals(1, doc.getTables().size());
        }
    }

    @Test
    void aFileThatIsNotTheFormIsRefused() throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream()) {
            doc.createParagraph().createRun().setText("not the form");
            doc.write(o);
            var e = org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () -> TrainingMatrixFormService.fill(o.toByteArray(), version(2)));
            assertEquals("TRAINING_FORM_TEMPLATE_STRUCTURE", e.getMessage());
        }
    }
}

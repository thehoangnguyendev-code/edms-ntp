package com.eqms.service.training;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TrainingAssessmentPaperTest {

    private static Map<String, Object> item(int no, String kind, String prompt, List<Map<String, Object>> options, List<String> correct, String model) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("no", no);
        m.put("kind", kind);
        m.put("prompt", prompt);
        m.put("options", options);
        m.put("correct", correct);
        m.put("points", 2);
        m.put("modelAnswer", model);
        return m;
    }

    private static Map<String, Object> opt(String id, String text) {
        return Map.of("id", id, "text", text);
    }

    private static Map<String, Object> snapshot(String kind, List<Map<String, Object>> items) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("code", "TAS-0001");
        s.put("version", 1);
        s.put("title", "Kiểm tra đào tạo SOP.0006 - Vệ sinh khu vực sản xuất");
        s.put("kind", kind);
        s.put("maxScore", "CHECKLIST".equals(kind) ? null : items.size() * 2);
        s.put("items", items);
        return s;
    }

    private static String text(byte[] pdf) throws IOException {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    private static List<Map<String, Object>> questions() {
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(item(1, "SINGLE", "Tần suất vệ sinh bề mặt thiết bị là bao lâu?", List.of(opt("A", "Mỗi ca"), opt("B", "Mỗi tuần"), opt("C", "Mỗi tháng")), List.of("A"), null));
        items.add(item(2, "MULTI", "Chọn các dụng cụ được phép dùng", List.of(opt("A", "Khăn không xơ"), opt("B", "Bàn chải kim loại"), opt("C", "Dung dịch IPA 70%")), List.of("A", "C"), null));
        items.add(item(3, "TRUE_FALSE", "Có thể bỏ qua việc ghi nhật ký nếu không có sự cố.", List.of(opt("A", "True"), opt("B", "False")), List.of("B"), null));
        items.add(item(4, "ESSAY", "Mô tả các bước xử lý khi phát hiện tràn hóa chất.", List.of(), List.of(), "Báo cáo, cách ly, dùng chất hấp thụ, ghi hồ sơ."));
        return items;
    }

    @Test
    void questionPaperHasTheQuestionsAndTheAnswersButNoKey() throws IOException {
        String t = text(TrainingAssessmentPaper.render(snapshot("QUESTIONS", questions()), false, "TAS-0001 v1"));
        assertTrue(t.contains("Tần suất vệ sinh bề mặt thiết bị là bao lâu?"));
        assertTrue(t.contains("A. Mỗi ca"));
        assertTrue(t.contains("Dung dịch IPA 70%"));
        assertTrue(t.contains("Mô tả các bước xử lý khi phát hiện tràn hóa chất."));
        assertTrue(t.contains("(2 points)"));
        assertTrue(t.contains("Total 8 points"));
        assertFalse(t.contains("ANSWER KEY"));
        assertFalse(t.contains("Model answer"));
        assertFalse(t.contains("Báo cáo, cách ly"));
    }

    @Test
    void keyPaperMarksTheExpectedAnswersAndShowsTheModelAnswer() throws IOException {
        String t = text(TrainingAssessmentPaper.render(snapshot("QUESTIONS", questions()), true, "TAS-0001 v1 key"));
        assertTrue(t.contains("ANSWER KEY"));
        assertTrue(t.contains("Model answer"));
        assertTrue(t.contains("Báo cáo, cách ly, dùng chất hấp thụ, ghi hồ sơ."));
    }

    @Test
    void checklistPaperIsATableWithCorrectAndIncorrectColumns() throws IOException {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 1; i <= 40; i++) items.add(item(i, "CHECK", "Mục kiểm tra số " + i + " cần được thực hiện đúng quy trình và ghi nhận đầy đủ vào hồ sơ lô", List.of(), List.of(i % 2 == 0 ? "CORRECT" : "INCORRECT"), null));
        byte[] pdf = TrainingAssessmentPaper.render(snapshot("CHECKLIST", items), false, "TAS-0001 v1");
        String t = text(pdf);
        assertTrue(t.contains("Correct"));
        assertTrue(t.contains("Không đúng"));
        assertFalse(t.contains("Total"), "a checklist has no score");
        assertFalse(t.contains("point"), "a checklist line has no points");
        assertTrue(t.contains("Mục kiểm tra số 1 "));
        assertTrue(t.contains("Mục kiểm tra số 40 "));
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertTrue(doc.getNumberOfPages() >= 2, "40 wrapped lines do not fit one page");
        }
    }

    @Test
    void aLongTextWithoutSpacesAndManyQuestionsStillMakeAValidMultiPagePdf() throws IOException {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 1; i <= 30; i++) items.add(item(i, "SINGLE", "X".repeat(400) + " câu " + i, List.of(opt("A", "Một"), opt("B", "Hai")), List.of("A"), null));
        byte[] pdf = TrainingAssessmentPaper.render(snapshot("QUESTIONS", items), false, "f");
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertTrue(doc.getNumberOfPages() > 2);
            assertEquals(doc.getNumberOfPages(), doc.getPages().getCount());
        }
        assertTrue(text(pdf).contains("câu 30"));
    }
}

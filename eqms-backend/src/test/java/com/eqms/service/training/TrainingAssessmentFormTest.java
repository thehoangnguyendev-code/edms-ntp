package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The content of an assessment written into the enabled form APD.0009; the template here has the same text as the one enabled on DEV ("Training topic" and two model questions). */
class TrainingAssessmentFormTest {

    private static byte[] template(String... paragraphs) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String text : paragraphs) doc.createParagraph().createRun().setText(text);
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static byte[] devTemplate() throws IOException {
        return template("TRAINING ASSESSMENT", "Training topic: ........", "1. Question one ........", "2. Question two ........", "Signature of the trainer");
    }

    private static Map<String, Object> item(int no, String kind, String prompt, List<Map<String, Object>> options, List<String> correct, Object points, String model) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("no", no);
        m.put("kind", kind);
        m.put("prompt", prompt);
        m.put("options", options);
        m.put("correct", correct);
        m.put("points", points);
        m.put("modelAnswer", model);
        return m;
    }

    private static List<Map<String, Object>> questions() {
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(item(1, "SINGLE", "Tần suất vệ sinh?", List.of(Map.of("id", "A", "text", "Mỗi ca"), Map.of("id", "B", "text", "Mỗi tuần")), List.of("A"), 2, null));
        items.add(item(2, "ESSAY", "Mô tả xử lý tràn hóa chất.", List.of(), List.of(), 5, "Cách ly, hấp thụ"));
        return items;
    }

    private static List<String> lines(byte[] docx) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            List<String> out = new ArrayList<>();
            for (XWPFParagraph p : doc.getParagraphs()) out.add(p.getText());
            return out;
        }
    }

    @Test
    void theTopicAndTheQuestionsReplaceTheModelLinesOfTheForm() throws IOException {
        List<String> out = lines(TrainingAssessmentForm.fill(devTemplate(), questions(), false, "SOP.0006 Vệ sinh", false));
        assertEquals("TRAINING ASSESSMENT", out.getFirst());
        assertEquals("Training topic: SOP.0006 Vệ sinh", out.get(1));
        assertTrue(out.contains("1. Tần suất vệ sinh?  (2 points)"));
        assertTrue(out.contains("☐ A. Mỗi ca"));
        assertTrue(out.contains("☐ B. Mỗi tuần"));
        assertTrue(out.contains("2. Mô tả xử lý tràn hóa chất.  (5 points)"));
        assertTrue(out.contains("Total / Tổng: 7 points"));
        // the model lines are gone and what follows them stays
        assertFalse(out.stream().anyMatch((l) -> l.contains("Question one") || l.contains("Question two")));
        assertEquals("Signature of the trainer", out.getLast());
    }

    @Test
    void theTitleOfTheAssessmentIsNotInTheForm() throws IOException {
        // the title is not given to the form at all: only the topic, the content and the key go in
        String all = String.join("\n", lines(TrainingAssessmentForm.fill(devTemplate(), questions(), false, "SOP.0006", false)));
        assertFalse(all.contains("TAS-"));
    }

    @Test
    void theTraineesCopyHasNoKeyAndTheTrainersCopyHasIt() throws IOException {
        String trainee = String.join("\n", lines(TrainingAssessmentForm.fill(devTemplate(), questions(), false, "T", false)));
        assertFalse(trainee.contains("☒"));
        assertFalse(trainee.contains("Model answer"));
        assertTrue(trainee.contains("_____"));
        String trainer = String.join("\n", lines(TrainingAssessmentForm.fill(devTemplate(), questions(), false, "T", true)));
        assertTrue(trainer.contains("☒ A. Mỗi ca"));
        assertTrue(trainer.contains("☐ B. Mỗi tuần"));
        assertTrue(trainer.contains("Model answer / Đáp án mẫu: Cách ly, hấp thụ"));
        assertFalse(trainer.contains("_____"));
    }

    @Test
    void aChecklistIsATableWithCorrectAndIncorrectColumnsAndNoScore() throws IOException {
        List<Map<String, Object>> lines = List.of(
                item(1, "CHECK", "Khu vực sạch", List.of(), List.of("CORRECT"), 1, null), item(2, "CHECK", "Nhật ký đầy đủ", List.of(), List.of("INCORRECT"), 1, null));
        byte[] trainee = TrainingAssessmentForm.fill(devTemplate(), lines, true, "T", false);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(trainee))) {
            assertEquals(1, doc.getTables().size());
            XWPFTable t = doc.getTables().getFirst();
            assertEquals(3, t.getRows().size());
            assertEquals(List.of("No.", "Content / Nội dung", "Correct / Đúng", "Incorrect / Không đúng"), t.getRow(0).getTableCells().stream().map(c -> c.getText()).toList());
            assertEquals(List.of("1", "Khu vực sạch", "☐", "☐"), t.getRow(1).getTableCells().stream().map(c -> c.getText()).toList());
            String all = String.join("\n", doc.getParagraphs().stream().map(XWPFParagraph::getText).toList());
            assertFalse(all.contains("Total"), "a checklist has no score");
            assertFalse(all.contains("point"));
        }
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAssessmentForm.fill(devTemplate(), lines, true, "T", true)))) {
            XWPFTable t = doc.getTables().getFirst();
            assertEquals(List.of("2", "Nhật ký đầy đủ", "☐", "☒"), t.getRow(2).getTableCells().stream().map(c -> c.getText()).toList());
            assertEquals(List.of("1", "Khu vực sạch", "☒", "☐"), t.getRow(1).getTableCells().stream().map(c -> c.getText()).toList());
        }
    }

    @Test
    void theMarksOfATemplateAreFilledWhereTheyAre() throws IOException {
        byte[] marked = template("Form APD.0009", "Topic of the training: {{TRAINING_TOPIC}}", "{{QUESTIONS}}", "End of the form");
        List<String> out = lines(TrainingAssessmentForm.fill(marked, questions(), false, "SOP.0006", false));
        assertEquals("Topic of the training: SOP.0006", out.get(1));
        assertTrue(out.contains("1. Tần suất vệ sinh?  (2 points)"));
        assertFalse(out.stream().anyMatch(l -> l.contains("{{")));
        assertEquals("End of the form", out.getLast());
    }

    @Test
    void aTemplateWithNoMarkAndNoModelLineIsRefusedAndNeverGuessedAt() throws IOException {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> TrainingAssessmentForm.fill(template("A form", "Training topic: ...", "No numbered line here"), questions(), false, "T", false));
        assertEquals("TRAINING_FORM_TEMPLATE_STRUCTURE", e.getReason());
    }

    @Test
    void aTemplateWithoutATopicLineStillGetsTheContent() throws IOException {
        List<String> out = lines(TrainingAssessmentForm.fill(template("Form", "1. model ........"), questions(), false, "T", false));
        assertTrue(out.contains("1. Tần suất vệ sinh?  (2 points)"));
        assertFalse(out.stream().anyMatch(l -> l.contains("model")));
    }
}

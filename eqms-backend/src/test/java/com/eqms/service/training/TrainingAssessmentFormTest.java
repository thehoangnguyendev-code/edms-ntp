package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The content of an assessment written into the real form APD.0009.02 of the company (src/test/resources/forms), as the form is laid out. */
class TrainingAssessmentFormTest {

    private static byte[] template() throws IOException {
        try (InputStream in = TrainingAssessmentFormTest.class.getResourceAsStream("/forms/APD.0009.02.docx")) {
            return in.readAllBytes();
        }
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
        items.add(item(1, "SINGLE", "Hệ thống được phân loại thành mấy nhóm?", List.of(Map.of("id", "A", "text", "4 nhóm"), Map.of("id", "B", "text", "3 nhóm")), List.of("B"), 2, null));
        items.add(item(2, "MULTI", "Chọn các thử nghiệm của thẩm định lắp đặt", List.of(Map.of("id", "A", "text", "Kiểm tra chứng chỉ vật liệu"), Map.of("id", "B", "text", "Kiểm tra vận hành"), Map.of("id", "C", "text", "Kiểm tra panel")), List.of("A", "C"), 2, null));
        items.add(item(3, "ESSAY", "Liệt kê các bước thẩm định nồi hấp.", List.of(), List.of(), 6, "URS, IQ, OQ, PQ, báo cáo"));
        return items;
    }

    private static List<Map<String, Object>> checklist() {
        return List.of(item(1, "CHECK", "Đeo găng tay trước khi lấy mẫu", List.of(), List.of("CORRECT"), 1, null), item(2, "CHECK", "Bỏ qua bước ghi nhật ký", List.of(), List.of("INCORRECT"), 1, null));
    }

    private static TrainingAssessmentForm.Content content(List<Map<String, Object>> items, boolean checklist, boolean key) {
        return new TrainingAssessmentForm.Content(items, checklist, key, List.of("SOP.0009 Thẩm định thiết bị và hệ thống (Phiên bản 2.0.0)/ Qualification of equipment and system (Version 2.0.0)", "SOP.0011 Hiệu chuẩn"), "TRN/QA/26-001", "INITIAL", 45);
    }

    private static List<String> bodyLines(byte[] docx) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            List<String> out = new ArrayList<>();
            for (var e : doc.getBodyElements()) {
                if (e instanceof XWPFParagraph p) out.add(p.getText());
                else if (e instanceof XWPFTable t) for (XWPFTableRow r : t.getRows()) for (XWPFTableCell c : r.getTableCells()) for (XWPFParagraph p : c.getParagraphs()) out.add(p.getText());
            }
            return out;
        }
    }

    private static String all(byte[] docx) throws IOException {
        return String.join("\n", bodyLines(docx));
    }

    private static int ticked(byte[] docx) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            int n = 0;
            for (XWPFTable t : doc.getTables()) for (XWPFTableRow r : t.getRows()) for (XWPFTableCell c : r.getTableCells()) for (XWPFParagraph p : c.getParagraphs()) for (XWPFRun run : p.getRuns())
                for (var sym : run.getCTR().getSymArray()) if (sym.getChar() != null && sym.getChar().length == 2 && (sym.getChar()[1] & 0xFF) == 0xFD) n++;
            return n;
        }
    }

    @Test
    void theFactsOfTheTrainingAreWrittenInTheTableOfTheForm() throws IOException {
        byte[] out = TrainingAssessmentForm.build(template(), content(questions(), false, false));
        String text = all(out);
        assertTrue(text.contains("SOP.0009 Thẩm định thiết bị và hệ thống (Phiên bản 2.0.0)/ Qualification of equipment and system (Version 2.0.0)"));
        assertTrue(text.contains("SOP.0011 Hiệu chuẩn"));
        assertTrue(text.contains("Training number: TRN/QA/26-001"));
        assertTrue(text.contains("Test duration 45 phút/ minutes"), "the duration goes where the dots were");
        // the third line of dots of the topics was not needed
        assertEquals(0, bodyLines(out).stream().filter(l -> l.trim().matches("…{20,}")).count(), "a line to write on is a paragraph with a light border, not a run of dots that can wrap");
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            long lines = doc.getParagraphs().stream().filter(p -> p.getCTP().isSetPPr() && p.getCTP().getPPr().isSetPBdr() && p.getCTP().getPPr().getPBdr().isSetBottom()).count();
            assertEquals(8, lines, "the eight lines of the essay question");
        }
        // the fields of the trainee stay as dots until the copy is made for a person
        assertTrue(text.contains("Name of trainee: …"));
        assertTrue(text.contains("ID code:…") || text.contains("ID code: …"));
    }

    @Test
    void theTypeOfTheTrainingIsTickedAndOnlyThatOne() throws IOException {
        assertEquals(1, ticked(TrainingAssessmentForm.build(template(), content(questions(), false, false))));
        for (String type : List.of("INITIAL", "RETRAINING", "PERIODIC", "UNPLANNED")) {
            byte[] out = TrainingAssessmentForm.build(template(), new TrainingAssessmentForm.Content(questions(), false, false, List.of("T"), "TRN/1", type, null));
            assertEquals(1, ticked(out), type);
        }
        assertEquals(0, ticked(TrainingAssessmentForm.build(template(), new TrainingAssessmentForm.Content(questions(), false, false, List.of("T"), "TRN/1", null, null))));
    }

    @Test
    void theInstructionsAndTheHistoryOfTheTemplateAreTakenOut() throws IOException {
        String text = all(TrainingAssessmentForm.build(template(), content(questions(), false, false)));
        for (String gone : List.of("Đầu trang/", "Chân trang", "Sử dụng một trong hai mẫu", "TH1:", "TH2:", "Xây dựng dựa trên nội dung đào tạo cụ thể", "LỊCH SỬ SỬA ĐỔI", "Description of change", "Contents of the steps", "- Nội dung")) {
            assertFalse(text.contains(gone), gone);
        }
        assertTrue(text.contains("Test content"));
        assertTrue(text.contains("Chữ ký học viên/Signature of trainee"));
    }

    @Test
    void theQuestionsAreInTwoPartsAndNumberedThrough() throws IOException {
        byte[] out = TrainingAssessmentForm.build(template(), content(questions(), false, false));
        String text = all(out);
        assertTrue(text.contains("Phần I: Câu hỏi trắc nghiệm / Part I: Multiple-choice questions"));
        assertTrue(text.contains("Câu 1: Hệ thống được phân loại thành mấy nhóm?  (2 điểm/ points)"));
        assertTrue(text.contains("\u2610  4 nhóm"));
        assertTrue(text.contains("Chọn tất cả các đáp án đúng/ Choose all the right answers"));
        assertTrue(text.contains("Phần II: Câu hỏi tự luận / Part II: Essay questions"));
        assertTrue(text.contains("Câu 3: Liệt kê các bước thẩm định nồi hấp.  (6 điểm/ points)"));
        assertTrue(text.matches("(?s).*Bài làm gồm 3 câu hỏi\\s*/\\s*there are 3 questions.*"));
        assertFalse(text.contains("URS, IQ"), "the trainee's copy has no model answer");
        assertEquals(0, new XWPFDocument(new ByteArrayInputStream(out)).getTables().stream().filter(t -> t.getRows().size() > 0 && tableOf(t).contains("Contents of the steps")).count());
        assertTrue(text.indexOf("Phần I") < text.indexOf("Phần II") && text.indexOf("Phần II") < text.indexOf("Bài làm gồm"));
    }

    @Test
    void theAnswersOfAQuestionAreInTwoColumnsWhenTheAuthorChoseThat() throws IOException {
        List<Map<String, Object>> items = new ArrayList<>(questions());
        items.get(0).put("optionLayout", "TWO_COLUMNS");
        items.get(0).put("options", List.of(Map.of("id", "A", "text", "4 nhóm"), Map.of("id", "B", "text", "3 nhóm"), Map.of("id", "C", "text", "2 nhóm"), Map.of("id", "D", "text", "1 nhóm")));
        byte[] out = TrainingAssessmentForm.build(template(), content(items, false, false));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            XWPFTable columns = doc.getTables().stream().filter(t -> t.getRows().size() == 2 && t.getRow(0).getTableCells().size() == 2 && tableOf(t).contains("4 nhóm")).findFirst().orElseThrow();
            assertEquals("\u2610  4 nhóm", columns.getRow(0).getCell(0).getText());
            assertEquals("\u2610  3 nhóm", columns.getRow(0).getCell(1).getText());
            assertEquals("\u2610  2 nhóm", columns.getRow(1).getCell(0).getText());
            assertEquals("\u2610  1 nhóm", columns.getRow(1).getCell(1).getText());
        }
        // the other question keeps the answers one under the other
        assertTrue(all(out).contains("\u2610  Kiểm tra chứng chỉ vật liệu"));
    }

    @Test
    void anEssayQuestionHasAsManyLightRuledLinesAsTheAuthorChose() throws IOException {
        List<Map<String, Object>> items = new ArrayList<>(questions());
        items.get(2).put("answerLines", 3);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAssessmentForm.build(template(), content(items, false, false))))) {
            long ruled = doc.getParagraphs().stream().filter(p -> p.getCTP().isSetPPr() && p.getCTP().getPPr().isSetPBdr() && p.getCTP().getPPr().getPBdr().isSetBottom() && p.getCTP().getPPr().getPBdr().getBottom().xgetColor().getStringValue().equals("BFBFBF")).count();
            assertEquals(3, ruled);
        }
        items.get(2).put("answerLines", null);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAssessmentForm.build(template(), content(items, false, false))))) {
            assertEquals(8, doc.getParagraphs().stream().filter(p -> p.getCTP().isSetPPr() && p.getCTP().getPPr().isSetPBdr() && p.getCTP().getPPr().getPBdr().isSetBottom()).count(), "the default is eight lines");
        }
    }

    private static String tableOf(XWPFTable t) {
        StringBuilder sb = new StringBuilder();
        for (XWPFTableRow r : t.getRows()) for (XWPFTableCell c : r.getTableCells()) sb.append(c.getText());
        return sb.toString();
    }

    @Test
    void theKeyHasTheRightAnswersMarkedAndTheModelAnswerAndIsHeadedAsSuch() throws IOException {
        String text = all(TrainingAssessmentForm.build(template(), content(questions(), false, true)));
        assertTrue(text.contains("ANSWER KEY"));
        assertTrue(text.contains("Đáp án mẫu/ Model answer: URS, IQ, OQ, PQ, báo cáo"));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAssessmentForm.build(template(), content(questions(), false, true))))) {
            int crossed = 0;
            for (XWPFParagraph p : doc.getParagraphs()) if (p.getText().startsWith("\u2612")) crossed++;
            assertEquals(3, crossed, "the box of B for question 1, of A and C for question 2 has a cross; the others are empty");
        }
        assertFalse(all(TrainingAssessmentForm.build(template(), content(questions(), false, false))).contains("ANSWER KEY"));
    }

    @Test
    void aChecklistFillsTheTableOfTheFormWithOneRowForEachLine() throws IOException {
        byte[] out = TrainingAssessmentForm.build(template(), content(checklist(), true, false));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            XWPFTable t = doc.getTables().stream().filter(x -> tableOf(x).contains("Contents of the steps")).findFirst().orElseThrow();
            assertEquals(2 + 2, t.getRows().size(), "the two heading rows and one row for each line");
            assertEquals("1", t.getRow(2).getCell(0).getText());
            assertEquals("Đeo găng tay trước khi lấy mẫu", t.getRow(2).getCell(1).getText());
            assertEquals("", t.getRow(2).getCell(2).getText(), "the trainee ticks the column");
            assertEquals("Bỏ qua bước ghi nhật ký", t.getRow(3).getCell(1).getText());
        }
        String text = all(out);
        assertFalse(text.contains("Phần I"));
        assertTrue(text.matches("(?s).*Bài làm gồm 2 câu hỏi\\s*/\\s*there are 2 questions.*"));
        assertFalse(text.contains("point"), "a checklist has no score");
        assertFalse(text.contains("điểm/"), "a checklist has no score");
    }

    @Test
    void theKeyOfAChecklistTicksTheExpectedColumn() throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAssessmentForm.build(template(), content(checklist(), true, true))))) {
            XWPFTable t = doc.getTables().stream().filter(x -> tableOf(x).contains("Contents of the steps")).findFirst().orElseThrow();
            assertEquals(1, t.getRow(2).getCell(2).getParagraphs().getFirst().getRuns().stream().mapToInt(r -> r.getCTR().sizeOfSymArray()).sum());
            assertEquals(0, t.getRow(2).getCell(3).getParagraphs().getFirst().getRuns().stream().mapToInt(r -> r.getCTR().sizeOfSymArray()).sum());
            assertEquals(0, t.getRow(3).getCell(2).getParagraphs().getFirst().getRuns().stream().mapToInt(r -> r.getCTR().sizeOfSymArray()).sum());
            assertEquals(1, t.getRow(3).getCell(3).getParagraphs().getFirst().getRuns().stream().mapToInt(r -> r.getCTR().sizeOfSymArray()).sum());
        }
    }

    @Test
    void theHeaderHasTheLogoTheTitleAndThePageNumbersAndTheFooterTheTrainingNumberAndTheSignature() throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(TrainingAssessmentForm.build(template(), content(questions(), false, false))))) {
            assertEquals(1, doc.getHeaderList().size());
            XWPFHeader header = doc.getHeaderList().getFirst();
            String xml = header._getHdrFtr().xmlText();
            assertTrue(xml.contains("TRAINING ASSESSMENT"));
            assertTrue(xml.contains("PAGE") && xml.contains("NUMPAGES"), "the page numbers are fields");
            assertEquals(1, header.getAllPictures().size(), "the logo is in the header");
            assertEquals(1, doc.getFooterList().size(), "one footer for all the pages");
            String f = doc.getFooterList().stream().map(x -> x._getHdrFtr().xmlText()).filter(x -> x.contains("Sign:")).findFirst().orElseThrow();
            assertFalse(f.contains("Training number") || f.contains("Trainee:"), "the footer has no line of the training number and the trainee");
            assertTrue(f.contains("Sign:") && f.contains("Date:"));
            assertTrue(f.contains("Document template complies"));
            assertEquals(1, doc.getFooterList().stream().filter(x -> x._getHdrFtr().xmlText().contains("Sign:")).count(), "only one footer has the signature");
            // the header table is no longer in the body
            assertFalse(all(TrainingAssessmentForm.build(template(), content(questions(), false, false))).contains("Page:"));
        }
    }

    @Test
    void theEndOfTheTestFollowsTheLastQuestionAndLeavesDotsForTheDate() throws IOException {
        byte[] out = TrainingAssessmentForm.build(template(), content(questions(), false, false));
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
            assertEquals(0, doc.getParagraphs().stream().filter(p -> p.getCTP().isSetPPr() && p.getCTP().getPPr().isSetSectPr()).count(), "one section: the end of the test is not on a page of its own");
            List<String> lines = doc.getParagraphs().stream().map(XWPFParagraph::getText).filter(t -> !t.isBlank()).toList();
            int count = -1, signature = -1, lastQuestion = -1;
            for (int i = 0; i < lines.size(); i++) {
                if (lines.get(i).contains("Bài làm gồm 3 câu hỏi")) count = i;
                if (lines.get(i).contains("Chữ ký học viên")) signature = i;
                if (lines.get(i).startsWith("Câu ")) lastQuestion = i;
            }
            assertTrue(lastQuestion >= 0 && count > lastQuestion && signature == count + 1, "the end of the test comes right after the questions");
            XWPFParagraph counted = doc.getParagraphs().stream().filter(p -> p.getText().contains("there are")).findFirst().orElseThrow();
            var runs = counted.getRuns();
            int words = 0;
            while (!runs.get(words).text().equals("there are")) words++;
            assertTrue(runs.get(words).isItalic() && runs.get(words + 1).text().contains("3") && runs.get(words + 1).isItalic(), "the number of the English words is in italic");
            XWPFParagraph line = doc.getParagraphs().stream().filter(p -> p.getText().contains("Chữ ký học viên")).findFirst().orElseThrow();
            var stops = line.getCTP().getPPr().getTabs().getTabArray();
            assertEquals(2, stops.length, "two dotted leaders: for the signature and for the date, on one line");
            assertTrue(java.util.Arrays.stream(stops).allMatch(t -> t.getLeader() == org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabTlc.DOT));
            assertEquals(2, line.getRuns().stream().filter(r -> r.getCTR().sizeOfTabArray() > 0).count(), "a tab after each label");
            assertTrue(line.getRuns().stream().anyMatch(r -> r.isItalic() && r.text().equals("Assessment date")), "the English label is in italic");
        }
    }

    @Test
    void theEssayQuestionsContinueTheNumbersOrStartAgainAtOneAndTheAnswersAreNotIndented() throws IOException {
        TrainingAssessmentForm.Content c = content(questions(), false, false);
        for (boolean restart : new boolean[] {false, true}) {
            byte[] out = TrainingAssessmentForm.build(template(), new TrainingAssessmentForm.Content(c.items(), false, false, c.topics(), c.trainingNumber(), c.trainingType(), c.durationMinutes(), restart));
            try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out))) {
                String all = doc.getParagraphs().stream().map(XWPFParagraph::getText).reduce("", (x, y) -> x + "|" + y);
                assertEquals(restart, all.contains("Câu 1: Liệt kê"), "the essay is question 1 again when asked");
                assertEquals(!restart, all.contains("Câu 3: Liệt kê"), "or goes on after the last multiple-choice question");
                assertTrue(doc.getParagraphs().stream().filter(p -> p.getText().startsWith("☐")).allMatch(p -> p.getIndentationLeft() <= 0), "the answers are in line with the question");
            }
        }
    }

    @Test
    void theBoxWithACrossIsASymbolOfWingdingsForWordAndAUnicodeCharacterForAPdf() throws IOException {
        byte[] exam = TrainingAssessmentForm.build(template(), content(questions(), false, false));
        assertEquals(1, ticked(exam));
        assertEquals(1, ticked(TrainingAssessmentForm.personalize(exam, new TrainingAssessmentForm.Trainee("A", "B", "C", "01/01/2026"))), "the copy for Word keeps the symbol");
        byte[] pdfCopy = TrainingAssessmentForm.personalize(exam, new TrainingAssessmentForm.Trainee("A", "B", "C", "01/01/2026"), true);
        assertEquals(0, ticked(pdfCopy), "the document server does not draw the symbol");
        assertTrue(all(pdfCopy).contains("\u2612"), "a box with a cross as a character");
    }

    @Test
    void oneQuestionPointIsNotWrittenInThePlural() throws IOException {
        List<Map<String, Object>> one = List.of(item(1, "SINGLE", "Q", List.of(Map.of("id", "A", "text", "a"), Map.of("id", "B", "text", "b")), List.of("A"), 1, null));
        String text = all(TrainingAssessmentForm.build(template(), content(one, false, false)));
        assertTrue(text.contains("(1 điểm/ point)"));
        assertFalse(text.contains("(1 điểm/ points)"));
    }

    @Test
    void theTitleOfTheLibraryAssessmentIsNeverInTheForm() throws IOException {
        // the title is not an input of the form at all
        assertFalse(all(TrainingAssessmentForm.build(template(), content(questions(), false, false))).contains("TAS-"));
    }

    @Test
    void forOneTraineeTheNameTheCodeTheDepartmentTheDateAndTheFooterAreFilled() throws IOException {
        byte[] exam = TrainingAssessmentForm.build(template(), content(questions(), false, false));
        byte[] copy = TrainingAssessmentForm.personalize(exam, new TrainingAssessmentForm.Trainee("Nguyễn Văn An", "NV-0012", "Quality Assurance", "24/10/2026"));
        String text = all(copy);
        assertTrue(text.contains("Name of trainee: Nguyễn Văn An"));
        assertTrue(text.contains("ID code:Nguyễn") == false);
        assertTrue(text.contains("NV-0012"));
        assertTrue(text.contains("Department:Quality Assurance") || text.contains("Department: Quality Assurance") || text.contains("Quality Assurance"));
        assertTrue(text.contains("Date: 24/10/2026"));
        // what was known for the whole activity is still there, and the test duration is not taken for the date
        assertTrue(text.contains("Test duration 45 phút/ minutes"));
        // the copy of another trainee does not carry the first one
        String second = all(TrainingAssessmentForm.personalize(exam, new TrainingAssessmentForm.Trainee("Trần Thị Bình", "NV-0013", "Production", "24/10/2026")));
        assertTrue(second.contains("Name of trainee: Trần Thị Bình"));
        assertFalse(second.contains("Nguyễn Văn An"));
    }

    @Test
    void aFieldThatIsAlreadyFilledIsLeftAndAFileWithoutTheFieldsIsNotBroken() throws IOException {
        byte[] exam = TrainingAssessmentForm.build(template(), content(questions(), false, false));
        byte[] once = TrainingAssessmentForm.personalize(exam, new TrainingAssessmentForm.Trainee("Nguyễn Văn An", "NV-0012", "QA", "24/10/2026"));
        String again = all(TrainingAssessmentForm.personalize(once, new TrainingAssessmentForm.Trainee("Người Khác", "NV-9999", "XX", "01/01/2030")));
        assertTrue(again.contains("Nguyễn Văn An"));
        assertFalse(again.contains("Người Khác"));
        // a plain Word file that is not the form: nothing is found, nothing is written, nothing breaks
        try (XWPFDocument plain = new XWPFDocument(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            plain.createParagraph().createRun().setText("Just a file");
            plain.write(bytes);
            assertTrue(all(TrainingAssessmentForm.personalize(bytes.toByteArray(), new TrainingAssessmentForm.Trainee("A", "B", "C", "D"))).contains("Just a file"));
        }
    }

    @Test
    void aFileThatIsNotTheFormIsRefusedAndNeverGuessedAt() throws IOException {
        try (XWPFDocument plain = new XWPFDocument(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            plain.createParagraph().createRun().setText("1. Question one ........");
            plain.write(bytes);
            ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> TrainingAssessmentForm.build(bytes.toByteArray(), content(questions(), false, false)));
            assertEquals("TRAINING_FORM_TEMPLATE_STRUCTURE", e.getReason());
        }
    }

    @Test
    void moreTopicsThanLinesGetMoreLines() throws IOException {
        List<String> topics = List.of("Chủ đề 1", "Chủ đề 2", "Chủ đề 3", "Chủ đề 4", "Chủ đề 5");
        String text = all(TrainingAssessmentForm.build(template(), new TrainingAssessmentForm.Content(questions(), false, false, topics, "TRN/1", "INITIAL", null)));
        for (String t : topics) assertTrue(text.contains(t), t);
    }
}

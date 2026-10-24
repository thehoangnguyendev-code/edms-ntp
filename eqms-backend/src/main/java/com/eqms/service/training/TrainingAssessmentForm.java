package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.xmlbeans.XmlCursor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Writes the content of a Training Assessment of the library into the Word form APD.0009 that Training Administration enabled (Training Properties, Assessment Forms). The title of the
 * assessment in the library only identifies it there and is never written in the form. What goes in is the content of the form:
 * <ul>
 *   <li>the training topic, taken from the training activity (its sessions);</li>
 *   <li>case 1: the questions (single and multiple choice and true or false with a box before each answer, an essay with lines to write on), or case 2: a checklist table whose last two
 *       columns are Correct (Đúng) and Incorrect (Không đúng);</li>
 *   <li>for the trainer's copy, the key: the right boxes are ticked and the model answers are written.</li>
 * </ul>
 * Where it goes is found in the template itself, in this order: a mark {@code {{TRAINING_TOPIC}}} and a mark {@code {{QUESTIONS}}} when the template has them; otherwise the paragraph that
 * begins "Training topic" (its text after the colon is replaced) and the first run of numbered lines ("1. ..."), which are the model lines of the form and are replaced by the content. A
 * template in which neither the questions nor the model lines are found is refused with TRAINING_FORM_TEMPLATE_STRUCTURE: the form is never guessed at. The file is a Word file the
 * organizer can still open and change in the editor.
 */
public final class TrainingAssessmentForm {
    public static final String TOPIC_MARK = "{{TRAINING_TOPIC}}";
    public static final String QUESTIONS_MARK = "{{QUESTIONS}}";
    private static final String STRUCTURE = "TRAINING_FORM_TEMPLATE_STRUCTURE";
    private static final Pattern NUMBERED = Pattern.compile("^\\s*\\d+\\s*[.)].*");
    private static final Pattern TOPIC_LINE = Pattern.compile("^\\s*training\\s+topic\\b.*", Pattern.CASE_INSENSITIVE);
    private static final int ESSAY_LINES = 5;
    private static final String BOX = "☐";
    private static final String TICKED = "☒";

    private TrainingAssessmentForm() {
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String points(Object value) {
        BigDecimal p = new BigDecimal(String.valueOf(value)).stripTrailingZeros();
        if (p.scale() < 0) p = p.setScale(0);
        return p.toPlainString() + (p.compareTo(BigDecimal.ONE) == 0 ? " point" : " points");
    }

    /** Fills the template; {@code items} are the stored items of the assessment (see TrainingAssessmentLibraryService), {@code checklist} tells the case, {@code key} the trainer's copy. */
    public static byte[] fill(byte[] template, List<Map<String, Object>> items, boolean checklist, String topic, boolean key) {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(template)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            boolean topicDone = replaceMark(doc, TOPIC_MARK, topic);
            if (!topicDone) fillTopicLine(doc, topic);

            XWPFParagraph mark = findParagraph(doc, QUESTIONS_MARK);
            List<XWPFParagraph> model = new ArrayList<>();
            XWPFParagraph anchor;
            if (mark != null) {
                anchor = mark;
                model.add(mark);
            } else {
                anchor = null;
                for (IBodyElement e : doc.getBodyElements()) {
                    if (e instanceof XWPFParagraph p && NUMBERED.matcher(p.getText()).matches()) {
                        if (anchor == null) anchor = p;
                        model.add(p);
                    } else if (anchor != null) {
                        break;
                    }
                }
            }
            if (anchor == null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);

            Style style = Style.of(anchor);
            if (checklist) insertChecklist(doc, anchor, items, key, style);
            else insertQuestions(doc, anchor, items, key, style);
            for (XWPFParagraph p : model) doc.removeBodyElement(doc.getPosOfParagraph(p));
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    /** The look of the model line: the style of the paragraph and the font of its first run, so the content looks like the rest of the form. */
    private record Style(String paragraphStyle, String font, int size) {
        static Style of(XWPFParagraph p) {
            XWPFRun first = p.getRuns().isEmpty() ? null : p.getRuns().getFirst();
            return new Style(p.getStyle(), first == null ? null : first.getFontFamily(), first == null || first.getFontSize() <= 0 ? -1 : first.getFontSize());
        }
    }

    private static XWPFRun run(XWPFParagraph p, Style style, String value, boolean bold) {
        XWPFRun r = p.createRun();
        r.setText(value);
        r.setBold(bold);
        if (style.font() != null) r.setFontFamily(style.font());
        if (style.size() > 0) r.setFontSize(style.size());
        return r;
    }

    private static XWPFParagraph before(XWPFDocument doc, XWPFParagraph anchor, Style style) {
        try (XmlCursor cursor = anchor.getCTP().newCursor()) {
            XWPFParagraph p = doc.insertNewParagraph(cursor);
            if (style.paragraphStyle() != null) p.setStyle(style.paragraphStyle());
            return p;
        }
    }

    private static void insertQuestions(XWPFDocument doc, XWPFParagraph anchor, List<Map<String, Object>> items, boolean key, Style style) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> q : items) {
            total = total.add(new BigDecimal(String.valueOf(q.get("points"))));
            XWPFParagraph head = before(doc, anchor, style);
            head.setSpacingBefore(160);
            run(head, style, q.get("no") + ". " + text(q.get("prompt")), true);
            run(head, style, "  (" + points(q.get("points")) + ")", false);
            String kind = text(q.get("kind"));
            if ("ESSAY".equals(kind)) {
                if (key) {
                    XWPFParagraph model = before(doc, anchor, style);
                    run(model, style, "Model answer / Đáp án mẫu: " + (text(q.get("modelAnswer")).isEmpty() ? "-" : text(q.get("modelAnswer"))), false).setItalic(true);
                } else {
                    for (int i = 0; i < ESSAY_LINES; i++) run(before(doc, anchor, style), style, "_".repeat(86), false);
                }
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> options = (List<Map<String, Object>>) q.get("options");
            @SuppressWarnings("unchecked")
            List<String> correct = (List<String>) q.get("correct");
            if (options == null) continue;
            for (Map<String, Object> o : options) {
                boolean right = key && correct != null && correct.contains(text(o.get("id")));
                XWPFParagraph line = before(doc, anchor, style);
                line.setIndentationLeft(360);
                run(line, style, (right ? TICKED : BOX) + " " + text(o.get("id")) + ". " + text(o.get("text")), right);
            }
        }
        XWPFParagraph sum = before(doc, anchor, style);
        sum.setSpacingBefore(200);
        run(sum, style, "Total / Tổng: " + points(total), true);
    }

    private static void insertChecklist(XWPFDocument doc, XWPFParagraph anchor, List<Map<String, Object>> items, boolean key, Style style) {
        XWPFTable table;
        try (XmlCursor cursor = anchor.getCTP().newCursor()) {
            table = doc.insertNewTbl(cursor);
        }
        table.setTopBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.setBottomBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.setLeftBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.setRightBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.setInsideHBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        table.setInsideVBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "000000");
        XWPFTableRow header = table.getRow(0);
        cell(header, 0, style, "No.", true);
        cell(header, 1, style, "Content / Nội dung", true);
        cell(header, 2, style, "Correct / Đúng", true);
        cell(header, 3, style, "Incorrect / Không đúng", true);
        for (Map<String, Object> line : items) {
            @SuppressWarnings("unchecked")
            List<String> correct = (List<String>) line.get("correct");
            XWPFTableRow row = table.createRow();
            cell(row, 0, style, text(line.get("no")), false);
            cell(row, 1, style, text(line.get("prompt")), false);
            cell(row, 2, style, key && correct != null && correct.contains("CORRECT") ? TICKED : BOX, false).getParagraphs().getFirst().setAlignment(ParagraphAlignment.CENTER);
            cell(row, 3, style, key && correct != null && correct.contains("INCORRECT") ? TICKED : BOX, false).getParagraphs().getFirst().setAlignment(ParagraphAlignment.CENTER);
        }
    }

    private static XWPFTableCell cell(XWPFTableRow row, int index, Style style, String value, boolean bold) {
        XWPFTableCell c = row.getCell(index) != null ? row.getCell(index) : row.addNewTableCell();
        XWPFParagraph p = c.getParagraphs().isEmpty() ? c.addParagraph() : c.getParagraphs().getFirst();
        for (int i = p.getRuns().size() - 1; i >= 0; i--) p.removeRun(i);
        run(p, style, value, bold);
        return c;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the marks and the topic line

    private static List<XWPFParagraph> allParagraphs(XWPFDocument doc) {
        List<XWPFParagraph> out = new ArrayList<>(doc.getParagraphs());
        for (XWPFTable t : doc.getTables()) for (XWPFTableRow r : t.getRows()) for (XWPFTableCell c : r.getTableCells()) out.addAll(c.getParagraphs());
        return out;
    }

    private static XWPFParagraph findParagraph(XWPFDocument doc, String mark) {
        for (XWPFParagraph p : doc.getParagraphs()) if (p.getText().contains(mark)) return p;
        return null;
    }

    /** The text of a paragraph is set in its first run, with the other runs emptied: the look of the first run stays. */
    private static void setParagraphText(XWPFParagraph p, String value) {
        List<XWPFRun> runs = p.getRuns();
        if (runs.isEmpty()) {
            p.createRun().setText(value);
            return;
        }
        runs.getFirst().setText(value, 0);
        for (int i = runs.size() - 1; i >= 1; i--) p.removeRun(i);
    }

    private static boolean replaceMark(XWPFDocument doc, String mark, String value) {
        boolean any = false;
        for (XWPFParagraph p : allParagraphs(doc)) {
            if (p.getText().contains(mark)) {
                setParagraphText(p, p.getText().replace(mark, value));
                any = true;
            }
        }
        return any;
    }

    /** "Training topic: ........" becomes "Training topic: <the topic>": the label is kept, what follows the colon is replaced. */
    private static void fillTopicLine(XWPFDocument doc, String topic) {
        for (XWPFParagraph p : allParagraphs(doc)) {
            String t = p.getText();
            if (!TOPIC_LINE.matcher(t).matches()) continue;
            int colon = t.indexOf(':');
            setParagraphText(p, (colon >= 0 ? t.substring(0, colon + 1) : t.trim() + ":") + " " + topic);
            return;
        }
    }
}

package com.eqms.service.training;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The paper of a Training Assessment (APD.0009), drawn from the frozen copy an activity keeps of the assessment it chose.
 * <ul>
 *   <li>Case 1, a question test: each question with its points; single and multiple choice show a box in front of every answer, true or false shows two boxes, an essay shows ruled lines to write on.</li>
 *   <li>Case 2, a checklist: a table with the line and two columns, "Correct" (Đúng) and "Incorrect" (Không đúng), each with a box to tick.</li>
 * </ul>
 * The paper for the trainees carries no key. The paper for the trainer ({@code key = true}) marks the expected answers and prints the model answer of an essay; it is headed as controlled and
 * is never handed out. The pages of a trainee are stamped afterwards with the Training Number, the name and a signature line (see TrainingExamPackService).
 */
public final class TrainingAssessmentPaper {
    private static final float MARGIN = 40;
    private static final float BOTTOM = 52;
    private static final float WIDTH = PDRectangle.A4.getWidth() - 2 * MARGIN;
    private static final int ESSAY_LINES = 6;

    private TrainingAssessmentPaper() {
    }

    /** The drawing state of one document: the current page and where the next line goes. */
    private static final class Pen implements AutoCloseable {
        final PDDocument doc;
        final PDType0Font font;
        final PDType0Font strong;
        final String footer;
        PDPage page;
        PDPageContentStream out;
        float y;

        Pen(PDDocument doc, PDType0Font font, PDType0Font strong, String footer) throws IOException {
            this.doc = doc;
            this.font = font;
            this.strong = strong;
            this.footer = footer;
            newPage();
        }

        void newPage() throws IOException {
            if (out != null) out.close();
            page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            out = new PDPageContentStream(doc, page);
            y = PDRectangle.A4.getHeight() - MARGIN;
            out.setNonStrokingColor(0.4f, 0.4f, 0.4f);
            text(font, 7, MARGIN, BOTTOM - 22, footer);
            out.setNonStrokingColor(0f, 0f, 0f);
        }

        /** Makes room for a block of the given height; a new page when it does not fit. */
        void room(float height) throws IOException {
            if (y - height < BOTTOM) newPage();
        }

        void text(PDType0Font f, float size, float x, float yy, String value) throws IOException {
            out.beginText();
            out.setFont(f, size);
            out.newLineAtOffset(x, yy);
            out.showText(clean(f, value));
            out.endText();
        }

        /** Writes a paragraph wrapped to the width; returns the number of lines. */
        int paragraph(PDType0Font f, float size, float x, float width, String value) throws IOException {
            List<String> lines = wrap(f, size, width, value);
            float lead = size + 3.5f;
            for (String line : lines) {
                room(lead);
                y -= lead;
                text(f, size, x, y, line);
            }
            return lines.size();
        }

        void box(float x, float yy, float size, boolean checked) throws IOException {
            out.setLineWidth(0.8f);
            out.addRect(x, yy, size, size);
            out.stroke();
            if (checked) {
                out.setLineWidth(1.6f);
                out.moveTo(x + 2, yy + size / 2);
                out.lineTo(x + size / 2.4f, yy + 2);
                out.lineTo(x + size - 1.5f, yy + size - 2);
                out.stroke();
            }
        }

        void rule(float x1, float x2, float yy) throws IOException {
            out.setLineWidth(0.5f);
            out.moveTo(x1, yy);
            out.lineTo(x2, yy);
            out.stroke();
        }

        @Override
        public void close() throws IOException {
            if (out != null) out.close();
        }
    }

    /** Characters the font cannot draw (control characters) are dropped; a line break inside a text is a space. */
    private static String clean(PDType0Font font, String value) {
        StringBuilder sb = new StringBuilder();
        for (int cp : (value == null ? "" : value).codePoints().toArray()) {
            if (cp == '\n' || cp == '\r' || cp == '\t') sb.append(' ');
            else if (!Character.isISOControl(cp)) sb.appendCodePoint(cp);
        }
        return sb.toString();
    }

    private static float width(PDType0Font f, float size, String s) throws IOException {
        return f.getStringWidth(clean(f, s)) / 1000f * size;
    }

    /** Words are kept together; a word longer than the line is cut where it must be. */
    static List<String> wrap(PDType0Font f, float size, float max, String value) throws IOException {
        List<String> lines = new ArrayList<>();
        for (String paragraph : (value == null ? "" : value).split("\\r?\\n", -1)) {
            StringBuilder line = new StringBuilder();
            for (String word : paragraph.trim().split("\\s+")) {
                if (word.isEmpty()) continue;
                String candidate = line.length() == 0 ? word : line + " " + word;
                if (width(f, size, candidate) <= max) {
                    line = new StringBuilder(candidate);
                    continue;
                }
                if (line.length() > 0) lines.add(line.toString());
                line = new StringBuilder();
                String rest = word;
                while (width(f, size, rest) > max) {
                    int cut = rest.length() - 1;
                    while (cut > 1 && width(f, size, rest.substring(0, cut)) > max) cut--;
                    lines.add(rest.substring(0, cut));
                    rest = rest.substring(cut);
                }
                line.append(rest);
            }
            lines.add(line.toString());
        }
        return lines;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String points(Object value) {
        BigDecimal p = new BigDecimal(String.valueOf(value)).stripTrailingZeros();
        return p.toPlainString() + (p.compareTo(BigDecimal.ONE) == 0 ? " point" : " points");
    }

    @SuppressWarnings("unchecked")
    public static byte[] render(Map<String, Object> snapshot, boolean key, String footer) {
        try (PDDocument doc = new PDDocument(); InputStream regular = TrainingAssessmentPaper.class.getResourceAsStream("/fonts/Tinos-Regular.ttf");
             InputStream bold = TrainingAssessmentPaper.class.getResourceAsStream("/fonts/Tinos-Bold.ttf"); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            if (regular == null || bold == null) throw new IllegalStateException("FONT_UNAVAILABLE");
            PDType0Font font = PDType0Font.load(doc, regular), strong = PDType0Font.load(doc, bold);
            try (Pen pen = new Pen(doc, font, strong, footer)) {
                boolean checklist = "CHECKLIST".equals(text(snapshot.get("kind")));
                if (key) {
                    pen.out.setNonStrokingColor(0.75f, 0.1f, 0.1f);
                    pen.y -= 12;
                    pen.text(strong, 10, MARGIN, pen.y, "ANSWER KEY / Đáp án - for the trainer only, never handed out");
                    pen.out.setNonStrokingColor(0f, 0f, 0f);
                    pen.y -= 8;
                }
                pen.y -= 14;
                pen.text(strong, 14, MARGIN, pen.y, checklist ? "TRAINING ASSESSMENT / Đánh giá đào tạo - Checklist" : "TRAINING ASSESSMENT / Đánh giá đào tạo - Test");
                pen.y -= 6;
                pen.paragraph(strong, 11, MARGIN, WIDTH, text(snapshot.get("title")));
                // A checklist has no score; a test shows its total.
                pen.paragraph(font, 9, MARGIN, WIDTH, "Assessment " + text(snapshot.get("code")) + " v" + text(snapshot.get("version")) + (checklist ? "" : "   Total " + points(snapshot.get("maxScore"))));
                pen.y -= 4;
                if (!key) {
                    pen.paragraph(font, 9, MARGIN, WIDTH, checklist
                            ? "For each line, tick one of the two columns: Correct (Đúng) or Incorrect (Không đúng)."
                            : "Choose the right answer(s) by ticking the box. Write the answer of an essay question on the lines.");
                }
                pen.y -= 6;
                List<Map<String, Object>> items = (List<Map<String, Object>>) snapshot.get("items");
                if (checklist) checklist(pen, items, key);
                else questions(pen, items, key);
            }
            doc.save(buffer);
            return buffer.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    @SuppressWarnings("unchecked")
    private static void questions(Pen pen, List<Map<String, Object>> items, boolean key) throws IOException {
        for (Map<String, Object> q : items) {
            String kind = text(q.get("kind"));
            List<Map<String, Object>> options = (List<Map<String, Object>>) q.get("options");
            List<String> correct = (List<String>) q.get("correct");
            pen.y -= 6;
            // keep the question and its first answers together
            pen.room(60);
            int lines = pen.paragraph(pen.strong, 10.5f, MARGIN, WIDTH - 70, q.get("no") + ". " + text(q.get("prompt")));
            float top = pen.y + lines * 13.5f;
            pen.text(pen.font, 8.5f, MARGIN + WIDTH - 62, top - 10, "(" + points(q.get("points")) + ")");
            if ("ESSAY".equals(kind)) {
                if (key) {
                    pen.out.setNonStrokingColor(0.1f, 0.4f, 0.1f);
                    pen.paragraph(pen.font, 9, MARGIN + 14, WIDTH - 14, "Model answer / Đáp án mẫu: " + (text(q.get("modelAnswer")).isEmpty() ? "-" : text(q.get("modelAnswer"))));
                    pen.out.setNonStrokingColor(0f, 0f, 0f);
                } else {
                    for (int i = 0; i < ESSAY_LINES; i++) {
                        pen.room(20);
                        pen.y -= 20;
                        pen.rule(MARGIN, MARGIN + WIDTH, pen.y);
                    }
                }
                continue;
            }
            if (options == null) continue;
            for (Map<String, Object> o : options) {
                List<String> wrapped = wrap(pen.font, 10, WIDTH - 40, text(o.get("id")) + ". " + text(o.get("text")));
                pen.room(wrapped.size() * 13.5f + 4);
                boolean right = key && correct != null && correct.contains(text(o.get("id")));
                pen.y -= 14;
                pen.box(MARGIN + 14, pen.y - 1, 9, right);
                for (int i = 0; i < wrapped.size(); i++) {
                    if (i > 0) pen.y -= 13.5f;
                    if (right) pen.out.setNonStrokingColor(0.1f, 0.4f, 0.1f);
                    pen.text(right ? pen.strong : pen.font, 10, MARGIN + 30, pen.y, wrapped.get(i));
                    pen.out.setNonStrokingColor(0f, 0f, 0f);
                }
            }
        }
    }

    private static void checklist(Pen pen, List<Map<String, Object>> items, boolean key) throws IOException {
        float colNo = 28, colBox = 78;
        float colText = WIDTH - colNo - 2 * colBox;
        float x0 = MARGIN, x1 = x0 + colNo, x2 = x1 + colText, x3 = x2 + colBox, x4 = x3 + colBox;
        header(pen, x0, x1, x2, x3, x4);
        for (Map<String, Object> row : items) {
            List<String> wrapped = wrap(pen.font, 10, colText - 10, text(row.get("prompt")));
            float h = Math.max(24, wrapped.size() * 13.5f + 10);
            if (pen.y - h < BOTTOM) {
                pen.newPage();
                pen.y -= 6;
                header(pen, x0, x1, x2, x3, x4);
            }
            float top = pen.y;
            float bottom = top - h;
            pen.out.setLineWidth(0.6f);
            for (float x : new float[] {x0, x1, x2, x3, x4}) {
                pen.out.moveTo(x, top);
                pen.out.lineTo(x, bottom);
            }
            pen.out.moveTo(x0, bottom);
            pen.out.lineTo(x4, bottom);
            pen.out.stroke();
            pen.text(pen.font, 10, x0 + 6, top - 15, text(row.get("no")));
            for (int i = 0; i < wrapped.size(); i++) pen.text(pen.font, 10, x1 + 5, top - 15 - i * 13.5f, wrapped.get(i));
            @SuppressWarnings("unchecked")
            List<String> correct = (List<String>) row.get("correct");
            boolean expectCorrect = key && correct != null && correct.contains("CORRECT");
            boolean expectIncorrect = key && correct != null && correct.contains("INCORRECT");
            float mid = top - h / 2 - 4.5f;
            pen.box((x2 + x3) / 2 - 4.5f, mid, 9, expectCorrect);
            pen.box((x3 + x4) / 2 - 4.5f, mid, 9, expectIncorrect);
            pen.y = bottom;
        }
    }

    private static void header(Pen pen, float x0, float x1, float x2, float x3, float x4) throws IOException {
        float top = pen.y;
        float bottom = top - 24;
        pen.out.setLineWidth(0.8f);
        pen.out.addRect(x0, bottom, x4 - x0, 24);
        pen.out.stroke();
        for (float x : new float[] {x1, x2, x3}) {
            pen.out.moveTo(x, top);
            pen.out.lineTo(x, bottom);
        }
        pen.out.stroke();
        pen.text(pen.strong, 9, x0 + 6, top - 15, "No.");
        pen.text(pen.strong, 9, x1 + 5, top - 15, "Content / Nội dung");
        pen.text(pen.strong, 9, x2 + 10, top - 10, "Correct");
        pen.text(pen.strong, 9, x2 + 10, top - 20, "Đúng");
        pen.text(pen.strong, 9, x3 + 6, top - 10, "Incorrect");
        pen.text(pen.strong, 9, x3 + 6, top - 20, "Không đúng");
        pen.y = bottom;
    }
}

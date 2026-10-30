package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.BodyElementType;
import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPictureData;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTHdrFtr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTHeight;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTc;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTrPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STHeightRule;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblWidth;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTabStop;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabJc;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabTlc;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSimpleField;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl;
import org.springframework.http.HttpStatus;
import static com.eqms.service.training.TrainingWordForms.field;
import static com.eqms.service.training.TrainingWordForms.moveToHeader;
import static com.eqms.service.training.TrainingWordForms.run;
import org.springframework.web.server.ResponseStatusException;

import javax.xml.namespace.QName;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The form APD.0009 (Training assessment) written for a training activity, from the Word file that Training Administration enabled (Training Properties, Assessment Forms), as the form is
 * laid out in the file of the company: a header table with the logo, the title and the page number, a footer with the training number and the signature of the trainee, the table of the
 * facts of the training (topics, training number, the trainee, the date and the duration, the type of training, the remarks and the result) and the test content, as case 1 (questions) or
 * case 2 (a checklist with the columns Correct and Incorrect).
 * <ul>
 *   <li>{@link #build}: what is known for the whole activity goes in (the topics, the training number, the type of training, the duration of the test) and the content of the assessment of the
 *       library; the instructions printed in the template (about the header, the footer, the two cases) and its history of revisions are taken out. The trainee's own fields stay as dots.</li>
 *   <li>{@link #personalize}: what is known for one trainee goes in (name, ID code, department, date, and the trainee in the footer). It works on any copy of the form: a field that is already
 *       filled is left as it is and a field that cannot be found is skipped.</li>
 * </ul>
 * The title of the assessment in the library is never written in the form. A template in which the table of the facts or the heading of the content cannot be found is refused with
 * TRAINING_FORM_TEMPLATE_STRUCTURE: the form is never guessed at.
 */
public final class TrainingAssessmentForm {
    private static final String STRUCTURE = "TRAINING_FORM_TEMPLATE_STRUCTURE";
    private static final String R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static final Pattern DOTS = Pattern.compile("…+\\.?|\\.{4,}");
    private static final int ESSAY_LINES = 8;
    private static final int PART_ONE = 1;
    private static final int PART_TWO = 2;

    /** What is known for the whole activity, and the content. {@code topics} may be empty and {@code trainingType} null: the template keeps its dots and boxes. */
    public record Content(List<Map<String, Object>> items, boolean checklist, boolean key, List<String> topics, String trainingNumber, String trainingType, Integer durationMinutes, boolean essayRestart) {
        public Content(List<Map<String, Object>> items, boolean checklist, boolean key, List<String> topics, String trainingNumber, String trainingType, Integer durationMinutes) {
            this(items, checklist, key, topics, trainingNumber, trainingType, durationMinutes, false);
        }
    }

    /** What is known for one trainee. */
    public record Trainee(String name, String code, String department, String date) {
    }

    private TrainingAssessmentForm() {
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String points(Object value) {
        BigDecimal p = new BigDecimal(String.valueOf(value)).stripTrailingZeros();
        if (p.scale() < 0) p = p.setScale(0);
        return p.toPlainString();
    }

    private static ResponseStatusException structure() {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ build

    public static byte[] build(byte[] template, Content c) {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(template)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFTable headerTable = null, footerTable = null, facts = null, checklistTable = null, history = null;
            XWPFParagraph content = null, count = null, complies = null, signatureLine = null;
            List<XWPFParagraph> notes = new ArrayList<>();
            for (IBodyElement e : doc.getBodyElements()) {
                if (e.getElementType() == BodyElementType.TABLE) {
                    XWPFTable t = (XWPFTable) e;
                    String all = tableText(t);
                    if (all.contains("TRAINING ASSESSMENT") && all.contains("Page:")) headerTable = t;
                    else if (all.contains("Sign:") && all.contains("Date:") && t.getRows().size() == 1) footerTable = t;
                    else if (all.contains("Training topic")) facts = t;
                    else if (all.contains("Contents of the steps")) checklistTable = t;
                    else if (all.contains("Description of change")) history = t;
                } else if (e.getElementType() == BodyElementType.PARAGRAPH) {
                    XWPFParagraph p = (XWPFParagraph) e;
                    String t = p.getText();
                    if (t.contains("Test content")) content = p;
                    else if (t.contains("there are") && t.contains("questions")) count = p;
                    else if (t.contains("Signature of trainee")) signatureLine = p;
                    else if (t.contains("Document template complies")) { complies = p; notes.add(p); }
                    else if (t.startsWith("- ") || t.contains("Sử dụng một trong hai mẫu") || t.startsWith("TH1") || t.startsWith("TH2") || t.contains("LỊCH SỬ SỬA ĐỔI")) notes.add(p);
                }
            }
            if (facts == null || content == null || count == null || (c.checklist() && checklistTable == null)) throw structure();

            // the instructions in the lines after the heading of the content ("<Built according to ...>") are taken out of that line
            cutAfterHeading(content);
            // the empty lines the template has between the heading and the end of the test are taken out before the content is written, so that the lines of the content are never taken for them
            removeEmptyBetween(doc, content, count);

            // header and footer: what the template says they hold
            if (headerTable != null) {
                moveToHeader(doc, headerTable);
            }
            moveToFooter(doc, footerTable, complies);
            CTSectPr sect = doc.getDocument().getBody().isSetSectPr() ? doc.getDocument().getBody().getSectPr() : doc.getDocument().getBody().addNewSectPr();
            if (sect.isSetPgMar()) {
                sect.getPgMar().setTop(BigInteger.valueOf(794));
                sect.getPgMar().setHeader(BigInteger.valueOf(567));
            }

            fillFacts(facts, c);

            if (c.checklist()) {
                fillChecklist(checklistTable, c.items(), c.key());
                setCount(count, c.items().size());
            } else {
                insertQuestions(doc, count, c.items(), c.key(), c.essayRestart());
                setCount(count, c.items().size());
            }

            if (c.key()) keyBanner(doc, facts);

            for (XWPFParagraph p : notes) removeParagraph(doc, p);
            if (history != null) doc.removeBodyElement(doc.getPosOfTable(history));
            if (!c.checklist() && checklistTable != null) doc.removeBodyElement(doc.getPosOfTable(checklistTable));
            dropTrailingEmpty(doc);
            lastPage(doc, count, signatureLine);
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    private static String tableText(XWPFTable t) {
        StringBuilder sb = new StringBuilder();
        for (XWPFTableRow r : t.getRows()) for (XWPFTableCell c : r.getTableCells()) sb.append(c.getText()).append('\n');
        return sb.toString();
    }

    private static void removeParagraph(XWPFDocument doc, XWPFParagraph p) {
        int pos = doc.getPosOfParagraph(p);
        if (pos >= 0) doc.removeBodyElement(pos);
    }

    /** The line "Nội dung câu hỏi/ Test content:" keeps its heading; the instruction after the colon ("<Built according to the training content>") goes. */
    private static void cutAfterHeading(XWPFParagraph p) {
        boolean afterColon = false;
        List<XWPFRun> runs = p.getRuns();
        for (int i = 0; i < runs.size(); i++) {
            String t = text(runs.get(i).getText(0));
            if (afterColon) {
                p.removeRun(i);
                runs = p.getRuns();
                i--;
            } else if (t.contains(":")) {
                afterColon = true;
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ header, footer

    /** The footer of every page but the last: the signature and the date of the trainee, and under it the note that the template complies with the SOP. */
    private static void moveToFooter(XWPFDocument doc, XWPFTable signature, XWPFParagraph complies) {
        XWPFFooter footer = doc.createFooter(HeaderFooterType.DEFAULT);
        CTHdrFtr ct = footer._getHdrFtr();
        while (ct.sizeOfPArray() > 0) ct.removeP(0);
        if (signature != null) {
            ct.addNewTbl().set((CTTbl) signature.getCTTbl().copy());
            doc.removeBodyElement(doc.getPosOfTable(signature));
        }
        if (complies != null) ct.addNewP().set(complies.getCTP().copy());
        else ct.addNewP();
    }

    /** The end of the test (the number of questions, the signature of the trainee and the date to write by hand) follows the last question on the same page. */
    private static void lastPage(XWPFDocument doc, XWPFParagraph count, XWPFParagraph signature) {
        count.setSpacingBefore(360);
        count.setKeepNext(true);
        if (signature != null) signatureLine(doc, signature);
    }

    /** One line, never wrapped: the label of the signature, a dotted leader to the middle of the line, the label of the date and a dotted leader to the right margin (the trainee writes on the dots). */
    private static void signatureLine(XWPFDocument doc, XWPFParagraph p) {
        CTRPr look = lookOf(p);
        while (!p.getRuns().isEmpty()) p.removeRun(0);
        p.setAlignment(org.apache.poi.xwpf.usermodel.ParagraphAlignment.LEFT);
        text(p, "Chữ ký học viên/", false, look);
        text(p, "Signature of trainee", false, look).setItalic(true);
        text(p, ":", false, look);
        p.createRun().addTab();
        text(p, " Ngày kiểm tra/", false, look);
        text(p, "Assessment date", false, look).setItalic(true);
        text(p, ":", false, look);
        p.createRun().addTab();
        CTSectPr sect = doc.getDocument().getBody().getSectPr();
        long width = 9000;
        if (sect != null && sect.isSetPgSz() && sect.isSetPgMar()) width = Long.parseLong(String.valueOf(sect.getPgSz().getW())) - Long.parseLong(String.valueOf(sect.getPgMar().getLeft())) - Long.parseLong(String.valueOf(sect.getPgMar().getRight()));
        var tabs = (p.getCTP().isSetPPr() ? p.getCTP().getPPr() : p.getCTP().addNewPPr()).addNewTabs();
        var middle = tabs.addNewTab();
        middle.setVal(org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabJc.LEFT);
        middle.setLeader(org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabTlc.DOT);
        middle.setPos(BigInteger.valueOf(width * 11 / 20));
        var end = tabs.addNewTab();
        end.setVal(org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabJc.RIGHT);
        end.setLeader(org.openxmlformats.schemas.wordprocessingml.x2006.main.STTabTlc.DOT);
        end.setPos(BigInteger.valueOf(width));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the facts of the training

    private static List<XWPFParagraph> cellParagraphs(XWPFTable t) {
        List<XWPFParagraph> out = new ArrayList<>();
        for (XWPFTableRow r : t.getRows()) for (XWPFTableCell cell : r.getTableCells()) out.addAll(cell.getParagraphs());
        return out;
    }

    private static void fillFacts(XWPFTable facts, Content c) {
        List<XWPFParagraph> paragraphs = cellParagraphs(facts);
        // the topics: the lines of dots under "Training topic" take one topic each; the lines that are not needed go
        int first = -1;
        for (int i = 0; i < paragraphs.size(); i++) if (paragraphs.get(i).getText().contains("Training topic")) { first = i; break; }
        if (first >= 0 && c.topics() != null && !c.topics().isEmpty()) {
            List<XWPFParagraph> slots = new ArrayList<>();
            for (int i = first + 1; i < paragraphs.size() && paragraphs.get(i).getText().trim().matches("[\u2026.\\s]+"); i++) slots.add(paragraphs.get(i));
            if (!slots.isEmpty()) {
                // more topics than lines: more lines like the last one
                while (slots.size() < c.topics().size()) {
                    XWPFParagraph last = slots.getLast();
                    try (XmlCursor source = last.getCTP().newCursor(); XmlCursor at = last.getCTP().newCursor()) {
                        at.toEndToken();
                        at.toNextToken();
                        source.copyXml(at);
                    }
                    try (XmlCursor next = last.getCTP().newCursor()) {
                        next.toEndToken();
                        next.toNextToken();
                        slots.add(new XWPFParagraph((CTP) next.getObject(), last.getBody()));
                    }
                }
                for (int k = 0; k < c.topics().size(); k++) setAll(slots.get(k), c.topics().get(k));
                for (int k = slots.size() - 1; k >= c.topics().size(); k--) {
                    // a line of the template is taken out through its cell, so that the cell does not keep it
                    XWPFTableCell cell = (XWPFTableCell) slots.get(k).getBody();
                    int at = cell.getParagraphs().indexOf(slots.get(k));
                    if (at >= 0) cell.removeParagraph(at);
                }
            }
        }
        paragraphs = cellParagraphs(facts);
        for (XWPFParagraph p : paragraphs) {
            if (!p.getText().contains("Training number:")) continue;
            if (c.trainingNumber() != null && !c.trainingNumber().isBlank() && !p.getRuns().isEmpty()) {
                XWPFRun last = p.getRuns().getLast();
                last.setText(" " + c.trainingNumber(), 0);
            }
        }
        if (c.durationMinutes() != null) {
            for (XWPFParagraph p : paragraphs) if (p.getText().contains("Test duration")) fillAfter(p, "Test duration", c.durationMinutes() + " phút/ minutes");
        }
        if (c.trainingType() != null) tickType(paragraphs, c.trainingType());
    }

    /** The whole text of a paragraph is replaced and the first run keeps its look. */
    private static void setAll(XWPFParagraph p, String value) {
        List<XWPFRun> runs = p.getRuns();
        if (runs.isEmpty()) {
            p.createRun().setText(value);
            return;
        }
        runs.getFirst().setText(value, 0);
        for (int i = runs.size() - 1; i >= 1; i--) p.removeRun(i);
    }

    /** The box before the line of the type of the training is ticked: the empty box becomes a box with a cross. */
    private static void tickType(List<XWPFParagraph> paragraphs, String type) {
        String wanted = switch (type) {
            case "INITIAL" -> "lần đầu";
            case "RETRAINING" -> "đào tạo lại";
            case "PERIODIC" -> "định kỳ";
            case "UNPLANNED" -> "đột xuất";
            default -> null;
        };
        if (wanted == null) return;
        for (XWPFParagraph p : paragraphs) {
            String t = p.getText().toLowerCase(java.util.Locale.ROOT);
            if (!t.contains(wanted.toLowerCase(java.util.Locale.ROOT)) || p.getRuns().isEmpty()) continue;
            if (t.contains("không đạt") || t.contains("đạt yêu cầu")) continue;
            for (XWPFRun r : p.getRuns()) {
                if (r.getCTR().sizeOfSymArray() > 0) {
                    // the empty box of the form is the symbol F06F of Wingdings; the box with a cross is F0FD of the same font. Word draws it; the document server does not, so
                    // a copy that goes to a PDF has the Unicode character instead (see personalize)
                    r.getCTR().getSymArray(0).setChar(new byte[] {(byte) 0xF0, (byte) 0xFD});
                    return;
                }
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the blanks of a paragraph

    private static String runText(XWPFRun r) {
        String t = r.getText(0);
        return t == null ? "" : t;
    }

    /**
     * Writes a value in the dots that follow a label in a paragraph (the label and the dots may be in different runs). The dots must follow the label closely, with no other word between,
     * so a field that is already filled, or a label that is not there, is left alone. Returns whether something was written.
     */
    static boolean fillAfter(XWPFParagraph p, String labelRegex, String value) {
        List<XWPFRun> runs = p.getRuns();
        int[] starts = new int[runs.size()];
        StringBuilder all = new StringBuilder();
        for (int i = 0; i < runs.size(); i++) {
            starts[i] = all.length();
            all.append(runText(runs.get(i)));
        }
        Matcher label = Pattern.compile(labelRegex).matcher(all);
        if (!label.find()) return false;
        Matcher dots = DOTS.matcher(all);
        dots.region(label.end(), all.length());
        if (!dots.find()) return false;
        String gap = all.substring(label.end(), dots.start());
        if (gap.length() > 8 || gap.matches(".*\\p{L}.*")) return false;
        int s = dots.start(), e = dots.end();
        // a value that would touch the label ("ID code:TEST") is set apart from it
        String lead = s > 0 && !Character.isWhitespace(all.charAt(s - 1)) ? " " : "";
        boolean written = false;
        for (int i = 0; i < runs.size(); i++) {
            String old = runText(runs.get(i));
            int rs = starts[i], re = rs + old.length();
            if (old.isEmpty() || re <= s || rs >= e) continue;
            String before = old.substring(0, Math.max(s, rs) - rs);
            String after = old.substring(Math.min(e, re) - rs);
            runs.get(i).setText(before + (written ? "" : lead + value) + after, 0);
            if (!written) {
                // what is written in a form is in Times New Roman, 12 pt
                runs.get(i).setFontFamily("Times New Roman");
                runs.get(i).setFontSize(12);
            }
            written = true;
        }
        return written;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the content

    private static CTRPr lookOf(XWPFParagraph p) {
        for (XWPFRun r : p.getRuns()) if (r.getCTR().getRPr() != null) return (CTRPr) r.getCTR().getRPr().copy();
        return null;
    }

    private static XWPFRun text(XWPFParagraph p, String value, boolean bold, CTRPr look) {
        XWPFRun r = p.createRun();
        if (look != null) r.getCTR().setRPr((CTRPr) look.copy());
        r.setBold(bold);
        r.setItalic(false);
        r.setText(value);
        return r;
    }

    /** An empty line to write on: a tab that is filled with dots up to the right margin. */
    private static void writingLine(XWPFParagraph p, CTRPr look) {
        // A ruled line in a light colour for the trainee to write on. The lines of one answer are paragraphs with the same border: Word draws the line between them with "between" and under the last one with "bottom".
        CTPPr ppr = p.getCTP().isSetPPr() ? p.getCTP().getPPr() : p.getCTP().addNewPPr();
        org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPBdr bdr = ppr.addNewPBdr();
        for (org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBorder b : new org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBorder[] {bdr.addNewBetween(), bdr.addNewBottom()}) {
            b.setVal(org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder.SINGLE);
            b.setSz(BigInteger.valueOf(4));
            b.setSpace(BigInteger.ONE);
            b.setColor("BFBFBF");
        }
        org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSpacing spacing = ppr.isSetSpacing() ? ppr.getSpacing() : ppr.addNewSpacing();
        spacing.setLine(BigInteger.valueOf(440));
        spacing.setLineRule(org.openxmlformats.schemas.wordprocessingml.x2006.main.STLineSpacingRule.EXACT);
        XWPFRun r = p.createRun();
        if (look != null) r.getCTR().setRPr((CTRPr) look.copy());
    }

    private static void tickMark(XWPFParagraph p, CTRPr look) {
        XWPFRun r = p.createRun();
        if (look != null) r.getCTR().setRPr((CTRPr) look.copy());
        r.setBold(true);
        var sym = r.getCTR().addNewSym();
        sym.setFont("Wingdings");
        sym.setChar(new byte[] {(byte) 0xF0, (byte) 0xFC});
    }

    private static XWPFParagraph before(XWPFDocument doc, XWPFParagraph anchor) {
        try (XmlCursor cursor = anchor.getCTP().newCursor()) {
            return doc.insertNewParagraph(cursor);
        }
    }

    /** Case 1: Part I the questions with answers to choose from, Part II the essay questions; numbered through, with the points of each. */
    private static void insertQuestions(XWPFDocument doc, XWPFParagraph anchor, List<Map<String, Object>> items, boolean key, boolean essayRestart) {
        CTRPr look = lookOf(anchor);
        List<Map<String, Object>> choice = new ArrayList<>(), essay = new ArrayList<>();
        for (Map<String, Object> q : items) (text(q.get("kind")).equals("ESSAY") ? essay : choice).add(q);
        if (!choice.isEmpty()) {
            XWPFParagraph part = before(doc, anchor);
            text(part, "Phần I: Câu hỏi trắc nghiệm / Part I: Multiple-choice questions", true, look);
            for (Map<String, Object> q : choice) question(doc, anchor, q, q.get("no"), key, look, PART_ONE);
        }
        if (!essay.isEmpty()) {
            XWPFParagraph part = before(doc, anchor);
            part.setSpacingBefore(200);
            text(part, "Phần II: Câu hỏi tự luận / Part II: Essay questions", true, look);
            int n = 0;
            for (Map<String, Object> q : essay) question(doc, anchor, q, essayRestart ? (Object) (++n) : q.get("no"), key, look, PART_TWO);
        }
    }

    /** The picture of a question (a data URL, PNG or JPEG), under its text, at most 12 cm wide and 8 cm high. */
    private static void picture(XWPFDocument doc, XWPFParagraph anchor, Object image) {
        if (!(image instanceof String data) || !data.startsWith("data:image/")) return;
        try {
            boolean png = data.startsWith("data:image/png");
            byte[] bytes = java.util.Base64.getDecoder().decode(data.substring(data.indexOf(',') + 1));
            java.awt.image.BufferedImage read = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes));
            double w = read == null ? 400 : read.getWidth(), h = read == null ? 300 : read.getHeight();
            double scale = Math.min(Math.min(12.0 / 2.54 * 72 / w, 8.0 / 2.54 * 72 / h), 1.0);
            XWPFParagraph p = before(doc, anchor);
            p.setAlignment(ParagraphAlignment.LEFT);
            p.createRun().addPicture(new java.io.ByteArrayInputStream(bytes), png ? XWPFDocument.PICTURE_TYPE_PNG : XWPFDocument.PICTURE_TYPE_JPEG, "question",
                    org.apache.poi.util.Units.toEMU(w * scale), org.apache.poi.util.Units.toEMU(h * scale));
        } catch (Exception e) {
            // a picture that cannot be drawn is left out; it was checked when the question was saved
        }
    }

    private static void question(XWPFDocument doc, XWPFParagraph anchor, Map<String, Object> q, Object number, boolean key, CTRPr look, int part) {
        String kind = text(q.get("kind"));
        XWPFParagraph head = before(doc, anchor);
        head.setSpacingBefore(120);
        text(head, "Câu " + number + ": ", true, look);
        text(head, text(q.get("prompt")), false, look);
        text(head, "  (" + points(q.get("points")) + " điểm/ " + (new BigDecimal(String.valueOf(q.get("points"))).compareTo(BigDecimal.ONE) == 0 ? "point" : "points") + ")", false, look).setItalic(true);
        picture(doc, anchor, q.get("image"));
        if ("MULTI".equals(kind)) {
            XWPFParagraph hint = before(doc, anchor);
            hint.setIndentationLeft(0);
            text(hint, "Chọn tất cả các đáp án đúng/ Choose all the right answers", false, look).setItalic(true);
        }
        if (part == PART_TWO) {
            if (key) {
                XWPFParagraph model = before(doc, anchor);
                model.setIndentationLeft(0);
                text(model, "Đáp án mẫu/ Model answer: ", true, look);
                text(model, text(q.get("modelAnswer")).isEmpty() ? "-" : text(q.get("modelAnswer")), false, look);
            } else {
                int lines = q.get("answerLines") instanceof Number n && n.intValue() >= 1 ? Math.min(n.intValue(), 30) : ESSAY_LINES;
                for (int i = 0; i < lines; i++) writingLine(before(doc, anchor), look);
            }
            return;
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> options = (List<Map<String, Object>>) q.get("options");
        @SuppressWarnings("unchecked")
        List<String> correct = (List<String>) q.get("correct");
        if (options == null) return;
        if ("TWO_COLUMNS".equals(text(q.get("optionLayout"))) && options.size() > 1) {
            optionsInTwoColumns(doc, anchor, options, correct, key, look);
            return;
        }
        for (Map<String, Object> o : options) {
            boolean right = key && correct != null && correct.contains(text(o.get("id")));
            XWPFParagraph line = before(doc, anchor);
            line.setIndentationLeft(0);
            answer(line, right, text(o.get("text")), look);
        }
    }

    /** An answer to choose from: a box in front of it for the trainee to tick (no letter); in the key the box of a right answer has a cross and the answer is in bold. */
    private static void answer(XWPFParagraph p, boolean right, String answer, CTRPr look) {
        XWPFRun box = text(p, right ? "☒" : "☐", false, look);
        box.setFontFamily("MS Gothic");
        text(p, "  " + answer, right, look);
    }

    /** The answers of a question in two columns, in the order of the answers: 1st 2nd / 3rd 4th / ... (a table without borders, half of the width for each answer). */
    private static void optionsInTwoColumns(XWPFDocument doc, XWPFParagraph anchor, List<Map<String, Object>> options, List<String> correct, boolean key, CTRPr look) {
        XWPFTable table;
        try (XmlCursor cursor = anchor.getCTP().newCursor()) {
            table = doc.insertNewTbl(cursor);
        }
        table.setCellMargins(0, 0, 0, 0);
        table.setWidth("100%");
        table.setInsideHBorder(org.apache.poi.xwpf.usermodel.XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setInsideVBorder(org.apache.poi.xwpf.usermodel.XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setTopBorder(org.apache.poi.xwpf.usermodel.XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setBottomBorder(org.apache.poi.xwpf.usermodel.XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setLeftBorder(org.apache.poi.xwpf.usermodel.XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setRightBorder(org.apache.poi.xwpf.usermodel.XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        XWPFTableRow row = table.getRow(0);
        while (row.getTableCells().size() < 2) row.addNewTableCell();
        for (int i = 0; i < options.size(); i++) {
            if (i > 0 && i % 2 == 0) {
                row = table.createRow();
                while (row.getTableCells().size() < 2) row.addNewTableCell();
            }
            Map<String, Object> o = options.get(i);
            boolean right = key && correct != null && correct.contains(text(o.get("id")));
            XWPFTableCell cell = row.getCell(i % 2);
            XWPFParagraph p = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().getFirst();
            p.setIndentationLeft(i % 2 == 0 ? 0 : 120);
            answer(p, right, text(o.get("text")), look);
        }
        for (XWPFTableRow r : table.getRows()) for (XWPFTableCell c : r.getTableCells()) c.setWidth("50%");
        // The table has to be followed by a paragraph that is not the next question: the anchor is that paragraph.
    }

    /** Case 2: the checklist table of the form takes one row for each line (the last row of the template is the model of a line). */
    private static void fillChecklist(XWPFTable table, List<Map<String, Object>> items, boolean key) {
        CTTbl ct = table.getCTTbl();
        int rows = ct.sizeOfTrArray();
        if (rows < 3) throw structure();
        CTRow model = (CTRow) ct.getTrArray(rows - 1).copy();
        ct.removeTr(rows - 1);
        for (Map<String, Object> line : items) {
            ct.addNewTr().set(model.copy());
            XWPFTableRow row = new XWPFTableRow(ct.getTrArray(ct.sizeOfTrArray() - 1), table);
            if (row.getTableCells().size() < 4) throw structure();
            setCell(row.getCell(0), text(line.get("no")), false, ParagraphAlignment.CENTER);
            setCell(row.getCell(1), text(line.get("prompt")), false, ParagraphAlignment.LEFT);
            @SuppressWarnings("unchecked")
            List<String> correct = (List<String>) line.get("correct");
            setCell(row.getCell(2), "", key && correct != null && correct.contains("CORRECT"), ParagraphAlignment.CENTER);
            setCell(row.getCell(3), "", key && correct != null && correct.contains("INCORRECT"), ParagraphAlignment.CENTER);
        }
    }

    /** A cell of a line of the checklist: the text of the line is on the left, in the size of the rest of the form; the number and the ticks are in the middle. */
    private static void setCell(XWPFTableCell cell, String value, boolean tick, ParagraphAlignment alignment) {
        XWPFParagraph p = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().getFirst();
        CTRPr look = lookOf(p);
        for (int i = p.getRuns().size() - 1; i >= 0; i--) p.removeRun(i);
        p.setAlignment(alignment);
        if (!value.isEmpty()) text(p, value, false, look).setFontSize(12);
        if (tick) tickMark(p, look);
    }

    /** "Bài làm gồm……. câu hỏi /there are …. questions": the number of questions goes in both places. */
    private static void setCount(XWPFParagraph p, int n) {
        for (int guard = 0; guard < 2; guard++) {
            List<XWPFRun> runs = p.getRuns();
            int[] starts = new int[runs.size()];
            StringBuilder all = new StringBuilder();
            for (int i = 0; i < runs.size(); i++) { starts[i] = all.length(); all.append(runText(runs.get(i))); }
            Matcher m = DOTS.matcher(all);
            if (!m.find()) return;
            boolean written = false;
            for (int i = 0; i < runs.size(); i++) {
                String old = runText(runs.get(i));
                int rs = starts[i], re = rs + old.length();
                if (old.isEmpty() || re <= m.start() || rs >= m.end()) continue;
                String head = old.substring(0, Math.max(m.start(), rs) - rs);
                String number = written ? "" : (!head.isEmpty() && Character.isLetter(head.charAt(head.length() - 1)) ? " " : "") + n;
                runs.get(i).setText(head + number + old.substring(Math.min(m.end(), re) - rs), 0);
                // the number is written like the words before it ("there are 4 questions" is in italic)
                if (!written && i > 0) runs.get(i).setItalic(runs.get(i - 1).isItalic());
                written = true;
            }
        }
    }

    private static void keyBanner(XWPFDocument doc, XWPFTable facts) {
        try (XmlCursor cursor = facts.getCTTbl().newCursor()) {
            XWPFParagraph p = doc.insertNewParagraph(cursor);
            XWPFRun r = p.createRun();
            r.setBold(true);
            r.setColor("C00000");
            r.setText("ĐÁP ÁN - CHỈ DÀNH CHO NGƯỜI ĐÀO TẠO, KHÔNG PHÁT CHO HỌC VIÊN / ANSWER KEY - FOR THE TRAINER ONLY, NEVER HANDED OUT");
        }
    }

    private static void removeEmptyBetween(XWPFDocument doc, XWPFParagraph from, XWPFParagraph to) {
        boolean inside = false;
        List<XWPFParagraph> empty = new ArrayList<>();
        for (IBodyElement e : doc.getBodyElements()) {
            if (e == from) { inside = true; continue; }
            if (e == to) break;
            if (inside && e.getElementType() == BodyElementType.PARAGRAPH && ((XWPFParagraph) e).getText().isBlank() && ((XWPFParagraph) e).getRuns().stream().noneMatch(r -> r.getCTR().sizeOfSymArray() > 0)) empty.add((XWPFParagraph) e);
        }
        for (XWPFParagraph p : empty) removeParagraph(doc, p);
    }

    private static void dropTrailingEmpty(XWPFDocument doc) {
        List<IBodyElement> els = doc.getBodyElements();
        for (int i = els.size() - 1; i > 0; i--) {
            IBodyElement e = els.get(i);
            if (e.getElementType() == BodyElementType.PARAGRAPH && ((XWPFParagraph) e).getText().isBlank()) doc.removeBodyElement(i);
            else break;
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ one trainee

    /** The trainee's fields; see {@link #personalize(byte[], Trainee, boolean)}. The copy is for Word. */
    public static byte[] personalize(byte[] docx, Trainee t) {
        return personalize(docx, t, false);
    }

    /**
     * The trainee's fields: name, ID code, department and date in the table of the facts, and the trainee in the footer. A field already filled, or not found, is left as it is.
     * {@code forPdf}: the copy goes to the document server to be made a PDF, which does not draw the boxes of Wingdings that Word draws: they are swapped for the Unicode boxes.
     */
    public static byte[] personalize(byte[] docx, Trainee t, boolean forPdf) {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (XWPFTable table : doc.getTables()) {
                if (!tableText(table).contains("Training topic")) continue;
                for (XWPFParagraph p : cellParagraphs(table)) {
                    if (t.name() != null && !t.name().isBlank()) fillAfter(p, "Name of trainee", t.name());
                    if (t.code() != null && !t.code().isBlank()) fillAfter(p, "ID code", t.code());
                    if (t.department() != null && !t.department().isBlank()) fillAfter(p, "Department", t.department());
                    if (t.date() != null && !t.date().isBlank()) fillAfter(p, "Date", t.date());
                }
            }
            if (forPdf) unicodeBoxes(doc);
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    /** The box with a cross (F0FD) and the box with a tick (F0FE) of Wingdings become the Unicode characters of the same look. */
    private static void unicodeBoxes(XWPFDocument doc) {
        List<XWPFParagraph> all = new ArrayList<>(allParagraphs(doc));
        for (XWPFParagraph p : all) {
            for (XWPFRun r : p.getRuns()) {
                for (int i = r.getCTR().sizeOfSymArray() - 1; i >= 0; i--) {
                    byte[] ch = r.getCTR().getSymArray(i).getChar();
                    if (ch == null || ch.length != 2 || (ch[1] & 0xFF) < 0xFD) continue;
                    r.getCTR().removeSym(i);
                    r.setText((ch[1] & 0xFF) == 0xFD ? "\u2612" : "\u2611");
                }
            }
        }
    }

    private static List<XWPFParagraph> allParagraphs(XWPFDocument doc) {
        List<XWPFParagraph> out = new ArrayList<>(doc.getParagraphs());
        for (XWPFTable t : doc.getTables()) out.addAll(cellParagraphs(t));
        return out;
    }
}

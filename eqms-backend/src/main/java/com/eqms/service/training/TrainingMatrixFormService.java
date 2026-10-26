package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.util.DateTimeFormatUtils;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlException;
import org.apache.xmlbeans.XmlObject;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * An approved training matrix of a department in the form APD.0011 (SOP.0003 5.3.1): the file the organization keeps as the template, filled from the matrix version, as Word or as PDF. The
 * template is the Word file that Training Administration uploaded and enabled with a signature (Training Properties, form templates, code APD.0011); a new version of the form is used as
 * soon as it is enabled. The notes that describe the form, the note on management positions and the history of revisions are not part of the form and are not written to the file. The table
 * is made again for the positions of the department: one column for each position, an X where the position must be trained, and the annual requirement. A matrix that is not Effective or
 * Obsoleted is not exported. Every export is written to the Audit Trail with the version of the form and the SHA-256 of the template.
 */
@Service
public class TrainingMatrixFormService {
    public static final String TEMPLATE_CODE = "APD.0011";
    private static final String STRUCTURE = "TRAINING_FORM_TEMPLATE_STRUCTURE";
    private static final String W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    /** The width of the table in the template, in twentieths of a point. */
    private static final int GRID = 9628;
    /** From this many positions the names of the positions are written upwards so that the columns can be narrow. */
    private static final int UPRIGHT_LIMIT = 6;
    /** The properties of the table of the template: the whole width of the page and single borders. */
    private static final String TBL_PR = "<w:tblPr><w:tblW w:w=\"5000\" w:type=\"pct\"/><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/><w:left w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
            + "<w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/><w:right w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/>"
            + "<w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"auto\"/></w:tblBorders><w:tblLayout w:type=\"fixed\"/></w:tblPr>";

    private final JdbcTemplate jdbc;
    private final TrainingMatrixService matrices;
    private final TrainingFormTemplates templates;
    private final TrainingSignatureBlocks blocks;
    private final AuditTrailService audit;

    public TrainingMatrixFormService(JdbcTemplate jdbc, TrainingMatrixService matrices, TrainingFormTemplates templates, AuditTrailService audit, TrainingSignatureBlocks blocks) {
        this.jdbc = jdbc;
        this.matrices = matrices;
        this.templates = templates;
        this.blocks = blocks;
        this.audit = audit;
    }

    @SuppressWarnings("unchecked")
    @Transactional(noRollbackFor = RuntimeException.class)
    public Map<String, Object> export(UserAccount actor, UUID versionId, String format) {
        if (format == null || !List.of("docx", "pdf").contains(format.toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("TRAINING_FORMAT_INVALID");
        Map<String, Object> v = matrices.version(actor, versionId);
        String status = String.valueOf(v.get("status"));
        if (!"EFFECTIVE".equals(status) && !"OBSOLETED".equals(status)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        Map<String, Object> data = new java.util.HashMap<>(v);
        List<List<String>> signatureBlocks = new ArrayList<>();
        for (Map<String, Object> a : (List<Map<String, Object>>) v.get("approvers")) {
            if ("DONE".equals(a.get("status")) && a.get("signatureId") instanceof UUID id) signatureBlocks.add(blocks.lines(id));
        }
        data.put("signatureBlocks", signatureBlocks);
        data.put("signatureFontPt", blocks.fontPt());
        TrainingFormTemplates.Template template = templates.enabled(TEMPLATE_CODE);
        byte[] source = template.bytes();
        byte[] docx;
        try {
            docx = fill(source, data);
        } catch (IOException | XmlException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
        audit.logAs(actor, "TRAINING_MATRIX", v.get("matrixCode") + " v" + v.get("versionNo"), versionId, "TRAINING_MATRIX_PRINTED", null, null,
                ("pdf".equalsIgnoreCase(format) ? "PDF" : "Word") + ", form " + TEMPLATE_CODE + " " + template.versionLabel() + ", template SHA-256 " + template.sha256());
        return templates.file(docx, format, v.get("matrixCode") + "-v" + v.get("versionNo") + "-" + TEMPLATE_CODE);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the form

    @SuppressWarnings("unchecked")
    static byte[] fill(byte[] template, Map<String, Object> v) throws IOException, XmlException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(template)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            String department = String.valueOf(v.get("departmentName"));
            XWPFTable matrix = null;
            XWPFTable history = null;
            for (XWPFTable t : doc.getTables()) {
                String text = tableText(t);
                if (text.contains("SOP No")) matrix = t;
                else if (text.contains("Description of change")) history = t;
            }
            if (matrix == null) throw new IllegalStateException(STRUCTURE);

            // the notes about the form, the note on management positions and the history are not written; the lines are removed from the end
            List<XWPFParagraph> paragraphs = new ArrayList<>(doc.getParagraphs());
            XWPFParagraph departmentLine = null;
            for (XWPFParagraph p : paragraphs) {
                String t = p.getText();
                if (t.startsWith("Tên tài liệu:")) replace(p, "Tên bộ phận", department);
                else if (t.startsWith("Name of document:")) replace(p, "Name of department", department);
                else if (t.contains("Department") && t.trim().endsWith(":") && t.startsWith("Bộ phận")) departmentLine = p;
            }
            if (departmentLine == null) throw new IllegalStateException(STRUCTURE);
            replace(departmentLine, "*", "");
            XWPFRun name = departmentLine.createRun();
            name.setFontFamily("Times New Roman");
            name.setText(" " + department);
            // the line of the version goes under the department: the cursor is put on what follows the department line
            XmlCursor cursor = departmentLine.getCTP().newCursor();
            cursor.toEndToken();
            cursor.toNextToken();
            XWPFParagraph version = doc.insertNewParagraph(cursor);
            XWPFRun run = version.createRun();
            run.setFontFamily("Times New Roman");
            run.setText("Mã ma trận/ Matrix code: " + v.get("matrixCode") + "    Phiên bản/ Version: " + v.get("versionNo") + " (" + ("EFFECTIVE".equals(v.get("status")) ? "Effective" : "Obsoleted") + ")");
            List<List<String>> signatureBlocks = (List<List<String>>) v.get("signatureBlocks");
            if (signatureBlocks != null) {
                // the electronic signatures of the approval, as the configuration of Electronic Signature writes them, in the size it gives, under the table
                for (List<String> block : signatureBlocks) {
                    for (String line : block) {
                        XWPFParagraph p = doc.createParagraph();
                        p.setSpacingBefore(0);
                        p.setSpacingAfter(0);
                        XWPFRun r = p.createRun();
                        r.setFontFamily("Times New Roman");
                        r.setFontSize(((Number) v.get("signatureFontPt")).doubleValue());
                        r.setText(line);
                    }
                }
            } else {
                for (Map<String, Object> a : (List<Map<String, Object>>) v.get("approvers")) {
                    if (!"DONE".equals(a.get("status"))) continue;
                    XWPFRun r = version.createRun();
                    r.setFontFamily("Times New Roman");
                    r.addBreak();
                    r.setText("Phê duyệt/ Approved by: " + a.get("assigneeName") + " (" + DateTimeFormatUtils.display(a.get("completedAt")) + ")");
                }
            }

            // the table of the form is replaced by the one made: the new one is moved in front of the old one, and the old one is removed
            XmlCursor made = XmlObject.Factory.parse(table(v)).newCursor();
            made.toFirstChild();
            XmlCursor old = matrix.getCTTbl().newCursor();
            made.moveXml(old);
            old.removeXml();
            if (history != null) doc.removeBodyElement(doc.getPosOfTable(history));
            removeNotes(doc);
            // the empty lines at the end of the template would make a page of their own: one is kept, because a table cannot be the last thing of a Word file, and it is made very small
            List<IBodyElement> body = doc.getBodyElements();
            int last = body.size() - 1;
            while (last > 0 && body.get(last) instanceof XWPFParagraph p && p.getText().isBlank() && body.get(last - 1) instanceof XWPFParagraph q && q.getText().isBlank()) {
                doc.removeBodyElement(last);
                body = doc.getBodyElements();
                last = body.size() - 1;
            }
            if (body.get(last) instanceof XWPFParagraph tail && tail.getText().isBlank()) tail.setSpacingBetween(1, org.apache.poi.xwpf.usermodel.LineSpacingRule.EXACT);
            doc.write(out);
            return out.toByteArray();
        }
    }

    /** The two notes at the top of the template (the note on where the file is made and the note on management positions) describe the form: they are taken out. */
    private static void removeNotes(XWPFDocument doc) {
        List<XWPFParagraph> remove = new ArrayList<>();
        for (XWPFParagraph p : doc.getParagraphs()) {
            String t = p.getText();
            if (t.startsWith("Ghi chú:") || t.startsWith("Note: This file") || t.startsWith("*Đối với các vị trí quản lý") || t.startsWith("LỊCH SỬ SỬA ĐỔI")) remove.add(p);
        }
        for (XWPFParagraph p : remove) doc.removeBodyElement(doc.getPosOfParagraph(p));
    }

    private static String tableText(XWPFTable table) {
        StringBuilder sb = new StringBuilder();
        table.getRows().forEach(r -> r.getTableCells().forEach(c -> sb.append(c.getText()).append(' ')));
        return sb.toString();
    }

    /** Replaces text of a paragraph; when it is split over several runs the first run carries all of it. */
    private static void replace(XWPFParagraph p, String from, String to) {
        for (XWPFRun r : p.getRuns()) {
            String t = r.text();
            if (t != null && t.contains(from)) {
                r.setText(t.replace(from, to), 0);
                return;
            }
        }
        String all = p.getText();
        if (!all.contains(from) || p.getRuns().isEmpty()) return;
        p.getRuns().get(0).setText(all.replace(from, to), 0);
        for (int i = p.getRuns().size() - 1; i >= 1; i--) p.removeRun(i);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the table

    /** The table of the matrix: the heading of the template (two rows, the positions under "Work position"), then the rows of the matrix under the heading of their group. */
    @SuppressWarnings("unchecked")
    private static String table(Map<String, Object> v) throws XmlException {
        List<Map<String, Object>> positions = (List<Map<String, Object>>) v.get("positions");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) v.get("rows");
        int n = Math.max(positions.size(), 1);
        boolean upright = n > UPRIGHT_LIMIT;
        // widths in fiftieths of a percent of the page (5000 = all of it): No., SOP, subject, the positions share the rest, annual
        int no = 400, sop = 1000, annual = 700;
        int free = 5000 - no - sop - annual;
        // few positions: wide enough for a name; many positions: narrow, the subject keeps at least a quarter of the page
        int each = upright ? Math.min(330, 1700 / n) : Math.min(700, 1700 / n);
        int subject = upright ? free - n * each : Math.max(1200, free - n * 700);
        each = upright ? each : (free - subject) / n;
        int[] widths = new int[n + 4];
        widths[0] = no; widths[1] = sop; widths[2] = subject;
        for (int i = 0; i < n; i++) widths[3 + i] = each;
        widths[n + 3] = 5000 - no - sop - subject - each * n;
        StringBuilder grid = new StringBuilder("<w:tblGrid>");
        for (int w : widths) grid.append("<w:gridCol w:w=\"").append(w * GRID / 5000).append("\"/>");
        grid.append("</w:tblGrid>");

        StringBuilder x = new StringBuilder("<w:tbl xmlns:w=\"" + W + "\">");
        x.append(TBL_PR).append(grid);
        // heading row 1
        x.append("<w:tr><w:trPr><w:tblHeader/></w:trPr>")
                .append(cell(widths[0], "<w:vMerge w:val=\"restart\"/>", center("STT", "No")))
                .append(cell(widths[1], "<w:vMerge w:val=\"restart\"/>", center("SOP No")))
                .append(cell(widths[2], "<w:vMerge w:val=\"restart\"/>", center("Tên chủ đề/ SOP", "Subject/ SOP title")))
                .append(cell(sum(widths, 3, n), "<w:gridSpan w:val=\"" + n + "\"/>", center("Vị trí công việc/ Work position")))
                .append(cell(widths[n + 3], "<w:vMerge w:val=\"restart\"/>", center("Annual training required", "(Yes/ No)")))
                .append("</w:tr>");
        // heading row 2: the names of the positions
        x.append("<w:tr><w:trPr><w:tblHeader/></w:trPr>")
                .append(cell(widths[0], "<w:vMerge/>", "<w:p/>")).append(cell(widths[1], "<w:vMerge/>", "<w:p/>")).append(cell(widths[2], "<w:vMerge/>", "<w:p/>"));
        if (positions.isEmpty()) x.append(cell(widths[3], "", center("…")));
        for (int i = 0; i < positions.size(); i++) {
            x.append(cell(widths[3 + i], upright ? "<w:textDirection w:val=\"btLr\"/>" : "", center(String.valueOf(positions.get(i).get("name")))));
        }
        x.append(cell(widths[n + 3], "<w:vMerge/>", "<w:p/>")).append("</w:tr>");

        String group = "";
        int no_ = 0;
        for (Map<String, Object> r : rows) {
            String g = String.valueOf(r.get("rowGroup"));
            if (!g.equals(group)) {
                group = g;
                x.append("<w:tr><w:trPr><w:cantSplit/></w:trPr>").append(cell(5000, "<w:gridSpan w:val=\"" + (n + 4) + "\"/><w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"E7E6E6\"/>", left(groupTitle(g), true))).append("</w:tr>");
            }
            boolean topic = r.get("topicId") != null;
            List<?> ids = (List<?>) r.get("positionIds");
            x.append("<w:tr><w:trPr><w:cantSplit/></w:trPr>")
                    .append(cell(widths[0], "", center(String.valueOf(++no_))))
                    .append(cell(widths[1], "", center(topic ? text(r.get("topicCode")) : text(r.get("documentNumber")))))
                    .append(cell(widths[2], "", left(topic ? text(r.get("topicName")) : text(r.get("documentName")), false)));
            if (positions.isEmpty()) x.append(cell(widths[3], "", "<w:p/>"));
            for (int i = 0; i < positions.size(); i++) x.append(cell(widths[3 + i], "", center(ids.contains(positions.get(i).get("id")) ? "X" : "")));
            x.append(cell(widths[n + 3], "", center(Boolean.TRUE.equals(r.get("annualRequired")) ? "Yes" : "No"))).append("</w:tr>");
        }
        x.append("</w:tbl>");
        return x.toString();
    }

    private static int sum(int[] widths, int from, int count) {
        int s = 0;
        for (int i = from; i < from + count; i++) s += widths[i];
        return s;
    }

    private static String groupTitle(String group) {
        return switch (group) {
            case "FACTORY_GENERAL" -> "Đào tạo chung theo yêu cầu của cả nhà máy/ General education as factory’s requirement";
            case "DEPARTMENT_GENERAL" -> "Đào tạo chung theo yêu cầu từng bộ phận/ General education as required per department";
            default -> "Danh mục tất cả quy trình cần được đào tạo cho từng vị trí cụ thể/ Listing all procedures that need to be training for specific position";
        };
    }

    private static String cell(int width, String props, String paragraphs) {
        return "<w:tc><w:tcPr><w:tcW w:w=\"" + width + "\" w:type=\"pct\"/>" + props + "<w:vAlign w:val=\"center\"/></w:tcPr>" + paragraphs + "</w:tc>";
    }

    private static String center(String... lines) {
        StringBuilder sb = new StringBuilder();
        for (String l : lines) sb.append("<w:p><w:pPr><w:spacing w:before=\"20\" w:after=\"20\"/><w:jc w:val=\"center\"/></w:pPr>").append(run(l, false)).append("</w:p>");
        return sb.toString();
    }

    private static String left(String line, boolean bold) {
        return "<w:p><w:pPr><w:spacing w:before=\"20\" w:after=\"20\"/></w:pPr>" + run(line, bold) + "</w:p>";
    }

    private static String run(String text, boolean bold) {
        return "<w:r><w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/>" + (bold ? "<w:b/>" : "") + "<w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/></w:rPr>" + "<w:t xml:space=\"preserve\">" + escape(text) + "</w:t></w:r>";
    }

    private static String text(Object o) { return o == null ? "" : String.valueOf(o); }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}

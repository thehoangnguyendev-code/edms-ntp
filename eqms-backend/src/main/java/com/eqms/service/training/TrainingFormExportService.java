package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.util.DateTimeFormatUtils;
import org.apache.poi.util.Units;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.eqms.service.training.TrainingWordForms.appendBlock;
import static com.eqms.service.training.TrainingWordForms.appendLine;
import static com.eqms.service.training.TrainingWordForms.cellsText;
import static com.eqms.service.training.TrainingWordForms.fillRows;
import static com.eqms.service.training.TrainingWordForms.fillRowsBilingual;
import static com.eqms.service.training.TrainingWordForms.find;
import static com.eqms.service.training.TrainingWordForms.findAll;
import static com.eqms.service.training.TrainingWordForms.findParagraph;
import static com.eqms.service.training.TrainingWordForms.moveToHeader;
import static com.eqms.service.training.TrainingWordForms.keepTogether;
import static com.eqms.service.training.TrainingWordForms.noteToFooter;
import static com.eqms.service.training.TrainingWordForms.removeParagraphs;
import static com.eqms.service.training.TrainingWordForms.row;
import static com.eqms.service.training.TrainingWordForms.removeTable;
import static com.eqms.service.training.TrainingWordForms.setLines;
import static com.eqms.service.training.TrainingWordForms.setParagraph;
import static com.eqms.service.training.TrainingWordForms.setText;
import static com.eqms.service.training.TrainingWordForms.setValueOf;
import static com.eqms.service.training.TrainingWordForms.structure;
import static com.eqms.service.training.TrainingWordForms.trimEnd;

/**
 * The forms of Training that are written from what is recorded in the system, in the Word template that Training Administration enabled for each of them (SOP.0003 section 6): the training
 * requirement (APD.0118), the self-reading list (APD.0108), the Training Number log (FRM.0044), the job assignment (APD.0024), the specimen signature (FRM.0007) and the personal training
 * record (APD.0014). Word or PDF; the PDF is made by the document server from the Word file. The notes of the template that describe the form (header, footer, history of revisions) are not
 * written: the header and the footer are real. Every export is written to the Audit Trail with the version of the form and the SHA-256 of the template.
 */
@Service
public class TrainingFormExportService {
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingFormTemplates templates;
    private final TrainingRequirementService requirements;
    private final TrainingJobAssignmentService jobs;
    private final TrainingRecordService records;
    private final TrainingSpecimenService specimens;
    private final AuditTrailService audit;
    private final TrainingSignatureBlocks blocks;

    public TrainingFormExportService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingFormTemplates templates, TrainingRequirementService requirements,
                                     TrainingJobAssignmentService jobs, TrainingRecordService records, TrainingSpecimenService specimens, AuditTrailService audit, TrainingSignatureBlocks blocks) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.templates = templates;
        this.requirements = requirements;
        this.jobs = jobs;
        this.records = records;
        this.specimens = specimens;
        this.audit = audit;
        this.blocks = blocks;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String day(Object value) {
        return value == null ? "" : DateTimeFormatUtils.display(value);
    }

    private static String signed(Object name, Object when) {
        String at = when == null ? null : DateTimeFormatUtils.formatDateTime(when);
        return text(name).isEmpty() ? "" : text(name) + (at == null ? "" : " (" + at + ")");
    }

    /** Opens the template, runs the filler and keeps the common work: the header with the page numbers, the footer, and no empty page at the end. */
    private interface Filler {
        void fill(XWPFDocument doc);
    }

    private byte[] write(TrainingFormTemplates.Template template, boolean headerTable, Filler filler) {
        byte[] filled;
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(template.bytes())); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            noteToFooter(doc);
            filler.fill(doc);
            doc.write(out);
            filled = out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
        // the file is read again, so that the lists of the library (paragraphs, tables, rows) are those of the file as it is now
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(filled)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            removeParagraphs(doc, TrainingWordForms::describesTheForm);
            // the history of revisions of the template is not part of the form (its table has the headings "Code" and "Version")
            for (XWPFTable t : findAll(doc, "Version")) if (cellsText(t).contains("Initial") || cellsText(t).contains("Description of change") || cellsText(t).contains("Reason for change")) removeTable(doc, t);
            if (headerTable) moveToHeader(doc, find(doc, "Page:"));
            trimEnd(doc);
            TrainingWordForms.shareHeaderFooter(doc);
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ APD.0118

    /** The training requirement of a department (APD.0118): an approved requirement only; what QA records after the training (code, date, signature, comment) is written when it is there. */
    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> requirement(UserAccount actor, UUID id, String format) {
        TrainingFormTemplates.isPdf(format);
        Map<String, Object> r = requirements.get(actor, id);
        if (!"APPROVED".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        TrainingFormTemplates.Template template = templates.enabled("APD.0118");
        byte[] docx = write(template, true, doc -> {
            XWPFTable header = find(doc, "Page:");
            if (header.getRows().size() < 3) throw structure();
            setText(header.getRow(1).getCell(2), "Year: " + r.get("year"));
            setText(header.getRow(2).getCell(2), "Request No: " + r.get("requestNo"));
            boolean periodic = "SOP_PERIODIC".equals(r.get("kind"));
            tick(findParagraph(doc, periodic ? "Periodic training SOP" : "Annual training"));
            List<List<String>> lines = new ArrayList<>();
            for (Map<String, Object> l : (List<Map<String, Object>>) r.get("lines")) {
                lines.add(List.of(text(l.get("lineNo")), DateTimeFormatUtils.displayMonth(l.get("plannedMonth")), (l.get("code") == null ? "" : l.get("code") + " - ") + text(l.get("title")),
                        text(l.get("trainingNumber")), day(l.get("executedOn")), "", text(l.get("qaComment"))));
            }
            XWPFTable table = find(doc, "Execution date");
            fillRows(table, lines);
            List<Map<String, Object>> reqLines = (List<Map<String, Object>>) r.get("lines");
            // the column of the signature of QA is narrow: it holds the name and the time and the number of the annex, where the whole block of the signature is written
            List<List<String>> annex = new ArrayList<>();
            for (int i = 0; i < reqLines.size() && i + 1 < table.getCTTbl().sizeOfTrArray(); i++) {
                if (!(reqLines.get(i).get("qaSignatureId") instanceof UUID qaSignature)) continue;
                List<String> block = blocks.lines(qaSignature);
                if (block.isEmpty()) continue;
                annex.add(block);
                List<String> short_ = new ArrayList<>();
                short_.add(block.get(0));
                if (block.size() > 2) short_.add(block.get(2));
                short_.add("(PL " + annex.size() + ")");
                appendBlock(row(table, i + 1).getCell(5), short_, blocks.fontPt());
            }
            annexOfSignatures(doc, annex, blocks.fontPt());
            XWPFTable signers = find(doc, "Prepared by");
            if (signers.getRows().size() < 2) throw structure();
            keepTogether(signers);
            block(signers.getRow(1).getCell(0), r.get("preparedSignatureId"));
            block(signers.getRow(1).getCell(1), r.get("reviewedSignatureId"));
            block(signers.getRow(1).getCell(2), r.get("approvedSignatureId"));
        });
        audit.logAs(actor, "TRAINING_REQUIREMENT", text(r.get("requestNo")), id, "TRAINING_REQUIREMENT_PRINTED", null, null, template.describe());
        return templates.file(docx, format, text(r.get("requestNo")).replace('/', '-') + "-APD.0118");
    }

    private static final String W14 = "http://schemas.microsoft.com/office/word/2010/wordml";

    /** The box before the line is ticked. The forms use a check box (a content control): it is set to checked and shows the box with a cross; a plain box character is changed too. */
    private static void tick(XWPFParagraph p) {
        // the check box (a content control) becomes plain text: the box with a cross is written as a character, so that it is drawn in the same way by Word and by the document server
        String wns = "declare namespace w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; ";
        for (XmlObject sdt : p.getCTP().selectPath(wns + "./w:sdt")) {
            XmlObject[] content = sdt.selectPath(wns + "./w:sdtContent");
            if (content.length != 1) continue;
            try (XmlCursor target = sdt.newCursor(); XmlCursor inner = content[0].newCursor()) {
                inner.moveXmlContents(target);
            }
            try (XmlCursor remove = sdt.newCursor()) {
                remove.removeXml();
            }
        }
        String w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        String ns = "declare namespace w='" + w + "'; ";
        for (XmlObject run : p.getCTP().selectPath(ns + ".//w:r")) {
            XmlObject[] texts = run.selectPath(ns + "./w:t");
            if (texts.length != 1) continue;
            try (XmlCursor cursor = texts[0].newCursor()) {
                if (!"☐".equals(cursor.getTextValue())) continue;
            }
            // the font of the check box of the forms (MS Gothic) has no box with a cross on the document server: a font that has it is named
            for (XmlObject fonts : run.selectPath(ns + "./w:rPr/w:rFonts")) {
                try (XmlCursor f = fonts.newCursor()) {
                    for (String attribute : new String[] {"ascii", "hAnsi", "eastAsia", "cs"}) f.setAttributeText(new javax.xml.namespace.QName(w, attribute), "Times New Roman");
                    f.removeAttribute(new javax.xml.namespace.QName(w, "hint"));
                }
            }
            try (XmlCursor cursor = texts[0].newCursor()) {
                cursor.setTextValue("☒");
            }
        }
    }

    private static String controlLineText(String code, int copy, UserAccount actor) {
        return "Bản in có kiểm soát / Controlled print: " + code + "    Bản số / Copy no.: " + copy + "    In lúc / Printed: " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()) + " by " + actor.getFullName();
    }

    /** The first line of a paper print: the code of the copy, so that a paper that comes back can be matched with the print. */
    private static void controlLine(XWPFDocument doc, String text) {
        XWPFParagraph first = doc.getParagraphs().get(0);
        XWPFParagraph line = doc.insertNewParagraph(first.getCTP().newCursor());
        XWPFRun run = line.createRun();
        run.setFontFamily("Times New Roman");
        run.setFontSize(9);
        run.setBold(true);
        run.setText(text);
    }

    private static String sha256(byte[] bytes) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    /** The annex of electronic signatures at the end of a form: the whole block of each signature that is only named in a narrow cell, under its number. */
    private static void annexOfSignatures(XWPFDocument doc, List<List<String>> annex, double pt) {
        if (annex.isEmpty()) return;
        XWPFParagraph title = doc.createParagraph();
        title.setSpacingBefore(240);
        XWPFRun heading = title.createRun();
        heading.setFontFamily("Times New Roman");
        heading.setFontSize(12);
        heading.setBold(true);
        heading.setText("Phụ lục chữ ký điện tử / Electronic signature annex");
        for (int i = 0; i < annex.size(); i++) {
            XWPFParagraph number = doc.createParagraph();
            number.setSpacingBefore(60);
            number.setSpacingAfter(0);
            XWPFRun n = number.createRun();
            n.setFontFamily("Times New Roman");
            n.setFontSize(pt);
            n.setBold(true);
            n.setText("PL " + (i + 1));
            for (String line : annex.get(i)) {
                XWPFParagraph p = doc.createParagraph();
                p.setSpacingBefore(0);
                p.setSpacingAfter(0);
                XWPFRun r = p.createRun();
                r.setFontFamily("Times New Roman");
                r.setFontSize(pt);
                r.setText(line);
            }
        }
    }

    /** The electronic signature of the record in a cell: the block of the configuration of Electronic Signature, at the size that the configuration gives. */
    private void block(XWPFTableCell cell, Object signatureId) {
        if (signatureId instanceof UUID id) appendBlock(cell, blocks.lines(id), blocks.fontPt());
    }

    // ------------------------------------------------------------------------------------------------------------------------------ APD.0108

    /** The self-reading list of a session (APD.0108): the people of the session, the day each one read and understood the document, and the confirmation of the head of the department. */
    @Transactional
    public Map<String, Object> selfReading(UserAccount actor, UUID sessionId, String format) {
        return selfReading(actor, sessionId, format, false, null);
    }

    /** The paper print of the self-reading list: the people and the Training Number are written, the reading day and the signatures are left for the hand; the copy is numbered and recorded. */
    @Transactional
    public Map<String, Object> selfReadingPaper(UserAccount actor, UUID sessionId, String format, String reason) {
        return selfReading(actor, sessionId, format, true, reason);
    }

    private Map<String, Object> selfReading(UserAccount actor, UUID sessionId, String format, boolean paper, String reason) {
        TrainingFormTemplates.isPdf(format);
        if (paper) access.require(actor, "training.paper.print");
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct");
        Map<String, Object> session = jdbc.queryForList("select * from training_sessions where id = ?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> activity = store.activity((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!"SELF_READING".equals(session.get("method"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_SELF_READING");
        TrainingFormTemplates.Template template = templates.enabled("APD.0108");
        String controlText = null;
        int copy = 1;
        String packCode = null;
        if (paper) {
            store.activityForUpdate((UUID) activity.get("id"));
            if (!Set.of("NOTIFIED", "IN_PROGRESS").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_STATUS");
            Integer printed = jdbc.queryForObject("select count(*) from training_paper_packs where session_id = ? and pack_kind = 'SELFREAD'", Integer.class, sessionId);
            copy = (printed == null ? 0 : printed) + 1;
            if (copy > 1 && (reason == null || reason.isBlank())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
            packCode = activity.get("training_number") + "/S" + session.get("session_no") + "/L" + copy;
            controlText = controlLineText(packCode, copy, actor);
        }
        final String control = controlText;
        String department = jdbc.queryForObject("select name from departments where id = ?", String.class, activity.get("organizer_department_id"));
        List<Map<String, Object>> topics = jdbc.queryForList("""
            select coalesce(st.document_number, d.document_number) as document_number, coalesce(d.document_name, st.topic_text) as name, r.revision_number
              from training_session_topics st left join document_revisions r on r.id = st.document_revision_id left join documents d on d.id = coalesce(st.document_id, r.document_id)
             where st.session_id = ? order by st.topic_text
            """, sessionId);
        List<Map<String, Object>> people = jdbc.queryForList("""
            select p.employee_code, p.full_name, p.state, p.read_confirmed_at from training_participants p where p.session_id = ? and p.external_name is null order by p.full_name
            """, sessionId);
        Map<String, Object> head = jdbc.queryForList("""
            select u.full_name, u.position, c.confirmed_at, c.signature_id from training_active_confirmations c join app_users u on u.id = c.confirmed_by
             where c.activity_id = ? and c.kind = 'HEAD_SELF_READING' order by c.confirmed_at desc limit 1
            """, activity.get("id")).stream().findFirst().orElse(Map.of());
        byte[] docx = write(template, true, doc -> {
            XWPFParagraph dep = findParagraph(doc, "Department");
            setParagraph(dep, text(dep.getText()).trim() + " " + department);
            XWPFParagraph document = findParagraph(doc, "name of document");
            List<String> names = new ArrayList<>();
            for (Map<String, Object> t : topics) names.add(text(t.get("document_number")) + " " + text(t.get("name")) + (t.get("revision_number") == null ? "" : " (" + t.get("revision_number") + ")"));
            setParagraph(document, text(document.getText()).trim() + " " + String.join("; ", names).trim());
            List<List<String>> lines = new ArrayList<>();
            int no = 1;
            for (Map<String, Object> p : people) {
                boolean read = !paper && "READ_CONFIRMED".equals(p.get("state"));
                lines.add(List.of(String.valueOf(no++), text(p.get("employee_code")), text(p.get("full_name")), text(activity.get("training_number")), read ? day(p.get("read_confirmed_at")) : "",
                        read ? "Đã đọc, ký điện tử / Read, signed electronically" : ""));
            }
            fillRows(find(doc, "Signature"), lines);
            XWPFTable confirm = find(doc, "CONFIRMED BY HEAD");
            if (confirm.getRows().size() < 2 || confirm.getRow(1).getTableCells().size() < 3) throw structure();
            if (control != null) controlLine(doc, control);
            if (!paper && !head.isEmpty()) {
                for (XWPFParagraph p : confirm.getRow(1).getCell(0).getParagraphs()) {
                    TrainingAssessmentForm.fillAfter(p, "Full name\\s*:?", text(head.get("full_name")));
                    TrainingAssessmentForm.fillAfter(p, "Position\\s*:?", text(head.get("position")));
                    TrainingAssessmentForm.fillAfter(p, "Date\\s*:?", day(head.get("confirmed_at")));
                }
                XWPFTableCell signature = confirm.getRow(1).getCell(1);
                block(signature, head.get("signature_id"));
            }
        });
        if (paper) {
            String sha = sha256(docx);
            jdbc.update("insert into training_paper_packs(id, activity_id, session_id, pack_code, copy_no, page_count, people_count, sha256, reason, printed_by, pack_kind) values (?,?,?,?,?,?,?,?,?,?,'SELFREAD')",
                    UUID.randomUUID(), activity.get("id"), sessionId, packCode, copy, 1, people.size(), sha, copy > 1 ? reason.trim() : null, actor.getId());
            audit.logAs(actor, "TRAINING_ACTIVITY", text(activity.get("training_number")), (UUID) activity.get("id"), "TRAINING_SELF_READING_LIST_PRINTED", null, packCode,
                    "Copy " + copy + ", SHA-256 " + sha + (copy > 1 ? ". Reason: " + reason.trim() : ""));
        } else {
            audit.logAs(actor, "TRAINING_ACTIVITY", text(activity.get("training_number")), (UUID) activity.get("id"), "TRAINING_SELF_READING_LIST_EXPORTED", null, null, template.describe());
        }
        return templates.file(docx, format, text(activity.get("training_number")).replace('/', '-') + "-S" + session.get("session_no") + "-APD.0108" + (paper ? "-L" + copy : ""));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ FRM.0044

    /** The Training Number log of a department and a year (FRM.0044): one line for each number, with the date it was issued, the SOP, the topic, the number of sessions and a remark. */
    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> numberLog(UserAccount actor, UUID departmentId, Integer year, String format) {
        TrainingFormTemplates.isPdf(format);
        List<Map<String, Object>> rows = new ArrayList<>();
        int page = 1;
        Map<String, Object> first = null;
        while (true) {
            Map<String, Object> r = records.numberLog(actor, departmentId, year, null, null, null, page, 100);
            if (first == null) first = r;
            rows.addAll((List<Map<String, Object>>) r.get("data"));
            Map<String, Object> pg = (Map<String, Object>) r.get("pagination");
            if (page >= ((Number) pg.get("totalPages")).intValue()) break;
            page++;
        }
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        String name = jdbc.queryForObject("select name from departments where id = ?", String.class, department);
        TrainingFormTemplates.Template template = templates.enabled("FRM.0044");
        byte[] docx = write(template, false, doc -> {
            List<XWPFTable> tables = findAll(doc, "TRN Number");
            if (tables.isEmpty()) throw structure();
            int perTable = tables.get(0).getRows().size() - 2;
            if (perTable < 1) throw structure();
            // the tables of the template are the same: one for each ten lines, the others are removed
            int needed = Math.max(1, (rows.size() + perTable - 1) / perTable);
            for (int i = tables.size() - 1; i >= needed; i--) {
                XWPFTable t = tables.get(i);
                int at = doc.getPosOfTable(t);
                doc.removeBodyElement(at);
                if (at < doc.getBodyElements().size() && doc.getBodyElements().get(Math.min(at, doc.getBodyElements().size() - 1)) instanceof XWPFParagraph p && p.getText().isBlank()) doc.removeBodyElement(at);
            }
            // more lines than the template has tables: the first table is copied after the last one
            for (int i = tables.size(); i < needed; i++) {
                XWPFTable last = findAll(doc, "TRN Number").getLast();
                XWPFParagraph gap = doc.insertNewParagraph(last.getCTTbl().newCursor());
                doc.removeBodyElement(doc.getPosOfParagraph(gap));
                TrainingWordForms.copyAfter(tables.get(0).getCTTbl(), last.getCTTbl());
            }
            List<XWPFTable> made = findAll(doc, "TRN Number");
            for (int t = 0; t < made.size(); t++) {
                XWPFTable table = made.get(t);
                if (table.getRow(0).getTableCells().size() >= 2) setText(table.getRow(0).getCell(table.getRow(0).getTableCells().size() - 1), name);
                List<List<String>> lines = new ArrayList<>();
                for (int k = t * perTable; k < Math.min(rows.size(), (t + 1) * perTable); k++) {
                    Map<String, Object> row = rows.get(k);
                    String remark = text(row.get("cancelReason")).isEmpty() ? ("RETRAINING".equals(row.get("kind")) ? "Supplementary" : "") : "Cancelled: " + row.get("cancelReason");
                    lines.add(List.of(text(DateTimeFormatUtils.formatDate(row.get("createdAt"))), text(row.get("trainingNumber")), text(row.get("documentNumber")), text(row.get("trainingTitle")), text(row.get("sessions")), remark));
                }
                fillLinesKeeping(table, 2, lines, perTable);
            }
        });
        audit.logAs(actor, "TRAINING_ACTIVITY", "Training Number log " + name + " " + first.get("year"), department, "TRAINING_NUMBER_LOG_EXPORTED", null, null, template.describe());
        return templates.file(docx, format, "FRM.0044-" + name.replaceAll("[^A-Za-z0-9]+", "-") + "-" + first.get("year"));
    }

    /** The lines of a table of a fixed size: the lines that are not used stay as empty lines of the form. */
    private static void fillLinesKeeping(XWPFTable table, int headingRows, List<List<String>> lines, int size) {
        for (int i = 0; i < lines.size() && headingRows + i < table.getRows().size(); i++) {
            XWPFTableRow row = table.getRow(headingRows + i);
            List<String> line = lines.get(i);
            for (int c = 0; c < line.size() && c < row.getTableCells().size(); c++) setText(row.getCell(c), line.get(c));
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ APD.0024

    /** The job assignment (APD.0024): the case of the assignment (first appointment or change), the position, the jurisdiction, the duties and the two signers. */
    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> jobAssignment(UserAccount actor, UUID id, String format) {
        return jobAssignment(actor, id, format, false, null);
    }

    @SuppressWarnings("unchecked")
    private static String roleLines(Object roles, String fallback) {
        if (!(roles instanceof List<?> list) || list.isEmpty()) return fallback;
        List<String> lines = new ArrayList<>();
        for (Object o : list) {
            Map<String, Object> role = (Map<String, Object>) o;
            String dept = String.valueOf(role.get("department") == null ? "" : role.get("department"));
            lines.add(role.get("name") + (dept.isBlank() ? "" : " (" + dept + ")"));
        }
        return String.join("\n", lines);
    }

    /** The paper print of the job assignment, to be signed by hand: the data is written, the signatures are not; the copy is numbered and recorded, and a reprint needs a reason. */
    @Transactional
    public Map<String, Object> jobAssignmentPaper(UserAccount actor, UUID id, String format, String reason) {
        return jobAssignment(actor, id, format, true, reason);
    }

    private Map<String, Object> jobAssignment(UserAccount actor, UUID id, String format, boolean paper, String reason) {
        TrainingFormTemplates.isPdf(format);
        Map<String, Object> j = jobs.get(actor, id);
        if ("CANCELLED".equals(j.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        String controlText = null;
        int copy = 1;
        String printCode = null;
        if (paper) {
            access.require(actor, "training.job_assignment.manage");
            access.requireScope(actor, (UUID) j.get("departmentId"));
            if (!Set.of("DRAFT", "PENDING_RECEIVER").contains(String.valueOf(j.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_STATUS");
            jdbc.queryForList("select id from training_job_assignments where id = ? for update", id);
            Integer printed = jdbc.queryForObject("select count(*) from training_job_prints where assignment_id = ?", Integer.class, id);
            copy = (printed == null ? 0 : printed) + 1;
            if (copy > 1 && (reason == null || reason.isBlank())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
            printCode = "APD.0024/" + j.get("personUserId").toString().substring(0, 8) + "/" + j.get("issueNo") + "/P" + copy;
            controlText = controlLineText(printCode, copy, actor);
        }
        final String control = controlText;
        Map<String, Object> person = jdbc.queryForList("select full_name, employee_code from app_users where id = ?", j.get("personUserId")).stream().findFirst().orElseThrow();
        boolean change = "CHANGE".equals(j.get("caseType")) || "ADDITIONAL".equals(j.get("caseType"));
        String previousDepartment = j.get("previousDepartmentId") == null ? "" : jdbc.queryForList("select name from departments where id = ?", String.class, j.get("previousDepartmentId")).stream().findFirst().orElse("");
        Map<String, Object> matrix = j.get("matrixVersionId") == null ? Map.of() : jdbc.queryForList("""
            select m.code, v.version_no from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where v.id = ?
            """, j.get("matrixVersionId")).stream().findFirst().orElse(Map.of());
        TrainingFormTemplates.Template template = templates.enabled("APD.0024");
        byte[] docx = write(template, true, doc -> {
            XWPFTable header = find(doc, "Page:");
            setText(header.getRow(header.getRows().size() - 1).getCell(header.getRow(header.getRows().size() - 1).getTableCells().size() - 1), "Code: " + text(person.get("employee_code")));
            XWPFTable who = find(doc, "Full name");
            setValueOf(who, "Full name", text(person.get("full_name")));
            setValueOf(who, "ID.No", text(person.get("employee_code")));
            setValueOf(who, "Issuance No", text(j.get("issueNo")));
            XWPFTable cases = find(doc, "Initial assignment");
            for (XWPFTableCell cell : cases.getRow(0).getTableCells()) {
                for (XWPFParagraph p : cell.getParagraphs()) {
                    if (p.getText().contains(change ? "Position change" : "Initial assignment")) tick(p);
                }
            }
            XWPFParagraph completing = findParagraph(doc, "Completing training");
            if (!matrix.isEmpty()) TrainingAssessmentForm.fillAfter(completing, "version\\s*:?", text(matrix.get("code")) + " v" + matrix.get("version_no"));
            if (!change) {
                XWPFTable first = find(doc, "Substitute in absence");
                if (cellsText(first).contains("Department:")) {
                    setValueOf(first, "Department", text(j.get("departmentName")));
                    setValueOf(first, "Position", text(j.get("positionName")));
                    setValueOf(first, "direct superior", text(j.get("directSuperiorTitle")));
                    setValueOf(first, "subordinates", text(j.get("subordinateTitles")));
                    setValueOf(first, "Substitute", text(j.get("substituteTitle")));
                }
            } else {
                XWPFTable changed = find(doc, "Reason for change");
                // every Job Role the person held before and every one they hold after, one to a line (APD.0024); an older assignment without the list gives the one it replaces
                setValueOf(changed, "Current position", roleLines(j.get("rolesBefore"), text(j.get("previousPositionName")) + (previousDepartment.isEmpty() ? "" : " (" + previousDepartment + ")")));
                setValueOf(changed, "Reason for change", text(j.get("changeReason")));
                setValueOf(changed, "New position", roleLines(j.get("rolesAfter"), text(j.get("positionName")) + " (" + text(j.get("departmentName")) + ")"));
                setValueOf(changed, "direct superior", text(j.get("directSuperiorTitle")));
                setValueOf(changed, "subordinates", text(j.get("subordinateTitles")));
                setValueOf(changed, "Substitute", text(j.get("substituteTitle")));
            }
            // the jurisdiction: the first dotted line of the form carries the text, the second one is taken out
            XWPFParagraph heading = findParagraph(doc, "Jurisdiction");
            int at = doc.getPosOfParagraph(heading);
            if (at + 1 < doc.getBodyElements().size() && doc.getBodyElements().get(at + 1) instanceof XWPFParagraph line1) {
                setParagraph(line1, text(j.get("jurisdiction")));
                if (at + 2 < doc.getBodyElements().size() && doc.getBodyElements().get(at + 2) instanceof XWPFParagraph line2 && line2.getText().isBlank()) doc.removeBodyElement(at + 2);
            }
            // part 4: the Vietnamese text, then the English one in italic under it, a cell with several lines is several paragraphs
            List<String[]> duties = new ArrayList<>();
            for (Map<String, Object> d : (List<Map<String, Object>>) j.get("duties"))
                duties.add(new String[]{text(d.get("responsibility")), text(d.get("responsibilityEn")), text(d.get("description")), text(d.get("descriptionEn"))});
            fillRowsBilingual(find(doc, "Job description"), 1, duties);
            XWPFTable signers = find(doc, "Receiver");
            keepTogether(signers);
            if (!paper) {
                appendLine(signers.getRow(0).getCell(0), text(j.get("assignorTitle")));
                block(signers.getRow(0).getCell(0), j.get("assignorSignatureId"));
                block(signers.getRow(0).getCell(1), j.get("receiverSignatureId"));
            }
            if (control != null) controlLine(doc, control);
        });
        if (paper) {
            String sha = sha256(docx);
            jdbc.update("insert into training_job_prints(id, assignment_id, copy_no, print_code, sha256, reason, printed_by) values (?,?,?,?,?,?,?)",
                    UUID.randomUUID(), id, copy, printCode, sha, copy > 1 ? reason.trim() : null, actor.getId());
            audit.logAs(actor, "TRAINING_JOB_ASSIGNMENT", text(person.get("full_name")) + " #" + j.get("issueNo"), id, "TRAINING_JOB_ASSIGNMENT_PRINTED_ON_PAPER", null, printCode,
                    "Copy " + copy + ", SHA-256 " + sha + (copy > 1 ? ". Reason: " + reason.trim() : ""));
        } else {
            audit.logAs(actor, "TRAINING_JOB_ASSIGNMENT", text(person.get("full_name")) + " #" + j.get("issueNo"), id, "TRAINING_JOB_ASSIGNMENT_PRINTED", null, null, template.describe());
        }
        return templates.file(docx, format, "APD.0024-" + (person.get("employee_code") == null ? "" : person.get("employee_code") + "-") + j.get("issueNo") + (paper ? "-P" + copy : ""));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ FRM.0007

    /** The specimen signatures of a person (FRM.0007): the first one and each change, with the two images, the date and the head of the department who confirmed it. */
    @Transactional
    public Map<String, Object> specimen(UserAccount actor, UUID personId, String format) {
        TrainingFormTemplates.isPdf(format);
        Map<String, Object> person = jdbc.queryForList("select id, full_name, employee_code, start_date from app_users where id = ?", personId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        List<Map<String, Object>> versions = jdbc.queryForList("""
            select s.id, s.version_no, s.effective_date, s.status, cu.full_name as confirmed_by_name, s.confirmed_signature_id, (s.stored_path_2 is not null) as has_second
              from training_specimen_signatures s left join app_users cu on cu.id = s.confirmed_by
             where s.person_user_id = ? and (s.status = 'APPROVED' or (s.status = 'OBSOLETED' and s.effective_date is not null)) order by s.version_no
            """, personId);
        if (versions.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        // the images are read through the service of the specimens: the same permissions and the same entry in the Audit Trail as when they are opened on the screen
        List<byte[][]> images = new ArrayList<>();
        List<String[]> types = new ArrayList<>();
        for (Map<String, Object> v : versions) {
            Map<String, Object> one = specimens.image(actor, (UUID) v.get("id"), 1);
            Map<String, Object> two = Boolean.TRUE.equals(v.get("has_second")) ? specimens.image(actor, (UUID) v.get("id"), 2) : null;
            images.add(new byte[][]{(byte[]) one.get("bytes"), two == null ? null : (byte[]) two.get("bytes")});
            types.add(new String[]{text(one.get("contentType")), two == null ? "" : text(two.get("contentType"))});
        }
        TrainingFormTemplates.Template template = templates.enabled("FRM.0007");
        byte[] docx = write(template, false, doc -> {
            for (XWPFParagraph p : doc.getParagraphs()) {
                // the lines of the template are justified over a long dotted line: with a short name the words would be spread over the width of the page
                p.setAlignment(org.apache.poi.xwpf.usermodel.ParagraphAlignment.LEFT);
                TrainingAssessmentForm.fillAfter(p, "Name\\s*:", text(person.get("full_name")));
                TrainingAssessmentForm.fillAfter(p, "Employee code\\s*:", text(person.get("employee_code")));
                TrainingAssessmentForm.fillAfter(p, "joining the company\\s*:", day(person.get("start_date")));
            }
            XWPFTable table = find(doc, "1st signature");
            CTTbl ct = table.getCTTbl();
            if (ct.sizeOfTrArray() < 6) throw structure();
            // blocks of three rows: the first is the initial signature, the second is the model of a change; as many changes as there are
            List<CTRow> change = List.of((CTRow) ct.getTrArray(3).copy(), (CTRow) ct.getTrArray(4).copy(), (CTRow) ct.getTrArray(5).copy());
            while (ct.sizeOfTrArray() > 3) ct.removeTr(ct.sizeOfTrArray() - 1);
            for (int v = 1; v < versions.size(); v++) for (CTRow row : change) ct.addNewTr().set(row.copy());
            for (int v = 0; v < versions.size(); v++) {
                int base = v * 3;
                if (v > 0) {
                    XWPFTableRow title = row(table, base);
                    setText(title.getCell(0), "Thay đổi chữ ký lần " + v + "/ Signature change No " + v);
                }
                XWPFTableRow data = row(table, base + 2);
                Map<String, Object> version = versions.get(v);
                setText(data.getCell(0), day(version.get("effective_date")));
                picture(doc, data.getCell(1), images.get(v)[0], types.get(v)[0]);
                if (images.get(v)[1] != null) picture(doc, data.getCell(2), images.get(v)[1], types.get(v)[1]);
                setText(data.getCell(3), "");
                block(data.getCell(3), version.get("confirmed_signature_id"));
            }
        });
        audit.logAs(actor, "TRAINING_SPECIMEN", text(person.get("full_name")), personId, "TRAINING_SPECIMEN_FORM_EXPORTED", null, null, template.describe());
        return templates.file(docx, format, "FRM.0007-" + (person.get("employee_code") == null ? personId : person.get("employee_code")));
    }

    /** An image in a cell, scaled to fit it (at most 4.2 by 1.8 cm), in place of the text of the cell. */
    private static void picture(XWPFDocument doc, XWPFTableCell cell, byte[] bytes, String contentType) {
        setText(cell, "");
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            double width = image == null ? 120 : image.getWidth(), height = image == null ? 50 : image.getHeight();
            double scale = Math.min(119.0 / width, 51.0 / height);
            int type = contentType.contains("png") ? XWPFDocument.PICTURE_TYPE_PNG : contentType.contains("gif") ? XWPFDocument.PICTURE_TYPE_GIF : XWPFDocument.PICTURE_TYPE_JPEG;
            XWPFRun run = cell.getParagraphs().get(0).createRun();
            run.addPicture(new ByteArrayInputStream(bytes), type, "signature", Units.toEMU(width * scale), Units.toEMU(height * scale));
        } catch (Exception e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ APD.0014

    /**
     * The personal training record of a person (APD.0014): name, qualification, date of joining and the training history, signed by the preparer and by the QA manager (the two
     * electronic signatures of the export). Word; the caller makes the PDF when it needs one.
     */
    public byte[] personalRecord(UserAccount person, String qualification, List<Map<String, Object>> history, UUID preparedSignature, Object preparedAt, UUID approvedSignature, Object approvedAt) {
        TrainingFormTemplates.Template template = templates.enabled("APD.0014");
        return write(template, true, doc -> {
            XWPFTable header = find(doc, "Page:");
            setText(header.getRow(header.getRows().size() - 1).getCell(header.getRow(header.getRows().size() - 1).getTableCells().size() - 1), "Code: " + text(person.getEmployeeCode()));
            XWPFTable info = find(doc, "Qualification");
            if (info.getRows().size() < 2 || info.getRow(1).getTableCells().size() < 2) throw structure();
            XWPFParagraph nameCell = info.getRow(0).getCell(0).getParagraphs().get(0);
            setParagraph(nameCell, text(nameCell.getText()).trim() + " " + person.getFullName());
            appendLine(info.getRow(1).getCell(0), qualification);
            appendLine(info.getRow(1).getCell(1), person.getStartDate() == null ? "" : DateTimeFormatUtils.display(person.getStartDate()));
            List<List<String>> lines = new ArrayList<>();
            for (Map<String, Object> r : history) {
                String content = text(r.get("topic_text")) + (r.get("document_number") == null ? "" : " (" + r.get("document_number") + (r.get("document_revision") == null ? "" : " v" + r.get("document_revision")) + ")");
                if (r.get("voided_at") != null) content = "[VOIDED] " + content;
                lines.add(List.of(content, day(r.get("completed_on")), text(r.get("training_number"))));
            }
            fillRows(find(doc, "Training number"), lines);
            XWPFTable signers = find(doc, "Preprared by");
            if (signers.getRows().size() < 2) throw structure();
            setText(signers.getRow(0).getCell(0), "Ngày/ Date: " + day(preparedAt));
            setText(signers.getRow(0).getCell(1), "Ngày/ Date: " + day(approvedAt));
            block(signers.getRow(1).getCell(0), preparedSignature);
            block(signers.getRow(1).getCell(1), approvedSignature);
        });
    }

}

package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.util.DateTimeFormatUtils;
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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.UUID;

import static com.eqms.service.training.TrainingWordForms.appendBlock;
import static com.eqms.service.training.TrainingWordForms.appendLine;
import static com.eqms.service.training.TrainingWordForms.cellsText;
import static com.eqms.service.training.TrainingWordForms.fillRows;
import static com.eqms.service.training.TrainingWordForms.fillRowsBilingual;
import static com.eqms.service.training.TrainingWordForms.find;
import static com.eqms.service.training.TrainingWordForms.findAll;
import static com.eqms.service.training.TrainingWordForms.findAny;
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
 * requirement (APD.0118), the self-reading list (APD.0108), the job assignment (APD.0024) and the personal training record (APD.0014). FRM.0044 and FRM.0007 are paper forms requested as controlled copies in Document Control (owner
 * decision 2026-10-28): the system does not write them. Word or PDF; the PDF is made by the document server from the Word file. The notes of the template that describe the form (header, footer, history of revisions) are not
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
    private final AuditTrailService audit;
    private final TrainingSignatureBlocks blocks;

    public TrainingFormExportService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingFormTemplates templates, TrainingRequirementService requirements,
                                     TrainingJobAssignmentService jobs, AuditTrailService audit, TrainingSignatureBlocks blocks) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.templates = templates;
        this.requirements = requirements;
        this.jobs = jobs;
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

    /** A template written with tokens (the Training Annex): filled by the engine and read back; a paper print gets its control line. */
    private byte[] annexWrite(TrainingFormTemplates.Template template, TrainingAnnexData data, String control) {
        try {
            byte[] filled = TrainingAnnexEngine.render(template.bytes(), data);
            try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(filled)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                if (control != null) controlLine(doc, control);
                doc.write(out);
                return out.toByteArray();
            }
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    private List<String> signatureLines(String code, String slot, Object signatureId) {
        return signatureId instanceof UUID id ? blocks.lines(id, code, slot) : List.of();
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
        TrainingFormTemplates.Template template = templates.enabledFor("APD.0118", "REQUIREMENT", id, actor, format, true);
        byte[] annexed = TrainingAnnexEngine.isTokenized(template.bytes()) ? annexWrite(template, annexRequirement(r, template.versionLabel()), null) : null;
        byte[] docx = annexed != null ? annexed : write(template, true, doc -> {
            XWPFTable header = find(doc, "Page:");
            if (header.getRows().size() < 3) throw structure();
            setText(header.getRow(1).getCell(2), "Year: " + r.get("year"));
            setText(header.getRow(2).getCell(2), "Request No: " + r.get("requestNo"));
            boolean periodic = "SOP_PERIODIC".equals(r.get("kind"));
            tick(findParagraph(doc, periodic ? "Periodic training SOP" : "Annual training"));
            List<List<String>> lines = new ArrayList<>();
            for (Map<String, Object> l : (List<Map<String, Object>>) r.get("lines")) {
                lines.add(List.of(text(l.get("lineNo")), monthOf(l), (l.get("code") == null ? "" : l.get("code") + " - ") + text(l.get("title")),
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
        return templates.file(docx, format, templates.fileName("APD.0118", "APD.0118", template.versionLabel(), Map.of("REQUEST_NO", text(r.get("requestNo")), "YEAR", text(r.get("year")))));
    }

    /** The tokens of APD.0118 (PLAN-TR-004, 8.4). The column of the signature of QA is narrow: it holds the name and the time, the whole block is in the electronic signature record. */
    @SuppressWarnings("unchecked")
    private TrainingAnnexData annexRequirement(Map<String, Object> r, String revision) {
        List<TrainingAnnexData.Item> lines = new ArrayList<>();
        for (Map<String, Object> l : (List<Map<String, Object>>) r.get("lines")) {
            // the style of the slot decides how much is written (Compact by default: the name, then the meaning and the time)
            List<String> compact = signatureLines("APD.0118", "LINE.QA", l.get("qaSignatureId"));
            lines.add(new TrainingAnnexData.Item().field("NO", text(l.get("lineNo"))).field("MONTH", monthOf(l))
                    .field("TOPIC", (l.get("code") == null ? "" : l.get("code") + " - ") + text(l.get("title"))).field("CODE", text(l.get("trainingNumber")))
                    .field("EXECUTION_DATE", day(l.get("executedOn"))).field("QA_COMMENT", text(l.get("qaComment"))).signature("QA", compact));
        }
        boolean periodic = "SOP_PERIODIC".equals(r.get("kind"));
        return TrainingAnnexData.forForm("APD.0118", revision).scalar("YEAR", text(r.get("year"))).scalar("REQUEST_NO", text(r.get("requestNo")))
                .check("KIND_PERIODIC_SOP", periodic).check("KIND_ANNUAL", !periodic).group("LINE", lines)
                .signature("PREPARED", signatureLines("APD.0118", "PREPARED", r.get("preparedSignatureId"))).signature("REVIEWED", signatureLines("APD.0118", "REVIEWED", r.get("reviewedSignatureId")))
                .signature("APPROVED", signatureLines("APD.0118", "APPROVED", r.get("approvedSignatureId")));
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
        return selfReading(actor, sessionId, format, null);
    }

    /** The reason the head typed in the electronic signature window, written in the box Remarks; the plain sentence the system writes when nothing was typed is not a remark. */
    private String headRemarks(Object signatureId) {
        String reason = signatureId instanceof UUID id ? blocks.reason(id) : null;
        return reason == null || reason.isBlank() || reason.startsWith("Training Management:") ? "" : reason.trim();
    }

    /** The people of one department in a self-reading session; {@code id} is null when the department of the people is not in the master data. */
    private record DepartmentGroup(UUID id, String name, String code, List<Map<String, Object>> people) {}

    /**
     * One list for one department ({@code departmentId}), or a ZIP with one list for each department of the session when none is chosen and there are several. The list is only the record of what was signed in the
     * system (owner decision 2026-10-31: the self-reading is confirmed by electronic signature only), so it has no copy number and no paper print.
     */
    @Transactional
    public Map<String, Object> selfReading(UserAccount actor, UUID sessionId, String format, UUID departmentId) {
        return selfReading(actor, sessionId, format, departmentId, null);
    }

    /** The same, with a department that is not in the master data asked by its name (it has no id). */
    @Transactional
    public Map<String, Object> selfReading(UserAccount actor, UUID sessionId, String format, UUID departmentId, String departmentName) {
        TrainingFormTemplates.isPdf(format);
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct");
        Map<String, Object> session = jdbc.queryForList("select * from training_sessions where id = ?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> activity = store.activity((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!"SELF_READING".equals(session.get("method"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_SELF_READING");
        Map<String, DepartmentGroup> groups = new LinkedHashMap<>();
        for (Map<String, Object> p : jdbc.queryForList("""
            select p.employee_code, p.full_name, p.state, p.read_confirmed_at, p.attend_signature_id, d.id as department_id, coalesce(d.name, nullif(btrim(p.department), '')) as department_name, d.code as department_code
              from training_participants p left join departments d on lower(btrim(d.name)) = lower(btrim(p.department))
             where p.session_id = ? and p.external_name is null order by 6 nulls last, p.full_name
            """, sessionId)) {
            String key = String.valueOf(p.get("department_id") == null ? "-" + text(p.get("department_name")) : p.get("department_id"));
            groups.computeIfAbsent(key, k -> new DepartmentGroup((UUID) p.get("department_id"), text(p.get("department_name")), text(p.get("department_code")), new ArrayList<>())).people().add(p);
        }
        List<DepartmentGroup> chosen = new ArrayList<>(groups.values());
        if (departmentId != null) {
            chosen = chosen.stream().filter(g -> departmentId.equals(g.id())).toList();
            if (chosen.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_SELF_READING_DEPARTMENT_NOT_FOUND");
        } else if (departmentName != null && !departmentName.isBlank()) {
            chosen = chosen.stream().filter(g -> g.id() == null && g.name().equalsIgnoreCase(departmentName.trim())).toList();
            if (chosen.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_SELF_READING_DEPARTMENT_NOT_FOUND");
        }
        if (chosen.isEmpty()) chosen = List.of(new DepartmentGroup(null, "", "", List.of()));
        if (chosen.size() == 1) return selfReadingOne(actor, sessionId, format, chosen.get(0), groups.size() > 1);
        // several departments: one list for each, in one ZIP
        java.io.ByteArrayOutputStream zip = new java.io.ByteArrayOutputStream();
        String base = text(activity.get("training_number")).replace('/', '-') + "-S" + session.get("session_no") + "-APD.0108";
        try (java.util.zip.ZipOutputStream out = new java.util.zip.ZipOutputStream(zip)) {
            Set<String> used = new HashSet<>();
            for (DepartmentGroup g : chosen) {
                Map<String, Object> file = selfReadingOne(actor, sessionId, format, g, true);
                String name = String.valueOf(file.get("name"));
                while (!used.add(name)) name = "x-" + name;
                out.putNextEntry(new java.util.zip.ZipEntry(name));
                out.write((byte[]) file.get("bytes"));
                out.closeEntry();
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
        return Map.of("bytes", zip.toByteArray(), "name", base + ".zip", "contentType", "application/zip");
    }

    /** SOP.0003 5.3.7: a person who did not take part stays on the original list, marked "Vắng mặt" in the signature column (never left blank, never removed). */
    private static List<String> absentMark(Map<String, Object> p) {
        return "ABSENT".equals(p.get("state")) ? List.of("Vắng mặt / Absent") : List.of();
    }

    private Map<String, Object> selfReadingOne(UserAccount actor, UUID sessionId, String format, DepartmentGroup group, boolean manyDepartments) {
        Map<String, Object> session = jdbc.queryForList("select * from training_sessions where id = ?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> activity = store.activity((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        TrainingFormTemplates.Template template = templates.enabledFor("APD.0108", "SESSION", sessionId, actor, format, true);
        // the department of the list is the department of its people (the organizing department only when the people have none)
        String department = group.name().isBlank() ? jdbc.queryForObject("select name from departments where id = ?", String.class, activity.get("organizer_department_id")) : group.name();
        List<Map<String, Object>> topics = jdbc.queryForList("""
            select coalesce(st.document_number, d.document_number) as document_number, coalesce(d.document_name, st.topic_text) as name, r.revision_number
              from training_session_topics st left join document_revisions r on r.id = st.document_revision_id left join documents d on d.id = coalesce(st.document_id, r.document_id)
             where st.session_id = ? order by st.topic_text
            """, sessionId);
        List<Map<String, Object>> people = group.people();
        // the head who confirmed this department; a confirmation made before the departments were told apart (no department) covers the whole activity, so it is shown only when there is one list
        Map<String, Object> head = jdbc.queryForList("""
            select u.full_name, u.position, c.confirmed_at, c.signature_id from training_active_confirmations c join app_users u on u.id = c.confirmed_by
             where c.activity_id = ? and c.kind = 'HEAD_SELF_READING' and (c.department_id = ? or (c.department_id is null and ?)) order by c.confirmed_at desc limit 1
            """, activity.get("id"), group.id(), !manyDepartments).stream().findFirst().orElse(Map.of());
        byte[] annexed = null;
        if (TrainingAnnexEngine.isTokenized(template.bytes())) {
            List<String> names = new ArrayList<>();
            for (Map<String, Object> t : topics) names.add(text(t.get("document_number")) + " " + text(t.get("name")) + (t.get("revision_number") == null ? "" : " (" + t.get("revision_number") + ")"));
            List<TrainingAnnexData.Item> readers = new ArrayList<>();
            int row = 1;
            for (Map<String, Object> p : people) {
                boolean read = "READ_CONFIRMED".equals(p.get("state"));
                readers.add(new TrainingAnnexData.Item().field("NO", String.valueOf(row++)).field("CODE", text(p.get("employee_code"))).field("NAME", text(p.get("full_name")))
                        .field("TRAINING_NUMBER", text(activity.get("training_number"))).field("DATE", read ? day(p.get("read_confirmed_at")) : "")
                        .signature("CONFIRMED", read ? signatureLines("APD.0108", "READER.CONFIRMED", p.get("attend_signature_id")) : absentMark(p)));
            }
            boolean headSigned = !head.isEmpty();
            annexed = annexWrite(template, TrainingAnnexData.forForm("APD.0108", template.versionLabel()).scalar("DEPARTMENT", department)
                    .scalar("DOCUMENT_NAME_VERSION", String.join("; ", names).trim()).scalar("HEAD_NAME", headSigned ? text(head.get("full_name")) : "")
                    .scalar("HEAD_POSITION", headSigned ? text(head.get("position")) : "").scalar("HEAD_DATE", headSigned ? day(head.get("confirmed_at")) : "").scalar("HEAD_REMARKS", headSigned ? headRemarks(head.get("signature_id")) : "")
                    .group("READER", readers).signature("HEAD", headSigned ? signatureLines("APD.0108", "HEAD", head.get("signature_id")) : List.of()), null);
        }
        byte[] docx = annexed != null ? annexed : write(template, true, doc -> {
            XWPFParagraph dep = findParagraph(doc, "Department");
            setParagraph(dep, text(dep.getText()).trim() + " " + department);
            XWPFParagraph document = findParagraph(doc, "name of document");
            List<String> names = new ArrayList<>();
            for (Map<String, Object> t : topics) names.add(text(t.get("document_number")) + " " + text(t.get("name")) + (t.get("revision_number") == null ? "" : " (" + t.get("revision_number") + ")"));
            setParagraph(document, text(document.getText()).trim() + " " + String.join("; ", names).trim());
            List<List<String>> lines = new ArrayList<>();
            int no = 1;
            for (Map<String, Object> p : people) {
                boolean read = "READ_CONFIRMED".equals(p.get("state"));
                lines.add(List.of(String.valueOf(no++), text(p.get("employee_code")), text(p.get("full_name")), text(activity.get("training_number")), read ? day(p.get("read_confirmed_at")) : "",
                        read ? String.join(" ", signatureLines("APD.0108", "READER.CONFIRMED", p.get("attend_signature_id"))) : String.join(" ", absentMark(p))));
            }
            fillRows(find(doc, "Signature"), lines);
            XWPFTable confirm = find(doc, "CONFIRMED BY HEAD");
            if (confirm.getRows().size() < 2 || confirm.getRow(1).getTableCells().size() < 3) throw structure();
            if (!head.isEmpty()) {
                for (XWPFParagraph p : confirm.getRow(1).getCell(0).getParagraphs()) {
                    TrainingAssessmentForm.fillAfter(p, "Full name\\s*:?", text(head.get("full_name")));
                    TrainingAssessmentForm.fillAfter(p, "Position\\s*:?", text(head.get("position")));
                    TrainingAssessmentForm.fillAfter(p, "Date\\s*:?", day(head.get("confirmed_at")));
                }
                XWPFTableCell signature = confirm.getRow(1).getCell(1);
                block(signature, head.get("signature_id"));
            }
        });
        audit.logAs(actor, "TRAINING_ACTIVITY", text(activity.get("training_number")), (UUID) activity.get("id"), "TRAINING_SELF_READING_LIST_EXPORTED", null, null, template.describe());
        Map<String, Object> made = templates.file(docx, format, templates.fileName("APD.0108", "APD.0108", template.versionLabel(),
                Map.of("TRAINING_NUMBER", text(activity.get("training_number")), "SESSION_NO", String.format("%02d", ((Number) session.get("session_no")).intValue()), "DEPARTMENT", text(group.name()))));
        return made;
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

    /**
     * What the cell "Assignor*" of APD.0024 says under the signature, as the note of the form asks: when the person who receives the job is the head of a department, the QM or the QP,
     * the title of the assignor; when the receiver is a staff member, the head of the department of that employee.
     */
    private String assignorLine(Map<String, Object> j, Map<String, Object> person) {
        String title = text(j.get("assignorTitle"));
        Map<String, Object> who = jdbc.queryForList("select position, department from app_users where id = ?", j.get("personUserId")).stream().findFirst().orElse(Map.of());
        boolean head = Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from departments where department_head_id = ?)", Boolean.class, j.get("personUserId")));
        String position = text(who.get("position"));
        boolean management = head || position.matches("(?i).*(\bQM\b|\bQP\b|quality manager|qualified person|trưởng\b|manager).*");
        if (management) return title.isBlank() ? "" : "Chức danh người giao việc/ Title of the assignor: " + title;
        Map<String, Object> dept = jdbc.queryForList("select h.full_name as head_name, d.name from departments d left join app_users h on h.id = d.department_head_id where lower(d.name) = lower(?)", text(who.get("department"))).stream().findFirst().orElse(Map.of());
        if (dept.get("head_name") == null) return title.isBlank() ? "" : "Chức danh người giao việc/ Title of the assignor: " + title;
        return "Trưởng đơn vị/ Head of department: " + dept.get("head_name") + " (" + dept.get("name") + ")";
    }

    /** The code in the header of APD.0024 is the code of the form with the revision in force (APD.0024.02), not the code of the employee. */
    private static byte[] withHeaderCode(byte[] docx, String employeeCode, String formCode) {
        if (employeeCode == null || employeeCode.isBlank()) return docx;
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (org.apache.poi.xwpf.usermodel.XWPFHeader h : doc.getHeaderList()) {
                List<XWPFParagraph> all = new ArrayList<>(h.getParagraphs());
                for (XWPFTable t : h.getTables()) for (var r : t.getRows()) for (var c : r.getTableCells()) all.addAll(c.getParagraphs());
                for (XWPFParagraph p : all) {
                    for (var run : p.getRuns()) {
                        String t = run.text();
                        if (t != null && t.contains(employeeCode)) run.setText(t.replace(employeeCode, formCode), 0);
                    }
                    if (p.getText().contains(employeeCode) && !p.getRuns().isEmpty()) setParagraph(p, p.getText().replace(employeeCode, formCode));
                }
            }
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    /** When the jurisdiction is written, the dotted lines of the form under the heading "3. Quyền hạn" are not needed and are taken out. */
    private static byte[] withoutJurisdictionDots(byte[] docx) {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // the dotted lines are empty paragraphs (a tab with a dotted leader) between the heading "3." and the heading "4."
            List<XWPFParagraph> dots = new ArrayList<>();
            boolean inside = false;
            for (XWPFParagraph p : doc.getParagraphs()) {
                String t = p.getText().trim();
                if (t.startsWith("3.") && t.contains("Jurisdiction")) { inside = true; continue; }
                if (inside && t.startsWith("4.")) break;
                if (inside && (t.isEmpty() || t.matches("[.…\s]+"))) dots.add(p);
            }
            for (XWPFParagraph p : dots) doc.removeBodyElement(doc.getPosOfParagraph(p));
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    /** The paper print of the job assignment, to be signed by hand: the data is written, the signatures are not; the copy is numbered and recorded, and a reprint needs a reason. */
    @Transactional
    public Map<String, Object> jobAssignmentPaper(UserAccount actor, UUID id, String format, String reason) {
        return jobAssignment(actor, id, format, true, reason);
    }

    @SuppressWarnings("unchecked")
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
        TrainingFormTemplates.Template template = templates.enabledFor("APD.0024", "JOB_ASSIGNMENT", id, actor, format, true);
        byte[] annexed = null;
        if (TrainingAnnexEngine.isTokenized(template.bytes())) {
            List<TrainingAnnexData.Item> dutyItems = new ArrayList<>();
            for (Map<String, Object> d : (List<Map<String, Object>>) j.get("duties")) {
                dutyItems.add(new TrainingAnnexData.Item().field("RESPONSIBILITY", (text(d.get("responsibility")) + "\n" + text(d.get("responsibilityEn"))).trim())
                        .field("DESCRIPTION", (text(d.get("description")) + "\n" + text(d.get("descriptionEn"))).trim()));
            }
            annexed = annexWrite(template, TrainingAnnexData.forForm("APD.0024", template.versionLabel()).scalar("EMPLOYEE_CODE", text(person.get("employee_code")))
                    .scalar("EMPLOYEE_NAME", text(person.get("full_name"))).scalar("ISSUANCE_NO", text(j.get("issueNo")))
                    .scalar("MATRIX_CODE_VERSION", matrix.isEmpty() ? "" : text(matrix.get("code")) + " v" + matrix.get("version_no")).scalar("JURISDICTION", text(j.get("jurisdiction")))
                    .scalar("ASSIGNOR_TITLE", paper ? "" : assignorLine(j, person))
                    .scalar("DEPARTMENT", text(j.get("departmentNames")).isBlank() ? text(j.get("departmentName")) : text(j.get("departmentNames")))
                    .scalar("POSITION", roleLines(j.get("rolesAfter"), text(j.get("positionName")))).scalar("SUPERIOR", text(j.get("directSuperiorTitle")))
                    .scalar("SUBORDINATES", text(j.get("subordinateTitles"))).scalar("SUBSTITUTE", text(j.get("substituteTitle")))
                    .scalar("CURRENT_POSITION", roleLines(j.get("rolesBefore"), text(j.get("previousPositionName")) + (previousDepartment.isEmpty() ? "" : " (" + previousDepartment + ")")))
                    .scalar("CHANGE_REASON", text(j.get("changeReason")))
                    .scalar("NEW_POSITION", roleLines(j.get("rolesAfter"), text(j.get("positionName")) + " (" + text(j.get("departmentName")) + ")"))
                    .check("CASE_INITIAL", !change).check("CASE_CHANGE", change).caseOn("INITIAL", !change).caseOn("CHANGE", change).group("DUTY", dutyItems)
                    .signature("ASSIGNOR", paper ? List.of() : signatureLines("APD.0024", "ASSIGNOR", j.get("assignorSignatureId"))).signature("RECEIVER", paper ? List.of() : signatureLines("APD.0024", "RECEIVER", j.get("receiverSignatureId"))), control);
        }
        if (annexed != null && !text(j.get("jurisdiction")).isBlank()) annexed = withoutJurisdictionDots(annexed);
        final String formCode = TrainingAnnexContract.fullCode("APD.0024", template.versionLabel());
        if (annexed != null) annexed = withHeaderCode(annexed, text(person.get("employee_code")), formCode);
        byte[] docx = annexed != null ? annexed : write(template, true, doc -> {
            XWPFTable header = find(doc, "Page:");
            setText(header.getRow(header.getRows().size() - 1).getCell(header.getRow(header.getRows().size() - 1).getTableCells().size() - 1), "Code: " + formCode);
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
                    setValueOf(first, "Department", text(j.get("departmentNames")).isBlank() ? text(j.get("departmentName")) : text(j.get("departmentNames")));
                    setValueOf(first, "Position", roleLines(j.get("rolesAfter"), text(j.get("positionName"))));
                    setValueOf(first, "direct superior", text(j.get("directSuperiorTitle")));
                    setValueOf(first, "subordinates", text(j.get("subordinateTitles")));
                    setValueOf(first, "Substitute", text(j.get("substituteTitle")));
                }
            } else {
                XWPFTable changed = find(doc, "Reason for change");
                // every Work Position the person held before and every one they hold after, one to a line (APD.0024); an older assignment without the list gives the one it replaces
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
                appendLine(signers.getRow(0).getCell(0), assignorLine(j, person));
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
        return templates.file(docx, format, templates.fileName("APD.0024", "APD.0024", template.versionLabel(),
                Map.of("EMPLOYEE_CODE", text(person.get("employee_code")), "EMPLOYEE_NAME", text(person.get("full_name")), "ISSUE_NO", text(j.get("issueNo")),
                        "DEPARTMENT", text(j.get("departmentName")))) + (paper ? "-P" + copy : ""));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ APD.0014

    /**
     * The personal training record of a person (APD.0014): name, qualification, date of joining and the training history, signed by the preparer and by the QA manager (the two
     * electronic signatures of the export). Word; the caller makes the PDF when it needs one.
     */
    public byte[] personalRecord(UserAccount person, String qualification, List<Map<String, Object>> history, UUID preparedSignature, Object preparedAt, UUID approvedSignature, Object approvedAt) {
        TrainingFormTemplates.Template template = templates.enabled("APD.0014");
        if (TrainingAnnexEngine.isTokenized(template.bytes())) {
            List<TrainingAnnexData.Item> rows = new ArrayList<>();
            for (Map<String, Object> r : history) {
                String content = text(r.get("topic_text")) + (r.get("document_number") == null ? "" : " (" + r.get("document_number") + (r.get("document_revision") == null ? "" : " v" + r.get("document_revision")) + ")");
                if (r.get("voided_at") != null) content = "[VOIDED] " + content;
                rows.add(new TrainingAnnexData.Item().field("CONTENT", content).field("DATE", day(r.get("completed_on"))).field("NUMBER", text(r.get("training_number"))));
            }
            return annexWrite(template, TrainingAnnexData.forForm("APD.0014", template.versionLabel()).scalar("EMPLOYEE_CODE", text(person.getEmployeeCode()))
                    .scalar("EMPLOYEE_NAME", person.getFullName()).scalar("QUALIFICATION", text(qualification))
                    .scalar("JOIN_DATE", person.getStartDate() == null ? "" : DateTimeFormatUtils.display(person.getStartDate()))
                    .scalar("PREPARED_DATE", day(preparedAt)).scalar("APPROVED_DATE", day(approvedAt)).group("RECORD", rows)
                    .signature("PREPARED", signatureLines("APD.0014", "PREPARED", preparedSignature)).signature("APPROVED", signatureLines("APD.0014", "APPROVED", approvedSignature)), null);
        }
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
            XWPFTable signers = findAny(doc, "Preprared by", "Prepared by");
            if (signers.getRows().size() < 2) throw structure();
            setText(signers.getRow(0).getCell(0), "Ngày/ Date: " + day(preparedAt));
            setText(signers.getRow(0).getCell(1), "Ngày/ Date: " + day(approvedAt));
            block(signers.getRow(1).getCell(0), preparedSignature);
            block(signers.getRow(1).getCell(1), approvedSignature);
        });
    }

    /** The month of a line of the requirement; a line that was moved also says the month it was approved for (the approved record is not made to look unchanged). */
    private static String monthOf(Map<String, Object> line) {
        String month = DateTimeFormatUtils.displayMonth(line.get("plannedMonth"));
        return line.get("postponedFrom") == null ? month : month + " (approved " + DateTimeFormatUtils.displayMonth(line.get("postponedFrom")) + ")";
    }
}

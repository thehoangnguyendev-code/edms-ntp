package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.util.DateTimeFormatUtils;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The attendance list of a training activity in the form APD.0117 (SOP.0003 5.3.4): the file the organization keeps as the template, filled from the activity, as Word or as PDF. The template
 * is the Word file that Training Administration uploaded and enabled with a signature (Training Properties, form templates, code APD.0117); a new version of the form is used as soon as it is
 * enabled. The printed instructions of the template (the description of the header and the footer, the notes and the history of revisions) are not part of the form and are not written to
 * the file. When the activity has not started, the signature boxes stay empty for the wet signature; afterwards each line shows what was recorded in the system (checked in, present,
 * online, absent) and the result. Every export is written to the Audit Trail with the version and the SHA-256 of the template.
 */
@Service
public class TrainingAttendanceListService {
    public static final String TEMPLATE_CODE = "APD.0117";
    private static final String STRUCTURE = "TRAINING_FORM_TEMPLATE_STRUCTURE";

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingFileService files;
    private final OnlyOfficeDocumentEditService onlyOffice;

    public TrainingAttendanceListService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingFileService files, OnlyOfficeDocumentEditService onlyOffice) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.files = files;
        this.onlyOffice = onlyOffice;
    }

    /** What is written in the form, read from the activity. */
    private record Data(Map<String, Object> activity, String department, List<Map<String, Object>> sessions, Map<UUID, List<Map<String, Object>>> topics,
                        Map<UUID, List<Map<String, Object>>> people, Map<UUID, String> retraining, String preparedBy, String preparedAt, String completedBy, String completedAt) {
    }

    // A refusal (no template, no document server) writes nothing, and a caller inside another transaction (the e-mail of the attendance list) must not be rolled back by it.
    @Transactional(noRollbackFor = RuntimeException.class)
    public Map<String, Object> export(UserAccount actor, UUID activityId, String format) {
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct");
        Map<String, Object> activity = store.activity(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (format == null || !List.of("docx", "pdf").contains(format.toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("TRAINING_FORMAT_INVALID");
        if ("RESERVED".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_CLOSED");
        Integer sessions = jdbc.queryForObject("select count(*) from training_sessions where activity_id = ? and status <> 'CANCELLED'", Integer.class, activityId);
        if (sessions == null || sessions == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_REQUIRED");
        Map<String, Object> template = jdbc.queryForList("select * from training_form_templates where code = ? and status = 'ENABLED' order by activated_at desc limit 1", TEMPLATE_CODE).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FORM_TEMPLATE_MISSING"));
        byte[] source = files.readStored(String.valueOf(template.get("provider")), String.valueOf(template.get("stored_path")), String.valueOf(template.get("sha256")));
        byte[] docx;
        try {
            docx = fill(source, load(activity));
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
        boolean pdf = "pdf".equalsIgnoreCase(format);
        byte[] bytes = pdf ? toPdf(docx) : docx;
        String name = String.valueOf(activity.get("training_number")).replace('/', '-') + "-" + TEMPLATE_CODE + (pdf ? ".pdf" : ".docx");
        store.auditActivity(actor, activity, "TRAINING_ATTENDANCE_LIST_EXPORTED", null, TEMPLATE_CODE + " " + template.get("version_label"),
                (pdf ? "PDF" : "Word") + ", template SHA-256 " + template.get("sha256"));
        return Map.of("bytes", bytes, "name", name, "contentType", pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    private byte[] toPdf(byte[] docx) {
        Path temp = null;
        try {
            temp = Files.createTempFile("training-apd0117-", ".docx");
            Files.write(temp, docx);
            return onlyOffice.convertLocalFileToPdf(temp, temp.getFileName().toString());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_PREVIEW_UNAVAILABLE");
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        } finally {
            if (temp != null) {
                try { Files.deleteIfExists(temp); } catch (IOException ignored) { /* a temporary file */ }
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the data

    private Data load(Map<String, Object> activity) {
        UUID id = (UUID) activity.get("id");
        String department = jdbc.queryForList("select name from departments where id = ?", String.class, activity.get("organizer_department_id")).stream().findFirst().orElse("");
        List<Map<String, Object>> sessions = jdbc.queryForList("""
            select s.id, s.session_no, s.method, s.scheduled_on, s.held_on, s.attendance_confirmed_at,
                   coalesce(u.full_name, s.external_trainer_name, case when a.kind = 'EXTERNAL' then a.training_unit_name end) as trainer
              from training_sessions s join training_activities a on a.id = s.activity_id left join app_users u on u.id = s.trainer_user_id
             where s.activity_id = ? and s.status <> 'CANCELLED' order by s.session_no
            """, id);
        Map<UUID, List<Map<String, Object>>> topics = new HashMap<>();
        Map<UUID, List<Map<String, Object>>> people = new HashMap<>();
        for (Map<String, Object> s : sessions) {
            UUID sid = (UUID) s.get("id");
            // A topic that comes from a document is written with the name of the document and its title in the local language ("Data Integrity / Toàn vẹn dữ liệu"); its code is the document number only.
            topics.put(sid, jdbc.queryForList("""
                select st.topic_text, coalesce(st.document_number, d.document_number) as document_number, d.document_name,
                       coalesce(nullif(trim(r.title_local_language), ''), nullif(trim(d.title_local_language), '')) as local_title
                  from training_session_topics st left join document_revisions r on r.id = st.document_revision_id left join documents d on d.id = coalesce(st.document_id, r.document_id)
                 where st.session_id = ? order by st.topic_text
                """, sid));
            people.put(sid, jdbc.queryForList("""
                select p.person_user_id, p.employee_code, p.full_name, p.department, p.state, p.result, p.sign_mode, p.attend_signature_id, p.planned_absence
                  from training_participants p where p.session_id = ? order by p.external_name is not null, p.full_name
                """, sid));
        }
        Map<UUID, String> retraining = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList("""
            select p.person_user_id, p.result, p.state from training_participants p join training_activities c on c.id = p.activity_id
             where c.parent_activity_id = ? and p.person_user_id is not null and c.status <> 'CANCELLED' order by c.created_at
            """, id)) {
            retraining.put((UUID) r.get("person_user_id"), result(String.valueOf(r.get("result")), String.valueOf(r.get("state"))));
        }
        Map<String, Object> prepared = jdbc.queryForList("""
            select u.full_name, c.confirmed_at from training_active_confirmations c join app_users u on u.id = c.confirmed_by where c.activity_id = ? and c.kind = 'ATTENDEE_LIST_PREPARED'
             order by c.confirmed_at desc limit 1
            """, id).stream().findFirst().orElse(Map.of());
        Map<String, Object> completed = jdbc.queryForList("""
            select u.full_name, c.confirmed_at from training_active_confirmations c join app_users u on u.id = c.confirmed_by where c.activity_id = ? and c.kind = 'QA_COMPLETION'
             order by c.confirmed_at desc limit 1
            """, id).stream().findFirst().orElse(Map.of());
        return new Data(activity, department, sessions, topics, people, retraining, text(prepared.get("full_name")), signedAt(prepared.get("confirmed_at")), text(completed.get("full_name")), signedAt(completed.get("confirmed_at")));
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String signedAt(Object when) {
        return when == null ? "" : "Ký điện tử / Signed electronically " + DateTimeFormatUtils.formatDateTime(when);
    }

    private static String kind(Map<String, Object> activity) {
        String reason = text(activity.get("kind_reason"));
        return switch (text(activity.get("kind"))) {
            case "INITIAL" -> "Ban đầu / Initial" + (reason.isEmpty() ? "" : " (" + reason.toLowerCase(Locale.ROOT).replace('_', ' ') + ")");
            case "PERIODIC" -> "Định kỳ / Periodic";
            case "EXTERNAL" -> "Bên ngoài / External" + (text(activity.get("training_unit_name")).isEmpty() ? "" : ": " + activity.get("training_unit_name"));
            default -> "Đột xuất / Unplanned" + (reason.isEmpty() || "OTHER".equals(reason) ? "" : " (" + reason.toLowerCase(Locale.ROOT).replace('_', ' ') + ")");
        };
    }

    private static String mode(Object method) {
        return switch (text(method)) {
            case "CLASSROOM" -> "Tập trung / Classroom";
            case "SELF_READING" -> "Tự đọc / Self-reading";
            case "HYBRID" -> "Kết hợp / Hybrid";
            case "PRACTICAL" -> "Thực hành / Practical";
            default -> "";
        };
    }

    private static String result(String result, String state) {
        if ("READ_CONFIRMED".equals(state)) return "Đã đọc / Read";
        return switch (result) {
            case "PASSED" -> "Đạt / Passed";
            case "FAILED" -> "Không đạt / Failed";
            default -> "";
        };
    }

    /** What the "Signature" column says. Before the training it stays empty for the wet signature; afterwards it says what was recorded (SOP.0003 5.3.7: "Online", "Absent"). */
    private static String signature(Map<String, Object> p) {
        String mode = text(p.get("sign_mode"));
        return switch (text(p.get("state"))) {
            case "ABSENT" -> "Vắng mặt / Absent";
            case "ONLINE" -> "Trực tuyến / Online";
            case "READ_CONFIRMED" -> "Đã đọc, ký điện tử / Read, signed electronically";
            case "ATTENDED" -> "SELF".equals(mode) ? (p.get("attend_signature_id") != null ? "Ký điện tử khi điểm danh / Signed at check-in" : "Điểm danh điện tử / Checked in") : "ESIGN".equals(mode) ? "Ký điện tử / Signed electronically" : "Có mặt / Present";
            default -> p.get("planned_absence") != null ? "Vắng mặt (đã báo) / Absent (planned)" : "";
        };
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the form

    private static String cellsText(XWPFTable table) {
        StringBuilder all = new StringBuilder();
        for (XWPFTableRow row : table.getRows()) for (XWPFTableCell cell : row.getTableCells()) all.append(cell.getText()).append('\n');
        return all.toString();
    }

    private static XWPFTable find(XWPFDocument doc, String token) {
        for (XWPFTable table : doc.getTables()) if (cellsText(table).contains(token)) return table;
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
    }

    private static int indexOf(XWPFDocument doc, XWPFTable table) {
        List<IBodyElement> elements = doc.getBodyElements();
        for (int i = 0; i < elements.size(); i++) if (elements.get(i) instanceof XWPFTable t && t.getCTTbl() == table.getCTTbl()) return i;
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
    }

    private static void setText(XWPFTableCell cell, String value) {
        for (int i = cell.getParagraphs().size() - 1; i > 0; i--) cell.removeParagraph(i);
        XWPFParagraph paragraph = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().get(0);
        List<XWPFRun> runs = paragraph.getRuns();
        if (runs.isEmpty()) {
            paragraph.createRun().setText(value);
            return;
        }
        runs.get(0).setText(value, 0);
        for (int i = runs.size() - 1; i >= 1; i--) paragraph.removeRun(i);
    }

    /** Rows of a table filled from the second row, which is the model of a line; the empty model lines are removed. The rows are written in the XML of the table itself. */
    private static void fillRows(XWPFTable table, List<List<String>> lines) {
        org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl ct = table.getCTTbl();
        if (ct.sizeOfTrArray() < 2) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
        CTRow model = (CTRow) ct.getTrArray(1).copy();
        int original = ct.sizeOfTrArray();
        for (List<String> line : lines) {
            ct.addNewTr().set(model.copy());
            XWPFTableRow row = new XWPFTableRow(ct.getTrArray(ct.sizeOfTrArray() - 1), table);
            for (int c = 0; c < line.size() && c < row.getTableCells().size(); c++) setText(row.getCell(c), line.get(c));
        }
        for (int i = original - 1; i >= 1; i--) ct.removeTr(i);
    }

    private byte[] fill(byte[] template, Data d) throws IOException {
        byte[] shaped = shape(template, d.sessions().size());
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(shaped)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Map<String, Object> a = d.activity();
            String number = text(a.get("training_number"));
            XWPFTable header = find(doc, "TRAINING ATTEN");
            if (header.getRows().size() < 2 || header.getRow(1).getTableCells().size() < 3) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
            setText(header.getRow(1).getCell(2), "Code: " + number);

            XWPFTable info = find(doc, "Training Type");
            if (info.getRows().size() < 3) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
            String content = text(a.get("training_title")) + (text(a.get("document_number")).isEmpty() ? "" : " (" + a.get("document_number") + (text(a.get("revision_number")).isEmpty() ? "" : " rev. " + a.get("revision_number")) + ")");
            setText(info.getRow(0).getCell(1), content);
            setText(info.getRow(1).getCell(1), d.department());
            setText(info.getRow(2).getCell(1), kind(a));

            List<List<String>> topicLines = new ArrayList<>();
            for (Map<String, Object> s : d.sessions()) {
                boolean first = true;
                Object day = s.get("held_on") != null ? s.get("held_on") : s.get("scheduled_on");
                for (Map<String, Object> t : d.topics().get(s.get("id"))) {
                    String name = text(t.get("document_name")).isEmpty() ? text(t.get("topic_text")) : text(t.get("document_name")) + (text(t.get("local_title")).isEmpty() ? "" : " / " + t.get("local_title"));
                    topicLines.add(List.of(first ? sessionLabel(s) : "", text(t.get("document_number")), name,
                            first ? mode(s.get("method")) : "", first ? text(s.get("trainer")) : "", first && day != null ? DateTimeFormatUtils.display(day) : ""));
                    first = false;
                }
            }
            fillRows(find(doc, "Execution date"), topicLines);

            List<XWPFTable> lists = new ArrayList<>();
            for (XWPFTable t : doc.getTables()) if (cellsText(t).contains("Name of participant")) lists.add(t);
            if (lists.size() != d.sessions().size()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
            // The column "Training result" is written when the trainer has finished the training (signed); before that the results stay in the system only.
            boolean finished = a.get("results_finished_at") != null;
            for (int i = 0; i < lists.size(); i++) {
                Map<String, Object> s = d.sessions().get(i);
                int before = indexOf(doc, lists.get(i)) - 1;
                if (before >= 0 && doc.getBodyElements().get(before) instanceof XWPFParagraph p) setParagraph(p, sessionLabel(s) + ": ");
                List<List<String>> lines = new ArrayList<>();
                int no = 1;
                for (Map<String, Object> p : d.people().get(s.get("id"))) {
                    UUID person = (UUID) p.get("person_user_id");
                    lines.add(List.of(String.valueOf(no++), text(p.get("employee_code")), text(p.get("full_name")), text(p.get("department")), signature(p),
                            finished ? result(text(p.get("result")), text(p.get("state"))) : "", finished && person != null ? d.retraining().getOrDefault(person, "") : ""));
                }
                fillRows(lists.get(i), lines);
            }

            XWPFTable preparer = find(doc, "Name of preparer");
            setText(preparer.getRow(1).getCell(0), d.preparedBy());
            setText(preparer.getRow(1).getCell(1), d.preparedAt());
            List<List<String>> trainerLines = new ArrayList<>();
            for (Map<String, Object> s : d.sessions()) trainerLines.add(List.of(sessionLabel(s), text(s.get("trainer")), signedAt(s.get("attendance_confirmed_at"))));
            fillRows(find(doc, "Trainier Name"), trainerLines);
            XWPFTable completion = find(doc, "Confirmed by");
            if (completion.getRows().size() >= 2 && completion.getRow(1).getTableCells().size() >= 2) {
                setText(completion.getRow(1).getCell(1), d.completedBy().isEmpty() ? "" : d.completedBy() + (d.completedAt().isEmpty() ? "" : " - " + d.completedAt()));
            }
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static String sessionLabel(Map<String, Object> s) {
        return String.format("%02d", ((Number) s.get("session_no")).intValue());
    }

    private static void setParagraph(XWPFParagraph paragraph, String value) {
        List<XWPFRun> runs = paragraph.getRuns();
        if (runs.isEmpty()) {
            paragraph.createRun().setText(value);
            return;
        }
        runs.get(0).setText(value, 0);
        for (int i = runs.size() - 1; i >= 1; i--) paragraph.removeRun(i);
    }

    /**
     * The first pass: the instructions that describe the form (the header, the footer, the notes and the history of revisions) are taken out, and the heading and the table of the list of
     * attendance are repeated for each session of the activity. The file is written and read again, so that the second pass sees the real elements.
     */
    private byte[] shape(byte[] template, int sessions) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(template)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            List<IBodyElement> elements = doc.getBodyElements();
            int headerTable = indexOf(doc, find(doc, "TRAINING ATTEN"));
            int first = -1;
            int last = -1;
            for (int i = 0; i < elements.size(); i++) {
                if (elements.get(i) instanceof XWPFParagraph p && first < 0 && p.getText().trim().startsWith("1.") && p.getText().contains("General information")) first = i;
                if (elements.get(i) instanceof XWPFTable t && cellsText(t).contains("Confirmed by") && cellsText(t).contains("Sign & date")) last = i;
            }
            if (first < 0 || last < first || headerTable > first) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
            for (int i = elements.size() - 1; i > last; i--) doc.removeBodyElement(i);
            for (int i = first - 1; i >= 0; i--) if (i != headerTable) doc.removeBodyElement(i);
            // the list of the first session is repeated for each of the others
            XWPFTable list = find(doc, "Name of participant");
            int at = indexOf(doc, list);
            if (at < 1 || !(doc.getBodyElements().get(at - 1) instanceof XWPFParagraph heading)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
            XmlObject lastElement = list.getCTTbl();
            for (int k = 1; k < sessions; k++) {
                lastElement = copyAfter(heading.getCTP(), lastElement);
                lastElement = copyAfter(list.getCTTbl(), lastElement);
            }
            doc.write(out);
            return out.toByteArray();
        }
    }

    /** Copies the element after another element of the same body and returns the copy. */
    private static XmlObject copyAfter(XmlObject element, XmlObject after) {
        try (XmlCursor target = after.newCursor(); XmlCursor source = element.newCursor()) {
            target.toEndToken();
            target.toNextToken();
            source.copyXml(target);
        }
        // the copy is now the element that follows
        try (XmlCursor next = after.newCursor()) {
            next.toEndToken();
            next.toNextToken();
            return next.getObject();
        }
    }
}

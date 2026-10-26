package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
import com.eqms.service.FileStorageService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The paper test of a session (SOP.0003 5.3.7, APD.0009, TR-52): one file for each trainee, made from the exam file of the activity, which is the form APD.0009 with the content of the test.
 * For each trainee the form gets the fields that belong to that person: the name, the ID code, the department and the date (and the trainee in the footer, with the Training Number and the
 * place for the signature that the form has on every page). The exam file of the activity is never changed. The files come in one ZIP, as PDF (made by the document server, ready to print)
 * or as Word (to change before printing). An exam that is a PDF is stamped with the Training Number, the trainee and a signature line on every page. Every print is numbered and recorded;
 * a print after the first needs a reason. The trainer prints the copies before the training starts (from Notified).
 */
@Service
public class TrainingExamPackService {
    private static final float MARGIN = 36;
    private static final int MAX_TRAINEES = 100;
    private static final int MAX_PAGES = 3000;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final FileStorageService files;
    private final com.eqms.service.OnlyOfficeDocumentEditService onlyOffice;

    public TrainingExamPackService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, FileStorageService files, com.eqms.service.OnlyOfficeDocumentEditService onlyOffice) {
        this.onlyOffice = onlyOffice;
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.files = files;
    }

    @Transactional
    public Map<String, Object> print(UserAccount actor, UUID sessionId, String reason, String format) {
        access.require(actor, "training.paper.print");
        boolean wordOut = "docx".equalsIgnoreCase(format);
        if (format != null && !format.isBlank() && !wordOut && !"pdf".equalsIgnoreCase(format)) throw new IllegalArgumentException("TRAINING_FORMAT_INVALID");
        Map<String, Object> session = jdbc.queryForList("""
            select s.*, a.training_number, a.training_title, a.organizer_department_id, a.kind, a.kind_reason from training_sessions s join training_activities a on a.id = s.activity_id where s.id = ?
            """, sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) session.get("activity_id");
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!Set.of("NOTIFIED", "IN_PROGRESS").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_STATUS");
        if (!"PLANNED".equals(String.valueOf(session.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_SESSION_STATUS");
        if ("ELECTRONIC".equals(session.get("delivery_mode"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_NOT_PAPER");
        if (!Set.of("TEST", "CHECKLIST").contains(String.valueOf(session.get("assessment_method")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_A_TEST");

        // The exam is the file of the activity: written in the editor, uploaded, or made from an assessment of the library (a Word file like the others).
        Map<String, Object> exam = jdbc.queryForList("select * from training_materials where activity_id = ? and purpose = 'EXAM' and removed_at is null and link_url is null order by created_at desc limit 1", activityId)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_MISSING"));
        boolean word = String.valueOf(exam.get("original_name")).toLowerCase(java.util.Locale.ROOT).endsWith(".docx");
        if (!word && !"application/pdf".equalsIgnoreCase(String.valueOf(exam.get("content_type")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_PDF");
        if (wordOut && !word) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_WORD");
        byte[] examBytes;
        try {
            examBytes = files.readReportArtifact(String.valueOf(exam.get("provider")), String.valueOf(exam.get("stored_path")));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
        if (!sha256(examBytes).equals(exam.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FILE_INTEGRITY_FAILED");

        Integer printed = jdbc.queryForObject("select count(*) from training_paper_packs where session_id = ? and pack_kind = 'EXAM'", Integer.class, sessionId);
        int copy = (printed == null ? 0 : printed) + 1;
        String why = reason == null ? null : reason.trim();
        if (copy > 1 && (why == null || why.isEmpty())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (why != null && why.length() > 1000) throw new IllegalArgumentException("TRAINING_REASON_TOO_LONG");

        List<Map<String, Object>> trainees = jdbc.queryForList("""
            select p.full_name, p.employee_code, p.department from training_participants p where p.session_id = ? and p.state <> 'ABSENT' and p.planned_absence is null order by p.full_name
            """, sessionId);
        if (trainees.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PARTICIPANT_REQUIRED");
        if (trainees.size() > MAX_TRAINEES) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_PAPER_TOO_LARGE");

        String code = session.get("training_number") + "/S" + session.get("session_no") + "/E" + copy;
        Object day = session.get("held_on") != null ? session.get("held_on") : session.get("scheduled_on");
        String date = day == null ? null : DateTimeFormatUtils.display(day);
        String prefix = String.valueOf(session.get("training_number")).replace('/', '-') + "-S" + session.get("session_no");
        byte[] bytes;
        int pages = 0;
        List<String> names = new ArrayList<>();
        try (ByteArrayOutputStream buffer = new ByteArrayOutputStream(); java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(buffer)) {
            int index = 0;
            int total = 0;
            for (Map<String, Object> t : trainees) {
                index++;
                String who = t.get("employee_code") == null || String.valueOf(t.get("employee_code")).isBlank() ? String.valueOf(index) : String.valueOf(t.get("employee_code"));
                byte[] file;
                String extension;
                if (word) {
                    byte[] copyDocx = TrainingAssessmentForm.personalize(examBytes, new TrainingAssessmentForm.Trainee(String.valueOf(t.get("full_name")),
                            t.get("employee_code") == null ? null : String.valueOf(t.get("employee_code")), t.get("department") == null ? null : String.valueOf(t.get("department")), date), !wordOut);
                    file = wordOut ? copyDocx : toPdf(copyDocx, prefix + "-" + who + ".docx");
                    extension = wordOut ? ".docx" : ".pdf";
                } else {
                    file = stamp(examBytes, session, t);
                    extension = ".pdf";
                }
                if (".pdf".equals(extension)) {
                    try (PDDocument d = Loader.loadPDF(file)) {
                        pages += d.getNumberOfPages();
                        total += d.getNumberOfPages();
                    }
                    if (total > MAX_PAGES) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_PAPER_TOO_LARGE");
                }
                String name = prefix + "-" + safe(who) + "-" + safe(String.valueOf(t.get("full_name"))) + extension;
                names.add(name);
                zip.putNextEntry(new java.util.zip.ZipEntry(name));
                zip.write(file);
                zip.closeEntry();
            }
            zip.finish();
            bytes = buffer.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
        if (pages < 1) pages = trainees.size();
        String sha = sha256(bytes);
        jdbc.update("insert into training_paper_packs(id, activity_id, session_id, pack_code, copy_no, page_count, people_count, sha256, reason, printed_by, pack_kind) values (?,?,?,?,?,?,?,?,?,?,'EXAM')",
                UUID.randomUUID(), activityId, sessionId, code, copy, pages, trainees.size(), sha, copy > 1 ? why : null, actor.getId());
        store.auditActivity(actor, activity, "TRAINING_EXAM_PACK_PRINTED", null, code, "Copy " + copy + ", " + trainees.size() + " file(s) as " + (wordOut ? "Word" : "PDF") + ": " + String.join(", ", names) + ". Exam file SHA-256 " + exam.get("sha256")
                + ", ZIP SHA-256 " + sha + (copy > 1 ? ". Reason: " + why : ""));
        return Map.of("bytes", bytes, "name", code.replace('/', '-') + ".zip", "contentType", "application/zip");
    }

    private static String safe(String value) {
        String cleaned = value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
        return cleaned.isEmpty() ? "-" : cleaned;
    }

    /** An exam that is a PDF has no fields to fill: each page gets the Training Number, the trainee and a signature line. */
    private byte[] stamp(byte[] pdf, Map<String, Object> session, Map<String, Object> t) {
        try (PDDocument src = Loader.loadPDF(pdf); var font = getClass().getResourceAsStream("/fonts/Tinos-Regular.ttf"); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (font == null) throw new IllegalStateException("FONT_UNAVAILABLE");
            PDType0Font stamp = PDType0Font.load(src, font);
            int n = src.getNumberOfPages();
            for (int i = 0; i < n; i++) {
                PDPage page = src.getPage(i);
                PDRectangle box = page.getCropBox();
                try (PDPageContentStream s = new PDPageContentStream(src, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    s.setNonStrokingColor(0f, 0f, 0f);
                    s.beginText();
                    s.setFont(stamp, 8);
                    s.newLineAtOffset(box.getLowerLeftX() + MARGIN, box.getLowerLeftY() + 14);
                    s.showText(clean("Training No. " + session.get("training_number") + "  S" + session.get("session_no") + "   Trainee: " + t.get("full_name") + (t.get("employee_code") == null ? "" : " (" + t.get("employee_code") + ")")
                            + "   Signature: ________________   Page " + (i + 1) + " / " + n));
                    s.endText();
                }
            }
            src.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    private static String clean(String value) {
        StringBuilder sb = new StringBuilder();
        for (int cp : (value == null ? "" : value).codePoints().toArray()) if (!Character.isISOControl(cp)) sb.appendCodePoint(cp);
        return sb.toString();
    }

    /** A Word exam turned into a PDF by the document server; the temporary file is deleted at once. */
    private byte[] toPdf(byte[] docx, String name) {
        java.nio.file.Path temp = null;
        try {
            temp = java.nio.file.Files.createTempFile("training-exam-", ".docx");
            java.nio.file.Files.write(temp, docx);
            return onlyOffice.convertLocalFileToPdf(temp, name);
        } catch (IOException | IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_EXAM_CONVERT_FAILED");
        } finally {
            if (temp != null) { try { java.nio.file.Files.deleteIfExists(temp); } catch (IOException ignored) { /* a temporary file */ } }
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}

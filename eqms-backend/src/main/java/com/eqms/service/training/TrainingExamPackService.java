package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
import com.eqms.service.FileStorageService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
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
 * The paper test of a session (SOP.0003 5.3.7, APD.0009, TR-52): one copy for each trainee, made from the approved exam, with the Training Number and a place for the trainee's
 * signature in the footer of every page, and a cover page with the trainee's details. The approved file is never changed: the footer is added to a copy made at print time. A PDF exam
 * is stamped as it is; a Word exam is first turned into a PDF by the document server at print time (the Word file stays the approved one, and the Audit Trail records both fingerprints).
 * Every print is numbered and recorded; a print after the first needs a reason.
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
    public Map<String, Object> print(UserAccount actor, UUID sessionId, String reason) {
        access.require(actor, "training.paper.print");
        Map<String, Object> session = jdbc.queryForList("""
            select s.*, a.training_number, a.training_title, a.organizer_department_id, a.kind, a.kind_reason from training_sessions s join training_activities a on a.id = s.activity_id where s.id = ?
            """, sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) session.get("activity_id");
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!Set.of("NOTIFIED", "IN_PROGRESS").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_STATUS");
        if (!"PLANNED".equals(String.valueOf(session.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_SESSION_STATUS");
        if ("ELECTRONIC".equals(session.get("delivery_mode"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_NOT_PAPER");
        if (!"TEST".equals(session.get("assessment_method"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_A_TEST");

        Map<String, Object> exam = jdbc.queryForList("select * from training_materials where activity_id = ? and purpose = 'EXAM' and removed_at is null and link_url is null order by created_at desc limit 1", activityId)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_MISSING"));
        boolean word = String.valueOf(exam.get("original_name")).toLowerCase(java.util.Locale.ROOT).endsWith(".docx");
        if (!word && !"application/pdf".equalsIgnoreCase(String.valueOf(exam.get("content_type")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_PDF");
        byte[] examBytes;
        try {
            examBytes = files.readReportArtifact(String.valueOf(exam.get("provider")), String.valueOf(exam.get("stored_path")));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
        if (!sha256(examBytes).equals(exam.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FILE_INTEGRITY_FAILED");
        String convertedSha = null;
        if (word) {
            examBytes = toPdf(examBytes, String.valueOf(exam.get("original_name")));
            convertedSha = sha256(examBytes);
        }

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
        List<String> topics = jdbc.queryForList("select topic_text from training_session_topics where session_id = ? order by topic_text", String.class, sessionId);

        String code = session.get("training_number") + "/S" + session.get("session_no") + "/E" + copy;
        byte[] bytes;
        int pages;
        List<PDDocument> sources = new ArrayList<>();
        try (PDDocument out = new PDDocument(); var regular = getClass().getResourceAsStream("/fonts/Tinos-Regular.ttf"); var bold = getClass().getResourceAsStream("/fonts/Tinos-Bold.ttf");
             var regular2 = getClass().getResourceAsStream("/fonts/Tinos-Regular.ttf"); var buffer = new ByteArrayOutputStream()) {
            if (regular == null || bold == null || regular2 == null) throw new IllegalStateException("FONT_UNAVAILABLE");
            PDType0Font font = PDType0Font.load(out, regular), strong = PDType0Font.load(out, bold);
            byte[] fontBytes = regular2.readAllBytes();
            PDFMergerUtility merger = new PDFMergerUtility();
            int total = 0;
            for (Map<String, Object> t : trainees) {
                cover(out, font, strong, session, topics, t, code, copy);
                PDDocument src = Loader.loadPDF(examBytes);
                sources.add(src);
                int n = src.getNumberOfPages();
                total += n + 1;
                if (total > MAX_PAGES) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_PAPER_TOO_LARGE");
                PDType0Font stamp = PDType0Font.load(src, new java.io.ByteArrayInputStream(fontBytes));
                for (int i = 0; i < n; i++) {
                    PDPage page = src.getPage(i);
                    PDRectangle box = page.getCropBox();
                    try (PDPageContentStream s = new PDPageContentStream(src, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                        float y = box.getLowerLeftY() + 14;
                        float x = box.getLowerLeftX() + MARGIN;
                        s.setNonStrokingColor(0f, 0f, 0f);
                        s.beginText(); s.setFont(stamp, 8); s.newLineAtOffset(x, y);
                        s.showText(clean("Training No. " + session.get("training_number") + "  S" + session.get("session_no") + "   Trainee: " + t.get("full_name") + (t.get("employee_code") == null ? "" : " (" + t.get("employee_code") + ")")
                                + "   Signature: ________________   Page " + (i + 1) + " / " + n));
                        s.endText();
                    }
                }
                merger.appendDocument(out, src);
            }
            out.save(buffer);
            bytes = buffer.toByteArray();
            pages = out.getNumberOfPages();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        } finally {
            for (PDDocument d : sources) { try { d.close(); } catch (IOException ignored) { /* the print is already made or failed */ } }
        }
        String sha = sha256(bytes);
        jdbc.update("insert into training_paper_packs(id, activity_id, session_id, pack_code, copy_no, page_count, people_count, sha256, reason, printed_by, pack_kind) values (?,?,?,?,?,?,?,?,?,?,'EXAM')",
                UUID.randomUUID(), activityId, sessionId, code, copy, pages, trainees.size(), sha, copy > 1 ? why : null, actor.getId());
        store.auditActivity(actor, activity, "TRAINING_EXAM_PACK_PRINTED", null, code, "Copy " + copy + ", " + pages + " page(s), " + trainees.size() + " trainee(s), exam file SHA-256 " + exam.get("sha256") + (convertedSha == null ? "" : ", converted to PDF SHA-256 " + convertedSha) + ", printed SHA-256 " + sha
                + (copy > 1 ? ". Reason: " + why : ""));
        return Map.of("bytes", bytes, "name", code.replace('/', '-') + ".pdf");
    }

    /** The cover page of one trainee (APD.0009): who, what, when, with the boxes the trainer fills in by hand. */
    private void cover(PDDocument out, PDType0Font font, PDType0Font strong, Map<String, Object> session, List<String> topics, Map<String, Object> t, String code, int copy) throws IOException {
        PDPage page = new PDPage(PDRectangle.A4);
        out.addPage(page);
        float height = page.getMediaBox().getHeight();
        try (PDPageContentStream s = new PDPageContentStream(out, page)) {
            float y = height - MARGIN - 6;
            text(s, strong, 14, MARGIN, y, "TRAINING ASSESSMENT / Đánh giá đào tạo"); y -= 26;
            y = line(s, font, strong, y, "Training Number / Mã đào tạo", String.valueOf(session.get("training_number")));
            y = line(s, font, strong, y, "Training Title / Nội dung", String.valueOf(session.get("training_title")));
            for (String topic : topics) y = line(s, font, strong, y, "Topic / Chuyên đề", topic);
            y = line(s, font, strong, y, "Session / Buổi", "S" + session.get("session_no") + "  " + (session.get("held_on") != null ? session.get("held_on") : session.get("scheduled_on") == null ? "" : session.get("scheduled_on")));
            y -= 8;
            y = line(s, font, strong, y, "Full name / Họ và tên", String.valueOf(t.get("full_name")));
            y = line(s, font, strong, y, "Employee code / Mã NV", t.get("employee_code") == null ? "" : String.valueOf(t.get("employee_code")));
            y = line(s, font, strong, y, "Department / Đơn vị", t.get("department") == null ? "" : String.valueOf(t.get("department")));
            y = line(s, font, strong, y, "Type of training / Loại đào tạo", "[ ] Initial   [ ] Retraining   [ ] Update   [ ] Other");
            y = line(s, font, strong, y, "Date / Ngày", "____ / ____ / ________");
            y = line(s, font, strong, y, "Time taken / Thời gian làm bài", "________ minutes");
            y -= 14;
            text(s, strong, 10, MARGIN, y, "Result / Kết quả"); y -= 16;
            y = line(s, font, strong, y, "Score / Điểm", "________ / ________");
            y = line(s, font, strong, y, "Result / Kết quả", "[ ] Passed / Đạt     [ ] Failed / Không đạt");
            y = line(s, font, strong, y, "Marked by / Người chấm", "____________________   Date: ____________");
            text(s, font, 7, MARGIN, MARGIN + 6, "Training No. " + session.get("training_number") + "   Exam pack " + code + "   Copy " + copy + "   Printed " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()));
            text(s, font, 7, MARGIN, MARGIN - 4, "Controlled print: the test pages follow, each with the Training Number and a signature line.");
        }
    }

    private static float line(PDPageContentStream s, PDType0Font font, PDType0Font strong, float y, String label, String value) throws IOException {
        text(s, strong, 10, MARGIN, y, label + ":");
        text(s, font, 10, MARGIN + 190, y, value);
        return y - 17;
    }

    private static void text(PDPageContentStream s, PDType0Font font, float size, float x, float y, String value) throws IOException {
        s.beginText(); s.setFont(font, size); s.newLineAtOffset(x, y); s.showText(clean(value)); s.endText();
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

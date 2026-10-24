package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
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
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The paper pack of a session (PLAN-TR-001 17.7, proposals D-39 and D-40): the attendance and assessment sheet the trainer takes to the room when the
 * training is held on paper. It follows the content of APD.0117 (training, session, topics, trainer, trainees with a signature box) and adds the score and the
 * result columns of the assessment. Every page carries the Training Number, the pack code, the copy number and "Page x / y". The print is recorded and
 * cannot be changed; a print after the first needs a reason. The file is not kept: what is kept is the fact, the copy number and the SHA-256 of the file.
 */
@Service
public class TrainingPaperService {
    private static final float MARGIN = 36, LINE = 22;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;

    public TrainingPaperService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
    }

    private Map<String, Object> sessionOf(UUID sessionId) {
        return jdbc.queryForList("""
            select s.*, a.training_number, a.training_title as activity_title, a.organizer_department_id, a.status as activity_status,
                   coalesce(tu.full_name, s.external_trainer_name) as trainer_name
              from training_sessions s join training_activities a on a.id = s.activity_id left join app_users tu on tu.id = s.trainer_user_id where s.id = ?
            """, sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    /** What the screen shows next to the session: whether a pack may be printed, and the packs printed so far. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> packs(UserAccount actor, UUID activityId) {
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct");
        UUID department = jdbc.queryForObject("select organizer_department_id from training_activities where id = ?", UUID.class, activityId);
        access.requireScope(actor, department);
        return TrainingRows.camel(jdbc.queryForList("""
            select p.id, p.session_id, s.session_no, p.pack_kind, p.pack_code, p.copy_no, p.page_count, p.people_count, p.sha256, p.reason, p.printed_at, u.full_name as printed_by_name
              from training_paper_packs p join training_sessions s on s.id = p.session_id join app_users u on u.id = p.printed_by
             where p.activity_id = ? order by s.session_no, p.copy_no
            """, activityId));
    }

    @Transactional
    public Map<String, Object> print(UserAccount actor, UUID sessionId, String reason) {
        access.require(actor, "training.paper.print");
        Map<String, Object> session = sessionOf(sessionId);
        UUID activityId = (UUID) session.get("activity_id");
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        // Serialise the prints of one activity, so two people never take the same copy number.
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!Set.of("NOTIFIED", "IN_PROGRESS").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_STATUS");
        if (!"PLANNED".equals(String.valueOf(session.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_SESSION_STATUS");
        if ("ELECTRONIC".equals(session.get("delivery_mode"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_NOT_PAPER");

        Integer printed = jdbc.queryForObject("select count(*) from training_paper_packs where session_id = ? and pack_kind = 'ATTENDANCE'", Integer.class, sessionId);
        int copy = (printed == null ? 0 : printed) + 1;
        String why = reason == null ? null : reason.trim();
        if (copy > 1 && (why == null || why.isEmpty())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (why != null && why.length() > 1000) throw new IllegalArgumentException("TRAINING_REASON_TOO_LONG");

        List<Map<String, Object>> people = jdbc.queryForList("""
            select p.full_name, p.employee_code, p.department, p.external_org, p.planned_absence
              from training_participants p where p.session_id = ? order by p.external_name is not null, p.full_name
            """, sessionId);
        String preparedBy = jdbc.queryForList("select u.full_name from training_activities a join app_users u on u.id = a.list_prepared_by where a.id = ?", String.class, activityId).stream().findFirst().orElse("");
        if (people.size() > 500) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_PAPER_TOO_LARGE");
        List<String> topics = jdbc.queryForList("select topic_text || coalesce(' (' || document_number || coalesce(' rev. ' || revision_number, '') || ')', '') from training_session_topics where session_id = ? order by topic_text", String.class, sessionId);

        String code = session.get("training_number") + "/S" + session.get("session_no") + "/P" + copy;
        byte[] bytes;
        int pages;
        try {
            Rendered r = render(session, topics, people, code, copy, preparedBy);
            bytes = r.bytes();
            pages = r.pages();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
        String sha = sha256(bytes);
        jdbc.update("insert into training_paper_packs(id, activity_id, session_id, pack_code, copy_no, page_count, people_count, sha256, reason, printed_by) values (?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), activityId, sessionId, code, copy, pages, people.size(), sha, copy > 1 ? why : null, actor.getId());
        store.auditActivity(actor, activity, "TRAINING_PAPER_PACK_PRINTED", null, code, "Copy " + copy + ", " + pages + " page(s), " + people.size() + " trainee(s), SHA-256 " + sha + (copy > 1 ? ". Reason: " + why : ""));
        return Map.of("bytes", bytes, "name", code.replace('/', '-') + ".pdf");
    }

    /** How the session is run (D-39). Changing it after a pack was printed needs a reason; it is always in the Audit Trail. */
    @Transactional
    public Map<String, Object> setDeliveryMode(UserAccount actor, UUID sessionId, String mode, String reason) {
        access.require(actor, "training.activity.organize", "training.activity.conduct");
        if (mode == null || !Set.of("ELECTRONIC", "PAPER", "MIXED").contains(mode)) throw new IllegalArgumentException("TRAINING_DELIVERY_MODE_INVALID");
        Map<String, Object> session = sessionOf(sessionId);
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        Map<String, Object> activity = store.activityForUpdate((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (Set.of("COMPLETED", "CANCELLED", "RESERVED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_CLOSED");
        String from = String.valueOf(session.get("delivery_mode"));
        if (from.equals(mode)) return Map.of("deliveryMode", mode);
        Integer printed = jdbc.queryForObject("select count(*) from training_paper_packs where session_id = ?", Integer.class, sessionId);
        String why = reason == null ? "" : reason.trim();
        if (printed != null && printed > 0 && why.isEmpty()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_sessions set delivery_mode = ?, version = version + 1 where id = ?", mode, sessionId);
        store.auditActivity(actor, activity, "TRAINING_DELIVERY_MODE_CHANGED", from, mode, "Session S" + session.get("session_no") + (why.isEmpty() ? "" : ". " + why));
        return Map.of("deliveryMode", mode);
    }

    private record Rendered(byte[] bytes, int pages) {}

    private Rendered render(Map<String, Object> session, List<String> topics, List<Map<String, Object>> people, String code, int copy, String preparedBy) throws IOException {
        PDRectangle size = PDRectangle.A4;
        float width = size.getWidth(), height = size.getHeight();
        try (PDDocument pdf = new PDDocument(); var regular = getClass().getResourceAsStream("/fonts/Tinos-Regular.ttf"); var bold = getClass().getResourceAsStream("/fonts/Tinos-Bold.ttf"); var out = new ByteArrayOutputStream()) {
            if (regular == null || bold == null) throw new IllegalStateException("FONT_UNAVAILABLE");
            PDType0Font font = PDType0Font.load(pdf, regular), strong = PDType0Font.load(pdf, bold);
            // No. | Full name | Employee code | Department | Signature | Score | Result
            float[] w = {26, 130, 62, 90, 120, 42, 53};
            float[] x = new float[w.length + 1];
            x[0] = MARGIN;
            for (int c = 0; c < w.length; c++) x[c + 1] = x[c] + w[c];
            String[] heads = {"No.", "Full name / Họ và tên", "Code", "Department", "Signature / Chữ ký", "Score", "Result"};
            int index = 0, pages = 0;
            boolean lastNeedsPage = false;
            do {
                PDPage page = new PDPage(size);
                pdf.addPage(page);
                pages++;
                try (PDPageContentStream s = new PDPageContentStream(pdf, page)) {
                    float y = height - MARGIN;
                    if (pages == 1) {
                        text(s, strong, 13, MARGIN, y, "TRAINING ATTENDANCE AND ASSESSMENT RECORD"); y -= 15;
                        text(s, font, 10, MARGIN, y, "Danh sách tham dự và kết quả đánh giá đào tạo"); y -= 18;
                        text(s, strong, 9, MARGIN, y, "1. General information / Thông tin chung"); y -= 13;
                        y = line(s, font, strong, y, "Training Number / Mã đào tạo", String.valueOf(session.get("training_number")), width);
                        y = line(s, font, strong, y, "Training Title / Nội dung", String.valueOf(session.get("activity_title")), width);
                        for (String t : topics) y = line(s, font, strong, y, "Topic / Chuyên đề", t, width);
                        y -= 3;
                        text(s, strong, 9, MARGIN, y, "2. Session details / Chi tiết buổi đào tạo"); y -= 13;
                        y = line(s, font, strong, y, "Session / Buổi", "S" + session.get("session_no") + "  " + dateOf(session.get("held_on") != null ? session.get("held_on") : session.get("scheduled_on")), width);
                        y = line(s, font, strong, y, "Venue / Địa điểm", "ONLINE".equals(session.get("location_type")) ? "Online" : valueOf(session.get("venue")), width);
                        y = line(s, font, strong, y, "Trainer / Người đào tạo", valueOf(session.get("trainer_name")), width);
                        y = line(s, font, strong, y, "Method / Assessment", valueOf(session.get("method")) + " / " + valueOf(session.get("assessment_method")), width);
                        y -= 3;
                        text(s, strong, 9, MARGIN, y, "3. Trainees and results / Danh sách học viên và kết quả"); y -= 16;
                    }
                    float top = y + 10;
                    for (int c = 0; c < heads.length; c++) text(s, strong, 8, x[c] + 2, y, clip(strong, heads[c], 8, w[c] - 4));
                    s.moveTo(MARGIN, y - 5); s.lineTo(x[w.length], y - 5); s.stroke();
                    y -= LINE;
                    while (index < people.size() && y > MARGIN + 30) {
                        Map<String, Object> p = people.get(index);
                        String name = String.valueOf(p.get("full_name")) + (p.get("external_org") == null ? "" : " (" + p.get("external_org") + ")");
                        String[] cells = {String.valueOf(index + 1), name, valueOf(p.get("employee_code")), valueOf(p.get("department")), p.get("planned_absence") != null ? "(planned absence)" : "", "", ""};
                        for (int c = 0; c < cells.length; c++) text(s, font, 8, x[c] + 2, y + 6, clip(font, cells[c], 8, w[c] - 4));
                        s.moveTo(MARGIN, y - 4); s.lineTo(x[w.length], y - 4); s.stroke();
                        y -= LINE;
                        index++;
                    }
                    for (float vx : x) { s.moveTo(vx, y + LINE - 6); s.lineTo(vx, top); }
                    s.stroke();
                    if (index >= people.size()) {
                        float by = y - 6;
                        if (by < MARGIN + 150) lastNeedsPage = true;
                        else sections(s, font, strong, by, session, preparedBy);
                    }
                }
            } while (index < people.size());
            if (lastNeedsPage) {
                PDPage page = new PDPage(size);
                pdf.addPage(page);
                pages++;
                try (PDPageContentStream s = new PDPageContentStream(pdf, page)) { sections(s, font, strong, height - MARGIN, session, preparedBy); }
            }
            // The page count is known only now, so the footer is added to every page afterwards.
            for (int i = 0; i < pages; i++) {
                try (PDPageContentStream s = new PDPageContentStream(pdf, pdf.getPage(i), PDPageContentStream.AppendMode.APPEND, true, true)) {
                    text(s, font, 7, MARGIN, MARGIN - 14, "Training No. " + session.get("training_number") + "   Pack " + code + "   Copy " + copy + "   Printed " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()) + "   Page " + (i + 1) + " / " + pages);
                    text(s, font, 7, MARGIN, MARGIN - 24, "Controlled print. Keep the signed sheets with the training record; results are transcribed into the system and checked by a second person.");
                }
            }
            pdf.save(out);
            return new Rendered(out.toByteArray(), pages);
        }
    }

    /** Sections 4 to 6 of APD.0117: the person who prepared the list, the trainer of the session, and the document control officer of QA. Blank boxes for the wet signature. */
    private static void sections(PDPageContentStream s, PDType0Font font, PDType0Font strong, float y, Map<String, Object> session, String preparedBy) throws IOException {
        text(s, strong, 9, MARGIN, y, "4. Confirmation of the person who prepared the list and topics / Người chuẩn bị xác nhận"); y -= 13;
        text(s, font, 9, MARGIN, y, "Name: " + preparedBy + "     Signature / Date: ______________________"); y -= 22;
        text(s, strong, 9, MARGIN, y, "5. Confirmation of the trainer for this session / Người đào tạo xác nhận"); y -= 13;
        text(s, font, 9, MARGIN, y, "Name: " + valueOf(session.get("trainer_name")) + "     Signature / Date: ______________________"); y -= 22;
        text(s, strong, 9, MARGIN, y, "6. Confirmation of completion by DCO-QA / DCO-QA xác nhận hoàn thành"); y -= 13;
        text(s, font, 9, MARGIN, y, "Name: ______________________     Signature / Date: ______________________");
    }

    private static float line(PDPageContentStream s, PDType0Font font, PDType0Font strong, float y, String label, String value, float width) throws IOException {
        text(s, strong, 9, MARGIN, y, label + ":");
        text(s, font, 9, MARGIN + 150, y, clip(font, value, 9, width - 2 * MARGIN - 150));
        return y - 13;
    }

    private static String dateOf(Object o) { return o == null ? "" : String.valueOf(o); }

    private static String valueOf(Object o) { return o == null ? "" : String.valueOf(o); }

    private static void text(PDPageContentStream s, PDType0Font font, float size, float x, float y, String value) throws IOException {
        s.beginText(); s.setFont(font, size); s.newLineAtOffset(x, y); s.showText(clean(value)); s.endText();
    }

    private static String clean(String value) {
        StringBuilder sb = new StringBuilder();
        for (int cp : (value == null ? "" : value).codePoints().toArray()) if (!Character.isISOControl(cp)) sb.appendCodePoint(cp);
        return sb.toString();
    }

    private static String clip(PDType0Font font, String value, float size, float max) throws IOException {
        String v = clean(value);
        if (font.getStringWidth(v) / 1000 * size <= max) return v;
        while (v.length() > 1 && font.getStringWidth(v + "…") / 1000 * size > max) v = v.substring(0, v.length() - 1);
        return v + "…";
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}

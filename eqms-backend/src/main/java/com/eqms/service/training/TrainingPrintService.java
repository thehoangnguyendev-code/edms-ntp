package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Prints the matrix completion grid as a PDF (the forms of the company are written by TrainingFormExportService). Nothing is stored: the file is built from
 * data that no longer changes (an Effective or Obsoleted matrix version, an Approved requirement), carries the signers and a SHA-256 fingerprint of the data,
 * and every print is recorded in the Audit Trail. The same access rules as for opening the record apply.
 */
@Service
public class TrainingPrintService {
    private final TrainingMatrixService matrices;
    private final TrainingRequirementService requirements;
    private final AuditTrailService audit;
    private final TrainingMatrixCompletionService completion;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final TrainingComplianceService compliance;

    public TrainingPrintService(TrainingMatrixService matrices, TrainingRequirementService requirements, AuditTrailService audit, TrainingMatrixCompletionService completion, org.springframework.jdbc.core.JdbcTemplate jdbc, TrainingComplianceService compliance) {
        this.compliance = compliance;
        this.completion = completion;
        this.jdbc = jdbc;
        this.matrices = matrices;
        this.requirements = requirements;
        this.audit = audit;
    }

    private static final Map<String, String> STATE = Map.of("NOT_REQUIRED", "Not required", "REQUIRED", "Required", "IN_PROGRESS", "In Progress", "QUALIFIED", "Qualified", "UPDATE_NEEDED", "Update needed", "DUE", "Annual training due");

    /**
     * The completion of one position as a list: each person, how many requirements are met, and what is still open. It is a working print, not an approved record, so it carries
     * the date and the person who printed it; the state of every cell is the one the screen shows, calculated by the server at the moment of printing.
     */
    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public Map<String, Object> completion(UserAccount actor, UUID departmentId, UUID positionId, String search, String status, boolean gapsOnly) {
        List<String[]> body = new ArrayList<>();
        Map<String, Object> first = null;
        int n = 0;
        for (int page = 1; ; page++) {
            Map<String, Object> r = completion.completion(actor, departmentId, positionId, search, status, gapsOnly, page, 100, 1, 200);
            if (first == null) first = r;
            if (!Boolean.TRUE.equals(r.get("hasEffectiveMatrix"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
            List<Map<String, Object>> columns = (List<Map<String, Object>>) r.get("columns");
            for (Map<String, Object> person : (List<Map<String, Object>>) r.get("data")) {
                Map<String, Map<String, Object>> cells = (Map<String, Map<String, Object>>) person.get("cells");
                List<String> open = new ArrayList<>();
                for (Map<String, Object> c : columns) {
                    String state = String.valueOf(cells.get(String.valueOf(c.get("rowId"))).get("status"));
                    if (!"QUALIFIED".equals(state) && !"NOT_REQUIRED".equals(state)) open.add((c.get("code") == null ? "" : c.get("code") + " ") + c.get("title") + " [" + STATE.get(state) + "]");
                }
                body.add(new String[]{String.valueOf(++n), person.get("fullName") + (person.get("employeeCode") == null ? "" : " (" + person.get("employeeCode") + ")"), String.join("; ", open),
                        person.get("done") + " / " + person.get("required")});
            }
            Map<String, Object> pg = (Map<String, Object>) r.get("pagination");
            if (page >= ((Number) pg.get("totalPages")).intValue()) break;
        }
        // "All employees" is not a job role: the screen offers it first and the completion view handles it, so the print must too.
        String position = TrainingMatrixCompletionService.ALL_EMPLOYEES.equals(positionId) ? "All employees"
                : jdbc.queryForObject("select name from training_job_roles where id = ?", String.class, positionId);
        String department = jdbc.queryForList("select d.name from departments d where d.id = coalesce(?, d.id) limit 1", String.class, departmentId).stream().findFirst().orElse("");
        List<String> head = List.of("Position: " + position + (departmentId == null ? "" : "    Department: " + department) + "    Matrix version " + first.get("matrixVersionNo"),
                "Printed " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()) + " by " + actor.getFullName() + (gapsOnly ? "    Only people with a gap" : "") + (status == null || status.isBlank() ? "" : "    State: " + STATE.get(status)));
        UUID id = positionId;
        audit.logAs(actor, "TRAINING_COMPLETION", String.valueOf(position), id, "TRAINING_COMPLETION_PRINTED", null, null, body.size() + " person(s)");
        return file("Training matrix completion", head, List.of("No.", "Employee", "Open requirements", "Completed"), body, List.of(), 3, "training-matrix-completion-" + position.replaceAll("[^A-Za-z0-9]+", "-"), id);
    }

    private String departmentName(UUID departmentId) {
        return departmentId == null ? "" : jdbc.queryForList("select name from departments where id = ?", String.class, departmentId).stream().findFirst().orElse("");
    }

    private static String number(Object value) { return value == null ? "0" : String.valueOf(value); }

    private static java.time.Instant instant(Object value) { return java.time.OffsetDateTime.parse(String.valueOf(value)).toInstant(); }

    /** The Summary of the compliance screen as a list: the department, then each Work Position, with the matrix version it was measured against and the moment of printing. */
    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public Map<String, Object> summary(UserAccount actor, UUID departmentId) {
        Map<String, Object> s = compliance.summary(actor, departmentId);
        if (!Boolean.TRUE.equals(s.get("hasEffectiveMatrix"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        String department = departmentName(departmentId);
        List<String[]> body = new ArrayList<>();
        body.add(new String[]{"1", "Department (all positions)", number(s.get("people")) + " people; " + number(s.get("missing")) + " not trained; " + number(s.get("due")) + " annual training due",
                number(s.get("ok")) + " / " + number(s.get("required")) + (s.get("percentTrained") == null ? "" : " (" + s.get("percentTrained") + "%)")});
        int n = 1;
        for (Map<String, Object> p : (List<Map<String, Object>>) s.get("positions")) {
            body.add(new String[]{String.valueOf(++n), String.valueOf(p.get("name")), number(p.get("people")) + " people; " + number(p.get("missing")) + " not trained; " + number(p.get("due")) + " annual training due",
                    number(p.get("ok")) + " / " + number(p.get("required")) + (p.get("percentTrained") == null ? "" : " (" + p.get("percentTrained") + "%)")});
        }
        List<String> head = List.of("Department: " + department + "    Effective matrix v" + s.get("matrixVersionNo") + (s.get("matrixEffectiveAt") == null ? "" : ", effective " + DateTimeFormatUtils.formatDate(instant(s.get("matrixEffectiveAt")))),
                "People without a Work Position: " + number(s.get("peopleWithoutPosition")) + "    New employees: " + number(s.get("newEmployees")) + " (" + number(s.get("newEmployeesWithGaps")) + " with a gap)    Open training reviews: " + number(s.get("openReviews")),
                "Moved beyond the SOP window: " + number(s.get("linesBeyondSopWindow")) + "    Due in 14 days: " + number(s.get("dueSoonActivities")) + "    Overdue trainings: " + number(s.get("overdueActivities")),
                "Data as of " + DateTimeFormatUtils.formatDateTime(instant(s.get("generatedAt"))) + "    Printed " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()) + " by " + actor.getFullName());
        audit.logAs(actor, "TRAINING_COMPLIANCE", department, departmentId, "TRAINING_COMPLIANCE_SUMMARY_PRINTED", null, null, body.size() + " line(s)");
        return file("Training compliance summary", head, List.of("No.", "Work Position", "Figures", "Requirements met"), body, List.of(), 3, "training-compliance-summary", departmentId);
    }

    /** The Gap List as a list: every person who misses or must repeat a required training (all of them, or one), with the same filters as the screen. */
    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public Map<String, Object> gaps(UserAccount actor, UUID departmentId, String status, boolean newOnly, String search, UUID rowId) {
        Map<String, Object> trainings = compliance.gapTrainings(actor, departmentId);
        if (trainings.get("matrixVersionNo") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        List<String[]> body = new ArrayList<>();
        int n = 0;
        for (int page = 1; ; page++) {
            Map<String, Object> r = compliance.coverage(actor, departmentId, status, newOnly, search, rowId, null, null, page, 100);
            for (Map<String, Object> g : (List<Map<String, Object>>) r.get("data")) {
                if ("OK".equals(g.get("status"))) continue;
                String last = g.get("lastDone") == null ? "never" : DateTimeFormatUtils.display(g.get("lastDone"));
                body.add(new String[]{String.valueOf(++n), g.get("fullName") + (g.get("employeeCode") == null ? "" : " (" + g.get("employeeCode") + ")") + (g.get("positionName") == null ? "" : ", " + g.get("positionName")),
                        (g.get("code") == null ? "" : g.get("code") + " ") + g.get("title"), ("MISSING".equals(g.get("status")) ? "Not trained" : "Annual training due") + "; last trained " + last});
            }
            Map<String, Object> pg = (Map<String, Object>) r.get("pagination");
            if (page >= ((Number) pg.get("totalPages")).intValue()) break;
        }
        String department = departmentName(departmentId);
        List<String> head = List.of("Department: " + department + "    Effective matrix v" + trainings.get("matrixVersionNo") + (trainings.get("matrixEffectiveAt") == null ? "" : ", effective " + DateTimeFormatUtils.formatDate(instant(trainings.get("matrixEffectiveAt")))),
                (rowId == null ? "All required trainings" : "One required training") + (newOnly ? "    New employees only" : "") + (status == null || status.isBlank() ? "" : "    Status: " + ("MISSING".equals(status) ? "Not trained" : "Annual training due")) + (search == null || search.isBlank() ? "" : "    Search: " + search),
                "Data as of " + DateTimeFormatUtils.formatDateTime(instant(trainings.get("generatedAt"))) + "    Printed " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()) + " by " + actor.getFullName());
        audit.logAs(actor, "TRAINING_COMPLIANCE", department, departmentId, "TRAINING_COMPLIANCE_GAPS_PRINTED", null, null, body.size() + " line(s)");
        return file("Training gap list", head, List.of("No.", "Employee", "Required training", "Status"), body, List.of(), 3, "training-gap-list", departmentId);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ PDF

    private Map<String, Object> file(String title, List<String> head, List<String> heads, List<String[]> body, List<String> signers, int textColumns, String name, UUID id) {
        try {
            return Map.of("bytes", render(title, head, heads, body, signers, textColumns, id), "name", name + ".pdf");
        } catch (Exception e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    /** `textColumns`: the leading columns that carry text; the third one gets the free width, the rest (positions) share what is left. */
    private byte[] render(String title, List<String> head, List<String> heads, List<String[]> body, List<String> signers, int textColumns, UUID id) throws Exception {
        PDRectangle size = new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
        float width = size.getWidth(), height = size.getHeight(), margin = 36, line = 13, fontSize = 8;
        try (PDDocument pdf = new PDDocument(); var regular = getClass().getResourceAsStream("/fonts/Tinos-Regular.ttf"); var bold = getClass().getResourceAsStream("/fonts/Tinos-Bold.ttf"); var out = new ByteArrayOutputStream()) {
            if (regular == null || bold == null) throw new IllegalStateException("FONT_UNAVAILABLE");
            PDType0Font font = PDType0Font.load(pdf, regular), strong = PDType0Font.load(pdf, bold);
            float[] x = columns(heads.size(), textColumns, width - 2 * margin, margin);
            String fingerprint = fingerprint(head, heads, body);
            int index = 0, page = 0;
            do {
                PDPage p = new PDPage(size);
                pdf.addPage(p);
                try (PDPageContentStream s = new PDPageContentStream(pdf, p)) {
                    float y = height - margin;
                    text(s, strong, 13, margin, y, title); y -= 18;
                    if (page == 0) for (String h : head) { if (!h.isBlank()) { text(s, font, 9, margin, y, clip(font, h, 9, width - 2 * margin)); y -= line; } }
                    y -= 4;
                    for (int c = 0; c < heads.size(); c++) text(s, strong, fontSize, x[c], y, clip(strong, heads.get(c), fontSize, x[c + 1] - x[c] - 3));
                    y -= line;
                    while (index < body.size() && y > margin + 80) {
                        String[] row = body.get(index++);
                        for (int c = 0; c < row.length; c++) text(s, font, fontSize, x[c], y, clip(font, row[c], fontSize, x[c + 1] - x[c] - 3));
                        y -= line;
                    }
                    page++;
                    text(s, font, 7, margin, margin - 12, "Page " + page + "    Printed " + DateTimeFormatUtils.formatDateTime(java.time.Instant.now()) + "    Record " + id);
                    if (index >= body.size()) {
                        y = Math.min(y - 8, margin + 60);
                        for (String sg : signers) { text(s, font, 9, margin, y, sg + " (electronic signature)"); y -= line; }
                        text(s, font, 7, margin, y, "Data fingerprint (SHA-256): " + fingerprint);
                    }
                }
            } while (index < body.size());
            pdf.save(out);
            return out.toByteArray();
        }
    }

    private static float[] columns(int count, int textColumns, float total, float margin) {
        float[] w = new float[count];
        float fixed = 0;
        for (int c = 0; c < count; c++) {
            boolean position = c >= 4 && textColumns == 4;
            w[c] = position ? 0 : switch (c) { case 0 -> 28; case 1 -> textColumns == 4 ? 80 : 70; case 2 -> 0; case 3 -> textColumns == 4 ? 40 : 90; default -> 80; };
            fixed += w[c];
        }
        float rest = Math.max(total - fixed, 100);
        if (textColumns == 4) {
            float topic = Math.min(rest * 0.4f, 260);
            w[2] = topic;
            float each = (rest - topic) / Math.max(1, count - 4);
            for (int c = 4; c < count; c++) w[c] = each;
        } else {
            w[2] = rest;
        }
        float[] x = new float[count + 1];
        x[0] = margin;
        for (int c = 0; c < count; c++) x[c + 1] = x[c] + w[c];
        return x;
    }

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

    private static String fingerprint(List<String> head, List<String> heads, List<String[]> body) {
        StringBuilder sb = new StringBuilder(String.join("|", head)).append('\n').append(String.join("|", heads)).append('\n');
        for (String[] r : body) sb.append(String.join("|", r)).append('\n');
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String nvl(Object v) { return v == null ? "" : String.valueOf(v); }
}

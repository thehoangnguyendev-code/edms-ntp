package com.eqms.service.training;

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
 * Prints an approved training matrix version (APD.0011) and an approved training requirement (APD.0118) as a PDF. Nothing is stored: the file is built from
 * data that no longer changes (an Effective or Obsolete matrix version, an Approved requirement), carries the signers and a SHA-256 fingerprint of the data,
 * and every print is recorded in the Audit Trail. The same access rules as for opening the record apply.
 */
@Service
public class TrainingPrintService {
    private final TrainingMatrixService matrices;
    private final TrainingRequirementService requirements;
    private final AuditTrailService audit;

    public TrainingPrintService(TrainingMatrixService matrices, TrainingRequirementService requirements, AuditTrailService audit) {
        this.matrices = matrices;
        this.requirements = requirements;
        this.audit = audit;
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> matrixVersion(UserAccount actor, UUID versionId) {
        Map<String, Object> v = matrices.version(actor, versionId);
        String status = String.valueOf(v.get("status"));
        if (!"EFFECTIVE".equals(status) && !"OBSOLETE".equals(status)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        List<Map<String, Object>> positions = (List<Map<String, Object>>) v.get("positions");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) v.get("rows");
        List<String> heads = new ArrayList<>(List.of("No.", "Group", "Topic or SOP", "Annual"));
        positions.forEach(p -> heads.add(String.valueOf(p.get("name"))));
        List<String[]> body = new ArrayList<>();
        int n = 0;
        for (Map<String, Object> r : rows) {
            List<String> cells = new ArrayList<>();
            cells.add(String.valueOf(++n));
            cells.add(switch (String.valueOf(r.get("rowGroup"))) { case "FACTORY_GENERAL" -> "General (factory)"; case "DEPARTMENT_GENERAL" -> "General (department)"; default -> "SOP"; });
            cells.add(r.get("topicId") != null ? r.get("topicCode") + " - " + r.get("topicName") : r.get("documentNumber") + " - " + r.get("documentName"));
            cells.add(Boolean.TRUE.equals(r.get("annualRequired")) ? "Yes" : "");
            List<?> ids = (List<?>) r.get("positionIds");
            for (Map<String, Object> p : positions) cells.add(ids.contains(p.get("id")) ? "X" : "");
            body.add(cells.toArray(String[]::new));
        }
        List<String> head = List.of(
                "Training Matrix " + v.get("matrixCode") + " - version " + v.get("versionNo") + " (" + ("EFFECTIVE".equals(status) ? "Effective" : "Obsolete") + ")",
                "Department: " + v.get("departmentName"),
                v.get("changeReason") == null ? "" : "What changed: " + v.get("changeReason"));
        List<String> signers = signers((List<Map<String, Object>>) v.get("approvers"), "Approved by");
        audit.logAs(actor, "TRAINING_MATRIX", v.get("matrixCode") + " v" + v.get("versionNo"), versionId, "TRAINING_MATRIX_PRINTED", null, null, "PDF printed");
        return file("Training Matrix (APD.0011)", head, heads, body, signers, 4, v.get("matrixCode") + "-v" + v.get("versionNo"), versionId);
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> requirement(UserAccount actor, UUID id) {
        Map<String, Object> r = requirements.get(actor, id);
        if (!"APPROVED".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PRINT_NOT_APPROVED");
        List<String> heads = List.of("No.", "Planned month", "Topic or SOP", "Training Number", "Status", "QA");
        List<String[]> body = new ArrayList<>();
        for (Map<String, Object> l : (List<Map<String, Object>>) r.get("lines")) {
            body.add(new String[]{String.valueOf(l.get("lineNo")), String.valueOf(l.get("plannedMonth")).substring(0, 7),
                    (l.get("code") == null ? "" : l.get("code") + " - ") + l.get("title"), l.get("trainingNumber") == null ? "" : String.valueOf(l.get("trainingNumber")),
                    String.valueOf(l.get("lineStatus")).toLowerCase().replace('_', ' '), l.get("qaSignedByName") == null ? "" : String.valueOf(l.get("qaSignedByName"))});
        }
        List<String> head = List.of("Training Requirement " + r.get("requestNo") + " (" + r.get("year") + ")", "Department: " + r.get("departmentName") + "    Due by: " + nvl(r.get("dueBy")));
        List<String> signers = List.of("Prepared by: " + nvl(r.get("preparedByName")), "Reviewed by: " + nvl(r.get("reviewedByName")), "Approved by: " + nvl(r.get("approvedByName")));
        audit.logAs(actor, "TRAINING_REQUIREMENT", String.valueOf(r.get("requestNo")), id, "TRAINING_REQUIREMENT_PRINTED", null, null, "PDF printed");
        return file("Training Requirement (APD.0118)", head, heads, body, signers, 3, String.valueOf(r.get("requestNo")).replace('/', '-'), id);
    }

    private static List<String> signers(List<Map<String, Object>> approvers, String label) {
        List<String> out = new ArrayList<>();
        for (Map<String, Object> a : approvers) if ("DONE".equals(a.get("status"))) out.add(label + ": " + a.get("assigneeName") + " (" + String.valueOf(a.get("completedAt")).replace('T', ' ') + ")");
        return out;
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
                    text(s, font, 7, margin, margin - 12, "Page " + page + "    Printed " + LocalDateTime.now().withNano(0) + "    Record " + id);
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

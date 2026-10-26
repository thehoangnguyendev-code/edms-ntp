package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The library of Training Assessments (APD.0009): tests and checklists designed once, so that a training activity can choose one instead of writing its own.
 * <ul>
 *   <li>Case 1 (QUESTIONS): single choice, multiple choice, true or false, essay. An essay is marked by hand on the paper.</li>
 *   <li>Case 2 (CHECKLIST): each line is ticked Correct or Incorrect; the key holds the expected one. A checklist has no score; the person passes only when every line is as expected.</li>
 * </ul>
 * The name of an assessment only identifies it in the library; it is never written in the form. Choosing one in the tab Assessment of an activity writes its content into the Word form APD.0009
 * that is enabled in Training Properties (Assessment Forms): the exam file and the answer key of the activity, which the organizer can still open and change in the editor. Taking the choice off
 * removes those two files from the activity (they stay on record). The person who designs (training.assessment.design) writes a draft and sends it for approval; the person who approves
 * (training.assessment.approve), who is not the person who made, changed or sent it, signs it into Effective. A change is a new version. The key is seen only by the people who design or approve,
 * and by the people who organize the activity.
 */
@Service
public class TrainingAssessmentLibraryService {
    public static final String TYPE = "TRAINING_ASSESSMENT";
    private static final Set<String> QUESTION_KINDS = Set.of("SINGLE", "MULTI", "TRUE_FALSE", "ESSAY");
    private static final String[] LETTERS = {"A", "B", "C", "D", "E", "F", "G", "H"};

    public record OptionDto(String text) {}
    public record ItemDto(String kind, String prompt, List<OptionDto> options, List<String> correct, BigDecimal points, String modelAnswer) {}
    public record SaveRequest(Integer version, String name, String kind, Integer durationMinutes, List<ItemDto> items) {}
    public record ApproveRequest(String signatureToken, String reason) {}
    public record ReasonRequest(String reason) {}
    public record ChooseRequest(UUID assessmentId) {}
    /** What the editor shows now, saved or not: the paper is drawn from it. {@code key} draws the paper of the trainer, with the answers. */
    public record PreviewRequest(String name, String kind, Integer durationMinutes, List<ItemDto> items, boolean key, String code, String revisionNumber, Boolean sideBySide) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final ObjectMapper json;
    private final TrainingFileService files;
    private final com.eqms.service.OnlyOfficeDocumentEditService onlyOffice;
    private final TrainingPreviewMarking marking;

    public TrainingAssessmentLibraryService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, ElectronicSignatureService signatures, AuditTrailService audit, ObjectMapper json, TrainingFileService files, com.eqms.service.OnlyOfficeDocumentEditService onlyOffice, TrainingPreviewMarking marking) {
        this.files = files;
        this.onlyOffice = onlyOffice;
        this.marking = marking;
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.signatures = signatures;
        this.audit = audit;
        this.json = json;
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private boolean designer(UserAccount actor) { return access.has(actor, "training.assessment.design"); }

    private boolean approver(UserAccount actor) { return access.has(actor, "training.assessment.approve"); }

    // ------------------------------------------------------------------------------------------------------------------------------ the library

    /** The list: searched, filtered, sorted and paged here. Only the people who design or approve see it (it holds the keys). */
    @Transactional(readOnly = true)
    public Map<String, Object> page(UserAccount actor, String search, String status, String kind, String sortBy, String sortDirection, int page, int limit) {
        return page(actor, search, status, kind, sortBy, sortDirection, page, limit, Map.of());
    }

    /** {@code more}: updatedBy (a name), updatedFrom and updatedTo (the Last Changed date range, yyyy-MM-dd, both days included), revision (an exact revision number). */
    @Transactional(readOnly = true)
    public Map<String, Object> page(UserAccount actor, String search, String status, String kind, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.assessment.design", "training.assessment.approve");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (search != null && !search.isBlank()) {
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (lower(d.code) like ? escape '\\' or lower(d.name) like ? escape '\\' or d.revision_number like ? escape '\\')");
            args.add(like); args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().contains(more.get("updatedBy"), "u.full_name").equal("d.revision_number", more.get("revision"))
                .timeRange("d.updated_at", more.get("updatedFrom"), more.get("updatedTo"));
        where.append(extra.and());
        args.addAll(extra.args());
        if (status != null && Set.of("DRAFT", "PENDING_APPROVAL", "EFFECTIVE", "OBSOLETED").contains(status)) { where.append(" and d.status = ?"); args.add(status); }
        if (kind != null && Set.of("QUESTIONS", "CHECKLIST").contains(kind)) { where.append(" and d.kind = ?"); args.add(kind); }
        String from = " from training_assessment_defs d join app_users u on u.id = d.updated_by left join app_users a on a.id = d.approved_by";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select d.id, d.code, d.version_no, d.revision_number, d.name, d.kind, d.status, d.created_at, d.updated_at, u.full_name as updated_by_name, d.approved_at, a.full_name as approved_by_name,
                   (select count(*) from training_assessment_def_items i where i.def_id = d.id) as item_count,
                   case when d.kind = 'CHECKLIST' then null else (select coalesce(sum(i.points), 0) from training_assessment_def_items i where i.def_id = d.id) end as max_score
            """ + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("code", "d.code", "name", "d.name", "kind", "d.kind", "status", "d.status", "updatedAt", "d.updated_at", "updatedBy", "u.full_name", "revision", "d.version_no", "versionNo", "d.version_no", "itemCount", "item_count", "maxScore", "max_score"), "d.updated_at desc") + " limit ? offset ?", args.toArray());
        // what the menu of a row may offer, decided here
        boolean design = designer(actor), approve = approver(actor);
        for (Map<String, Object> row : rows) {
            Map<String, Object> actions = new LinkedHashMap<>();
            actions.put("view", true);
            actions.put("continueDraft", design && "DRAFT".equals(row.get("status")));
            actions.put("review", approve && "PENDING_APPROVAL".equals(row.get("status")));
            row.put("actions", actions);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** What a person who organizes a training can choose from: the approved versions, with no key. */
    @Transactional(readOnly = true)
    public Map<String, Object> approved(UserAccount actor, String search, String kind) {
        access.require(actor, "training.activity.organize", "training.assessment.design", "training.assessment.approve");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where d.status = 'EFFECTIVE'");
        if (search != null && !search.isBlank()) {
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (lower(d.code) like ? escape '\\' or lower(d.name) like ? escape '\\')");
            args.add(like); args.add(like);
        }
        if (kind != null && Set.of("QUESTIONS", "CHECKLIST").contains(kind)) { where.append(" and d.kind = ?"); args.add(kind); }
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select d.id, d.code, d.version_no, d.revision_number, d.name, d.kind, d.approved_at,
                   (select count(*) from training_assessment_def_items i where i.def_id = d.id) as item_count,
                   case when d.kind = 'CHECKLIST' then null else (select coalesce(sum(i.points), 0) from training_assessment_def_items i where i.def_id = d.id) end as max_score
              from training_assessment_defs d""" + where + " order by d.name, d.code limit 50", args.toArray());
        return Map.of("data", TrainingRows.camel(rows));
    }

    /**
     * The revisions of the assessment of {@code id} (every revision of the same Assessment Number), searched, sorted and paged here, as the revisions of a document are in Document Control.
     * {@code current} marks the one the person is looking at.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> revisions(UserAccount actor, UUID id, String search, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.assessment.design", "training.assessment.approve");
        Map<String, Object> def = row(id);
        List<Object> args = new ArrayList<>();
        args.add(def.get("code"));
        StringBuilder where = new StringBuilder(" where d.code = ?");
        if (search != null && !search.isBlank()) {
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (d.revision_number like ? escape '\\' or lower(d.name) like ? escape '\\' or lower(u.full_name) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like);
        }
        String from = " from training_assessment_defs d join app_users u on u.id = d.created_by";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("select d.id, d.revision_number, d.name, d.status, d.created_at, u.full_name as created_by_name, d.approved_at"
                + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("revisionNumber", "d.version_no", "created", "d.created_at", "openedBy", "u.full_name", "name", "d.name", "status", "d.status"), "d.version_no desc") + " limit ? offset ?", args.toArray());
        List<Map<String, Object>> data = TrainingRows.camel(rows);
        for (Map<String, Object> row : data) row.put("current", id.equals(row.get("id")));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", data);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The revision numbers, as a document's: a draft is (effective major).0.(patch + 1) and approving it makes the next major; 0.0.1 becomes 1.0.0 and 1.0.1 becomes 2.0.0. */
    static String approvedRevision(String draftRevision) {
        return (major(draftRevision) + 1) + ".0.0";
    }

    static String nextDraftRevision(String effectiveRevision) {
        return major(effectiveRevision) + ".0.1";
    }

    private static int major(String revision) {
        try {
            return Integer.parseInt(String.valueOf(revision).split("\\.")[0]);
        } catch (NumberFormatException e) {
            throw new IllegalStateException("TRAINING_ASSESSMENT_REVISION_INVALID");
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        access.require(actor, "training.assessment.design", "training.assessment.approve");
        return detail(actor, row(id));
    }

    private Map<String, Object> detail(UserAccount actor, Map<String, Object> def) {
        UUID id = (UUID) def.get("id");
        Map<String, Object> out = TrainingRows.camel(def);
        List<Map<String, Object>> items = items(id);
        out.put("items", items);
        // A checklist has no score.
        out.put("maxScore", "CHECKLIST".equals(def.get("kind")) ? null : total(items));
        out.put("createdByName", name(def.get("created_by")));
        out.put("updatedByName", name(def.get("updated_by")));
        out.put("submittedByName", name(def.get("submitted_by")));
        out.put("durationMinutes", def.get("duration_minutes"));
        out.put("approvedByName", name(def.get("approved_by")));
        Integer used = jdbc.queryForObject("select count(*) from training_activities where assessment_def_id = ?", Integer.class, id);
        out.put("usedByActivities", used == null ? 0 : used);
        String status = String.valueOf(def.get("status"));
        boolean draft = "DRAFT".equals(status);
        boolean pending = "PENDING_APPROVAL".equals(status);
        boolean open = Integer.valueOf(1).equals(jdbc.queryForObject("select count(*) from training_assessment_defs where code = ? and status in ('DRAFT', 'PENDING_APPROVAL')", Integer.class, def.get("code")));
        boolean apart = !actor.getId().equals(def.get("created_by")) && !actor.getId().equals(def.get("updated_by")) && !actor.getId().equals(def.get("submitted_by"));
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("edit", designer(actor) && draft);
        caps.put("delete", designer(actor) && draft);
        caps.put("submit", designer(actor) && draft && !items.isEmpty());
        caps.put("returnToDraft", (designer(actor) || approver(actor)) && pending);
        caps.put("approve", approver(actor) && pending && apart);
        caps.put("newVersion", designer(actor) && "EFFECTIVE".equals(status) && !open);
        out.put("capabilities", caps);
        // Why the approval is not offered to a person who may approve in general (shown instead of hiding the button without a word).
        out.put("approveBlocker", approver(actor) && pending && !apart ? TrainingApprovalService.SEGREGATION : null);
        return out;
    }

    private String name(Object userId) {
        return userId == null ? null : jdbc.queryForList("select full_name from app_users where id = ?", String.class, userId).stream().findFirst().orElse(null);
    }

    private List<Map<String, Object>> items(UUID defId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : jdbc.queryForList("select item_no, kind, prompt, options::text as options, correct::text as correct, points, model_answer from training_assessment_def_items where def_id = ? order by item_no", defId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("no", r.get("item_no"));
            m.put("kind", r.get("kind"));
            m.put("prompt", r.get("prompt"));
            m.put("options", read(r.get("options")));
            m.put("correct", read(r.get("correct")));
            m.put("points", r.get("points"));
            m.put("modelAnswer", r.get("model_answer"));
            out.add(m);
        }
        return out;
    }

    private Object read(Object text) {
        try {
            return json.readValue(String.valueOf(text), Object.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("TRAINING_ASSESSMENT_INVALID", e);
        }
    }

    private static BigDecimal total(List<Map<String, Object>> items) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Map<String, Object> i : items) sum = sum.add(new BigDecimal(String.valueOf(i.get("points"))));
        BigDecimal t = sum.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros();
        return t.scale() < 0 ? t.setScale(0) : t;
    }

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForList("select * from training_assessment_defs where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_assessment_defs where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    /** The enabled form APD.0009 (Training Properties, Assessment Forms): the file the content is written into. */
    private byte[] enabledTemplate() {
        Map<String, Object> t = jdbc.queryForList("select * from training_form_templates where code = 'APD.0009' and status = 'ENABLED' order by activated_at desc limit 1").stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FORM_TEMPLATE_MISSING"));
        return files.readStored(String.valueOf(t.get("provider")), String.valueOf(t.get("stored_path")), String.valueOf(t.get("sha256")));
    }

    private byte[] toPdf(byte[] docx) {
        java.nio.file.Path temp = null;
        try {
            temp = java.nio.file.Files.createTempFile("training-assessment-preview-", ".docx");
            java.nio.file.Files.write(temp, docx);
            return onlyOffice.convertLocalFileToPdf(temp, temp.getFileName().toString());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_PREVIEW_UNAVAILABLE");
        } catch (java.io.IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        } finally {
            if (temp != null) {
                try { java.nio.file.Files.deleteIfExists(temp); } catch (java.io.IOException ignored) { /* a temporary file */ }
            }
        }
    }

    /**
     * The form as the activity would get it, made from what the person has in the editor (saved or not) and the enabled form APD.0009, as a PDF. The training topic is written as it is
     * when the activity chooses it; here it is a sample line. It is a view only: nothing is stored. With {@code key} it is the trainer's copy with the answers.
     */
    @Transactional(readOnly = true)
    public byte[] preview(UserAccount actor, PreviewRequest request) {
        access.require(actor, "training.assessment.design", "training.assessment.approve");
        if (request == null || request.name() == null || request.name().isBlank()) throw new IllegalArgumentException("TRAINING_ASSESSMENT_TITLE_REQUIRED");
        if (request.kind() == null || !Set.of("QUESTIONS", "CHECKLIST").contains(request.kind())) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
        List<Map<String, Object>> items = normalize(request.kind(), request.items());
        if (request.durationMinutes() != null && (request.durationMinutes() < 1 || request.durationMinutes() > 480)) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
        boolean checklist = "CHECKLIST".equals(request.kind());
        byte[] template = enabledTemplate();
        // a view: it carries the watermark of the preview settings
        if (Boolean.TRUE.equals(request.sideBySide())) {
            // the test paper and the paper with the answer key in one file, page beside page: the viewer scrolls and zooms them together
            byte[] paper = toPdf(TrainingAssessmentForm.build(template, new TrainingAssessmentForm.Content(items, checklist, false, List.of(), null, null, request.durationMinutes())));
            byte[] key = toPdf(TrainingAssessmentForm.build(template, new TrainingAssessmentForm.Content(items, checklist, true, List.of(), null, null, request.durationMinutes())));
            return marking.mark(TrainingPdfSideBySide.join(paper, key), actor);
        }
        return marking.mark(toPdf(TrainingAssessmentForm.build(template, new TrainingAssessmentForm.Content(items, checklist, request.key(), List.of(), null, null, request.durationMinutes()))), actor);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ design

    /** The items as they are stored: the options get their letters, a true or false its two answers, a checklist line its expected tick. Anything else is refused with a stable code. */
    static List<Map<String, Object>> normalize(String kind, List<ItemDto> items) {
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEMS_REQUIRED");
        if (items.size() > 200) throw new IllegalArgumentException("TRAINING_ASSESSMENT_TOO_LARGE");
        boolean checklist = "CHECKLIST".equals(kind);
        List<Map<String, Object>> out = new ArrayList<>();
        int no = 1;
        for (ItemDto it : items) {
            if (it == null || it.kind() == null || it.prompt() == null || it.prompt().isBlank() || it.prompt().length() > 2000) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
            if (checklist ? !"CHECK".equals(it.kind()) : !QUESTION_KINDS.contains(it.kind())) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
            // A checklist has no score: its lines carry no points of their own (stored as 1 only because a row needs a value).
            BigDecimal points = checklist || it.points() == null ? BigDecimal.ONE : it.points().setScale(2, RoundingMode.HALF_UP);
            if (points.signum() <= 0 || points.compareTo(BigDecimal.valueOf(100)) > 0) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
            List<Map<String, String>> options = new ArrayList<>();
            List<String> correct = new ArrayList<>();
            String model = null;
            switch (it.kind()) {
                case "SINGLE", "MULTI" -> {
                    List<OptionDto> given = it.options() == null ? List.of() : it.options();
                    if (given.size() < 2 || given.size() > LETTERS.length) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
                    for (int i = 0; i < given.size(); i++) {
                        String text = given.get(i) == null ? null : given.get(i).text();
                        if (text == null || text.isBlank() || text.length() > 500) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
                        options.add(Map.of("id", LETTERS[i], "text", text.trim()));
                    }
                    Set<String> valid = new java.util.HashSet<>();
                    for (Map<String, String> o : options) valid.add(o.get("id"));
                    List<String> picked = it.correct() == null ? List.of() : it.correct().stream().distinct().toList();
                    if (picked.isEmpty() || !valid.containsAll(picked) || ("SINGLE".equals(it.kind()) && picked.size() != 1)) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
                    correct.addAll(picked);
                }
                case "TRUE_FALSE" -> {
                    options.add(Map.of("id", "A", "text", "True / Đúng"));
                    options.add(Map.of("id", "B", "text", "False / Sai"));
                    if (it.correct() == null || it.correct().size() != 1 || !Set.of("A", "B").contains(it.correct().getFirst())) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
                    correct.add(it.correct().getFirst());
                }
                case "ESSAY" -> {
                    if (it.modelAnswer() != null && it.modelAnswer().length() > 4000) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
                    model = it.modelAnswer() == null || it.modelAnswer().isBlank() ? null : it.modelAnswer().trim();
                }
                default -> { // CHECK
                    if (it.correct() == null || it.correct().size() != 1 || !Set.of("CORRECT", "INCORRECT").contains(it.correct().getFirst())) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
                    correct.add(it.correct().getFirst());
                }
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("no", no++);
            m.put("kind", it.kind());
            m.put("prompt", it.prompt().trim());
            m.put("options", options);
            m.put("correct", correct);
            m.put("points", points);
            m.put("modelAnswer", model);
            out.add(m);
        }
        return out;
    }

    private void checkHeader(SaveRequest request) {
        if (request == null || request.name() == null || request.name().isBlank() || request.name().length() > 255) throw new IllegalArgumentException("TRAINING_ASSESSMENT_TITLE_REQUIRED");
        if (request.durationMinutes() != null && (request.durationMinutes() < 1 || request.durationMinutes() > 480)) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
        if (request.kind() == null || !Set.of("QUESTIONS", "CHECKLIST").contains(request.kind())) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
    }

    private void writeItems(UUID defId, List<Map<String, Object>> items) {
        for (Map<String, Object> m : items) {
            try {
                jdbc.update("insert into training_assessment_def_items(id, def_id, item_no, kind, prompt, options, correct, points, model_answer) values (?,?,?,?,?,?::jsonb,?::jsonb,?,?)",
                        UUID.randomUUID(), defId, m.get("no"), m.get("kind"), m.get("prompt"), json.writeValueAsString(m.get("options")), json.writeValueAsString(m.get("correct")), m.get("points"), m.get("modelAnswer"));
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("TRAINING_ASSESSMENT_INVALID", e);
            }
        }
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, SaveRequest request) {
        access.require(actor, "training.assessment.design");
        checkHeader(request);
        List<Map<String, Object>> items = normalize(request.kind(), request.items());
        UUID id = UUID.randomUUID();
        Long seq = jdbc.queryForObject("select nextval('training_assessment_code_seq')", Long.class);
        String code = String.format("TAS-%04d", seq == null ? 0 : seq);
        jdbc.update("insert into training_assessment_defs(id, code, version_no, revision_number, name, kind, duration_minutes, created_by, updated_by) values (?,?,1,'0.0.1',?,?,?,?,?)",
                id, code, request.name().trim(), request.kind(), request.durationMinutes(), actor.getId(), actor.getId());
        writeItems(id, items);
        audit.logAs(actor, TYPE, TYPE, id, "TRAINING_ASSESSMENT_CREATED", null, "DRAFT", code + " 0.0.1: " + request.name().trim() + " (" + items.size() + " item(s))");
        return detail(actor, row(id));
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, SaveRequest request) {
        access.require(actor, "training.assessment.design");
        Map<String, Object> def = lock(id);
        if (!"DRAFT".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_DRAFT");
        if (request == null || request.version() == null || request.version().intValue() != ((Number) def.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_VERSION_CHANGED");
        checkHeader(request);
        if (!request.kind().equals(def.get("kind"))) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEM_INVALID");
        List<Map<String, Object>> items = normalize(request.kind(), request.items());
        jdbc.update("update training_assessment_defs set name = ?, duration_minutes = ?, updated_by = ?, updated_at = now(), version = version + 1 where id = ?",
                request.name().trim(), request.durationMinutes(), actor.getId(), id);
        jdbc.update("delete from training_assessment_def_items where def_id = ?", id);
        writeItems(id, items);
        audit.logAs(actor, TYPE, TYPE, id, "TRAINING_ASSESSMENT_UPDATED", "DRAFT", "DRAFT", def.get("code") + " " + def.get("revision_number") + ": " + items.size() + " item(s), total " + total(items) + " point(s)");
        return detail(actor, row(id));
    }

    /** A draft that is not wanted any more. Approved versions are never deleted. */
    @Transactional
    public Map<String, Object> delete(UserAccount actor, UUID id, ReasonRequest request) {
        access.require(actor, "training.assessment.design");
        Map<String, Object> def = lock(id);
        if (!"DRAFT".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_DRAFT");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("delete from training_assessment_defs where id = ?", id);
        audit.logAs(actor, TYPE, TYPE, id, "TRAINING_ASSESSMENT_DELETED", "DRAFT", null, def.get("code") + " " + def.get("revision_number") + ": " + request.reason().trim());
        return Map.of("deleted", true);
    }

    /** The designer sends the draft for approval; it can no longer be changed until it is returned. */
    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID id) {
        access.require(actor, "training.assessment.design");
        Map<String, Object> def = lock(id);
        if (!"DRAFT".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_DRAFT");
        Integer count = jdbc.queryForObject("select count(*) from training_assessment_def_items where def_id = ?", Integer.class, id);
        if (count == null || count == 0) throw new IllegalArgumentException("TRAINING_ASSESSMENT_ITEMS_REQUIRED");
        jdbc.update("update training_assessment_defs set status = 'PENDING_APPROVAL', submitted_by = ?, submitted_at = now(), version = version + 1 where id = ?", actor.getId(), id);
        audit.logAs(actor, TYPE, TYPE, id, "TRAINING_ASSESSMENT_SUBMITTED", "DRAFT", "PENDING_APPROVAL", def.get("code") + " " + def.get("revision_number") + ": " + def.get("name"));
        return detail(actor, row(id));
    }

    /** The approver, or the designer, takes it back to a draft with a reason (for example a mistake in a question). */
    @Transactional
    public Map<String, Object> returnToDraft(UserAccount actor, UUID id, ReasonRequest request) {
        access.require(actor, "training.assessment.design", "training.assessment.approve");
        Map<String, Object> def = lock(id);
        if (!"PENDING_APPROVAL".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_PENDING");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_assessment_defs set status = 'DRAFT', submitted_by = null, submitted_at = null, version = version + 1 where id = ?", id);
        audit.logAs(actor, TYPE, TYPE, id, "TRAINING_ASSESSMENT_RETURNED", "PENDING_APPROVAL", "DRAFT", def.get("code") + " " + def.get("revision_number") + ": " + request.reason().trim());
        return detail(actor, row(id));
    }

    /** The approval: a person who holds the approval permission and is not the one who made, changed or submitted the draft, with a signature. The earlier effective version of the code is replaced. */
    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID id, ApproveRequest request) {
        access.require(actor, "training.assessment.approve");
        Map<String, Object> def = lock(id);
        if (!"PENDING_APPROVAL".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_PENDING");
        if (actor.getId().equals(def.get("created_by")) || actor.getId().equals(def.get("updated_by")) || actor.getId().equals(def.get("submitted_by"))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        String approvedRevision = approvedRevision(String.valueOf(def.get("revision_number")));
        String label = def.get("code") + " " + approvedRevision;
        String reason = request.reason() == null || request.reason().isBlank() ? "Training Management: assessment approved" : request.reason().trim();
        UUID signature = signatures.createEntitySignature(TYPE, id, label, actor, request.signatureToken(), "TRAINING_ASSESSMENT_APPROVED", reason, null, null, null).getId();
        jdbc.update("update training_assessment_defs set status = 'OBSOLETED' where code = ? and status = 'EFFECTIVE'", def.get("code"));
        jdbc.update("update training_assessment_defs set status = 'EFFECTIVE', revision_number = ?, approved_by = ?, approved_at = now(), approval_signature_id = ?, version = version + 1 where id = ?", approvedRevision, actor.getId(), signature, id);
        audit.logAs(actor, TYPE, TYPE, id, "TRAINING_ASSESSMENT_APPROVED", "PENDING_APPROVAL", "EFFECTIVE", label + ": " + def.get("name"));
        return detail(actor, row(id));
    }

    /** A change to an effective assessment is a new draft version of the same code. */
    @Transactional
    public Map<String, Object> newVersion(UserAccount actor, UUID id) {
        access.require(actor, "training.assessment.design");
        Map<String, Object> def = lock(id);
        if (!"EFFECTIVE".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_APPROVED");
        Integer drafts = jdbc.queryForObject("select count(*) from training_assessment_defs where code = ? and status in ('DRAFT', 'PENDING_APPROVAL')", Integer.class, def.get("code"));
        if (drafts != null && drafts > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_DRAFT_EXISTS");
        Integer next = jdbc.queryForObject("select max(version_no) + 1 from training_assessment_defs where code = ?", Integer.class, def.get("code"));
        UUID created = UUID.randomUUID();
        jdbc.update("insert into training_assessment_defs(id, code, version_no, revision_number, name, kind, duration_minutes, created_by, updated_by) values (?,?,?,?,?,?,?,?,?)",
                created, def.get("code"), next, nextDraftRevision(String.valueOf(def.get("revision_number"))), def.get("name"), def.get("kind"), def.get("duration_minutes"), actor.getId(), actor.getId());
        jdbc.update("""
            insert into training_assessment_def_items(id, def_id, item_no, kind, prompt, options, correct, points, model_answer)
            select gen_random_uuid(), ?, item_no, kind, prompt, options, correct, points, model_answer from training_assessment_def_items where def_id = ?
            """, created, id);
        audit.logAs(actor, TYPE, TYPE, created, "TRAINING_ASSESSMENT_NEW_VERSION", "EFFECTIVE", "DRAFT", def.get("code") + " " + nextDraftRevision(String.valueOf(def.get("revision_number"))) + " from " + def.get("revision_number"));
        return detail(actor, row(created));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ an activity chooses one

    private boolean contentReviewed(UUID activityId) {
        Integer count = jdbc.queryForObject("select count(*) from training_active_confirmations where activity_id=? and kind='CONTENT_REVIEWED'", Integer.class, activityId);
        return count != null && count > 0;
    }

    private Map<String, Object> lockedForContent(UserAccount actor, UUID activityId) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!Set.of("PLANNED", "NOTIFIED").contains(String.valueOf(activity.get("status")))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        // The reviewer signs the content as it is: it is chosen before the review, like a file is uploaded before it.
        if (contentReviewed(activityId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_ALREADY_REVIEWED");
        if ("EXTERNAL".equals(activity.get("kind"))) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
        return activity;
    }

    /** The topics of the training as the activity says them: the topics of its sessions (General Information and Sessions), else its title. */
    private List<String> topicsOf(Map<String, Object> activity) {
        List<String> topics = jdbc.queryForList("""
            select distinct coalesce(nullif(trim(st.topic_text), ''), st.document_number) from training_session_topics st join training_sessions s on s.id = st.session_id
             where s.activity_id = ? and s.status <> 'CANCELLED'
            """, String.class, activity.get("id")).stream().filter(t -> t != null && !t.isBlank()).sorted().toList();
        return topics.isEmpty() ? List.of(String.valueOf(activity.get("training_title"))) : topics;
    }

    /** Which box of "Training type" is ticked: a training that supplements another is a re-training; otherwise the kind of the activity. */
    static String trainingTypeOf(Map<String, Object> activity) {
        if (activity.get("parent_activity_id") != null) return "RETRAINING";
        return switch (String.valueOf(activity.get("kind"))) {
            case "INITIAL" -> "INITIAL";
            case "PERIODIC" -> "PERIODIC";
            case "UNPLANNED" -> "UNPLANNED";
            default -> null;
        };
    }

    private static String safe(String value) {
        return value.replaceAll("[^A-Za-z0-9._ -]", "-");
    }

    /** A file of the activity for a purpose; the one that was there stays on record, marked as replaced. */
    private void putMaterial(UserAccount actor, UUID activityId, String purpose, String name, byte[] bytes, String why) {
        UUID id = UUID.randomUUID();
        TrainingFileService.StoredFile stored = files.storeBytes(bytes, name, "training/materials/" + activityId + "/" + id, Set.of("docx"));
        jdbc.update("insert into training_materials(id, activity_id, title, purpose, original_name, provider, stored_path, content_type, size_bytes, sha256, uploaded_by) values (?,?,?,?,?,?,?,?,?,?,?)",
                id, activityId, stored.name(), purpose, stored.name(), stored.provider(), stored.path(), stored.contentType(), stored.size(), stored.sha256(), actor.getId());
        jdbc.update("update training_materials set removed_at = now(), removed_by = ?, remove_reason = ? where activity_id = ? and purpose = ? and removed_at is null and id <> ?", actor.getId(), why, activityId, purpose, id);
    }

    /**
     * The activity takes an effective assessment of the library: its content is written into the enabled form APD.0009 (the topic from the activity, the questions or the checklist), once as the
     * exam file and once, with the key, as the answer key. Both are Word files in the tab Assessment, which the organizer can open and change in the editor like any other.
     */
    @Transactional
    public void choose(UserAccount actor, UUID activityId, ChooseRequest request) {
        Map<String, Object> activity = lockedForContent(actor, activityId);
        if (request == null || request.assessmentId() == null) throw new IllegalArgumentException("TRAINING_ASSESSMENT_REQUIRED");
        Map<String, Object> def = row(request.assessmentId());
        if (!"EFFECTIVE".equals(def.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_APPROVED");
        boolean checklist = "CHECKLIST".equals(def.get("kind"));
        Integer matching = jdbc.queryForObject("select count(*) from training_sessions where activity_id = ? and status <> 'CANCELLED' and assessment_method = ?", Integer.class, activityId, checklist ? "CHECKLIST" : "TEST");
        if (matching == null || matching == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_KIND_MISMATCH");
        List<Map<String, Object>> items = items((UUID) def.get("id"));
        byte[] template = enabledTemplate();
        // what is known for the whole activity is written in the form now; the fields of each trainee when the copies are printed
        Integer minutes = (Integer) def.get("duration_minutes");
        List<String> topics = topicsOf(activity);
        String number = String.valueOf(activity.get("training_number"));
        String type = trainingTypeOf(activity);
        byte[] exam = TrainingAssessmentForm.build(template, new TrainingAssessmentForm.Content(items, checklist, false, topics, number, type, minutes));
        byte[] key = TrainingAssessmentForm.build(template, new TrainingAssessmentForm.Content(items, checklist, true, topics, number, type, minutes));
        String label = def.get("code") + " " + def.get("revision_number");
        String fileNumber = safe(number);
        putMaterial(actor, activityId, "EXAM", "APD.0009 - " + fileNumber + ".docx", exam, "Replaced by the assessment " + label + " of the library");
        putMaterial(actor, activityId, "ANSWER_KEY", "Answer key - " + fileNumber + ".docx", key, "Replaced by the assessment " + label + " of the library");
        String before = activity.get("assessment_def_code") == null ? null : activity.get("assessment_def_code") + " " + activity.get("assessment_def_revision");
        jdbc.update("update training_activities set assessment_def_id = ?, assessment_def_code = ?, assessment_def_version = ?, assessment_def_revision = ?, assessment_name = ?, assessment_kind = ?, assessment_max_score = ?, assessment_chosen_by = ?, assessment_chosen_at = now(), version = version + 1, updated_at = now() where id = ?",
                def.get("id"), def.get("code"), def.get("version_no"), def.get("revision_number"), def.get("name"), def.get("kind"), checklist ? null : total(items), actor.getId(), activityId);
        store.auditActivity(actor, activity, "TRAINING_ASSESSMENT_CHOSEN", before, label, def.get("name") + ": " + items.size() + " item(s)" + (checklist ? ", no score" : ", total " + total(items) + " point(s)")
                + ", written into the form APD.0009 as the exam file and the answer key");
    }

    /** Takes the choice off: the two files that were made from the assessment are marked removed (they stay on record); the organizer may then write or upload another. */
    @Transactional
    public void clear(UserAccount actor, UUID activityId) {
        Map<String, Object> activity = lockedForContent(actor, activityId);
        if (activity.get("assessment_def_id") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSESSMENT_NOT_CHOSEN");
        String label = activity.get("assessment_def_code") + " " + activity.get("assessment_def_revision");
        jdbc.update("update training_materials set removed_at = now(), removed_by = ?, remove_reason = ? where activity_id = ? and purpose in ('EXAM', 'ANSWER_KEY') and removed_at is null",
                actor.getId(), "The assessment " + label + " of the library was taken off", activityId);
        jdbc.update("update training_activities set assessment_def_id = null, assessment_def_code = null, assessment_def_version = null, assessment_def_revision = null, assessment_name = null, assessment_kind = null, assessment_max_score = null, assessment_chosen_by = null, assessment_chosen_at = null, version = version + 1, updated_at = now() where id = ?", activityId);
        store.auditActivity(actor, activity, "TRAINING_ASSESSMENT_REMOVED", label, null, "The exam file and the answer key made from it were removed from the activity");
    }
}

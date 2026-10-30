package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The test of APD.0009 taken in the system (SOP.0003 5.1.2 and 5.3.7). The trainer writes the questions with the training content; they are reviewed and approved with it and cannot change after.
 * A trainee the trainer has marked present opens the test, answers, and signs. The server grades it against the key it keeps (the key never leaves the server for a trainee) and writes the result
 * through the same assessment table as a result typed by a person, with the pass mark of the settings. A question is right only when exactly the right options are chosen.
 */
@Service
public class TrainingExamService {
    private static final int MAX_QUESTIONS = 100;
    private static final int GRACE_SECONDS = 60;
    private static final String TYPE = "TRAINING_EXAM_ATTEMPT";
    private static final List<String> LETTERS = List.of("A", "B", "C", "D", "E", "F", "G", "H");

    public record OptionDto(String id, String text) {}
    /** {@code image}: a picture under the text of the question, as a data URL (PNG or JPEG), like a question of the assessment library. */
    public record QuestionDto(String kind, String prompt, List<OptionDto> options, List<String> correct, BigDecimal points, String image) {}
    public record SaveRequest(Integer minutes, List<QuestionDto> questions) {}
    public record SubmitRequest(Map<String, List<String>> answers, String signatureToken) {}
    public record ResetRequest(String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingSettingsService settings;
    private final ElectronicSignatureService signatures;
    private final ObjectMapper json;
    private final TrainingSuspensionService suspensions;

    public TrainingExamService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingSettingsService settings, ElectronicSignatureService signatures, ObjectMapper json, TrainingSuspensionService suspensions) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.settings = settings;
        this.signatures = signatures;
        this.json = json;
        this.suspensions = suspensions;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ writing the questions

    private Map<String, Object> activityOf(UUID id) {
        return store.activity(id).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private boolean confirmed(UUID activityId) {
        Integer n = jdbc.queryForObject("select count(*) from training_active_confirmations where activity_id = ? and kind in ('CONTENT_REVIEWED','CONTENT_APPROVED')", Integer.class, activityId);
        return n != null && n > 0;
    }

    private boolean assignedReviewer(UserAccount actor, UUID activityId) {
        Integer n = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type = 'TRAINING_ACTIVITY' and object_id = ? and assignee_user_id = ? and step_code in ('CONTENT_REVIEW','CONTENT_APPROVE')",
                Integer.class, activityId, actor.getId());
        return n != null && n > 0;
    }

    /** The test as the people who prepare and approve it see it: with the key. Nobody else, and no trainee, gets this. */
    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID activityId) {
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct", "training.content.review", "training.content.approve");
        Map<String, Object> activity = activityOf(activityId);
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        boolean manager = access.has(actor, "training.activity.organize");
        boolean keyViewer = manager || assignedReviewer(actor, activityId);
        List<Map<String, Object>> questions = new ArrayList<>();
        for (Map<String, Object> q : jdbc.queryForList("select id, q_no, kind, prompt, options::text as options, correct::text as correct, points, image from training_exam_questions where activity_id = ? order by q_no", activityId)) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", q.get("id"));
            entry.put("qNo", q.get("q_no"));
            entry.put("kind", q.get("kind"));
            entry.put("prompt", q.get("prompt"));
            entry.put("options", read(q.get("options"), new TypeReference<List<Map<String, String>>>() {}));
            entry.put("points", q.get("points"));
            if (q.get("image") != null) entry.put("image", q.get("image"));
            if (keyViewer) entry.put("correct", read(q.get("correct"), new TypeReference<List<String>>() {}));
            questions.add(entry);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minutes", activity.get("exam_minutes"));
        out.put("questions", questions);
        out.put("canSeeKey", keyViewer);
        out.put("canEdit", manager && Set.of("PLANNED", "RESERVED").contains(String.valueOf(activity.get("status"))) && !confirmed(activityId));
        return out;
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, UUID activityId, SaveRequest request) {
        access.require(actor, "training.activity.organize");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!Set.of("PLANNED", "RESERVED").contains(String.valueOf(activity.get("status"))) || confirmed(activityId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_LOCKED");
        if (request == null || request.questions() == null || request.questions().size() > MAX_QUESTIONS) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
        Integer minutes = request.minutes();
        if (minutes != null && (minutes < 1 || minutes > 480)) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
        List<Object[]> rows = new ArrayList<>();
        int no = 0;
        for (QuestionDto q : request.questions()) {
            no++;
            if (q == null || q.kind() == null || q.prompt() == null || q.prompt().isBlank() || q.prompt().length() > 2000) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
            BigDecimal points = q.points() == null ? BigDecimal.ONE : q.points();
            if (points.signum() <= 0 || points.compareTo(BigDecimal.valueOf(100)) > 0) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
            String image;
            try {
                image = TrainingAssessmentLibraryService.checkedImage(q.kind(), q.image());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("TRAINING_ASSESSMENT_IMAGE_INVALID");
            }
            List<Map<String, String>> options = new ArrayList<>();
            List<String> correct = q.correct() == null ? List.of() : q.correct();
            switch (q.kind()) {
                case "TRUE_FALSE" -> {
                    options.add(Map.of("id", "A", "text", "True"));
                    options.add(Map.of("id", "B", "text", "False"));
                    if (correct.size() != 1 || !Set.of("A", "B").contains(correct.get(0))) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
                }
                case "SINGLE", "MULTI" -> {
                    int n = q.options() == null ? 0 : q.options().size();
                    if (n < 2 || n > ("SINGLE".equals(q.kind()) ? 6 : 8)) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
                    for (int i = 0; i < n; i++) {
                        String text = q.options().get(i) == null ? null : q.options().get(i).text();
                        if (text == null || text.isBlank() || text.length() > 500) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
                        options.add(Map.of("id", LETTERS.get(i), "text", text.trim()));
                    }
                    Set<String> ids = new HashSet<>();
                    options.forEach(o -> ids.add(o.get("id")));
                    if (correct.isEmpty() || !ids.containsAll(correct) || new HashSet<>(correct).size() != correct.size()) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
                    if ("SINGLE".equals(q.kind()) && correct.size() != 1) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
                    if ("MULTI".equals(q.kind()) && correct.size() == options.size()) throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
                }
                default -> throw new IllegalArgumentException("TRAINING_EXAM_INVALID");
            }
            rows.add(new Object[]{no, q.kind(), q.prompt().trim(), write(options), write(correct), points, image});
        }
        jdbc.update("delete from training_exam_questions where activity_id = ?", activityId);
        for (Object[] r : rows) {
            jdbc.update("insert into training_exam_questions(id, activity_id, q_no, kind, prompt, options, correct, points, created_by, image) values (?,?,?,?,?,cast(? as jsonb),cast(? as jsonb),?,?,?)",
                    UUID.randomUUID(), activityId, r[0], r[1], r[2], r[3], r[4], r[5], actor.getId(), r[6]);
        }
        jdbc.update("update training_activities set exam_minutes = ?, version = version + 1, updated_at = now() where id = ?", minutes, activityId);
        store.auditActivity(actor, activity, "TRAINING_EXAM_SAVED", null, null, rows.size() + " question(s)" + (minutes == null ? "" : ", " + minutes + " minutes"));
        return get(actor, activityId);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ taking the test

    private Map<String, Object> participantOf(UserAccount actor, UUID participantId) {
        Map<String, Object> p = jdbc.queryForList("""
            select p.*, s.assessment_method, s.status as session_status, s.held_on as session_held_on, a.status as activity_status from training_participants p join training_sessions s on s.id = p.session_id
              join training_activities a on a.id = p.activity_id where p.id = ?
            """, participantId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!actor.getId().equals(p.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        return p;
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    /** The trainee opens the test, or goes on with the one already open. A trainee who has been marked present and has no result yet may start; a second attempt needs the trainer to release it. */
    @Transactional
    public Map<String, Object> start(UserAccount actor, UUID participantId) {
        Map<String, Object> p = participantOf(actor, participantId);
        UUID activityId = (UUID) p.get("activity_id");
        Map<String, Object> open = jdbc.queryForList("select * from training_exam_attempts where participant_id = ? and status = 'IN_PROGRESS' for update", participantId).stream().findFirst().orElse(null);
        if (open != null) {
            Timestamp due = (Timestamp) open.get("due_at");
            if (due != null && Instant.now().isAfter(due.toInstant().plusSeconds(GRACE_SECONDS))) {
                jdbc.update("update training_exam_attempts set status = 'EXPIRED' where id = ?", open.get("id"));
                throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_EXPIRED");
            }
            return view(open, activityId);
        }
        if (!"IN_PROGRESS".equals(p.get("activity_status")) || !("PLANNED".equals(p.get("session_status")) && p.get("session_held_on") != null) || !"TEST".equals(p.get("assessment_method"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        if (!Set.of("ATTENDED", "ONLINE").contains(String.valueOf(p.get("state"))) || !"PENDING".equals(p.get("result"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        if (count("select count(*) from training_exam_questions where activity_id = ?", activityId) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        int attempts = count("select count(*) from training_exam_attempts where participant_id = ?", participantId);
        int releases = count("select count(*) from training_exam_resets where participant_id = ?", participantId);
        if (attempts > releases) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_ATTEMPT_USED");
        Integer minutes = jdbc.queryForObject("select exam_minutes from training_activities where id = ?", Integer.class, activityId);
        UUID id = UUID.randomUUID();
        jdbc.update("insert into training_exam_attempts(id, participant_id, attempt_no, due_at) values (?,?,?, case when ?::int is null then null else now() + (?::int * interval '1 minute') end)", id, participantId, attempts + 1, minutes, minutes);
        store.auditActivity(actor, activityOf(activityId), "TRAINING_EXAM_STARTED", null, null, "Attempt " + (attempts + 1) + " of " + p.get("full_name"));
        return view(jdbc.queryForMap("select * from training_exam_attempts where id = ?", id), activityId);
    }

    /** The questions without the key. */
    private Map<String, Object> view(Map<String, Object> attempt, UUID activityId) {
        List<Map<String, Object>> questions = new ArrayList<>();
        for (Map<String, Object> q : jdbc.queryForList("select id, q_no, kind, prompt, options::text as options, points, image from training_exam_questions where activity_id = ? order by q_no", activityId)) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id", q.get("id"));
            e.put("qNo", q.get("q_no"));
            e.put("kind", q.get("kind"));
            e.put("prompt", q.get("prompt"));
            e.put("options", read(q.get("options"), new TypeReference<List<Map<String, String>>>() {}));
            e.put("points", q.get("points"));
            if (q.get("image") != null) e.put("image", q.get("image"));
            questions.add(e);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("attemptId", attempt.get("id"));
        out.put("attemptNo", attempt.get("attempt_no"));
        out.put("status", attempt.get("status"));
        out.put("startedAt", attempt.get("started_at") == null ? null : ((Timestamp) attempt.get("started_at")).toInstant().toString());
        out.put("dueAt", attempt.get("due_at") == null ? null : ((Timestamp) attempt.get("due_at")).toInstant().toString());
        out.put("questions", questions);
        return out;
    }

    /** What the trainee sees about the test: open (with the questions), or the result. Never the key. */
    @Transactional(readOnly = true)
    public Map<String, Object> mine(UserAccount actor, UUID participantId) {
        Map<String, Object> p = participantOf(actor, participantId);
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> last = jdbc.queryForList("select * from training_exam_attempts where participant_id = ? order by attempt_no desc limit 1", participantId).stream().findFirst().orElse(null);
        out.put("result", p.get("result"));
        // An open attempt whose time has run out is shown as expired; nothing is changed by looking.
        boolean overdue = last != null && "IN_PROGRESS".equals(last.get("status")) && last.get("due_at") != null && Instant.now().isAfter(((Timestamp) last.get("due_at")).toInstant().plusSeconds(GRACE_SECONDS));
        if (overdue) {
            Map<String, Object> shown = new LinkedHashMap<>(summary(last));
            shown.put("status", "EXPIRED");
            out.put("attempt", shown);
            out.put("canStart", false);
            return out;
        }
        out.put("attempt", last == null ? null : "IN_PROGRESS".equals(last.get("status")) ? view(last, (UUID) p.get("activity_id")) : summary(last));
        out.put("canStart", last == null ? examReady(p) : "EXPIRED".equals(last.get("status")) && examReady(p) && count("select count(*) from training_exam_attempts where participant_id = ?", participantId) <= count("select count(*) from training_exam_resets where participant_id = ?", participantId));
        return out;
    }

    private boolean examReady(Map<String, Object> p) {
        return "IN_PROGRESS".equals(p.get("activity_status")) && "PLANNED".equals(p.get("session_status")) && p.get("session_held_on") != null && "TEST".equals(p.get("assessment_method")) && Set.of("ATTENDED", "ONLINE").contains(String.valueOf(p.get("state")))
                && "PENDING".equals(p.get("result")) && count("select count(*) from training_exam_questions where activity_id = ?", p.get("activity_id")) > 0;
    }

    private Map<String, Object> summary(Map<String, Object> a) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("attemptId", a.get("id"));
        out.put("attemptNo", a.get("attempt_no"));
        out.put("status", a.get("status"));
        out.put("scoreObtained", a.get("score_obtained"));
        out.put("scoreMax", a.get("score_max"));
        out.put("percent", a.get("percent"));
        out.put("submittedAt", a.get("submitted_at") == null ? null : ((Timestamp) a.get("submitted_at")).toInstant().toString());
        return out;
    }

    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID attemptId, SubmitRequest request) {
        Map<String, Object> attempt = jdbc.queryForList("select * from training_exam_attempts where id = ? for update", attemptId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID participantId = (UUID) attempt.get("participant_id");
        Map<String, Object> p = participantOf(actor, participantId);
        UUID activityId = (UUID) p.get("activity_id");
        if (!"IN_PROGRESS".equals(attempt.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        Timestamp due = (Timestamp) attempt.get("due_at");
        if (due != null && Instant.now().isAfter(due.toInstant().plusSeconds(GRACE_SECONDS))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_EXPIRED");
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        Map<String, List<String>> answers = request.answers() == null ? Map.of() : request.answers();

        BigDecimal got = BigDecimal.ZERO, max = BigDecimal.ZERO;
        for (Map<String, Object> q : jdbc.queryForList("select id, kind, options::text as options, correct::text as correct, points from training_exam_questions where activity_id = ? order by q_no", activityId)) {
            BigDecimal points = (BigDecimal) q.get("points");
            max = max.add(points);
            List<Map<String, String>> options = read(q.get("options"), new TypeReference<List<Map<String, String>>>() {});
            Set<String> valid = new HashSet<>();
            options.forEach(o -> valid.add(o.get("id")));
            Set<String> picked = new HashSet<>(answers.getOrDefault(String.valueOf(q.get("id")), List.of()));
            if (!valid.containsAll(picked) || (!"MULTI".equals(q.get("kind")) && picked.size() > 1)) throw new IllegalArgumentException("TRAINING_EXAM_ANSWER_INVALID");
            if (picked.equals(new HashSet<>(read(q.get("correct"), new TypeReference<List<String>>() {})))) got = got.add(points);
        }
        if (max.signum() <= 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        int pass = settings.passPercent();
        BigDecimal percent = got.multiply(BigDecimal.valueOf(100)).divide(max, 2, RoundingMode.HALF_UP);
        String result = percent.compareTo(BigDecimal.valueOf(pass)) >= 0 ? "PASSED" : "FAILED";
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"IN_PROGRESS".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");

        UUID signature = signatures.createEntitySignature(TYPE, attemptId, activity.get("training_number") + " test, attempt " + attempt.get("attempt_no"), actor, request.signatureToken(), "TRAINING_ASSESSMENT_SIGNED",
                "The trainee signs the completed test", null, null, null).getId();
        UUID assessmentId = UUID.randomUUID();
        int no = count("select coalesce(max(attempt_no), 0) + 1 from training_assessments where participant_id = ?", participantId);
        jdbc.update("""
            insert into training_assessments(id, participant_id, attempt_no, method, score_obtained, score_max, percent, pass_percent_snapshot, result, assessed_by, trainee_signature_mode, remarks)
            values (?,?,?,'TEST',?,?,?,?,?,?,'ESIGN',?)
            """, assessmentId, participantId, no, got, max, percent, pass, result, actor.getId(), "Online test, attempt " + attempt.get("attempt_no") + ", graded by the system");
        jdbc.update("update training_participants set result = ?, version = version + 1 where id = ?", result, participantId);
        if ("FAILED".equals(result)) suspensions.raise(actor, activity, p, percent);
        else suspensions.clearOnPass(actor, activity, p);
        jdbc.update("update training_exam_attempts set status = 'SUBMITTED', submitted_at = now(), answers = cast(? as jsonb), score_obtained = ?, score_max = ?, percent = ?, assessment_id = ?, signature_id = ? where id = ?",
                write(answers), got, max, percent, assessmentId, signature, attemptId);
        store.auditActivity(actor, activity, "TRAINING_EXAM_SUBMITTED", null, result, p.get("full_name") + ": " + percent + "% (pass mark " + pass + "%), attempt " + attempt.get("attempt_no"));
        return mine(actor, participantId);
    }

    /** The trainer lets a trainee whose attempt ran out, or who could not finish, try again. The release is a record with its reason. */
    @Transactional
    public Map<String, Object> release(UserAccount actor, UUID participantId, ResetRequest request) {
        access.require(actor, "training.activity.conduct", "training.activity.organize");
        Map<String, Object> p = jdbc.queryForList("select p.*, a.status as activity_status, a.organizer_department_id from training_participants p join training_activities a on a.id = p.activity_id where p.id = ?", participantId)
                .stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) p.get("organizer_department_id"));
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (!"IN_PROGRESS".equals(p.get("activity_status")) || !"PENDING".equals(p.get("result"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        Map<String, Object> activity = store.activityForUpdate((UUID) p.get("activity_id")).orElseThrow();
        Map<String, Object> last = jdbc.queryForList("select * from training_exam_attempts where participant_id = ? order by attempt_no desc limit 1 for update", participantId).stream().findFirst().orElse(null);
        if (last == null || "SUBMITTED".equals(last.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_EXAM_NOT_AVAILABLE");
        if ("IN_PROGRESS".equals(last.get("status"))) jdbc.update("update training_exam_attempts set status = 'EXPIRED' where id = ?", last.get("id"));
        jdbc.update("insert into training_exam_resets(id, participant_id, reason, reset_by) values (?,?,?,?)", UUID.randomUUID(), participantId, request.reason().trim(), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_EXAM_RELEASED", null, null, p.get("full_name") + ": " + request.reason().trim());
        return Map.of("released", true);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ json

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private <T> T read(Object text, TypeReference<T> type) {
        try {
            return json.readValue(String.valueOf(text), type);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}

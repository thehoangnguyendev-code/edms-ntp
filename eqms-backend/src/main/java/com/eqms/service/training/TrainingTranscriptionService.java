package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Results written on paper, typed into the system (PLAN-TR-001 17.7, proposal D-51). One person types the lines with the scan attached; a different person checks
 * them against the scan and signs; only then are the lines applied as attendance and assessment, through the same rules as an entry made on the screen. The pass
 * mark is applied by the server, as always. What was typed cannot be changed; a wrong transcription is rejected and typed again.
 */
@Service
public class TrainingTranscriptionService {
    public static final String TYPE = "TRAINING_TRANSCRIPTION";
    private static final int MAX_LINES = 500;

    public record Line(UUID participantId, String state, String absenceReason, BigDecimal scoreObtained, BigDecimal scoreMax, String remarks) {}
    public record EnterRequest(UUID evidenceId, String idempotencyKey, String lateReason, List<Line> lines) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingActivityService activities;
    private final ElectronicSignatureService signatures;
    private final UserAccountRepository users;

    public TrainingTranscriptionService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingActivityService activities, ElectronicSignatureService signatures, UserAccountRepository users) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.activities = activities;
        this.signatures = signatures;
        this.users = users;
    }

    private Map<String, Object> sessionOf(UUID sessionId) {
        return jdbc.queryForList("select s.*, a.organizer_department_id, a.status as activity_status from training_sessions s join training_activities a on a.id = s.activity_id where s.id = ?", sessionId)
                .stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(UserAccount actor, UUID activityId) {
        access.require(actor, "training.activity.view", "training.activity.organize", "training.activity.conduct", "training.paper.verify");
        access.requireScope(actor, jdbc.queryForObject("select organizer_department_id from training_activities where id = ?", UUID.class, activityId));
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select t.id, t.session_id, s.session_no, t.status, t.late_reason, t.reject_reason, t.entered_at, t.verified_at, e.original_name as evidence_name, t.evidence_id,
                   eu.full_name as entered_by_name, vu.full_name as verified_by_name, t.entered_by
              from training_transcriptions t join training_sessions s on s.id = t.session_id join training_paper_evidence e on e.id = t.evidence_id
              join app_users eu on eu.id = t.entered_by left join app_users vu on vu.id = t.verified_by
             where t.activity_id = ? order by s.session_no, t.entered_at desc
            """, activityId));
        for (Map<String, Object> row : rows) {
            row.put("lines", TrainingRows.camel(jdbc.queryForList("""
                select l.participant_id, p.full_name, l.state, l.absence_reason, l.score_obtained, l.score_max, l.remarks
                  from training_transcription_lines l join training_participants p on p.id = l.participant_id where l.transcription_id = ? order by p.full_name
                """, row.get("id"))));
        }
        return rows;
    }

    @Transactional
    public Map<String, Object> enter(UserAccount actor, UUID sessionId, EnterRequest request) {
        access.require(actor, "training.paper.transcribe");
        // The lines are applied as this person, so this person must be allowed to record what the lines hold.
        access.require(actor, "training.activity.conduct", "training.activity.organize");
        Map<String, Object> session = sessionOf(sessionId);
        UUID activityId = (UUID) session.get("activity_id");
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (request == null || request.idempotencyKey() == null || request.idempotencyKey().isBlank() || request.idempotencyKey().length() > 80) throw new IllegalArgumentException("TRAINING_IDEMPOTENCY_REQUIRED");
        // The same request sent twice (a double click, a retry after a lost answer) gives back the first result, not a second record.
        List<Map<String, Object>> again = jdbc.queryForList("select id from training_transcriptions where session_id = ? and idempotency_key = ?", sessionId, request.idempotencyKey());
        if (!again.isEmpty()) return one(actor, activityId, (UUID) again.get(0).get("id"));

        if (!"IN_PROGRESS".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRANSCRIPTION_STATUS");
        if (!"HELD".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_HELD");
        if ("ELECTRONIC".equals(session.get("delivery_mode"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PAPER_NOT_PAPER");
        if (request.evidenceId() == null) throw new IllegalArgumentException("TRAINING_SCAN_REQUIRED");
        Integer scan = jdbc.queryForObject("select count(*) from training_paper_evidence where id = ? and activity_id = ? and kind in ('ATTENDANCE_SHEET','ASSESSMENT')", Integer.class, request.evidenceId(), activityId);
        if (scan == null || scan == 0) throw new IllegalArgumentException("TRAINING_SCAN_REQUIRED");
        Integer open = jdbc.queryForObject("select count(*) from training_transcriptions where session_id = ? and status = 'ENTERED'", Integer.class, sessionId);
        if (open != null && open > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRANSCRIPTION_OPEN");

        String late = request.lateReason() == null ? "" : request.lateReason().trim();
        if (isLate(session) && late.isEmpty()) throw new IllegalArgumentException("TRAINING_LATE_REASON_REQUIRED");
        List<Line> lines = request.lines() == null ? List.of() : request.lines();
        if (lines.isEmpty() || lines.size() > MAX_LINES) throw new IllegalArgumentException("TRAINING_TRANSCRIPTION_LINES_INVALID");
        Set<UUID> seen = new HashSet<>();
        boolean scored = session.get("assessment_method") != null && !"SELF_READING_CONFIRMATION".equals(session.get("assessment_method"));
        for (Line line : lines) {
            if (line.participantId() == null || !seen.add(line.participantId())) throw new IllegalArgumentException("TRAINING_TRANSCRIPTION_LINES_INVALID");
            Map<String, Object> p = jdbc.queryForList("select state, person_user_id from training_participants where id = ? and session_id = ?", line.participantId(), sessionId).stream().findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("TRAINING_TRANSCRIPTION_LINES_INVALID"));
            // What is already recorded (on the screen, or by an earlier transcription) is not typed again.
            if (!"INVITED".equals(p.get("state"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRANSCRIPTION_ALREADY_RECORDED");
            if (p.get("person_user_id") != null && p.get("person_user_id").equals(actor.getId())) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
            if (line.state() == null || !Set.of("ATTENDED", "ABSENT").contains(line.state())) throw new IllegalArgumentException("TRAINING_ATTENDANCE_INVALID");
            if ("ABSENT".equals(line.state())) {
                if (line.absenceReason() == null || line.absenceReason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
                if (line.scoreObtained() != null || line.scoreMax() != null) throw new IllegalArgumentException("TRAINING_SCORE_INVALID");
            } else if (scored) {
                BigDecimal got = line.scoreObtained(), max = line.scoreMax();
                if (got == null || max == null || max.signum() <= 0 || got.signum() < 0 || got.compareTo(max) > 0) throw new IllegalArgumentException("TRAINING_SCORE_INVALID");
            } else if (line.scoreObtained() != null || line.scoreMax() != null) {
                throw new IllegalArgumentException("TRAINING_SCORE_INVALID");
            }
        }
        boolean anyScore = lines.stream().anyMatch(l -> l.scoreObtained() != null);
        if (anyScore) access.require(actor, "training.assessment.record");
        UUID id = UUID.randomUUID();
        jdbc.update("insert into training_transcriptions(id, activity_id, session_id, evidence_id, idempotency_key, late_reason, entered_by) values (?,?,?,?,?,?,?)",
                id, activityId, sessionId, request.evidenceId(), request.idempotencyKey(), late.isEmpty() ? null : late, actor.getId());
        for (Line line : lines) {
            jdbc.update("insert into training_transcription_lines(transcription_id, participant_id, state, absence_reason, score_obtained, score_max, remarks) values (?,?,?,?,?,?,?)",
                    id, line.participantId(), line.state(), "ABSENT".equals(line.state()) ? line.absenceReason().trim() : null, line.scoreObtained(), line.scoreMax(), blank(line.remarks()));
        }
        store.auditActivity(actor, activity, "TRAINING_TRANSCRIPTION_ENTERED", null, "ENTERED", "Session S" + session.get("session_no") + ", " + lines.size() + " line(s)" + (late.isEmpty() ? "" : ". Late: " + late));
        return one(actor, activityId, id);
    }

    @Transactional
    public Map<String, Object> verify(UserAccount actor, UUID id, String signatureToken) {
        Map<String, Object> t = lock(id);
        Map<String, Object> activity = decideChecks(actor, t);
        if (signatureToken == null || signatureToken.isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UserAccount enterer = users.findById((UUID) t.get("entered_by")).orElseThrow(() -> new IllegalStateException("TRAINING_TRANSCRIPTION_ENTERER_MISSING"));
        UUID signature = signatures.createEntitySignature(TYPE, id, activity.get("training_number") + " transcription", actor, signatureToken, "TRAINING_TRANSCRIPTION_VERIFIED",
                "Typed lines checked against the scan", null, null, null).getId();
        String note = "Transcribed from paper (scan " + t.get("evidence_id") + "), verified by " + actor.getFullName();
        // The lines are applied as the person who typed them, through the rules of the screen; this fails as a whole if any rule refuses a line.
        for (Map<String, Object> line : jdbc.queryForList("select * from training_transcription_lines where transcription_id = ? order by participant_id", id)) {
            UUID participantId = (UUID) line.get("participant_id");
            boolean absent = "ABSENT".equals(line.get("state"));
            activities.recordAttendance(enterer, participantId, new TrainingActivityService.AttendanceRequest(absent ? "ABSENT" : "ATTENDED", absent ? (String) line.get("absence_reason") : null));
            if (!absent && line.get("score_obtained") != null) {
                activities.recordAssessment(enterer, participantId, new TrainingActivityService.AssessmentRequest((BigDecimal) line.get("score_obtained"), (BigDecimal) line.get("score_max"),
                        line.get("remarks") == null ? note : line.get("remarks") + ". " + note));
            }
        }
        jdbc.update("update training_transcriptions set status='VERIFIED', verified_by=?, verified_at=now(), signature_id=? where id=?", actor.getId(), signature, id);
        store.auditActivity(actor, activity, "TRAINING_TRANSCRIPTION_VERIFIED", "ENTERED", "VERIFIED", "Entered by " + enterer.getFullName());
        return one(actor, (UUID) t.get("activity_id"), id);
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID id, String reason) {
        Map<String, Object> t = lock(id);
        Map<String, Object> activity = decideChecks(actor, t);
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_transcriptions set status='REJECTED', verified_by=?, verified_at=now(), reject_reason=? where id=?", actor.getId(), reason.trim(), id);
        store.auditActivity(actor, activity, "TRAINING_TRANSCRIPTION_REJECTED", "ENTERED", "REJECTED", reason.trim());
        return one(actor, (UUID) t.get("activity_id"), id);
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_transcriptions where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    /** The second person: permission and scope, an open activity, a transcription still waiting, and never the person who typed it. */
    private Map<String, Object> decideChecks(UserAccount actor, Map<String, Object> t) {
        access.require(actor, "training.paper.verify");
        UUID activityId = (UUID) t.get("activity_id");
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (actor.getId().equals(t.get("entered_by"))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        if (!"ENTERED".equals(t.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRANSCRIPTION_DECIDED");
        if (!"IN_PROGRESS".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRANSCRIPTION_STATUS");
        return activity;
    }

    private Map<String, Object> one(UserAccount actor, UUID activityId, UUID id) {
        return list(actor, activityId).stream().filter(r -> id.equals(r.get("id"))).findFirst().orElseThrow();
    }

    /** More than one day after the session was held, counted in calendar days: the SOP does not define working days, so a late typing only needs a reason. */
    private boolean isLate(Map<String, Object> session) {
        Object held = session.get("held_on");
        if (held == null) return false;
        return java.time.temporal.ChronoUnit.DAYS.between(((java.sql.Date) held).toLocalDate(), LocalDate.now(TrainingNumberService.ZONE)) > 1;
    }

    private static String blank(String v) { return v == null || v.isBlank() ? null : v.trim(); }
}

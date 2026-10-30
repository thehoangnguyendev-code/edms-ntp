package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Self check-in (PLAN-TR-001 17.7): the trainer opens a check-in for a held session; the screen shows a six-digit code that changes every few minutes; each invited person
 * enters it while signed in, and the row is marked ATTENDED with the sign mode SELF (no further signature: the person is identified by the session, the code proves the room, and the Audit Trail keeps who and when). The quick roll-call stays for people who cannot use a device. Only people still invited can check in,
 * only on the day of the session, and the trainer or organizer opens and closes the door.
 */
@Service
public class TrainingCheckInService {
    static final int CODE_SECONDS = 300;
    static final int GRACE_SECONDS = 60;
    private static final SecureRandom RANDOM = new SecureRandom();

    public record CheckInRequest(String code, String signatureToken) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingActivityService activities;
    private final ElectronicSignatureService signatures;

    public TrainingCheckInService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingActivityService activities, ElectronicSignatureService signatures) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.activities = activities;
        this.signatures = signatures;
    }

    private static String newCode() { return String.format("%06d", RANDOM.nextInt(1_000_000)); }

    private Map<String, Object> sessionForConductor(UserAccount actor, UUID sessionId) {
        access.require(actor, "training.activity.conduct");
        Map<String, Object> session = jdbc.queryForList("select s.*, a.organizer_department_id from training_sessions s join training_activities a on a.id = s.activity_id where s.id = ?", sessionId)
                .stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        return session;
    }

    @Transactional
    public Map<String, Object> open(UserAccount actor, UUID sessionId) {
        sessionForConductor(actor, sessionId);
        activities.startSession(actor, sessionId);
        Map<String, Object> session = sessionForConductor(actor, sessionId);
        Map<String, Object> activity = store.activityForUpdate((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"IN_PROGRESS".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CHECKIN_STATUS");
        if (!TrainingSessionState.started(session)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_HELD");
        jdbc.update("""
            insert into training_session_checkins(session_id, opened_by, code) values (?,?,?)
            on conflict (session_id) do update set opened_by = excluded.opened_by, opened_at = now(), closed_at = null, closed_by = null, code = excluded.code, previous_code = null, code_issued_at = now()
            """, sessionId, actor.getId(), newCode());
        store.auditActivity(actor, activity, "TRAINING_CHECKIN_OPENED", null, "S" + session.get("session_no"), null);
        return status(actor, sessionId);
    }

    @Transactional
    public Map<String, Object> close(UserAccount actor, UUID sessionId) {
        Map<String, Object> session = sessionForConductor(actor, sessionId);
        Map<String, Object> activity = store.activityForUpdate((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        int n = jdbc.update("update training_session_checkins set closed_at = now(), closed_by = ? where session_id = ? and closed_at is null", actor.getId(), sessionId);
        if (n > 0) store.auditActivity(actor, activity, "TRAINING_CHECKIN_CLOSED", null, "S" + session.get("session_no"), null);
        return status(actor, sessionId);
    }

    /** The trainer screen polls this; the code is renewed here when its time is over, so a code seen on a photo soon stops working. */
    @Transactional
    public Map<String, Object> status(UserAccount actor, UUID sessionId) {
        sessionForConductor(actor, sessionId);
        jdbc.update("update training_session_checkins set previous_code = code, code = ?, code_issued_at = now() where session_id = ? and closed_at is null and code_issued_at < now() - make_interval(secs => ?)",
                newCode(), sessionId, CODE_SECONDS);
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> row = jdbc.queryForList("select * from training_session_checkins where session_id = ?", sessionId).stream().findFirst().orElse(null);
        boolean open = row != null && row.get("closed_at") == null;
        out.put("open", open);
        if (open) {
            out.put("code", row.get("code"));
            Long left = jdbc.queryForObject("select greatest(0, ? - extract(epoch from now() - code_issued_at))::bigint from training_session_checkins where session_id = ?", Long.class, CODE_SECONDS, sessionId);
            out.put("secondsLeft", left);
        }
        out.put("invited", jdbc.queryForObject("select count(*) from training_participants where session_id = ? and state = 'INVITED'", Integer.class, sessionId));
        out.put("checkedIn", jdbc.queryForObject("select count(*) from training_participants where session_id = ? and sign_mode = 'SELF'", Integer.class, sessionId));
        return out;
    }

    @Transactional
    public Map<String, Object> checkIn(UserAccount actor, CheckInRequest request) {
        access.require(actor, "training.self.view");
        if (request == null || request.code() == null || !request.code().matches("\\d{6}")) throw new IllegalArgumentException("TRAINING_CHECKIN_CODE_INVALID");
        // Only sessions where this person is still invited can match, so a code of another room never shows that it exists.
        Map<String, Object> hit = jdbc.queryForList("""
            select p.id as participant_id, p.session_id, p.activity_id, p.participation_role, s.session_no, s.scheduled_on, s.status as session_status, s.held_on as session_held_on
            from training_participants p
            join training_sessions s on s.id = p.session_id
            join training_session_checkins c on c.session_id = p.session_id and c.closed_at is null
            where p.person_user_id = ? and p.state = 'INVITED' and p.participation_role <> 'NAME_ONLY'
              and (c.code = ? or (c.previous_code = ? and c.code_issued_at > now() - make_interval(secs => ?)))
            order by s.scheduled_on desc nulls last limit 1
            """, actor.getId(), request.code(), request.code(), GRACE_SECONDS).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("TRAINING_CHECKIN_CODE_INVALID"));
        Map<String, Object> activity = store.activityForUpdate((UUID) hit.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"IN_PROGRESS".equals(activity.get("status")) || !"PLANNED".equals(hit.get("session_status")) || hit.get("session_held_on") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CHECKIN_STATUS");
        Object on = hit.get("scheduled_on");
        if (on != null && !LocalDate.now().equals(((java.sql.Date) on).toLocalDate())) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CHECKIN_NOT_TODAY");
        // The row is locked while it changes, so two taps on the same phone record once.
        UUID participantId = (UUID) hit.get("participant_id");
        Integer still = jdbc.queryForObject("select count(*) from (select 1 from training_participants where id = ? and state = 'INVITED' for update) x", Integer.class, participantId);
        if (still == null || still == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CHECKIN_ALREADY");
        // A person who only attends, or is the trainer, takes no assessment: the signed check-in is all that is asked of them (a person who is only listed does not check in at all).
        String result = "EXTERNAL".equals(activity.get("kind")) || !"TRAINEE".equals(hit.get("participation_role")) ? "PASSED" : "PENDING";
        // The trainee signs the attendance (SOP.0003 5.3.7: the signature of the trainee in the list): the person is signed in, and confirms with the password.
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID signature = signatures.createEntitySignature("TRAINING_ACTIVITY", (UUID) hit.get("activity_id"), String.valueOf(activity.get("training_number")), actor, request.signatureToken(),
                "TRAINING_ATTENDED", "Trainee confirms attending session " + hit.get("session_no") + " by the check-in code", null, null, null).getId();
        jdbc.update("update training_participants set state = 'ATTENDED', result = ?, sign_mode = 'SELF', attend_signature_id = ?, version = version + 1 where id = ?", result, signature, participantId);
        store.auditActivity(actor, activity, "TRAINING_ATTENDANCE_SELF_CONFIRMED", "INVITED", "ATTENDED", "S" + hit.get("session_no"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("activityId", hit.get("activity_id"));
        out.put("trainingNumber", activity.get("training_number"));
        out.put("sessionNo", hit.get("session_no"));
        return out;
    }
}

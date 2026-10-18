package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A quick roll-call for a whole session (PLAN-TR-001 17.7): the trainer marks who is present and who is absent and signs once. Each row is recorded through the
 * same attendance rule as a single entry, then carries the sign mode TRAINER_ATTESTED, so the record shows that the trainer, not the trainee, vouches for it.
 * Only people still invited are marked; what is already recorded is left alone.
 */
@Service
public class TrainingRollCallService {
    public static final String TYPE = "TRAINING_ROLL_CALL";
    private static final int MAX_LINES = 500;

    public record Absent(UUID participantId, String reason) {}
    public record Request(List<UUID> present, List<Absent> absent, String signatureToken) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingActivityService activities;
    private final ElectronicSignatureService signatures;

    public TrainingRollCallService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingActivityService activities, ElectronicSignatureService signatures) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.activities = activities;
        this.signatures = signatures;
    }

    @Transactional
    public Map<String, Object> rollCall(UserAccount actor, UUID sessionId, Request request) {
        access.require(actor, "training.activity.conduct");
        Map<String, Object> session = jdbc.queryForList("select s.*, a.organizer_department_id from training_sessions s join training_activities a on a.id = s.activity_id where s.id = ?", sessionId)
                .stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) session.get("activity_id");
        access.requireScope(actor, (UUID) session.get("organizer_department_id"));
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"IN_PROGRESS".equals(activity.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ROLL_CALL_STATUS");
        if (!"HELD".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_HELD");
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        List<UUID> present = request.present() == null ? List.of() : request.present();
        List<Absent> absent = request.absent() == null ? List.of() : request.absent();
        if (present.size() + absent.size() == 0 || present.size() + absent.size() > MAX_LINES) throw new IllegalArgumentException("TRAINING_ROLL_CALL_LINES_INVALID");
        Set<UUID> seen = new HashSet<>();
        for (UUID id : present) if (id == null || !seen.add(id)) throw new IllegalArgumentException("TRAINING_ROLL_CALL_LINES_INVALID");
        for (Absent a : absent) {
            if (a.participantId() == null || !seen.add(a.participantId())) throw new IllegalArgumentException("TRAINING_ROLL_CALL_LINES_INVALID");
            if (a.reason() == null || a.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        }
        for (UUID id : seen) {
            Integer ok = jdbc.queryForObject("select count(*) from training_participants where id = ? and session_id = ? and state = 'INVITED'", Integer.class, id, sessionId);
            if (ok == null || ok == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ROLL_CALL_ALREADY_RECORDED");
        }
        UUID signature = signatures.createEntitySignature(TYPE, sessionId, activity.get("training_number") + " roll-call S" + session.get("session_no"), actor, request.signatureToken(),
                "TRAINING_ATTENDANCE_CONFIRMED", "Trainer attests the roll-call of the session", null, null, null).getId();
        // Each row goes through the rule of a single entry; any refusal (for example the trainer marking themselves) stops the whole roll-call.
        for (UUID id : present) activities.recordAttendance(actor, id, new TrainingActivityService.AttendanceRequest("ATTENDED", null));
        for (Absent a : absent) activities.recordAttendance(actor, a.participantId(), new TrainingActivityService.AttendanceRequest("ABSENT", a.reason().trim()));
        for (UUID id : seen) jdbc.update("update training_participants set sign_mode = 'TRAINER_ATTESTED', attend_signature_id = ? where id = ?", signature, id);
        store.auditActivity(actor, activity, "TRAINING_ROLL_CALL_ATTESTED", null, "S" + session.get("session_no"), present.size() + " present, " + absent.size() + " absent");
        return activities.get(actor, activityId);
    }
}

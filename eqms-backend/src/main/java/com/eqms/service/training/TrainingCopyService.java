package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
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
 * The log of the copies (SOP.0003 5.3.2 and 5.3.10, TR-43, proposal D-47): a copy of an approved training requirement, or of a job assignment in force, is sent to the departments
 * concerned and received there. Each sending and each receipt is a row that is not changed afterwards. The log records the fact; it does not hold the copy.
 */
@Service
public class TrainingCopyService {
    public static final String REQUIREMENT = "TRAINING_REQUIREMENT";
    public static final String JOB = "TRAINING_JOB_ASSIGNMENT";
    private static final int MAX_DEPARTMENTS = 30;

    public record SendRequest(List<UUID> departmentIds, String note) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingCopyService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    private record Subject(UUID department, String name, boolean sendable) {}

    private String viewPermission(String type) { return REQUIREMENT.equals(type) ? "training.requirement.view" : "training.job_assignment.view"; }

    private String sendPermission(String type) { return REQUIREMENT.equals(type) ? "training.requirement.prepare" : "training.job_assignment.manage"; }

    private Subject subject(String type, UUID id) {
        if (REQUIREMENT.equals(type)) {
            return jdbc.queryForList("select department_id, request_no, status from training_requirements where id = ?", id).stream().findFirst()
                    .map(r -> new Subject((UUID) r.get("department_id"), String.valueOf(r.get("request_no")), "APPROVED".equals(r.get("status")))).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        }
        if (JOB.equals(type)) {
            return jdbc.queryForList("select department_id, issue_no, status from training_job_assignments where id = ?", id).stream().findFirst()
                    .map(r -> new Subject((UUID) r.get("department_id"), "JA #" + r.get("issue_no"), "EFFECTIVE".equals(r.get("status")))).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        }
        throw new IllegalArgumentException("TRAINING_COPY_TYPE_INVALID");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String type, UUID id) {
        access.require(actor, viewPermission(type));
        Subject subject = subject(type, id);
        access.requireScope(actor, subject.department());
        UUID own = access.departmentOf(actor);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select c.id, c.recipient_department as department_id, d.name as department_name, c.sent_at, su.full_name as sent_by_name, c.note, c.received_at, ru.full_name as received_by_name
              from training_copy_distributions c join departments d on d.id = c.recipient_department join app_users su on su.id = c.sent_by left join app_users ru on ru.id = c.received_by
             where c.object_type = ? and c.object_id = ? order by d.name
            """, type, id));
        for (Map<String, Object> row : rows) row.put("canReceive", row.get("receivedAt") == null && own != null && own.equals(row.get("departmentId")));
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("rows", rows);
        out.put("canSend", subject.sendable() && access.has(actor, sendPermission(type)) && access.inScope(actor, subject.department()));
        return out;
    }

    /** The copies sent to the department of the person, newest first, with the ones still to be received. A person sees only the kinds of copy the person may read. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(UserAccount actor, String sortBy, String sortDirection) {
        access.require(actor, "training.requirement.view", "training.job_assignment.view");
        UUID own = access.departmentOf(actor);
        if (own == null) return List.of();
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select c.id, c.object_type, c.object_id, c.sent_at, c.note, c.received_at, su.full_name as sent_by_name, ru.full_name as received_by_name,
                   case c.object_type when 'TRAINING_REQUIREMENT' then rq.request_no else 'JA #' || ja.issue_no end as object_name, d.name as from_department
              from training_copy_distributions c join app_users su on su.id = c.sent_by left join app_users ru on ru.id = c.received_by
              left join training_requirements rq on c.object_type = 'TRAINING_REQUIREMENT' and rq.id = c.object_id
              left join training_job_assignments ja on c.object_type = 'TRAINING_JOB_ASSIGNMENT' and ja.id = c.object_id
              left join departments d on d.id = coalesce(rq.department_id, ja.department_id)
             where c.recipient_department = ?""" + TrainingRows.orderBy(sortBy, sortDirection, Map.of("type", "c.object_type", "reference", "object_name", "fromDepartment", "d.name", "sent", "c.sent_at", "note", "c.note", "state", "c.received_at"),
                "c.received_at is not null, c.sent_at desc") + " limit 200", own));
        rows.removeIf(r -> !access.has(actor, viewPermission(String.valueOf(r.get("objectType")))));
        for (Map<String, Object> row : rows) row.put("canReceive", row.get("receivedAt") == null);
        return rows;
    }

    @Transactional
    public Map<String, Object> send(UserAccount actor, String type, UUID id, SendRequest request) {
        access.require(actor, sendPermission(type));
        Subject subject = subject(type, id);
        access.requireScope(actor, subject.department());
        if (!subject.sendable()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_COPY_NOT_APPROVED");
        List<UUID> departments = request == null || request.departmentIds() == null ? List.of() : request.departmentIds();
        Set<UUID> unique = new HashSet<>(departments);
        if (unique.isEmpty() || unique.size() > MAX_DEPARTMENTS) throw new IllegalArgumentException("TRAINING_COPY_DEPARTMENTS_INVALID");
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        if (note != null && note.length() > 500) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        int sent = 0;
        for (UUID department : unique) {
            Integer exists = jdbc.queryForObject("select count(*) from departments where id = ?", Integer.class, department);
            if (exists == null || exists == 0) throw new IllegalArgumentException("TRAINING_COPY_DEPARTMENTS_INVALID");
            sent += jdbc.update("insert into training_copy_distributions(id, object_type, object_id, recipient_department, sent_by, note) values (?,?,?,?,?,?) on conflict do nothing",
                    UUID.randomUUID(), type, id, department, actor.getId(), note);
        }
        if (sent > 0) audit.logAs(actor, type, subject.name(), id, "TRAINING_COPY_SENT", null, null, sent + " department(s)" + (note == null ? "" : ". " + note));
        return list(actor, type, id);
    }

    @Transactional
    public Map<String, Object> receive(UserAccount actor, UUID copyId) {
        Map<String, Object> copy = jdbc.queryForList("select * from training_copy_distributions where id = ? for update", copyId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        String type = String.valueOf(copy.get("object_type"));
        UUID id = (UUID) copy.get("object_id");
        access.require(actor, viewPermission(type));
        // Only a person of the department the copy was sent to confirms that it arrived.
        UUID own = access.departmentOf(actor);
        if (own == null || !own.equals(copy.get("recipient_department"))) throw new SecurityException(TrainingAccess.DENIED);
        if (copy.get("received_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_COPY_ALREADY_RECEIVED");
        jdbc.update("update training_copy_distributions set received_by = ?, received_at = now() where id = ?", actor.getId(), copyId);
        audit.logAs(actor, type, subject(type, id).name(), id, "TRAINING_COPY_RECEIVED", null, null, "Department " + own);
        // The reader of a received copy sees the log of the object, so the scope check of list() would refuse a person of another department; answer with the row alone.
        return Map.of("received", true);
    }
}

package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Personal training records, "My Training", the Training Number log and the correction of a record by voiding (SDS-TR-001 sections 3.1, 4.5, 9.3). A record
 * is only ever written by the completion of an activity; it is never edited. A wrong record is voided with a reason and a signature and stays in the list.
 */
@Service
public class TrainingRecordService {
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final ElectronicSignatureService signatures;

    public TrainingRecordService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, ElectronicSignatureService signatures) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.signatures = signatures;
    }

    private static final String RECORD_SELECT = """
        select r.id, r.record_no, r.person_user_id, r.full_name, r.employee_code, r.department, r.position, r.training_number, r.topic_text, r.document_number,
               r.document_revision, r.completed_on, r.method, r.result, r.source, r.activity_id,
               v.voided_at, v.reason as void_reason, vu.full_name as voided_by_name
          from training_records r left join training_record_voids v on v.record_id = r.id left join app_users vu on vu.id = v.voided_by
        """;

    /** The records of the person who is logged in, never of another person. */
    @Transactional(readOnly = true)
    public Map<String, Object> myRecords(UserAccount actor, String search, String sortDirection, int page, int limit) {
        access.require(actor, "training.self.view");
        return page(" where r.person_user_id = ?", List.of(actor.getId()), search, "r.completed_on", sortDirection, page, limit);
    }

    /** Records of other people: the own department, or all departments with {@code training.scope.all}. */
    @Transactional(readOnly = true)
    public Map<String, Object> records(UserAccount actor, String search, UUID personId, String documentNumber, String trainingNumber, boolean includeVoided,
                                       String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.record.view");
        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> args = new ArrayList<>();
        if (!access.allDepartments(actor)) {
            where.append(" and lower(trim(r.department)) = lower(trim(?))");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        if (personId != null) { where.append(" and r.person_user_id = ?"); args.add(personId); }
        if (documentNumber != null && !documentNumber.isBlank()) { where.append(" and lower(r.document_number) = lower(?)"); args.add(documentNumber.trim()); }
        if (trainingNumber != null && !trainingNumber.isBlank()) { where.append(" and lower(r.training_number) like ? escape '\\'"); args.add("%" + escape(trainingNumber.trim().toLowerCase(Locale.ROOT)) + "%"); }
        if (!includeVoided) where.append(" and v.id is null");
        String column = switch (sortBy == null ? "completedOn" : sortBy) {
            case "completedOn" -> "r.completed_on";
            case "trainingNumber" -> "r.training_number";
            case "fullName" -> "r.full_name";
            case "documentNumber" -> "r.document_number";
            default -> throw new IllegalArgumentException("TRAINING_SORT_NOT_ALLOWED");
        };
        return page(where.toString(), args, search, column, sortDirection, page, limit);
    }

    private Map<String, Object> page(String where, List<Object> baseArgs, String search, String column, String sortDirection, int page, int limit) {
        List<Object> args = new ArrayList<>(baseArgs);
        StringBuilder sql = new StringBuilder(where);
        if (search != null && !search.isBlank()) {
            String like = "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
            sql.append(" and (lower(r.topic_text) like ? escape '\\' or lower(r.training_number) like ? escape '\\' or lower(coalesce(r.document_number,'')) like ? escape '\\' or lower(r.full_name) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from training_records r left join training_record_voids v on v.record_id = r.id" + sql, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        String direction = "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc";
        List<Map<String, Object>> rows = jdbc.queryForList(RECORD_SELECT + sql + " order by " + column + " " + direction + ", r.record_no desc limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** What is waiting for the person: trainings to read or attend. (Steps to sign are in {@code /training/me/approvals}.) */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> myTasks(UserAccount actor) {
        access.require(actor, "training.self.view");
        return TrainingRows.camel(jdbc.queryForList("""
            select p.id as participant_id, a.id as activity_id, a.training_number, a.title, a.status, a.due_date, s.method, s.scheduled_on, p.state, p.result,
                   (select string_agg(t.topic_text, '; ') from training_session_topics t where t.session_id = s.id) as topics
              from training_participants p join training_activities a on a.id = p.activity_id join training_sessions s on s.id = p.session_id
             where p.person_user_id = ? and a.status in ('NOTIFIED','IN_PROGRESS') and p.state = 'INVITED' and s.status in ('PLANNED','HELD')
             order by coalesce(a.due_date, s.scheduled_on) nulls last limit 100
            """, actor.getId()));
    }

    /** The Training Number log of a department and year: every number issued, including cancelled ones, and the session count (FRM.0044). */
    @Transactional(readOnly = true)
    public Map<String, Object> numberLog(UserAccount actor, UUID departmentId, Integer year, String search, int page, int limit) {
        access.require(actor, "training.compliance.view", "training.activity.view");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        int y = year != null ? year : java.time.LocalDate.now(TrainingNumberService.ZONE).getYear();
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        String like = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(java.util.Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String filter = like == null ? "" : " and (lower(a.training_number) like ? escape '\\' or lower(a.title) like ? escape '\\' or lower(coalesce(a.document_number,'')) like ? escape '\\')";
        List<Object> args = new ArrayList<>(List.of(department, y));
        if (like != null) { args.add(like); args.add(like); args.add(like); }
        Long total = jdbc.queryForObject("select count(*) from training_activities a where a.organizer_department_id=? and a.year=?" + filter, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select a.training_number, a.created_at, a.kind, a.status, a.title, a.document_number, a.revision_number, a.cancel_reason,
                   (select count(*) from training_sessions s where s.activity_id = a.id and s.status <> 'CANCELLED') as sessions,
                   (select count(*) from training_events e where e.activity_id = a.id and e.event_type = 'SESSION_POSTPONED') as postponements
              from training_activities a where a.organizer_department_id=? and a.year=?""" + filter + """
             order by a.serial, a.suffix nulls first limit ? offset ?
            """, pageArgs.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", TrainingRows.camel(rows));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        result.put("year", y);
        return result;
    }

    public record VoidRequest(String reason, String signatureToken) {}

    /**
     * Voids one record: the row itself is never changed; a void row is added with the reason and the signature. The person who voids is not the person who
     * confirmed the activity that wrote the record.
     */
    @Transactional
    public Map<String, Object> voidRecord(UserAccount actor, UUID recordId, VoidRequest request) {
        access.require(actor, "training.record.void");
        Map<String, Object> record = jdbc.queryForList("select * from training_records where id=?", recordId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> activity = store.activity((UUID) record.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        if (actor.getId().equals(activity.get("confirmed_by"))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        Integer already = jdbc.queryForObject("select count(*) from training_record_voids where record_id=?", Integer.class, recordId);
        if (already != null && already > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_RECORD_ALREADY_VOIDED");
        UUID signature = signatures.createEntitySignature("TRAINING_RECORD", recordId, record.get("training_number") + " #" + record.get("record_no"), actor,
                request.signatureToken(), "TRAINING_RECORD_VOIDED", request.reason().trim(), null, null, null).getId();
        jdbc.update("insert into training_record_voids(id, record_id, reason, voided_by, signature_id) values (?,?,?,?,?)", UUID.randomUUID(), recordId, request.reason().trim(), actor.getId(), signature);
        store.event(TrainingStore.OBJECT_ACTIVITY, (UUID) activity.get("id"), (UUID) activity.get("id"), "RECORD_VOIDED",
                Map.of("recordNo", String.valueOf(record.get("record_no")), "reason", request.reason().trim()), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_RECORD_VOIDED", null, null, "Record #" + record.get("record_no") + " of " + record.get("full_name") + ": " + request.reason().trim());
        return TrainingRows.camel(jdbc.queryForList(RECORD_SELECT + " where r.id=?", recordId).getFirst());
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}

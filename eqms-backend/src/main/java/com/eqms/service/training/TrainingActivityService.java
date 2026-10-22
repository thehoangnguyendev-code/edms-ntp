package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The life of a training activity (SDS-TR-001 section 3.2): create, plan sessions and people, confirm the list and the content, notify, hold, record
 * attendance and results, send to QA, and QA completion that writes the personal training records. Every command checks the permission and the department
 * of the person, the state of the object and its version, signs when the SOP asks for a signature, and writes the Audit Trail.
 */
@Service
public class TrainingActivityService {
    private static final Set<String> CREATE_KINDS = Set.of("INITIAL", "PERIODIC", "UNPLANNED", "EXTERNAL");

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final TrainingNumberService numbers;
    private final TrainingSettingsService settings;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final UserAccountRepository users;
    private final TrainingNotifier notifier;
    private final TrainingTrainerService trainers;

    public TrainingActivityService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, TrainingNumberService numbers, TrainingSettingsService settings,
                                   TrainingApprovalService approvals, ElectronicSignatureService signatures, UserAccountRepository users, TrainingNotifier notifier, TrainingTrainerService trainers) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.numbers = numbers;
        this.settings = settings;
        this.approvals = approvals;
        this.signatures = signatures;
        this.users = users;
        this.notifier = notifier;
        this.trainers = trainers;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ requests

    public record CreateRequest(UUID departmentId, String kind, String kindReason, String externalType, String trainingTitle, LocalDate dueDate, String remarks, String trainingUnitName, String vendorRef) {}
    public record UpdateRequest(Integer version, String trainingTitle, LocalDate dueDate, String remarks, String trainingUnitName, String vendorRef) {}
    public record TopicRequest(String topicText, UUID documentRevisionId) {}
    public record SessionRequest(String method, String assessmentMethod, UUID trainerUserId, String externalTrainerName, LocalDate scheduledOn, String venue, String locationType, String onlinePlatform, String meetingLink, List<TopicRequest> topics) {}
    public record ExternalPerson(String name, String org) {}
    public record ParticipantsRequest(UUID sessionId, List<UUID> personUserIds, String externalName, String externalOrg, List<ExternalPerson> externals, String reason) {}
    public record ReasonRequest(String reason) {}
    public record CommandRequest(Integer version, String reason, String signatureToken) {}
    public record HoldRequest(LocalDate heldOn) {}
    public record PostponeRequest(LocalDate newDate, String reason) {}
    public record AttendanceRequest(String state, String absenceReason) {}
    public record CorrectionRequest(String state, String reason) {}
    public record AssessmentRequest(BigDecimal scoreObtained, BigDecimal scoreMax, String remarks) {}
    public record SupplementaryRequest(List<UUID> participantIds, String reason) {}

    // ------------------------------------------------------------------------------------------------------------------------------ reading

    /**
     * More filters of the list. Dates are ISO yyyy-MM-dd and a malformed one is refused; the scheduled range matches an activity that has a session in it.
     * An unknown method or reason matches nothing; it is never turned into SQL.
     */
    public record ListFilters(String method, String kindReason, Boolean onPaper, String scheduledFrom, String scheduledTo, String dueFrom, String dueTo, String createdFrom, String createdTo) {
        public static final ListFilters NONE = new ListFilters(null, null, null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, String kind, UUID departmentId, Integer year, String documentNumber,
                                    boolean overdue, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, search, status, kind, departmentId, year, documentNumber, overdue, ListFilters.NONE, sortBy, sortDirection, page, limit);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String search, String status, String kind, UUID departmentId, Integer year, String documentNumber,
                                    boolean overdue, ListFilters more, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.activity.view");
        ListFilters extra = more == null ? ListFilters.NONE : more;
        String column = switch (sortBy == null ? "createdAt" : sortBy) {
            case "trainingNumber" -> "t.training_number";
            case "trainingTitle" -> "t.training_title";
            case "status" -> "t.status";
            case "kind" -> "t.kind";
            case "dueDate" -> "t.due_date";
            case "year" -> "t.year";
            case "createdAt" -> "t.created_at";
            case "scheduledOn" -> "(select min(s.scheduled_on) from training_sessions s where s.activity_id = t.id)";
            case "departmentName" -> "d.name";
            case "createdByName" -> "cu.full_name";
            case "topics" -> "(select string_agg(distinct st.topic_text, '; ') from training_sessions s join training_session_topics st on st.session_id = s.id where s.activity_id = t.id)";
            case "trainers" -> "(select string_agg(distinct coalesce(tu.full_name, s.external_trainer_name), ', ') from training_sessions s left join app_users tu on tu.id = s.trainer_user_id where s.activity_id = t.id)";
            case "methods" -> "(select string_agg(distinct s.method, ',') from training_sessions s where s.activity_id = t.id)";
            case "kindReason" -> "t.kind_reason";
            case "documentNumber" -> "t.document_number";
            case "participantCount" -> "(select count(*) from training_participants p where p.activity_id = t.id)";
            case "attendedCount" -> "(select count(*) from training_participants p where p.activity_id = t.id and p.state in ('ATTENDED','ONLINE','READ_CONFIRMED'))";
            case "passedCount" -> "(select count(*) from training_participants p where p.activity_id = t.id and p.result = 'PASSED')";
            default -> throw new IllegalArgumentException("TRAINING_SORT_NOT_ALLOWED");
        };
        String direction = "asc".equalsIgnoreCase(sortDirection) ? "asc" : "desc";
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            UUID own = access.departmentOf(actor);
            where.append(" and t.organizer_department_id = ?");
            args.add(own == null ? new UUID(0, 0) : own);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + escapeLike(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (lower(t.training_number) like ? escape '\\' or lower(t.training_title) like ? escape '\\' or lower(coalesce(t.document_number,'')) like ? escape '\\' or lower(coalesce(cu.full_name,'')) like ? escape '\\' or exists (select 1 from training_sessions s left join app_users tu on tu.id = s.trainer_user_id left join training_session_topics st on st.session_id = s.id where s.activity_id = t.id and (lower(coalesce(st.topic_text,'')) like ? escape '\\' or lower(coalesce(tu.full_name,'')) like ? escape '\\' or lower(coalesce(s.external_trainer_name,'')) like ? escape '\\')))");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        if (status != null && !status.isBlank()) { where.append(" and t.status = ?"); args.add(status); }
        if (kind != null && !kind.isBlank()) { where.append(" and t.kind = ?"); args.add(kind); }
        if (departmentId != null) { where.append(" and t.organizer_department_id = ?"); args.add(departmentId); }
        if (year != null) { where.append(" and t.year = ?"); args.add(year); }
        if (documentNumber != null && !documentNumber.isBlank()) { where.append(" and lower(t.document_number) = lower(?)"); args.add(documentNumber.trim()); }
        if (extra.method() != null && !extra.method().isBlank()) {
            where.append(" and exists (select 1 from training_sessions s where s.activity_id = t.id and s.method = ?)");
            args.add(extra.method());
        }
        if (extra.kindReason() != null && !extra.kindReason().isBlank()) { where.append(" and t.kind_reason = ?"); args.add(extra.kindReason()); }
        if (extra.onPaper() != null) {
            where.append(extra.onPaper()
                    ? " and exists (select 1 from training_sessions s where s.activity_id = t.id and s.delivery_mode <> 'ELECTRONIC')"
                    : " and not exists (select 1 from training_sessions s where s.activity_id = t.id and s.delivery_mode <> 'ELECTRONIC')");
        }
        LocalDate scheduledFrom = listDate(extra.scheduledFrom()), scheduledTo = listDate(extra.scheduledTo());
        if (scheduledFrom != null) { where.append(" and exists (select 1 from training_sessions s where s.activity_id = t.id and s.scheduled_on >= ?)"); args.add(java.sql.Date.valueOf(scheduledFrom)); }
        if (scheduledTo != null) { where.append(" and exists (select 1 from training_sessions s where s.activity_id = t.id and s.scheduled_on <= ?)"); args.add(java.sql.Date.valueOf(scheduledTo)); }
        LocalDate dueFrom = listDate(extra.dueFrom()), dueTo = listDate(extra.dueTo());
        if (dueFrom != null) { where.append(" and t.due_date >= ?"); args.add(java.sql.Date.valueOf(dueFrom)); }
        if (dueTo != null) { where.append(" and t.due_date <= ?"); args.add(java.sql.Date.valueOf(dueTo)); }
        LocalDate createdFrom = listDate(extra.createdFrom()), createdTo = listDate(extra.createdTo());
        if (createdFrom != null) { where.append(" and t.created_at >= ?"); args.add(java.sql.Timestamp.from(createdFrom.atStartOfDay(TrainingNumberService.ZONE).toInstant())); }
        if (createdTo != null) { where.append(" and t.created_at < ?"); args.add(java.sql.Timestamp.from(createdTo.plusDays(1).atStartOfDay(TrainingNumberService.ZONE).toInstant())); }
        if (overdue) where.append(" and t.due_date < current_date and t.status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION')");
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from training_activities t left join app_users cu on cu.id = t.created_by" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select t.id, t.training_number, t.training_title, t.kind, t.kind_reason, t.status, t.due_date, t.document_number, t.revision_number, t.year, t.created_at,
                   t.organizer_department_id, t.revision_id, (select r.status_code from document_revisions r where r.id = t.revision_id) as revision_status,
                   d.name as department_name, (select count(*) from training_participants p where p.activity_id = t.id) as participant_count,
                   (select count(*) from training_participants p where p.activity_id = t.id and p.state in ('ATTENDED','ONLINE','READ_CONFIRMED')) as attended_count,
                   (select count(*) from training_participants p where p.activity_id = t.id and p.result = 'PASSED') as passed_count,
                   (select string_agg(distinct st.topic_text, '; ') from training_sessions s join training_session_topics st on st.session_id = s.id where s.activity_id = t.id) as topics,
                   (select string_agg(distinct coalesce(tu.full_name, s.external_trainer_name), ', ') from training_sessions s left join app_users tu on tu.id = s.trainer_user_id where s.activity_id = t.id) as trainers,
                   (select string_agg(distinct s.method, ',') from training_sessions s where s.activity_id = t.id) as methods,
                   (select min(s.scheduled_on) from training_sessions s where s.activity_id = t.id) as scheduled_from,
                   (select max(s.scheduled_on) from training_sessions s where s.activity_id = t.id) as scheduled_to,
                   (select bool_or(s.delivery_mode <> 'ELECTRONIC') from training_sessions s where s.activity_id = t.id) as on_paper,
                   t.training_unit_name, t.external_type, cu.full_name as created_by_name
              from training_activities t join departments d on d.id = t.organizer_department_id left join app_users cu on cu.id = t.created_by
            """ + where + " order by " + column + " " + direction + ", t.training_number desc limit ? offset ?", pageArgs.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", withActions(actor, TrainingRows.camel(rows)));
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    private static LocalDate listDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("TRAINING_DATE_INVALID");
        }
    }

    /**
     * What the person may do with each row of the list, worked out by the server for the lifecycle state and the person (the screens offer one menu entry for each):
     * edit the preparation, conduct, review or approve the content, confirm the completion, and open the revision to complete the training.
     */
    private List<Map<String, Object>> withActions(UserAccount actor, List<Map<String, Object>> rows) {
        List<UUID> ids = rows.stream().map(r -> (UUID) r.get("id")).toList();
        Map<UUID, Set<String>> mine = new java.util.HashMap<>();
        if (!ids.isEmpty()) {
            String marks = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
            List<Object> args = new ArrayList<>();
            args.add(actor.getId());
            args.addAll(ids);
            for (Map<String, Object> a : jdbc.queryForList("select object_id, step_code from training_approval_assignments where object_type='TRAINING_ACTIVITY' and status='PENDING' and assignee_user_id=? and object_id in (" + marks + ")", args.toArray())) {
                mine.computeIfAbsent((UUID) a.get("object_id"), k -> new java.util.HashSet<>()).add(String.valueOf(a.get("step_code")));
            }
        }
        boolean organizer = access.has(actor, "training.activity.organize");
        boolean conductor = access.has(actor, "training.activity.conduct", "training.activity.organize");
        boolean closer = access.has(actor, "training.activity.close");
        for (Map<String, Object> row : rows) {
            String status = String.valueOf(row.get("status"));
            UUID department = (UUID) row.get("organizerDepartmentId");
            boolean inScope = access.inScope(actor, department);
            Set<String> steps = mine.getOrDefault((UUID) row.get("id"), Set.of());
            boolean open = Set.of("PLANNED", "NOTIFIED").contains(status);
            Map<String, Object> actions = new LinkedHashMap<>();
            actions.put("edit", organizer && inScope && open);
            actions.put("conduct", conductor && inScope && Set.of("NOTIFIED", "IN_PROGRESS").contains(status));
            actions.put("review", open && steps.contains("CONTENT_REVIEW"));
            actions.put("approve", open && (steps.contains("CONTENT_APPROVE") || steps.contains("TRAINER_EXCEPTION")));
            actions.put("confirm", closer && inScope && "PENDING_QA_CONFIRMATION".equals(status));
            actions.put("completeTraining", "COMPLETED".equals(status) && row.get("revisionId") != null && "PENDING_TRAINING".equals(row.get("revisionStatus")));
            row.put("actions", actions);
            row.remove("organizerDepartmentId");
            row.remove("revisionStatus");
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        Map<String, Object> activity = visible(actor, id);
        Map<String, Object> out = TrainingRows.camel(activity);
        out.put("departmentName", jdbc.queryForObject("select name from departments where id=?", String.class, activity.get("organizer_department_id")));
        List<Map<String, Object>> sessions = TrainingRows.camel(jdbc.queryForList("""
            select s.*, u.full_name as trainer_name from training_sessions s left join app_users u on u.id = s.trainer_user_id where s.activity_id=? order by s.session_no
            """, id));
        for (Map<String, Object> session : sessions) {
            Map<String, Object> qualification = trainers.qualification((UUID) session.get("id"));
            @SuppressWarnings("unchecked")
            Map<String, Object> pendingException = (Map<String, Object>) qualification.get("exception");
            if (pendingException != null && "PENDING".equals(pendingException.get("status"))) {
                Integer mine = jdbc.queryForObject("select count(*) from training_approval_assignments where object_type='TRAINING_TRAINER_EXCEPTION' and object_id=? and status='PENDING' and assignee_user_id=?",
                        Integer.class, pendingException.get("id"), actor.getId());
                qualification.put("canDecide", mine != null && mine > 0);
            }
            session.put("trainerQualification", qualification);
            session.put("topics", TrainingRows.camel(jdbc.queryForList("select id, topic_text, document_id, document_revision_id, document_number, revision_number from training_session_topics where session_id=?", session.get("id"))));
        }
        out.put("sessions", sessions);
        out.put("participants", TrainingRows.camel(jdbc.queryForList("""
            select p.id, p.session_id, p.person_user_id, p.full_name, p.employee_code, p.department, p.position, p.external_name, p.external_org, p.state, p.result,
                   p.absence_reason, p.planned_absence, p.added_reason, p.sign_mode, p.read_confirmed_at,
                   case when not exists (select 1 from training_exam_questions q where q.activity_id = p.activity_id) then null
                        when exists (select 1 from training_exam_attempts t where t.participant_id = p.id and t.status = 'SUBMITTED') then 'DONE'
                        when exists (select 1 from training_exam_attempts t where t.participant_id = p.id and t.status = 'IN_PROGRESS' and (t.due_at is null or t.due_at + interval '60 seconds' >= now())) then 'OPEN'
                        when exists (select 1 from training_exam_attempts t where t.participant_id = p.id and t.status = 'IN_PROGRESS') then 'USED'
                        when (select count(*) from training_exam_attempts t where t.participant_id = p.id) > (select count(*) from training_exam_resets r where r.participant_id = p.id) then 'USED'
                        else 'READY' end as exam_state,
                   (select max(attempt_no) from training_assessments a where a.participant_id = p.id) as attempts,
                   (select a.percent from training_assessments a where a.participant_id = p.id order by attempt_no desc limit 1) as last_percent,
                   (select au.avatar from app_users au where au.id = p.person_user_id) as avatar
              from training_participants p where p.activity_id=? order by p.full_name
            """, id)));
        out.put("confirmations", TrainingRows.camel(jdbc.queryForList("""
            select c.id, c.kind, c.confirmed_at, c.remark, u.full_name as confirmed_by_name from training_activity_confirmations c join app_users u on u.id = c.confirmed_by
             where c.activity_id=? order by c.confirmed_at
            """, id)));
        out.put("approvers", TrainingRows.camel(approvals.assignments("TRAINING_ACTIVITY", id)));
        out.put("qaList", qaList(activity));
        out.put("capabilities", capabilities(actor, activity));
        return out;
    }

    /**
     * People the effective matrices require to be trained on the topics of the session, who have no valid training on it yet (never trained, or the annual training is
     * due again) and are not on the session. The server decides; the screen only offers them to the organizer, who adds them with one click.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> suggestedParticipants(UserAccount actor, UUID activityId, UUID sessionId) {
        Map<String, Object> activity = store.activity(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        Integer belongs = jdbc.queryForObject("select count(*) from training_sessions where id=? and activity_id=?", Integer.class, sessionId, activityId);
        if (belongs == null || belongs == 0) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        List<Object> args = new ArrayList<>();
        args.add(sessionId);
        args.add(sessionId);
        String scope = "";
        if (!access.allDepartments(actor)) {
            scope = " and lower(trim(u.department)) = lower(trim(?))";
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        String sql = """
            select * from (
              select distinct on (u.id, tp.topic_text) u.id as person_id, u.full_name, u.employee_code, u.department, p.name as position_name, tp.topic_text, r.annual_required,
                     (select max(rec.completed_on) from training_records rec left join training_record_voids vv on vv.record_id = rec.id
                       where rec.person_user_id = u.id and vv.id is null
                         and ((tp.document_number is not null and rec.document_number = tp.document_number) or lower(rec.topic_text) = lower(tp.topic_text))) as last_done
                from training_session_topics tp
                join training_matrix_versions v on v.status = 'EFFECTIVE'
                join training_matrix_rows r on r.version_id = v.id
                left join training_topics t on t.id = r.topic_id
                join training_matrix_cells c on c.row_id = r.id
                join training_person_positions pp on pp.position_id = c.position_id and pp.valid_to is null
                join app_users u on u.id = pp.person_user_id and u.status = 'Active'
                join positions p on p.id = pp.position_id
               where tp.session_id = ? and ((r.document_id is not null and r.document_id = tp.document_id) or (t.id is not null and lower(t.name) = lower(tp.topic_text)))
                 and not exists (select 1 from training_participants x where x.session_id = ? and x.person_user_id = u.id)
              """ + scope + """
              order by u.id, tp.topic_text) x
             where x.last_done is null or (x.annual_required and x.last_done < current_date - interval '1 year')
             order by x.full_name, x.topic_text limit 200
            """;
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(sql, args.toArray()));
        for (Map<String, Object> row : rows) row.put("reason", row.get("lastDone") == null ? "MISSING" : "DUE");
        return rows;
    }

    private static final java.util.Set<String> GROUP_COLUMNS = java.util.Set.of("BUSINESS_UNIT", "DEPARTMENT");

    private static String groupColumn(String by) {
        if (!GROUP_COLUMNS.contains(by)) throw new IllegalArgumentException("TRAINING_GROUP_INVALID");
        return "BUSINESS_UNIT".equals(by) ? "u.business_unit" : "u.department";
    }

    /** The business units or departments of the people the person may choose, each with its number of active people (the own department unless the person may act on all). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> peopleGroups(UserAccount actor, String by) {
        access.require(actor, "training.activity.organize", "training.activity.conduct");
        String column = groupColumn(by);
        List<Object> args = new ArrayList<>();
        String scope = "";
        if (!access.allDepartments(actor)) {
            scope = " and lower(trim(u.department)) = lower(trim(?))";
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        return TrainingRows.camel(jdbc.queryForList("select " + column + " as name, count(*) as total from app_users u where u.status = 'Active' and " + column + " is not null and " + column + " <> ''" + scope
                + " group by " + column + " order by " + column, args.toArray()));
    }

    /** The active people of the business units or departments chosen, in the same scope (at most 500). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> peopleInGroups(UserAccount actor, String by, List<String> names) {
        access.require(actor, "training.activity.organize", "training.activity.conduct");
        if (names == null || names.isEmpty()) return List.of();
        String column = groupColumn(by);
        List<Object> args = new ArrayList<>(names.stream().limit(50).toList());
        String marks = String.join(",", java.util.Collections.nCopies(args.size(), "?"));
        String scope = "";
        if (!access.allDepartments(actor)) {
            scope = " and lower(trim(u.department)) = lower(trim(?))";
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        return TrainingRows.camel(jdbc.queryForList("select u.id, u.full_name, u.employee_code, u.department, u.position, u.email, u.business_unit from app_users u where u.status = 'Active' and " + column + " in (" + marks + ")" + scope
                + " order by u.full_name limit 500", args.toArray()));
    }

    /** Active people to choose as trainer or participant: the own department unless the person may act on all departments. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> people(UserAccount actor, String search, int limit) {
        access.require(actor, "training.activity.organize", "training.activity.conduct");
        String like = "%" + escapeLike((search == null ? "" : search.trim()).toLowerCase(Locale.ROOT)) + "%";
        List<Object> args = new ArrayList<>();
        args.add(like);
        args.add(like);
        String scope = "";
        if (!access.allDepartments(actor)) {
            scope = " and lower(trim(u.department)) = lower(trim(?))";
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        args.add(Math.min(Math.max(limit, 1), 50));
        String sql = "select u.id, u.full_name, u.employee_code, u.department, u.position, u.email, u.business_unit from app_users u"
                + " where u.status = 'Active' and (lower(u.full_name) like ? escape '\\' or lower(u.username) like ? escape '\\')"
                + scope + " order by u.full_name limit ?";
        return TrainingRows.camel(jdbc.queryForList(sql, args.toArray()));
    }

    /** What the screen may offer the person for this activity. Only a hint: every command checks again. */
    private Map<String, Object> capabilities(UserAccount actor, Map<String, Object> activity) {
        String status = String.valueOf(activity.get("status"));
        UUID department = (UUID) activity.get("organizer_department_id");
        boolean organize = access.has(actor, "training.activity.organize") && access.inScope(actor, department);
        boolean conduct = access.has(actor, "training.activity.conduct", "training.activity.organize") && access.inScope(actor, department);
        boolean open = !Set.of("COMPLETED", "CANCELLED", "RESERVED").contains(status);
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("edit", organize && "PLANNED".equals(status));
        caps.put("planSessions", organize && Set.of("PLANNED", "NOTIFIED").contains(status));
        // Once the training has started the plan is fixed: a session not yet held may still be moved. People are added only while the list is being prepared (SOP.0003 5.3.4);
        // later, a person who was not on the list is trained in a make-up or in a new unplanned training.
        caps.put("adjustPlan", organize && Set.of("PLANNED", "NOTIFIED", "IN_PROGRESS").contains(status));
        caps.put("addParticipants", organize && "PLANNED".equals(status) && activity.get("list_prepared_by") == null);
        Integer people = jdbc.queryForObject("select count(*) from training_participants where activity_id=?", Integer.class, activity.get("id"));
        boolean listDone = activity.get("list_prepared_by") != null;
        caps.put("removeParticipants", organize && "PLANNED".equals(status) && !listDone);
        caps.put("confirmList", organize && "PLANNED".equals(status) && people != null && people > 0 && !listDone);
        caps.put("designateApprovers", organize && open);
        caps.put("notify", organize && "PLANNED".equals(status));
        caps.put("notifyBlockers", "PLANNED".equals(status) ? notifyBlockers((UUID) activity.get("id"), people == null ? 0 : people, listDone) : List.of());
        caps.put("hold", conduct && Set.of("NOTIFIED", "IN_PROGRESS").contains(status));
        caps.put("recordAttendance", conduct && "IN_PROGRESS".equals(status));
        caps.put("printPaper", conduct && access.has(actor, "training.paper.print") && Set.of("NOTIFIED", "IN_PROGRESS").contains(status));
        caps.put("rollCall", conduct && "IN_PROGRESS".equals(status));
        caps.put("transcribe", conduct && access.has(actor, "training.paper.transcribe") && "IN_PROGRESS".equals(status));
        caps.put("verifyTranscription", access.has(actor, "training.paper.verify") && access.inScope(actor, department) && "IN_PROGRESS".equals(status));
        caps.put("recordAssessment", access.has(actor, "training.assessment.record") && access.inScope(actor, department) && "IN_PROGRESS".equals(status));
        caps.put("submitForConfirmation", organize && "IN_PROGRESS".equals(status));
        caps.put("confirmCompletion", access.has(actor, "training.activity.close") && "PENDING_QA_CONFIRMATION".equals(status));
        caps.put("cancel", organize && open);
        caps.put("addSupplementary", organize && Set.of("IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED").contains(status));
        return caps;
    }

    /**
     * SOP.0003 5.3.6: for a new or revised document the attendance list goes to QA on the day the training is held. The software shows where the activity stands against that day
     * and records a late sending; it never blocks the work (the SOP date is a default, the deviation is kept). Null when the rule does not apply.
     */
    private Map<String, Object> qaList(Map<String, Object> activity) {
        if (activity.get("document_id") == null || !Set.of("NEW_SOP", "SOP_VERSION").contains(String.valueOf(activity.get("kind_reason")))) return null;
        UUID id = (UUID) activity.get("id");
        java.sql.Date held = jdbc.queryForObject("select max(held_on) from training_sessions where activity_id = ? and status = 'HELD'", java.sql.Date.class, id);
        java.sql.Timestamp sent = jdbc.queryForObject("select min(occurred_at) from training_events where activity_id = ? and event_type = 'PENDING_QA_CONFIRMATION'", java.sql.Timestamp.class, id);
        LocalDate today = LocalDate.now(TrainingNumberService.ZONE);
        LocalDate due = held == null ? null : held.toLocalDate();
        LocalDate sentOn = sent == null ? null : sent.toInstant().atZone(TrainingNumberService.ZONE).toLocalDate();
        String state;
        if (sentOn != null) state = due == null || !sentOn.isAfter(due) ? "SENT" : "SENT_LATE";
        else if (due == null) state = "WAITING";
        else if (today.isAfter(due)) state = "OVERDUE";
        else state = today.equals(due) ? "DUE_TODAY" : "DUE";
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("state", state);
        out.put("dueOn", due == null ? null : due.toString());
        out.put("sentOn", sentOn == null ? null : sentOn.toString());
        return out;
    }

    /** What is still missing before the participants can be notified: the same rules as notifyActivity, as a list the screen can show. */
    private List<String> notifyBlockers(UUID id, int people, boolean listDone) {
        List<String> out = new ArrayList<>();
        Integer sessions = jdbc.queryForObject("select count(*) from training_sessions where activity_id=? and status='PLANNED'", Integer.class, id);
        if (sessions == null || sessions == 0) out.add("TRAINING_SESSION_REQUIRED");
        else {
            Integer noTrainer = isExternal(id) ? 0 : jdbc.queryForObject("select count(*) from training_sessions where activity_id=? and status='PLANNED' and trainer_user_id is null and external_trainer_name is null", Integer.class, id);
            if (noTrainer != null && noTrainer > 0) out.add("TRAINING_TRAINER_REQUIRED");
            for (UUID sessionId : jdbc.queryForList("select id from training_sessions where activity_id=? and status='PLANNED'", UUID.class, id)) {
                if (!trainers.cleared(sessionId)) { out.add("TRAINING_TRAINER_NOT_QUALIFIED"); break; }
            }
        }
        if (people == 0) out.add("TRAINING_PARTICIPANT_REQUIRED");
        else if (!listDone) out.add("TRAINING_LIST_NOT_CONFIRMED");
        if (isExternal(id)) {
            if (blankToNull((String) jdbc.queryForObject("select training_unit_name from training_activities where id=?", String.class, id)) == null) out.add("TRAINING_UNIT_REQUIRED");
        } else if (!confirmed(id, "CONTENT_REVIEWED") || !confirmed(id, "CONTENT_APPROVED")) out.add("TRAINING_CONTENT_NOT_APPROVED");
        return out;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ creating and planning

    @Transactional
    public Map<String, Object> create(UserAccount actor, CreateRequest request) {
        access.require(actor, "training.activity.organize");
        if (request == null || request.trainingTitle() == null || request.trainingTitle().isBlank() || request.trainingTitle().length() > 255) throw new IllegalArgumentException("TRAINING_TITLE_REQUIRED");
        if (request.kind() == null || !CREATE_KINDS.contains(request.kind())) throw new IllegalArgumentException("TRAINING_KIND_INVALID");
        // The code of an initial or periodic training is allocated by QA (SOP 5.1.4); an unplanned or external one by the department that raised it.
        if (Set.of("INITIAL", "PERIODIC").contains(request.kind())) access.require(actor, "training.code.allocate");
        if ("EXTERNAL".equals(request.kind()) && (request.externalType() == null || !Set.of("ACTIVE", "PASSIVE").contains(request.externalType()))) throw new IllegalArgumentException("TRAINING_EXTERNAL_TYPE_REQUIRED");
        boolean external = "EXTERNAL".equals(request.kind());
        String unit = blankToNull(request.trainingUnitName());
        if (external && unit == null) throw new IllegalArgumentException("TRAINING_UNIT_REQUIRED");
        if ((unit != null && unit.length() > 255) || (request.vendorRef() != null && request.vendorRef().trim().length() > 120)) throw new IllegalArgumentException("TRAINING_UNIT_REQUIRED");
        UUID department = request.departmentId() != null ? request.departmentId() : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        TrainingNumberService.Issued issued = numbers.issueRoot(department);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            insert into training_activities(id, training_number, base_number, organizer_department_id, year, serial, kind, kind_reason, external_type, training_title, status,
              due_date, remarks, training_unit_name, vendor_ref, created_by) values (?,?,?,?,?,?,?,?,?,?,'PLANNED',?,?,?,?,?)
            """, id, issued.baseNumber(), issued.baseNumber(), department, issued.year(), issued.serial(), request.kind(), request.kindReason(),
                external ? request.externalType() : null, request.trainingTitle().trim(), request.dueDate(), request.remarks(), external ? unit : null, external ? blankToNull(request.vendorRef()) : null, actor.getId());
        Map<String, Object> created = store.activity(id).orElseThrow();
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "NUMBER_ISSUED", Map.of("number", issued.baseNumber(), "kind", request.kind()), actor.getId());
        store.auditActivity(actor, created, "TRAINING_ACTIVITY_CREATED", null, "PLANNED", request.trainingTitle().trim());
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, UpdateRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireVersion(activity, request == null ? null : request.version());
        requireStatus(activity, "PLANNED");
        String title = request.trainingTitle() == null ? String.valueOf(activity.get("training_title")) : request.trainingTitle().trim();
        if (title.isBlank() || title.length() > 255) throw new IllegalArgumentException("TRAINING_TITLE_REQUIRED");
        boolean external = "EXTERNAL".equals(activity.get("kind"));
        String unit = external && request.trainingUnitName() != null ? blankToNull(request.trainingUnitName()) : (String) activity.get("training_unit_name");
        if (external && unit == null) throw new IllegalArgumentException("TRAINING_UNIT_REQUIRED");
        String vendor = external && request.vendorRef() != null ? blankToNull(request.vendorRef()) : (String) activity.get("vendor_ref");
        if ((unit != null && unit.length() > 255) || (vendor != null && vendor.length() > 120)) throw new IllegalArgumentException("TRAINING_UNIT_REQUIRED");
        jdbc.update("update training_activities set training_title=?, due_date=?, remarks=?, training_unit_name=?, vendor_ref=?, version=version+1, updated_at=now() where id=?", title, request.dueDate(), request.remarks(), unit, vendor, id);
        store.auditActivity(actor, activity, "TRAINING_ACTIVITY_UPDATED", null, null, "Title, due date, remarks or training unit changed");
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> addSession(UserAccount actor, UUID id, SessionRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireStatus(activity, "PLANNED", "NOTIFIED");
        boolean externalActivity = "EXTERNAL".equals(activity.get("kind"));
        if (request == null || (!externalActivity && (request.method() == null || request.assessmentMethod() == null))) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        if (externalActivity && (request.method() != null || request.assessmentMethod() != null || request.trainerUserId() != null)) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        if (request.topics() == null || request.topics().isEmpty() || request.topics().stream().anyMatch(t -> t.topicText() == null || t.topicText().isBlank())) throw new IllegalArgumentException("TRAINING_TOPIC_REQUIRED");
        if (request.trainerUserId() != null) {
            UserAccount trainer = users.findById(request.trainerUserId()).orElseThrow(() -> new IllegalArgumentException("TRAINING_TRAINER_NOT_FOUND"));
            if (trainer.getStatus() != UserStatus.Active) throw new IllegalArgumentException("TRAINING_TRAINER_NOT_FOUND");
        }
        // SOP.0003 5.1.2 names a way of assessment for each training method; the screen offers it as the default and lets the organizer choose another one. Only a known value is accepted.
        if (!externalActivity && !java.util.Set.of("TEST", "CHECKLIST", "OBSERVATION", "SELF_READING_CONFIRMATION").contains(request.assessmentMethod())) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        boolean online = "ONLINE".equals(request.locationType());
        if (request.locationType() != null && !Set.of("ONSITE", "ONLINE").contains(request.locationType())) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        String venue = request.venue() == null || request.venue().isBlank() ? null : request.venue().trim();
        String platform = request.onlinePlatform() == null || request.onlinePlatform().isBlank() ? null : request.onlinePlatform().trim();
        String meeting = request.meetingLink() == null || request.meetingLink().isBlank() ? null : request.meetingLink().trim();
        if (online) {
            if (platform == null || platform.length() > 30 || meeting == null || meeting.length() > 1000) throw new IllegalArgumentException("TRAINING_LOCATION_INVALID");
            java.net.URI uri;
            try { uri = java.net.URI.create(meeting); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("TRAINING_LOCATION_INVALID"); }
            if (uri.getHost() == null || !"https".equalsIgnoreCase(uri.getScheme())) throw new IllegalArgumentException("TRAINING_LOCATION_INVALID");
            venue = null;
        } else {
            if (venue == null) throw new IllegalArgumentException("TRAINING_LOCATION_INVALID");
            platform = null;
            meeting = null;
        }
        Integer next = jdbc.queryForObject("select coalesce(max(session_no),0)+1 from training_sessions where activity_id=?", Integer.class, id);
        UUID sessionId = UUID.randomUUID();
        jdbc.update("""
            insert into training_sessions(id, activity_id, session_no, method, assessment_method, trainer_user_id, external_trainer_name, scheduled_on, venue, location_type, online_platform, meeting_link, created_by)
            values (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, sessionId, id, next, request.method(), request.assessmentMethod(), request.trainerUserId(),
                request.externalTrainerName() == null || request.externalTrainerName().isBlank() ? null : request.externalTrainerName().trim(), request.scheduledOn(), venue, online ? "ONLINE" : "ONSITE", platform, meeting, actor.getId());
        for (TopicRequest topic : request.topics()) {
            Map<String, Object> doc = topic.documentRevisionId() == null ? Map.of() : jdbc.queryForList(
                    "select document_id, document_number, revision_number from document_revisions where id=?", topic.documentRevisionId()).stream().findFirst().orElse(Map.of());
            jdbc.update("insert into training_session_topics(id, session_id, topic_text, document_id, document_revision_id, document_number, revision_number) values (?,?,?,?,?,?,?)",
                    UUID.randomUUID(), sessionId, topic.topicText().trim(), doc.get("document_id"), topic.documentRevisionId(), doc.get("document_number"), doc.get("revision_number"));
        }
        // New content or a new session means the earlier confirmations of the list no longer cover it: they are asked again before the activity is notified.
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "SESSION_ADDED", Map.of("sessionNo", next), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_SESSION_ADDED", null, null, "Session " + next);
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> addParticipants(UserAccount actor, UUID id, ParticipantsRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireStatus(activity, "PLANNED");
        // The list is prepared and communicated before the training (SOP.0003 5.3.4). Once it is confirmed it is not changed; a person who is not on it is trained in a make-up or a new training.
        if (activity.get("list_prepared_by") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LIST_LOCKED");
        if (request == null || request.sessionId() == null) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        Integer inActivity = jdbc.queryForObject("select count(*) from training_sessions where id=? and activity_id=? and status <> 'CANCELLED'", Integer.class, request.sessionId(), id);
        if (inActivity == null || inActivity == 0) throw new IllegalArgumentException("TRAINING_SESSION_INVALID");
        // A person added by hand needs a reason (the list normally comes from the matrix); the reason stays on the row.
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        int added = 0;
        if (request.personUserIds() != null) {
            for (UUID personId : request.personUserIds()) {
                if (personId == null) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
                UserAccount person = users.findById(personId).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
                if (person.getStatus() != UserStatus.Active) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
                Integer exists = jdbc.queryForObject("select count(*) from training_participants where session_id=? and person_user_id=?", Integer.class, request.sessionId(), personId);
                if (exists != null && exists > 0) continue;
                jdbc.update("""
                    insert into training_participants(id, activity_id, session_id, person_user_id, employee_code, full_name, department, position, added_reason, created_by)
                    values (?,?,?,?,?,?,?,?,?,?)
                    """, UUID.randomUUID(), id, request.sessionId(), personId, person.getEmployeeCode(), person.getFullName(), person.getDepartment(), person.getPosition(),
                        request.reason().trim(), actor.getId());
                added++;
            }
        }
        if (request.externalName() != null && !request.externalName().isBlank()) {
            jdbc.update("insert into training_participants(id, activity_id, session_id, external_name, external_org, full_name, added_reason, created_by) values (?,?,?,?,?,?,?,?)",
                    UUID.randomUUID(), id, request.sessionId(), request.externalName().trim(), request.externalOrg(), request.externalName().trim(), request.reason().trim(), actor.getId());
            added++;
        }
        if (request.externals() != null) {
            for (ExternalPerson outsider : request.externals()) {
                if (outsider == null || outsider.name() == null || outsider.name().isBlank()) continue;
                jdbc.update("insert into training_participants(id, activity_id, session_id, external_name, external_org, full_name, added_reason, created_by) values (?,?,?,?,?,?,?,?)",
                        UUID.randomUUID(), id, request.sessionId(), outsider.name().trim(), outsider.org() == null || outsider.org().isBlank() ? null : outsider.org().trim(), outsider.name().trim(), request.reason().trim(), actor.getId());
                added++;
            }
        }
        if (added == 0) throw new IllegalArgumentException("TRAINING_PARTICIPANT_REQUIRED");
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "PARTICIPANTS_ADDED", Map.of("count", added, "reason", request.reason().trim()), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_PARTICIPANTS_ADDED", null, null, added + " added: " + request.reason().trim());
        return get(actor, id);
    }

    /** The person who prepared the list confirms it before the activity is notified (APD.0117 section 4). */
    @Transactional
    public Map<String, Object> confirmList(UserAccount actor, UUID id, CommandRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireStatus(activity, "PLANNED");
        Integer people = jdbc.queryForObject("select count(*) from training_participants where activity_id=?", Integer.class, id);
        if (people == null || people == 0) throw new IllegalArgumentException("TRAINING_PARTICIPANT_REQUIRED");
        UUID signature = sign(actor, activity, "TRAINING_LIST_VERIFIED", request);
        jdbc.update("update training_activities set list_prepared_by=?, version=version+1, updated_at=now() where id=?", actor.getId(), id);
        confirmation(id, null, "ATTENDEE_LIST_PREPARED", actor, signature, null, null);
        store.auditActivity(actor, activity, "TRAINING_LIST_CONFIRMED", null, null, "Attendee list confirmed");
        return get(actor, id);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ approvers and content

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleApprovers(UserAccount actor, UUID id, String step, String search, int page, int limit) {
        Map<String, Object> activity = visible(actor, id);
        return approvals.eligibleApprovers(actor, TrainingApprovalService.activity(activity), step, search, page, limit, keptApart(activity, step));
    }

    @Transactional
    public Map<String, Object> designate(UserAccount actor, UUID id, String step, UUID assignee) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        approvals.designate(actor, TrainingApprovalService.activity(activity), step, assignee, keptApart(activity, step));
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> reassign(UserAccount actor, UUID id, UUID assignmentId, UUID assignee, String reason) {
        Map<String, Object> activity = store.activityForUpdate(id).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        String step = jdbc.queryForObject("select step_code from training_approval_assignments where id=? and object_id=?", String.class, assignmentId, id);
        approvals.reassign(actor, TrainingApprovalService.activity(activity), assignmentId, assignee, reason, keptApart(activity, step));
        return get(actor, id);
    }

    /** Review and approval of the content and the test (SOP 5.3.5): each by the person designated for the step, who signs. */
    @Transactional
    public Map<String, Object> confirmContent(UserAccount actor, UUID id, String step, CommandRequest request) {
        if (!"CONTENT_REVIEW".equals(step) && !"CONTENT_APPROVE".equals(step)) throw new IllegalArgumentException("TRAINING_STEP_UNKNOWN");
        Map<String, Object> activity = store.activityForUpdate(id).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireStatus(activity, "PLANNED", "NOTIFIED");
        if ("CONTENT_APPROVE".equals(step) && !confirmed(id, "CONTENT_REVIEWED")) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_NOT_REVIEWED");
        if (confirmed(id, "CONTENT_REVIEWED") && "CONTENT_REVIEW".equals(step)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        UUID assignment = approvals.requireCanSign(actor, TrainingApprovalService.activity(activity), step, keptApart(activity, step));
        UUID signature = sign(actor, activity, approvals.step(step).meaning(), request);
        approvals.complete(assignment, signature);
        confirmation(id, null, "CONTENT_REVIEW".equals(step) ? "CONTENT_REVIEWED" : "CONTENT_APPROVED", actor, signature, assignment, null);
        store.auditActivity(actor, activity, "TRAINING_" + step, null, null, "Content " + ("CONTENT_REVIEW".equals(step) ? "reviewed" : "approved"));
        return get(actor, id);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the course of the activity

    @Transactional
    public Map<String, Object> notifyActivity(UserAccount actor, UUID id, CommandRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireVersion(activity, request == null ? null : request.version());
        requireStatus(activity, "PLANNED");
        if (activity.get("list_prepared_by") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LIST_NOT_CONFIRMED");
        boolean externalActivity = isExternal(id);
        if (externalActivity && blankToNull((String) activity.get("training_unit_name")) == null) throw new IllegalArgumentException("TRAINING_UNIT_REQUIRED");
        if (!externalActivity && (!confirmed(id, "CONTENT_REVIEWED") || !confirmed(id, "CONTENT_APPROVED"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CONTENT_NOT_APPROVED");
        Integer sessions = jdbc.queryForObject("select count(*) from training_sessions where activity_id=? and status='PLANNED'", Integer.class, id);
        if (sessions == null || sessions == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_REQUIRED");
        Integer noTrainer = externalActivity ? 0 : jdbc.queryForObject("select count(*) from training_sessions where activity_id=? and status='PLANNED' and trainer_user_id is null and external_trainer_name is null", Integer.class, id);
        if (noTrainer != null && noTrainer > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRAINER_REQUIRED");
        for (UUID sessionId : jdbc.queryForList("select id from training_sessions where activity_id=? and status='PLANNED'", UUID.class, id)) {
            if (!trainers.cleared(sessionId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_TRAINER_NOT_QUALIFIED");
        }
        jdbc.update("update training_participants set notified_at=now() where activity_id=?", id);
        transition(actor, activity, "NOTIFIED", "TRAINING_ACTIVITY_NOTIFIED", "Participants notified");
        for (UUID personId : jdbc.queryForList("select distinct person_user_id from training_participants where activity_id=? and person_user_id is not null", UUID.class, id)) {
            users.findById(personId).ifPresent(person -> notifier.send("TRAINING_INVITED", person, actor, "Training: you are invited",
                    "You are invited to the training " + activity.get("training_number") + ": " + activity.get("training_title") + (activity.get("due_date") == null ? "." : ". Due " + activity.get("due_date") + "."),
                    "TRAINING_ACTIVITY", id, null));
        }
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> holdSession(UserAccount actor, UUID sessionId, HoldRequest request) {
        Map<String, Object> session = session(sessionId);
        Map<String, Object> activity = store.activityForUpdate((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireConductor(actor, activity);
        requireStatus(activity, "NOTIFIED", "IN_PROGRESS");
        if (!"PLANNED".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        LocalDate heldOn = request == null || request.heldOn() == null ? LocalDate.now(TrainingNumberService.ZONE) : request.heldOn();
        if (heldOn.isAfter(LocalDate.now(TrainingNumberService.ZONE))) throw new IllegalArgumentException("TRAINING_DATE_IN_FUTURE");
        jdbc.update("update training_sessions set status='HELD', held_on=?, version=version+1 where id=?", heldOn, sessionId);
        if ("NOTIFIED".equals(activity.get("status"))) transition(actor, activity, "IN_PROGRESS", "TRAINING_SESSION_HELD", "First session held on " + heldOn);
        else store.auditActivity(actor, activity, "TRAINING_SESSION_HELD", null, null, "Session " + session.get("session_no") + " held on " + heldOn);
        return get(actor, (UUID) activity.get("id"));
    }

    @Transactional
    public Map<String, Object> postponeSession(UserAccount actor, UUID sessionId, PostponeRequest request) {
        Map<String, Object> session = session(sessionId);
        Map<String, Object> activity = store.activityForUpdate((UUID) session.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireOrganizer(actor, activity);
        requireStatus(activity, "PLANNED", "NOTIFIED", "IN_PROGRESS");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.newDate() == null) throw new IllegalArgumentException("TRAINING_DATE_REQUIRED");
        if (!"PLANNED".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        // The number is kept; the postponement is a recorded event with the reason and both dates (SOP, TR-04).
        jdbc.update("update training_sessions set scheduled_on=?, postpone_reason=?, version=version+1 where id=?", request.newDate(), request.reason().trim(), sessionId);
        store.event(TrainingStore.OBJECT_ACTIVITY, (UUID) activity.get("id"), (UUID) activity.get("id"), "SESSION_POSTPONED",
                Map.of("sessionNo", session.get("session_no"), "from", String.valueOf(session.get("scheduled_on")), "to", request.newDate().toString(), "reason", request.reason().trim()), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_SESSION_POSTPONED", String.valueOf(session.get("scheduled_on")), request.newDate().toString(), request.reason().trim());
        return get(actor, (UUID) activity.get("id"));
    }

    @Transactional
    public Map<String, Object> recordAttendance(UserAccount actor, UUID participantId, AttendanceRequest request) {
        Map<String, Object> participant = participant(participantId);
        Map<String, Object> activity = store.activityForUpdate((UUID) participant.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireConductor(actor, activity);
        requireStatus(activity, "IN_PROGRESS");
        if (request == null || request.state() == null || !Set.of("ATTENDED", "ONLINE", "ABSENT").contains(request.state())) throw new IllegalArgumentException("TRAINING_ATTENDANCE_INVALID");
        Map<String, Object> session = session((UUID) participant.get("session_id"));
        if (!"HELD".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_HELD");
        if (!"INVITED".equals(participant.get("state"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ATTENDANCE_ALREADY");
        if ("ABSENT".equals(request.state()) && (request.absenceReason() == null || request.absenceReason().isBlank())) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (participant.get("person_user_id") != null && participant.get("person_user_id").equals(actor.getId())) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        // An external training has no score: the person who attended has completed it.
        String result = "EXTERNAL".equals(activity.get("kind")) && !"ABSENT".equals(request.state()) ? "PASSED" : "PENDING";
        jdbc.update("update training_participants set state=?, absence_reason=?, result=?, version=version+1 where id=?", request.state(),
                "ABSENT".equals(request.state()) ? request.absenceReason().trim() : null, result, participantId);
        store.auditActivity(actor, activity, "TRAINING_ATTENDANCE_RECORDED", String.valueOf(participant.get("state")), request.state(), String.valueOf(participant.get("full_name")));
        return get(actor, (UUID) activity.get("id"));
    }

    /**
     * Correcting an attendance that was recorded by mistake. It needs a reason and no signature; the old and the new value and the reason are written to the Audit Trail and to the events.
     * Only while the training is in progress and before the person has a score, a test attempt or a transcribed result, so a result never rests on an attendance that was changed afterwards.
     */
    @Transactional
    public Map<String, Object> correctAttendance(UserAccount actor, UUID participantId, CorrectionRequest request) {
        Map<String, Object> participant = participant(participantId);
        Map<String, Object> activity = store.activityForUpdate((UUID) participant.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireConductor(actor, activity);
        requireStatus(activity, "IN_PROGRESS");
        if (request == null || request.state() == null || !Set.of("ATTENDED", "ONLINE", "ABSENT").contains(request.state())) throw new IllegalArgumentException("TRAINING_ATTENDANCE_INVALID");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (participant.get("person_user_id") != null && participant.get("person_user_id").equals(actor.getId())) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        String before = String.valueOf(participant.get("state"));
        if (!Set.of("ATTENDED", "ONLINE", "ABSENT").contains(before)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ATTENDANCE_NOT_RECORDED");
        if (before.equals(request.state())) throw new IllegalArgumentException("TRAINING_ATTENDANCE_UNCHANGED");
        Integer used = jdbc.queryForObject("""
            select (select count(*) from training_assessments where participant_id = ?) + (select count(*) from training_exam_attempts where participant_id = ?)
                 + (select count(*) from training_transcription_lines where participant_id = ?)
            """, Integer.class, participantId, participantId, participantId);
        if (!"PENDING".equals(participant.get("result")) || (used != null && used > 0)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ATTENDANCE_HAS_RESULT");
        String result = "EXTERNAL".equals(activity.get("kind")) && !"ABSENT".equals(request.state()) ? "PASSED" : "PENDING";
        String reason = request.reason().trim();
        // The earlier way of confirming no longer describes the row, so it is cleared; the Audit Trail keeps what it was.
        jdbc.update("update training_participants set state=?, absence_reason=?, result=?, sign_mode='NONE', attend_signature_id=null, version=version+1 where id=?",
                request.state(), "ABSENT".equals(request.state()) ? reason : null, result, participantId);
        store.event(TrainingStore.OBJECT_ACTIVITY, (UUID) activity.get("id"), (UUID) activity.get("id"), "ATTENDANCE_CORRECTED",
                Map.of("participant", String.valueOf(participant.get("full_name")), "from", before, "to", request.state(), "reason", reason, "was", String.valueOf(participant.get("sign_mode"))), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_ATTENDANCE_CORRECTED", before, request.state(), participant.get("full_name") + " (was " + participant.get("sign_mode") + "): " + reason);
        return get(actor, (UUID) activity.get("id"));
    }

    /** The result is computed here from the score and the pass mark in force; the screen cannot send a result. The person who marks is not the person marked. */
    @Transactional
    public Map<String, Object> recordAssessment(UserAccount actor, UUID participantId, AssessmentRequest request) {
        Map<String, Object> participant = participant(participantId);
        Map<String, Object> activity = store.activityForUpdate((UUID) participant.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.require(actor, "training.assessment.record");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        requireStatus(activity, "IN_PROGRESS");
        if (participant.get("person_user_id") != null && participant.get("person_user_id").equals(actor.getId())) throw new IllegalArgumentException("TRAINING_ASSESSMENT_SELF");
        String state = String.valueOf(participant.get("state"));
        if (!"ATTENDED".equals(state) && !"ONLINE".equals(state)) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        if ("PASSED".equals(participant.get("result"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_RESULT_ALREADY_PASSED");
        Map<String, Object> session = session((UUID) participant.get("session_id"));
        if (session.get("assessment_method") == null || "SELF_READING_CONFIRMATION".equals(session.get("assessment_method"))) throw new IllegalArgumentException("TRAINING_ASSESSMENT_METHOD_INVALID");
        if (request == null || request.scoreObtained() == null || request.scoreMax() == null || request.scoreMax().signum() <= 0
                || request.scoreObtained().signum() < 0 || request.scoreObtained().compareTo(request.scoreMax()) > 0) throw new IllegalArgumentException("TRAINING_SCORE_INVALID");
        int pass = settings.passPercent();
        BigDecimal percent = request.scoreObtained().multiply(BigDecimal.valueOf(100)).divide(request.scoreMax(), 2, RoundingMode.HALF_UP);
        String result = percent.compareTo(BigDecimal.valueOf(pass)) >= 0 ? "PASSED" : "FAILED";
        Integer attempt = jdbc.queryForObject("select coalesce(max(attempt_no),0)+1 from training_assessments where participant_id=?", Integer.class, participantId);
        jdbc.update("""
            insert into training_assessments(id, participant_id, attempt_no, method, score_obtained, score_max, percent, pass_percent_snapshot, result, assessed_by, remarks)
            values (?,?,?,?,?,?,?,?,?,?,?)
            """, UUID.randomUUID(), participantId, attempt, session.get("assessment_method"), request.scoreObtained(), request.scoreMax(), percent, pass, result, actor.getId(), request.remarks());
        jdbc.update("update training_participants set result=?, version=version+1 where id=?", result, participantId);
        store.auditActivity(actor, activity, "TRAINING_ASSESSMENT_RECORDED", null, result, participant.get("full_name") + ": " + percent + "% (pass mark " + pass + "%), attempt " + attempt);
        return get(actor, (UUID) activity.get("id"));
    }

    /** Self-reading: the person confirms having read and understood, with a signature (TR-16). Only for the person's own row. */
    @Transactional
    public Map<String, Object> confirmRead(UserAccount actor, UUID participantId, CommandRequest request) {
        Map<String, Object> participant = participant(participantId);
        if (!actor.getId().equals(participant.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        access.require(actor, "training.self.view");
        Map<String, Object> activity = store.activityForUpdate((UUID) participant.get("activity_id")).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireStatus(activity, "NOTIFIED", "IN_PROGRESS");
        Map<String, Object> session = session((UUID) participant.get("session_id"));
        if (!"SELF_READING".equals(session.get("method")) || !"PLANNED".equals(session.get("status")) && !"HELD".equals(session.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        if (!"INVITED".equals(participant.get("state"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
        UUID signature = sign(actor, activity, "TRAINING_READ_CONFIRMED", request);
        jdbc.update("update training_participants set state='READ_CONFIRMED', sign_mode='ESIGN', attend_signature_id=?, read_confirmed_at=now(), version=version+1 where id=?", signature, participantId);
        store.auditActivity(actor, activity, "TRAINING_READ_CONFIRMED", "INVITED", "READ_CONFIRMED", String.valueOf(participant.get("full_name")));
        return TrainingRows.camel(store.activity((UUID) activity.get("id")).orElseThrow());
    }

    /** The head of the person confirms the self-reading of the people who confirmed it (TR-16); they are then treated as having passed. */
    @Transactional
    public Map<String, Object> verifySelfReading(UserAccount actor, UUID activityId, CommandRequest request) {
        Map<String, Object> activity = store.activityForUpdate(activityId).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireConductor(actor, activity);
        requireStatus(activity, "IN_PROGRESS", "NOTIFIED");
        List<Map<String, Object>> rows = jdbc.queryForList("select id, person_user_id from training_participants where activity_id=? and state='READ_CONFIRMED' and result='PENDING'", activityId);
        if (rows.isEmpty()) throw new IllegalArgumentException("TRAINING_PARTICIPANT_REQUIRED");
        if (rows.stream().anyMatch(r -> actor.getId().equals(r.get("person_user_id")))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        UUID signature = sign(actor, activity, "TRAINING_READ_VERIFIED", request);
        for (Map<String, Object> row : rows) jdbc.update("update training_participants set result='PASSED', version=version+1 where id=?", row.get("id"));
        confirmation(activityId, null, "HEAD_SELF_READING", actor, signature, null, rows.size() + " self-readings verified");
        if ("NOTIFIED".equals(activity.get("status"))) transition(actor, activity, "IN_PROGRESS", "TRAINING_READ_VERIFIED", rows.size() + " self-readings verified");
        else store.auditActivity(actor, activity, "TRAINING_READ_VERIFIED", null, null, rows.size() + " self-readings verified");
        return get(actor, activityId);
    }

    @Transactional
    public Map<String, Object> submitForConfirmation(UserAccount actor, UUID id, CommandRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireVersion(activity, request == null ? null : request.version());
        requireStatus(activity, "IN_PROGRESS");
        Integer open = jdbc.queryForObject("select count(*) from training_sessions where activity_id=? and status in ('PLANNED','POSTPONED')", Integer.class, id);
        if (open != null && open > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_SESSION_NOT_HELD");
        Integer invited = jdbc.queryForObject("select count(*) from training_participants where activity_id=? and state='INVITED'", Integer.class, id);
        if (invited != null && invited > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PARTICIPANT_NOT_FINAL");
        Integer pending = jdbc.queryForObject("select count(*) from training_participants where activity_id=? and state in ('ATTENDED','ONLINE','READ_CONFIRMED') and result='PENDING'", Integer.class, id);
        if (pending != null && pending > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_RESULT_PENDING");
        Map<String, Object> qa = qaList(activity);
        boolean late = qa != null && "OVERDUE".equals(qa.get("state"));
        transition(actor, activity, "PENDING_QA_CONFIRMATION", "TRAINING_SUBMITTED_FOR_CONFIRMATION", late ? "Results sent to QA late: the list was due on " + qa.get("dueOn") + " (SOP.0003 5.3.6)" : "Results sent to QA");
        return get(actor, id);
    }

    /** QA confirms the activity is complete (APD.0117 section 6): a person who holds the permission, not the one who prepared the list, with a signature. */
    @Transactional
    public Map<String, Object> confirmCompletion(UserAccount actor, UUID id, CommandRequest request) {
        Map<String, Object> activity = store.activityForUpdate(id).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireVersion(activity, request == null ? null : request.version());
        requireStatus(activity, "PENDING_QA_CONFIRMATION");
        UUID assignment = approvals.requireCanSign(actor, TrainingApprovalService.activity(activity), "ACTIVITY_COMPLETE", keptApart(activity, "ACTIVITY_COMPLETE"));
        UUID signature = sign(actor, activity, "TRAINING_COMPLETED", request);
        approvals.complete(assignment, signature);
        LocalDate completedOn = jdbc.queryForObject("select coalesce(max(held_on), current_date) from training_sessions where activity_id=? and status='HELD'", LocalDate.class, id);
        jdbc.update("update training_activities set status='COMPLETED', confirmed_by=?, confirmed_at=now(), confirm_signature_id=?, completed_on=?, version=version+1, updated_at=now() where id=?",
                actor.getId(), signature, completedOn, id);
        confirmation(id, null, "QA_COMPLETION", actor, signature, assignment, null);
        int records = writeRecords(activity, completedOn);
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, "COMPLETED", Map.of("completedOn", String.valueOf(completedOn), "records", records), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_ACTIVITY_COMPLETED", "PENDING_QA_CONFIRMATION", "COMPLETED", records + " personal training records written");
        return get(actor, id);
    }

    /** One record per passed or verified person and topic. The server writes them; no screen or API can add, change or delete one. */
    private int writeRecords(Map<String, Object> activity, LocalDate completedOn) {
        List<Map<String, Object>> people = jdbc.queryForList("""
            select p.*, s.method as session_method, s.held_on, s.id as sid from training_participants p join training_sessions s on s.id = p.session_id
             where p.activity_id=? and p.person_user_id is not null and p.result='PASSED' and s.status='HELD'
            """, activity.get("id"));
        int count = 0;
        for (Map<String, Object> person : people) {
            String result = "READ_CONFIRMED".equals(person.get("state")) ? "READ" : "EXTERNAL".equals(activity.get("kind")) ? "ATTENDED" : "PASSED";
            for (Map<String, Object> topic : jdbc.queryForList("select topic_text, document_number, revision_number from training_session_topics where session_id=?", person.get("sid"))) {
                String text = String.valueOf(topic.get("topic_text"));
                String hash = sha256(activity.get("training_number") + "|" + person.get("person_user_id") + "|" + text + "|" + topic.get("document_number") + "|" + topic.get("revision_number") + "|" + person.get("held_on") + "|" + result);
                jdbc.update("""
                    insert into training_records(id, person_user_id, activity_id, session_id, participant_id, training_number, topic_text, document_number, document_revision, completed_on,
                      method, result, employee_code, full_name, department, position, content_sha256) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """, UUID.randomUUID(), person.get("person_user_id"), activity.get("id"), person.get("sid"), person.get("id"), activity.get("training_number"), text,
                        topic.get("document_number"), topic.get("revision_number"), person.get("held_on") == null ? completedOn : ((java.sql.Date) person.get("held_on")).toLocalDate(),
                        person.get("session_method") == null ? "EXTERNAL" : person.get("session_method"), result, person.get("employee_code"), person.get("full_name"), person.get("department"), person.get("position"), hash);
                count++;
            }
        }
        return count;
    }

    @Transactional
    public Map<String, Object> cancel(UserAccount actor, UUID id, CommandRequest request) {
        Map<String, Object> activity = lockedForOrganizer(actor, id);
        requireVersion(activity, request == null ? null : request.version());
        requireStatus(activity, "PLANNED", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        Integer passed = jdbc.queryForObject("select count(*) from training_participants where activity_id=? and result='PASSED'", Integer.class, id);
        if (passed != null && passed > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_HAS_RESULTS");
        store.cancel(activity, request.reason().trim(), actor);
        return get(actor, id);
    }

    /** Make-up for people who were absent, or retraining for people who failed: a new activity under the same number with the next letter (TR-02). */
    @Transactional
    public Map<String, Object> supplementary(UserAccount actor, UUID id, SupplementaryRequest request) {
        Map<String, Object> parent = lockedForOrganizer(actor, id);
        requireStatus(parent, "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED");
        if (request == null || request.participantIds() == null || request.participantIds().isEmpty()) throw new IllegalArgumentException("TRAINING_PARTICIPANT_REQUIRED");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (parent.get("parent_activity_id") != null) throw new IllegalArgumentException("TRAINING_SUPPLEMENTARY_OF_ROOT_ONLY");
        List<Map<String, Object>> people = new ArrayList<>();
        boolean failed = false;
        for (UUID participantId : request.participantIds()) {
            Map<String, Object> p = participant(participantId);
            if (!id.equals(p.get("activity_id"))) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
            if (!"ABSENT".equals(p.get("state")) && !"FAILED".equals(p.get("result"))) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
            failed |= "FAILED".equals(p.get("result"));
            people.add(p);
        }
        String suffix = numbers.nextSuffix(id);
        UUID childId = UUID.randomUUID();
        String number = parent.get("base_number") + suffix;
        jdbc.update("""
            insert into training_activities(id, training_number, base_number, suffix, parent_activity_id, organizer_department_id, year, serial, kind, kind_reason, training_title, status,
              document_id, revision_id, revision_number, document_number, document_name, remarks, created_by)
            values (?,?,?,?,?,?,?,?,'RETRAINING',?,?,'PLANNED',?,?,?,?,?,?,?)
            """, childId, number, parent.get("base_number"), suffix, id, parent.get("organizer_department_id"), parent.get("year"), parent.get("serial"),
                failed ? "FAILED_ASSESSMENT" : "ABSENT_MAKEUP", parent.get("training_title"), parent.get("document_id"), parent.get("revision_id"), parent.get("revision_number"),
                parent.get("document_number"), parent.get("document_name"), request.reason().trim(), actor.getId());
        Map<String, Object> child = store.activity(childId).orElseThrow();
        store.event(TrainingStore.OBJECT_ACTIVITY, childId, childId, "NUMBER_ISSUED", Map.of("number", number, "parent", String.valueOf(parent.get("training_number"))), actor.getId());
        store.auditActivity(actor, child, "TRAINING_ACTIVITY_CREATED", null, "PLANNED", "Supplementary of " + parent.get("training_number") + ": " + request.reason().trim());
        return get(actor, childId);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ helpers

    private Map<String, Object> visible(UserAccount actor, UUID id) {
        access.require(actor, "training.activity.view");
        Map<String, Object> activity = store.activity(id).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        return activity;
    }

    /**
     * Takes a person off the attendee list before the list is confirmed and before anything was recorded for the person. Nothing is changed afterwards: a person who
     * cannot come is marked absent instead. What was removed, by whom and why stays in the Audit Trail.
     */
    @Transactional
    public Map<String, Object> removeParticipant(UserAccount actor, UUID participantId, ReasonRequest request) {
        Map<String, Object> p = jdbc.queryForList("select * from training_participants where id=? for update", participantId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) p.get("activity_id");
        Map<String, Object> activity = lockedForOrganizer(actor, activityId);
        requireStatus(activity, "PLANNED");
        if (activity.get("list_prepared_by") != null || !"INVITED".equals(p.get("state"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PARTICIPANT_LOCKED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("delete from training_participants where id=?", participantId);
        store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "PARTICIPANT_REMOVED", Map.of("name", String.valueOf(p.get("full_name")), "reason", request.reason().trim()), actor.getId());
        store.auditActivity(actor, activity, "TRAINING_PARTICIPANT_REMOVED", null, null, p.get("full_name") + ": " + request.reason().trim());
        return get(actor, activityId);
    }

    /** Marks a person who is known to be away before the training (an empty reason clears the mark). The person stays in the attendee list, as the SOP requires. */
    @Transactional
    public Map<String, Object> setPlannedAbsence(UserAccount actor, UUID participantId, ReasonRequest request) {
        Map<String, Object> p = jdbc.queryForList("select * from training_participants where id=? for update", participantId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID activityId = (UUID) p.get("activity_id");
        Map<String, Object> activity = lockedForOrganizer(actor, activityId);
        requireStatus(activity, "PLANNED", "NOTIFIED");
        if (!"INVITED".equals(p.get("state"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PARTICIPANT_LOCKED");
        String reason = request == null || request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();
        jdbc.update("update training_participants set planned_absence=?, version=version+1 where id=?", reason, participantId);
        store.auditActivity(actor, activity, reason == null ? "TRAINING_PLANNED_ABSENCE_CLEARED" : "TRAINING_PLANNED_ABSENCE_SET", null, null, p.get("full_name") + (reason == null ? "" : ": " + reason));
        return get(actor, activityId);
    }

    private boolean isExternal(UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select kind = 'EXTERNAL' from training_activities where id=?", Boolean.class, id));
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private Map<String, Object> lockedForOrganizer(UserAccount actor, UUID id) {
        Map<String, Object> activity = store.activityForUpdate(id).orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        requireOrganizer(actor, activity);
        return activity;
    }

    private void requireOrganizer(UserAccount actor, Map<String, Object> activity) {
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
    }

    private void requireConductor(UserAccount actor, Map<String, Object> activity) {
        access.require(actor, "training.activity.conduct", "training.activity.organize");
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
    }

    private static void requireVersion(Map<String, Object> activity, Integer version) {
        if (version == null || version.intValue() != ((Number) activity.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_VERSION_CHANGED");
    }

    private static void requireStatus(Map<String, Object> activity, String... allowed) {
        String status = String.valueOf(activity.get("status"));
        for (String s : allowed) if (s.equals(status)) return;
        throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_INVALID_TRANSITION");
    }

    private void transition(UserAccount actor, Map<String, Object> activity, String to, String action, String comment) {
        UUID id = (UUID) activity.get("id");
        String from = String.valueOf(activity.get("status"));
        store.setStatus(id, to);
        store.event(TrainingStore.OBJECT_ACTIVITY, id, id, to, Map.of("from", from), actor.getId());
        store.auditActivity(actor, activity, action, from, to, comment);
    }

    private Map<String, Object> session(UUID id) {
        return jdbc.queryForList("select * from training_sessions where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private Map<String, Object> participant(UUID id) {
        return jdbc.queryForList("select * from training_participants where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private boolean confirmed(UUID activityId, String kind) {
        Integer count = jdbc.queryForObject("select count(*) from training_activity_confirmations where activity_id=? and kind=?", Integer.class, activityId, kind);
        return count != null && count > 0;
    }

    private void confirmation(UUID activityId, UUID sessionId, String kind, UserAccount actor, UUID signatureId, UUID assignmentId, String remark) {
        jdbc.update("insert into training_activity_confirmations(id, activity_id, session_id, kind, confirmed_by, signature_id, assignment_id, remark) values (?,?,?,?,?,?,?,?)",
                UUID.randomUUID(), activityId, sessionId, kind, actor.getId(), signatureId, assignmentId, remark);
    }

    private UUID sign(UserAccount actor, Map<String, Object> activity, String meaning, CommandRequest request) {
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        return signatures.createEntitySignature("TRAINING_ACTIVITY", (UUID) activity.get("id"), String.valueOf(activity.get("training_number")), actor,
                request.signatureToken(), meaning, signReason(request, meaning), null, null, null).getId();
    }

    /** The signing rules ask for a reason with every signature: the one the person typed, else a plain sentence for the action signed. */
    private static String signReason(CommandRequest request, String meaning) {
        if (request.reason() != null && !request.reason().isBlank()) return request.reason().trim();
        return "Training Management: " + meaning.replace("TRAINING_", "").replace('_', ' ').toLowerCase(Locale.ROOT);
    }

    /** The persons who must not handle a step: whoever prepared what is being approved, and whoever reviewed before the approval. */
    private Set<UUID> keptApart(Map<String, Object> activity, String step) {
        Set<UUID> apart = new java.util.HashSet<>();
        UUID id = (UUID) activity.get("id");
        if ("CONTENT_REVIEW".equals(step) || "CONTENT_APPROVE".equals(step)) {
            if (activity.get("created_by") != null) apart.add((UUID) activity.get("created_by"));
            if ("CONTENT_APPROVE".equals(step)) apart.addAll(jdbc.queryForList("select confirmed_by from training_activity_confirmations where activity_id=? and kind='CONTENT_REVIEWED'", UUID.class, id));
        } else if ("ACTIVITY_COMPLETE".equals(step)) {
            if (activity.get("list_prepared_by") != null) apart.add((UUID) activity.get("list_prepared_by"));
        }
        return apart;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}

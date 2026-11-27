package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The reviews of the training of a person after an event that people handle by hand (SOP.0003 5.1 and 5.3.11): a new employee, a return after more than six months away, a transfer to
 * another department, a transfer to another site. The software holds no leave or staffing data and detects nothing: a person opens the review, works through the checklist of the SOP, links
 * the training activities that were organised, and closes it with an electronic signature. The one who closes it is never the employee.
 */
@Service
public class TrainingPersonnelReviewService {
    public static final String TYPE = "TRAINING_PERSONNEL_REVIEW";

    static final Set<String> KINDS = Set.of("NEW_HIRE", "ABSENCE_RETURN", "DEPT_TRANSFER", "LOCATION_TRANSFER");

    /** Items of reviews opened before the checklist came from the matrix: how they are named when they are read. */
    private static final Map<String, String> EARLIER_LABELS = Map.of(
            "RULES_SAFETY", "Company rules and occupational safety", "GMP_GENERAL", "General GMP principles", "JOB_SPECIFIC", "Job-specific training",
            "SPECIMEN", "Specimen signature", "JOB_ASSIGNMENT", "Job assignment", "REVIEW_RECORDS", "Review the training record", "RETRAINING", "Retraining",
            "ADDITIONAL_TRAINING", "Additional training", "HANDOVER", "Hand over the training record", "NEW_SITE_TRAINING", "Training at the new site");
    private static final Set<String> EARLIER_TRAINING_ITEMS = Set.of("RULES_SAFETY", "GMP_GENERAL", "JOB_SPECIFIC", "RETRAINING", "ADDITIONAL_TRAINING", "NEW_SITE_TRAINING");
    /** Check types the system answers from a record: nobody marks them done. */
    private static final Set<String> FROM_RECORDS = Set.of("TRAINING", "SPECIMEN", "JOB_ASSIGNMENT", "HANDOVER", "JOB_ROLE");

    public record CreateRequest(UUID personUserId, String kind, LocalDate eventDate, LocalDate absenceFrom, LocalDate absenceTo, String departmentTo, String note, List<UUID> jobRoleIds, UUID assigneeUserId) {}
    public record JobRolesRequest(List<UUID> jobRoleIds) {}
    /** The trainings to repeat after an absence: each one is a document number or a topic of the matrix. */
    public record RetrainRequest(List<String> keys) {}
    public record ClassRequest(UUID copyFromActivityId) {}
    public record ChangeCloserRequest(UUID closerUserId, String reason) {}
    public record ItemRequest(String status, UUID activityId, String note) {}
    public record CloseRequest(String signatureToken) {}
    public record CancelRequest(String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingShadow shadow;
    private final TrainingAccess access;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final TrainingActivityService activities;
    private final TrainingApprovalService approvals;
    private final TrainingNotifier notifier;


    public TrainingPersonnelReviewService(JdbcTemplate jdbc, TrainingAccess access, ElectronicSignatureService signatures, AuditTrailService audit, UserAccountRepository users, TrainingActivityService activities,
                                          TrainingApprovalService approvals, TrainingNotifier notifier, TrainingShadow shadow) {
        this.shadow = shadow;
        this.activities = activities;
        this.approvals = approvals;
        this.notifier = notifier;
        this.jdbc = jdbc;
        this.access = access;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
    }

    private static final String SELECT = """
        select r.id, r.review_no, r.person_user_id, u.full_name, u.employee_code, u.avatar, u.department, r.kind, r.status, r.event_date, r.absence_from, r.absence_to, r.department_from, r.department_to, r.note,
               r.created_at, cu.full_name as created_by_name, r.closed_at, xu.full_name as closed_by_name, r.cancel_reason,
               (select count(*) from training_personnel_review_items i where i.review_id = r.id and training_review_item_state(r.id, i.item_code) = 'PENDING') as open_items,
               r.assignee_user_id, (select au.full_name from app_users au where au.id = r.assignee_user_id) as assignee_name,
               (select cl.full_name from training_approval_assignments a join app_users cl on cl.id = a.assignee_user_id where a.object_type = 'TRAINING_PERSONNEL_REVIEW' and a.object_id = r.id
                   and a.step_code = 'REVIEW_CLOSE' and a.status = 'PENDING' limit 1) as closer_name
          from training_personnel_reviews r join app_users u on u.id = r.person_user_id join app_users cu on cu.id = r.created_by left join app_users xu on xu.id = r.closed_by
        """;

    private boolean inScope(UserAccount actor, UUID personId) {
        if (access.allDepartments(actor)) return true;
        UUID department = access.departmentOf(users.findById(personId).orElseThrow());
        return department != null && access.inScope(actor, department);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String kind, String search, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, status, kind, search, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String kind, String search, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.job_assignment.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            where.append(" and lower(trim(u.department)) = lower(trim(?))");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        if (status != null && !status.isBlank()) {
            if (!Set.of("OPEN", "CLOSED", "CANCELLED", "READY_TO_CLOSE").contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            // "Ready to close" is an open review whose every item is settled: it waits for the signature of the person chosen to close it.
            if ("READY_TO_CLOSE".equals(status)) where.append(" and r.status = 'OPEN' and not exists (select 1 from training_personnel_review_items pi where pi.review_id = r.id and training_review_item_state(r.id, pi.item_code) = 'PENDING')");
            else { where.append(" and r.status = ?"); args.add(status); }
        }
        if (kind != null && !kind.isBlank()) {
            if (!KINDS.contains(kind)) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
            where.append(" and r.kind = ?"); args.add(kind);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (eqms_fold(u.full_name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(u.employee_code,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(u.department,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(r.note,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(cu.full_name,'')) like eqms_fold(?) escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().contains(more.get("createdBy"), "cu.full_name")
                .dateRange("r.event_date", more.get("eventFrom"), more.get("eventTo")).timeRange("r.created_at", more.get("createdFrom"), more.get("createdTo"));
        if (more.get("department") != null && !more.get("department").isBlank()) extra.raw("lower(trim(u.department)) = lower(trim(?))", more.get("department"));
        // The same person's own entries, for the "related" card of a detail screen.
        if (more.get("personId") != null && !more.get("personId").isBlank()) extra.raw("r.person_user_id = ?", java.util.UUID.fromString(more.get("personId")));
        if ("true".equals(more.get(TrainingWaiting.PARAM))) extra.raw(TrainingWaiting.personnelReview(), actor.getId());
        // The closer of a review: the person chosen to sign it while it is open, the person who signed it once it is closed (what the Closer column shows).
        if (more.get("closerId") != null && !more.get("closerId").isBlank()) {
            UUID closer = UUID.fromString(more.get("closerId"));
            extra.raw("((r.status = 'CLOSED' and r.closed_by = ?) or (r.status = 'OPEN' and exists (select 1 from training_approval_assignments ca where ca.object_type = 'TRAINING_PERSONNEL_REVIEW' and ca.object_id = r.id"
                    + " and ca.step_code = 'REVIEW_CLOSE' and ca.status = 'PENDING' and ca.assignee_user_id = ?)))", closer, closer);
        }
        where.append(extra.and());
        args.addAll(extra.args());
        Long total = jdbc.queryForObject("select count(*) from training_personnel_reviews r join app_users u on u.id = r.person_user_id left join app_users cu on cu.id = r.created_by" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("employee", "u.full_name", "employeeCode", "u.employee_code", "kind", "r.kind", "eventDate", "r.event_date", "department", "u.department", "status", "r.status", "openItems", "open_items", "createdBy", "cu.full_name", "createdAt", "r.created_at"),
                "r.created_at desc") + " limit ? offset ?", args.toArray()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The people to choose from in the Closer filter: those who are chosen to sign an open review or signed a closed one, among the reviews the person may see. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> closers(UserAccount actor) {
        access.require(actor, "training.job_assignment.view");
        List<Object> args = new ArrayList<>();
        String scope = "";
        if (!access.allDepartments(actor)) {
            scope = " where lower(trim(u.department)) = lower(trim(?))";
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        return TrainingRows.camel(jdbc.queryForList("""
            select distinct c.id, c.full_name from (
                select case when r.status = 'CLOSED' then r.closed_by
                            when r.status = 'OPEN' then (select a.assignee_user_id from training_approval_assignments a where a.object_type = 'TRAINING_PERSONNEL_REVIEW' and a.object_id = r.id
                                                          and a.step_code = 'REVIEW_CLOSE' and a.status = 'PENDING' limit 1) end as person_id
                  from training_personnel_reviews r join app_users u on u.id = r.person_user_id""" + scope + """
            ) x join app_users c on c.id = x.person_id order by c.full_name
            """, args.toArray()));
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.eqms.service.authorization.EngineCapabilities engineCapabilities;

    /** The buttons follow the decision of the Hybrid engine (EngineCapabilities); the keys that name no action stay as the hints were. */
    private Map<String, Object> withEngine(UserAccount actor, Map<String, Object> row, Map<String, Object> caps) {
        return engineCapabilities == null ? caps : engineCapabilities.apply(actor, "TRAINING_PERSONNEL_REVIEW", (UUID) row.get("id"), caps,
                Map.of("editItems", "UPDATE_ITEM", "cancel", "CANCEL"), Map.of("close", "CLOSE", "changeCloser", "CHANGE_CLOSER"));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        access.require(actor, "training.job_assignment.view");
        Map<String, Object> r = jdbc.queryForList(SELECT + " where r.id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID person = (UUID) r.get("person_user_id");
        if (!inScope(actor, person)) throw new SecurityException(TrainingAccess.DENIED);
        Map<String, Object> out = TrainingRows.camel(r);
        // the department whose Job Roles the review offers: the receiving one in a transfer
        Map<String, Object> raw = jdbc.queryForList("select person_user_id, department_to from training_personnel_reviews where id = ?", id).stream().findFirst().orElse(null);
        out.put("matrixDepartmentId", raw == null ? null : matrixDepartment(raw));
        out.put("jobRoleIds", jdbc.queryForList("select unnest(job_role_ids) from training_personnel_reviews where id = ?", UUID.class, id));
        out.put("jobRoles", TrainingRows.camel(jdbc.queryForList("select jr.id, jr.name from training_job_roles jr where jr.id in (select training_review_job_roles(?)) order by jr.name", id)));
        List<Map<String, Object>> items = new ArrayList<>();
        int pending = 0;
        for (Map<String, Object> row : jdbc.queryForList("""
            select i.item_code, i.status as stored_status, training_review_item_state(i.review_id, i.item_code) as status, i.check_type, i.title, i.title_vi, i.hint, i.row_group, i.topic_text, i.document_number, i.annual,
                   i.activity_id, a.training_number, training_activity_topics(a.id) as training_topics, a.status as activity_status, i.note, i.done_at, du.full_name as done_by_name,
                   standing.last_done, standing.status as requirement_status
              from training_personnel_review_items i
              join training_personnel_reviews rv on rv.id = i.review_id
              left join lateral (select s.status, s.last_done from training_requirement_state(rv.person_user_id, i.document_number, i.topic_text, i.annual) s where i.check_type = 'TRAINING') standing on true
              left join training_activities a on a.id = i.activity_id left join app_users du on du.id = i.done_by
             where i.review_id = ? and i.status <> 'REMOVED'
             order by case when i.check_type = 'TRAINING' then 0 else 1 end, case i.row_group when 'FACTORY_GENERAL' then 0 when 'DEPARTMENT_GENERAL' then 1 else 2 end, i.sort_order, i.item_code
            """, id)) {
            Map<String, Object> entry = TrainingRows.camel(row);
            String code = (String) row.get("item_code");
            String type = row.get("check_type") == null ? "MANUAL" : (String) row.get("check_type");
            entry.put("label", row.get("title") != null ? row.get("title") : EARLIER_LABELS.getOrDefault(code, code));
            entry.put("labelVi", row.get("title_vi"));
            entry.put("checkType", type);
            entry.put("canMarkDone", !FROM_RECORDS.contains(type));
            entry.put("systemCheck", "OPEN".equals(r.get("status")) ? systemCheck(row, person) : null);
            if ("PENDING".equals(row.get("status"))) pending++;
            items.add(entry);
        }
        out.put("items", items);
        out.put("openItems", pending);
        boolean open = "OPEN".equals(r.get("status"));
        boolean manage = access.has(actor, "training.job_assignment.manage");
        // The person chosen to close the review; a review opened before the choice existed has none and is closed by anyone who may.
        Map<String, Object> closer = closerAssignment(id);
        boolean ready = open && pending == 0;
        out.put("closerUserId", closer == null ? null : closer.get("assignee_user_id"));
        out.put("closerName", closer == null ? null : closer.get("full_name"));
        out.put("readyToClose", ready);
        out.put("workflow", TrainingWorkflows.personnelReview((String) r.get("status")));
        out.put("capabilities", withEngine(actor, r, Map.of(
                "editItems", open && manage,
                "close", ready && manage && !actor.getId().equals(person) && (closer == null || actor.getId().equals(closer.get("assignee_user_id"))),
                "changeCloser", open && closer != null && access.has(actor, "training.approval.reassign"),
                "cancel", open && manage)));
        if ("ABSENCE_RETURN".equals(r.get("kind"))) {
            LocalDate from = ((Date) r.get("absence_from")).toLocalDate(), to = ((Date) r.get("absence_to")).toLocalDate();
            out.put("absenceOverSixMonths", to.isAfter(from.plusMonths(6)));
        }
        return out;
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, CreateRequest request) {
        access.require(actor, "training.job_assignment.manage");
        if (request == null || request.personUserId() == null || request.kind() == null || !KINDS.contains(request.kind()) || request.eventDate() == null) throw new IllegalArgumentException("TRAINING_REVIEW_INVALID");
        if (!inScope(actor, request.personUserId())) throw new SecurityException(TrainingAccess.DENIED);
        UserAccount person = users.findById(request.personUserId()).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        if (person.getStatus() != com.eqms.entity.UserStatus.Active) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
        validateDates(request);
        // The department that decides who closes the review, and where the employee comes from, are read from the records, never typed.
        Map<String, Object> plan = plan(person, request.kind(), request.departmentTo());
        if (plan.get("problem") != null) throw new IllegalArgumentException((String) plan.get("problem"));
        boolean transfer = "DEPT_TRANSFER".equals(request.kind()) || "LOCATION_TRANSFER".equals(request.kind());
        if (jdbc.queryForObject("select count(*) from training_personnel_reviews where person_user_id = ? and kind = ? and status = 'OPEN'", Integer.class, person.getId(), request.kind()) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ALREADY_OPEN");
        }
        String note = blank(request.note());
        if (note != null && note.length() > 1000) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        UUID id = UUID.randomUUID();
        boolean absence = "ABSENCE_RETURN".equals(request.kind());
        jdbc.update("insert into training_personnel_reviews(id, person_user_id, kind, event_date, absence_from, absence_to, department_from, department_to, note, created_by) values (?,?,?,?,?,?,?,?,?,?)",
                id, person.getId(), request.kind(), Date.valueOf(request.eventDate()), absence ? Date.valueOf(request.absenceFrom()) : null, absence ? Date.valueOf(request.absenceTo()) : null,
                transfer ? plan.get("departmentFrom") : null, transfer ? plan.get("departmentTo") : null, note, actor.getId());
        // the receiving head and an assigned employee review the record of a person who moves to another department (SOP.0003 5.3.11)
        if ("DEPT_TRANSFER".equals(request.kind())) {
            if (request.assigneeUserId() == null) throw new IllegalArgumentException("TRAINING_REVIEW_ASSIGNEE_REQUIRED");
            UserAccount assignee = users.findById(request.assigneeUserId()).orElseThrow(() -> new IllegalArgumentException("TRAINING_REVIEW_ASSIGNEE_REQUIRED"));
            if (assignee.getId().equals(person.getId()) || assignee.getStatus() != com.eqms.entity.UserStatus.Active || !access.has(assignee, "training.job_assignment.manage")) throw new IllegalArgumentException("TRAINING_REVIEW_ASSIGNEE_NOT_ALLOWED");
            jdbc.update("update training_personnel_reviews set assignee_user_id = ? where id = ?", assignee.getId(), id);
        }
        if (request.jobRoleIds() != null && !request.jobRoleIds().isEmpty()) writeJobRoles(id, request.jobRoleIds());
        sync(id);
        jdbc.update("update training_personnel_events set status = 'HANDLED', review_id = ?, closed_at = now(), closed_reason = 'A review of this kind was opened' where status = 'OPEN' and person_user_id = ? and kind = ?", id, person.getId(), request.kind());
        audit.logAs(actor, TYPE, person.getEmployeeCode() != null && !person.getEmployeeCode().isBlank() ? person.getEmployeeCode() : person.getFullName(), id, "TRAINING_PERSONNEL_REVIEW_OPENED", null, "OPEN", request.kind() + (note == null ? "" : ". " + note),
                noteChanges(TrainingStore.change("Review Type", null, TrainingStore.words(String.valueOf(request.kind()))), note));
        // The head of the department signs to close the review, as for the other signing steps.
        approvals.designate(actor, subject(lock(id), person), "REVIEW_CLOSE", (UUID) plan.get("closerUserId"), TrainingApprovalService.apart(person.getId()));
        return get(actor, id);
    }

    /** Dates of the event, as SOP.0003 reads them: the event has happened, and a return follows an absence of more than the months of Training Properties. */
    private void validateDates(CreateRequest request) {
        LocalDate today = LocalDate.now(TrainingNumberService.ZONE);
        if (request.eventDate().isAfter(today)) throw new IllegalArgumentException("TRAINING_REVIEW_DATE_FUTURE");
        if (!"ABSENCE_RETURN".equals(request.kind())) return;
        if (request.absenceFrom() == null || request.absenceTo() == null || request.absenceTo().isBefore(request.absenceFrom())) throw new IllegalArgumentException("TRAINING_REVIEW_ABSENCE_INVALID");
        if (request.absenceTo().isAfter(today)) throw new IllegalArgumentException("TRAINING_REVIEW_DATE_FUTURE");
        if (request.eventDate().isBefore(request.absenceTo())) throw new IllegalArgumentException("TRAINING_REVIEW_RETURN_BEFORE_ABSENCE_END");
        int months = jdbc.queryForObject("select absence_retrain_months from training_settings where id = 1", Integer.class);
        if (!request.absenceTo().isAfter(request.absenceFrom().plusMonths(months))) throw new IllegalArgumentException("TRAINING_REVIEW_ABSENCE_TOO_SHORT");
    }

    /**
     * What the dialog that opens a review needs from the records: the current department of the employee, the department a transfer goes to, the head of the department that closes the review
     * (the department of the employee, or the new one in a transfer), and the months of absence after which the SOP asks for a review. "problem" names what stops the review from being opened.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> plan(UserAccount actor, UUID personId, String kind, String departmentTo) {
        access.require(actor, "training.job_assignment.manage");
        if (!inScope(actor, personId)) throw new SecurityException(TrainingAccess.DENIED);
        return plan(users.findById(personId).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE")), kind, departmentTo);
    }

    private Map<String, Object> plan(UserAccount person, String kind, String departmentTo) {
        boolean transfer = "DEPT_TRANSFER".equals(kind) || "LOCATION_TRANSFER".equals(kind);
        String from = blank(person.getDepartment());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("departmentFrom", from);
        out.put("departmentId", null);
        out.put("absenceRetrainMonths", jdbc.queryForObject("select absence_retrain_months from training_settings where id = 1", Integer.class));
        String target = transfer ? blank(departmentTo) : from;
        String problem = null;
        Map<String, Object> department = null;
        if (target == null) problem = transfer ? "TRAINING_REVIEW_DEPARTMENT_REQUIRED" : "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING";
        else {
            department = jdbc.queryForList("select d.id, d.name, d.department_head_id from departments d where d.is_active and lower(trim(d.name)) = lower(trim(?))", target).stream().findFirst().orElse(null);
            if (department == null) problem = transfer ? "TRAINING_REVIEW_DEPARTMENT_REQUIRED" : "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING";
        }
        if (problem == null && transfer && from != null && "DEPT_TRANSFER".equals(kind) && from.equalsIgnoreCase(String.valueOf(department.get("name")))) problem = "TRAINING_REVIEW_SAME_DEPARTMENT";
        UserAccount head = problem != null || department.get("department_head_id") == null ? null : users.findById((UUID) department.get("department_head_id")).orElse(null);
        if (problem == null && head == null) problem = "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING";
        if (problem == null && head.getId().equals(person.getId())) problem = "TRAINING_REVIEW_HEAD_IS_EMPLOYEE";
        if (problem == null && !access.has(head, "training.job_assignment.manage")) problem = "TRAINING_REVIEW_HEAD_NOT_ALLOWED";
        out.put("departmentTo", transfer && department != null ? department.get("name") : null);
        out.put("departmentId", department == null ? null : department.get("id"));
        out.put("closerUserId", head == null ? null : head.getId());
        out.put("closerName", head == null ? null : head.getFullName());
        out.put("problem", problem);
        return out;
    }

    @Transactional
    public Map<String, Object> updateItem(UserAccount actor, UUID id, String itemCode, ItemRequest request) {
        return shadow.around(actor, "TRAINING_PERSONNEL_REVIEW", id, "UPDATE_ITEM", true, () -> updateItemInner(actor, id, itemCode, request));
    }

    private Map<String, Object> updateItemInner(UserAccount actor, UUID id, String itemCode, ItemRequest request) {
        // who may do this (the permission, the department of the person reviewed, and not the person reviewed for the closing) is decided by the Hybrid engine (TrainingShadow, TRAINING_PERSONNEL_REVIEW); the signature step of the closer chosen stays
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        Map<String, Object> item = item(id, itemCode);
        if (request == null || request.status() == null || !Set.of("PENDING", "DONE", "NOT_NEEDED").contains(request.status())) throw new IllegalArgumentException("TRAINING_PREPARATION_STATUS_INVALID");
        String type = item.get("check_type") == null ? "MANUAL" : (String) item.get("check_type");
        // a line the records answer is never marked done by hand (DEC-TRAINING-2026-11-27-01 B4)
        if ("DONE".equals(request.status()) && FROM_RECORDS.contains(type)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ITEM_NEEDS_RECORD");
        String note = blank(request.note());
        if (note != null && note.length() > 500) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        // Leaving out an item needs a reason, so that the record shows why.
        if ("NOT_NEEDED".equals(request.status()) && note == null) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if ("REVIEW_RECORDS".equals(itemCode) && "DONE".equals(request.status())) {
            if (r.get("assignee_user_id") != null && !r.get("assignee_user_id").equals(actor.getId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "TRAINING_REVIEW_ASSIGNEE_ONLY");
            Integer chosen = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and check_type = 'TRAINING' and status <> 'REMOVED'", Integer.class, id);
            // after an absence the reviewer chooses what is trained again, or says why nothing is
            if ("ABSENCE_RETURN".equals(r.get("kind")) && (chosen == null || chosen == 0) && note == null) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        }
        boolean done = !"PENDING".equals(request.status());
        jdbc.update("update training_personnel_review_items set status = ?, note = ?, done_by = ?, done_at = case when ? then now() else null end where review_id = ? and item_code = ?",
                request.status(), note, done ? actor.getId() : null, done, id, itemCode);
        String label = item.get("title") != null ? (String) item.get("title") : EARLIER_LABELS.getOrDefault(itemCode, itemCode);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_ITEM", null, request.status(), label + (note == null ? "" : ". " + note),
                noteChanges(TrainingStore.change(label + " › Status", null, TrainingStore.words(request.status())), note));
        sync(id);
        if (pending(id) == 0) tellCloser(actor, r);
        return get(actor, id);
    }

    private Map<String, Object> item(UUID id, String itemCode) {
        return jdbc.queryForList("select * from training_personnel_review_items where review_id = ? and item_code = ? and status <> 'REMOVED'", id, itemCode).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("TRAINING_REVIEW_ITEM_INVALID"));
    }

    private int pending(UUID id) {
        Integer n = jdbc.queryForObject("select count(*) from training_personnel_review_items i where i.review_id = ? and training_review_item_state(i.review_id, i.item_code) = 'PENDING'", Integer.class, id);
        return n == null ? 0 : n;
    }

    /**
     * The review as the detail screen shows it. An open review is first brought up to the matrix, the Job Roles and the checklist template as they are now, so nobody has to
     * ask for it; when a line changes, the Audit Trail says so. A closed or cancelled review is read as it was.
     */
    @Transactional
    public Map<String, Object> open(UserAccount actor, UUID id) {
        Map<String, Object> shown = get(actor, id);
        if (!"OPEN".equals(shown.get("status"))) return shown;
        lock(id);
        String before = lineSignature(id);
        sync(id);
        String after = lineSignature(id);
        if (after.equals(before)) return shown;
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_CHECKLIST_UPDATED", null, null, "Checklist updated from the matrix and the checklist template",
                List.of(TrainingStore.change("Checklist Lines", before.isEmpty() ? 0 : before.split("\n").length, after.isEmpty() ? 0 : after.split("\n").length)));
        return get(actor, id);
    }

    private String lineSignature(UUID id) {
        return String.join("\n", jdbc.queryForList("select item_code || ':' || coalesce(title, '') from training_personnel_review_items where review_id = ? and status <> 'REMOVED' order by item_code", String.class, id));
    }

    @Transactional
    public Map<String, Object> setJobRoles(UserAccount actor, UUID id, JobRolesRequest request) {
        manageOpen(actor, id);
        List<UUID> roles = request == null || request.jobRoleIds() == null ? List.of() : request.jobRoleIds();
        writeJobRoles(id, roles);
        List<String> names = jdbc.queryForList("select jr.name from training_job_roles jr where jr.id in (select unnest(job_role_ids) from training_personnel_reviews where id = ?) order by jr.name", String.class, id);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_JOB_ROLES", null, null, names.isEmpty() ? "No Job Role" : String.join(", ", names),
                List.of(TrainingStore.change("Job Roles", null, names.isEmpty() ? "none" : String.join(", ", names))));
        sync(id);
        return get(actor, id);
    }

    private void writeJobRoles(UUID id, List<UUID> roles) {
        for (UUID role : roles) {
            Integer found = jdbc.queryForObject("select count(*) from training_job_roles where id = ? and is_active", Integer.class, role);
            if (found == null || found == 0) throw new IllegalArgumentException("TRAINING_JOB_INVALID");
        }
        jdbc.update("update training_personnel_reviews set job_role_ids = cast(string_to_array(nullif(?, ''), ',') as uuid[]) where id = ?",
                roles.stream().map(String::valueOf).distinct().collect(java.util.stream.Collectors.joining(",")), id);
        jdbc.update("update training_personnel_reviews set job_role_ids = '{}' where id = ? and job_role_ids is null", id);
    }

    /** The trainings a person who was away must repeat, chosen by the reviewer from the matrix of the position (B7.3). */
    @Transactional
    public Map<String, Object> setRetraining(UserAccount actor, UUID id, RetrainRequest request) {
        Map<String, Object> r = manageOpen(actor, id);
        if (!"ABSENCE_RETURN".equals(r.get("kind"))) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
        Set<String> wanted = new java.util.LinkedHashSet<>(request == null || request.keys() == null ? List.<String>of() : request.keys());
        List<String> titles = new ArrayList<>();
        for (Map<String, Object> line : requirements(id, r)) {
            if (!wanted.contains((String) line.get("key"))) continue;
            upsertTraining(id, line);
            titles.add((String) line.get("title"));
        }
        for (Map<String, Object> existing : jdbc.queryForList("select item_code, coalesce(document_number, training_topic_key(topic_text)) as k from training_personnel_review_items where review_id = ? and check_type = 'TRAINING' and status <> 'REMOVED'", id)) {
            if (!wanted.contains((String) existing.get("k"))) jdbc.update("update training_personnel_review_items set status = 'REMOVED' where review_id = ? and item_code = ?", id, existing.get("item_code"));
        }
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_RETRAINING", null, null, titles.isEmpty() ? "Nothing to repeat" : String.join("; ", titles),
                List.of(TrainingStore.change("Trainings To Repeat", null, titles.size())));
        return get(actor, id);
    }

    /** The trainings the matrix asks of the person for the department and Job Roles of the review. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> requirementChoices(UserAccount actor, UUID id) {
        access.require(actor, "training.job_assignment.view");
        Map<String, Object> r = jdbc.queryForList("select * from training_personnel_reviews where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!inScope(actor, (UUID) r.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        return TrainingRows.camel(requirements(id, r));
    }

    private Map<String, Object> manageOpen(UserAccount actor, UUID id) {
        access.require(actor, "training.job_assignment.manage");
        Map<String, Object> r = lock(id);
        if (!inScope(actor, (UUID) r.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        return r;
    }

    /** The department whose matrix the review reads: the receiving one in a transfer, the department of the person otherwise. */
    private UUID matrixDepartment(Map<String, Object> r) {
        String name = r.get("department_to") != null ? (String) r.get("department_to") : users.findById((UUID) r.get("person_user_id")).map(UserAccount::getDepartment).orElse(null);
        if (name == null) return null;
        return jdbc.queryForList("select id from departments where lower(trim(name)) = lower(trim(?))", UUID.class, name).stream().findFirst().orElse(null);
    }

    private List<Map<String, Object>> requirements(UUID id, Map<String, Object> r) {
        UUID department = matrixDepartment(r);
        if (department == null) return List.of();
        return jdbc.queryForList("""
            select coalesce(d.document_number, training_topic_key(e.topic_text)) as key, coalesce(e.topic_text, d.document_name) as title, e.topic_text, d.document_number, e.annual_required, e.row_group, e.row_no
              from training_effective_requirements e left join documents d on d.id = e.document_id
             where e.department_id = ?
               and (e.all_employees or exists (select 1 from training_matrix_cells c join training_job_roles jr on jr.id = c.position_id
                                                 where c.row_id = e.id and jr.department_id = e.department_id and c.position_id in (select training_review_job_roles(?))))
             order by case e.row_group when 'FACTORY_GENERAL' then 0 when 'DEPARTMENT_GENERAL' then 1 else 2 end, e.row_no
            """, department, id);
    }

    private static String trainingCode(String key) {
        try {
            return "T" + java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(key.getBytes(java.nio.charset.StandardCharsets.UTF_8))).substring(0, 32);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private void upsertTraining(UUID id, Map<String, Object> line) {
        String title = line.get("document_number") != null ? line.get("document_number") + " — " + line.get("title") : (String) line.get("title");
        jdbc.update("""
            insert into training_personnel_review_items(review_id, item_code, check_type, title, row_group, topic_text, document_number, annual, sort_order)
            values (?,?,'TRAINING',?,?,?,?,?,?)
            on conflict (review_id, item_code) do update set title = excluded.title, row_group = excluded.row_group, annual = excluded.annual, sort_order = excluded.sort_order,
                status = case when training_personnel_review_items.status = 'REMOVED' then 'PENDING' else training_personnel_review_items.status end
            """, id, trainingCode((String) line.get("key")), title.length() > 500 ? title.substring(0, 500) : title, line.get("row_group"), line.get("topic_text"), line.get("document_number"),
                Boolean.TRUE.equals(line.get("annual_required")), line.get("row_no"));
    }

    /**
     * Brings an open review up to the matrix and the checklist template: new lines are added, lines the matrix no longer asks for are set aside (never deleted).
     * A closed review is not touched: it keeps what it was closed with (B6).
     */
    void sync(UUID id) {
        Map<String, Object> r = jdbc.queryForList("select * from training_personnel_reviews where id = ?", id).stream().findFirst().orElse(null);
        if (r == null || !"OPEN".equals(r.get("status"))) return;
        String kind = (String) r.get("kind");
        // an item of the template that already belongs to this review takes the present wording; a new template item joins only a review opened after it was made
        jdbc.update("""
            insert into training_personnel_review_items(review_id, item_code, check_type, title, title_vi, hint, sort_order)
            select ?, t.item_code, t.check_type, t.title, t.title_vi, t.hint, t.sort_order from training_review_templates t
             where t.kind = ? and t.active and not exists (select 1 from training_personnel_review_items i where i.review_id = ? and i.item_code = t.item_code)
               and (not exists (select 1 from training_personnel_review_items i where i.review_id = ? and i.check_type is not null) or t.locked)
            """, id, kind, id, id);
        jdbc.update("""
            update training_personnel_review_items i set check_type = t.check_type, title = t.title, title_vi = t.title_vi, hint = t.hint, sort_order = t.sort_order
              from training_review_templates t where i.review_id = ? and t.kind = ? and t.item_code = i.item_code and i.check_type is null
            """, id, kind);
        // the fixed training items of the earlier checklist give way to the lines of the matrix
        for (String code : EARLIER_TRAINING_ITEMS) jdbc.update("update training_personnel_review_items set status = 'REMOVED' where review_id = ? and item_code = ? and status = 'PENDING' and check_type is null", id, code);
        if ("ABSENCE_RETURN".equals(kind)) return;
        List<Map<String, Object>> lines = requirements(id, r);
        for (Map<String, Object> line : lines) upsertTraining(id, line);
        Set<String> codes = lines.stream().map(l -> trainingCode((String) l.get("key"))).collect(java.util.stream.Collectors.toSet());
        for (String code : jdbc.queryForList("select item_code from training_personnel_review_items where review_id = ? and check_type = 'TRAINING' and status = 'PENDING'", String.class, id)) {
            if (!codes.contains(code)) jdbc.update("update training_personnel_review_items set status = 'REMOVED' where review_id = ? and item_code = ?", id, code);
        }
        // without a Job Role the training of the position cannot be known: the review waits for one
        jdbc.update("""
            insert into training_personnel_review_items(review_id, item_code, check_type, title, title_vi, hint, sort_order)
            select ?, 'JOB_ROLE', 'JOB_ROLE', 'Job Role of the person', 'Vị trí công việc (Job Role) của nhân viên', 'Choose the Job Role: the training of the position comes from its column of the matrix.', 0
             where not exists (select 1 from training_review_job_roles(?))
            on conflict (review_id, item_code) do update set status = case when training_personnel_review_items.status = 'REMOVED' then 'PENDING' else training_personnel_review_items.status end
            """, id, id);
    }

    // ----------------------------------------------------------------------------------------------------------------------------- initial classes (B3)

    /** The initial training classes that are still open (planned, list not confirmed) and teach something the person still has to learn; and the earlier ones a new class can be copied from. */
    @Transactional(readOnly = true)
    public Map<String, Object> classes(UserAccount actor, UUID id) {
        access.require(actor, "training.job_assignment.view");
        Map<String, Object> r = jdbc.queryForList("select * from training_personnel_reviews where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!inScope(actor, (UUID) r.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        List<Map<String, Object>> open = jdbc.queryForList("""
            select a.id as activity_id, a.training_number, training_activity_topics(a.id) as training_topics, a.created_at,
                   count(distinct i.item_code) as covers,
                   exists (select 1 from training_participants p where p.activity_id = a.id and p.person_user_id = ?) as listed
              from training_activities a join training_sessions s on s.activity_id = a.id and s.status <> 'CANCELLED' join training_session_topics t on t.session_id = s.id
              join training_personnel_review_items i on i.review_id = ? and i.check_type = 'TRAINING' and training_review_item_state(i.review_id, i.item_code) = 'PENDING'
                   and ((i.document_number is not null and t.document_number = i.document_number) or (i.topic_text is not null and training_topic_key(t.topic_text) = training_topic_key(i.topic_text)))
             where a.kind = 'INITIAL' and a.status = 'PLANNED' and a.list_prepared_by is null and a.parent_activity_id is null
             group by a.id order by a.created_at desc limit 20
            """, r.get("person_user_id"), id);
        List<Map<String, Object>> earlier = jdbc.queryForList("""
            select a.id as activity_id, a.training_number, training_activity_topics(a.id) as training_topics, a.created_at from training_activities a
             where a.kind = 'INITIAL' and a.status <> 'CANCELLED' and a.parent_activity_id is null and exists (select 1 from training_sessions s where s.activity_id = a.id and s.status <> 'CANCELLED')
             order by a.created_at desc limit 20
            """);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("open", TrainingRows.camel(open));
        out.put("earlier", TrainingRows.camel(earlier));
        out.put("canCreate", access.has(actor, "training.activity.organize") && access.has(actor, "training.code.allocate"));
        return out;
    }

    /** Puts the person on the sessions of an open initial class that teach what the person still has to learn. */
    @Transactional
    public Map<String, Object> addToClass(UserAccount actor, UUID id, UUID activityId) {
        Map<String, Object> r = manageOpen(actor, id);
        UUID person = (UUID) r.get("person_user_id");
        Integer open = jdbc.queryForObject("select count(*) from training_activities where id = ? and kind = 'INITIAL' and status = 'PLANNED' and list_prepared_by is null", Integer.class, activityId);
        if (open == null || open == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LIST_LOCKED");
        List<UUID> sessions = jdbc.queryForList("""
            select distinct s.id from training_sessions s join training_session_topics t on t.session_id = s.id
              join training_personnel_review_items i on i.review_id = ? and i.check_type = 'TRAINING' and training_review_item_state(i.review_id, i.item_code) = 'PENDING'
                   and ((i.document_number is not null and t.document_number = i.document_number) or (i.topic_text is not null and training_topic_key(t.topic_text) = training_topic_key(i.topic_text)))
             where s.activity_id = ? and s.status <> 'CANCELLED' and s.trainer_user_id is distinct from ?
            """, UUID.class, id, activityId, person);
        if (sessions.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLASS_HAS_NOTHING");
        for (UUID session : sessions) {
            activities.addParticipants(actor, activityId, new TrainingActivityService.ParticipantsRequest(session, List.of(person), null, null, null, "From training review " + r.get("review_no")));
        }
        link(id, activityId);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_ADDED_TO_CLASS", null, null, "Added to " + trainingNumber(activityId),
                List.of(TrainingStore.change("Training Number", null, trainingNumber(activityId))));
        return get(actor, id);
    }

    /**
     * A new initial class with the person on it: one activity (one Training Number, SOP.0003 5.1.4) whose sessions follow the groups of the matrix, or are copied from
     * an earlier initial class with its trainers, materials and assessment (B3, B3.1). Only a person who gives training numbers may make it (5.3.3).
     */
    @Transactional
    public Map<String, Object> createClass(UserAccount actor, UUID id, ClassRequest request) {
        Map<String, Object> r = manageOpen(actor, id);
        UUID person = (UUID) r.get("person_user_id");
        List<TrainingActivityService.InitialSession> wanted = new ArrayList<>();
        for (String group : List.of("FACTORY_GENERAL", "DEPARTMENT_GENERAL", "SOP")) {
            List<TrainingActivityService.TopicRequest> topics = new ArrayList<>();
            for (Map<String, Object> line : jdbc.queryForList("""
                select i.topic_text, i.document_number, (select d.document_name from documents d where d.document_number = i.document_number) as document_name,
                       (select dr.id from document_revisions dr join documents d on d.id = dr.document_id where d.document_number = i.document_number and dr.status_code = 'EFFECTIVE' limit 1) as revision_id
                  from training_personnel_review_items i
                 where i.review_id = ? and i.check_type = 'TRAINING' and i.row_group = ? and training_review_item_state(i.review_id, i.item_code) = 'PENDING' order by i.sort_order
                """, id, group)) {
                String text = line.get("topic_text") != null ? (String) line.get("topic_text") : String.valueOf(line.get("document_name"));
                topics.add(new TrainingActivityService.TopicRequest(text, (UUID) line.get("revision_id")));
            }
            if (!topics.isEmpty()) wanted.add(new TrainingActivityService.InitialSession(topics));
        }
        UUID source = request == null ? null : request.copyFromActivityId();
        if (source == null && wanted.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLASS_HAS_NOTHING");
        UUID activityId = activities.createInitialClass(actor, source, wanted, "From training review " + r.get("review_no"));
        List<UUID> sessions = jdbc.queryForList("select id from training_sessions where activity_id = ? and status <> 'CANCELLED' and trainer_user_id is distinct from ? order by session_no", UUID.class, activityId, person);
        for (UUID session : sessions) {
            activities.addParticipants(actor, activityId, new TrainingActivityService.ParticipantsRequest(session, List.of(person), null, null, null, "From training review " + r.get("review_no")));
        }
        link(id, activityId);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_TRAINING_CREATED", null, trainingNumber(activityId), source == null ? "Initial training class" : "Initial training class copied from " + trainingNumber(source),
                List.of(TrainingStore.change("Training Number", null, trainingNumber(activityId))));
        Map<String, Object> out = get(actor, id);
        out.put("createdActivityId", activityId);
        return out;
    }

    private String trainingNumber(UUID activityId) {
        return jdbc.queryForList("select training_number from training_activities where id = ?", String.class, activityId).stream().findFirst().orElse("");
    }

    /** The lines of the review that a class teaches show it. */
    private void link(UUID reviewId, UUID activityId) {
        jdbc.update("""
            update training_personnel_review_items i set activity_id = ?
             where i.review_id = ? and i.check_type = 'TRAINING' and i.status = 'PENDING'
               and exists (select 1 from training_sessions s join training_session_topics t on t.session_id = s.id
                            where s.activity_id = ? and s.status <> 'CANCELLED' and ((i.document_number is not null and t.document_number = i.document_number)
                                  or (i.topic_text is not null and training_topic_key(t.topic_text) = training_topic_key(i.topic_text))))
            """, activityId, reviewId, activityId);
    }

    /** What the records hold for a line, said in sentences. Null when there is nothing to say about that kind of line. */
    private Map<String, Object> systemCheck(Map<String, Object> item, UUID person) {
        String type = item.get("check_type") == null ? "MANUAL" : (String) item.get("check_type");
        boolean met = "DONE".equals(item.get("status"));
        switch (type) {
            case "TRAINING": {
                Map<String, Object> standing = jdbc.queryForMap("select status, last_done, last_revision, required_revision from training_requirement_state(?, ?, ?, ?)",
                        person, item.get("document_number"), item.get("topic_text"), Boolean.TRUE.equals(item.get("annual")));
                Object last = standing.get("last_done");
                if (last == null) return check(false, part("No training record yet."));
                String when = DateTimeFormatUtils.display(last);
                if ("UPDATE_NEEDED".equals(standing.get("status"))) return check(false, part("Last trained on {date}; the revision now required is not trained.", "date", when));
                if ("DUE".equals(standing.get("status"))) return check(false, part("Last trained on {date}; the periodic training is due.", "date", when));
                return met ? check(true, part("Trained on {date}.", "date", when)) : check(false, part("Last trained on {date}, before the event of this review.", "date", when));
            }
            case "SPECIMEN": {
                List<Map<String, Object>> rows = jdbc.queryForList("select version_no, effective_date from training_specimen_signatures where person_user_id = ? and status = 'APPROVED' order by version_no desc limit 1", person);
                if (rows.isEmpty()) return check(false, part("No specimen signature record yet."));
                Object version = rows.getFirst().get("version_no"), effective = rows.getFirst().get("effective_date");
                return check(true, effective == null ? part("Specimen signature record, version {version}.", "version", version)
                        : part("Specimen signature record, version {version}, effective {date}.", "version", version, "date", DateTimeFormatUtils.display(effective)));
            }
            case "JOB_ASSIGNMENT": {
                List<Map<String, Object>> rows = jdbc.queryForList("select issue_no, effective_at from training_job_assignments where person_user_id = ? and status = 'EFFECTIVE' order by issue_no desc limit 1", person);
                if (rows.isEmpty()) return check(false, part("No effective job assignment yet."));
                Object issue = rows.getFirst().get("issue_no"), effective = rows.getFirst().get("effective_at");
                Map<String, Object> sentence = effective == null ? part("Job assignment, issue {issue}.", "issue", issue)
                        : part("Job assignment, issue {issue}, effective {date}.", "issue", issue, "date", DateTimeFormatUtils.display(effective));
                return met ? check(true, sentence) : check(false, sentence, part("It was made before the event of this review."));
            }
            case "HANDOVER": {
                List<Map<String, Object>> rows = jdbc.queryForList("select generated_at from training_record_exports where person_user_id = ? and status = 'APPROVED' order by generated_at desc nulls last limit 1", person);
                if (rows.isEmpty()) return check(false, part("No approved export of the training record yet (Training Record Exports)."));
                Object generated = rows.getFirst().get("generated_at");
                Map<String, Object> sentence = generated == null ? part("A signed export of the record was approved.")
                        : part("A signed export of the record was approved on {date}.", "date", DateTimeFormatUtils.display(generated));
                return met ? check(true, sentence) : check(false, sentence, part("It was made before the event of this review."));
            }
            default:
                return null;
        }
    }

    /** The result is sent as sentences with their values apart, so that the screen writes them in the language of the reader. */
    private static Map<String, Object> check(boolean found, Map<?, ?>... parts) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("found", found);
        out.put("parts", java.util.Arrays.stream(parts).filter(java.util.Objects::nonNull).toList());
        return out;
    }

    private static Map<String, Object> part(String template, Object... namesAndValues) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < namesAndValues.length; i += 2) values.put((String) namesAndValues[i], namesAndValues[i + 1]);
        return Map.of("template", template, "values", values);
    }

    @Transactional
    public Map<String, Object> close(UserAccount actor, UUID id, CloseRequest request) {
        return shadow.around(actor, "TRAINING_PERSONNEL_REVIEW", id, "CLOSE", true, () -> closeInner(actor, id, request));
    }

    private Map<String, Object> closeInner(UserAccount actor, UUID id, CloseRequest request) {
        // who may do this (the permission, the department of the person reviewed, and not the person reviewed for the closing) is decided by the Hybrid engine (TrainingShadow, TRAINING_PERSONNEL_REVIEW); the signature step of the closer chosen stays
        Map<String, Object> r = lock(id);
        UUID person = (UUID) r.get("person_user_id");
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        sync(id);
        if (pending(id) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ITEMS_PENDING");
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UserAccount owner = users.findById(person).orElseThrow();
        // A review that has a person chosen to close it is closed by that person; one opened before the choice existed is closed by anyone who may.
        UUID assignment = closerAssignment(id) == null ? null : approvals.requireCanSign(actor, subject(r, owner), "REVIEW_CLOSE", TrainingApprovalService.apart(person));
        UUID signature = signatures.createEntitySignature(TYPE, id, "Training review " + r.get("review_no") + " of " + owner.getFullName(), actor, request.signatureToken(), "TRAINING_REVIEW_CLOSED",
                "Training Management: personnel training review closed", null, null, null).getId();
        approvals.complete(assignment, signature);
        // what the records answered is written into the lines, so that the closed review says what it was closed with
        jdbc.update("""
            update training_personnel_review_items i set status = 'DONE', done_at = now(), done_by = coalesce(i.done_by, ?), note = coalesce(i.note, 'Met by the record at the time of closing')
             where i.review_id = ? and i.status = 'PENDING' and training_review_item_state(i.review_id, i.item_code) = 'DONE'
            """, actor.getId(), id);
        jdbc.update("update training_personnel_reviews set status = 'CLOSED', closed_by = ?, closed_at = now(), closed_signature_id = ? where id = ?", actor.getId(), signature, id);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_CLOSED", "OPEN", "CLOSED", owner.getFullName(),
                List.of(TrainingStore.change("Closed For", null, owner.getFullName())));
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> cancel(UserAccount actor, UUID id, CancelRequest request) {
        return shadow.around(actor, "TRAINING_PERSONNEL_REVIEW", id, "CANCEL", true, () -> cancelInner(actor, id, request));
    }

    private Map<String, Object> cancelInner(UserAccount actor, UUID id, CancelRequest request) {
        // who may do this (the permission, the department of the person reviewed, and not the person reviewed for the closing) is decided by the Hybrid engine (TrainingShadow, TRAINING_PERSONNEL_REVIEW); the signature step of the closer chosen stays
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_personnel_reviews set status = 'CANCELLED', cancel_reason = ? where id = ?", request.reason().trim(), id);
        approvals.cancelOpen(TYPE, id, "Review cancelled");
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_CANCELLED", "OPEN", "CANCELLED", request.reason().trim(),
                List.of(TrainingStore.change("Reason for Cancelling", null, request.reason().trim())));
        return get(actor, id);
    }

    private TrainingApprovalService.Subject subject(Map<String, Object> review, UserAccount person) {
        return new TrainingApprovalService.Subject(TYPE, (UUID) review.get("id"), access.departmentOf(person), "Training review " + review.get("review_no") + " of " + person.getFullName(), "training.job_assignment.manage");
    }

    /** The open assignment to close the review: its id and the person, or null when nobody was chosen (a review opened before the choice existed). */
    private Map<String, Object> closerAssignment(UUID reviewId) {
        return jdbc.queryForList("select a.id, a.assignee_user_id, u.full_name from training_approval_assignments a join app_users u on u.id = a.assignee_user_id where a.object_type = ? and a.object_id = ? and a.step_code = 'REVIEW_CLOSE' and a.status = 'PENDING'",
                TYPE, reviewId).stream().findFirst().orElse(null);
    }

    /** The last item was settled: the person chosen to close the review is told once for this moment. */
    private void tellCloser(UserAccount actor, Map<String, Object> review) {
        Map<String, Object> assignment = closerAssignment((UUID) review.get("id"));
        if (assignment == null) return;
        users.findById((UUID) assignment.get("assignee_user_id")).ifPresent(closer -> notifier.send("TRAINING_REVIEW_READY", closer, actor, "Training: a review is ready to close",
                "Every item of the training review " + review.get("review_no") + " is settled. Please check it and sign to close it.", TYPE, (UUID) review.get("id"), "review-ready:" + review.get("id") + ":" + System.currentTimeMillis()));
    }

    /** The people who may be chosen to close the review of a person: they hold the permission in the department of the person, and are not the person. */
    @Transactional(readOnly = true)
    public Map<String, Object> eligibleClosers(UserAccount actor, UUID personId, String search, int page, int limit) {
        access.require(actor, "training.job_assignment.manage");
        if (!inScope(actor, personId)) throw new SecurityException(TrainingAccess.DENIED);
        UserAccount person = users.findById(personId).orElseThrow(() -> new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE"));
        return approvals.eligibleApprovers(actor, new TrainingApprovalService.Subject(TYPE, null, access.departmentOf(person), "Training review", "training.job_assignment.manage"), "REVIEW_CLOSE", search, page, limit, TrainingApprovalService.apart(personId));
    }

    /** Hands the closing over to another person (the person is away, left, or lost the permission): a reason is required and both people are on record. */
    @Transactional
    public Map<String, Object> changeCloser(UserAccount actor, UUID id, ChangeCloserRequest request) {
        return shadow.around(actor, "TRAINING_PERSONNEL_REVIEW", id, "CHANGE_CLOSER", false, () -> changeCloserInner(actor, id, request));
    }

    private Map<String, Object> changeCloserInner(UserAccount actor, UUID id, ChangeCloserRequest request) {
        // who may do this (the permission, the department of the person reviewed, and not the person reviewed for the closing) is decided by the Hybrid engine (TrainingShadow, TRAINING_PERSONNEL_REVIEW); the signature step of the closer chosen stays
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        UUID personId = (UUID) r.get("person_user_id");
        Map<String, Object> assignment = closerAssignment(id);
        if (assignment == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ASSIGNMENT_NOT_FOUND");
        UserAccount person = users.findById(personId).orElseThrow();
        approvals.reassign(actor, subject(r, person), (UUID) assignment.get("id"), request == null ? null : request.closerUserId(), request == null ? null : request.reason(), TrainingApprovalService.apart(personId));
        if (pending(id) == 0) tellCloser(actor, r);
        return get(actor, id);
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("""
            select r.* from training_personnel_reviews r where r.id = ? for update of r
            """, id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private static String blank(String v) { return v == null || v.isBlank() ? null : v.trim(); }

    /** What the Audit Trail names a review by: the employee code of the person it concerns (AUDIT-OBJECT-REGISTRY-2026-11-17). */
    private String auditCode(UUID id) {
        return jdbc.queryForList("select coalesce(nullif(u.employee_code, ''), u.full_name) from training_personnel_reviews r join app_users u on u.id = r.person_user_id where r.id=?", String.class, id).stream().findFirst().orElse("Training review");
    }

    /** The change of a review entry, and the note the person wrote when there is one. */
    private static List<com.eqms.dto.audittrail.AuditTrailChangeResponse> noteChanges(com.eqms.dto.audittrail.AuditTrailChangeResponse main, String note) {
        return note == null ? List.of(main) : List.of(main, TrainingStore.change("Note", null, note));
    }
}

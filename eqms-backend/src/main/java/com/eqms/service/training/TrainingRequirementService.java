package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The training requirement (APD.0118, SOP.0003 section 5.2): the plan of the trainings of a year. One person prepares it, a second reviews and a third approves,
 * each with a signature and each chosen from the people eligible for the step. After approval the plan is frozen; the QA person records what was done: the
 * activity opened for a line, a postponement to the next month with its reason, and the QA comment and signature once the training is completed.
 */
@Service
public class TrainingRequirementService {
    private String personName(UUID userId) {
        List<String> names = userId == null ? List.of() : jdbc.queryForList("select full_name from app_users where id=?", String.class, userId);
        return names.isEmpty() ? String.valueOf(userId) : names.getFirst();
    }

    private static final String TYPE = "TRAINING_REQUIREMENT";

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingApprovalService approvals;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final TrainingActivityService activities;
    private final TrainingNotifier notifier;
    private final com.eqms.repository.UserAccountRepository users;

    /** The code of a record is made by the rule of Training Administration (Code Rules). */
    @org.springframework.beans.factory.annotation.Autowired
    private TrainingCodeService codes;

    public TrainingRequirementService(JdbcTemplate jdbc, TrainingAccess access, TrainingApprovalService approvals, ElectronicSignatureService signatures, AuditTrailService audit,
                                      TrainingActivityService activities, TrainingNotifier notifier, com.eqms.repository.UserAccountRepository users) {
        this.jdbc = jdbc;
        this.access = access;
        this.approvals = approvals;
        this.signatures = signatures;
        this.audit = audit;
        this.activities = activities;
        this.notifier = notifier;
        this.users = users;
    }

    public record CreateRequest(Integer year, String kind, UUID departmentId, LocalDate dueBy, LocalDate reviewCompletedOn) {}
    public record LineRequest(LocalDate plannedMonth, String topicText, UUID documentId) {}
    public record SaveRequest(Integer version, LocalDate dueBy, List<LineRequest> lines) {}
    public record SubmitRequest(Integer version, String signatureToken, UUID nextApproverUserId) {}
    public record SignRequest(Integer version, String signatureToken) {}
    public record RejectRequest(Integer version, String reason) {}
    public record PostponeRequest(String reason) {}
    public record QaRequest(String comment, String signatureToken) {}

    // ----------------------------------------------------------------------------------------------------------------------------- reading

    /** More filters of the list; dates are ISO yyyy-MM-dd and both days of a range are included. */
    public record ListFilters(String kind, UUID departmentId, String dueFrom, String dueTo, String createdFrom, String createdTo) {
        public static final ListFilters NONE = new ListFilters(null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, Integer year, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        return list(actor, year, status, search, ListFilters.NONE, sortBy, sortDirection, page, limit);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, Integer year, String status, String search, ListFilters more, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.requirement.view", "training.requirement.prepare");
        ListFilters extra = more == null ? ListFilters.NONE : more;
        TrainingListFilter filter = new TrainingListFilter();
        if (!access.allDepartments(actor)) {
            UUID own = access.departmentOf(actor);
            filter.raw("r.department_id = ?", own == null ? new UUID(0, 0) : own);
        }
        filter.equal("r.year", year).equal("r.status", status).equal("r.kind", extra.kind()).equal("r.department_id", extra.departmentId())
                .contains(search, "r.request_no", "(select dd.name from departments dd where dd.id = r.department_id)", "(select u.full_name from app_users u where u.id = r.created_by)")
                .dateRange("r.due_by", extra.dueFrom(), extra.dueTo()).timeRange("r.created_at", extra.createdFrom(), extra.createdTo());
        String where = filter.where();
        List<Object> args = filter.args();
        Long total = jdbc.queryForObject("select count(*) from training_requirements r" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select r.id, r.request_no, r.year, r.kind, r.status, r.due_by, r.department_id, d.name as department_name, r.created_at, (select u.full_name from app_users u where u.id = r.created_by) as created_by_name,
                   (select count(*) from training_requirement_lines l where l.requirement_id = r.id) as line_count
              from training_requirements r join departments d on d.id = r.department_id""" + where + TrainingRows.orderBy(sortBy, sortDirection, Map.of("requestNo", "r.request_no", "createdByName", "(select u.full_name from app_users u where u.id = r.created_by)", "year", "r.year", "kind", "r.kind", "department", "d.name", "lines", "line_count", "dueBy", "r.due_by", "status", "r.status", "createdAt", "r.created_at"),
                    "r.year desc, r.request_no desc") + " limit ? offset ?", args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> data = TrainingRows.camel(rows);
        // What the person may do with each row, decided here, so the menu of the list shows only what the server would accept.
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> caps = capabilities(actor, rows.get(i));
            Map<String, Object> actions = new LinkedHashMap<>();
            actions.put("edit", caps.get("edit"));
            actions.put("review", caps.get("review"));
            actions.put("approve", caps.get("approve"));
            actions.put("track", Boolean.TRUE.equals(caps.get("postpone")) || Boolean.TRUE.equals(caps.get("openActivity")) || Boolean.TRUE.equals(caps.get("qaSign")));
            actions.put("print", "APPROVED".equals(rows.get(i).get("status")));
            data.get(i).put("actions", actions);
        }
        result.put("data", data);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        Map<String, Object> r = visible(actor, id);
        Map<String, Object> out = TrainingRows.camel(r);
        out.put("departmentName", jdbc.queryForObject("select name from departments where id=?", String.class, r.get("department_id")));
        for (String column : List.of("created_by", "prepared_by", "reviewed_by", "approved_by")) {
            out.put(column.replace("_by", "ByName").replaceAll("_(\\w)", "$1"), r.get(column) == null ? null : jdbc.queryForObject("select full_name from app_users where id=?", String.class, r.get(column)));
        }
        out.put("lines", TrainingRows.camel(jdbc.queryForList("""
            select l.id, l.line_no, l.planned_month, l.topic_text, l.document_id, l.activity_id, l.postponed_from, l.postpone_reason, l.qa_comment, l.qa_signed_at, l.qa_signature_id,
                   coalesce(l.topic_text, d.document_name) as title, d.document_number as code,
                   a.training_number, a.status as activity_status, a.completed_on as executed_on, qu.full_name as qa_signed_by_name,
                   case when a.status = 'COMPLETED' then 'DONE'
                        when a.id is not null and a.status <> 'CANCELLED' then 'IN_PROGRESS'
                        when l.planned_month + interval '1 month' <= current_date then 'OVERDUE'
                        when l.postponed_from is not null then 'POSTPONED'
                        else 'PLANNED' end as line_status,
                   (l.postponed_from is not null and l.planned_month > l.postponed_from + interval '1 month') as beyond_sop_window
              from training_requirement_lines l left join documents d on d.id = l.document_id
              left join training_activities a on a.id = l.activity_id left join app_users qu on qu.id = l.qa_signed_by
             where l.requirement_id = ? order by l.line_no
            """, id)));
        out.put("approvers", TrainingRows.camel(approvals.assignments(TYPE, id)));
        out.put("capabilities", capabilities(actor, r));
        return out;
    }

    private Map<String, Object> capabilities(UserAccount actor, Map<String, Object> r) {
        String status = String.valueOf(r.get("status"));
        UUID department = (UUID) r.get("department_id");
        boolean prepare = access.has(actor, "training.requirement.prepare") && access.inScope(actor, department);
        boolean assignedReview = assigned(actor, (UUID) r.get("id"), "REQUIREMENT_REVIEW");
        boolean assignedApprove = assigned(actor, (UUID) r.get("id"), "REQUIREMENT_APPROVE");
        Map<String, Object> caps = new LinkedHashMap<>();
        caps.put("edit", prepare && "DRAFT".equals(status));
        caps.put("submit", prepare && "DRAFT".equals(status));
        caps.put("review", "PENDING_REVIEW".equals(status) && assignedReview);
        caps.put("approve", "PENDING_APPROVAL".equals(status) && assignedApprove);
        caps.put("reject", ("PENDING_REVIEW".equals(status) && assignedReview) || ("PENDING_APPROVAL".equals(status) && assignedApprove));
        caps.put("postpone", prepare && "APPROVED".equals(status));
        caps.put("openActivity", "APPROVED".equals(status) && access.has(actor, "training.activity.organize") && access.has(actor, "training.code.allocate") && access.inScope(actor, department));
        caps.put("qaSign", "APPROVED".equals(status) && access.has(actor, "training.activity.close") && access.inScope(actor, department));
        return caps;
    }

    private boolean assigned(UserAccount actor, UUID id, String step) {
        return jdbc.queryForObject("select count(*) from training_approval_assignments where object_type=? and object_id=? and step_code=? and status='PENDING' and assignee_user_id=?",
                Integer.class, TYPE, id, step, actor.getId()) > 0;
    }

    /** Annual topics of the effective matrix of the department that are not yet in any requirement of the year. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> suggestions(UserAccount actor, Integer year, UUID departmentId) {
        access.require(actor, "training.requirement.prepare");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        int y = year == null ? LocalDate.now(TrainingNumberService.ZONE).getYear() : year;
        return TrainingRows.camel(jdbc.queryForList("""
            select r.topic_text, r.document_id, coalesce(r.topic_text, d.document_name) as title, d.document_number as code
              from training_matrix_versions v join training_matrices m on m.id = v.matrix_id join training_matrix_rows r on r.version_id = v.id
              left join documents d on d.id = r.document_id
             where m.department_id = ? and v.status = 'EFFECTIVE' and r.annual_required
               and not exists (select 1 from training_requirement_lines l join training_requirements q on q.id = l.requirement_id
                                where q.department_id = m.department_id and q.year = ? and (training_topic_key(l.topic_text) = training_topic_key(r.topic_text) or l.document_id = r.document_id))
             order by r.row_no
            """, department, y));
    }

    // ----------------------------------------------------------------------------------------------------------------------------- writing

    @Transactional
    public Map<String, Object> create(UserAccount actor, CreateRequest request) {
        access.require(actor, "training.requirement.prepare");
        if (request == null || request.year() == null || request.year() < 2000 || request.year() > 2100) throw new IllegalArgumentException("TRAINING_YEAR_INVALID");
        String kind = request.kind() == null ? "ANNUAL" : request.kind();
        if (!Set.of("ANNUAL", "SOP_PERIODIC").contains(kind)) throw new IllegalArgumentException("TRAINING_KIND_INVALID");
        UUID department = request.departmentId() != null ? request.departmentId() : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        jdbc.queryForObject("select pg_advisory_xact_lock(hashtext(?))", Object.class, "training-requirement-" + request.year());
        String departmentCode = jdbc.queryForList("select code from departments where id = ?", String.class, department).stream().findFirst().orElse(null);
        String number = codes.next(TrainingCodeService.REQUIREMENT, departmentCode, request.year(),
                candidate -> Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from training_requirements where request_no = ?)", Boolean.class, candidate)));
        LocalDate dueBy = request.dueBy() != null ? request.dueBy() : annualDue(request.year());
        LocalDate reviewDone = null;
        if ("SOP_PERIODIC".equals(kind)) {
            // SOP.0003 5.3.2: the requirement is prepared and approved at the latest on the last day of the month in which the review of the SOPs was completed
            if (request.reviewCompletedOn() == null) throw new IllegalArgumentException("TRAINING_REVIEW_DATE_REQUIRED");
            reviewDone = request.reviewCompletedOn();
            dueBy = java.time.YearMonth.from(reviewDone).atEndOfMonth();
        }
        UUID id = UUID.randomUUID();
        jdbc.update("insert into training_requirements(id, request_no, year, kind, department_id, due_by, created_by, prepared_by, review_completed_on) values (?,?,?,?,?,?,?,?,?)",
                id, number, request.year(), kind, department, dueBy, actor.getId(), actor.getId(), reviewDone);
        audit.logAs(actor, TYPE, number, id, "TRAINING_REQUIREMENT_CREATED", null, "DRAFT", "Requirement " + number + " for " + request.year());
        return get(actor, id);
    }

    private LocalDate annualDue(int year) {
        Map<String, Object> s = jdbc.queryForMap("select annual_requirement_due_month as m, annual_requirement_due_day as d from training_settings where id=1");
        int month = ((Number) s.get("m")).intValue();
        int day = Math.min(((Number) s.get("d")).intValue(), YearMonth.of(year, month).lengthOfMonth());
        return LocalDate.of(year, month, day);
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, UUID id, SaveRequest request) {
        Map<String, Object> r = lock(id);
        requirePrepare(actor, r);
        requireStatus(r, "DRAFT");
        requireVersion(r, request == null ? null : request.version());
        if (request.lines() == null) throw new IllegalArgumentException("TRAINING_REQUIREMENT_LINES_REQUIRED");
        int year = ((Number) r.get("year")).intValue();
        jdbc.update("delete from training_requirement_lines where requirement_id=?", id);
        Set<String> seen = new LinkedHashSet<>();
        int no = 0;
        for (LineRequest line : request.lines()) {
            if (line.plannedMonth() == null || line.plannedMonth().getDayOfMonth() != 1 || line.plannedMonth().getYear() != year) throw new IllegalArgumentException("TRAINING_REQUIREMENT_LINE_INVALID");
            String topicText = line.topicText() == null || line.topicText().isBlank() ? null : line.topicText().trim().replaceAll("\\s+", " ");
            if ((topicText == null) == (line.documentId() == null) || (topicText != null && topicText.length() > 500)) throw new IllegalArgumentException("TRAINING_REQUIREMENT_LINE_INVALID");
            if (!seen.add(line.plannedMonth() + "|" + (topicText != null ? "T" + topicText.toLowerCase(java.util.Locale.ROOT) : "D" + line.documentId()))) throw new IllegalArgumentException("TRAINING_REQUIREMENT_LINE_DUPLICATE");
            if (line.documentId() != null && jdbc.queryForObject("select count(*) from documents where id=?", Integer.class, line.documentId()) == 0) throw new IllegalArgumentException("TRAINING_REQUIREMENT_LINE_INVALID");
            jdbc.update("insert into training_requirement_lines(id, requirement_id, line_no, planned_month, topic_text, document_id) values (?,?,?,?,?,?)",
                    UUID.randomUUID(), id, ++no, line.plannedMonth(), topicText, line.documentId());
        }
        if (request.dueBy() != null) jdbc.update("update training_requirements set due_by=? where id=?", request.dueBy(), id);
        jdbc.update("update training_requirements set version=version+1, updated_at=now() where id=?", id);
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), id, "TRAINING_REQUIREMENT_SAVED", null, null, no + " lines saved");
        return get(actor, id);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> eligibleApprovers(UserAccount actor, UUID id, String step, String search, int page, int limit) {
        if (!Set.of("REQUIREMENT_REVIEW", "REQUIREMENT_APPROVE").contains(step)) throw new IllegalArgumentException("TRAINING_STEP_UNKNOWN");
        Map<String, Object> r = visible(actor, id);
        return approvals.eligibleApprovers(actor, subject(r), step, search, page, limit, kept(r, step, actor));
    }

    /** The preparer signs and chooses the reviewer. */
    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID id, SubmitRequest request) {
        Map<String, Object> r = lock(id);
        requirePrepare(actor, r);
        requireStatus(r, "DRAFT");
        requireVersion(r, request == null ? null : request.version());
        Integer lines = jdbc.queryForObject("select count(*) from training_requirement_lines where requirement_id=?", Integer.class, id);
        if (lines == null || lines == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REQUIREMENT_EMPTY");
        approvals.cancelOpen(TYPE, id, "Resubmitted");
        approvals.designate(actor, subject(r), "REQUIREMENT_REVIEW", request.nextApproverUserId(), TrainingApprovalService.apart(actor.getId()));
        UUID signature = sign(actor, r, "TRAINING_REQUIREMENT_PREPARED", request.signatureToken());
        jdbc.update("update training_requirements set status='PENDING_REVIEW', prepared_by=?, prepared_signature_id=?, prepared_at=now(), reject_reason=null, version=version+1, updated_at=now() where id=?", actor.getId(), signature, id);
        String reviewer = personName(request.nextApproverUserId());
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), id, "TRAINING_REQUIREMENT_SUBMITTED", "DRAFT", "PENDING_REVIEW", "Prepared and sent for review to " + reviewer + " (" + lines + " lines)",
                List.of(new AuditTrailChangeResponse("Status", "Draft", "Pending Review"),
                        new AuditTrailChangeResponse("Prepared by", null, actor.getFullName()),
                        new AuditTrailChangeResponse("Designated reviewer", null, reviewer)), signature);
        return get(actor, id);
    }

    /** The reviewer signs and chooses who approves; the approver is neither the preparer nor the reviewer. */
    @Transactional
    public Map<String, Object> review(UserAccount actor, UUID id, SubmitRequest request) {
        Map<String, Object> r = lock(id);
        requireStatus(r, "PENDING_REVIEW");
        requireVersion(r, request == null ? null : request.version());
        UUID assignment = approvals.requireCanSign(actor, subject(r), "REQUIREMENT_REVIEW", kept(r, "REQUIREMENT_REVIEW", actor));
        UUID signature = sign(actor, r, "TRAINING_REQUIREMENT_REVIEWED", request.signatureToken());
        approvals.complete(assignment, signature);
        approvals.designate(actor, subject(r), "REQUIREMENT_APPROVE", request.nextApproverUserId(), TrainingApprovalService.apart((UUID) r.get("prepared_by"), actor.getId()));
        jdbc.update("update training_requirements set status='PENDING_APPROVAL', reviewed_by=?, reviewed_signature_id=?, reviewed_at=now(), version=version+1, updated_at=now() where id=?", actor.getId(), signature, id);
        String approver = personName(request.nextApproverUserId());
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), id, "TRAINING_REQUIREMENT_REVIEWED", "PENDING_REVIEW", "PENDING_APPROVAL", "Reviewed and sent for approval to " + approver,
                List.of(new AuditTrailChangeResponse("Status", "Pending Review", "Pending Approval"),
                        new AuditTrailChangeResponse("Reviewed by", null, actor.getFullName()),
                        new AuditTrailChangeResponse("Designated approver", null, approver)), signature);
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID id, SignRequest request) {
        Map<String, Object> r = lock(id);
        requireStatus(r, "PENDING_APPROVAL");
        requireVersion(r, request == null ? null : request.version());
        UUID assignment = approvals.requireCanSign(actor, subject(r), "REQUIREMENT_APPROVE", kept(r, "REQUIREMENT_APPROVE", actor));
        UUID signature = sign(actor, r, "TRAINING_REQUIREMENT_APPROVED", request.signatureToken());
        approvals.complete(assignment, signature);
        jdbc.update("update training_requirements set status='APPROVED', approved_by=?, approved_signature_id=?, approved_at=now(), version=version+1, updated_at=now() where id=?", actor.getId(), signature, id);
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), id, "TRAINING_REQUIREMENT_APPROVED", "PENDING_APPROVAL", "APPROVED", "Requirement approved by " + actor.getFullName(),
                List.of(new AuditTrailChangeResponse("Status", "Pending Approval", "Approved"),
                        new AuditTrailChangeResponse("Approved by", null, actor.getFullName())), signature);
        tell(r, actor, "TRAINING_REQUIREMENT_APPROVED", "Training: requirement approved", String.valueOf(r.get("request_no")) + " was approved by " + actor.getFullName() + ".");
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> reject(UserAccount actor, UUID id, RejectRequest request) {
        Map<String, Object> r = lock(id);
        requireStatus(r, "PENDING_REVIEW", "PENDING_APPROVAL");
        requireVersion(r, request == null ? null : request.version());
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        String step = "PENDING_REVIEW".equals(r.get("status")) ? "REQUIREMENT_REVIEW" : "REQUIREMENT_APPROVE";
        UUID assignment = approvals.requireCanSign(actor, subject(r), step, kept(r, step, actor));
        approvals.complete(assignment, null);
        approvals.cancelOpen(TYPE, id, "Rejected");
        jdbc.update("update training_requirements set status='DRAFT', reject_reason=?, reviewed_by=null, reviewed_signature_id=null, reviewed_at=null, version=version+1, updated_at=now() where id=?", request.reason().trim(), id);
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), id, "TRAINING_REQUIREMENT_REJECTED", String.valueOf(r.get("status")), "DRAFT", request.reason().trim());
        tell(r, actor, "TRAINING_REQUIREMENT_REJECTED", "Training: requirement sent back", r.get("request_no") + " was sent back by " + actor.getFullName() + ". Reason: " + request.reason().trim());
        return get(actor, id);
    }

    /** A line moves to the next month with its reason; the old month and the reason stay on the line. */
    @Transactional
    public Map<String, Object> postpone(UserAccount actor, UUID lineId, PostponeRequest request) {
        Map<String, Object> line = jdbc.queryForList("select * from training_requirement_lines where id=? for update", lineId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> r = lock((UUID) line.get("requirement_id"));
        requirePrepare(actor, r);
        requireStatus(r, "APPROVED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (line.get("activity_id") != null) {
            String activityStatus = jdbc.queryForObject("select status from training_activities where id=?", String.class, line.get("activity_id"));
            if (!"CANCELLED".equals(activityStatus)) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REQUIREMENT_LINE_HAS_ACTIVITY");
        }
        LocalDate current = ((java.sql.Date) line.get("planned_month")).toLocalDate();
        LocalDate original = line.get("postponed_from") == null ? current : ((java.sql.Date) line.get("postponed_from")).toLocalDate();
        jdbc.update("update training_requirement_lines set planned_month=?, postponed_from=?, postpone_reason=? where id=?", current.plusMonths(1), original, request.reason().trim(), lineId);
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), (UUID) r.get("id"), "TRAINING_REQUIREMENT_LINE_POSTPONED", current.toString(), current.plusMonths(1).toString(), request.reason().trim());
        return get(actor, (UUID) r.get("id"));
    }

    /** Opens the training of a line: a periodic activity with a Training Number, due at the end of the planned month. */
    @Transactional
    public Map<String, Object> openActivity(UserAccount actor, UUID lineId) {
        Map<String, Object> line = jdbc.queryForList("select * from training_requirement_lines where id=? for update", lineId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> r = lock((UUID) line.get("requirement_id"));
        requireStatus(r, "APPROVED");
        access.require(actor, "training.activity.organize", "training.code.allocate");
        access.require(actor, "training.code.allocate");
        access.requireScope(actor, (UUID) r.get("department_id"));
        if (line.get("activity_id") != null && !"CANCELLED".equals(jdbc.queryForObject("select status from training_activities where id=?", String.class, line.get("activity_id")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REQUIREMENT_LINE_HAS_ACTIVITY");
        }
        String title = line.get("topic_text") != null ? String.valueOf(line.get("topic_text"))
                : jdbc.queryForObject("select document_number || ' ' || document_name from documents where id=?", String.class, line.get("document_id"));
        LocalDate month = ((java.sql.Date) line.get("planned_month")).toLocalDate();
        // Due at the end of the planned month (SOP.0003 5.3: the training is done in the month of the requirement, or postponed to the next one).
        LocalDate due = month.withDayOfMonth(month.lengthOfMonth());
        Map<String, Object> created = activities.create(actor, new TrainingActivityService.CreateRequest((UUID) r.get("department_id"), "PERIODIC", "OTHER", null,
                due, "From " + r.get("request_no"), null, null));
        jdbc.update("update training_activities set requirement_line_id=? where id=?", lineId, created.get("id"));
        jdbc.update("update training_requirement_lines set activity_id=? where id=?", created.get("id"), lineId);
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), (UUID) r.get("id"), "TRAINING_REQUIREMENT_ACTIVITY_OPENED", null, String.valueOf(created.get("trainingNumber")), title);
        return get(actor, (UUID) r.get("id"));
    }

    /** After the training is completed, QA signs the line (the Sign by QA and Comment columns of the form). */
    @Transactional
    public Map<String, Object> qaSign(UserAccount actor, UUID lineId, QaRequest request) {
        Map<String, Object> line = jdbc.queryForList("select * from training_requirement_lines where id=? for update", lineId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> r = lock((UUID) line.get("requirement_id"));
        requireStatus(r, "APPROVED");
        access.require(actor, "training.activity.close");
        access.requireScope(actor, (UUID) r.get("department_id"));
        if (line.get("qa_signed_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REQUIREMENT_LINE_ALREADY_SIGNED");
        if (line.get("activity_id") == null || !"COMPLETED".equals(jdbc.queryForObject("select status from training_activities where id=?", String.class, line.get("activity_id")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ACTIVITY_NOT_COMPLETED");
        }
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID signature = signatures.createEntitySignature(TYPE, (UUID) r.get("id"), String.valueOf(r.get("request_no")), actor, request.signatureToken(), "TRAINING_COMPLETED",
                "Training Management: line of the requirement completed", null, null, null).getId();
        jdbc.update("update training_requirement_lines set qa_comment=?, qa_signed_by=?, qa_signature_id=?, qa_signed_at=now() where id=?",
                request.comment() == null || request.comment().isBlank() ? null : request.comment().trim(), actor.getId(), signature, lineId);
        audit.logAs(actor, TYPE, String.valueOf(r.get("request_no")), (UUID) r.get("id"), "TRAINING_REQUIREMENT_LINE_SIGNED", null, null, "Line " + line.get("line_no") + " signed by QA");
        return get(actor, (UUID) r.get("id"));
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> visible(UserAccount actor, UUID id) {
        access.require(actor, "training.requirement.view", "training.requirement.prepare", "training.requirement.review", "training.requirement.approve");
        Map<String, Object> r = jdbc.queryForList("select * from training_requirements where id=?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) r.get("department_id"));
        return r;
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_requirements where id=? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private void requirePrepare(UserAccount actor, Map<String, Object> r) {
        access.require(actor, "training.requirement.prepare");
        access.requireScope(actor, (UUID) r.get("department_id"));
    }

    private static void requireStatus(Map<String, Object> r, String... allowed) {
        for (String s : allowed) if (s.equals(r.get("status"))) return;
        throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REQUIREMENT_INVALID_TRANSITION");
    }

    private static void requireVersion(Map<String, Object> r, Integer version) {
        if (version == null || version.intValue() != ((Number) r.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REQUIREMENT_VERSION_CHANGED");
    }

    private TrainingApprovalService.Subject subject(Map<String, Object> r) {
        return new TrainingApprovalService.Subject(TYPE, (UUID) r.get("id"), (UUID) r.get("department_id"), String.valueOf(r.get("request_no")), "training.requirement.prepare");
    }

    /** Three different people: the preparer, the reviewer and the approver. */
    private Set<UUID> kept(Map<String, Object> r, String step, UserAccount actor) {
        Set<UUID> apart = new LinkedHashSet<>();
        if (r.get("prepared_by") != null) apart.add((UUID) r.get("prepared_by"));
        if ("REQUIREMENT_APPROVE".equals(step)) {
            if (r.get("reviewed_by") != null) apart.add((UUID) r.get("reviewed_by"));
            // The person who has the review (not yet done) cannot be chosen to approve either.
            apart.addAll(jdbc.queryForList("select assignee_user_id from training_approval_assignments where object_type=? and object_id=? and step_code='REQUIREMENT_REVIEW' and status in ('PENDING','DONE')", UUID.class, TYPE, r.get("id")));
        }
        return apart;
    }

    private UUID sign(UserAccount actor, Map<String, Object> r, String meaning, String token) {
        if (token == null || token.isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        String reason = "Training Management: " + meaning.replace("TRAINING_", "").replace('_', ' ').toLowerCase(Locale.ROOT);
        return signatures.createEntitySignature(TYPE, (UUID) r.get("id"), String.valueOf(r.get("request_no")), actor, token, meaning, reason, null, null, null).getId();
    }

    private void tell(Map<String, Object> r, UserAccount actor, String event, String title, String message) {
        if (r.get("prepared_by") == null) return;
        users.findById((UUID) r.get("prepared_by")).ifPresent(preparer -> notifier.send(event, preparer, actor, title, message, TYPE, (UUID) r.get("id"), null));
    }
}

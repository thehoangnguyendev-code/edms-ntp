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

    /** The checklist of each kind, from the SOP. `link` says whether an item is done by organising a training activity for the person. */
    private record Item(String code, String label, String hint, boolean link) {}

    private static final Map<String, List<Item>> ITEMS = Map.of(
            "NEW_HIRE", List.of(
                    new Item("RULES_SAFETY", "Company rules and occupational safety", "Initial training, part 1: given by Human Resources and Administration.", false),
                    new Item("GMP_GENERAL", "General GMP principles", "Initial training, part 2: given by QA.", true),
                    new Item("JOB_SPECIFIC", "Job-specific training", "Initial training, part 3: given by the department of the employee, on the SOPs of the position.", true),
                    new Item("SPECIMEN", "Specimen signature", "FRM.0007 is signed by hand on paper; its scan is kept as the specimen signature record.", false),
                    new Item("JOB_ASSIGNMENT", "Job assignment", "APD.0024: given after the training the matrix requires for the position is complete.", false)),
            "ABSENCE_RETURN", List.of(
                    new Item("REVIEW_RECORDS", "Review the training record", "Decide what has to be repeated after the absence.", false),
                    new Item("RETRAINING", "Retraining", "Organise the retraining that was decided; link the activity.", true)),
            "DEPT_TRANSFER", List.of(
                    new Item("REVIEW_RECORDS", "Review the current training record", "The receiving head of department and the assigned employee find what additional training is needed (SOP.0003 5.3.11).", false),
                    new Item("ADDITIONAL_TRAINING", "Additional training", "The assigned employee organises the job-specific training for the new duties; link the activity.", true),
                    new Item("JOB_ASSIGNMENT", "Job assignment", "APD.0024 for the new position.", false)),
            "LOCATION_TRANSFER", List.of(
                    new Item("HANDOVER", "Hand over the training record", "The head of the department at the previous site gives a copy of the record to the new department (SOP.0003 5.3.11).", false),
                    new Item("NEW_SITE_TRAINING", "Training at the new site", "The employee is trained as a new employee of the new department; link the activity.", true),
                    new Item("JOB_ASSIGNMENT", "Job assignment", "APD.0024 for the new position.", false)));

    public record CreateRequest(UUID personUserId, String kind, LocalDate eventDate, LocalDate absenceFrom, LocalDate absenceTo, String departmentTo, String note) {}
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

    private final TrainingComplianceService compliance;

    public TrainingPersonnelReviewService(JdbcTemplate jdbc, TrainingAccess access, ElectronicSignatureService signatures, AuditTrailService audit, UserAccountRepository users, TrainingActivityService activities, TrainingComplianceService compliance,
                                          TrainingApprovalService approvals, TrainingNotifier notifier, TrainingShadow shadow) {
        this.compliance = compliance;
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
               (select count(*) from training_personnel_review_items i where i.review_id = r.id and i.status = 'PENDING') as open_items,
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
            if ("READY_TO_CLOSE".equals(status)) where.append(" and r.status = 'OPEN' and not exists (select 1 from training_personnel_review_items pi where pi.review_id = r.id and pi.status = 'PENDING')");
            else { where.append(" and r.status = ?"); args.add(status); }
        }
        if (kind != null && !kind.isBlank()) {
            if (!ITEMS.containsKey(kind)) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
            where.append(" and r.kind = ?"); args.add(kind);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\' or lower(coalesce(u.department,'')) like ? escape '\\' or lower(coalesce(r.note,'')) like ? escape '\\' or lower(coalesce(cu.full_name,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().contains(more.get("createdBy"), "cu.full_name")
                .dateRange("r.event_date", more.get("eventFrom"), more.get("eventTo")).timeRange("r.created_at", more.get("createdFrom"), more.get("createdTo"));
        if (more.get("department") != null && !more.get("department").isBlank()) extra.raw("lower(trim(u.department)) = lower(trim(?))", more.get("department"));
        // The same person's own entries, for the "related" card of a detail screen.
        if (more.get("personId") != null && !more.get("personId").isBlank()) extra.raw("r.person_user_id = ?", java.util.UUID.fromString(more.get("personId")));
        if ("true".equals(more.get(TrainingWaiting.PARAM))) extra.raw(TrainingWaiting.personnelReview(), actor.getId());
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
        Map<String, Map<String, Object>> stored = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList("""
            select i.item_code, i.status, i.activity_id, a.training_number, training_activity_topics(a.id) as training_topics, a.status as activity_status, i.note, i.done_at, du.full_name as done_by_name
              from training_personnel_review_items i left join training_activities a on a.id = i.activity_id left join app_users du on du.id = i.done_by where i.review_id = ?
            """, id)) stored.put((String) row.get("item_code"), row);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Item item : ITEMS.get((String) r.get("kind"))) {
            Map<String, Object> row = stored.get(item.code());
            Map<String, Object> entry = row == null ? new LinkedHashMap<>(Map.of("itemCode", item.code(), "status", "PENDING")) : TrainingRows.camel(row);
            entry.put("label", item.label());
            entry.put("hint", item.hint());
            entry.put("canLink", item.link());
            entry.put("systemCheck", systemCheck(item.code(), person));
            items.add(entry);
        }
        out.put("items", items);
        boolean open = "OPEN".equals(r.get("status"));
        boolean manage = access.has(actor, "training.job_assignment.manage");
        // The person chosen to close the review; a review opened before the choice existed has none and is closed by anyone who may.
        Map<String, Object> closer = closerAssignment(id);
        boolean ready = open && ((Number) r.get("open_items")).intValue() == 0;
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
        if (request == null || request.personUserId() == null || request.kind() == null || !ITEMS.containsKey(request.kind()) || request.eventDate() == null) throw new IllegalArgumentException("TRAINING_REVIEW_INVALID");
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
        for (Item item : ITEMS.get(request.kind())) jdbc.update("insert into training_personnel_review_items(review_id, item_code) values (?,?)", id, item.code());
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
        out.put("absenceRetrainMonths", jdbc.queryForObject("select absence_retrain_months from training_settings where id = 1", Integer.class));
        String target = transfer ? blank(departmentTo) : from;
        String problem = null;
        Map<String, Object> department = null;
        if (target == null) problem = transfer ? "TRAINING_REVIEW_DEPARTMENT_REQUIRED" : "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING";
        else {
            department = jdbc.queryForList("select d.name, d.department_head_id from departments d where d.is_active and lower(trim(d.name)) = lower(trim(?))", target).stream().findFirst().orElse(null);
            if (department == null) problem = transfer ? "TRAINING_REVIEW_DEPARTMENT_REQUIRED" : "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING";
        }
        if (problem == null && transfer && from != null && "DEPT_TRANSFER".equals(kind) && from.equalsIgnoreCase(String.valueOf(department.get("name")))) problem = "TRAINING_REVIEW_SAME_DEPARTMENT";
        UserAccount head = problem != null || department.get("department_head_id") == null ? null : users.findById((UUID) department.get("department_head_id")).orElse(null);
        if (problem == null && head == null) problem = "TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING";
        if (problem == null && head.getId().equals(person.getId())) problem = "TRAINING_REVIEW_HEAD_IS_EMPLOYEE";
        if (problem == null && !access.has(head, "training.job_assignment.manage")) problem = "TRAINING_REVIEW_HEAD_NOT_ALLOWED";
        out.put("departmentTo", transfer && department != null ? department.get("name") : null);
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
        UUID person = (UUID) r.get("person_user_id");
        Item item = ITEMS.get((String) r.get("kind")).stream().filter(i -> i.code().equals(itemCode)).findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_REVIEW_ITEM_INVALID"));
        if (request == null || request.status() == null || !Set.of("PENDING", "DONE", "NOT_NEEDED").contains(request.status())) throw new IllegalArgumentException("TRAINING_PREPARATION_STATUS_INVALID");
        String note = blank(request.note());
        if (note != null && note.length() > 500) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        // Leaving out an item the SOP lists needs a reason, so that the record shows why.
        if ("NOT_NEEDED".equals(request.status()) && note == null) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        UUID activityId = item.link() ? request.activityId() : null;
        if (activityId != null) {
            Integer ok = jdbc.queryForObject("select count(*) from training_participants where activity_id = ? and person_user_id = ?", Integer.class, activityId, person);
            // A training created from this very item is accepted before the employee is on its list: the list is made on the training screen.
            Integer own = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and item_code = ? and activity_id = ?", Integer.class, id, itemCode, activityId);
            if ((ok == null || ok == 0) && (own == null || own == 0)) throw new IllegalArgumentException("TRAINING_REVIEW_ACTIVITY_INVALID");
        }
        boolean done = !"PENDING".equals(request.status());
        int pendingBefore = ((Number) r.get("open_items")).intValue();
        jdbc.update("update training_personnel_review_items set status = ?, activity_id = ?, note = ?, done_by = ?, done_at = case when ? then now() else null end where review_id = ? and item_code = ?",
                request.status(), activityId, note, done ? actor.getId() : null, done, id, itemCode);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_ITEM", null, request.status(), item.label() + (note == null ? "" : ". " + note),
                noteChanges(TrainingStore.change(item.label() + " › Status", null, TrainingStore.words(request.status())), note));
        Integer pendingAfter = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and status = 'PENDING'", Integer.class, id);
        if (pendingBefore > 0 && pendingAfter != null && pendingAfter == 0) tellCloser(actor, r);
        return get(actor, id);
    }

    /**
     * Starts the training an item asks for: creates an unplanned training activity for the department of the person who works the review, with a title that names the item and the employee,
     * and links it to the item. The session and the list are made on the training screen, as for any other training. The training reason follows the event of the review.
     */
    @Transactional
    public Map<String, Object> createActivity(UserAccount actor, UUID id, String itemCode) {
        return shadow.around(actor, "TRAINING_PERSONNEL_REVIEW", id, "CREATE_ACTIVITY", true, () -> createActivityInner(actor, id, itemCode));
    }

    private Map<String, Object> createActivityInner(UserAccount actor, UUID id, String itemCode) {
        // who may do this (the permission, the department of the person reviewed, and not the person reviewed for the closing) is decided by the Hybrid engine (TrainingShadow, TRAINING_PERSONNEL_REVIEW); the signature step of the closer chosen stays
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        UUID person = (UUID) r.get("person_user_id");
        Item item = ITEMS.get((String) r.get("kind")).stream().filter(i -> i.code().equals(itemCode)).findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_REVIEW_ITEM_INVALID"));
        if (!item.link()) throw new IllegalArgumentException("TRAINING_REVIEW_ITEM_INVALID");
        Integer linked = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and item_code = ? and activity_id is not null", Integer.class, id, itemCode);
        if (linked != null && linked > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ITEM_LINKED");
        UserAccount owner = users.findById(person).orElseThrow();
        String reason = switch ((String) r.get("kind")) { case "NEW_HIRE" -> "NEW_HIRE"; case "ABSENCE_RETURN" -> "ABSENCE_RETURN"; default -> "TRANSFER"; };
        String title = item.label() + " — " + owner.getFullName();
        Map<String, Object> created = activities.create(actor, new TrainingActivityService.CreateRequest(null, "UNPLANNED", reason, null, null,
                "From training review " + r.get("review_no"), null, null));
        UUID activityId = (UUID) created.get("id");
        jdbc.update("update training_personnel_review_items set activity_id = ? where review_id = ? and item_code = ?", activityId, id, itemCode);
        audit.logAs(actor, TYPE, auditCode(id), id, "TRAINING_PERSONNEL_REVIEW_TRAINING_CREATED", null, String.valueOf(created.get("trainingNumber")), item.label(),
                List.of(TrainingStore.change("Training Number", null, created.get("trainingNumber")), TrainingStore.change("Review Item", null, item.label())));
        Map<String, Object> out = get(actor, id);
        out.put("createdActivityId", activityId);
        return out;
    }

    /**
     * What the system already holds for an item, shown beside it so the person who works through the checklist sees it. It never marks an item done: a person decides.
     * Null when the system holds nothing about that kind of item.
     */
    private Map<String, Object> systemCheck(String code, UUID person) {
        switch (code) {
            case "SPECIMEN": {
                List<Map<String, Object>> rows = jdbc.queryForList("select version_no, effective_date from training_specimen_signatures where person_user_id = ? and status = 'APPROVED' order by version_no desc limit 1", person);
                if (rows.isEmpty()) return check(false, part("No specimen signature record yet."));
                Object version = rows.getFirst().get("version_no"), effective = rows.getFirst().get("effective_date");
                return check(true, effective == null ? part("Specimen signature record, version {version}.", "version", version)
                        : part("Specimen signature record, version {version}, effective {date}.", "version", version, "date", DateTimeFormatUtils.display(effective)));
            }
            case "JOB_ASSIGNMENT": {
                List<Map<String, Object>> rows = jdbc.queryForList("select issue_no, effective_at from training_job_assignments where person_user_id = ? and status = 'EFFECTIVE' order by issue_no desc limit 1", person);
                Map<String, Object> gaps = compliance.gapsOfPerson(person, access.departmentOf(users.findById(person).orElseThrow()));
                long open = ((Number) gaps.get("missing")).longValue() + ((Number) gaps.get("due")).longValue();
                Map<String, Object> matrix = ((Number) gaps.get("required")).intValue() == 0 ? null
                        : open == 0 ? part("The matrix of the position is complete.") : part("{count} training of the matrix of the position is still open.", "count", open);
                if (rows.isEmpty()) return check(false, part("No effective job assignment yet."), matrix);
                Object issue = rows.getFirst().get("issue_no"), effective = rows.getFirst().get("effective_at");
                return check(open == 0, effective == null ? part("Job assignment, issue {issue}.", "issue", issue)
                        : part("Job assignment, issue {issue}, effective {date}.", "issue", issue, "date", DateTimeFormatUtils.display(effective)), matrix);
            }
            case "HANDOVER": {
                List<Map<String, Object>> rows = jdbc.queryForList("select generated_at from training_record_exports where person_user_id = ? and status = 'APPROVED' order by generated_at desc nulls last limit 1", person);
                if (rows.isEmpty()) return check(false, part("No approved export of the training record yet (Training Record Exports)."));
                Object generated = rows.getFirst().get("generated_at");
                return check(true, generated == null ? part("A signed export of the record was approved.")
                        : part("A signed export of the record was approved on {date}.", "date", DateTimeFormatUtils.display(generated)));
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

    /** The gaps of the person against the matrix of the department: what the head of department and the assigned employee look at when they review the record (SOP.0003 5.3.11). */
    @Transactional(readOnly = true)
    public Map<String, Object> matrixGaps(UserAccount actor, UUID id) {
        access.require(actor, "training.job_assignment.view");
        Map<String, Object> r = jdbc.queryForList(SELECT + " where r.id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        UUID person = (UUID) r.get("person_user_id");
        if (!inScope(actor, person)) throw new SecurityException(TrainingAccess.DENIED);
        return compliance.gapsOfPerson(person, access.departmentOf(users.findById(person).orElseThrow()));
    }

    /** New employees who have no review yet: the people of the scope who started in the last 60 days (the start date is kept in the user profile). A hint, not a rule. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> suggestions(UserAccount actor) {
        access.require(actor, "training.job_assignment.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where u.status = 'Active' and u.start_date is not null and u.start_date >= current_date - 60 and u.start_date <= current_date + 31"
                + " and not exists (select 1 from training_personnel_reviews r where r.person_user_id = u.id and r.kind = 'NEW_HIRE' and r.status <> 'CANCELLED')");
        if (!access.allDepartments(actor)) {
            where.append(" and lower(trim(u.department)) = lower(trim(?))");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        return TrainingRows.camel(jdbc.queryForList("select u.id, u.full_name, u.employee_code, u.department, u.start_date from app_users u" + where + " order by u.start_date desc, u.full_name limit 20", args.toArray()));
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
        Integer pending = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and status = 'PENDING'", Integer.class, id);
        if (pending != null && pending > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ITEMS_PENDING");
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UserAccount owner = users.findById(person).orElseThrow();
        // A review that has a person chosen to close it is closed by that person; one opened before the choice existed is closed by anyone who may.
        UUID assignment = closerAssignment(id) == null ? null : approvals.requireCanSign(actor, subject(r, owner), "REVIEW_CLOSE", TrainingApprovalService.apart(person));
        UUID signature = signatures.createEntitySignature(TYPE, id, "Training review " + r.get("review_no") + " of " + owner.getFullName(), actor, request.signatureToken(), "TRAINING_REVIEW_CLOSED",
                "Training Management: personnel training review closed", null, null, null).getId();
        approvals.complete(assignment, signature);
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
        if (((Number) r.get("open_items")).intValue() == 0) tellCloser(actor, r);
        return get(actor, id);
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("""
            select r.*, (select count(*) from training_personnel_review_items i where i.review_id = r.id and i.status = 'PENDING') as open_items from training_personnel_reviews r where r.id = ? for update of r
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

package com.eqms.service.training;

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
                    new Item("SPECIMEN", "Specimen signature", "FRM.0007: the employee signs; the head of the department confirms.", false),
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

    public record CreateRequest(UUID personUserId, String kind, LocalDate eventDate, LocalDate absenceFrom, LocalDate absenceTo, String departmentFrom, String departmentTo, String note) {}
    public record ItemRequest(String status, UUID activityId, String note) {}
    public record CloseRequest(String signatureToken) {}
    public record CancelRequest(String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final UserAccountRepository users;
    private final TrainingActivityService activities;

    public TrainingPersonnelReviewService(JdbcTemplate jdbc, TrainingAccess access, ElectronicSignatureService signatures, AuditTrailService audit, UserAccountRepository users, TrainingActivityService activities) {
        this.activities = activities;
        this.jdbc = jdbc;
        this.access = access;
        this.signatures = signatures;
        this.audit = audit;
        this.users = users;
    }

    private static final String SELECT = """
        select r.id, r.review_no, r.person_user_id, u.full_name, u.employee_code, u.department, r.kind, r.status, r.event_date, r.absence_from, r.absence_to, r.department_from, r.department_to, r.note,
               r.created_at, cu.full_name as created_by_name, r.closed_at, xu.full_name as closed_by_name, r.cancel_reason,
               (select count(*) from training_personnel_review_items i where i.review_id = r.id and i.status = 'PENDING') as open_items
          from training_personnel_reviews r join app_users u on u.id = r.person_user_id join app_users cu on cu.id = r.created_by left join app_users xu on xu.id = r.closed_by
        """;

    private boolean inScope(UserAccount actor, UUID personId) {
        if (access.allDepartments(actor)) return true;
        UUID department = access.departmentOf(users.findById(personId).orElseThrow());
        return department != null && access.inScope(actor, department);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String kind, String search, int page, int limit) {
        access.require(actor, "training.job_assignment.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            where.append(" and lower(trim(u.department)) = lower(trim(?))");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        if (status != null && !status.isBlank()) {
            if (!Set.of("OPEN", "CLOSED", "CANCELLED").contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            where.append(" and r.status = ?"); args.add(status);
        }
        if (kind != null && !kind.isBlank()) {
            if (!ITEMS.containsKey(kind)) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
            where.append(" and r.kind = ?"); args.add(kind);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\')");
            args.add(like); args.add(like);
        }
        Long total = jdbc.queryForObject("select count(*) from training_personnel_reviews r join app_users u on u.id = r.person_user_id" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + where + " order by r.created_at desc limit ? offset ?", args.toArray()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
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
            select i.item_code, i.status, i.activity_id, a.training_number, a.training_title, a.status as activity_status, i.note, i.done_at, du.full_name as done_by_name
              from training_personnel_review_items i left join training_activities a on a.id = i.activity_id left join app_users du on du.id = i.done_by where i.review_id = ?
            """, id)) stored.put((String) row.get("item_code"), row);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Item item : ITEMS.get((String) r.get("kind"))) {
            Map<String, Object> row = stored.get(item.code());
            Map<String, Object> entry = row == null ? new LinkedHashMap<>(Map.of("itemCode", item.code(), "status", "PENDING")) : TrainingRows.camel(row);
            entry.put("label", item.label());
            entry.put("hint", item.hint());
            entry.put("canLink", item.link());
            items.add(entry);
        }
        out.put("items", items);
        boolean open = "OPEN".equals(r.get("status"));
        boolean manage = access.has(actor, "training.job_assignment.manage");
        out.put("capabilities", Map.of(
                "editItems", open && manage,
                "close", open && manage && ((Number) r.get("open_items")).intValue() == 0 && !actor.getId().equals(person),
                "cancel", open && manage));
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
        if (request.eventDate().isAfter(LocalDate.now(TrainingNumberService.ZONE).plusDays(31))) throw new IllegalArgumentException("TRAINING_REVIEW_INVALID");
        if ("ABSENCE_RETURN".equals(request.kind()) && (request.absenceFrom() == null || request.absenceTo() == null || request.absenceTo().isBefore(request.absenceFrom()))) throw new IllegalArgumentException("TRAINING_REVIEW_ABSENCE_INVALID");
        if (jdbc.queryForObject("select count(*) from training_personnel_reviews where person_user_id = ? and kind = ? and status = 'OPEN'", Integer.class, person.getId(), request.kind()) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ALREADY_OPEN");
        }
        String note = blank(request.note());
        if (note != null && note.length() > 1000) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        UUID id = UUID.randomUUID();
        boolean absence = "ABSENCE_RETURN".equals(request.kind());
        jdbc.update("insert into training_personnel_reviews(id, person_user_id, kind, event_date, absence_from, absence_to, department_from, department_to, note, created_by) values (?,?,?,?,?,?,?,?,?,?)",
                id, person.getId(), request.kind(), Date.valueOf(request.eventDate()), absence ? Date.valueOf(request.absenceFrom()) : null, absence ? Date.valueOf(request.absenceTo()) : null,
                "DEPT_TRANSFER".equals(request.kind()) || "LOCATION_TRANSFER".equals(request.kind()) ? blank(request.departmentFrom()) : null,
                "DEPT_TRANSFER".equals(request.kind()) || "LOCATION_TRANSFER".equals(request.kind()) ? blank(request.departmentTo()) : null, note, actor.getId());
        for (Item item : ITEMS.get(request.kind())) jdbc.update("insert into training_personnel_review_items(review_id, item_code) values (?,?)", id, item.code());
        audit.logAs(actor, TYPE, "Training review of " + person.getFullName(), id, "TRAINING_PERSONNEL_REVIEW_OPENED", null, "OPEN", request.kind() + (note == null ? "" : ". " + note));
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> updateItem(UserAccount actor, UUID id, String itemCode, ItemRequest request) {
        access.require(actor, "training.job_assignment.manage");
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        UUID person = (UUID) r.get("person_user_id");
        if (!inScope(actor, person)) throw new SecurityException(TrainingAccess.DENIED);
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
        jdbc.update("update training_personnel_review_items set status = ?, activity_id = ?, note = ?, done_by = ?, done_at = case when ? then now() else null end where review_id = ? and item_code = ?",
                request.status(), activityId, note, done ? actor.getId() : null, done, id, itemCode);
        audit.logAs(actor, TYPE, "Training review " + r.get("review_no"), id, "TRAINING_PERSONNEL_REVIEW_ITEM", null, request.status(), item.label() + (note == null ? "" : ". " + note));
        return get(actor, id);
    }

    /**
     * Starts the training an item asks for: creates an unplanned training activity for the department of the person who works the review, with a title that names the item and the employee,
     * and links it to the item. The session and the list are made on the training screen, as for any other training. The training reason follows the event of the review.
     */
    @Transactional
    public Map<String, Object> createActivity(UserAccount actor, UUID id, String itemCode) {
        access.require(actor, "training.job_assignment.manage");
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        UUID person = (UUID) r.get("person_user_id");
        if (!inScope(actor, person)) throw new SecurityException(TrainingAccess.DENIED);
        Item item = ITEMS.get((String) r.get("kind")).stream().filter(i -> i.code().equals(itemCode)).findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_REVIEW_ITEM_INVALID"));
        if (!item.link()) throw new IllegalArgumentException("TRAINING_REVIEW_ITEM_INVALID");
        Integer linked = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and item_code = ? and activity_id is not null", Integer.class, id, itemCode);
        if (linked != null && linked > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ITEM_LINKED");
        UserAccount owner = users.findById(person).orElseThrow();
        String reason = switch ((String) r.get("kind")) { case "NEW_HIRE" -> "NEW_HIRE"; case "ABSENCE_RETURN" -> "ABSENCE_RETURN"; default -> "TRANSFER"; };
        String title = item.label() + " — " + owner.getFullName();
        Map<String, Object> created = activities.create(actor, new TrainingActivityService.CreateRequest(null, "UNPLANNED", reason, null, title.length() > 255 ? title.substring(0, 255) : title, null,
                "From training review " + r.get("review_no"), null, null));
        UUID activityId = (UUID) created.get("id");
        jdbc.update("update training_personnel_review_items set activity_id = ? where review_id = ? and item_code = ?", activityId, id, itemCode);
        audit.logAs(actor, TYPE, "Training review " + r.get("review_no"), id, "TRAINING_PERSONNEL_REVIEW_TRAINING_CREATED", null, String.valueOf(created.get("trainingNumber")), item.label());
        Map<String, Object> out = get(actor, id);
        out.put("createdActivityId", activityId);
        return out;
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
        access.require(actor, "training.job_assignment.manage");
        Map<String, Object> r = lock(id);
        UUID person = (UUID) r.get("person_user_id");
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        if (!inScope(actor, person)) throw new SecurityException(TrainingAccess.DENIED);
        if (actor.getId().equals(person)) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        Integer pending = jdbc.queryForObject("select count(*) from training_personnel_review_items where review_id = ? and status = 'PENDING'", Integer.class, id);
        if (pending != null && pending > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_ITEMS_PENDING");
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UserAccount owner = users.findById(person).orElseThrow();
        UUID signature = signatures.createEntitySignature(TYPE, id, "Training review " + r.get("review_no") + " of " + owner.getFullName(), actor, request.signatureToken(), "TRAINING_REVIEW_CLOSED",
                "Training Management: personnel training review closed", null, null, null).getId();
        jdbc.update("update training_personnel_reviews set status = 'CLOSED', closed_by = ?, closed_at = now(), closed_signature_id = ? where id = ?", actor.getId(), signature, id);
        audit.logAs(actor, TYPE, "Training review " + r.get("review_no"), id, "TRAINING_PERSONNEL_REVIEW_CLOSED", "OPEN", "CLOSED", owner.getFullName());
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> cancel(UserAccount actor, UUID id, CancelRequest request) {
        access.require(actor, "training.job_assignment.manage");
        Map<String, Object> r = lock(id);
        if (!"OPEN".equals(r.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_CLOSED");
        if (!inScope(actor, (UUID) r.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        jdbc.update("update training_personnel_reviews set status = 'CANCELLED', cancel_reason = ? where id = ?", request.reason().trim(), id);
        audit.logAs(actor, TYPE, "Training review " + r.get("review_no"), id, "TRAINING_PERSONNEL_REVIEW_CANCELLED", "OPEN", "CANCELLED", request.reason().trim());
        return get(actor, id);
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("""
            select r.*, (select count(*) from training_personnel_review_items i where i.review_id = r.id and i.status = 'PENDING') as open_items from training_personnel_reviews r where r.id = ? for update of r
            """, id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    private static String blank(String v) { return v == null || v.isBlank() ? null : v.trim(); }
}

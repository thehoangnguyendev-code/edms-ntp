package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.DistributedSchedulerLockService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The events after which SOP.0003 asks for training, recognised by the system and put in front of the people who start the work (DEC-TRAINING-2026-11-27-01 H).
 * The scan reads what the system holds: the start date of an employee, the suspension and the reinstatement of an account, the change of department or position written to the
 * Audit Trail. It never opens a review or trains anybody: a person decides. An alert ends when the matching review is opened or the work is done, or when a person dismisses it with a reason and a signature.
 * The hardware of the scan is the clock: it runs every twenty minutes, so an event is seen within that time, and the same event is never alerted twice.
 */
@Service
public class TrainingPersonnelEventService implements com.eqms.service.UserLifecycleListener {
    private static final Logger log = LoggerFactory.getLogger(TrainingPersonnelEventService.class);
    static final Set<String> KINDS = Set.of("NEW_HIRE", "ABSENCE_RETURN", "DEPT_TRANSFER", "POSITION_CHANGE", "START_DATE_MISSING");
    /** Only events of this many recent days are taken on a scan: history before the feature is not alerted. */
    static final int LOOKBACK_DAYS = 90;
    public record DismissRequest(String reason, String signatureToken) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final UserAccountRepository users;
    private final TrainingRecipients recipients;
    private final TrainingNotifier notifier;
    private final AuditTrailService audit;
    private final ElectronicSignatureService signatures;
    private final DistributedSchedulerLockService locks;

    public TrainingPersonnelEventService(JdbcTemplate jdbc, TrainingAccess access, UserAccountRepository users, TrainingRecipients recipients, TrainingNotifier notifier,
                                         AuditTrailService audit, ElectronicSignatureService signatures, DistributedSchedulerLockService locks) {
        this.jdbc = jdbc;
        this.access = access;
        this.users = users;
        this.recipients = recipients;
        this.notifier = notifier;
        this.audit = audit;
        this.signatures = signatures;
        this.locks = locks;
    }

    // ----------------------------------------------------------------------------------------------------------------------------- the scan

    /**
     * User Management tells us when a person is created, suspended, reinstated, moved or given a start date (DEC-TRAINING-2026-11-27-01 H1-a). The scan then runs at once, so the alert
     * is there within seconds; the scan every twenty minutes remains as the net for anything missed. A suspension marked "other" (security, administration) is not an absence.
     */
    @Override
    @Transactional
    public void userChanged(UUID userId, String change) {
        scan(LocalDate.now(TrainingNumberService.ZONE));
    }

    @Scheduled(cron = "0 5/20 * * * *", zone = "Asia/Ho_Chi_Minh")
    public void scheduledScan() {
        try (var lease = locks.tryAcquire("training-personnel-events", Duration.ofMinutes(10))) {
            if (!lease.acquired()) return;
            scan(LocalDate.now(TrainingNumberService.ZONE));
        } catch (Exception failure) {
            log.error("The scan of the personnel events failed", failure);
        }
    }

    /** A person who administers Training runs the scan at once, for example after entering the start dates of several new employees. */
    @Transactional
    public Map<String, Object> scanNow(UserAccount actor) {
        access.require(actor, "training.admin.manage");
        int found = scan(LocalDate.now(TrainingNumberService.ZONE));
        return Map.of("found", found);
    }

    /** One pass: finds new events, closes the ones that are done, and tells people. Returns the number of events found. Public so that it can be run by hand and tested. */
    @Transactional
    public int scan(LocalDate today) {
        int found = 0;
        found += newEmployees(today);
        found += missingStartDates();
        found += returns(today);
        found += changes();
        closeDone();
        remindOpen();
        return found;
    }

    /** A new employee: Active, has an employee code (a real person, not a test or system account) and a start date within the days Training Properties calls new, or coming. */
    private int newEmployees(LocalDate today) {
        int days = jdbc.queryForObject("select initial_training_days from training_settings where id = 1", Integer.class);
        return insert("""
            insert into training_personnel_events(person_user_id, kind, event_date, source, source_key)
            select u.id, 'NEW_HIRE', u.start_date, 'USER_START_DATE', 'start:' || u.id || ':' || u.start_date from app_users u
             where u.status = 'Active' and nullif(trim(u.employee_code), '') is not null and u.start_date between ? and ?
               and not exists (select 1 from training_personnel_events x where x.person_user_id = u.id and x.kind = 'NEW_HIRE' and x.status = 'OPEN')
               and not exists (select 1 from training_personnel_reviews r where r.person_user_id = u.id and r.kind = 'NEW_HIRE' and r.status <> 'CANCELLED')
            on conflict (kind, source_key) do nothing returning id, person_user_id, kind
            """, java.sql.Date.valueOf(today.minusDays(days)), java.sql.Date.valueOf(today.plusDays(31)));
    }

    /** A new account of a real person without a start date: the "new employee" alert cannot start until someone enters it. */
    private int missingStartDates() {
        return insert("""
            insert into training_personnel_events(person_user_id, kind, event_date, source, source_key)
            select u.id, 'START_DATE_MISSING', u.created_at::date, 'USER_PROFILE', 'nostart:' || u.id from app_users u
             where u.status = 'Active' and nullif(trim(u.employee_code), '') is not null and u.start_date is null and u.created_at > now() - make_interval(days => ?)
            on conflict (kind, source_key) do nothing returning id, person_user_id, kind
            """, LOOKBACK_DAYS);
    }

    /** A return: an account reinstated after it was suspended for more than the months of Training Properties. The access windows of Document Control are not absences. */
    private int returns(LocalDate today) {
        int months = jdbc.queryForObject("select absence_retrain_months from training_settings where id = 1", Integer.class);
        return insert("""
            insert into training_personnel_events(person_user_id, kind, event_date, absence_from, absence_to, source, source_key)
            select distinct on (u.id) u.id, 'ABSENCE_RETURN', b.created_at::date, s.created_at::date, b.created_at::date, 'AUDIT_TRAIL', 'reinstate:' || b.id
              from audit_logs b join app_users u on u.id = b.entity_id
              join lateral (select a.created_at, a.comment from audit_logs a where a.entity_id = b.entity_id and a.action = 'USER_SUSPENDED' and a.created_at < b.created_at order by a.created_at desc limit 1) s on true
             where b.action = 'USER_REINSTATED' and b.created_at > now() - make_interval(days => ?) and u.status = 'Active' and nullif(trim(u.employee_code), '') is not null
               and coalesce(s.comment, '') not ilike '%time-limited%' and coalesce(s.comment, '') not ilike '%[OTHER]%' and b.created_at::date > (s.created_at::date + make_interval(months => ?))::date
               and not exists (select 1 from training_personnel_events x where x.person_user_id = u.id and x.kind = 'ABSENCE_RETURN' and x.status = 'OPEN')
             order by u.id, b.created_at desc
            on conflict (kind, source_key) do nothing returning id, person_user_id, kind
            """, LOOKBACK_DAYS, months);
    }

    /** A move to another department, or another position, written to the Audit Trail when the profile was changed. */
    private int changes() {
        return insert("""
            insert into training_personnel_events(person_user_id, kind, event_date, department_from, department_to, position_from, position_to, source, source_key)
            select distinct on (u.id, (lower(c.field_name) like '%department%')) u.id, case when lower(c.field_name) like '%department%' then 'DEPT_TRANSFER' else 'POSITION_CHANGE' end, a.created_at::date,
                   case when lower(c.field_name) like '%department%' then c.old_value end, case when lower(c.field_name) like '%department%' then c.new_value end,
                   case when lower(c.field_name) not like '%department%' then c.old_value end, case when lower(c.field_name) not like '%department%' then c.new_value end,
                   'AUDIT_TRAIL', 'update:' || a.id || ':' || lower(c.field_name)
              from audit_logs a join audit_log_changes c on c.audit_log_id = a.id join app_users u on u.id = a.entity_id
             where a.action = 'USER_UPDATED' and a.created_at > now() - make_interval(days => ?) and u.status = 'Active' and nullif(trim(u.employee_code), '') is not null
               and lower(c.field_name) in ('department', 'department name', 'position', 'job title', 'position name') and coalesce(c.old_value, '') <> coalesce(c.new_value, '') and nullif(trim(c.old_value), '') is not null
               and not exists (select 1 from training_personnel_events x where x.person_user_id = u.id and x.status = 'OPEN'
                                and x.kind = case when lower(c.field_name) like '%department%' then 'DEPT_TRANSFER' else 'POSITION_CHANGE' end)
             order by u.id, (lower(c.field_name) like '%department%'), a.created_at desc
            on conflict (kind, source_key) do nothing returning id, person_user_id, kind
            """, LOOKBACK_DAYS);
    }

    /** Runs an insert that returns the new rows, and tells the people who start the work about each one. */
    private int insert(String sql, Object... args) {
        List<Map<String, Object>> created = jdbc.queryForList(sql, args);
        for (Map<String, Object> row : created) tellAbout((UUID) row.get("id"), false);
        return created.size();
    }

    /** An alert ends by itself when the work it asks for is done, or the person is no longer there. */
    private void closeDone() {
        jdbc.update("update training_personnel_events e set status = 'HANDLED', closed_at = now(), closed_reason = 'The start date was entered' where e.status = 'OPEN' and e.kind = 'START_DATE_MISSING' and exists (select 1 from app_users u where u.id = e.person_user_id and u.start_date is not null)");
        jdbc.update("update training_personnel_events e set status = 'HANDLED', closed_at = now(), closed_reason = 'A job assignment is in force since the change' where e.status = 'OPEN' and e.kind = 'POSITION_CHANGE' and exists (select 1 from training_job_assignments j where j.person_user_id = e.person_user_id and j.status = 'EFFECTIVE' and j.effective_at::date >= e.event_date)");
        jdbc.update("update training_personnel_events e set status = 'HANDLED', closed_at = now(), closed_reason = 'A review of this kind was opened', review_id = r.id from training_personnel_reviews r where e.status = 'OPEN' and r.person_user_id = e.person_user_id and r.status <> 'CANCELLED' and r.created_at >= e.created_at - interval '1 day' and ((e.kind = 'NEW_HIRE' and r.kind = 'NEW_HIRE') or (e.kind = 'ABSENCE_RETURN' and r.kind = 'ABSENCE_RETURN') or (e.kind = 'DEPT_TRANSFER' and r.kind = 'DEPT_TRANSFER'))");
        jdbc.update("update training_personnel_events e set status = 'DISMISSED', closed_at = now(), closed_reason = 'The account is no longer active' where e.status = 'OPEN' and exists (select 1 from app_users u where u.id = e.person_user_id and u.status <> 'Active')");
    }

    /** An alert that stays open is told again after the days of Training Properties, to the same people and to Quality Assurance. */
    private void remindOpen() {
        int days = jdbc.queryForObject("select review_open_reminder_days from training_settings where id = 1", Integer.class);
        for (UUID id : jdbc.queryForList("select id from training_personnel_events where status = 'OPEN' and coalesce(last_reminded_at, created_at) < now() - make_interval(days => ?)", UUID.class, days)) tellAbout(id, true);
    }

    private static final Map<String, String> TITLE = Map.of("NEW_HIRE", "a new employee", "ABSENCE_RETURN", "a return after a long absence", "DEPT_TRANSFER", "a move to another department",
            "POSITION_CHANGE", "a change of position", "START_DATE_MISSING", "a start date that is missing");

    private void tellAbout(UUID eventId, boolean reminder) {
        Map<String, Object> e = jdbc.queryForList("""
            select e.*, u.full_name, u.employee_code, u.department from training_personnel_events e join app_users u on u.id = e.person_user_id where e.id = ?
            """, eventId).stream().findFirst().orElse(null);
        if (e == null) return;
        UUID department = jdbc.queryForList("select id from departments where lower(trim(name)) = lower(trim(?))", UUID.class, e.get("department")).stream().findFirst().orElse(null);
        Map<UUID, UserAccount> who = new java.util.LinkedHashMap<>();
        for (UserAccount p : recipients.holders("training.job_assignment.manage", department)) who.put(p.getId(), p);
        // Quality Assurance gives the training number of the initial training (SOP.0003 5.3.3); a reminder also reaches it
        if ("NEW_HIRE".equals(e.get("kind")) || reminder) {
            for (UUID qa : jdbc.queryForList("select id from departments where code = 'QA'", UUID.class)) for (UserAccount p : recipients.holders("training.code.allocate", qa)) who.put(p.getId(), p);
        }
        String what = TITLE.getOrDefault(String.valueOf(e.get("kind")), "an event");
        String name = e.get("full_name") + (e.get("employee_code") == null ? "" : " (" + e.get("employee_code") + ")");
        String message = (reminder ? "Still waiting: " : "") + name + " — " + what + " (" + e.get("event_date") + "). "
                + ("START_DATE_MISSING".equals(e.get("kind")) ? "Enter the start date in the user profile so that the training of a new employee can start (SOP.0003 5.1)."
                : "Open the training review and start the work the SOP asks for (SOP.0003 5.1, 5.3.11).");
        for (UserAccount person : who.values()) {
            if (person.getId().equals(e.get("person_user_id"))) continue;
            notifier.send("TRAINING_PERSONNEL_EVENT", person, null, "Training: " + what + " — " + e.get("full_name"), message, "TRAINING_PERSONNEL_EVENTS", eventId,
                    "personnel-event:" + eventId + (reminder ? ":" + LocalDate.now(TrainingNumberService.ZONE) : ""));
        }
        jdbc.update("update training_personnel_events set last_reminded_at = now() where id = ?", eventId);
    }

    // ----------------------------------------------------------------------------------------------------------------------------- reading and dismissing

    private boolean inScope(UserAccount actor, UUID personId) {
        if (access.allDepartments(actor)) return true;
        UUID department = access.departmentOf(users.findById(personId).orElseThrow());
        return department != null && access.inScope(actor, department);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String kind, String search, int page, int limit) {
        return list(actor, status, kind, search, null, null, page, limit, Map.of());
    }

    /** The list for the Alerts tab: the same filters, sort and paging as the other lists of Training; the server does all of it. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String status, String kind, String search, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.job_assignment.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (!access.allDepartments(actor)) {
            where.append(" and lower(trim(u.department)) = lower(trim(?))");
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        String wanted = status == null || status.isBlank() ? "OPEN" : status;
        if (!Set.of("OPEN", "HANDLED", "DISMISSED").contains(wanted)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
        where.append(" and e.status = ?");
        args.add(wanted);
        if (kind != null && !kind.isBlank()) {
            if (!KINDS.contains(kind)) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
            where.append(" and e.kind = ?");
            args.add(kind);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(java.util.Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (eqms_fold(u.full_name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(u.employee_code,'')) like eqms_fold(?) escape '\\')");
            args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().dateRange("e.event_date", more.get("eventFrom"), more.get("eventTo"));
        if (more.get("department") != null && !more.get("department").isBlank()) extra.raw("lower(trim(u.department)) = lower(trim(?))", more.get("department"));
        where.append(extra.and());
        args.addAll(extra.args());
        Long total = jdbc.queryForObject("select count(*) from training_personnel_events e join app_users u on u.id = e.person_user_id" + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select e.id, e.person_user_id, u.full_name, u.employee_code, u.avatar, u.department, e.kind, e.event_date, e.absence_from, e.absence_to, e.department_from, e.department_to, e.position_from, e.position_to,
                   e.source, e.status, e.review_id, e.closed_reason, e.created_at
              from training_personnel_events e join app_users u on u.id = e.person_user_id""" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("employee", "u.full_name", "employeeCode", "u.employee_code", "kind", "e.kind", "eventDate", "e.event_date", "department", "u.department", "status", "e.status"),
                        "e.event_date desc, e.created_at desc") + " limit ? offset ?", args.toArray()));
        boolean manage = access.has(actor, "training.job_assignment.manage");
        for (Map<String, Object> row : rows) row.put("canAct", manage && "OPEN".equals(row.get("status")));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** How many alerts wait for the person (their department; every department for a person who may act on all). */
    @Transactional(readOnly = true)
    public int openCount(UserAccount actor) {
        if (!access.has(actor, "training.job_assignment.manage")) return 0;
        List<Object> args = new ArrayList<>();
        String scope = "";
        if (!access.allDepartments(actor)) {
            scope = " and lower(trim(u.department)) = lower(trim(?))";
            args.add(actor.getDepartment() == null ? "" : actor.getDepartment());
        }
        Integer n = jdbc.queryForObject("select count(*) from training_personnel_events e join app_users u on u.id = e.person_user_id where e.status = 'OPEN'" + scope, Integer.class, args.toArray());
        return n == null ? 0 : n;
    }

    /** A person decides the alert needs no review: the reason and the signature stay on record. */
    @Transactional
    public Map<String, Object> dismiss(UserAccount actor, UUID id, DismissRequest request) {
        access.require(actor, "training.job_assignment.manage");
        Map<String, Object> e = jdbc.queryForList("select * from training_personnel_events where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!inScope(actor, (UUID) e.get("person_user_id"))) throw new SecurityException(TrainingAccess.DENIED);
        if (!"OPEN".equals(e.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PERSONNEL_EVENT_CLOSED");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        if (request.reason().trim().length() > 300) throw new IllegalArgumentException("TRAINING_NOTE_TOO_LONG");
        UserAccount person = users.findById((UUID) e.get("person_user_id")).orElseThrow();
        UUID signature = signatures.createEntitySignature("TRAINING_PERSONNEL_EVENT", id, "Training alert of " + person.getFullName(), actor, request.signatureToken(), "TRAINING_PERSONNEL_EVENT_DISMISSED",
                "Training Management: training alert dismissed", null, null, null).getId();
        jdbc.update("update training_personnel_events set status = 'DISMISSED', closed_by = ?, closed_at = now(), closed_reason = ?, signature_id = ? where id = ?", actor.getId(), request.reason().trim(), signature, id);
        audit.logAs(actor, "TRAINING_PERSONNEL_REVIEW", person.getEmployeeCode() != null && !person.getEmployeeCode().isBlank() ? person.getEmployeeCode() : person.getFullName(), id, "TRAINING_PERSONNEL_EVENT_DISMISSED", "OPEN", "DISMISSED",
                request.reason().trim(), List.of(new AuditTrailChangeResponse("Alert", TrainingStore.words(String.valueOf(e.get("kind"))), "Dismissed"), new AuditTrailChangeResponse("Reason", null, request.reason().trim())), signature);
        return TrainingRows.camel(jdbc.queryForList("select * from training_personnel_events where id = ?", id)).getFirst();
    }
}

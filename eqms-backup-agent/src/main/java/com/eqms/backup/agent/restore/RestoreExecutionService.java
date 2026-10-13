package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Restore execution, step R4 (SDS 11.3, WP3.1 slice 1): the checks before a run, and the schedule of an approved request for a
 * maintenance window. Scheduling changes no data. The run itself (R5 to R12) is not built, so an approved request can be scheduled
 * but is never executed here.
 */
@Service
public class RestoreExecutionService {

    /** Checks that a scheduled run is not able to stand on: they are read again when the run starts. */
    public static final List<String> NOT_CHECKED_YET = List.of(
            "Khóa giải mã trên máy thực thi: chỉ tiến trình restore worker kiểm được (chưa nối vào bước này)",
            "Trạng thái bảo trì lúc lập lịch: không kiểm; được kiểm khi vào cửa sổ (WP3.1 lát 2)",
            "Đo lại báo cáo tác động lúc chạy (M4): chưa làm");

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final MaintenanceService maintenance;
    private final RestoreRehearsalService rehearsals;

    public RestoreExecutionService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, MaintenanceService maintenance,
                                   RestoreRehearsalService rehearsals) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.maintenance = maintenance;
        this.rehearsals = rehearsals;
    }

    /** The checks that decide whether the request can be scheduled, and the schedule that exists, if any. */
    public Map<String, Object> preflight(String restoreNumber) {
        Map<String, Object> request = request(restoreNumber);
        List<Map<String, Object>> checks = new ArrayList<>();
        checks.add(check("REQUEST_APPROVED", "APPROVED".equals(request.get("status")),
                "The request is " + request.get("status") + "; only an approved request can run"));
        checks.add(check("APPROVAL_SIGNED", request.get("approval_signature_ref") != null,
                "The approval carries the approver's electronic signature"));
        checks.add(check("TWO_PEOPLE", request.get("approved_by") != null
                        && !String.valueOf(request.get("approved_by")).equalsIgnoreCase(String.valueOf(request.get("requested_by"))),
                "The approver is not the person who asked"));
        checks.add(check("BACKUP_COMPLETED", "COMPLETED".equals(request.get("run_status")),
                "The backup is " + request.get("run_status")));
        checks.add(check("BACKUP_VERIFIED", "VERIFIED".equals(latestVerification((UUID) request.get("run_id"))),
                "The latest integrity check of the backup must have passed"));
        // another request on the same backup must not be scheduled; this request's own schedule is not another one
        Integer others = jdbc.queryForObject("select count(*) from restore_execution e join restore_request q on q.id = e.request_id "
                + "where q.run_id = ? and q.id <> ? and e.status = 'SCHEDULED'", Integer.class, request.get("run_id"), request.get("id"));
        checks.add(check("NO_OPEN_SCHEDULE", others == null || others == 0, "No other restore of this backup is scheduled"));
        boolean ready = checks.stream().allMatch(c -> Boolean.TRUE.equals(c.get("ok")));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("restoreNumber", restoreNumber);
        out.put("status", request.get("status"));
        out.put("checks", checks);
        out.put("readyToSchedule", ready);
        Map<String, Object> schedule = openSchedule((UUID) request.get("id"));
        out.put("schedule", schedule);
        MaintenanceService.Status system = maintenance.status();
        out.put("systemState", system.state().name());
        // the request id is kept after the window closes; it names a holder only while the system is locked for it
        out.put("systemRequestId", system.state() == MaintenanceService.State.LOCKED_RESTORING ? system.restoreNumber() : null);
        out.put("testRestore", schedule == null ? null : testRestoreOf(UUID.fromString((String) schedule.get("id"))));
        out.put("notCheckedYet", NOT_CHECKED_YET);
        return out;
    }

    /** Schedules an approved request for a window that starts later. The executor may not be the approver. */
    public Map<String, Object> schedule(String restoreNumber, String by, Instant windowStart) {
        String who = by == null ? "" : by.trim();
        if (who.isEmpty()) throw ExportException.invalid("RESTORE_EXECUTOR_REQUIRED", "Name the person who schedules the restore");
        if (windowStart == null || !windowStart.isAfter(Instant.now())) {
            throw ExportException.invalid("RESTORE_WINDOW_IN_PAST", "The maintenance window must start later than now");
        }
        Map<String, Object> request = request(restoreNumber);
        if (!"APPROVED".equals(request.get("status"))) {
            throw ExportException.conflict("RESTORE_STATE", "Only an approved request can be scheduled");
        }
        if (who.equalsIgnoreCase(String.valueOf(request.get("approved_by")))) {
            throw ExportException.conflict("RESTORE_SAME_PERSON", "The person who approved a restore cannot schedule it");
        }
        Map<String, Object> ready = preflight(restoreNumber);
        if (!Boolean.TRUE.equals(ready.get("readyToSchedule"))) {
            throw ExportException.conflict("RESTORE_NOT_READY", "A check is not passed; see the pre-checks before scheduling");
        }
        UUID requestUuid = (UUID) request.get("id");
        String backupNumber = String.valueOf(request.get("backup_number"));
        try {
            tx.executeWithoutResult(s -> {
                UUID execution = jdbc.queryForObject("insert into restore_execution(request_id, status, window_start, scheduled_by) "
                        + "values (?, 'SCHEDULED', ?, ?) returning id", UUID.class, requestUuid, java.sql.Timestamp.from(windowStart), who);
                jdbc.update("insert into restore_execution_event(execution_id, event, by_user) values (?, 'SCHEDULED', ?)", execution, who);
            });
        } catch (DuplicateKeyException e) {
            throw ExportException.conflict("RESTORE_IN_PROGRESS", "This request already has an open schedule");
        }
        ledger.append(who, "RESTORE_SCHEDULED", backupNumber, Map.of("restoreNumber", restoreNumber, "windowStart", windowStart.toString()));
        return preflight(restoreNumber);
    }

    /**
     * Starts the restore window (SDS 11.5.1, WP3.1 slice 2): the system goes from DRAINED to LOCKED_RESTORING for this request. It
     * is allowed only when the request has a schedule, the window has come, and the notice that drained the system was started for
     * this same request. The administrator confirms that no user is still working. The run itself (R5 onward) is not built, so the
     * system stays locked until it is reopened.
     */
    public Map<String, Object> enterWindow(String restoreNumber, String by, boolean noUserConfirmed) {
        String who = by == null ? "" : by.trim();
        if (who.isEmpty()) throw ExportException.invalid("RESTORE_EXECUTOR_REQUIRED", "Name the person who starts the restore window");
        Map<String, Object> request = request(restoreNumber);
        List<Map<String, Object>> open = jdbc.queryForList("select id, window_start from restore_execution where request_id = ? and status = 'SCHEDULED'",
                request.get("id"));
        if (open.isEmpty()) throw ExportException.conflict("RESTORE_NOT_SCHEDULED", "Schedule a window before the system is locked for this restore");
        Map<String, Object> schedule = open.get(0);
        Instant windowStart = ((Timestamp) schedule.get("window_start")).toInstant();
        if (Instant.now().isBefore(windowStart)) {
            throw ExportException.conflict("RESTORE_WINDOW_NOT_REACHED", "The maintenance window starts at " + windowStart + "; it has not come yet");
        }
        MaintenanceService.Status state = maintenance.status();
        if (state.state() != MaintenanceService.State.DRAINED || !restoreNumber.equals(state.restoreNumber())) {
            throw ExportException.conflict("RESTORE_NOT_DRAINED", "The notice for " + restoreNumber + " must have run out and drained the system first; it is "
                    + state.state() + (state.restoreNumber() == null ? "" : " for " + state.restoreNumber()));
        }
        MaintenanceService.Status locked = maintenance.lock(who, noUserConfirmed);
        UUID execution = (UUID) schedule.get("id");
        jdbc.update("insert into restore_execution_event(execution_id, event, by_user, detail_json) values (?, 'WINDOW_LOCKED', ?, ?::jsonb)",
                execution, who, CanonicalJson.of(Map.of("systemState", locked.state().name())));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("restoreNumber", restoreNumber);
        out.put("systemState", locked.state().name());
        return out;
    }

    /**
     * Starts the test restore of the backup for this request inside the restore window (SDS 14.1, WP3.1 slice 3). The restore worker
     * restores the backup into a scratch database and runs the checks of the rehearsal (C1 to C4 and C6 among them). Production is
     * not touched. Allowed only while the system is LOCKED_RESTORING for this request, and once per window.
     */
    public Map<String, Object> startTestRestore(String restoreNumber, String by) {
        String who = by == null ? "" : by.trim();
        if (who.isEmpty()) throw ExportException.invalid("RESTORE_EXECUTOR_REQUIRED", "Name the person who starts the test restore");
        Map<String, Object> request = request(restoreNumber);
        List<Map<String, Object>> open = jdbc.queryForList("select id from restore_execution where request_id = ? and status = 'SCHEDULED'", request.get("id"));
        if (open.isEmpty()) throw ExportException.conflict("RESTORE_NOT_SCHEDULED", "Schedule a window before the test restore");
        UUID execution = (UUID) open.get(0).get("id");
        MaintenanceService.Status state = maintenance.status();
        if (state.state() != MaintenanceService.State.LOCKED_RESTORING || !restoreNumber.equals(state.restoreNumber())) {
            throw ExportException.conflict("RESTORE_NOT_LOCKED", "The system must be locked for this restore before the test restore starts; it is " + state.state());
        }
        Integer already = jdbc.queryForObject("select count(*) from restore_execution_event where execution_id = ? and event = 'TEST_RESTORE_QUEUED'", Integer.class, execution);
        if (already != null && already > 0) throw ExportException.conflict("RESTORE_TEST_ALREADY_REQUESTED", "A test restore was already started in this window");
        String backupNumber = String.valueOf(request.get("backup_number"));
        String rehearsalId = String.valueOf(rehearsals.request(backupNumber, who, "Test restore for " + restoreNumber + " in the restore window").get("rehearsalId"));
        tx.executeWithoutResult(s -> jdbc.update("insert into restore_execution_event(execution_id, event, by_user, detail_json) values (?, 'TEST_RESTORE_QUEUED', ?, ?::jsonb)",
                execution, who, CanonicalJson.of(Map.of("rehearsalId", rehearsalId))));
        ledger.append(who, "RESTORE_TEST_QUEUED", backupNumber, Map.of("restoreNumber", restoreNumber, "rehearsalId", rehearsalId));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("restoreNumber", restoreNumber);
        out.put("rehearsalId", rehearsalId);
        out.put("status", "QUEUED");
        return out;
    }

    private Map<String, Object> request(String restoreNumber) {
        List<Map<String, Object>> rows = jdbc.queryForList("select r.id, r.restore_number, r.status, r.requested_by, r.approved_by, r.approval_signature_ref, "
                + "r.run_id, b.backup_number, b.status as run_status from restore_request r join backup_run b on b.id = r.run_id where r.restore_number = ?", restoreNumber);
        if (rows.isEmpty()) throw ExportException.notFound("RESTORE_REQUEST_NOT_FOUND", "There is no restore request " + restoreNumber);
        return rows.get(0);
    }

    /** The latest test restore queued in this window, with its rehearsal outcome; null when none was started. */
    private Map<String, Object> testRestoreOf(UUID execution) {
        List<String> ids = jdbc.queryForList("select detail_json->>'rehearsalId' from restore_execution_event where execution_id = ? "
                + "and event = 'TEST_RESTORE_QUEUED' order by id desc limit 1", String.class, execution);
        return ids.isEmpty() ? null : rehearsals.get(ids.get(0));
    }

    private String latestVerification(UUID runId) {
        return jdbc.queryForList("select result from backup_verification where run_id = ? order by verified_at desc limit 1", String.class, runId)
                .stream().findFirst().orElse("NOT_VERIFIED");
    }

    private Map<String, Object> openSchedule(UUID requestUuid) {
        List<Map<String, Object>> rows = jdbc.queryForList("select e.id, e.status, e.window_start, e.scheduled_by, e.scheduled_at "
                + "from restore_execution e where e.request_id = ? and e.status = 'SCHEDULED'", requestUuid);
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", String.valueOf(row.get("id")));
        out.put("status", row.get("status"));
        out.put("windowStart", String.valueOf(row.get("window_start")));
        out.put("scheduledBy", row.get("scheduled_by"));
        out.put("scheduledAt", String.valueOf(row.get("scheduled_at")));
        return out;
    }

    private static Map<String, Object> check(String code, boolean ok, String detail) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("code", code);
        c.put("ok", ok);
        c.put("detail", detail);
        return c;
    }
}

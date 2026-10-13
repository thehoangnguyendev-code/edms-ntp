package com.eqms.backup.agent.maintenance;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The maintenance state machine (SDS 11.5.1). The database row is the record; the lock file is what the eQMS backend reads on
 * every request, so the lock holds even when the database is being replaced or unreachable. The file is written before the
 * state changes, and it is removed only when the state is NORMAL again.
 */
@Service
public class MaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);

    public enum State { NORMAL, NOTICE, DRAINED, LOCKED_RESTORING }

    public record Status(State state, String restoreNumber, Instant endsAt, String changedBy, Instant changedAt) {
    }

    public static final class MaintenanceException extends RuntimeException {
        public final String code;

        public MaintenanceException(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final AgentProperties properties;

    public MaintenanceService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, AgentProperties properties) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.properties = properties;
        // BR-16 sets the notice at 5 to 240 minutes for TEST and PROD. A shorter minimum exists only for DEV testing.
        if (!"DEV".equalsIgnoreCase(properties.getEnvironment()) && properties.getMaintenance().getNoticeMinMinutes() < 5) {
            throw new IllegalStateException("The notice minimum below 5 minutes is allowed only in DEV (BR-16)");
        }
    }

    public Status status() {
        return jdbc.queryForObject("select state, restore_number, ends_at, changed_by, changed_at from maintenance_state where id = 1", (rs, i) -> new Status(
                State.valueOf(rs.getString("state")), rs.getString("restore_number"),
                rs.getTimestamp("ends_at") == null ? null : rs.getTimestamp("ends_at").toInstant(),
                rs.getString("changed_by"), rs.getTimestamp("changed_at").toInstant()));
    }

    /** NORMAL -> NOTICE. Users keep working for n minutes, then the system drains them. */
    public Status notice(int minutes, String restoreNumber, String by) {
        int min = properties.getMaintenance().getNoticeMinMinutes();
        int max = properties.getMaintenance().getNoticeMaxMinutes();
        if (minutes < min || minutes > max) throw new MaintenanceException("MAINTENANCE_NOTICE_OUT_OF_RANGE", "The notice must be between " + min + " and " + max + " minutes");
        String request = restoreNumber == null || restoreNumber.isBlank() ? null : restoreNumber.trim();
        Instant ends = Instant.now().plusSeconds(minutes * 60L);
        return change(State.NORMAL, State.NOTICE, "MAINTENANCE_NOTICE_STARTED", request, ends, by, Map.of("minutes", minutes));
    }

    /** NOTICE or DRAINED -> NORMAL. Nothing was locked yet, or the lock is withdrawn before anything ran. */
    public Status cancel(String by) {
        Status s = status();
        if (s.state() != State.NOTICE && s.state() != State.DRAINED) throw new MaintenanceException("MAINTENANCE_STATE", "Only a notice or a drained system can be cancelled; it is " + s.state());
        return change(s.state(), State.NORMAL, "MAINTENANCE_CANCELLED", s.restoreNumber(), null, by, Map.of());
    }

    /** DRAINED -> LOCKED_RESTORING. The administrator confirms that no user is still working. */
    public Status lock(String by, boolean noUserConfirmed) {
        if (!noUserConfirmed) throw new MaintenanceException("MAINTENANCE_CONFIRMATION_REQUIRED", "Confirm that no user is still working before locking");
        Status s = status();
        if (s.state() != State.DRAINED) throw new MaintenanceException("MAINTENANCE_STATE", "The system can be locked only after the notice has ended; it is " + s.state());
        return change(State.DRAINED, State.LOCKED_RESTORING, "MAINTENANCE_LOCKED", s.restoreNumber(), null, by, Map.of("confirmedNoUsers", true));
    }

    /** LOCKED_RESTORING -> NORMAL. Reopening the system after the restore work is finished. */
    public Status unlock(String by) {
        Status s = status();
        if (s.state() != State.LOCKED_RESTORING) throw new MaintenanceException("MAINTENANCE_STATE", "Only a locked system can be reopened; it is " + s.state());
        return change(State.LOCKED_RESTORING, State.NORMAL, "MAINTENANCE_UNLOCKED", s.restoreNumber(), null, by, Map.of());
    }

    /** NOTICE -> DRAINED when the notice has run out. Runs on the schedule; the timing is not left to a person. */
    @Scheduled(fixedDelay = 5000, initialDelay = 10000)
    public void tick() {
        try {
            Status s = status();
            if (s.state() == State.NOTICE && s.endsAt() != null && !Instant.now().isBefore(s.endsAt())) {
                change(State.NOTICE, State.DRAINED, "MAINTENANCE_DRAINED", s.restoreNumber(), null, "system", Map.of());
            }
        } catch (RuntimeException e) {
            log.error("Maintenance tick failed; the lock file keeps its last state", e);
        }
    }

    private Status change(State from, State to, String event, String restoreNumber, Instant endsAt, String by, Map<String, Object> detail) {
        String actor = by == null || by.isBlank() ? "system" : by.trim();
        Status[] result = new Status[1];
        tx.executeWithoutResult(s -> {
            Status now = jdbc.queryForObject("select state, restore_number, ends_at, changed_by, changed_at from maintenance_state where id = 1 for update", (rs, i) -> new Status(
                    State.valueOf(rs.getString("state")), rs.getString("restore_number"),
                    rs.getTimestamp("ends_at") == null ? null : rs.getTimestamp("ends_at").toInstant(),
                    rs.getString("changed_by"), rs.getTimestamp("changed_at").toInstant()));
            if (now.state() != from) {
                throw new MaintenanceException("MAINTENANCE_STATE", "The system changed to " + now.state() + " while this was done; reload and try again");
            }
            // the lock file first: if the database write fails afterwards, the file already says what the users see
            writeLockFile(to, restoreNumber, endsAt);
            jdbc.update("update maintenance_state set state = ?, restore_number = ?, ends_at = ?, changed_by = ?, changed_at = now() where id = 1",
                    to.name(), restoreNumber, endsAt == null ? null : Timestamp.from(endsAt), actor);
            jdbc.update("insert into maintenance_event(event, from_state, to_state, restore_number, by_user, detail_json) values (?,?,?,?,?,?::jsonb)",
                    event, from.name(), to.name(), restoreNumber, actor, CanonicalJson.of(detail));
            if (to == State.NORMAL) removeLockFile();
            result[0] = status();
        });
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("from", from.name());
        data.put("to", to.name());
        data.put("restoreNumber", restoreNumber);
        data.put("by", actor);
        ledger.append(actor, event, restoreNumber == null ? "maintenance" : restoreNumber, data);
        return result[0];
    }

    private void writeLockFile(State state, String restoreNumber, Instant endsAt) {
        Path file = properties.getMaintenance().getLockFile();
        if (state == State.NORMAL) return;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("state", state.name());
        body.put("restoreNumber", restoreNumber);
        body.put("endsAt", endsAt == null ? null : endsAt.toString());
        body.put("writtenAt", Instant.now().toString());
        try {
            Files.createDirectories(file.getParent());
            Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(tmp, CanonicalJson.of(body), StandardCharsets.UTF_8);
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new MaintenanceException("MAINTENANCE_LOCK_FILE", "The lock file could not be written: " + e.getMessage());
        }
    }

    private void removeLockFile() {
        try {
            Files.deleteIfExists(properties.getMaintenance().getLockFile());
        } catch (IOException e) {
            throw new MaintenanceException("MAINTENANCE_LOCK_FILE", "The lock file could not be removed: " + e.getMessage());
        }
    }
}

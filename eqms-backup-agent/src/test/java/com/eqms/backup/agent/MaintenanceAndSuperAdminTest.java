package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.maintenance.MaintenanceService;
import com.eqms.backup.agent.maintenance.MaintenanceService.MaintenanceException;
import com.eqms.backup.agent.maintenance.MaintenanceService.State;
import com.eqms.backup.agent.maintenance.SuperAdminService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Maintenance window (SDS 11.5.1) and the Super Administrator account (11.6, BR-17). */
class MaintenanceAndSuperAdminTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    LedgerService ledger;
    MaintenanceService maintenance;
    SuperAdminService superAdmins;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        properties.getMaintenance().setLockFile(tmp.resolve("maintenance").resolve("maintenance.lock"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        maintenance = new MaintenanceService(db.jdbc, db.tx, ledger, properties);
        superAdmins = new SuperAdminService(db.jdbc);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private Path lockFile() {
        return properties.getMaintenance().getLockFile();
    }

    private void expireNotice() {
        db.jdbc.update("update maintenance_state set ends_at = now() - interval '1 second' where id = 1");
    }

    @Test
    void theNoticeLengthIsBoundedAsDecided() {
        assertThatThrownBy(() -> maintenance.notice(4, "RQ-1", "exec")).isInstanceOfSatisfying(MaintenanceException.class, e -> assertThat(e.code).isEqualTo("MAINTENANCE_NOTICE_OUT_OF_RANGE"));
        assertThatThrownBy(() -> maintenance.notice(241, "RQ-1", "exec")).isInstanceOf(MaintenanceException.class);
        assertThat(maintenance.notice(10, "RQ-1", "exec").state()).isEqualTo(State.NOTICE);
    }

    @Test
    void theWholeSequenceRunsNoticeDrainLockAndReopenWithALockFileAtEachStep() throws Exception {
        assertThat(maintenance.status().state()).isEqualTo(State.NORMAL);
        assertThat(lockFile()).doesNotExist();

        maintenance.notice(5, "RQ-7", "executor.one");
        assertThat(maintenance.status().state()).isEqualTo(State.NOTICE);
        assertThat(maintenance.status().endsAt()).isAfter(Instant.now());
        assertThat(Files.readString(lockFile())).contains("\"state\":\"NOTICE\"");

        maintenance.tick();
        assertThat(maintenance.status().state()).as("the notice has not run out yet").isEqualTo(State.NOTICE);

        expireNotice();
        maintenance.tick();
        assertThat(maintenance.status().state()).isEqualTo(State.DRAINED);
        assertThat(Files.readString(lockFile())).contains("\"state\":\"DRAINED\"");

        assertThatThrownBy(() -> maintenance.lock("admin.one", false)).isInstanceOfSatisfying(MaintenanceException.class, e -> assertThat(e.code).isEqualTo("MAINTENANCE_CONFIRMATION_REQUIRED"));
        maintenance.lock("admin.one", true);
        assertThat(maintenance.status().state()).isEqualTo(State.LOCKED_RESTORING);
        assertThat(Files.readString(lockFile())).contains("\"state\":\"LOCKED_RESTORING\"").contains("RQ-7");

        maintenance.unlock("admin.one");
        assertThat(maintenance.status().state()).isEqualTo(State.NORMAL);
        assertThat(lockFile()).as("the lock file goes when the system is open again").doesNotExist();

        assertThat(db.jdbc.queryForList("select event from maintenance_event order by id", String.class))
                .containsExactly("MAINTENANCE_NOTICE_STARTED", "MAINTENANCE_DRAINED", "MAINTENANCE_LOCKED", "MAINTENANCE_UNLOCKED");
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("MAINTENANCE_NOTICE_STARTED", "MAINTENANCE_LOCKED", "MAINTENANCE_UNLOCKED");
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void aNoticeCanBeWithdrawnBeforeTheSystemIsLocked() {
        maintenance.notice(5, "RQ-8", "executor.one");
        maintenance.cancel("admin.one");
        assertThat(maintenance.status().state()).isEqualTo(State.NORMAL);
        assertThat(lockFile()).doesNotExist();
    }

    @Test
    void stepsOutOfOrderAreRefused() {
        assertThatThrownBy(() -> maintenance.cancel("admin.one")).isInstanceOfSatisfying(MaintenanceException.class, e -> assertThat(e.code).isEqualTo("MAINTENANCE_STATE"));
        assertThatThrownBy(() -> maintenance.unlock("admin.one")).isInstanceOfSatisfying(MaintenanceException.class, e -> assertThat(e.code).isEqualTo("MAINTENANCE_STATE"));
        maintenance.notice(5, "RQ-9", "executor.one");
        assertThatThrownBy(() -> maintenance.lock("admin.one", true)).isInstanceOfSatisfying(MaintenanceException.class, e -> assertThat(e.code).isEqualTo("MAINTENANCE_STATE"));
        assertThatThrownBy(() -> maintenance.notice(5, "RQ-10", "executor.one")).isInstanceOf(MaintenanceException.class);
        assertThat(maintenance.status().state()).isEqualTo(State.NOTICE);
    }

    @Test
    void aNoticeRecordsTheNoticeStateWithoutDrainingUsers() throws Exception {
        maintenance.notice(5, "RQ-11", "executor.one");
        assertThat(Files.readString(lockFile())).contains("NOTICE").doesNotContain("DRAINED");
    }

    @Test
    void theAccountIsCreatedOnceWithAStrongPasswordAndEveryLoginIsRecorded() {
        assertThatThrownBy(() -> superAdmins.create("super.admin", "short1!", "operator")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> superAdmins.create("super.admin", "onlyletters", "operator")).isInstanceOf(IllegalArgumentException.class);
        superAdmins.create("super.admin", "Test@12345", "operator");
        assertThat(superAdmins.exists()).isTrue();

        assertThat(superAdmins.verify("super.admin", "Test@12345")).isTrue();
        assertThat(superAdmins.verify("super.admin", "wrong-password")).isFalse();
        assertThat(superAdmins.verify("nobody", "Test@12345")).isFalse();
        assertThat(db.jdbc.queryForList("select event from super_admin_event order by id", String.class))
                .containsExactly("ACCOUNT_CREATED", "LOGIN_OK", "LOGIN_FAILED", "LOGIN_FAILED");
    }

    @Test
    void thePasswordIsStoredOnlyAsAHashAndTheLogRowsCannotBeChanged() {
        superAdmins.create("super.admin", "Test@12345", "operator");
        String stored = db.jdbc.queryForObject("select password_hash from super_admin", String.class);
        assertThat(stored).startsWith("$2").doesNotContain("Test@12345");
        superAdmins.verify("super.admin", "Test@12345");
        assertThatThrownBy(() -> db.jdbc.update("update super_admin_event set event = 'LOGIN_OK'")).isInstanceOf(RuntimeException.class);
        maintenance.notice(5, "RQ-12", "executor.one"); // a row must exist, or a DELETE that matches nothing never reaches the trigger
        assertThatThrownBy(() -> db.jdbc.update("delete from maintenance_event")).isInstanceOf(RuntimeException.class);
    }

    @Test
    void fiveFailedSignInsLockTheAccountEvenForTheRightPassword() {
        superAdmins.create("super.admin", "Test@12345", "operator");
        for (int i = 0; i < SuperAdminService.MAX_FAILED_SIGN_INS; i++) {
            assertThat(superAdmins.verify("super.admin", "wrong-password")).isFalse();
        }
        assertThatThrownBy(() -> superAdmins.verify("super.admin", "Test@12345")).isInstanceOf(SuperAdminService.LockedOutException.class);
        assertThatThrownBy(() -> superAdmins.verify("super.admin", "wrong-password")).isInstanceOf(SuperAdminService.LockedOutException.class);
        assertThat(db.jdbc.queryForObject("select count(*) from super_admin_event where event = 'LOGIN_THROTTLED'", Integer.class)).isEqualTo(2);
    }

    @Test
    void theLockLapsesAfterTheWindowAndASuccessStartsTheCountAgain() {
        superAdmins.create("super.admin", "Test@12345", "operator");
        for (int i = 0; i < SuperAdminService.MAX_FAILED_SIGN_INS; i++) {
            db.jdbc.update("insert into super_admin_event(username, event, at, detail) values ('super.admin', 'LOGIN_FAILED', now() - interval '20 minutes', 'older')");
        }
        assertThat(superAdmins.verify("super.admin", "Test@12345")).isTrue();
        for (int i = 0; i < SuperAdminService.MAX_FAILED_SIGN_INS - 1; i++) {
            superAdmins.verify("super.admin", "wrong-password");
        }
        assertThat(superAdmins.verify("super.admin", "Test@12345")).as("four failures after the success do not lock").isTrue();
    }

    @Test
    void aDisabledAccountCannotLogIn() {
        superAdmins.create("super.admin", "Test@12345", "operator");
        db.jdbc.update("update super_admin set active = false");
        assertThat(superAdmins.verify("super.admin", "Test@12345")).isFalse();
    }

    @Test
    void aShorterNoticeMinimumIsRefusedOutsideDev() {
        properties.setEnvironment("TEST");
        properties.getMaintenance().setNoticeMinMinutes(1);
        assertThatThrownBy(() -> new MaintenanceService(db.jdbc, db.tx, ledger, properties)).isInstanceOf(IllegalStateException.class);
        properties.setEnvironment("DEV");
        assertThat(new MaintenanceService(db.jdbc, db.tx, ledger, properties)).isNotNull();
    }
}

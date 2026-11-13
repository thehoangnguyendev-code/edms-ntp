package com.eqms.backup.agent;

import com.eqms.backup.agent.alert.AlertRuleService;
import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.copy.ManualCopyService;
import com.eqms.backup.agent.drill.DrPlanService;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Alert rules and their delivery, the manual copy, and the declaration of a disaster, with the refusals each one must give. */
class FinishingWorkTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;
    AlertRuleService rules;
    ManualCopyService copies;
    DrPlanService plan;
    BackupRepository repository;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        rules = new AlertRuleService(db.jdbc, ledger);
        copies = new ManualCopyService(db.jdbc, ledger);
        plan = new DrPlanService(db.jdbc, ledger);
        repository = new BackupRepository(db.jdbc);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    // ------------------------------------------------------------------ alert rules

    @Test
    void everyAlertCodeTheAgentRaisesBelongsToARuleOrIsToldInTheApplicationOnly() {
        assertThat(AlertRuleService.ruleOf("BACKUP_DUMP_FAILED")).isEqualTo("BACKUP_FAILED");
        assertThat(AlertRuleService.ruleOf("BACKUP_V2_MISSED")).isEqualTo("BACKUP_V2_OVERDUE");
        assertThat(AlertRuleService.ruleOf("RESTORE_ROLLBACK_FAILED")).isEqualTo("RESTORE_PROBLEM");
        assertThat(AlertRuleService.ruleOf("REHEARSAL_SCRATCH_NOT_DROPPED")).isEqualTo("RESTORE_PROBLEM");
        assertThat(AlertRuleService.ruleOf("BACKUP_REFERENCE_MISSING")).isEqualTo("STORE_SCRUB_MISMATCH");
        assertThat(AlertRuleService.ruleOf("CAPACITY_HIGH")).isEqualTo("CAPACITY_HIGH");
        assertThat(AlertRuleService.ruleOf("SOMETHING_NEW")).isNull();
        List<String> codes = rules.rules().stream().map(r -> (String) r.get("code")).toList();
        for (String code : List.of("BACKUP_FAILED", "BACKUP_MISSED", "CAPACITY_HIGH", "MANUAL_COPY_OVERDUE", "STORE_SCRUB_MISMATCH", "DR_KIT_OVERDUE", "RESTORE_PROBLEM")) {
            assertThat(codes).contains(code);
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void aRuleChangeNeedsAReasonStaysInRangeAndSaysWhatItWasBefore() {
        assertThatThrownBy(() -> rules.update("CAPACITY_HIGH", true, true, 90, "admin", " "))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RULE_REASON_REQUIRED"));
        assertThatThrownBy(() -> rules.update("CAPACITY_HIGH", true, true, 100, "admin", "too high"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RULE_THRESHOLD_RANGE"));
        assertThatThrownBy(() -> rules.update("CAPACITY_HIGH", true, true, null, "admin", "no limit"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RULE_THRESHOLD_REQUIRED"));
        assertThatThrownBy(() -> rules.update("BACKUP_FAILED", true, true, 5, "admin", "has no limit"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RULE_NO_THRESHOLD"));
        assertThatThrownBy(() -> rules.update("NOPE", true, true, null, "admin", "x"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RULE_NOT_FOUND"));
        assertThatThrownBy(() -> rules.update("CAPACITY_HIGH", true, true, 80, "admin", "nothing differs"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RULE_UNCHANGED"));

        Map<String, Object> changed = rules.update("CAPACITY_HIGH", true, false, 90, "admin", "the NAS is large");
        assertThat(changed).containsEntry("email", false).containsEntry("thresholdValue", 90);
        assertThat(rules.threshold("CAPACITY_HIGH", 80)).isEqualTo(90);
        assertThat((Map<String, Object>) changed.get("previous")).containsEntry("threshold", 80).containsEntry("inApp", true).containsEntry("email", true);
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("ALERT_RULE_CHANGED");
    }

    @Test
    void anAlertIsToldOnlyThroughTheChannelsItsRuleAllowsAndOnlyOnce() {
        db.jdbc.update("insert into backup_alert_recipient(username, added_by) values ('qa.one', 'admin')");
        repository.insertAlert("HIGH", "BACKUP_DUMP_FAILED", "failed", "BK-1");
        repository.insertAlert("INFO", "AGENT_RESTARTED", "restarted", "BK-2");
        rules.update("AGENT_RESTARTED", false, false, null, "admin", "not needed");
        Map<String, Object> pending = rules.pendingDelivery(50);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> alerts = (List<Map<String, Object>>) pending.get("alerts");
        assertThat(alerts).extracting(a -> a.get("code")).containsExactly("BACKUP_DUMP_FAILED");
        assertThat(alerts.get(0)).containsEntry("inApp", true).containsEntry("email", true);
        assertThat(pending.get("recipients")).isEqualTo(List.of("qa.one"));
        // the alert with no channel is recorded and shown, and counted as done
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'AGENT_RESTARTED' and delivered_at is not null", Integer.class)).isEqualTo(1);

        UUID id = UUID.fromString((String) alerts.get(0).get("id"));
        assertThat(rules.markDelivered(List.of(id))).isEqualTo(1);
        assertThat(rules.markDelivered(List.of(id))).isZero();
        assertThat((List<?>) rules.pendingDelivery(50).get("alerts")).isEmpty();
    }

    @Test
    void withNobodyToTellAnAlertIsStillListedAndNothingPilesUp() {
        repository.insertAlert("HIGH", "BACKUP_DUMP_FAILED", "failed", "BK-1");
        assertThat((List<?>) rules.pendingDelivery(50).get("alerts")).isEmpty();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where delivered_at is not null", Integer.class)).isEqualTo(1);
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert", Integer.class)).isEqualTo(1);
    }

    @Test
    void aLastingConditionIsRaisedOnceWhileItsAlertIsOpen() {
        assertThat(repository.insertAlertOnce("HIGH", "CAPACITY_HIGH", "T1 is 91% full", "T1")).isTrue();
        assertThat(repository.insertAlertOnce("HIGH", "CAPACITY_HIGH", "T1 is 92% full", "T1")).isFalse();
        assertThat(repository.insertAlertOnce("HIGH", "CAPACITY_HIGH", "T2 is 91% full", "T2")).isTrue();
        db.jdbc.update("update backup_alert set acknowledged_at = now(), acknowledged_by = 'admin' where ref = 'T1'");
        assertThat(repository.insertAlertOnce("HIGH", "CAPACITY_HIGH", "T1 is 93% full", "T1")).isTrue();
    }

    @Test
    void aFileOnTheApplicationDiskIsToldOnceBecauseNothingBacksItUp(@TempDir Path folder) throws Exception {
        AgentProperties props = new AgentProperties();
        var watch = new com.eqms.backup.agent.watch.HealthWatch(db.jdbc, repository, null, rules, null, null, props, null, null);
        watch.localStorageNotBackedUp();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'LOCAL_STORAGE_NOT_BACKED_UP'", Integer.class)).as("no folder configured").isZero();
        props.setLocalStoragePath(folder);
        Files.createDirectories(folder.resolve("revisions"));
        watch.localStorageNotBackedUp();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'LOCAL_STORAGE_NOT_BACKED_UP'", Integer.class)).as("an empty folder is fine").isZero();
        Files.writeString(folder.resolve("revisions").resolve("a.docx"), "content");
        watch.localStorageNotBackedUp();
        watch.localStorageNotBackedUp();
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert where code = 'LOCAL_STORAGE_NOT_BACKED_UP' and severity = 'HIGH'", Integer.class)).isEqualTo(1);
        assertThat(db.jdbc.queryForObject("select detail from backup_alert where code = 'LOCAL_STORAGE_NOT_BACKED_UP'", String.class)).contains("1 file(s)").contains("a.docx");
        assertThat(AlertRuleService.ruleOf("LOCAL_STORAGE_NOT_BACKED_UP")).isEqualTo("LOCAL_STORAGE_NOT_BACKED_UP");
        assertThat(rules.rules().stream().map(r -> r.get("code"))).contains("LOCAL_STORAGE_NOT_BACKED_UP");
    }

    // ------------------------------------------------------------------ manual copy

    private void declareManualCopy(int everyDays) {
        db.jdbc.update("update backup_policy set targets_json = ?::jsonb where status = 'ACTIVE'",
                "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"}],\"manualCopy\":{\"declared\":true,\"description\":\"Safe, by the owner\",\"everyDays\":" + everyDays + "}}");
    }

    @Test
    void theManualCopyIsRecordedByAPersonAndTheNextOneIsDueFromIt() {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        declareManualCopy(7);
        LocalDate today = LocalDate.of(2026, 11, 11);
        assertThat(copies.status(today)).containsEntry("state", "NEVER_RECORDED");
        copies.record(LocalDate.of(2026, 11, 1), null, "Safe, head office", "Nguyen Van A", "first copy", "admin", zone);
        var status = copies.status(today);
        assertThat(status).containsEntry("lastCopiedOn", "2026-11-01").containsEntry("nextDueOn", "2026-11-08").containsEntry("state", "OVERDUE");
        copies.record(LocalDate.of(2026, 11, 10), null, "Safe, head office", "Nguyen Van A", null, "admin", zone);
        assertThat(copies.status(today)).containsEntry("state", "ON_TIME").containsEntry("nextDueOn", "2026-11-17");
        assertThat(copies.page(1, 10).get("data")).asList().hasSize(2);
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("MANUAL_COPY_RECORDED");
    }

    @Test
    void aManualCopyNeedsADayInThePastAPlaceAPersonAndARealBackup() {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        assertThatThrownBy(() -> copies.record(null, null, "Safe", "A", null, "admin", zone))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("MANUAL_COPY_DATE_REQUIRED"));
        assertThatThrownBy(() -> copies.record(LocalDate.now(zone).plusDays(2), null, "Safe", "A", null, "admin", zone))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("MANUAL_COPY_DATE_FUTURE"));
        assertThatThrownBy(() -> copies.record(LocalDate.now(zone), null, " ", "A", null, "admin", zone))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("MANUAL_COPY_PLACE_REQUIRED"));
        assertThatThrownBy(() -> copies.record(LocalDate.now(zone), null, "Safe", "", null, "admin", zone))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("MANUAL_COPY_PERSON_REQUIRED"));
        assertThatThrownBy(() -> copies.record(LocalDate.now(zone), "BK-NOPE", "Safe", "A", null, "admin", zone))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("BACKUP_NOT_FOUND"));
        assertThatThrownBy(() -> copies.record(LocalDate.now(zone), null, "Safe", "A", null, " ", zone))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("PERSON_REQUIRED"));
        assertThat(db.jdbc.queryForObject("select count(*) from manual_copy_record", Integer.class)).isZero();
        db.jdbc.update("insert into manual_copy_record(copied_on, place, made_by, recorded_by) values (current_date, 'Safe', 'A', 'admin')");
        assertThatThrownBy(() -> db.jdbc.update("delete from manual_copy_record")).isInstanceOf(Exception.class);
        assertThatThrownBy(() -> db.jdbc.update("update manual_copy_record set place = 'elsewhere'")).isInstanceOf(Exception.class);
    }

    // ------------------------------------------------------------------ declaring a disaster

    @Test
    void aDisasterIsDeclaredAndClosedWithSignaturesAndOnlyOneCanBeOpen() {
        assertThatThrownBy(() -> plan.declare("SITE_LOSS", "fire", "admin", " "))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SIGNATURE_REQUIRED"));
        assertThatThrownBy(() -> plan.declare("SITE_LOSS", " ", "admin", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_REASON_REQUIRED"));
        assertThatThrownBy(() -> plan.declare("NOPE", "fire", "admin", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_SCENARIO_NOT_FOUND"));

        Map<String, Object> declared = plan.declare("SITE_LOSS", "The building burned", "admin", "ESIG-2");
        String code = (String) declared.get("code");
        assertThat(code).startsWith("DR-");
        assertThatThrownBy(() -> plan.declare("SERVER_LOSS", "again", "admin", "ESIG-3"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_DECLARATION_OPEN"));
        assertThatThrownBy(() -> plan.closeDeclaration(code, " ", "admin", "ESIG-4"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_SUMMARY_REQUIRED"));
        assertThatThrownBy(() -> plan.closeDeclaration(code, "restored", "admin", ""))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SIGNATURE_REQUIRED"));
        assertThatThrownBy(() -> plan.closeDeclaration("DR-9999-0001", "restored", "admin", "ESIG-4"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_DECLARATION_NOT_FOUND"));

        plan.closeDeclaration(code, "Rebuilt on the spare server from T2", "admin", "ESIG-5");
        assertThatThrownBy(() -> plan.closeDeclaration(code, "again", "admin", "ESIG-6"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_DECLARATION_CLOSED"));
        // a closed record cannot be reopened, edited or removed, not even straight in the database
        assertThatThrownBy(() -> db.jdbc.update("update dr_declaration set status = 'OPEN', closed_by = null, closed_at = null, closed_summary = null, close_signature_ref = null")).isInstanceOf(Exception.class);
        assertThatThrownBy(() -> db.jdbc.update("update dr_declaration set declared_reason = 'something else'")).isInstanceOf(Exception.class);
        assertThatThrownBy(() -> db.jdbc.update("delete from dr_declaration")).isInstanceOf(Exception.class);
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("DR_DECLARED", "DR_DECLARATION_CLOSED");
        assertThat(plan.declarations(1, 10).get("data")).asList().hasSize(1);
        // a new one may be declared once the first is closed
        assertThat(plan.declare("SERVER_LOSS", "Disk failure", "admin", "ESIG-7")).containsEntry("status", "OPEN");
    }

    @Test
    void theDeclarationsSearchFilterAndSortInTheDatabase() {
        String first = (String) plan.declare("SITE_LOSS", "The building burned", "admin", "ESIG-1").get("code");
        plan.closeDeclaration(first, "Rebuilt on the spare server", "admin", "ESIG-2");
        plan.declare("SERVER_LOSS", "Disk failure in the rack", "admin", "ESIG-3");
        @SuppressWarnings("unchecked")
        var open = (List<Map<String, Object>>) plan.declarations(null, "open", null, null, null, "declaredAt", false, 1, 10).get("data");
        assertThat(open).extracting(r -> r.get("scenario")).containsExactly("SERVER_LOSS");
        @SuppressWarnings("unchecked")
        var closed = (List<Map<String, Object>>) plan.declarations(null, "CLOSED", null, null, null, null, false, 1, 10).get("data");
        assertThat(closed).extracting(r -> r.get("code")).containsExactly(first);
        @SuppressWarnings("unchecked")
        var searched = (List<Map<String, Object>>) plan.declarations("rack", null, null, null, null, "code", true, 1, 10).get("data");
        assertThat(searched).extracting(r -> r.get("scenario")).containsExactly("SERVER_LOSS");
        @SuppressWarnings("unchecked")
        var byScenario = (List<Map<String, Object>>) plan.declarations(null, null, "SITE_LOSS", null, null, "timeTaken", true, 1, 10).get("data");
        assertThat(byScenario).hasSize(1);
        @SuppressWarnings("unchecked")
        var both = (List<Map<String, Object>>) plan.declarations(null, null, null, null, null, "scenario", true, 1, 10).get("data");
        assertThat(both).extracting(r -> r.get("scenario")).containsExactly("SERVER_LOSS", "SITE_LOSS");
        assertThatThrownBy(() -> plan.declarations(null, "x'; drop", null, null, null, null, false, 1, 10))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_DECLARATION_STATUS"));
        assertThat(((Map<?, ?>) plan.declarations("burned", null, null, null, null, null, false, 1, 1).get("pagination")).get("total")).isEqualTo(1L);
    }

    @Test
    void readinessComparesEachTargetWithWhatTheRecordsShowAndSaysSoWhenThereIsNothing() {
        var none = plan.readiness();
        assertThat(none).extracting(r -> r.get("rpoState")).containsOnly("NO_DATA");
        assertThat(none).extracting(r -> r.get("rtoState")).containsOnly("NOT_TESTED");
        UUID run = UUID.randomUUID();
        db.jdbc.update("insert into backup_run(id, backup_number, environment, type, trigger_kind, status, started_at, requested_by) values (?, 'BK-R1', 'DEV', 'FULL', 'MANUAL', 'COMPLETED', now() - interval '3 hours', 'admin')", run);
        db.jdbc.update("insert into backup_verification(run_id, tier, result, detail_json, verified_at, verified_by) values (?, 'V1', 'VERIFIED', '{}'::jsonb, now(), 'agent')", run);
        var verified = plan.readiness();
        var server = verified.stream().filter(r -> "SERVER_LOSS".equals(r.get("scenario"))).findFirst().orElseThrow();
        var site = verified.stream().filter(r -> "SITE_LOSS".equals(r.get("scenario"))).findFirst().orElseThrow();
        assertThat(server).containsEntry("rpoState", "WITHIN");
        assertThat(((Number) server.get("dataAgeHours")).doubleValue()).isBetween(2.9, 3.2);
        // off-site scenarios count only what reached T2: nothing has
        assertThat(site).containsEntry("rpoState", "NO_DATA");
    }
}

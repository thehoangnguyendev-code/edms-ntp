package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.drill.DrDrillService;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Disaster recovery drills (SDS 15.2): the scenarios, the targets copied at recording, and the rules for the result. */
class DrDrillServiceTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;
    DrDrillService drills;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        drills = new DrDrillService(db.jdbc, ledger);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private static final Instant WHEN = Instant.parse("2026-10-12T02:00:00Z");

    @Test
    void theFourScenariosAreListedAsProposedWithTheirTargets() {
        List<Map<String, Object>> list = drills.scenarios();
        assertThat(list).hasSize(4);
        assertThat(list).allSatisfy(s -> assertThat(s.get("status")).isEqualTo("PROPOSED"));
        assertThat(list.stream().filter(s -> s.get("code").equals("SITE_LOSS")).findFirst().orElseThrow().get("rtoHours")).isEqualTo(new java.math.BigDecimal("72.0"));
    }

    @Test
    void aPassedDrillIsRecordedWithTheTargetsOfTheScenario() {
        Map<String, Object> d = drills.record("server_loss", WHEN, "Pham Quoc Dung", 19.5, "PASSED", null, "dr.lead");
        assertThat(d).containsEntry("scenario", "SERVER_LOSS").containsEntry("lead", "Pham Quoc Dung").containsEntry("result", "PASSED");
        // the code carries the day it was recorded, not the day of the drill
        assertThat(d.get("drillCode").toString()).matches("DR-\\d{8}-\\d{3}");
        assertThat(d.get("rtoTargetHours")).isEqualTo(new java.math.BigDecimal("24.0"));
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("DR_DRILL_RECORDED");
    }

    @Test
    void aDrillOverItsTargetCannotBePassed() {
        assertThatThrownBy(() -> drills.record("DATA_CORRUPTION", WHEN, "Pham Quoc Dung", 9, "PASSED", null, "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_OVER_TARGET"));
        // the same time, recorded honestly as passed with findings, is accepted
        assertThat(drills.record("DATA_CORRUPTION", WHEN, "Pham Quoc Dung", 9, "PASSED_WITH_FINDINGS", "Rebuild took one step longer than planned", "dr.lead"))
                .containsEntry("result", "PASSED_WITH_FINDINGS");
    }

    @Test
    void findingsAreRequiredWhenTheDrillDidNotPassCleanly() {
        assertThatThrownBy(() -> drills.record("SERVER_LOSS", WHEN, "Pham Quoc Dung", 10, "FAILED", "  ", "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_FINDINGS_REQUIRED"));
    }

    @Test
    void theInputsAreChecked() {
        assertThatThrownBy(() -> drills.record("NO_SUCH", WHEN, "x", 1, "PASSED", null, "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_SCENARIO_UNKNOWN"));
        assertThatThrownBy(() -> drills.record("SERVER_LOSS", WHEN, "x", -1, "PASSED", null, "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_TIME_INVALID"));
        assertThatThrownBy(() -> drills.record("SERVER_LOSS", WHEN, "x", 1, "MAYBE", null, "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_RESULT_UNKNOWN"));
        assertThatThrownBy(() -> drills.record("SERVER_LOSS", Instant.parse("2030-01-01T00:00:00Z"), "x", 1, "PASSED", null, "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_IN_FUTURE"));
        assertThatThrownBy(() -> drills.record("SERVER_LOSS", WHEN, " ", 1, "PASSED", null, "dr.lead"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DRILL_LEAD_REQUIRED"));
        assertThat(db.jdbc.queryForObject("select count(*) from dr_drill", Integer.class)).isZero();
    }

    @Test
    void theListIsPagedAndNewestFirst() {
        drills.record("SERVER_LOSS", WHEN.minusSeconds(86400 * 30L), "A", 5, "PASSED", null, "dr.lead");
        drills.record("SERVER_LOSS", WHEN, "B", 5, "PASSED", null, "dr.lead");
        Map<?, ?> page = drills.page(null, null, null, "performedAt", false, 1, 1);
        assertThat((List<?>) page.get("data")).hasSize(1);
        assertThat(((Map<?, ?>) page.get("pagination")).get("total")).isEqualTo(2L);
        assertThat(((Map<?, ?>) ((List<?>) page.get("data")).get(0)).get("lead")).isEqualTo("B");
    }

    @Test
    void theListIsSearchedFilteredAndSortedOnTheServer() {
        drills.record("SERVER_LOSS", WHEN.minusSeconds(86400 * 30L), "Alice", 5, "PASSED", null, "dr.lead");
        drills.record("SERVER_LOSS", WHEN, "Bob", 9, "FAILED", "too slow", "dr.lead");
        drills.record("SITE_LOSS", WHEN.minusSeconds(86400L), "Carol", 3, "PASSED", null, "dr.lead");

        Map<?, ?> failed = drills.page(null, null, "FAILED", "performedAt", false, 1, 10);
        assertThat((List<?>) failed.get("data")).hasSize(1);
        assertThat(((Map<?, ?>) ((List<?>) failed.get("data")).get(0)).get("lead")).isEqualTo("Bob");

        Map<?, ?> site = drills.page(null, "SITE_LOSS", null, "performedAt", false, 1, 10);
        assertThat((List<?>) site.get("data")).hasSize(1);

        Map<?, ?> searched = drills.page("carol", null, null, "performedAt", false, 1, 10);
        assertThat((List<?>) searched.get("data")).hasSize(1);

        Map<?, ?> byRto = drills.page(null, null, null, "achievedRtoHours", true, 1, 10);
        assertThat(((Map<?, ?>) ((List<?>) byRto.get("data")).get(0)).get("lead")).isEqualTo("Carol");
    }
}

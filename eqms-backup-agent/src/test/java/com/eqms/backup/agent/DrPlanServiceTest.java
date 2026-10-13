package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.drill.DrPlanService;
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

/** The Disaster Recovery Plan (SDS 15.2): signed target changes with history, the rebuild kit, and the declaration authority. */
class DrPlanServiceTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;
    DrPlanService plan;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        plan = new DrPlanService(db.jdbc, ledger);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    @Test
    void aTargetChangeNeedsASignatureAndIsKeptWithItsHistory() {
        assertThatThrownBy(() -> plan.changeTargets("SERVER_LOSS", 12, 12, "qa.lead", "tighter target", " "))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SIGNATURE_REQUIRED"));

        Map<String, Object> out = plan.changeTargets("SERVER_LOSS", 12, 12, "qa.lead", "tighter target", "ESIG-21");
        assertThat(out).containsEntry("status", "APPROVED");
        assertThat(db.jdbc.queryForObject("select status from dr_scenario where code = 'SERVER_LOSS'", String.class)).isEqualTo("APPROVED");
        assertThat(db.jdbc.queryForObject("select count(*) from dr_target_history where scenario_code = 'SERVER_LOSS' and old_rto_hours = 24 and new_rto_hours = 12 and signature_ref = 'ESIG-21'",
                Integer.class)).isEqualTo(1);
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("DR_TARGET_CHANGED");
    }

    @Test
    void invalidAndUnchangedTargetsAreRefused() {
        assertThatThrownBy(() -> plan.changeTargets("SERVER_LOSS", 0, 12, "qa.lead", "x", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_TARGET_INVALID"));
        assertThatThrownBy(() -> plan.changeTargets("SERVER_LOSS", 24, 24, "qa.lead", "x", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_TARGET_UNCHANGED"));
        assertThatThrownBy(() -> plan.changeTargets("NOPE", 1, 1, "qa.lead", "x", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("DR_SCENARIO_NOT_FOUND"));
    }

    @Test
    void theRebuildKitStartsNotVerifiedAndOnlyAPersonCanVerifyAnItem() {
        List<Map<String, Object>> kit = plan.kit();
        assertThat(kit).hasSize(4);
        assertThat(kit).allSatisfy(item -> {
            assertThat(item.get("state")).isEqualTo("NOT_VERIFIED");
            assertThat(item.get("lastVerifiedAt")).isNull();
        });

        plan.verifyKitItem("BACKUP_KEY", Instant.parse("2026-10-10T08:00:00Z"), "admin", "Checked the key in the safe with two people present");
        Map<String, Object> after = plan.kit().stream().filter(i -> i.get("code").equals("BACKUP_KEY")).findFirst().orElseThrow();
        assertThat(after).containsEntry("state", "VERIFIED").containsEntry("lastVerifiedBy", "admin");
        assertThat(plan.kit().stream().filter(i -> i.get("code").equals("RUNBOOK")).findFirst().orElseThrow()).containsEntry("state", "NOT_VERIFIED");
    }

    @Test
    void aVerificationCannotBeDatedInTheFutureOrForAnUnknownItem() {
        assertThatThrownBy(() -> plan.verifyKitItem("RUNBOOK", Instant.parse("2030-01-01T00:00:00Z"), "admin", null))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("VERIFIED_AT_FUTURE"));
        assertThatThrownBy(() -> plan.verifyKitItem("NOPE", Instant.parse("2026-10-10T00:00:00Z"), "admin", null))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("KIT_ITEM_NOT_FOUND"));
    }

    @Test
    void theDeclarationAuthorityIsAdminAndChangesWithASignature() {
        assertThat(plan.declarationAuthority()).isEqualTo("admin");
        assertThatThrownBy(() -> plan.changeDeclarationAuthority("qa.lead", "admin", "delegate", null))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("SIGNATURE_REQUIRED"));
        plan.changeDeclarationAuthority("qa.lead", "admin", "delegate to QA", "ESIG-30");
        assertThat(plan.declarationAuthority()).isEqualTo("qa.lead");
        assertThat(db.jdbc.queryForObject("select count(*) from dr_plan_setting_history where old_value = 'admin' and new_value = 'qa.lead'", Integer.class)).isEqualTo(1);
    }
}

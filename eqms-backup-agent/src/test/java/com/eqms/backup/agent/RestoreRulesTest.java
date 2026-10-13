package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.restore.RestoreRules;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The owner-changeable restore rules (V15): defaults, range, history and the ledger. */
class RestoreRulesTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;
    RestoreRules rules;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        rules = new RestoreRules(db.jdbc, ledger);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    @Test
    void theDefaultIsTheValueTheCodeUsedBefore() {
        assertThat(rules.value(RestoreRules.REHEARSAL_MAX_AGE_DAYS)).isEqualTo(30);
    }

    @Test
    void aChangeIsKeptWithWhoWhyAndTheSignatureAndIsWrittenToTheLedger() {
        assertThat(rules.change(RestoreRules.REHEARSAL_MAX_AGE_DAYS, 45, "qa.lead", "Annual restore plan", "ESIG-7")).containsEntry("previous", 30);
        assertThat(rules.value(RestoreRules.REHEARSAL_MAX_AGE_DAYS)).isEqualTo(45);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_rule_history where code = ? and old_value = 30 and new_value = 45 and signature_ref = 'ESIG-7'",
                Integer.class, RestoreRules.REHEARSAL_MAX_AGE_DAYS)).isEqualTo(1);
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("RESTORE_RULE_CHANGED");
    }

    @Test
    void aValueOutsideItsRangeIsRefusedAndNothingChanges() {
        assertThatThrownBy(() -> rules.change(RestoreRules.REHEARSAL_MAX_AGE_DAYS, 0, "qa.lead", "x", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RULE_OUT_OF_RANGE"));
        assertThatThrownBy(() -> rules.change(RestoreRules.REHEARSAL_MAX_AGE_DAYS, 91, "qa.lead", "x", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RULE_OUT_OF_RANGE"));
        assertThat(rules.value(RestoreRules.REHEARSAL_MAX_AGE_DAYS)).isEqualTo(30);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_rule_history", Integer.class)).isZero();
    }

    @Test
    void aChangeNeedsAReasonAPersonAndANewValue() {
        assertThatThrownBy(() -> rules.change(RestoreRules.REHEARSAL_MAX_AGE_DAYS, 45, "qa.lead", " ", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RULE_REASON_REQUIRED"));
        assertThatThrownBy(() -> rules.change(RestoreRules.REHEARSAL_MAX_AGE_DAYS, 45, " ", "why", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("PERSON_REQUIRED"));
        assertThatThrownBy(() -> rules.change(RestoreRules.REHEARSAL_MAX_AGE_DAYS, 30, "qa.lead", "why", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RULE_UNCHANGED"));
        assertThatThrownBy(() -> rules.change("NO_SUCH_RULE", 1, "qa.lead", "why", "ESIG-1"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("RULE_NOT_FOUND"));
    }

    @Test
    void theListShowsEveryRuleWithItsRange() {
        assertThat(rules.all()).hasSize(2);
        assertThat(rules.all()).anySatisfy(r -> {
            assertThat(r.get("code")).isEqualTo(RestoreRules.REHEARSAL_MAX_AGE_DAYS);
            assertThat(r.get("min")).isEqualTo(1);
            assertThat(r.get("max")).isEqualTo(90);
        });
        assertThat(rules.value(RestoreRules.RESTORE_DRILL_INTERVAL_DAYS)).isEqualTo(365);
    }
}

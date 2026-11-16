package com.eqms.backup.agent;

import com.eqms.backup.agent.alert.AlertRuleService;
import com.eqms.backup.agent.alert.AlertService;
import com.eqms.backup.agent.api.InternalAlertController;
import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** REPORT-BACKUP-RUNS-2026-11-15: the application may raise one alert code (the report copy is out of date); it is kept once until acknowledged, and any other code is refused. */
class ExternalAlertTest {
    @TempDir
    Path tmp;
    ControlDbTestSupport db;
    InternalAlertController controller;
    AlertService alerts;
    AlertRuleService rules;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        LedgerService ledger = new LedgerService(db.jdbc, db.tx, properties);
        alerts = new AlertService(db.jdbc, ledger);
        rules = new AlertRuleService(db.jdbc, ledger);
        controller = new InternalAlertController(alerts, rules, new BackupRepository(db.jdbc));
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    @Test
    void theStaleCopyAlertIsRaisedOnceAndAnUnknownSeverityBecomesAWarning() {
        assertThat(controller.external(new InternalAlertController.ExternalAlertRequest("REPORT_COPY_STALE", "MEDIUM", "last refreshed never"))).containsEntry("raised", true);
        assertThat(controller.external(new InternalAlertController.ExternalAlertRequest("REPORT_COPY_STALE", "WARNING", "again"))).containsEntry("raised", false);
        assertThat(db.jdbc.queryForObject("select severity from backup_alert where code='REPORT_COPY_STALE'", String.class)).isEqualTo("WARNING");
    }

    @Test
    void anyOtherCodeIsRefused() {
        assertThatThrownBy(() -> controller.external(new InternalAlertController.ExternalAlertRequest("LEDGER_CHAIN_BROKEN", "HIGH", "x"))).isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> controller.external(null)).isInstanceOf(ExportException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void theStaleCopyAlertIsToldToTheRecipientsInTheApplicationOnlyByDefault() {
        alerts.addRecipient("alice", "admin");
        controller.external(new InternalAlertController.ExternalAlertRequest("REPORT_COPY_STALE", "WARNING", "last refreshed never"));
        var pending = rules.pendingDelivery(10);
        assertThat((java.util.List<String>) pending.get("recipients")).contains("alice");
        var alert = ((java.util.List<java.util.Map<String, Object>>) pending.get("alerts")).stream().filter(a -> "REPORT_COPY_STALE".equals(a.get("code"))).findFirst().orElseThrow();
        assertThat(alert).containsEntry("inApp", true).containsEntry("email", false);
    }
}

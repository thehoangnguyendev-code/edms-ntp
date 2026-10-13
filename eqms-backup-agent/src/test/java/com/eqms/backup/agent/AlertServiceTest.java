package com.eqms.backup.agent;

import com.eqms.backup.agent.alert.AlertService;
import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.ledger.LedgerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Backup alerts and their recipients (SDS 15.1): listing, acknowledging once, and who receives them. */
class AlertServiceTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;
    BackupRepository repository;
    AlertService alerts;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        repository = new BackupRepository(db.jdbc);
        alerts = new AlertService(db.jdbc, ledger);
        repository.insertAlert("HIGH", "BACKUP_V2_MISSED", "The weekly V2 verification did not run on schedule", null);
        repository.insertAlert("WARNING", "LOW_SPACE", "drive D has 4 GB free", "/offsite");
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private String firstOpenId() {
        return (String) rows(alerts.page("OPEN", null, null, 1, 10)).get(0).get("id");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(Map<String, Object> page) {
        return (List<Map<String, Object>>) page.get("data");
    }

    @Test
    void theOpenListShowsAlertsNotYetAcknowledged() {
        assertThat(alerts.page("OPEN", null, null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 2L);
        assertThat(alerts.page("OPEN", "HIGH", null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 1L);
        assertThat(alerts.page(null, null, "space", 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 1L);
    }

    @Test
    void acknowledgingRecordsWhoAndWhenAndTakesTheAlertOffTheOpenList() {
        String id = firstOpenId();
        assertThat(alerts.acknowledge(id, "admin", "seen")).containsEntry("acknowledgedBy", "admin");
        assertThat(alerts.page("OPEN", null, null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 1L);
        assertThat(db.jdbc.queryForObject("select acknowledged_by from backup_alert where id::text = ?", String.class, id)).isEqualTo("admin");
        assertThat(ledger.all().stream().map(LedgerService.Event::event)).contains("ALERT_ACKNOWLEDGED");
    }

    @Test
    void anAlertIsAcknowledgedOnceAndNeverDeleted() {
        String id = firstOpenId();
        alerts.acknowledge(id, "admin", null);
        assertThatThrownBy(() -> alerts.acknowledge(id, "other.person", null))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_ALREADY_ACKNOWLEDGED"));
        assertThat(alerts.page("ALL", null, null, 1, 10)).extractingByKey("pagination").asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("total", 2L);
        assertThatThrownBy(() -> alerts.acknowledge("00000000-0000-0000-0000-000000000000", "admin", null))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_NOT_FOUND"));
    }

    @Test
    void unknownStatesAndSeveritiesAreRefused() {
        assertThatThrownBy(() -> alerts.page("MAYBE", null, null, 1, 10)).isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> alerts.page("OPEN", "URGENT", null, 1, 10)).isInstanceOf(ExportException.class);
    }

    @Test
    void recipientsCanBeAddedRemovedAndAddedAgain() {
        alerts.addRecipient("qa.reviewer", "admin");
        alerts.addRecipient("dco.test1", "admin");
        assertThat(alerts.recipients()).extracting(r -> r.get("username")).containsExactly("dco.test1", "qa.reviewer");

        alerts.removeRecipient("qa.reviewer", "admin");
        assertThat(alerts.recipients()).extracting(r -> r.get("username")).containsExactly("dco.test1");
        assertThatThrownBy(() -> alerts.removeRecipient("qa.reviewer", "admin"))
                .isInstanceOfSatisfying(ExportException.class, e -> assertThat(e.code).isEqualTo("ALERT_RECIPIENT_NOT_FOUND"));

        alerts.addRecipient("qa.reviewer", "admin");
        assertThat(alerts.recipients()).hasSize(2);
        assertThat(db.jdbc.queryForObject("select count(*) from backup_alert_recipient", Integer.class)).as("one row per person, never duplicated").isEqualTo(2);
    }
}

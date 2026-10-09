package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.dao.DataAccessException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LedgerServiceTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    LedgerService ledger;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        AgentProperties properties = new AgentProperties();
        properties.setLedgerDir(tmp.resolve("ledger"));
        ledger = new LedgerService(db.jdbc, db.tx, properties);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private void three() {
        ledger.append("agent", "BACKUP_STARTED", "BK-1", Map.of("type", "FULL"));
        ledger.append("agent", "BACKUP_COMPLETED", "BK-1", Map.of("size", 10, "sha256", "ab"));
        ledger.append("qa.user", "POLICY_APPROVED", "P-2", Map.of());
    }

    @Test
    void eachEventCarriesTheHashOfThePreviousOne() {
        three();
        List<LedgerService.Event> events = ledger.all();
        assertThat(events).hasSize(3);
        assertThat(events.get(0).prevHash()).isEqualTo(LedgerService.GENESIS_HASH);
        assertThat(events.get(1).prevHash()).isEqualTo(events.get(0).hash());
        assertThat(events.get(2).prevHash()).isEqualTo(events.get(1).hash());
        assertThat(ledger.verify().ok()).isTrue();
        assertThat(ledger.verify().checked()).isEqualTo(3);
    }

    @Test
    void anEmptyLedgerVerifies() {
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void theDatabaseRefusesToUpdateDeleteOrTruncateAnEvent() {
        three();
        assertThatThrownBy(() -> db.jdbc.update("update ledger_event set actor='someone else' where seq=2")).isInstanceOf(DataAccessException.class).hasMessageContaining("append-only");
        assertThatThrownBy(() -> db.jdbc.update("delete from ledger_event where seq=2")).isInstanceOf(DataAccessException.class).hasMessageContaining("append-only");
        assertThatThrownBy(() -> db.jdbc.execute("truncate ledger_event")).isInstanceOf(DataAccessException.class);
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void changingAnEventAfterSwitchingTheProtectionOffIsDetected() {
        three();
        db.jdbc.execute("alter table ledger_event disable trigger user");
        db.jdbc.update("update ledger_event set data_json='{\"size\":9999,\"sha256\":\"ab\"}' where seq=2");
        db.jdbc.execute("alter table ledger_event enable trigger user");
        LedgerService.Verification result = ledger.verify();
        assertThat(result.ok()).isFalse();
        assertThat(result.firstBrokenSeq()).isEqualTo(2L);
        assertThat(result.reason()).contains("changed");
    }

    @Test
    void removingAnEventFromTheMiddleIsDetected() {
        three();
        db.jdbc.execute("alter table ledger_event disable trigger user");
        db.jdbc.update("delete from ledger_event where seq=2");
        db.jdbc.execute("alter table ledger_event enable trigger user");
        LedgerService.Verification result = ledger.verify();
        assertThat(result.ok()).isFalse();
        assertThat(result.firstBrokenSeq()).isEqualTo(2L);
    }

    @Test
    void aWrongHashOnTheLastEventIsDetected() throws Exception {
        three();
        // A hash that no longer matches its event is found by recomputing it.
        List<LedgerService.Event> events = ledger.all();
        db.jdbc.execute("alter table ledger_event disable trigger user");
        db.jdbc.update("update ledger_event set hash=repeat('a',64) where seq=3");
        db.jdbc.execute("alter table ledger_event enable trigger user");
        LedgerService.Verification result = ledger.verify();
        assertThat(result.ok()).isFalse();
        assertThat(events).hasSize(3);
    }

    @Test
    void aMissingOrChangedFileCopyIsReported() throws Exception {
        three();
        Path file = tmp.resolve("ledger").resolve("ledger.jsonl");
        List<String> lines = new ArrayList<>(Files.readAllLines(file));
        lines.set(1, "2 " + "f".repeat(64) + "|x");
        Files.write(file, lines);
        LedgerService.Verification result = ledger.verify();
        assertThat(result.ok()).isFalse();
        assertThat(result.fileCompared()).isTrue();
        assertThat(result.reason()).contains("differ");
    }

    @Test
    void concurrentWritersNeverForkTheChain() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(6);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            int n = i;
            futures.add(pool.submit(() -> ledger.append("agent-" + (n % 3), "TICK", "R-" + n, Map.of("n", n))));
        }
        for (Future<?> f : futures) f.get();
        pool.shutdown();
        assertThat(ledger.all()).hasSize(30);
        assertThat(ledger.verify().ok()).isTrue();
        assertThat(ledger.all().stream().map(LedgerService.Event::seq).distinct().count()).isEqualTo(30);
    }

    @Test
    void canonicalJsonIsIndependentOfKeyOrderAndWhitespace() {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("b", 1);
        a.put("a", Map.of("y", 2, "x", List.of(1, 2)));
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("a", Map.of("x", List.of(1, 2), "y", 2));
        b.put("b", 1);
        assertThat(CanonicalJson.of(a)).isEqualTo(CanonicalJson.of(b)).isEqualTo("{\"a\":{\"x\":[1,2],\"y\":2},\"b\":1}");
        assertThat(CanonicalJson.ofText("{ \"b\" : 1,\n \"a\" : {\"y\":2, \"x\":[1, 2]} }")).isEqualTo(CanonicalJson.of(a));
    }

    @Test
    void textWithQuotesAndNewlinesRoundTripsThroughTheHash() {
        ledger.append("agent", "NOTE", "x", Map.of("text", "line1\n\"quoted\" \\ backslash é"));
        assertThat(ledger.verify().ok()).isTrue();
    }
}

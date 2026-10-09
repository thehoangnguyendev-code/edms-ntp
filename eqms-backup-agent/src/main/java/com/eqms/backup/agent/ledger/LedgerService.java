package com.eqms.backup.agent.ledger;

import com.eqms.backup.agent.config.AgentProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * The tamper-evident history of everything the backup system does (SDS section 8.3).
 *
 * <p>Each event carries the hash of the one before it, so changing, removing or inserting any event breaks every hash after it.
 * Events are also appended to a plain file outside the database; the two copies are compared when the chain is verified. The
 * database refuses UPDATE, DELETE and TRUNCATE on the table, so tampering needs a deliberate bypass that the verification finds.
 */
@Service
public class LedgerService {

    private static final Logger log = LoggerFactory.getLogger(LedgerService.class);
    public static final String GENESIS_HASH = "0".repeat(64);
    private static final long LOCK_KEY = 7_001L;
    private static final DateTimeFormatter AT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withZone(ZoneOffset.UTC);

    public record Event(long seq, Instant at, String actor, String event, String ref, String dataJson, String prevHash, String hash) {
    }

    public record Verification(boolean ok, long checked, Long firstBrokenSeq, String reason, boolean fileCompared) {
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final Path ledgerFile;

    public LedgerService(JdbcTemplate jdbc, TransactionTemplate tx, AgentProperties properties) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledgerFile = properties.getLedgerDir().resolve("ledger.jsonl");
    }

    /** Appends one event and returns it. Serialised by an advisory lock, so two writers never fork the chain. */
    public Event append(String actor, String event, String ref, Map<String, Object> data) {
        Event written = tx.execute(status -> {
            jdbc.queryForList("select pg_advisory_xact_lock(?)", LOCK_KEY);
            Map<String, Object> last = jdbc.queryForList("select seq, hash from ledger_event order by seq desc limit 1").stream().findFirst().orElse(null);
            long seq = last == null ? 1 : ((Number) last.get("seq")).longValue() + 1;
            String prev = last == null ? GENESIS_HASH : (String) last.get("hash");
            Instant at = Instant.now().truncatedTo(ChronoUnit.MICROS);
            String dataJson = CanonicalJson.of(data == null ? Map.of() : data);
            String hash = hashOf(prev, seq, at, actor, event, ref, dataJson);
            jdbc.update("insert into ledger_event(seq, at, actor, event, ref, data_json, prev_hash, hash) values (?,?,?,?,?,?,?,?)",
                    seq, Timestamp.from(at), actor, event, ref, dataJson, prev, hash);
            return new Event(seq, at, actor, event, ref, dataJson, prev, hash);
        });
        appendToFile(written);
        return written;
    }

    public List<Event> all() {
        return jdbc.query("select seq, at, actor, event, ref, data_json, prev_hash, hash from ledger_event order by seq",
                (rs, i) -> new Event(rs.getLong("seq"), rs.getTimestamp("at").toInstant().truncatedTo(ChronoUnit.MICROS), rs.getString("actor"),
                        rs.getString("event"), rs.getString("ref"), rs.getString("data_json"), rs.getString("prev_hash"), rs.getString("hash")));
    }

    /** Recomputes every hash and compares the chain with the copy outside the database. */
    public Verification verify() {
        List<Event> events = all();
        String prev = GENESIS_HASH;
        long expectedSeq = 1;
        for (Event e : events) {
            if (e.seq() != expectedSeq) {
                return new Verification(false, expectedSeq - 1, expectedSeq, "event " + expectedSeq + " is missing or out of order", false);
            }
            if (!prev.equals(e.prevHash())) {
                return new Verification(false, e.seq() - 1, e.seq(), "event " + e.seq() + " does not follow the previous event", false);
            }
            String recomputed = hashOf(e.prevHash(), e.seq(), e.at(), e.actor(), e.event(), e.ref(), CanonicalJson.ofText(e.dataJson()));
            if (!recomputed.equals(e.hash())) {
                return new Verification(false, e.seq() - 1, e.seq(), "event " + e.seq() + " was changed", false);
            }
            prev = e.hash();
            expectedSeq++;
        }
        if (Files.exists(ledgerFile)) {
            try {
                List<String> lines = Files.readAllLines(ledgerFile, StandardCharsets.UTF_8);
                for (int i = 0; i < events.size(); i++) {
                    String expected = events.get(i).seq() + " " + events.get(i).hash();
                    String actual = i < lines.size() ? lines.get(i).split("\\|", 2)[0] : "";
                    if (!expected.equals(actual)) {
                        return new Verification(false, i, events.get(i).seq(), "the database and the file copy differ at event " + events.get(i).seq(), true);
                    }
                }
                if (lines.size() > events.size()) {
                    return new Verification(false, events.size(), (long) events.size() + 1, "the file copy has events the database no longer has", true);
                }
            } catch (IOException e) {
                return new Verification(false, events.size(), null, "the file copy could not be read", true);
            }
            return new Verification(true, events.size(), null, null, true);
        }
        return new Verification(true, events.size(), null, null, false);
    }

    static String hashOf(String prevHash, long seq, Instant at, String actor, String event, String ref, String dataJson) {
        String body = "{\"actor\":" + CanonicalJson.of(actor) + ",\"at\":" + CanonicalJson.of(AT_FORMAT.format(at))
                + ",\"data\":" + dataJson + ",\"event\":" + CanonicalJson.of(event) + ",\"ref\":" + CanonicalJson.of(ref)
                + ",\"seq\":" + seq + "}";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(prevHash.getBytes(StandardCharsets.UTF_8));
            digest.update(body.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void appendToFile(Event e) {
        try {
            Files.createDirectories(ledgerFile.getParent());
            String line = e.seq() + " " + e.hash() + "|" + AT_FORMAT.format(e.at()) + "|" + e.actor() + "|" + e.event() + "|" + e.ref() + "|" + e.dataJson() + "\n";
            Files.writeString(ledgerFile, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND, StandardOpenOption.SYNC);
        } catch (IOException ex) {
            // The database copy is authoritative; a missing file copy is reported by verify(), never silently ignored.
            log.error("Could not append ledger event {} to the file copy: {}", e.seq(), ex.getMessage());
        }
    }
}

package com.eqms.backup.agent.policy;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.eqms.backup.agent.target.BackupTarget;
import com.eqms.backup.agent.target.TargetCatalog;
import com.eqms.backup.agent.target.TargetTester;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The versioned backup policy (SDS sections 6.1 and 24, BR-6 to BR-10). A version is proposed as a draft by one person and
 * activated by a different one; activation is refused unless the 3-2-1-1 rule holds and every target in the policy passes its test.
 * Versions are never edited: a change is a new version, and the previous one is kept as superseded.
 */
@Service
public class PolicyService implements ActivePolicyProvider {

    public enum Kind { INVALID, CONFLICT, NOT_FOUND, SEPARATION, GATE }

    public static final class PolicyException extends RuntimeException {
        public final String code;
        public final Kind kind;
        public final transient Object detail;

        public PolicyException(Kind kind, String code, String message, Object detail) {
            super(message);
            this.kind = kind;
            this.code = code;
            this.detail = detail;
        }
    }

    public record Condition(String code, boolean ok, boolean relaxed, boolean pending, String detail) {
    }

    /** {@code passed} ignores a pending condition and one relaxed for DEV. */
    public record Gate(boolean passed, boolean enforced, List<Condition> conditions) {
    }

    public record Proposal(JsonNode scope, JsonNode schedule, JsonNode retention, JsonNode targets, String reason, String proposedBy) {
    }

    private static final Set<String> COMPONENTS = Set.of("DATABASE", "OBJECT_STORE");
    private static final Set<String> FOLDER_MEDIA = Set.of("SERVER_FOLDER", "NETWORK_SHARE", "REMOVABLE_MEDIA");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final LedgerService ledger;
    private final TargetCatalog catalog;
    private final TargetTester tester;
    private final AgentProperties properties;

    public PolicyService(JdbcTemplate jdbc, TransactionTemplate tx, LedgerService ledger, TargetCatalog catalog, TargetTester tester, AgentProperties properties) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.ledger = ledger;
        this.catalog = catalog;
        this.tester = tester;
        this.properties = properties;
    }

    // ------------------------------------------------------------------ reading

    @Override
    public Optional<PolicyView> active() {
        return jdbc.queryForList("select version, scope_json::text as scope, targets_json::text as targets from backup_policy where status = 'ACTIVE'").stream().findFirst().map(row -> {
            try {
                Set<String> components = new LinkedHashSet<>();
                JSON.readTree((String) row.get("scope")).path("components").forEach(n -> components.add(n.asText()));
                Set<String> codes = new LinkedHashSet<>();
                JSON.readTree((String) row.get("targets")).path("targets").forEach(n -> codes.add(n.path("code").asText().toUpperCase(Locale.ROOT)));
                return new PolicyView(((Number) row.get("version")).intValue(), components, codes);
            } catch (java.io.IOException e) {
                throw new IllegalStateException("The active policy cannot be read", e);
            }
        });
    }

    public List<Map<String, Object>> list() {
        return jdbc.queryForList(SELECT + " order by version desc").stream().map(PolicyService::view).toList();
    }

    public record Page(List<Map<String, Object>> data, int page, int limit, long total) {
    }

    /** One page of versions, newest first (or by the chosen column), filtered by status and a search over people and reason. */
    public Page page(String search, String status, String sortBy, boolean ascending, int page, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (status != null && !status.isBlank()) {
            where.append(" and status = ?");
            args.add(status.trim().toUpperCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (lower(coalesce(proposed_by,'')) like ? or lower(coalesce(approved_by,'')) like ? or lower(coalesce(reason,'')) like ? or cast(version as text) = ?)");
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(search.trim());
        }
        String column = switch (sortBy == null ? "" : sortBy) {
            case "status" -> "status";
            case "proposedBy" -> "proposed_by";
            case "approvedBy" -> "approved_by";
            case "createdAt" -> "created_at";
            case "activatedAt" -> "activated_at";
            default -> "version";
        };
        Long total = jdbc.queryForObject("select count(*) from backup_policy" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + where + " order by " + column + (ascending ? " asc" : " desc") + " nulls last, version desc limit ? offset ?", pageArgs.toArray())
                .stream().map(PolicyService::view).toList();
        return new Page(rows, safePage, safeLimit, total == null ? 0 : total);
    }

    public Map<String, Object> get(int version) {
        return jdbc.queryForList(SELECT + " where version = ?", version).stream().findFirst().map(PolicyService::view)
                .orElseThrow(() -> new PolicyException(Kind.NOT_FOUND, "POLICY_NOT_FOUND", "There is no policy version " + version, null));
    }

    private static final String SELECT = "select id, version, status, scope_json::text as scope, schedule_json::text as schedule, retention_json::text as retention, "
            + "targets_json::text as targets, proposed_by, approved_by, reason, approval_signature_ref, created_at, activated_at, policy_sha256, gate_json::text as gate, "
            + "discarded_by, discard_reason from backup_policy";

    private static Map<String, Object> view(Map<String, Object> row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", String.valueOf(row.get("id")));
        m.put("version", row.get("version"));
        m.put("status", row.get("status"));
        m.put("scope", row.get("scope"));
        m.put("schedule", row.get("schedule"));
        m.put("retention", row.get("retention"));
        m.put("targets", row.get("targets"));
        m.put("proposedBy", row.get("proposed_by"));
        m.put("approvedBy", row.get("approved_by"));
        m.put("reason", row.get("reason"));
        m.put("signatureRef", row.get("approval_signature_ref"));
        m.put("createdAt", instant(row.get("created_at")));
        m.put("activatedAt", instant(row.get("activated_at")));
        m.put("sha256", row.get("policy_sha256") == null ? null : String.valueOf(row.get("policy_sha256")).trim());
        m.put("gate", row.get("gate"));
        m.put("discardedBy", row.get("discarded_by"));
        m.put("discardReason", row.get("discard_reason"));
        return m;
    }

    private static String instant(Object value) {
        return value instanceof Timestamp t ? t.toInstant().toString() : null;
    }

    // ------------------------------------------------------------------ proposing

    public Map<String, Object> propose(Proposal proposal) {
        if (blank(proposal.proposedBy())) throw invalid("POLICY_PROPOSER_REQUIRED", "Who is proposing the policy must be known");
        if (blank(proposal.reason())) throw invalid("POLICY_REASON_REQUIRED", "A reason is required for a policy change");
        ObjectNode scope = normalizeScope(proposal.scope());
        ObjectNode schedule = normalizeSchedule(proposal.schedule());
        ObjectNode retention = normalizeRetention(proposal.retention());
        ObjectNode targets = normalizeTargets(proposal.targets());
        if (scopeIncludes(scope, "OBJECT_STORE") && !properties.getObjects().isEnabled()) {
            throw invalid("POLICY_OBJECTS_NOT_CONFIGURED", "The document store is not configured on this agent, so OBJECT_STORE cannot be part of the policy");
        }
        String sha = sha(scope, schedule, retention, targets);
        int version;
        try {
            version = tx.execute(status -> {
                Integer next = jdbc.queryForObject("select coalesce(max(version), 0) + 1 from backup_policy", Integer.class);
                jdbc.update("insert into backup_policy(version, status, scope_json, schedule_json, retention_json, targets_json, proposed_by, reason, policy_sha256) "
                                + "values (?, 'DRAFT', ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?)",
                        next, scope.toString(), schedule.toString(), retention.toString(), targets.toString(), proposal.proposedBy().trim(), proposal.reason().trim(), sha);
                return next;
            });
        } catch (DuplicateKeyException e) {
            throw new PolicyException(Kind.CONFLICT, "POLICY_DRAFT_EXISTS", "A draft policy is already waiting; discard it or activate it first", null);
        }
        ledger.append(proposal.proposedBy().trim(), "POLICY_PROPOSED", "policy-v" + version, Map.of("version", version, "policySha256", sha, "reason", proposal.reason().trim()));
        return get(version);
    }

    public Map<String, Object> discard(int version, String by, String reason) {
        if (blank(by) || blank(reason)) throw invalid("POLICY_REASON_REQUIRED", "Who discards the draft and why must be given");
        Map<String, Object> policy = get(version);
        if (!"DRAFT".equals(policy.get("status"))) throw new PolicyException(Kind.CONFLICT, "POLICY_NOT_DRAFT", "Only a draft can be discarded", null);
        jdbc.update("update backup_policy set status = 'DISCARDED', discarded_by = ?, discard_reason = ? where version = ? and status = 'DRAFT'", by.trim(), reason.trim(), version);
        ledger.append(by.trim(), "POLICY_DISCARDED", "policy-v" + version, Map.of("version", version, "reason", reason.trim()));
        return get(version);
    }

    // ------------------------------------------------------------------ the 3-2-1-1 gate

    /** @param runTests true on activation: every target in the policy is written, read back and (if immutable) asked to refuse a delete. */
    public Gate evaluate(JsonNode targetsJson, boolean runTests, Map<String, TargetTester.Result> testResults) {
        List<JsonNode> declared = new ArrayList<>();
        targetsJson.path("targets").forEach(declared::add);
        boolean enforced = !"DEV".equalsIgnoreCase(properties.getEnvironment());
        List<Condition> conditions = new ArrayList<>();

        int copies = 1 + declared.size();
        conditions.add(new Condition("COPIES", copies >= 3, false, false, copies + " copies of the data (the live system plus " + declared.size() + " target(s)); at least 3 are required"));

        Set<String> media = declared.stream().map(n -> n.path("medium").asText()).collect(Collectors.toCollection(LinkedHashSet::new));
        conditions.add(new Condition("MEDIA", media.size() >= 2, false, false, media.size() + " kind(s) of medium (" + String.join(", ", media) + "); at least 2 are required"));

        List<String> offsite = declared.stream().filter(n -> n.path("offsite").asBoolean(false)).map(n -> n.path("code").asText()).toList();
        boolean offsiteOk = !offsite.isEmpty();
        // Whether a place is really somewhere else is a fact about the building, not something the agent can measure. A person declares it.
        conditions.add(new Condition("OFFSITE", offsiteOk, !offsiteOk && !enforced, false,
                offsiteOk ? "Declared off-site: " + String.join(", ", offsite) : "No target is declared off-site; at least 1 is required" + (enforced ? "" : " (not enforced in DEV, where everything runs on one PC)")));

        List<String> immutable = declared.stream().filter(n -> n.path("immutable").asBoolean(false)).map(n -> n.path("code").asText()).toList();
        conditions.add(new Condition("IMMUTABLE", !immutable.isEmpty(), false, false,
                immutable.isEmpty() ? "No target is declared immutable; at least 1 is required" : "Declared immutable: " + String.join(", ", immutable)));

        List<String> mismatched = new ArrayList<>();
        for (JsonNode n : declared) {
            if (n.path("immutable").asBoolean(false)) {
                boolean configured = catalog.find(n.path("code").asText()).map(BackupTarget::immutable).orElse(false);
                if (!configured) mismatched.add(n.path("code").asText());
            }
        }
        conditions.add(new Condition("IMMUTABLE_CONFIGURED", mismatched.isEmpty(), false, false,
                mismatched.isEmpty() ? "Every target declared immutable is configured as immutable" : "Declared immutable but not configured as immutable on the agent: " + String.join(", ", mismatched)));

        if (!runTests) {
            conditions.add(new Condition("TARGETS_WORK", false, false, true, "Every target is written, read back and, if immutable, asked to refuse a delete when the policy is activated"));
        } else {
            List<String> failed = new ArrayList<>();
            for (JsonNode n : declared) {
                TargetTester.Result r = testResults.get(n.path("code").asText());
                if (r == null || !r.ok()) failed.add(n.path("code").asText());
            }
            conditions.add(new Condition("TARGETS_WORK", failed.isEmpty(), false, false,
                    failed.isEmpty() ? "Every target passed its test" : "Failed its test: " + String.join(", ", failed)));
        }
        boolean passed = conditions.stream().allMatch(c -> c.ok() || c.relaxed() || c.pending());
        return new Gate(passed, enforced, conditions);
    }

    public Gate preview(int version) {
        return evaluate(parse((String) get(version).get("targets")), false, Map.of());
    }

    // ------------------------------------------------------------------ activating

    /**
     * @param signatureRef reference of the electronic signature the eQMS backend verified for the approver (BR-10). The agent cannot
     *                     check a signature itself; it records the reference with the activation.
     */
    public Map<String, Object> activate(int version, String approvedBy, String signatureRef) {
        if (blank(approvedBy)) throw invalid("POLICY_APPROVER_REQUIRED", "Who approves the policy must be known");
        if (blank(signatureRef)) throw invalid("POLICY_SIGNATURE_REQUIRED", "An electronic signature is required to activate a policy");
        Map<String, Object> policy = get(version);
        if (!"DRAFT".equals(policy.get("status"))) throw new PolicyException(Kind.CONFLICT, "POLICY_NOT_DRAFT", "Only a draft can be activated", null);
        String proposer = (String) policy.get("proposedBy");
        if (proposer != null && proposer.equalsIgnoreCase(approvedBy.trim())) {
            ledger.append(approvedBy.trim(), "POLICY_ACTIVATION_REFUSED", "policy-v" + version, Map.of("version", version, "reason", "SAME_PERSON"));
            throw new PolicyException(Kind.SEPARATION, "POLICY_SAME_PERSON", "The person who proposed a policy cannot be the one who activates it", null);
        }
        JsonNode targets = parse((String) policy.get("targets"));
        Map<String, TargetTester.Result> results = new LinkedHashMap<>();
        for (JsonNode n : targets.path("targets")) {
            String code = n.path("code").asText();
            catalog.find(code).ifPresent(t -> results.put(code, tester.test(t)));
        }
        Gate gate = evaluate(targets, true, results);
        Map<String, Object> gateRecord = gateRecord(gate, results);
        if (!gate.passed()) {
            ledger.append(approvedBy.trim(), "POLICY_ACTIVATION_REFUSED", "policy-v" + version,
                    Map.of("version", version, "reason", "GATE", "failed", gate.conditions().stream().filter(c -> !c.ok() && !c.relaxed() && !c.pending()).map(Condition::code).toList()));
            throw new PolicyException(Kind.GATE, "POLICY_GATE_FAILED", "The policy does not meet the 3-2-1-1 rule, so it cannot be activated", gateRecord);
        }
        tx.executeWithoutResult(status -> {
            jdbc.update("update backup_policy set status = 'SUPERSEDED' where status = 'ACTIVE'");
            jdbc.update("update backup_policy set status = 'ACTIVE', approved_by = ?, approval_signature_ref = ?, activated_at = ?, gate_json = ?::jsonb where version = ? and status = 'DRAFT'",
                    approvedBy.trim(), signatureRef.trim(), Timestamp.from(Instant.now()), CanonicalJson.of(gateRecord), version);
        });
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("version", version);
        data.put("policySha256", policy.get("sha256"));
        data.put("proposedBy", proposer);
        data.put("signatureRef", signatureRef.trim());
        data.put("gateEnforced", gate.enforced());
        data.put("relaxed", gate.conditions().stream().filter(c -> !c.ok() && c.relaxed()).map(Condition::code).toList());
        ledger.append(approvedBy.trim(), "POLICY_ACTIVATED", "policy-v" + version, data);
        return get(version);
    }

    private static Map<String, Object> gateRecord(Gate gate, Map<String, TargetTester.Result> results) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("passed", gate.passed());
        m.put("enforced", gate.enforced());
        m.put("conditions", gate.conditions().stream().map(c -> {
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("code", c.code());
            o.put("ok", c.ok());
            o.put("relaxed", c.relaxed());
            o.put("pending", c.pending());
            o.put("detail", c.detail());
            return o;
        }).toList());
        m.put("targetTests", results.values().stream().map(r -> {
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("target", r.target());
            o.put("ok", r.ok());
            o.put("steps", r.steps().stream().map(s -> s.name() + ":" + (s.ok() ? "ok" : "fail")).toList());
            return o;
        }).toList());
        return m;
    }

    // ------------------------------------------------------------------ validation

    private ObjectNode normalizeScope(JsonNode scope) {
        Set<String> components = new LinkedHashSet<>();
        if (scope != null) scope.path("components").forEach(n -> components.add(n.asText().toUpperCase(Locale.ROOT)));
        if (!components.contains("DATABASE")) throw invalid("POLICY_SCOPE_DATABASE", "The database must be part of every backup policy");
        for (String c : components) {
            if (!COMPONENTS.contains(c)) throw invalid("POLICY_SCOPE_UNSUPPORTED", c + " cannot be backed up yet; supported: " + String.join(", ", COMPONENTS));
        }
        ObjectNode out = JSON.createObjectNode();
        ArrayNode list = out.putArray("components");
        COMPONENTS.stream().sorted().filter(components::contains).forEach(list::add);
        return out;
    }

    private ObjectNode normalizeSchedule(JsonNode schedule) {
        JsonNode db = schedule == null ? JSON.createObjectNode() : schedule.path("database");
        String frequency = db.path("frequency").asText("DAILY").toUpperCase(Locale.ROOT);
        if (!"DAILY".equals(frequency)) throw invalid("POLICY_SCHEDULE_FREQUENCY", "Only a daily database backup is supported by the scheduler for now");
        String type = db.path("type").asText("FULL").toUpperCase(Locale.ROOT);
        if (!"FULL".equals(type)) throw invalid("POLICY_SCHEDULE_TYPE", "Only a full backup can be scheduled for now");
        String time = db.path("time").asText("02:00");
        try {
            time = LocalTime.parse(time).toString();
        } catch (DateTimeParseException e) {
            throw invalid("POLICY_SCHEDULE_TIME", "The backup time must be HH:mm");
        }
        ObjectNode out = JSON.createObjectNode();
        ObjectNode d = out.putObject("database");
        d.put("enabled", db.path("enabled").asBoolean(true));
        d.put("frequency", frequency);
        d.put("time", time.length() == 5 ? time : time.substring(0, 5));
        d.put("type", type);
        return out;
    }

    private ObjectNode normalizeRetention(JsonNode retention) {
        String mode = retention == null ? "PERMANENT" : retention.path("mode").asText("PERMANENT");
        if (!"PERMANENT".equalsIgnoreCase(mode)) throw invalid("POLICY_RETENTION", "Backups are kept permanently (decision BR-2); no other retention can be set");
        ObjectNode out = JSON.createObjectNode();
        out.put("mode", "PERMANENT");
        return out;
    }

    private ObjectNode normalizeTargets(JsonNode targets) {
        ArrayNode in = targets == null ? JSON.createArrayNode() : (targets.path("targets").isArray() ? (ArrayNode) targets.path("targets") : JSON.createArrayNode());
        ObjectNode out = JSON.createObjectNode();
        ArrayNode list = out.putArray("targets");
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode n : in) {
            String code = n.path("code").asText("").toUpperCase(Locale.ROOT);
            if (!code.matches("T[1-9]")) throw invalid("POLICY_TARGET_CODE", "A target code must be T1 to T9, not '" + code + "'");
            if (!seen.add(code)) throw invalid("POLICY_TARGET_DUPLICATE", "Target " + code + " is listed twice");
            BackupTarget configured = catalog.find(code).orElseThrow(() -> invalid("POLICY_TARGET_UNKNOWN", "Target " + code + " is not configured on the agent"));
            String medium = n.path("medium").asText(n.path("kind").asText("")).toUpperCase(Locale.ROOT);
            boolean mediumOk = "S3".equals(configured.kind()) ? "OBJECT_STORAGE".equals(medium) : FOLDER_MEDIA.contains(medium);
            if (!mediumOk) throw invalid("POLICY_TARGET_MEDIUM", "Target " + code + " is a " + configured.kind() + " target; '" + medium + "' does not describe it");
            if ("T1".equals(code) && !"SERVER_FOLDER".equals(medium)) throw invalid("POLICY_TARGET_MEDIUM", "T1 is the folder on the server (SERVER_FOLDER)");
            ObjectNode t = list.addObject();
            t.put("code", code);
            t.put("medium", medium);
            t.put("role", "T1".equals(code) ? "PRIMARY" : "COPY");
            t.put("offsite", n.path("offsite").asBoolean(false));
            t.put("immutable", n.path("immutable").asBoolean(false));
        }
        if (!seen.contains("T1")) throw invalid("POLICY_TARGET_T1", "T1 must be in the policy: it is where every backup is written first");
        return out;
    }

    private static boolean scopeIncludes(ObjectNode scope, String component) {
        for (JsonNode n : scope.path("components")) if (component.equals(n.asText())) return true;
        return false;
    }

    private static String sha(JsonNode... parts) {
        Map<String, Object> m = new LinkedHashMap<>();
        String[] names = {"scope", "schedule", "retention", "targets"};
        for (int i = 0; i < parts.length; i++) m.put(names[i], parts[i]);
        return ManifestService.sha256(CanonicalJson.of(JSON.convertValue(m, Object.class)));
    }

    private static JsonNode parse(String json) {
        try {
            return JSON.readTree(json);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static PolicyException invalid(String code, String message) {
        return new PolicyException(Kind.INVALID, code, message, null);
    }

    /** Needed by tests that build the service by hand. */
    public static UUID idOf(Map<String, Object> policy) {
        return UUID.fromString((String) policy.get("id"));
    }
}

package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.policy.PolicyService;
import com.eqms.backup.agent.policy.PolicyView;
import com.eqms.backup.agent.target.BackupTarget;
import com.eqms.backup.agent.target.FolderTarget;
import com.eqms.backup.agent.target.TargetCatalog;
import com.eqms.backup.agent.target.TargetRegistry;
import com.eqms.backup.agent.target.TargetTester;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Policy versions, the two-person rule and the 3-2-1-1 gate (SDS 6.1 and 24). */
class PolicyServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Behaves like a locked bucket: it stores and returns data but refuses every delete. */
    static final class LockedTarget implements BackupTarget {
        private final FolderTarget inner;

        LockedTarget(Path root) {
            this.inner = new FolderTarget("T3", root, true);
        }

        @Override public String code() { return "T3"; }
        @Override public String kind() { return "S3"; }
        @Override public boolean immutable() { return true; }
        @Override public String describe(String key) { return inner.describe(key); }
        @Override public void put(String key, Path file) throws IOException { inner.put(key, file); }
        @Override public void get(String key, Path destination) throws IOException { inner.get(key, destination); }
        @Override public boolean exists(String key) { return inner.exists(key); }
        @Override public boolean tryDelete(String key) { return false; }
        @Override public List<String> list(String prefix) throws IOException { return inner.list(prefix); }
    }

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    AgentProperties properties;
    LedgerService ledger;
    PolicyService service;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        properties = new AgentProperties();
        properties.setEnvironment("PROD");
        properties.setLedgerDir(tmp.resolve("ledger"));
        properties.getTargets().setT1(tmp.resolve("t1"));
        properties.getCrypto().setSigningKeyFile(tmp.resolve("agent").resolve("signing.key"));
        properties.getObjects().setEnabled(true);
        ledger = new LedgerService(db.jdbc, db.tx, properties);
        TargetCatalog catalog = new TargetCatalog(properties, new TargetRegistry(List.of(new LockedTarget(tmp.resolve("t3")))));
        service = new PolicyService(db.jdbc, db.tx, ledger, catalog, new TargetTester(), properties);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static final String SCOPE = "{\"components\":[\"DATABASE\",\"OBJECT_STORE\"]}";
    private static final String SCHEDULE = "{\"database\":{\"enabled\":true,\"frequency\":\"DAILY\",\"time\":\"01:30\",\"type\":\"FULL\"}}";
    private static final String GOOD_TARGETS = "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"},"
            + "{\"code\":\"T3\",\"medium\":\"OBJECT_STORAGE\",\"offsite\":true,\"immutable\":true}]}";

    private PolicyService.Proposal proposal(String scope, String schedule, String retention, String targets) {
        return new PolicyService.Proposal(json(scope), json(schedule), json(retention), json(targets), "Add the immutable copy", "alice");
    }

    private PolicyService.Proposal good() {
        return proposal(SCOPE, SCHEDULE, "{\"mode\":\"PERMANENT\"}", GOOD_TARGETS);
    }

    private List<String> ledgerEvents() {
        return ledger.all().stream().map(LedgerService.Event::event).collect(Collectors.toList());
    }

    private void assertRefused(PolicyService.Proposal p, String code) {
        assertThatThrownBy(() -> service.propose(p)).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo(code));
    }

    @Test
    void aProposalBecomesTheNextDraftVersionWithANormalisedBodyAndAHash() {
        Map<String, Object> draft = service.propose(good());
        assertThat(draft.get("version")).isEqualTo(2);
        assertThat(draft.get("status")).isEqualTo("DRAFT");
        assertThat(draft.get("proposedBy")).isEqualTo("alice");
        assertThat((String) draft.get("sha256")).hasSize(64);
        assertThat(json((String) draft.get("targets")).path("targets").get(1).path("role").asText()).isEqualTo("COPY");
        assertThat(json((String) draft.get("schedule")).path("database").path("time").asText()).isEqualTo("01:30");
        assertThat(ledgerEvents()).contains("POLICY_PROPOSED");
        assertThat(service.get(1).get("status")).as("the running policy is untouched").isEqualTo("ACTIVE");
    }

    @Test
    void aProposalNeedsAProposerAndAReason() {
        assertThatThrownBy(() -> service.propose(new PolicyService.Proposal(json(SCOPE), json(SCHEDULE), json("{}"), json(GOOD_TARGETS), " ", "alice")))
                .isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_REASON_REQUIRED"));
        assertThatThrownBy(() -> service.propose(new PolicyService.Proposal(json(SCOPE), json(SCHEDULE), json("{}"), json(GOOD_TARGETS), "why", null)))
                .isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_PROPOSER_REQUIRED"));
    }

    @Test
    void invalidContentIsRefusedWithAStableCode() {
        assertRefused(proposal("{\"components\":[\"OBJECT_STORE\"]}", SCHEDULE, "{}", GOOD_TARGETS), "POLICY_SCOPE_DATABASE");
        assertRefused(proposal("{\"components\":[\"DATABASE\",\"CONFIGURATION\"]}", SCHEDULE, "{}", GOOD_TARGETS), "POLICY_SCOPE_UNSUPPORTED");
        assertRefused(proposal(SCOPE, SCHEDULE, "{\"mode\":\"DAYS\",\"days\":30}", GOOD_TARGETS), "POLICY_RETENTION");
        assertRefused(proposal(SCOPE, "{\"database\":{\"frequency\":\"WEEKLY\"}}", "{}", GOOD_TARGETS), "POLICY_SCHEDULE_FREQUENCY");
        assertRefused(proposal(SCOPE, "{\"database\":{\"time\":\"25:99\"}}", "{}", GOOD_TARGETS), "POLICY_SCHEDULE_TIME");
        assertRefused(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"},{\"code\":\"T7\",\"medium\":\"SERVER_FOLDER\"}]}"), "POLICY_TARGET_UNKNOWN");
        assertRefused(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T3\",\"medium\":\"OBJECT_STORAGE\"}]}"), "POLICY_TARGET_T1");
        assertRefused(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"},{\"code\":\"T3\",\"medium\":\"NETWORK_SHARE\"}]}"), "POLICY_TARGET_MEDIUM");
        assertRefused(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"OBJECT_STORAGE\"}]}"), "POLICY_TARGET_MEDIUM");
        assertRefused(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"},{\"code\":\"t1\",\"medium\":\"SERVER_FOLDER\"}]}"), "POLICY_TARGET_DUPLICATE");
        assertRefused(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"X\",\"medium\":\"SERVER_FOLDER\"}]}"), "POLICY_TARGET_CODE");
        assertThat(service.list()).as("nothing was stored").hasSize(1);
    }

    @Test
    void documentsCannotBeInThePolicyWhenTheAgentHasNoDocumentStore() {
        properties.getObjects().setEnabled(false);
        assertRefused(good(), "POLICY_OBJECTS_NOT_CONFIGURED");
    }

    @Test
    void onlyOneDraftCanWaitAtATime() {
        service.propose(good());
        assertRefused(good(), "POLICY_DRAFT_EXISTS");
    }

    @Test
    void thePreviewShowsEachConditionWithoutWritingToAnyTarget() {
        service.propose(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"}]}"));
        PolicyService.Gate gate = service.preview(2);
        assertThat(gate.passed()).isFalse();
        assertThat(gate.conditions()).extracting(PolicyService.Condition::code)
                .containsExactly("COPIES", "MEDIA", "OFFSITE", "IMMUTABLE", "IMMUTABLE_CONFIGURED", "TARGETS_WORK");
        assertThat(gate.conditions()).filteredOn(c -> !c.ok() && !c.pending()).extracting(PolicyService.Condition::code)
                .containsExactly("COPIES", "MEDIA", "OFFSITE", "IMMUTABLE");
        assertThat(gate.conditions()).filteredOn(PolicyService.Condition::pending).hasSize(1);
    }

    @Test
    void aPolicyThatMeetsThe3211RuleIsActivatedByAnotherPersonAndTheOldOneIsSuperseded() {
        service.propose(good());
        Map<String, Object> active = service.activate(2, "bob", "SIG-123");

        assertThat(active.get("status")).isEqualTo("ACTIVE");
        assertThat(active.get("approvedBy")).isEqualTo("bob");
        assertThat(active.get("signatureRef")).isEqualTo("SIG-123");
        assertThat(active.get("activatedAt")).isNotNull();
        assertThat(service.get(1).get("status")).isEqualTo("SUPERSEDED");
        assertThat(db.jdbc.queryForObject("select count(*) from backup_policy where status = 'ACTIVE'", Integer.class)).isEqualTo(1);
        assertThat(json((String) active.get("gate")).path("passed").asBoolean()).isTrue();
        assertThat(json((String) active.get("gate")).path("targetTests")).hasSize(2);
        PolicyView view = service.active().orElseThrow();
        assertThat(view.version()).isEqualTo(2);
        assertThat(view.components()).containsExactlyInAnyOrder("DATABASE", "OBJECT_STORE");
        assertThat(view.targetCodes()).containsExactlyInAnyOrder("T1", "T3");
        assertThat(ledgerEvents()).containsSubsequence("POLICY_PROPOSED", "POLICY_ACTIVATED");
        assertThat(ledger.verify().ok()).isTrue();
    }

    @Test
    void thePersonWhoProposedCannotActivateEvenWithADifferentCase() {
        service.propose(good());
        assertThatThrownBy(() -> service.activate(2, "ALICE", "SIG-1"))
                .isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_SAME_PERSON"));
        assertThat(service.get(2).get("status")).isEqualTo("DRAFT");
        assertThat(service.get(1).get("status")).isEqualTo("ACTIVE");
        assertThat(ledgerEvents()).contains("POLICY_ACTIVATION_REFUSED");
    }

    @Test
    void activationNeedsAnApproverAndAnElectronicSignatureReference() {
        service.propose(good());
        assertThatThrownBy(() -> service.activate(2, "bob", " ")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_SIGNATURE_REQUIRED"));
        assertThatThrownBy(() -> service.activate(2, null, "SIG")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_APPROVER_REQUIRED"));
        assertThat(service.get(2).get("status")).isEqualTo("DRAFT");
    }

    @Test
    void aPolicyThatBreaksTheRuleIsRefusedWithEveryReasonAndTheRunningPolicyKeepsRunning() {
        service.propose(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"}]}"));
        assertThatThrownBy(() -> service.activate(2, "bob", "SIG-1")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> {
            assertThat(e.code).isEqualTo("POLICY_GATE_FAILED");
            assertThat(String.valueOf(e.detail)).contains("COPIES", "OFFSITE", "IMMUTABLE");
        });
        assertThat(service.get(1).get("status")).isEqualTo("ACTIVE");
        assertThat(service.get(2).get("status")).isEqualTo("DRAFT");
        assertThat(ledgerEvents()).contains("POLICY_ACTIVATION_REFUSED");
    }

    @Test
    void aTargetDeclaredImmutableThatTheAgentDoesNotTreatAsImmutableIsRefused() {
        properties.getTargets().getExtra().clear();
        TargetCatalog plain = new TargetCatalog(properties, new TargetRegistry(List.of(new FolderTarget("T2", tmp.resolve("t2"), false))));
        service = new PolicyService(db.jdbc, db.tx, ledger, plain, new TargetTester(), properties);
        service.propose(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"},"
                + "{\"code\":\"T2\",\"medium\":\"NETWORK_SHARE\",\"offsite\":true,\"immutable\":true}]}"));
        assertThatThrownBy(() -> service.activate(2, "bob", "SIG-1")).isInstanceOfSatisfying(PolicyService.PolicyException.class,
                e -> assertThat(String.valueOf(e.detail)).contains("IMMUTABLE_CONFIGURED"));
    }

    @Test
    void aTargetThatFailsItsTestBlocksActivation() throws Exception {
        java.nio.file.Files.writeString(tmp.resolve("t1"), "a file where the T1 folder should be");
        service.propose(good());
        assertThatThrownBy(() -> service.activate(2, "bob", "SIG-1")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> {
            assertThat(e.code).isEqualTo("POLICY_GATE_FAILED");
            assertThat(String.valueOf(e.detail)).contains("TARGETS_WORK");
        });
    }

    @Test
    void inDevOnlyTheOffsiteConditionIsRelaxedAndTheActivationSaysSo() {
        properties.setEnvironment("DEV");
        service.propose(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"},"
                + "{\"code\":\"T3\",\"medium\":\"OBJECT_STORAGE\",\"offsite\":false,\"immutable\":true}]}"));
        Map<String, Object> active = service.activate(2, "bob", "SIG-1");
        assertThat(active.get("status")).isEqualTo("ACTIVE");
        JsonNode gate = json((String) active.get("gate"));
        assertThat(gate.path("enforced").asBoolean()).isFalse();
        JsonNode offsite = null;
        for (JsonNode c : gate.path("conditions")) if ("OFFSITE".equals(c.path("code").asText())) offsite = c;
        assertThat(offsite.path("ok").asBoolean()).isFalse();
        assertThat(offsite.path("relaxed").asBoolean()).isTrue();
        assertThat(ledger.all().stream().filter(e -> e.event().equals("POLICY_ACTIVATED")).findFirst().orElseThrow().dataJson()).contains("\"gateEnforced\":false").contains("OFFSITE");
    }

    @Test
    void inDevTheOtherConditionsStillApply() {
        properties.setEnvironment("DEV");
        service.propose(proposal(SCOPE, SCHEDULE, "{}", "{\"targets\":[{\"code\":\"T1\",\"medium\":\"SERVER_FOLDER\"}]}"));
        assertThatThrownBy(() -> service.activate(2, "bob", "SIG-1")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_GATE_FAILED"));
    }

    @Test
    void aDraftCanBeDiscardedWithAReasonAndANewOneProposed() {
        service.propose(good());
        Map<String, Object> discarded = service.discard(2, "carol", "Wrong target list");
        assertThat(discarded.get("status")).isEqualTo("DISCARDED");
        assertThat(discarded.get("discardedBy")).isEqualTo("carol");
        assertThat(ledgerEvents()).contains("POLICY_DISCARDED");
        assertThat(service.propose(good()).get("version")).isEqualTo(3);
        assertThatThrownBy(() -> service.discard(1, "carol", "no")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_NOT_DRAFT"));
        assertThatThrownBy(() -> service.discard(3, "carol", " ")).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.code).isEqualTo("POLICY_REASON_REQUIRED"));
    }

    @Test
    void anUnknownVersionIsNotFound() {
        assertThatThrownBy(() -> service.get(99)).isInstanceOfSatisfying(PolicyService.PolicyException.class, e -> assertThat(e.kind).isEqualTo(PolicyService.Kind.NOT_FOUND));
    }

    @Test
    void theStartingPolicyIsReadAsDatabaseOnToT1() {
        PolicyView view = service.active().orElseThrow();
        assertThat(view.components()).containsExactly("DATABASE");
        assertThat(view.targetCodes()).isEqualTo(Set.of("T1"));
    }

    @Test
    void theVersionListPagesFiltersSortsAndSearchesOnTheServer() {
        service.propose(good());
        service.discard(2, "carol", "first draft was wrong");
        service.propose(good());
        service.discard(3, "carol", "second draft too");
        service.propose(good());

        PolicyService.Page first = service.page(null, null, "version", false, 1, 2);
        assertThat(first.total()).isEqualTo(4);
        assertThat(first.data()).extracting(m -> m.get("version")).containsExactly(4, 3);
        assertThat(service.page(null, null, "version", false, 2, 2).data()).extracting(m -> m.get("version")).containsExactly(2, 1);
        assertThat(service.page(null, "DISCARDED", "version", true, 1, 10).data()).extracting(m -> m.get("version")).containsExactly(2, 3);
        assertThat(service.page("alice", null, "version", false, 1, 10).total()).isEqualTo(3);
        assertThat(service.page("100%", null, "version", false, 1, 10).total()).as("a wildcard is searched for literally").isZero();
        assertThat(service.page(null, null, "version", false, 1, 1000).limit()).isEqualTo(100);
    }
}

package com.eqms.service.authorization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The buttons of a screen follow the engine: replace where the hint was only permission and state, and where the hint holds a business condition both must agree. */
class EngineCapabilitiesTest {
    private final AuthorizationEngineService engine = mock(AuthorizationEngineService.class);
    private final UserAccount actor = new UserAccount();
    private final UUID id = UUID.randomUUID();

    private Map<String, Object> caps(Object submit, Object notify, Object other) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("submit", submit);
        m.put("notify", notify);
        m.put("other", other);
        return m;
    }

    private void engineAllowsOnly(String action) {
        org.mockito.Mockito.doAnswer(i -> ((AuthorizationRequest) i.getArgument(0)).actionCode().equals(action)
                ? AuthorizationDecision.allow("p", List.of(), List.of(), 1L, "S", Map.of()) : AuthorizationDecision.deny("MISSING_PERMISSION")).when(engine).authorize(any());
    }

    @Test
    void replace_followsTheEngine_bothWays() {
        engineAllowsOnly("SUBMIT");
        Map<String, Object> out = new EngineCapabilities(engine).apply(actor, "T", id, caps(false, true, true), Map.of("submit", "SUBMIT"), Map.of());
        assertThat(out.get("submit")).isEqualTo(true);   // a policy made looser than the old hint shows the button
        engineAllowsOnly("NOTHING");
        assertThat(new EngineCapabilities(engine).apply(actor, "T", id, caps(true, true, true), Map.of("submit", "SUBMIT"), Map.of()).get("submit")).isEqualTo(false);
    }

    @Test
    void and_needsBothToAgree_andNeverTurnsAnOffHintOn() {
        engineAllowsOnly("NOTIFY");
        assertThat(new EngineCapabilities(engine).apply(actor, "T", id, caps(true, false, true), Map.of(), Map.of("notify", "NOTIFY")).get("notify")).isEqualTo(false);
        assertThat(new EngineCapabilities(engine).apply(actor, "T", id, caps(true, true, true), Map.of(), Map.of("notify", "NOTIFY")).get("notify")).isEqualTo(true);
        engineAllowsOnly("NOTHING");
        assertThat(new EngineCapabilities(engine).apply(actor, "T", id, caps(true, true, true), Map.of(), Map.of("notify", "NOTIFY")).get("notify")).isEqualTo(false);
    }

    @Test
    void keysThatNameNoActionStay_andAnErrorOfTheEngineTurnsTheKeyOff_andNoEngineLeavesTheHints() {
        engineAllowsOnly("SUBMIT");
        assertThat(new EngineCapabilities(engine).apply(actor, "T", id, caps(true, true, true), Map.of("submit", "SUBMIT"), Map.of()).get("other")).isEqualTo(true);
        org.mockito.Mockito.doThrow(new RuntimeException("boom")).when(engine).authorize(any());
        assertThat(new EngineCapabilities(engine).apply(actor, "T", id, caps(true, true, true), Map.of("submit", "SUBMIT"), Map.of()).get("submit")).isEqualTo(false);
        Map<String, Object> hints = caps(true, true, true);
        assertThat(new EngineCapabilities(null).apply(actor, "T", id, hints, Map.of("submit", "SUBMIT"), Map.of())).isSameAs(hints);
    }
}

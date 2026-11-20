package com.eqms.service.authorization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;

import com.eqms.entity.UserAccount;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The engine's real decisions are counted per type and action, allowed and refused apart; a type the engine does not decide alone is not counted. */
class EngineEvaluationCountersTest {
    @Test
    void countsAllowedAndRefused_perTypeAndAction_sorted() {
        EngineEvaluationCounters counters = new EngineEvaluationCounters();
        counters.record("UNCONTROLLED_COPY", "CANCEL", true);
        counters.record("UNCONTROLLED_COPY", "CANCEL", false);
        counters.record("UNCONTROLLED_COPY", "CANCEL", false);
        counters.record("ACCESS_REVIEW_CAMPAIGN", "COMPLETE", true);
        counters.record(null, "X", true);
        assertThat(counters.rows()).containsExactly(
                new EngineEvaluationCounters.Row("ACCESS_REVIEW_CAMPAIGN", "COMPLETE", 1, 0),
                new EngineEvaluationCounters.Row("UNCONTROLLED_COPY", "CANCEL", 1, 2));
        assertThat(counters.since()).isNotNull();
    }

    @Test
    void theGuardCountsWhatTheEngineDecides_andAnErrorCountsAsRefused() {
        EngineEvaluationCounters counters = new EngineEvaluationCounters();
        AuthorizationEngineService engine = mock(AuthorizationEngineService.class);
        org.mockito.Mockito.doReturn(AuthorizationDecision.allow("p", List.of(), List.of(), 1L, "S", Map.of())).doReturn(AuthorizationDecision.deny("MISSING_PERMISSION", "p", "S"))
                .doThrow(new RuntimeException("boom")).when(engine).authorize(any());
        UserAccount actor = new UserAccount();
        UUID id = UUID.randomUUID();
        ShadowGuard.refusalWhenEngineDecides(engine, actor, "UNCONTROLLED_COPY", id, "CANCEL", counters);
        ShadowGuard.refusalWhenEngineDecides(engine, actor, "UNCONTROLLED_COPY", id, "CANCEL", counters);
        ShadowGuard.refusalWhenEngineDecides(engine, actor, "UNCONTROLLED_COPY", id, "CANCEL", counters);
        assertThat(counters.rows()).containsExactly(new EngineEvaluationCounters.Row("UNCONTROLLED_COPY", "CANCEL", 1, 2));
    }
}

package com.eqms.service.authorization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingShadow;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

/**
 * The gate of the steps of the modules (the engine alone decides who may act, always on, fail-closed; the shadow mode and the cutover flags were removed 2026-11-20): a refusal of the engine, about
 * the person or about the state, stops the step before the service runs; the engine not there or failing stops it too; when the engine allows, the checks of the service still run; a record that does
 * not exist (no state) is left to the service, which answers not found.
 */
class ShadowGuardCutoverTest {
    private static final String TYPE = "UNCONTROLLED_COPY";

    private final AuthorizationEngineService engine = mock(AuthorizationEngineService.class);
    private final UserAccount actor = new UserAccount();
    private final UUID id = UUID.randomUUID();

    private void engineSays(AuthorizationDecision decision) {
        when(engine.authorize(any())).thenReturn(decision);
    }

    @Test
    void aRefusalStopsTheStepBeforeTheServiceRuns_aboutThePersonOrAboutTheState() {
        for (AuthorizationDecision refusal : new AuthorizationDecision[] {
                AuthorizationDecision.deny("MISSING_PERMISSION", "p", "READY_FOR_DISTRIBUTION"),
                AuthorizationDecision.deny("SEPARATION_OF_DUTIES", "p", "READY_FOR_DISTRIBUTION"),
                AuthorizationDecision.deny("POLICY_NOT_CONFIGURED", null, "DISTRIBUTED")}) {
            engineSays(refusal);
            AtomicInteger ran = new AtomicInteger();
            assertThatThrownBy(() -> new ShadowGuard(engine).around(actor, TYPE, id, "CANCEL", ShadowGuard::isDenial, () -> ran.incrementAndGet()))
                    .isInstanceOf(AccessDeniedException.class).hasMessage(refusal.reasonCode());
            assertThat(ran.get()).isZero();
        }
    }

    @Test
    void failsClosed_noEngine_orAnErrorOfTheEngine() {
        AtomicInteger ran = new AtomicInteger();
        assertThatThrownBy(() -> new ShadowGuard(null).around(actor, TYPE, id, "CANCEL", ShadowGuard::isDenial, () -> ran.incrementAndGet()))
                .isInstanceOf(IllegalStateException.class);
        when(engine.authorize(any())).thenThrow(new RuntimeException("boom"));
        assertThatThrownBy(() -> new ShadowGuard(engine).around(actor, TYPE, id, "CANCEL", ShadowGuard::isDenial, () -> ran.incrementAndGet()))
                .isInstanceOf(AccessDeniedException.class).hasMessage("AUTHORIZATION_ENGINE_ERROR");
        assertThat(ran.get()).isZero();
    }

    @Test
    void whenTheEngineAllows_theStepRuns_andItsOwnChecksStillApply_andAMissingRecordIsLeftToTheService() {
        engineSays(AuthorizationDecision.allow("OK", java.util.List.of(), java.util.List.of(), 1L, "READY_FOR_DISTRIBUTION", java.util.Map.of()));
        AtomicInteger ran = new AtomicInteger();
        new ShadowGuard(engine).around(actor, TYPE, id, "CANCEL", ShadowGuard::isDenial, () -> ran.incrementAndGet());
        assertThatThrownBy(() -> new ShadowGuard(engine).around(actor, TYPE, id, "CANCEL", ShadowGuard::isDenial, () -> {
            throw new SecurityException("the service refuses");
        })).isInstanceOf(SecurityException.class).hasMessage("the service refuses");
        engineSays(AuthorizationDecision.deny("POLICY_NOT_CONFIGURED", null, null)); // the record does not exist: no state
        new ShadowGuard(engine).around(actor, TYPE, id, "CANCEL", ShadowGuard::isDenial, () -> ran.incrementAndGet());
        assertThat(ran.get()).isEqualTo(2);
    }

    @Test
    void theTrainingGateDecidesInTheSameWay() {
        engineSays(AuthorizationDecision.deny("SEPARATION_OF_DUTIES"));
        AtomicInteger ran = new AtomicInteger();
        assertThatThrownBy(() -> new TrainingShadow(engine).around(actor, "TRAINING_RECORD", id, "VOID", true, () -> ran.incrementAndGet()))
                .isInstanceOf(AccessDeniedException.class).hasMessage("SEPARATION_OF_DUTIES");
        assertThat(ran.get()).isZero();
    }
}

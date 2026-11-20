package com.eqms.service.authorization;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * For the unit tests of a service whose legacy checks were deleted (the type is in ShadowGuard.ENGINE_DECIDES): the engine decides who may act, so a test that is about what the service does after the
 * person is allowed gives it an engine that allows. What the engine decides is tested with the policies themselves (the matrix tests) and in ShadowGuardCutoverTest.
 */
public final class TestGuards {
    private TestGuards() {}

    public static ShadowGuard allowing() {
        AuthorizationEngineService engine = mock(AuthorizationEngineService.class);
        org.mockito.Mockito.lenient().when(engine.authorize(any())).thenReturn(AuthorizationDecision.allow("TEST", List.of(), List.of(), 1L, "ANY", Map.of()));
        return new ShadowGuard(engine);
    }

    /** The Training counterpart: the engine allows, the service does the rest. */
    public static com.eqms.service.training.TrainingShadow allowingTraining() {
        AuthorizationEngineService engine = mock(AuthorizationEngineService.class);
        org.mockito.Mockito.lenient().when(engine.authorize(any())).thenReturn(AuthorizationDecision.allow("TEST", List.of(), List.of(), 1L, "ANY", Map.of()));
        return new com.eqms.service.training.TrainingShadow(engine);
    }

    /** The Training counterpart where the engine refuses the person for the reason given (SEPARATION_OF_DUTIES, MISSING_PERMISSION, ...). */
    public static com.eqms.service.training.TrainingShadow refusingTraining(String reason) {
        AuthorizationEngineService engine = mock(AuthorizationEngineService.class);
        org.mockito.Mockito.lenient().when(engine.authorize(any())).thenReturn(AuthorizationDecision.deny(reason, null, "OPEN"));
        return new com.eqms.service.training.TrainingShadow(engine);
    }

    /** Gives the service (built with a constructor that has no guard) the allowing guard. */
    public static <T> T withAllowingEngine(T service) {
        ReflectionTestUtils.setField(service, "shadow", allowing());
        return service;
    }
}

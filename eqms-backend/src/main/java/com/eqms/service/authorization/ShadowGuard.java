package com.eqms.service.authorization;

import com.eqms.entity.UserAccount;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.function.Predicate;
import java.util.function.Supplier;

/**
 * The gate of a step of a module in front of the Hybrid engine (the historical name comes from the time the engine was only asked in the shadow; that mode was removed
 * 2026-11-20, together with the table of mismatches and the cutover flags). The engine is the only decision about who may act, always on, and it fails closed: no engine, an error of
 * the engine, or a refusal, all stop the step before anything changes. Only the state of a record that does not exist is left to the service, which answers not found. What the service
 * checks after the gate (the state of the record, a missing reason, a stale version) is not a decision about who may act. The predicate argument of {@code around} and {@code run} is no
 * longer read; it stays so that the call sites do not have to change in the same step.
 */
@Component
public class ShadowGuard {
    private final AuthorizationEngineService engine;
    /** How many real steps the engine decided (shown in Engine Health); optional. */
    private EngineEvaluationCounters counters;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setCounters(EngineEvaluationCounters counters) {
        this.counters = counters;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ShadowGuard(@Lazy AuthorizationEngineService engine) {
        this.engine = engine;
    }

    /** The resource types decided by the engine alone through this gate; also read by the policy editor to know that a policy of the type is decided by its relations, not its actors. */
    private static final java.util.Set<String> ENGINE_DECIDES = java.util.Set.of("UNCONTROLLED_COPY", "ACCESS_REVIEW_CAMPAIGN", "AUDIT_REVIEW_CAMPAIGN", "REPORT_SCHEDULE", "REPORT_RUN", "REPORT_ARTIFACT", "TRAINING_ASSESSMENT", "TRAINING_JOB_ASSIGNMENT", "TRAINING_PERSONNEL_REVIEW", "TRAINING_RECORD", "TRAINING_SUSPENSION", "TRAINING_VENDOR", "TRAINING_PARTICIPANT", "TRAINING_ACTIVITY", "TRAINING_REQUIREMENT", "TRAINING_MATRIX_VERSION", "TRAINING_RECORD_EXPORT", "TRAINING_RECORD_EXPORT_BATCH", "TRAINING_TRAINER_EXCEPTION");

    public static boolean engineDecides(String resourceType) {
        return resourceType != null && ENGINE_DECIDES.contains(resourceType); // Set.of(...).contains(null) throws
    }

    /** The refusal of the engine for a step; null when the step may go on to the service. */
    public static RuntimeException refusalWhenEngineDecides(AuthorizationEngineService engine, UserAccount actor, String resourceType, UUID id, String action, EngineEvaluationCounters counters) {
        if (engine == null) return new IllegalStateException("The authorization engine is not available");
        AuthorizationDecision decision;
        try {
            decision = engine.authorize(AuthorizationRequest.of(actor, resourceType, id, action));
        } catch (RuntimeException failure) {
            if (counters != null) counters.record(resourceType, action, false);
            return new org.springframework.security.access.AccessDeniedException("AUTHORIZATION_ENGINE_ERROR");
        }
        if (counters != null) counters.record(resourceType, action, decision.allowed());
        if (decision.allowed()) return null;
        // a record that does not exist has no state: the service answers not found
        if (decision.resourceState() == null && "POLICY_NOT_CONFIGURED".equals(decision.reasonCode())) return null;
        return refusalOf(decision);
    }

    public static org.springframework.security.access.AccessDeniedException refusalOf(AuthorizationDecision decision) {
        return new org.springframework.security.access.AccessDeniedException(decision.reasonCode());
    }

    public <T> T around(UserAccount actor, String resourceType, UUID id, String action, Predicate<RuntimeException> unused, Supplier<T> step) {
        RuntimeException refusal = refusalWhenEngineDecides(engine, actor, resourceType, id, action, counters);
        if (refusal != null) throw refusal;
        return step.get();
    }

    /** For a step that returns nothing. */
    public void run(UserAccount actor, String resourceType, UUID id, String action, Predicate<RuntimeException> unused, Runnable step) {
        around(actor, resourceType, id, action, unused, () -> {
            step.run();
            return null;
        });
    }

    /** The failures of the Report, Access Review and Audit Review services that are about who may act: a SecurityException or an AccessDeniedException. */
    public static boolean isDenial(RuntimeException failure) {
        return failure instanceof SecurityException || failure instanceof org.springframework.security.access.AccessDeniedException;
    }
}

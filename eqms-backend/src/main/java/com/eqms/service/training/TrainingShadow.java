package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * The gate of a Training Management step in front of the Hybrid engine (the historical name comes from the time the engine was only asked in the shadow; that mode was removed
 * 2026-11-20). The engine is the only decision about who may act and it fails closed, see {@link com.eqms.service.authorization.ShadowGuard}. The boolean argument of {@code around} is no
 * longer read; it stays so that the call sites do not have to change in the same step.
 */
@Component
public class TrainingShadow {
    private final AuthorizationEngineService engine;
    private com.eqms.service.authorization.EngineEvaluationCounters counters;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setCounters(com.eqms.service.authorization.EngineEvaluationCounters counters) {
        this.counters = counters;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TrainingShadow(@Lazy AuthorizationEngineService engine) {
        this.engine = engine;
    }

    public <T> T around(UserAccount actor, String resourceType, UUID id, String action, boolean unused, Supplier<T> step) {
        RuntimeException refusal = com.eqms.service.authorization.ShadowGuard.refusalWhenEngineDecides(engine, actor, resourceType, id, action, counters);
        if (refusal != null) throw refusal;
        return step.get();
    }
}

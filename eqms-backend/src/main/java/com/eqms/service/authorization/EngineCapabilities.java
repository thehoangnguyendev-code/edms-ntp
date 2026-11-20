package com.eqms.service.authorization;

import com.eqms.entity.UserAccount;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * What a screen offers to a person for a record, from the Hybrid engine: the buttons follow the same decision that will be made when the person presses one (the capability maps of the services
 * are hints, never authorization). For each key of a capability map that names an engine action:
 * <ul>
 *   <li>{@code replace}: the key is exactly what the engine says (the old hint was only permission, scope and state, which the policy now holds);</li>
 *   <li>{@code and}: the old hint also holds a condition of the business that the engine does not know (an item is listed, a list is not yet confirmed), so the key stays off unless both agree.</li>
 * </ul>
 * An engine that is not there or fails leaves the hints as they were: this is a hint, the step itself fails closed in {@link ShadowGuard}.
 */
@Component
public class EngineCapabilities {
    private final AuthorizationEngineService engine;

    public EngineCapabilities(@Lazy AuthorizationEngineService engine) {
        this.engine = engine;
    }

    public Map<String, Object> apply(UserAccount actor, String resourceType, UUID id, Map<String, Object> capabilities, Map<String, String> replace, Map<String, String> and) {
        if (engine == null || actor == null || id == null || capabilities == null) return capabilities;
        Map<String, Object> out = new LinkedHashMap<>(capabilities);
        replace.forEach((key, action) -> {
            if (out.containsKey(key)) out.put(key, allowed(actor, resourceType, id, action));
        });
        and.forEach((key, action) -> {
            if (Boolean.TRUE.equals(out.get(key))) out.put(key, allowed(actor, resourceType, id, action));
        });
        return out;
    }

    private boolean allowed(UserAccount actor, String resourceType, UUID id, String action) {
        try {
            return engine.authorize(AuthorizationRequest.of(actor, resourceType, id, action)).allowed();
        } catch (RuntimeException failure) {
            return false; // a hint that cannot be decided is not offered
        }
    }
}

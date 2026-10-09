package com.eqms.backup.agent.policy;

import java.util.Set;

/** What a backup needs to know from the active policy: which components to back up and which targets to copy to. */
public record PolicyView(int version, Set<String> components, Set<String> targetCodes) {

    public boolean includes(String component) {
        return components.contains(component);
    }
}

package com.eqms.backup.agent.target;

import com.eqms.backup.agent.config.AgentProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Every target this agent is configured with: T1 (the local folder) followed by the extra ones. */
@Component
public class TargetCatalog {

    private final List<BackupTarget> all = new ArrayList<>();

    public TargetCatalog(AgentProperties properties, TargetRegistry registry) {
        all.add(new FolderTarget("T1", properties.getTargets().getT1(), false));
        all.addAll(registry.all());
    }

    public List<BackupTarget> all() {
        return all;
    }

    public Optional<BackupTarget> find(String code) {
        return all.stream().filter(t -> t.code().equalsIgnoreCase(code)).findFirst();
    }
}

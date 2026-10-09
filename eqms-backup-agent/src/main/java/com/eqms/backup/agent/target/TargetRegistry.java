package com.eqms.backup.agent.target;

import com.eqms.backup.agent.config.AgentProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** The configured extra targets (T2, T3, ...). T1, the local folder, is written by the backup itself. */
@Component
public class TargetRegistry {

    /** Buckets of the live system: a backup copy must never be written into them or read as if it were one. */
    private static final Set<String> LIVE_BUCKETS = Set.of("eqms-gmp-records", "eqms-gmp-revisions", "eqms-templates",
            "eqms-test-gmp-records", "eqms-test-gmp-revisions", "eqms-test-templates",
            "eqms-prod-gmp-records", "eqms-prod-gmp-revisions", "eqms-prod-templates");

    private final List<BackupTarget> targets;

    @Autowired
    public TargetRegistry(AgentProperties properties) {
        this.targets = build(properties);
    }

    public TargetRegistry(List<BackupTarget> targets) {
        this.targets = List.copyOf(targets);
    }

    static List<BackupTarget> build(AgentProperties properties) {
        List<BackupTarget> built = new ArrayList<>();
        Set<String> seen = new java.util.HashSet<>();
        for (java.util.Map.Entry<String, AgentProperties.Extra> entry : properties.getTargets().getExtra().entrySet()) {
            AgentProperties.Extra extra = entry.getValue();
            String code = entry.getKey() == null ? "" : entry.getKey().trim().toUpperCase(Locale.ROOT);
            if (extra.getCode() != null && !extra.getCode().isBlank() && !extra.getCode().trim().equalsIgnoreCase(code)) {
                throw new IllegalStateException("Target " + code + " is configured with the code " + extra.getCode());
            }
            if (!code.matches("T[2-9]")) throw new IllegalStateException("A target code must be T2 to T9, not '" + entry.getKey() + "'");
            if (!seen.add(code)) throw new IllegalStateException("Target " + code + " is configured twice");
            String kind = extra.getKind() == null ? "" : extra.getKind().trim().toUpperCase(Locale.ROOT);
            switch (kind) {
                case "FOLDER" -> {
                    if (extra.getPath() == null) throw new IllegalStateException("Target " + code + " needs a path");
                    if (extra.getPath().toAbsolutePath().normalize().equals(properties.getTargets().getT1().toAbsolutePath().normalize())) {
                        throw new IllegalStateException("Target " + code + " is the same folder as T1");
                    }
                    built.add(new FolderTarget(code, extra.getPath(), extra.isImmutable()));
                }
                case "S3" -> {
                    String bucket = extra.getBucket() == null ? "" : extra.getBucket().trim();
                    if (bucket.isEmpty() || extra.getEndpoint() == null || extra.getEndpoint().isBlank()) {
                        throw new IllegalStateException("Target " + code + " needs an endpoint and a bucket");
                    }
                    if (LIVE_BUCKETS.contains(bucket)) {
                        throw new IllegalStateException("Target " + code + " points at the live bucket " + bucket + "; a backup copy may not be stored there");
                    }
                    built.add(new S3Target(code, extra.getEndpoint(), extra.getAccessKey(), extra.getSecretKey(), bucket, extra.isImmutable()));
                }
                default -> throw new IllegalStateException("Target " + code + " has an unknown kind '" + extra.getKind() + "'");
            }
        }
        return built;
    }

    public List<BackupTarget> all() {
        return targets;
    }
}

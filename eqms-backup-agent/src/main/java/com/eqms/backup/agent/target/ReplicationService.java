package com.eqms.backup.agent.target;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.ledger.LedgerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Copies a finished backup set to every extra target and reads each file back to compare its SHA-256 (SDS section 8). The set
 * is already encrypted and signed, so a copy never exposes plain data. One target failing does not fail the backup: the copy is
 * recorded as not confirmed and an alert is raised, because the 3-2-1-1 rule is then not met.
 */
@Service
public class ReplicationService {

    private static final Logger log = LoggerFactory.getLogger(ReplicationService.class);

    public record Outcome(String target, boolean ok, String detail) {
    }

    private final TargetRegistry registry;
    private final BackupRepository repository;
    private final LedgerService ledger;

    public ReplicationService(TargetRegistry registry, BackupRepository repository, LedgerService ledger) {
        this.registry = registry;
        this.repository = repository;
        this.ledger = ledger;
    }

    public List<Outcome> replicate(UUID runId, String backupNumber, Path setDir, String keyPrefix, Path envRoot, java.util.Set<String> wanted) {
        List<Outcome> outcomes = new ArrayList<>();
        // a target the policy names but the agent does not have is a failure to copy, never a silent skip
        for (String code : wanted) {
            if (!"T1".equals(code) && registry.all().stream().noneMatch(t -> t.code().equals(code))) {
                outcomes.add(new Outcome(code, false, "Target " + code + " is in the policy but not configured on the agent"));
                repository.insertLocation(runId, code, "(not configured)", Instant.now(), null, false);
                ledger.append("agent", "BACKUP_COPY_FAILED", backupNumber, Map.of("target", code, "ok", false, "detail", "not configured"));
                repository.insertAlert("HIGH", "BACKUP_COPY_FAILED", "Backup " + backupNumber + " could not be copied to " + code + ": the target is in the policy but not configured on the agent", backupNumber);
            }
        }
        for (BackupTarget target : registry.all()) {
            if (!wanted.contains(target.code())) continue;
            Outcome outcome = copy(target, backupNumber, setDir, keyPrefix, envRoot);
            outcomes.add(outcome);
            repository.insertLocation(runId, target.code(), target.describe(keyPrefix + "/" + backupNumber), Instant.now(), outcome.ok() ? "ALL_FILES_MATCH" : null, outcome.ok());
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("target", target.code());
            data.put("ok", outcome.ok());
            if (!outcome.ok()) data.put("detail", outcome.detail());
            ledger.append("agent", outcome.ok() ? "BACKUP_COPIED" : "BACKUP_COPY_FAILED", backupNumber, data);
            if (!outcome.ok()) {
                repository.insertAlert("HIGH", "BACKUP_COPY_FAILED", "Backup " + backupNumber + " could not be copied to " + target.code() + ": " + outcome.detail(), backupNumber);
            }
        }
        return outcomes;
    }

    private Outcome copy(BackupTarget target, String backupNumber, Path setDir, String keyPrefix, Path envRoot) {
        Path scratch = null;
        try (Stream<Path> walk = Files.walk(setDir)) {
            List<Path> files = walk.filter(Files::isRegularFile).sorted().toList();
            scratch = Files.createTempFile("replica-", ".bin");
            for (Path file : files) {
                String key = keyPrefix + "/" + backupNumber + "/" + setDir.relativize(file).toString().replace('\\', '/');
                target.put(key, file);
                target.get(key, scratch);
                if (!sha(file).equals(sha(scratch))) {
                    return new Outcome(target.code(), false, "The copy of " + key + " differs from the original");
                }
            }
            int blobsCopied = copyMissingBlobs(target, envRoot, scratch);
            return new Outcome(target.code(), true, files.size() + " files, " + blobsCopied + " stored documents");
        } catch (IOException | RuntimeException e) {
            log.warn("Copy of {} to {} failed", backupNumber, target.code(), e);
            return new Outcome(target.code(), false, e.getMessage());
        } finally {
            try {
                if (scratch != null) Files.deleteIfExists(scratch);
            } catch (IOException ignored) {
                // temporary file only
            }
        }
    }

    /**
     * Brings the document pool of a target up to date: every stored version it does not hold yet is copied and read back against
     * the SHA-256 recorded when it was stored. Because it works from the full list, a target added later, or one that missed an
     * earlier backup, catches up on the next run.
     */
    private int copyMissingBlobs(BackupTarget target, Path envRoot, Path scratch) throws IOException {
        List<BackupRepository.Blob> blobs = repository.allBlobs();
        if (blobs.isEmpty() || envRoot == null) return 0;
        String env = envRoot.getFileName().toString();
        java.util.Set<String> have = new java.util.HashSet<>(target.list(env + "/objects"));
        int copied = 0;
        for (BackupRepository.Blob blob : blobs) {
            String key = env + "/" + blob.path();
            if (have.contains(key)) continue;
            Path local = envRoot.resolve(blob.path());
            if (!sha(local).equals(blob.cipherSha256())) {
                throw new IOException("The stored document " + blob.path() + " on T1 no longer matches its recorded SHA-256");
            }
            target.put(key, local);
            target.get(key, scratch);
            if (!sha(scratch).equals(blob.cipherSha256())) {
                throw new IOException("The copy of " + key + " differs from the original");
            }
            copied++;
        }
        return copied;
    }

    private static String sha(Path file) throws IOException {
        try (var in = Files.newInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1 << 16];
            int read;
            while ((read = in.read(buffer)) > 0) digest.update(buffer, 0, read);
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

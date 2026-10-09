package com.eqms.backup.agent.objects;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.ledger.CanonicalJson;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Backs up the document store (SDS section 20.2). Every version of every object is stored once, encrypted, in a shared pool
 * under the target's environment folder; a backup only copies versions it has not stored before and records the complete list
 * ("full view") in an encrypted index. A delete marker is listed but has no content. A version that was stored earlier and is
 * no longer listed is reported: the store is locked, so that should never happen.
 */
@Service
public class ObjectBackupService {

    public static final class ObjectBackupException extends Exception {
        public final String code;

        public ObjectBackupException(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    /** What a backup learns from this step; the manifest and the ledger are built from it. */
    public record Result(Instant listedAt, Path indexFile, String indexSha256, long indexBytes, long totalVersions, long newVersions, long newBytes,
                         long deleteMarkers, List<String> buckets, List<String> missingInSource) {
    }

    private static final int ATTEMPTS = 3;

    private final AgentProperties properties;
    private final ObjectSource source;
    private final BackupRepository repository;
    private final CommandRunner runner;
    private final GpgKeyring keyring;
    private long retryDelayMillis = 500;

    public ObjectBackupService(AgentProperties properties, ObjectSource source, BackupRepository repository, CommandRunner runner, GpgKeyring keyring) {
        this.properties = properties;
        this.source = source;
        this.repository = repository;
        this.runner = runner;
        this.keyring = keyring;
    }

    public boolean enabled() {
        return properties.getObjects().isEnabled();
    }

    public void retryDelayMillis(long millis) {
        this.retryDelayMillis = millis;
    }

    /**
     * @param envRoot the environment folder of T1 (the pool lives under {@code objects/} in it)
     * @param setDir  the unfinished backup folder, which receives {@code objects/index.json.gpg}
     */
    public Result run(UUID runId, Path envRoot, Path setDir) throws ObjectBackupException {
        if (properties.getObjects().getBuckets().isEmpty()) {
            throw new ObjectBackupException("BACKUP_OBJECT_CONFIG", "No bucket is configured for the object backup");
        }
        Instant listedAt = Instant.now();
        List<ObjectSource.Version> listed;
        try {
            listed = source.listVersions();
        } catch (IOException e) {
            throw new ObjectBackupException("BACKUP_SOURCE_UNAVAILABLE", e.getMessage());
        }

        Map<String, BackupRepository.Blob> known = new HashMap<>();
        for (BackupRepository.Blob blob : repository.allBlobs()) known.put(id(blob.bucket(), blob.key(), blob.versionId()), blob);

        List<ObjectSource.Version> toCopy = new ArrayList<>();
        long expected = 0;
        for (ObjectSource.Version v : listed) {
            if (!v.deleteMarker() && !known.containsKey(id(v.bucket(), v.key(), v.versionId()))) {
                toCopy.add(v);
                expected += Math.max(0, v.size());
            }
        }
        try {
            Files.createDirectories(envRoot);
            long usable = Files.getFileStore(envRoot).getUsableSpace();
            long needed = (long) (expected * 1.1) + properties.getMinFreeBytes();
            if (usable < needed) {
                throw new ObjectBackupException("BACKUP_INSUFFICIENT_SPACE", "The target has " + usable + " bytes free; the new documents need about " + needed);
            }
        } catch (IOException e) {
            throw new ObjectBackupException("BACKUP_TARGET_UNAVAILABLE", "The target cannot be used: " + e.getMessage());
        }

        long newBytes = 0;
        for (ObjectSource.Version v : toCopy) {
            BackupRepository.Blob blob = copy(v, runId, envRoot);
            repository.insertBlob(blob);
            known.put(id(v.bucket(), v.key(), v.versionId()), blob);
            newBytes += blob.cipherSize();
        }

        // the full view: everything listed now, plus everything stored before that is no longer listed (reported)
        List<Map<String, Object>> entries = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        long markers = 0;
        for (ObjectSource.Version v : listed) {
            String id = id(v.bucket(), v.key(), v.versionId());
            seen.add(id);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("bucket", v.bucket());
            entry.put("key", v.key());
            entry.put("versionId", v.versionId());
            entry.put("latest", v.latest());
            entry.put("deleteMarker", v.deleteMarker());
            if (v.deleteMarker()) {
                markers++;
            } else {
                BackupRepository.Blob blob = known.get(id);
                entry.put("size", blob.plainSize());
                entry.put("sha256", blob.plainSha256());
                entry.put("blob", blob.path());
            }
            entries.add(entry);
        }
        List<String> missing = new ArrayList<>();
        for (Map.Entry<String, BackupRepository.Blob> e : known.entrySet()) {
            if (seen.contains(e.getKey())) continue;
            BackupRepository.Blob b = e.getValue();
            missing.add(b.bucket() + "/" + b.key() + "@" + b.versionId());
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("bucket", b.bucket());
            entry.put("key", b.key());
            entry.put("versionId", b.versionId());
            entry.put("latest", false);
            entry.put("deleteMarker", false);
            entry.put("missingInSource", true);
            entry.put("size", b.plainSize());
            entry.put("sha256", b.plainSha256());
            entry.put("blob", b.path());
            entries.add(entry);
        }
        entries.sort(java.util.Comparator.comparing((Map<String, Object> m) -> (String) m.get("bucket")).thenComparing(m -> (String) m.get("key")).thenComparing(m -> (String) m.get("versionId")));

        Map<String, Object> index = new LinkedHashMap<>();
        index.put("schema", "eqms-object-index/1");
        index.put("listedAt", listedAt.toString());
        index.put("buckets", properties.getObjects().getBuckets());
        index.put("versions", entries);
        Path indexFile = setDir.resolve("objects").resolve("index.json.gpg");
        Path plain = null;
        try {
            Files.createDirectories(indexFile.getParent());
            plain = Files.createTempFile("object-index-", ".json");
            Files.writeString(plain, CanonicalJson.of(index), StandardCharsets.UTF_8);
            try (InputStream in = Files.newInputStream(plain)) {
                CommandRunner.StreamResult encrypted = runner.encryptStream(in, keyring.encryptCommand(), indexFile, 600);
                if (!encrypted.ok()) {
                    throw new ObjectBackupException("BACKUP_ENCRYPTION_FAILED", "The object index could not be encrypted: " + encrypted.stderrTail());
                }
                return new Result(listedAt, indexFile, encrypted.cipherSha256(), encrypted.cipherBytes(), entries.size(), toCopy.size(), newBytes, markers,
                        properties.getObjects().getBuckets(), missing);
            }
        } catch (IOException e) {
            throw new ObjectBackupException("BACKUP_TARGET_UNAVAILABLE", "The object index could not be written: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ObjectBackupException("BACKUP_INTERRUPTED", "The backup was interrupted");
        } finally {
            try {
                if (plain != null) Files.deleteIfExists(plain);
            } catch (IOException ignored) {
                // temporary file only
            }
        }
    }

    /** Reads one version, encrypts it into the pool and returns what was stored. The network is retried; an integrity problem is not. */
    private BackupRepository.Blob copy(ObjectSource.Version v, UUID runId, Path envRoot) throws ObjectBackupException {
        String name = hash(v.bucket() + "\0" + v.key() + "\0" + v.versionId());
        String relative = "objects/" + v.bucket() + "/" + name.substring(0, 2) + "/" + name + ".gpg";
        Path destination = envRoot.resolve(relative);
        Path partial = destination.resolveSibling(name + ".partial");
        IOException last = null;
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
                Files.createDirectories(destination.getParent());
                Files.deleteIfExists(partial);
                CommandRunner.StreamResult result;
                try (InputStream in = source.open(v)) {
                    result = runner.encryptStream(in, keyring.encryptCommand(), partial, 3600);
                }
                if (!result.ok()) {
                    Files.deleteIfExists(partial);
                    throw new ObjectBackupException("BACKUP_ENCRYPTION_FAILED", "Object " + v.bucket() + "/" + v.key() + " could not be encrypted: " + result.stderrTail());
                }
                if (v.size() >= 0 && result.plainBytes() != v.size()) {
                    Files.deleteIfExists(partial);
                    throw new ObjectBackupException("BACKUP_OBJECT_SIZE_MISMATCH", "Object " + v.bucket() + "/" + v.key() + " was listed with " + v.size() + " bytes but " + result.plainBytes() + " were read");
                }
                Files.move(partial, destination, StandardCopyOption.ATOMIC_MOVE);
                return new BackupRepository.Blob(v.bucket(), v.key(), v.versionId(), result.plainSha256(), result.plainBytes(), result.cipherSha256(), result.cipherBytes(), relative, runId);
            } catch (IOException e) {
                last = e;
                try {
                    Files.deleteIfExists(partial);
                } catch (IOException ignored) {
                    // the partial file is never listed
                }
                if (attempt < ATTEMPTS) {
                    try {
                        Thread.sleep(retryDelayMillis * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new ObjectBackupException("BACKUP_INTERRUPTED", "The backup was interrupted");
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ObjectBackupException("BACKUP_INTERRUPTED", "The backup was interrupted");
            }
        }
        throw new ObjectBackupException("BACKUP_OBJECT_READ_FAILED", "Object " + v.bucket() + "/" + v.key() + " could not be read after " + ATTEMPTS + " attempts: " + (last == null ? "" : last.getMessage()));
    }

    private static String id(String bucket, String key, String versionId) {
        return bucket + "\0" + key + "\0" + versionId;
    }

    private static String hash(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

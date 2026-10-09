package com.eqms.backup.agent;

import com.eqms.backup.agent.objects.ObjectSource;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** An in-memory document store with versions, delete markers and switchable failures. */
final class FakeObjectSource implements ObjectSource {

    final List<Version> versions = new ArrayList<>();
    final Map<String, byte[]> content = new HashMap<>();
    boolean listFails;
    /** Number of reads that fail before one succeeds; a negative value fails every read. */
    int failReads;
    int opened;

    Version add(String bucket, String key, String versionId, String text, boolean latest) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        Version v = new Version(bucket, key, versionId, bytes.length, false, latest, Instant.now());
        versions.add(v);
        content.put(bucket + "/" + key + "@" + versionId, bytes);
        return v;
    }

    void addDeleteMarker(String bucket, String key, String versionId) {
        versions.add(new Version(bucket, key, versionId, 0, true, true, Instant.now()));
    }

    @Override
    public List<Version> listVersions() throws IOException {
        if (listFails) throw new IOException("connection refused");
        return List.copyOf(versions);
    }

    @Override
    public InputStream open(Version v) throws IOException {
        opened++;
        if (failReads < 0 || failReads > 0) {
            if (failReads > 0) failReads--;
            throw new IOException("connection reset");
        }
        return new ByteArrayInputStream(content.get(v.bucket() + "/" + v.key() + "@" + v.versionId()));
    }
}

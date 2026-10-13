package com.eqms.backup.agent;

import com.eqms.backup.agent.objects.TestObjectStore;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** A stand-in for the test-bucket store: versioned, keeps every version's bytes, and refuses a bucket that exists. */
class InMemoryTestObjectStore implements TestObjectStore {

    private final Map<String, Map<String, byte[]>> buckets = new HashMap<>();

    @Override
    public void createVersionedBucket(String bucket) throws IOException {
        if (buckets.containsKey(bucket)) throw new IOException("The test bucket " + bucket + " already exists");
        buckets.put(bucket, new HashMap<>());
    }

    @Override
    public String put(String bucket, String key, Path file) throws IOException {
        Map<String, byte[]> store = require(bucket);
        String version = UUID.randomUUID().toString();
        store.put(key + "\0" + version, Files.readAllBytes(file));
        return version;
    }

    @Override
    public List<Stored> listVersions(String bucket) throws IOException {
        List<Stored> out = new ArrayList<>();
        for (String id : require(bucket).keySet()) {
            int at = id.indexOf('\0');
            out.add(new Stored(id.substring(0, at), id.substring(at + 1)));
        }
        return out;
    }

    @Override
    public InputStream open(String bucket, String key, String versionId) throws IOException {
        byte[] bytes = require(bucket).get(key + "\0" + versionId);
        if (bytes == null) throw new IOException("No version " + versionId + " of " + key + " in " + bucket);
        return new ByteArrayInputStream(bytes);
    }

    @Override
    public void removeBucket(String bucket) throws IOException {
        require(bucket);
        buckets.remove(bucket);
    }

    /** Whether a bucket still exists (for the clean-up assertion). */
    boolean exists(String bucket) {
        return buckets.containsKey(bucket);
    }

    private Map<String, byte[]> require(String bucket) throws IOException {
        Map<String, byte[]> store = buckets.get(bucket);
        if (store == null) throw new IOException("No test bucket " + bucket);
        return store;
    }
}

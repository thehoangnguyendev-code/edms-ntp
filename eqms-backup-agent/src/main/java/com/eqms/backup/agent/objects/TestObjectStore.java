package com.eqms.backup.agent.objects;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.List;

/**
 * The object store the restore worker writes to during a test restore (SDS 14.1, WP3.1 slice 4). It works only on the throw-away
 * buckets of one restore; the records and template buckets are never reached from here.
 */
public interface TestObjectStore {

    /** One stored version of an object: its key and its version id. */
    record Stored(String key, String versionId) {
    }

    /** Creates a bucket with versioning on. Refuses a bucket that already exists. */
    void createVersionedBucket(String bucket) throws IOException;

    /** Stores the file under the key and returns the version id MinIO gives it. */
    String put(String bucket, String key, Path file) throws IOException;

    /** Every stored version in the bucket, delete markers excluded. */
    List<Stored> listVersions(String bucket) throws IOException;

    /** The bytes of one version. */
    InputStream open(String bucket, String key, String versionId) throws IOException;

    /** Removes every version of every object, then the bucket. */
    void removeBucket(String bucket) throws IOException;
}

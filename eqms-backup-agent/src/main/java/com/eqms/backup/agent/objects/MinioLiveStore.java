package com.eqms.backup.agent.objects;

import com.eqms.backup.agent.restore.MissingFileRestorer;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import io.minio.UploadObjectArgs;
import io.minio.Result;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.Item;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Set;

/**
 * The live file store for a production restore, through the restore writer's own MinIO account. That account may read, list and add
 * object versions in the allowed buckets only; the policy denies deleting, changing versioning and removing buckets. This class
 * adds the same limit on the agent side: it never calls a delete, and it writes only to the listed buckets.
 */
public class MinioLiveStore implements MissingFileRestorer.LiveStore {

    private final MinioClient client;
    private final Set<String> writable;

    public MinioLiveStore(String endpoint, String accessKey, String secretKey, Set<String> writableBuckets) {
        this.client = MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
        this.writable = Set.copyOf(writableBuckets);
    }

    @Override
    public Set<String> writableBuckets() {
        return writable;
    }

    @Override
    public boolean hasVersion(String bucket, String key, String versionId) throws IOException {
        try {
            if (versionId != null) {
                client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).versionId(versionId).build());
                return true;
            }
            for (Result<Item> r : client.listObjects(ListObjectsArgs.builder().bucket(bucket).prefix(key).recursive(true).includeVersions(true).build())) {
                Item item = r.get();
                if (key.equals(item.objectName()) && !item.isDeleteMarker()) return true;
            }
            return false;
        } catch (ErrorResponseException e) {
            String code = e.errorResponse().code();
            if ("NoSuchKey".equals(code) || "NoSuchVersion".equals(code) || "NotFound".equals(code)) return false;
            // a delete marker answers "MethodNotAllowed" for a version id: that version is not a readable file
            if ("MethodNotAllowed".equals(code)) return false;
            // a bucket this account cannot see, or that does not exist, holds no version it can vouch for
            if ("AccessDenied".equals(code) || "NoSuchBucket".equals(code)) return false;
            // a version id that is not even well formed names no stored version
            if (versionId != null && ("BadRequest".equals(code) || "InvalidArgument".equals(code))) return false;
            throw new IOException("The file store refused to answer for " + bucket + "/" + key + ": " + code, e);
        } catch (Exception e) {
            throw new IOException("The file store could not be asked about " + bucket + "/" + key + ": " + e.getMessage(), e);
        }
    }

    @Override
    public long sizeOf(String bucket, String key, String versionId) throws IOException {
        try {
            var args = StatObjectArgs.builder().bucket(bucket).object(key);
            if (versionId != null) args.versionId(versionId);
            return client.statObject(args.build()).size();
        } catch (Exception e) {
            throw new IOException("The size of " + bucket + "/" + key + " could not be read: " + e.getMessage(), e);
        }
    }

    @Override
    public String sha256Of(String bucket, String key, String versionId) throws IOException {
        try {
            var args = io.minio.GetObjectArgs.builder().bucket(bucket).object(key);
            if (versionId != null) args.versionId(versionId);
            try (java.io.InputStream in = client.getObject(args.build())) {
                java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
                byte[] buffer = new byte[1 << 16];
                int read;
                while ((read = in.read(buffer)) >= 0) digest.update(buffer, 0, read);
                return java.util.HexFormat.of().formatHex(digest.digest());
            }
        } catch (Exception e) {
            throw new IOException("The content of " + bucket + "/" + key + " could not be read: " + e.getMessage(), e);
        }
    }

    @Override
    public String put(String bucket, String key, Path file) throws IOException {
        if (!writable.contains(bucket)) throw new IOException("Refusing to write to bucket " + bucket);
        try {
            return client.uploadObject(UploadObjectArgs.builder().bucket(bucket).object(key).filename(file.toString()).build()).versionId();
        } catch (Exception e) {
            throw new IOException("File " + key + " could not be added to " + bucket + ": " + e.getMessage(), e);
        }
    }
}

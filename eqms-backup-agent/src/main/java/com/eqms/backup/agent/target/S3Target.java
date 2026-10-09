package com.eqms.backup.agent.target;

import io.minio.BucketExistsArgs;
import io.minio.DownloadObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.StatObjectArgs;
import io.minio.UploadObjectArgs;
import io.minio.errors.ErrorResponseException;
import io.minio.messages.Item;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** An S3-compatible bucket, for example a second MinIO with Object Lock. The bucket must already exist: the agent never creates one. */
public class S3Target implements BackupTarget {

    private final String code;
    private final MinioClient client;
    private final String bucket;
    private final boolean immutable;

    public S3Target(String code, String endpoint, String accessKey, String secretKey, String bucket, boolean immutable) {
        this.code = code;
        this.client = MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
        this.bucket = bucket;
        this.immutable = immutable;
    }

    @Override public String code() { return code; }
    @Override public String kind() { return "S3"; }
    @Override public boolean immutable() { return immutable; }
    @Override public String describe(String key) { return "s3://" + bucket + "/" + key; }

    public boolean bucketExists() throws IOException {
        try {
            return client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        } catch (Exception e) {
            throw new IOException("The bucket cannot be reached: " + e.getMessage(), e);
        }
    }

    @Override
    public void put(String key, Path file) throws IOException {
        try {
            client.uploadObject(UploadObjectArgs.builder().bucket(bucket).object(key).filename(file.toString()).build());
        } catch (Exception e) {
            throw new IOException("Upload of " + key + " failed: " + e.getMessage(), e);
        }
    }

    @Override
    public void get(String key, Path destination) throws IOException {
        Files.deleteIfExists(destination);
        try {
            client.downloadObject(DownloadObjectArgs.builder().bucket(bucket).object(key).filename(destination.toString()).build());
        } catch (Exception e) {
            throw new IOException("Download of " + key + " failed: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean exists(String key) throws IOException {
        try {
            client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build());
            return true;
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code())) return false;
            throw new IOException(e.getMessage(), e);
        } catch (Exception e) {
            throw new IOException(e.getMessage(), e);
        }
    }

    @Override
    public boolean tryDelete(String key) throws IOException {
        try {
            // Delete the stored version itself. A plain delete on a versioned bucket only adds a marker and proves nothing.
            String versionId = client.statObject(StatObjectArgs.builder().bucket(bucket).object(key).build()).versionId();
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).versionId(versionId).build());
            return true;
        } catch (ErrorResponseException e) {
            return false;
        } catch (Exception e) {
            throw new IOException(e.getMessage(), e);
        }
    }

    @Override
    public List<String> list(String prefix) throws IOException {
        List<String> keys = new ArrayList<>();
        try {
            for (Result<Item> result : client.listObjects(ListObjectsArgs.builder().bucket(bucket).prefix(prefix).recursive(true).build())) {
                keys.add(result.get().objectName());
            }
        } catch (Exception e) {
            throw new IOException(e.getMessage(), e);
        }
        return keys;
    }
}

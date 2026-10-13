package com.eqms.backup.agent.objects;

import com.eqms.backup.agent.config.AgentProperties;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.RemoveBucketArgs;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.SetBucketVersioningArgs;
import io.minio.UploadObjectArgs;
import io.minio.messages.Item;
import io.minio.messages.VersioningConfiguration;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** MinIO through the restore worker's own account, which may act only on the eqms-test-* buckets. */
@Component
public class MinioTestObjectStore implements TestObjectStore {

    private final AgentProperties.TestObjects settings;
    private MinioClient client;

    public MinioTestObjectStore(AgentProperties properties) {
        this.settings = properties.getRestore().getTestObjects();
    }

    private synchronized MinioClient client() {
        if (client == null) {
            client = MinioClient.builder().endpoint(settings.getEndpoint()).credentials(settings.getAccessKey(), settings.getSecretKey()).build();
        }
        return client;
    }

    private void requireTestBucket(String bucket) throws IOException {
        if (bucket == null || !bucket.startsWith(settings.getBucketPrefix()) || !bucket.matches("[a-z0-9][a-z0-9.-]{2,62}")) {
            throw new IOException("Refusing to use bucket " + bucket + ": only the throw-away test buckets may be written");
        }
    }

    @Override
    public void createVersionedBucket(String bucket) throws IOException {
        requireTestBucket(bucket);
        try {
            if (client().bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                throw new IOException("The test bucket " + bucket + " already exists");
            }
            client().makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            client().setBucketVersioning(SetBucketVersioningArgs.builder().bucket(bucket).config(new VersioningConfiguration(VersioningConfiguration.Status.ENABLED, null)).build());
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("The test bucket " + bucket + " could not be created: " + e.getMessage(), e);
        }
    }

    @Override
    public String put(String bucket, String key, Path file) throws IOException {
        requireTestBucket(bucket);
        try {
            var written = client().uploadObject(UploadObjectArgs.builder().bucket(bucket).object(key).filename(file.toString()).build());
            return written.versionId();
        } catch (Exception e) {
            throw new IOException("Object " + key + " could not be written to " + bucket + ": " + e.getMessage(), e);
        }
    }

    @Override
    public List<Stored> listVersions(String bucket) throws IOException {
        requireTestBucket(bucket);
        List<Stored> out = new ArrayList<>();
        try {
            for (Result<Item> result : client().listObjects(ListObjectsArgs.builder().bucket(bucket).recursive(true).includeVersions(true).build())) {
                Item item = result.get();
                if (!item.isDeleteMarker()) out.add(new Stored(item.objectName(), item.versionId()));
            }
        } catch (Exception e) {
            throw new IOException("The test bucket " + bucket + " could not be listed: " + e.getMessage(), e);
        }
        return out;
    }

    @Override
    public InputStream open(String bucket, String key, String versionId) throws IOException {
        requireTestBucket(bucket);
        try {
            return client().getObject(GetObjectArgs.builder().bucket(bucket).object(key).versionId(versionId).build());
        } catch (Exception e) {
            throw new IOException("Object " + key + " version " + versionId + " could not be read from " + bucket + ": " + e.getMessage(), e);
        }
    }

    @Override
    public void removeBucket(String bucket) throws IOException {
        requireTestBucket(bucket);
        try {
            for (Result<Item> result : client().listObjects(ListObjectsArgs.builder().bucket(bucket).recursive(true).includeVersions(true).build())) {
                Item item = result.get();
                client().removeObject(RemoveObjectArgs.builder().bucket(bucket).object(item.objectName()).versionId(item.versionId()).build());
            }
            client().removeBucket(RemoveBucketArgs.builder().bucket(bucket).build());
        } catch (Exception e) {
            throw new IOException("The test bucket " + bucket + " could not be removed: " + e.getMessage(), e);
        }
    }
}

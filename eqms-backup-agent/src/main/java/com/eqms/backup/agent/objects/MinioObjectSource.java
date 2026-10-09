package com.eqms.backup.agent.objects;

import com.eqms.backup.agent.config.AgentProperties;
import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.Result;
import io.minio.messages.Item;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Component
public class MinioObjectSource implements ObjectSource {

    private final AgentProperties.Objects settings;
    private MinioClient client;

    public MinioObjectSource(AgentProperties properties) {
        this.settings = properties.getObjects();
    }

    private synchronized MinioClient client() {
        if (client == null) {
            client = MinioClient.builder().endpoint(settings.getEndpoint()).credentials(settings.getAccessKey(), settings.getSecretKey()).build();
        }
        return client;
    }

    @Override
    public List<Version> listVersions() throws IOException {
        List<Version> out = new ArrayList<>();
        try {
            for (String bucket : settings.getBuckets()) {
                for (Result<Item> result : client().listObjects(ListObjectsArgs.builder().bucket(bucket).recursive(true).includeVersions(true).build())) {
                    Item item = result.get();
                    String versionId = item.versionId() == null || item.versionId().isEmpty() ? "null" : item.versionId();
                    out.add(new Version(bucket, item.objectName(), versionId, item.size(), item.isDeleteMarker(), item.isLatest(),
                            item.lastModified() == null ? null : item.lastModified().toInstant()));
                }
            }
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("The document store could not be listed: " + e.getMessage(), e);
        }
        return out;
    }

    @Override
    public InputStream open(Version version) throws IOException {
        try {
            GetObjectArgs.Builder args = GetObjectArgs.builder().bucket(version.bucket()).object(version.key());
            if (!"null".equals(version.versionId())) args.versionId(version.versionId());
            return client().getObject(args.build());
        } catch (Exception e) {
            throw new IOException("Object " + version.bucket() + "/" + version.key() + " could not be read: " + e.getMessage(), e);
        }
    }
}

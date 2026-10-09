package com.eqms.backup.agent.objects;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;

/** The document store as the agent sees it: list every version, open one version. Read only by construction. */
public interface ObjectSource {

    record Version(String bucket, String key, String versionId, long size, boolean deleteMarker, boolean latest, Instant lastModified) {
    }

    List<Version> listVersions() throws IOException;

    InputStream open(Version version) throws IOException;
}

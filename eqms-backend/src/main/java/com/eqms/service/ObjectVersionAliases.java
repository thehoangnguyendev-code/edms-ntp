package com.eqms.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Looks up the current MinIO version of an object whose original version id no longer exists after a restore (SDS 11.4.2). The
 * caller must still check the SHA-256 of the bytes it reads; this class only maps ids.
 */
@Component
public class ObjectVersionAliases {

    /** The copy's bucket is null when it is the same bucket as the original. */
    public record Alias(String currentBucket, String currentVersionId, String sha256) {
    }

    private final JdbcTemplate jdbc;

    public ObjectVersionAliases(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Alias> find(String bucket, String objectKey, String originalVersionId) {
        List<Alias> rows = jdbc.query("select current_bucket, current_version_id, sha256 from object_version_alias "
                        + "where bucket = ? and object_key = ? and original_version_id = ?",
                (rs, i) -> new Alias(rs.getString("current_bucket"), rs.getString("current_version_id"), rs.getString("sha256")),
                bucket, objectKey, originalVersionId);
        return rows.stream().findFirst();
    }
}

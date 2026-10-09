package com.eqms.backup.agent.target;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * A place a finished backup set is copied to (SDS section 8). Keys use forward slashes and are relative to the target root,
 * for example {@code DEV/2026/10/BK-.../manifest.json}. A target never sees plain data: only encrypted, signed files reach it.
 */
public interface BackupTarget {

    String code();

    /** FOLDER or S3. */
    String kind();

    /** True when the target is expected to refuse deletes of what was written (Object Lock or an equivalent). */
    boolean immutable();

    /** Human-readable place, shown on screens. */
    String describe(String key);

    void put(String key, Path file) throws IOException;

    /** Copies the stored file to {@code destination}. */
    void get(String key, Path destination) throws IOException;

    boolean exists(String key) throws IOException;

    /** Returns false when the target refused, which is the correct answer for an immutable target. */
    boolean tryDelete(String key) throws IOException;

    List<String> list(String prefix) throws IOException;
}

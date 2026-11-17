package com.eqms.service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Where a Recall by Scan upload is, so the screen's progress bar follows the real work of the server (virus scan, storing, reading the code,
 * matching) instead of showing 100% as soon as the bytes have been sent. The browser names each upload (a header with a random id); the service
 * reports each step under that id and the browser asks for it while the request runs. Kept in memory and per user: another user's id is never
 * readable, and an entry nobody asks for again is dropped after a few minutes. The bar is information only; nothing regulated depends on it.
 */
@Component
public class RecallUploadProgress {
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9-]{8,64}");
    private static final long KEEP_SECONDS = 600;

    /** The step the server is on: a code the screen can map, a sentence to show, and how far along the whole upload is (0-100). */
    public record Snapshot(String stage, String message, int percent) {
    }

    /** What the service calls as it works; the no-op one is used when the browser sent no id. */
    public interface Reporter {
        Reporter NONE = (stage, message, percent) -> { };

        void report(String stage, String message, int percent);
    }

    private record Entry(UUID userId, Snapshot snapshot, Instant at) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    public Reporter reporter(UUID userId, String uploadId) {
        if (userId == null || uploadId == null || !ID.matcher(uploadId).matches()) {
            return Reporter.NONE;
        }
        purge();
        return (stage, message, percent) -> {
            int bounded = Math.max(0, Math.min(100, percent));
            // never goes backwards, so a late report cannot pull the bar back
            entries.merge(key(userId, uploadId), new Entry(userId, new Snapshot(stage, message, bounded), Instant.now()),
                    (old, now) -> now.snapshot().percent() >= old.snapshot().percent() ? now : old);
        };
    }

    /** The current step of one upload of this user, or null when there is none (not started yet, finished long ago, or not theirs). */
    public Snapshot snapshot(UUID userId, String uploadId) {
        if (userId == null || uploadId == null || !ID.matcher(uploadId).matches()) {
            return null;
        }
        Entry entry = entries.get(key(userId, uploadId));
        return entry == null ? null : entry.snapshot();
    }

    private static String key(UUID userId, String uploadId) {
        return userId + ":" + uploadId;
    }

    private void purge() {
        Instant limit = Instant.now().minusSeconds(KEEP_SECONDS);
        entries.values().removeIf(entry -> entry.at().isBefore(limit));
    }
}

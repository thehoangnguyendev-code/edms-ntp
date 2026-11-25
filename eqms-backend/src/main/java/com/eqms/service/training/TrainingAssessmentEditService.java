package com.eqms.service.training;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Retired 2026-11-23 (owner decision): the exam file and the answer key of an activity are no longer written or edited by hand in OnlyOffice. They come only from an approved assessment of the
 * library ({@link TrainingAssessmentLibraryService#choose}), so that a test that was not approved cannot be put into a training. What stays is what the document server still asks for an edit session that
 * was opened before: its file, and the closing of the session. A save reported for such a session is not applied (see OnlyOfficeController).
 */
@Service
public class TrainingAssessmentEditService {
    private static final Logger log = LoggerFactory.getLogger(TrainingAssessmentEditService.class);

    private final JdbcTemplate jdbc;
    private final TrainingFileService files;

    public TrainingAssessmentEditService(JdbcTemplate jdbc, TrainingFileService files) {
        this.jdbc = jdbc;
        this.files = files;
    }

    /** What the document server fetches when it opens the session: the file as it was when the session started. */
    @Transactional(readOnly = true)
    public byte[] bytesForEditor(UUID sessionId) {
        Map<String, Object> s = jdbc.queryForList("select * from training_edit_sessions where id = ?", sessionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        return files.readStored(String.valueOf(s.get("provider")), String.valueOf(s.get("stored_path")), String.valueOf(s.get("sha256")));
    }

    /** A save reported by the document server for a session opened before the editor was retired: nothing is written into the activity and the session is closed. */
    @Transactional
    public void applySave(UUID sessionId, byte[] edited, UUID editorId, boolean closing) {
        log.warn("A save of the edit session {} was not applied: the exam and the answer key come only from an approved assessment of the library", sessionId);
        close(sessionId);
    }

    /** The last editor left (or the document server dropped the session): the session is closed. */
    @Transactional
    public void close(UUID sessionId) {
        jdbc.update("update training_edit_sessions set status = 'CLOSED' where id = ? and status = 'OPEN'", sessionId);
    }
}

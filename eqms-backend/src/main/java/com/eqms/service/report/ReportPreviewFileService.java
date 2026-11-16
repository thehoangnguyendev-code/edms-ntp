package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * REPORT-OUTPUT-PREVIEW-2026-11-16: the CSV or XLSX file that the Output step of Create Report shows in the read-only OnlyOffice viewer before the report is requested.
 * It is a working copy made as the report is made, for the person who is making it: kept until the report is complete (then removed) or until it expires, never in the
 * report storage (that storage cannot delete), and without an Audit Trail entry (owner decision). Nobody but its maker can open it.
 */
@Service
public class ReportPreviewFileService {
    private static final Logger log = LoggerFactory.getLogger(ReportPreviewFileService.class);
    /** A working copy that was never followed by a report is removed after this many hours. */
    public static final int KEEP_HOURS = 24;
    private static final int MAX_BYTES = 52_428_800;

    private final JdbcTemplate jdbc;
    private final ReportTemplateService templates;
    private final OnlyOfficeDocumentEditService onlyOffice;
    private final ObjectMapper json;

    public ReportPreviewFileService(JdbcTemplate jdbc, ReportTemplateService templates, OnlyOfficeDocumentEditService onlyOffice, ObjectMapper json) {
        this.jdbc = jdbc;
        this.templates = templates;
        this.onlyOffice = onlyOffice;
        this.json = json;
    }

    /** Makes (or replaces) the working copy of this person for this template and format, from the criteria on the screen. */
    public Map<String, Object> create(UserAccount actor, String code, ReportTemplateService.Criteria criteria, String title, String format, boolean full) throws Exception {
        var file = templates.previewFile(actor, code, criteria, title, format, full);
        if (file.bytes().length > MAX_BYTES) throw new IllegalArgumentException("REPORT_ARTIFACT_LIMIT_EXCEEDED");
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(file.bytes()));
        UUID id = UUID.randomUUID();
        // One working copy for each person, template and format: a new one replaces the old in one statement.
        UUID kept = jdbc.queryForObject("""
                insert into report_preview_files(id, user_id, definition_code, format, file_name, sha256, byte_size, content, expires_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, now() + (? * interval '1 hour'))
                on conflict (user_id, definition_code, format) do update
                  set id = excluded.id, file_name = excluded.file_name, sha256 = excluded.sha256, byte_size = excluded.byte_size,
                      content = excluded.content, created_at = now(), expires_at = excluded.expires_at
                returning id
                """, UUID.class, id, actor.getId(), code, format, file.fileName(), hash, (long) file.bytes().length, file.bytes(), KEEP_HOURS);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", kept);
        result.put("fileName", file.fileName());
        result.put("byteSize", file.bytes().length);
        result.put("keepHours", KEEP_HOURS);
        return result;
    }

    /** The read-only viewer config of the working copy; only the person who made it may ask. */
    public Map<String, Object> viewConfig(UserAccount actor, UUID id) {
        List<Map<String, Object>> rows = jdbc.queryForList("select user_id, file_name, sha256 from report_preview_files where id=? and expires_at > now()", id);
        if (rows.isEmpty()) throw new IllegalStateException("REPORT_PREVIEW_FILE_GONE");
        Map<String, Object> row = rows.getFirst();
        if (!actor.getId().toString().equals(String.valueOf(row.get("user_id")))) throw new SecurityException("REPORT_SCOPE_DENIED");
        @SuppressWarnings("unchecked")
        Map<String, Object> config = json.convertValue(onlyOffice.buildStoredFileViewConfig("report-preview", id, String.valueOf(row.get("sha256")), String.valueOf(row.get("file_name")), actor), Map.class);
        return config;
    }

    /** The bytes the document server fetches; it is authenticated by its signed token that names this file. */
    public byte[] bytesForViewer(UUID id) {
        List<byte[]> rows = jdbc.query("select content from report_preview_files where id=? and expires_at > now()", (rs, n) -> rs.getBytes(1), id);
        if (rows.isEmpty()) throw new IllegalStateException("REPORT_PREVIEW_FILE_GONE");
        return rows.getFirst();
    }

    /** The report of this person for this template is complete: their working copies of it are no longer needed. Never throws. */
    public void removeAfterRun(UUID userId, String definitionCode) {
        try {
            jdbc.update("delete from report_preview_files where user_id=? and definition_code=?", userId, definitionCode);
        } catch (Exception failure) {
            log.warn("The working copies of {} could not be removed: {}", definitionCode, failure.getMessage());
        }
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 120_000)
    public void purgeExpired() {
        try {
            int removed = jdbc.update("delete from report_preview_files where expires_at <= now()");
            if (removed > 0) log.info("{} expired report working copies removed", removed);
        } catch (Exception failure) {
            log.warn("Expired report working copies could not be removed: {}", failure.getMessage());
        }
    }
}

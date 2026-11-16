package com.eqms.service.export;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.*;
import java.util.function.BiConsumer;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * REPORT-BACKUP-RUNS-2026-11-15: the rows of the Backup History, Restore Rehearsals and Production Restores registers for the Excel export. The rows come from the Backup Agent, the same
 * answer as the screen (so the file holds what the screen holds, not a copy), page by page for the whole filtered list. A person needs backup.module.view, as for the screens. The file is
 * audited by {@link TableExcelExportService} with its checksum and its criteria.
 */
@Service
public class BackupTableExportSource {
    private static final String VIEW = "backup.module.view";
    private static final int PAGE = 100;
    private static final int MAX_PAGES = 1000;

    private final BackupAgentClient agent;
    private final CurrentUserService current;
    private final PermissionEvaluationService permissions;

    public BackupTableExportSource(BackupAgentClient agent, CurrentUserService current, PermissionEvaluationService permissions) {
        this.agent = agent;
        this.current = current;
        this.permissions = permissions;
    }

    public void writeBackups(Map<String, String> q, TableExcelWriter w) throws IOException {
        w.headers("Backup Number", "Type", "Trigger", "Status", "Started At", "Duration (s)", "Size (Bytes)", "Verification", "Verified At", "Created By", "Reason",
                "Change Control", "Retention", "Legal Hold", "Error Code", "Components");
        pages("/internal/backups", q, List.of("search", "status", "type", "verification", "trigger", "component", "startedFrom", "startedTo", "checkedFrom", "checkedTo"), "startedAt",
                (r, out) -> out.row(text(r, "id"), text(r, "type"), text(r, "trigger"), text(r, "status"), text(r, "startedAt"), number(r, "durationSec"), number(r, "sizeBytes"),
                        text(r, "verification"), text(r, "verifiedAt"), text(r, "createdBy"), text(r, "reason"), text(r, "changeControlRef"), text(r, "retention"),
                        r.path("legalHold").asBoolean(false) ? "Yes" : "No", text(r, "errorCode"), components(r.path("components"))), w);
    }

    public void writeRehearsals(Map<String, String> q, TableExcelWriter w) throws IOException {
        w.headers("Rehearsal", "Backup Number", "Status", "Requested By", "Reason", "Requested At", "Started At", "Finished At", "Restore Time (s)", "Error Code", "Checks", "Failed Checks");
        pages("/internal/rehearsals", q, List.of("search", "status", "backupNumber"), "requestedAt",
                (r, out) -> out.row(text(r, "rehearsalId"), text(r, "backupNumber"), text(r, "status"), text(r, "requestedBy"), text(r, "reason"), text(r, "requestedAt"), text(r, "startedAt"),
                        text(r, "finishedAt"), number(r, "restoreSeconds"), text(r, "errorCode"), number(r, "checkCount"), number(r, "failedCount")), w);
    }

    public void writeProductionRestores(Map<String, String> q, TableExcelWriter w) throws IOException {
        w.headers("Restore", "Backup Number", "Status", "Restored By", "Restore Signature", "Restored At", "Closed By", "Close Signature", "Closed At", "Components", "Previous Database", "Restored Database");
        pages("/internal/restores/production", q, List.of("search", "status", "part", "restoredFrom", "restoredTo", "closedFrom", "closedTo"), "restoredAt",
                (r, out) -> out.row(text(r, "run_code"), text(r, "backup_number"), text(r, "status"), text(r, "restored_by"), text(r, "restore_signature"), text(r, "restored_at"),
                        text(r, "closed_by"), text(r, "close_signature"), text(r, "closed_at"), text(r, "components"), text(r, "kept_old_db"), text(r, "post_db")), w);
    }

    /** Every page of the filtered list, in the order the screen would show. */
    private void pages(String path, Map<String, String> q, List<String> filters, String defaultSort, RowWriter row, TableExcelWriter w) throws IOException {
        if (!permissions.hasAnyPermission(current.requireCurrentUser(), VIEW)) throw new AccessDeniedException("Permission " + VIEW + " required");
        MultiValueMap<String, String> query = new LinkedMultiValueMap<>();
        for (String name : filters) {
            String value = q.get(name);
            if (value != null && !value.isBlank()) query.add(name, value.length() > 200 ? value.substring(0, 200) : value);
        }
        String sort = q.getOrDefault("sortBy", defaultSort);
        query.add("sortBy", sort.length() > 30 ? sort.substring(0, 30) : sort);
        query.add("sortDirection", "asc".equalsIgnoreCase(q.get("sortDirection")) ? "asc" : "desc");
        query.add("limit", String.valueOf(PAGE));
        for (int page = 1; page <= MAX_PAGES; page++) {
            query.set("page", String.valueOf(page));
            JsonNode body = agent.get(path, query);
            JsonNode data = body == null ? null : body.path("data");
            if (data == null || !data.isArray()) throw new IllegalStateException("BACKUP_EXPORT_UNAVAILABLE");
            for (JsonNode r : data) row.write(r, w);
            int totalPages = body.path("pagination").path("totalPages").asInt(page);
            if (page >= totalPages || data.isEmpty()) return;
        }
        throw new IllegalStateException("BACKUP_EXPORT_TOO_LARGE");
    }

    @FunctionalInterface private interface RowWriter { void write(JsonNode row, TableExcelWriter out) throws IOException; }

    private static String text(JsonNode r, String field) {
        JsonNode v = r.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.asText();
    }

    private static Object number(JsonNode r, String field) {
        JsonNode v = r.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.numberValue();
    }

    private static String components(JsonNode list) {
        if (!list.isArray()) return null;
        List<String> parts = new ArrayList<>();
        list.forEach(c -> parts.add(c.path("key").asText() + ": " + c.path("status").asText()));
        return String.join("; ", parts);
    }
}

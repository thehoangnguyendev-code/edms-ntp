package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.BackupRunSummarySyncService;
import com.eqms.service.PermissionEvaluationService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** REPORT-BACKUP-RUNS-2026-11-15: when the application last copied the summary of the backup and restore runs, so the report screens can say how current it is. */
@RestController
@RequestMapping("/reports/backup-copy-status")
public class BackupCopyStatusController {
    private final CurrentUserService current;
    private final PermissionEvaluationService permissions;
    private final BackupRunSummarySyncService sync;

    public BackupCopyStatusController(CurrentUserService current, PermissionEvaluationService permissions, BackupRunSummarySyncService sync) {
        this.current = current;
        this.permissions = permissions;
        this.sync = sync;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> status() {
        var actor = current.requireCurrentUser();
        if (!permissions.hasAnyPermission(actor, "backup.module.view", "reports.run.create", "report.module.export")) throw new AccessDeniedException("Not allowed to see the state of the backup copy");
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(sync.status());
    }
}

package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.backup.BackupRestoreStatusResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Entry point of the Backup & Restore module. Only a status endpoint exists until the feature is developed. */
@RestController
@RequestMapping("/backup-restore")
public class BackupRestoreController {

    private static final String VIEW_PERMISSION = "backup.module.view";

    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public BackupRestoreController(CurrentUserService currentUserService,
                                   PermissionEvaluationService permissionEvaluationService) {
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping("/status")
    public ResponseEntity<BackupRestoreStatusResponse> status() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, VIEW_PERMISSION)) {
            throw new AccessDeniedException("Backup & Restore view permission required");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(BackupRestoreStatusResponse.notImplemented());
    }
}

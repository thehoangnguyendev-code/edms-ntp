package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.ParticipantReconciliationMismatchResponse;
import com.eqms.service.AuthorizationParticipantReconciliationService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/security/participant-reconciliation")
public class AuthorizationParticipantReconciliationController {
    private final AuthorizationParticipantReconciliationService reconciliation;
    private final CurrentUserService currentUser;
    private final PermissionEvaluationService permissions;

    public AuthorizationParticipantReconciliationController(AuthorizationParticipantReconciliationService reconciliation,
                                                            CurrentUserService currentUser,
                                                            PermissionEvaluationService permissions) {
        this.reconciliation = reconciliation; this.currentUser = currentUser; this.permissions = permissions;
    }

    @GetMapping
    public List<ParticipantReconciliationMismatchResponse> list(@RequestParam(defaultValue = "100") int limit) {
        if (!permissions.hasPermission(currentUser.requireCurrentUser(), "security.access_profiles.update")) {
            throw new AccessDeniedException("Access profile management permission required");
        }
        return reconciliation.list(limit);
    }
}
